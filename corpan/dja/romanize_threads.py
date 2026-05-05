#!/usr/bin/env python3
"""Thread-based romanizer using the OpenAI SDK directly.

Equivalent to `dja/translate/romanize.py` but bypasses the codex CLI (which
is rate-limited per ChatGPT subscription) and goes straight to the OpenAI
API. Same SYSTEM_PROMPTS rubrics (ne, uk, bg, yue-Hant-HK + he, el if
needed for backfill).

Usage (from dja/):

    OPENAI_API_KEY=sk-... \
    PYTHONPATH=/Users/skyl/Code/corpora/py/packages \
    .venv/bin/python romanize_threads.py ne uk bg yue-Hant-HK
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import django

HERE = Path(__file__).resolve().parent
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")
sys.path.insert(0, str(HERE))
django.setup()

from cor.models import Language, Translation  # noqa: E402

# Reuse the rubrics defined in dja/translate/romanize.py.
sys.path.insert(0, str(HERE / "translate"))
from romanize import SYSTEM_PROMPTS  # noqa: E402

from openai import OpenAI  # noqa: E402


BATCH_SIZE = 30
THREADS = 16
MODEL = os.environ.get("ROMANIZE_MODEL", "gpt-4o-mini")

DB_LOCK = threading.Lock()
client = OpenAI()


def romanize_batch(lang_code: str, batch: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Send a batch to the LLM, parse JSON, return [(translation_id, roman), ...]."""
    sys_prompt = SYSTEM_PROMPTS[lang_code]
    items_payload = [{"id": tid, "text": txt} for tid, txt in batch]
    user_prompt = (
        "Items:\n"
        + json.dumps(items_payload, ensure_ascii=False)
    )

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    content = resp.choices[0].message.content or "{}"
    parsed = json.loads(content)
    items = parsed.get("items", []) if isinstance(parsed, dict) else []
    sent_ids = {tid for tid, _ in batch}
    rows = []
    for it in items:
        try:
            tid = int(it["id"])
            roman = str(it.get("roman", "")).strip()
        except (KeyError, TypeError, ValueError):
            continue
        if tid in sent_ids and roman:
            rows.append((tid, roman))
    return rows


def romanize_lang(lang_code: str, only_missing: bool = True) -> dict:
    if lang_code not in SYSTEM_PROMPTS:
        raise SystemExit(f"no rubric for {lang_code!r}; supported: {sorted(SYSTEM_PROMPTS)}")

    language = Language.objects.get(code=lang_code)
    qs = Translation.objects.filter(language=language)
    if only_missing:
        qs = qs.filter(romanization__in=[None, ""])

    pairs = list(qs.values_list("id", "text"))
    total = len(pairs)
    if total == 0:
        print(f"[{lang_code}] nothing to romanize.", flush=True)
        return {"lang": lang_code, "ok": 0, "fail": 0, "elapsed": 0}

    batches = [pairs[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    print(f"[{lang_code}] {total} rows → {len(batches)} batches "
          f"(batch={BATCH_SIZE}, threads={THREADS}, model={MODEL})", flush=True)

    n_ok = 0
    n_fail = 0
    n_updated = 0
    t0 = time.monotonic()

    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        future_map = {ex.submit(romanize_batch, lang_code, b): b for b in batches}
        for i, fut in enumerate(as_completed(future_map), start=1):
            try:
                rows = fut.result()
            except Exception as exc:
                n_fail += 1
                sys.stderr.write(f"[{lang_code}] BATCH FAIL: {exc}\n")
                continue

            with DB_LOCK:
                for tid, roman in rows:
                    Translation.objects.filter(id=tid).update(romanization=roman)
            n_updated += len(rows)
            n_ok += 1

            if i % 25 == 0 or i == len(batches):
                elapsed = time.monotonic() - t0
                rate = n_updated / max(elapsed, 0.01)
                eta = (total - n_updated) / max(rate, 0.01)
                print(
                    f"[{lang_code}] {i}/{len(batches)} batches "
                    f"({n_updated}/{total} updated, ok={n_ok} fail={n_fail}) "
                    f"elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    return {"lang": lang_code, "ok": n_ok, "fail": n_fail,
            "updated": n_updated, "elapsed": elapsed}


def main():
    if len(sys.argv) < 2:
        print(f"usage: romanize_threads.py <lang> [<lang> ...]  (supported: {sorted(SYSTEM_PROMPTS)})")
        sys.exit(2)

    langs = sys.argv[1:]
    summary = []
    for lang_code in langs:
        try:
            summary.append(romanize_lang(lang_code))
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            sys.stderr.write(f"[{lang_code}] HARD FAIL: {exc}\n")
            summary.append({"lang": lang_code, "ok": 0, "fail": -1,
                            "elapsed": 0})

    print("\n=== SUMMARY ===")
    for s in summary:
        print(f"  {s['lang']:14s}  updated={s.get('updated', 0):6d}  "
              f"ok={s['ok']}  fail={s['fail']}  elapsed={s['elapsed']:.0f}s")


if __name__ == "__main__":
    main()
