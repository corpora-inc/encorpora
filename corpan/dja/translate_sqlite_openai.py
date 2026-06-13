#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import random
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path.home() / ".env")

LANGS = {
    "jv": {
        "name": "Javanese",
        "note": "Use Latin-script Basa Jawa. Prefer broadly understandable polite-neutral Ngoko alus. Avoid Indonesian calques and do not use Javanese script.",
    },
    "su": {
        "name": "Sundanese",
        "note": "Use Latin-script Basa Sunda. Prefer polite-neutral standard Sundanese. Avoid Indonesian calques and do not use Sundanese script.",
    },
    "tl": {
        "name": "Tagalog",
        "note": "Use natural modern Tagalog/Filipino in Latin script, neutral conversational register. Avoid overly formal or English-shaped phrasing.",
    },
}

SYSTEM = """You are a senior translator for a language-learning corpus.

Return ONLY valid JSON: {"translations":[{"entry_id":123,"text":"..."}]}.

Rules:
- Translate each English sentence naturally and idiomatically for learners.
- Keep meaning, numbers, names, and named entities intact.
- Do not add explanations, quotes, language labels, romanization, or markdown.
- Short labels/fragments may remain fragments if that is natural.
- If English is gender-neutral, do not add gender.
"""


def build_prompt(lang: str, rows: list[tuple[int, str]]) -> str:
    spec = LANGS[lang]
    payload = [{"entry_id": entry_id, "english": text} for entry_id, text in rows]
    return (
        f"Target language: {spec['name']} ({lang}).\n"
        f"Language note: {spec['note']}\n\n"
        "Translate every item below. Preserve entry_id exactly.\n\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


def translate_batch(client: OpenAI, model: str, lang: str, rows: list[tuple[int, str]], retries: int) -> list[tuple[int, str]]:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": build_prompt(lang, rows)},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            content = resp.choices[0].message.content or "{}"
            data = json.loads(content)
            items = data.get("translations")
            if not isinstance(items, list):
                raise ValueError("missing translations list")
            expected = {entry_id for entry_id, _ in rows}
            out: list[tuple[int, str]] = []
            for item in items:
                entry_id = int(item["entry_id"])
                text = str(item.get("text", "")).strip()
                if entry_id in expected and text:
                    out.append((entry_id, text))
            got = {entry_id for entry_id, _ in out}
            missing = expected - got
            if missing:
                raise ValueError(f"missing {len(missing)} ids")
            return out
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(min(2**attempt, 10))
    raise RuntimeError(f"translation failed after retries: {last_error}")


def ensure_language(conn: sqlite3.Connection, code: str) -> int:
    spec = LANGS[code]
    conn.execute(
        "insert or ignore into cor_language(code,name) values (?,?)",
        (code, spec["name"]),
    )
    row = conn.execute("select id from cor_language where code=?", (code,)).fetchone()
    if row is None:
        raise RuntimeError(f"failed to ensure language {code}")
    return int(row[0])


def missing_rows(conn: sqlite3.Connection, language_id: int, limit: int | None, randomize: bool) -> list[tuple[int, str]]:
    rows = conn.execute(
        """
        select e.id, e.en_text
        from cor_entry e
        left join cor_translation t on t.entry_id=e.id and t.language_id=?
        where t.id is null
        order by e.id
        """,
        (language_id,),
    ).fetchall()
    out = [(int(r[0]), str(r[1])) for r in rows]
    if randomize:
        random.shuffle(out)
    if limit:
        out = out[:limit]
    return out


def chunks(rows: list[tuple[int, str]], size: int):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("langs", nargs="+", choices=sorted(LANGS))
    parser.add_argument("--db", default="db.sqlite3")
    parser.add_argument("--model", default=os.environ.get("CORPAN_CORE_TRANSLATE_MODEL", "gpt-4o-mini"))
    parser.add_argument("--batch-size", type=int, default=40)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--random", action="store_true")
    parser.add_argument("--retries", type=int, default=3)
    args = parser.parse_args()

    client = OpenAI()
    conn = sqlite3.connect(args.db)
    try:
        for lang in args.langs:
            language_id = ensure_language(conn, lang)
            conn.commit()
            rows = missing_rows(conn, language_id, args.limit or None, args.random)
            total = len(rows)
            if total == 0:
                print(f"[{lang}] complete")
                continue
            batches = list(chunks(rows, args.batch_size))
            print(f"[{lang}] {total} missing -> {len(batches)} batches, workers={args.workers}, model={args.model}", flush=True)
            done = 0
            failed = 0
            t0 = time.monotonic()
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = {
                    pool.submit(translate_batch, client, args.model, lang, batch, args.retries): batch
                    for batch in batches
                }
                for idx, fut in enumerate(as_completed(futures), start=1):
                    try:
                        translated = fut.result()
                    except Exception as exc:
                        failed += 1
                        print(f"[{lang}] batch failed: {exc}", flush=True)
                        continue
                    conn.executemany(
                        """
                        insert or ignore into cor_translation(entry_id, language_id, text, romanization)
                        values (?,?,?, '')
                        """,
                        [(entry_id, language_id, text) for entry_id, text in translated],
                    )
                    conn.commit()
                    done += len(translated)
                    if idx % 25 == 0 or idx == len(batches):
                        elapsed = time.monotonic() - t0
                        rate = done / max(elapsed, 0.1)
                        print(f"[{lang}] {idx}/{len(batches)} batches {done}/{total} rows rate={rate:.1f}/s failed={failed}", flush=True)
            if failed:
                print(f"[{lang}] finished with {failed} failed batches; rerun to fill gaps", flush=True)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
