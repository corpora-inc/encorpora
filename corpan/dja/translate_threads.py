#!/usr/bin/env python3
"""Thread-based translator that avoids macOS multiprocessing crash dialogs.

Equivalent to `manage.py translate_missing --provider openai --random` but
uses a ThreadPoolExecutor for the LLM calls instead of multiprocessing.Pool.
LLM HTTP I/O releases the GIL, so threads give true parallelism without
fork/spawn drama.

Usage (from dja/):

    OPENAI_API_KEY=sk-... \
    PYTHONPATH=/Users/skyl/Code/corpora/py/packages \
    .venv/bin/python translate_threads.py ne pt-PT hr ...

Resumable: skips entries that already have a translation row for that lang.
DB writes happen serially from the main thread to keep SQLite happy.
"""

from __future__ import annotations

import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import django

HERE = Path(__file__).resolve().parent
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proj.settings")
sys.path.insert(0, str(HERE))
django.setup()

from cor.models import Entry, Language, Translation  # noqa: E402
from cor.utils.llm import translate_entry_batch  # noqa: E402
from corpora_ai.provider_loader import load_llm_provider  # noqa: E402


BATCH_SIZE = 10
THREADS = 16  # parallel LLM calls; OpenAI rate-limits at the account level


def translate_one_lang(lang_code: str, llm) -> dict:
    language = Language.objects.get(code=lang_code)

    existing_ids = set(
        Translation.objects.filter(language=language)
        .values_list("entry_id", flat=True)
    )
    all_pairs = list(
        Entry.objects.all().values_list("id", "en_text")
    )
    missing_pairs = [(eid, txt) for (eid, txt) in all_pairs if eid not in existing_ids]
    random.shuffle(missing_pairs)

    total = len(missing_pairs)
    if total == 0:
        print(f"[{lang_code}] nothing missing.", flush=True)
        return {"lang": lang_code, "done": 0, "fail": 0, "elapsed": 0}

    batches = [missing_pairs[i:i + BATCH_SIZE]
               for i in range(0, total, BATCH_SIZE)]
    print(f"[{lang_code}] {total} missing → {len(batches)} batches "
          f"(batch={BATCH_SIZE}, threads={THREADS})", flush=True)

    def llm_call(batch):
        return batch, translate_entry_batch(lang_code, batch, llm=llm, dry_run=True)

    done = 0
    fail = 0
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = [ex.submit(llm_call, b) for b in batches]
        for i, fut in enumerate(as_completed(futures), start=1):
            try:
                batch, resp = fut.result()
            except Exception as exc:
                fail += 1
                sys.stderr.write(f"[{lang_code}] BATCH FAIL: {exc}\n")
                continue
            # Serial DB write from main thread — avoids SQLite write contention.
            for t in resp.translations:
                Translation.objects.get_or_create(
                    entry_id=t.entry_id,
                    language=language,
                    defaults={"text": t.translated_text.strip()},
                )
            done += len(resp.translations)
            if i % 25 == 0 or i == len(batches):
                elapsed = time.monotonic() - t0
                rate = done / max(elapsed, 0.01)
                eta = (total - done) / max(rate, 0.01)
                print(
                    f"[{lang_code}] {i}/{len(batches)} batches "
                    f"({done}/{total} entries) "
                    f"elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    return {"lang": lang_code, "done": done, "fail": fail, "elapsed": elapsed}


def main():
    if len(sys.argv) < 2:
        print("usage: translate_threads.py <lang_code> [<lang_code> ...]")
        sys.exit(2)

    langs = sys.argv[1:]
    print(f"Translating {len(langs)} language(s) with openai provider...",
          flush=True)
    llm = load_llm_provider("openai")

    summary = []
    for lang_code in langs:
        try:
            summary.append(translate_one_lang(lang_code, llm))
        except KeyboardInterrupt:
            print(f"[{lang_code}] interrupted; partial state persisted.",
                  flush=True)
            raise
        except Exception as exc:
            sys.stderr.write(f"[{lang_code}] HARD FAIL: {exc}\n")
            summary.append({"lang": lang_code, "done": 0, "fail": -1,
                            "elapsed": 0})

    print("\n=== SUMMARY ===")
    for s in summary:
        print(f"  {s['lang']:14s}  done={s['done']}  fail={s['fail']}  "
              f"elapsed={s['elapsed']:.0f}s")


if __name__ == "__main__":
    main()
