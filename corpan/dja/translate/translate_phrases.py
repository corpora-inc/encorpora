#!/usr/bin/env python3
"""Translate every kept English phrase into the given target language(s)
via codex CLI. Standalone — reads/writes db.sqlite3 with raw sqlite3.

Usage:
    python3 translate_phrases.py LANG [LANG ...] [options]
    python3 translate_phrases.py he sv fi --workers 6 --batch-size 30

Resumable: each run only processes (entry, lang) pairs that don't yet have
a cor_translation row. Restart anytime.

Output: cor_translation INSERT OR IGNORE, one row per (entry, lang) pair.
romanization is left empty here — run the romanize_*.py scripts after for
he and el.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sqlite3
import sys
import threading
import time
from pathlib import Path
from typing import List, Tuple

HERE = Path(__file__).resolve().parent
DJA_ROOT = HERE.parent
DB_PATH = DJA_ROOT / "db.sqlite3"
sys.path.insert(0, str(DJA_ROOT))
from cor.utils import codex  # noqa: E402

DB_LOCK = threading.Lock()


# Per-language native style guides, modeled on prompt_native in cor/utils/llm.py
# but trimmed for the 9 new languages.
NATIVE_STYLE = {
    "he": (
        "אתה מתרגם מאנגלית לעברית מודרנית, רהוטה וטבעית. "
        "ספק תרגום אחד בלבד, קצר וברור, בלשון מנומסת אך לא נוקשה. "
        "השתמש בניקוד מלא בכל מילה. "
        "אם המקור הוא תווית/הוראה — אפשר לקבל פרגמנטים. "
        "מגדר: אם האנגלית ניטרלית, אל תוסיף מין; כשבדקדוק חייבים — נסה לאזן זכר/נקבה לאורך האצווה. "
        "פלט: רק התרגום בעברית מנוקדת, בלי מירכאות או הערות."
    ),
    "sv": (
        "Du är en professionell EN→SV-översättare. "
        "Lever en kort, naturlig och idiomatisk svensk översättning, modern och nyanserad ton. "
        "Bevara betydelsen utan stelhet och undvik anglicismer. "
        "Använd korrekt svensk skiljetecken och idiomatik. "
        "Genus: om engelskan inte specificerar kön ska du inte införa det; balansera om grammatiken kräver det. "
        "Output: enbart översättningen, inga citat eller kommentarer."
    ),
    "no": (
        "Du er en profesjonell EN→NO-oversetter. "
        "Lever en kort, idiomatisk og naturlig norsk (bokmål) oversettelse i moderne tone. "
        "Unngå anglisismer og stivt språk. "
        "Kjønn: ikke legg til kjønnsmarkering hvis kilden ikke har det. "
        "Output: bare oversettelsen, ingen anførselstegn eller notater."
    ),
    "da": (
        "Du er en professionel EN→DA-oversætter. "
        "Skriv en kort, idiomatisk og naturlig dansk oversættelse i moderne tone. "
        "Undgå anglicismer og kantet sprog. "
        "Køn: tilføj ikke kønsmarkering, hvis kilden ikke har det. "
        "Output: kun oversættelsen, ingen anførselstegn eller noter."
    ),
    "nl": (
        "Je bent een professionele EN→NL-vertaler. "
        "Lever een korte, natuurlijke, idiomatische vertaling in modern Standaardnederlands. "
        "Vermijd anglicismen en stijve constructies. "
        "Genus: voeg geen geslacht toe als de bron neutraal is. "
        "Output: alleen de vertaling, zonder aanhalingstekens of opmerkingen."
    ),
    "fi": (
        "Olet ammattimainen englanti→suomi-kääntäjä. "
        "Anna lyhyt, luonnollinen ja idiomaattinen käännös nykyaikaisella, kohteliaalla suomella. "
        "Vältä englannin kalkkeja ja kankeita rakenteita. Käytä luonnollisia sijapäätteitä. "
        "Sukupuoli: älä lisää sukupuolta, jos lähde ei sitä mainitse. "
        "Tuloste: vain käännös, ei lainausmerkkejä tai huomautuksia."
    ),
    "sw": (
        "Wewe ni mfasiri wa kitaalamu kutoka Kiingereza hadi Kiswahili sanifu. "
        "Toa tafsiri moja fupi, ya kawaida na ya heshima katika Kiswahili cha kisasa. "
        "Epuka tafsiri za neno-kwa-neno; tumia maneno ya kawaida na yenye mvuto. "
        "Jinsia: usiongeze taarifa za jinsia ikiwa Kiingereza hakijaitaja. "
        "Toleo: tafsiri tu, bila alama za nukuu wala maelezo."
    ),
    "el": (
        "Είσαι επαγγελματίας μεταφραστής EN→EL. "
        "Δώσε μια σύντομη, φυσική και ιδιωματική μετάφραση σε σύγχρονα νέα ελληνικά, "
        "ευγενικός αλλά όχι υπερβολικά τυπικός. "
        "Απόφυγε λέξη-προς-λέξη και αγγλισμούς. Χρησιμοποίησε σωστούς τόνους. "
        "Φύλο: μη προσθέτεις φύλο αν η πηγή δεν το διευκρινίζει. "
        "Έξοδος: μόνο η μετάφραση, χωρίς εισαγωγικά ή σχόλια."
    ),
    "ms": (
        "Anda penerjemah profesional EN→MS. "
        "Berikan terjemahan ringkas, semula jadi dan idiomatik dalam Bahasa Melayu standard moden, "
        "nada sopan tetapi tidak terlalu formal. "
        "Elakkan terjemahan harfiah dan kalk dari Inggeris. "
        "Jantina: jangan tambah maklumat jantina jika sumber tidak menyebutnya. "
        "Output: hanya teks terjemahan, tanpa tanda petikan atau nota."
    ),
}


def native_style(lang: str) -> str:
    return NATIVE_STYLE.get(
        lang,
        f"You are a world-class English-to-{lang} translator. "
        "Translate naturally and respectfully for A1-B1 learners. "
        "Output the translation only, no quotes or notes.",
    )


def fetch_missing_pairs(con: sqlite3.Connection, lang_code: str, limit: int = 0) -> list[Tuple[int, str]]:
    cur = con.cursor()
    cur.execute("SELECT id FROM cor_language WHERE code = ?", (lang_code,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"unknown language code in DB: {lang_code}")
    lang_id = row[0]
    sql = """
        SELECT e.id, e.en_text
        FROM cor_entry e
        WHERE NOT EXISTS (
          SELECT 1 FROM cor_translation t
          WHERE t.entry_id = e.id AND t.language_id = ?
        )
        ORDER BY e.id
    """
    if limit > 0:
        sql += f" LIMIT {int(limit)}"
    cur.execute(sql, (lang_id,))
    return [(eid, en) for eid, en in cur.fetchall()]


def build_prompt(lang: str, batch: list[Tuple[int, str]]) -> str:
    style = native_style(lang)
    items = [{"id": eid, "en": en} for eid, en in batch]
    user = (
        f"Translate each English phrase into {lang}. "
        f"Output ONLY a single JSON object with schema: "
        f'{{"translations":[{{"id":int,"text":"<{lang}-translation>"}}]}}\n'
        f"Items:\n"
        + json.dumps(items, ensure_ascii=False)
    )
    return style + "\n\n" + user


def insert_translations(db: Path, lang_id: int, rows: list[Tuple[int, str]]) -> int:
    """Bulk INSERT OR IGNORE. Returns rowcount inserted."""
    with DB_LOCK:
        con = sqlite3.connect(str(db))
        cur = con.cursor()
        cur.executemany(
            "INSERT OR IGNORE INTO cor_translation (entry_id, language_id, text, romanization) "
            "VALUES (?, ?, ?, '')",
            [(eid, lang_id, txt) for (eid, txt) in rows],
        )
        n = cur.rowcount
        con.commit()
        con.close()
        return n


def get_lang_id(db: Path, code: str) -> int:
    con = sqlite3.connect(str(db))
    cur = con.cursor()
    cur.execute("SELECT id FROM cor_language WHERE code = ?", (code,))
    row = cur.fetchone()
    con.close()
    if not row:
        raise SystemExit(f"unknown language code in DB: {code}")
    return row[0]


def translate_lang(db: Path, lang: str, batch_size: int, workers: int,
                   reasoning: str, timeout: float, limit: int) -> dict:
    """Translate all missing pairs for one language."""
    con = sqlite3.connect(str(db))
    pairs = fetch_missing_pairs(con, lang, limit=limit)
    con.close()
    print(f"[{lang}] {len(pairs)} pairs to translate")
    if not pairs:
        return {"lang": lang, "ok": 0, "failed": 0, "elapsed": 0.0}

    lang_id = get_lang_id(db, lang)
    batches = [pairs[i : i + batch_size] for i in range(0, len(pairs), batch_size)]

    n_ok = 0
    n_failed = 0
    n_inserted = 0
    t0 = time.monotonic()

    def _work(batch):
        prompt = build_prompt(lang, batch)
        try:
            parsed = codex.run_json(prompt, reasoning=reasoning, timeout=timeout)
        except Exception as exc:
            return batch, [], f"{type(exc).__name__}: {exc}"
        if not isinstance(parsed, dict) or "translations" not in parsed:
            return batch, [], f"shape: {str(parsed)[:120]}"
        # Normalize
        sent_ids = {eid for eid, _ in batch}
        rows = []
        for t in parsed["translations"]:
            try:
                rid = int(t["id"])
                txt = str(t["text"]).strip()
            except Exception:
                continue
            if rid in sent_ids and txt:
                rows.append((rid, txt))
        return batch, rows, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_work, b) for b in batches]
        for i, fut in enumerate(concurrent.futures.as_completed(futs), start=1):
            batch, rows, err = fut.result()
            if err:
                n_failed += 1
                sys.stderr.write(f"[{lang}] BATCH ERR n={len(batch)}: {err}\n")
            else:
                inserted = insert_translations(db, lang_id, rows)
                n_inserted += inserted
                n_ok += 1
            if i % 5 == 0 or i == len(batches):
                elapsed = time.monotonic() - t0
                rate = n_inserted / max(elapsed, 0.01)
                eta = (len(batches) - i) * (elapsed / max(i, 1))
                print(
                    f"[{lang}] {i}/{len(batches)} "
                    f"inserted={n_inserted} ok={n_ok} failed={n_failed} "
                    f"elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    return {"lang": lang, "ok": n_ok, "failed": n_failed,
            "inserted": n_inserted, "elapsed": elapsed}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("langs", nargs="+", help="BCP-47 codes to translate to")
    p.add_argument("--db", default=str(DB_PATH))
    p.add_argument("--batch-size", type=int, default=30)
    p.add_argument("--workers", type=int, default=6)
    p.add_argument("--reasoning", default="low")
    p.add_argument("--timeout", type=float, default=300.0)
    p.add_argument("--limit", type=int, default=0,
                   help="Cap pairs processed per language (0=all)")
    args = p.parse_args()

    db = Path(args.db)
    print(f"DB: {db}")
    print(f"Langs: {args.langs}")

    summary = []
    for lang in args.langs:
        result = translate_lang(
            db, lang,
            batch_size=args.batch_size, workers=args.workers,
            reasoning=args.reasoning, timeout=args.timeout,
            limit=args.limit,
        )
        summary.append(result)
        print(f"[{lang}] DONE: {result}\n")

    print("\n=== SUMMARY ===")
    for s in summary:
        print(f"  {s['lang']}: inserted={s.get('inserted', 0)} ok={s['ok']} "
              f"failed={s['failed']} elapsed={s['elapsed']:.0f}s")


if __name__ == "__main__":
    main()
