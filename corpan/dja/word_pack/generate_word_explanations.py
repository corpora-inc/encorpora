#!/usr/bin/env python3
"""Generate word explanations (LLM), EN-pivot then translate.

Generalizes `dja/hanzi_pack/generate_hanzi_etymologies.py` from per-character
etymologies to per-word explanations. Three stages:

  1. ENGLISH authoring -- one ~50-word paragraph per word capturing the range
     of common senses (polysemy), how they relate, where the word came from,
     and how the origin branched into the modern senses.
  2. ORIGIN VERIFICATION -- a separate critic pass over ONLY the etymology
     clause of each English paragraph. Definitions/senses are low-risk; the
     origin clause is hallucination-prone, so it is fact-checked and any
     uncertain root is softened/hedged (never confabulated). Verdicts are
     recorded so the build can surface low-confidence words.
  3. TRANSLATION -- faithfully render the verified English paragraph into each
     target language (written IN that language; no added facts).

Output (seed JSON consumed by build_word_pack.py):

    [{"word": "running",
      "explanation": {"en": "...", "zh-Hans": "...", ...},
      "origin_confidence": "high" | "medium" | "low",
      "origin_note": "..."}, ...]

This module is import-safe without the LLM provider installed: the heavy
imports happen inside main(), so the schema/parsing helpers (and their tests)
load with only the stdlib + pydantic.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

from pydantic import BaseModel

from extract_words import collect_words


# --------------------------------------------------------------------------
# LLM response schemas
# --------------------------------------------------------------------------
class ExplanationItem(BaseModel):
    word: str
    explanation: str


class ExplanationBatch(BaseModel):
    items: List[ExplanationItem]


class VerifyItem(BaseModel):
    word: str
    # "high" = mainstream/well-attested; "medium" = directionally right, hedged;
    # "low" = uncertain/contested -- the paragraph must hedge or omit the root.
    confidence: str
    note: str = ""
    # Optional corrected paragraph when the critic rewrites a bad origin clause.
    corrected: str = ""


class VerifyBatch(BaseModel):
    items: List[VerifyItem]


class TranslationItem(BaseModel):
    word: str
    text: str


class TranslationBatch(BaseModel):
    items: List[TranslationItem]


# --------------------------------------------------------------------------
# Seed I/O (shape matches build_word_pack.load_explanations + extra metadata)
# --------------------------------------------------------------------------
def load_seed(path: Path) -> Dict[str, dict]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: Dict[str, dict] = {}
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and isinstance(item.get("word"), str):
                rec = dict(item)
                rec.setdefault("explanation", {})
                out[item["word"]] = rec
    return out


def save_seed(path: Path, data: Dict[str, dict]) -> None:
    payload = [
        {
            "word": word,
            "explanation": rec.get("explanation", {}),
            **(
                {"origin_confidence": rec["origin_confidence"]}
                if rec.get("origin_confidence")
                else {}
            ),
            **({"origin_note": rec["origin_note"]} if rec.get("origin_note") else {}),
        }
        for word, rec in sorted(data.items(), key=lambda kv: kv[0])
    ]
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


ENGLISH_SYSTEM = (
    "You explain English words for language learners. For EACH word write ONE "
    "flowing paragraph of about 50 words that captures: (1) the word's range of "
    "common senses (its polysemy, where it has it) and how those senses relate; "
    "(2) where the word came from (etymology/origin); and (3) how the original "
    "idea branched into the modern senses. Friendly, accessible, accurate. Write "
    "in English only. If you are unsure of the precise root, hedge with phrases "
    "like 'is thought to come from' -- NEVER invent a root. Output JSON with "
    "`items`: each item has `word` and `explanation`."
)

VERIFY_SYSTEM = (
    "You are an adversarial historical-linguistics fact-checker. For each word "
    "you are given its explanation paragraph. Evaluate ONLY the ORIGIN/etymology "
    "clause (ignore the definitions/senses). Catch folk etymologies and "
    "overstated roots. For each word return `confidence` = 'high' (mainstream, "
    "well-attested), 'medium' (directionally right but should be hedged), or "
    "'low' (uncertain/contested). Put a one-line `note` only when action is "
    "needed. If the origin clause is wrong or overstated, return a `corrected` "
    "paragraph that softens/fixes it (keep ~50 words, keep the senses). NEVER "
    "confabulate a root; when unsure, hedge. Output JSON with `items`."
)


def main() -> None:
    here = Path(__file__).resolve()
    dja = here.parents[1]

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--core-db", type=Path, default=dja / "release.sqlite3")
    ap.add_argument(
        "--packs-dir", type=Path, default=dja.parent / "tools" / "phrase-packs"
    )
    ap.add_argument(
        "--out", type=Path, default=here.parent / "seed" / "explanations_full.json"
    )
    ap.add_argument(
        "--langs",
        nargs="*",
        default=["en"],
        help="Language codes to generate (include 'en').",
    )
    ap.add_argument(
        "--all-langs",
        action="store_true",
        help="Generate explanations for every language in the core DB.",
    )
    ap.add_argument("--words", nargs="*", default=None, help="Explicit word list.")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--provider", type=str, default="openai")
    ap.add_argument("--completion-model", type=str, default=None)
    ap.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip the origin-verification pass (NOT recommended).",
    )
    args = ap.parse_args()

    # Heavy imports deferred so parsing helpers stay import-safe for tests.
    from corpora_ai.llm_interface import ChatCompletionTextMessage
    from corpora_ai.provider_loader import load_llm_provider

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    if args.all_langs:
        conn = __import__("sqlite3").connect(
            f"file:{core_db}?mode=ro&immutable=1", uri=True
        )
        langs = [c for (c,) in conn.execute("SELECT code FROM cor_language")]
        conn.close()
    else:
        langs = list(args.langs)
    if "en" not in langs:
        langs = ["en", *langs]

    if args.words:
        words = sorted(set(w.lower() for w in args.words))
    else:
        words = collect_words(core_db, args.packs_dir.resolve())
    if args.limit:
        words = words[: args.limit]

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    seed = load_seed(out)

    llm_kwargs = {}
    if args.completion_model:
        llm_kwargs["completion_model"] = args.completion_model
    llm = load_llm_provider(args.provider, **llm_kwargs)

    def msg(role: str, text: str):
        return ChatCompletionTextMessage(role=role, text=text)

    # 1) English authoring.
    missing_en = [w for w in words if "en" not in seed.get(w, {}).get("explanation", {})]
    for i, batch in enumerate(chunk(missing_en, args.batch_size), start=1):
        print(f"[english] batch {i} ({len(batch)} words)", flush=True)
        res = llm.get_data_completion(
            [msg("system", ENGLISH_SYSTEM), msg("user", "\n".join(batch))],
            ExplanationBatch,
        )
        for item in res.items:
            rec = seed.setdefault(item.word, {"explanation": {}})
            rec["explanation"]["en"] = item.explanation.strip()
        save_seed(out, seed)

    # 2) Origin verification (English only).
    if not args.skip_verify:
        to_verify = [
            w
            for w in words
            if "en" in seed.get(w, {}).get("explanation", {})
            and not seed[w].get("origin_confidence")
        ]
        for i, batch in enumerate(chunk(to_verify, args.batch_size), start=1):
            print(f"[verify] batch {i} ({len(batch)} words)", flush=True)
            payload = "\n".join(
                f"{w}: {seed[w]['explanation']['en']}" for w in batch
            )
            res = llm.get_data_completion(
                [msg("system", VERIFY_SYSTEM), msg("user", payload)], VerifyBatch
            )
            for item in res.items:
                rec = seed.get(item.word)
                if not rec:
                    continue
                rec["origin_confidence"] = (item.confidence or "medium").lower()
                if item.note:
                    rec["origin_note"] = item.note.strip()
                if item.corrected.strip():
                    rec["explanation"]["en"] = item.corrected.strip()
            save_seed(out, seed)

    # 3) Translation of the verified English into each target language.
    for lang in [c for c in langs if c != "en"]:
        todo = [
            w
            for w in words
            if "en" in seed.get(w, {}).get("explanation", {})
            and lang not in seed[w]["explanation"]
        ]
        for i, batch in enumerate(chunk(todo, args.batch_size), start=1):
            print(f"[translate {lang}] batch {i} ({len(batch)} words)", flush=True)
            payload = "\n".join(
                f"{w}: {seed[w]['explanation']['en']}" for w in batch
            )
            res = llm.get_data_completion(
                [
                    msg(
                        "system",
                        f"Translate each English word-explanation into language "
                        f"code '{lang}', written naturally IN that language. "
                        f"Preserve meaning, tone, hedges, and the ~50-word "
                        f"length. Do NOT add facts. Output JSON `items` with "
                        f"`word` and `text`.",
                    ),
                    msg("user", payload),
                ],
                TranslationBatch,
            )
            for item in res.items:
                rec = seed.get(item.word)
                if rec and item.text.strip():
                    rec["explanation"][lang] = item.text.strip()
            save_seed(out, seed)

    print(f"Done. Wrote {out}")


if __name__ == "__main__":
    main()
