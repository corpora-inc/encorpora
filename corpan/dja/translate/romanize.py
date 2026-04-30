#!/usr/bin/env python3
"""Generate romanizations for Hebrew (with nikkud) or Greek translations.

For each cor_translation row in the target language whose `romanization`
is empty, ask codex for a learner-friendly Latin transliteration and
UPDATE the row in place.

Usage:
    python3 romanize.py he --workers 4
    python3 romanize.py el --workers 4
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
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


SYSTEM_PROMPTS = {
    "he": (
        "You produce learner-friendly Latin transliterations of Hebrew text "
        "(text may include nikkud / vocalization marks). Use a simple, intuitive system: "
        "shewa nakh is silent, shewa na' = e, qamats = a, segol = e, tsere = e, "
        "patah = a, holam = o, shuruq = u, qubuts = u, hireq = i. "
        "Letters: alef = (silent if no nikkud) or follow vowel; bet = b/v (with/without dagesh); "
        "gimel = g; dalet = d; he = h; vav = v (or u/o as mater lectionis); "
        "zayin = z; chet = ch (kh-sound); tet = t; yod = y; kaf = k/kh; "
        "lamed = l; mem = m; nun = n; samekh = s; ayin = (silent or '); "
        "pe = p/f; tsadi = ts; qof = q; resh = r; shin = sh; sin = s; tav = t. "
        "Use hyphens for prefixes (ha-, le-, be-, mi-) where natural. "
        "Output JSON only: {\"items\":[{\"id\":int,\"roman\":\"<latin>\"}]}"
    ),
    "el": (
        "You produce learner-friendly Latin transliterations of Modern Greek text. "
        "Use a phonetic-leaning system close to ELOT 743 / ISO 843, but readable. "
        "α=a, β=v, γ=g (γκ=g/gk, γγ=ng), δ=d, ε=e, ζ=z, η=i, θ=th, ι=i, κ=k, λ=l, "
        "μ=m, ν=n, ξ=x, ο=o, π=p, ρ=r, σ/ς=s, τ=t, υ=i (after ντ/μπ as in oui), φ=f, "
        "χ=ch (kh-sound), ψ=ps, ω=o. Diphthongs: αι=e, ει=i, οι=i, ου=ou, αυ=av/af, "
        "ευ=ev/ef. Mark stress with an acute on stressed vowel (á, é, í, ó, ú). "
        "Output JSON only: {\"items\":[{\"id\":int,\"roman\":\"<latin>\"}]}"
    ),
}


def get_lang_id(db: Path, code: str) -> int:
    con = sqlite3.connect(str(db))
    cur = con.cursor()
    cur.execute("SELECT id FROM cor_language WHERE code = ?", (code,))
    row = cur.fetchone()
    con.close()
    if not row:
        raise SystemExit(f"unknown language code: {code}")
    return row[0]


def fetch_missing(db: Path, lang_id: int, limit: int = 0) -> list[Tuple[int, str]]:
    """Return (translation_id, text) for rows where romanization is empty."""
    con = sqlite3.connect(str(db))
    cur = con.cursor()
    sql = (
        "SELECT id, text FROM cor_translation "
        "WHERE language_id = ? AND (romanization IS NULL OR romanization = '') "
        "ORDER BY id"
    )
    if limit > 0:
        sql += f" LIMIT {int(limit)}"
    cur.execute(sql, (lang_id,))
    rows = cur.fetchall()
    con.close()
    return rows


def update_romanizations(db: Path, rows: list[Tuple[int, str]]) -> int:
    with DB_LOCK:
        con = sqlite3.connect(str(db))
        cur = con.cursor()
        cur.executemany("UPDATE cor_translation SET romanization = ? WHERE id = ?",
                        [(roman, tid) for (tid, roman) in rows])
        n = cur.rowcount
        con.commit()
        con.close()
        return n


def romanize_lang(db: Path, lang: str, batch_size: int, workers: int,
                  reasoning: str, timeout: float, limit: int) -> dict:
    if lang not in SYSTEM_PROMPTS:
        raise SystemExit(f"no romanization rubric for {lang!r}; supported: {list(SYSTEM_PROMPTS)}")

    lang_id = get_lang_id(db, lang)
    pairs = fetch_missing(db, lang_id, limit=limit)
    print(f"[{lang}] {len(pairs)} rows to romanize")
    if not pairs:
        return {"lang": lang, "ok": 0, "failed": 0, "updated": 0, "elapsed": 0.0}

    batches = [pairs[i : i + batch_size] for i in range(0, len(pairs), batch_size)]
    sys_prompt = SYSTEM_PROMPTS[lang]

    n_ok = n_failed = n_updated = 0
    t0 = time.monotonic()

    def _work(batch):
        items = [{"id": tid, "text": txt} for (tid, txt) in batch]
        prompt = (
            sys_prompt + "\n\n"
            + f"Items:\n{json.dumps(items, ensure_ascii=False)}"
        )
        try:
            parsed = codex.run_json(prompt, reasoning=reasoning, timeout=timeout)
        except Exception as exc:
            return batch, [], f"{type(exc).__name__}: {exc}"
        if not isinstance(parsed, dict) or "items" not in parsed:
            return batch, [], f"shape: {str(parsed)[:120]}"
        sent_ids = {tid for tid, _ in batch}
        rows = []
        for it in parsed["items"]:
            try:
                tid = int(it["id"])
                roman = str(it["roman"]).strip()
            except Exception:
                continue
            if tid in sent_ids and roman:
                rows.append((tid, roman))
        return batch, rows, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_work, b) for b in batches]
        for i, fut in enumerate(concurrent.futures.as_completed(futs), start=1):
            batch, rows, err = fut.result()
            if err:
                n_failed += 1
                sys.stderr.write(f"[{lang}] BATCH ERR n={len(batch)}: {err}\n")
            else:
                updated = update_romanizations(db, rows)
                n_updated += updated
                n_ok += 1
            if i % 5 == 0 or i == len(batches):
                elapsed = time.monotonic() - t0
                rate = n_updated / max(elapsed, 0.01)
                eta = (len(batches) - i) * (elapsed / max(i, 1))
                print(
                    f"[{lang}] {i}/{len(batches)} updated={n_updated} ok={n_ok} "
                    f"failed={n_failed} elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    return {"lang": lang, "ok": n_ok, "failed": n_failed,
            "updated": n_updated, "elapsed": elapsed}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("langs", nargs="+", help="BCP-47 codes (he, el)")
    p.add_argument("--db", default=str(DB_PATH))
    p.add_argument("--batch-size", type=int, default=30)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--reasoning", default="low")
    p.add_argument("--timeout", type=float, default=240.0)
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    db = Path(args.db)
    summary = []
    for lang in args.langs:
        summary.append(romanize_lang(
            db, lang, args.batch_size, args.workers,
            args.reasoning, args.timeout, args.limit,
        ))
        print(f"[{lang}] DONE: {summary[-1]}\n")

    print("\n=== SUMMARY ===")
    for s in summary:
        print(f"  {s['lang']}: updated={s.get('updated', 0)} ok={s['ok']} "
              f"failed={s['failed']} elapsed={s['elapsed']:.0f}s")


if __name__ == "__main__":
    main()
