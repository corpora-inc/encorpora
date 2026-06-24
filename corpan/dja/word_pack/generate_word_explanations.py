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
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Dict, List, Optional, Type, TypeVar

from pydantic import BaseModel, ValidationError

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
    "like 'is thought to come from' -- NEVER invent a root. When an origin is "
    "SURPRISING or counterintuitive (e.g. a Romance word borrowed from a "
    "Germanic root, like Italian 'banca' giving English 'bank', or an everyday "
    "word with an unexpected lineage), state the borrowing path EXPLICITLY so a "
    "sharp reader does not mistake a correct fact for an error. Still never "
    "confabulate; hedge when unsure. Output JSON with `items`: each item has "
    "`word` and `explanation`."
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


def translate_system(lang: str) -> str:
    return (
        f"Translate each English word-explanation into language code '{lang}', "
        f"written naturally IN that language. Preserve meaning, tone, hedges, "
        f"and the ~50-word length. Do NOT add facts. Output JSON `items` with "
        f"`word` and `text`."
    )


# --------------------------------------------------------------------------
# Codex backend (subscription codex-cli, FREE) -- ADDITIVE alongside openai.
#
# Codex has no separate system role, so we compose system+user into one
# prompt string and demand JSON-only output. Each batch is validated against
# its pydantic schema; on parse/validation failure we retry up to
# `max_retries` times, then skip-and-log so one bad batch can't wedge the run.
# Batches run concurrently via a thread pool of `codex exec` subprocesses
# (network-bound, not CPU-bound). Seed writes are serialized under a lock so
# two workers never clobber the checkpoint file.
# --------------------------------------------------------------------------
TBatch = TypeVar("TBatch", bound=BaseModel)


def compose_codex_prompt(system: str, user: str) -> str:
    """Fold a system+user pair into one JSON-only codex prompt."""
    return (
        f"{system}\n\n"
        "Respond with ONLY a single JSON object and nothing else -- no prose, "
        "no markdown fences, no commentary. The JSON must match the described "
        "`items` shape exactly.\n\n"
        "INPUT:\n"
        f"{user}"
    )


def run_codex_batch(
    system: str,
    user: str,
    schema: Type[TBatch],
    *,
    reasoning: str,
    model: Optional[str],
    timeout: float,
    max_retries: int,
    label: str,
) -> Optional[TBatch]:
    """Run one codex batch, validate against `schema`, retry, then give up.

    Returns the validated model, or None if every attempt failed (the caller
    logs and skips so the overall run keeps making progress).
    """
    # Imported lazily so the module stays import-safe for the CI gate (which
    # has only stdlib + pydantic and never executes a real codex call). Ensure
    # the dja root is importable so `cor.utils.codex` resolves regardless of
    # how this script was launched (the script dir is word_pack/, not dja/).
    dja_root = str(Path(__file__).resolve().parents[1])
    if dja_root not in sys.path:
        sys.path.insert(0, dja_root)
    from cor.utils import codex

    prompt = compose_codex_prompt(system, user)
    last_err = ""
    for attempt in range(1, max_retries + 2):  # 1 try + max_retries retries
        try:
            obj = codex.run_json(
                prompt, reasoning=reasoning, model=model, timeout=timeout
            )
            return schema.model_validate(obj)
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            last_err = f"{type(exc).__name__}: {str(exc)[:200]}"
        except codex.CodexError as exc:
            last_err = f"CodexError: {str(exc)[:200]}"
        except Exception as exc:  # noqa: BLE001 -- never let a batch wedge the pool
            last_err = f"{type(exc).__name__}: {str(exc)[:200]}"
        if attempt <= max_retries:
            print(
                f"[{label}] attempt {attempt} failed ({last_err}); retrying",
                file=sys.stderr,
                flush=True,
            )
    print(
        f"[{label}] SKIPPED after {max_retries + 1} attempts: {last_err}",
        file=sys.stderr,
        flush=True,
    )
    return None


def run_codex_stage(
    batches: List[List[str]],
    build_prompt: Callable[[List[str]], "tuple[str, str]"],
    schema: Type[TBatch],
    apply_result: Callable[[TBatch], None],
    *,
    concurrency: int,
    reasoning: str,
    model: Optional[str],
    timeout: float,
    max_retries: int,
    save: Callable[[], None],
    save_lock: threading.Lock,
    stage: str,
) -> None:
    """Run a stage's batches concurrently, applying results + checkpointing
    under a lock so the seed file is never written by two workers at once."""
    if not batches:
        return

    def work(idx_batch):
        idx, batch = idx_batch
        system, user = build_prompt(batch)
        label = f"{stage} batch {idx}/{len(batches)} ({len(batch)} words)"
        print(f"[{label}] dispatch", flush=True)
        return idx, run_codex_batch(
            system,
            user,
            schema,
            reasoning=reasoning,
            model=model,
            timeout=timeout,
            max_retries=max_retries,
            label=label,
        )

    indexed = list(enumerate(batches, start=1))
    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        futures = [pool.submit(work, ib) for ib in indexed]
        for fut in as_completed(futures):
            idx, res = fut.result()
            if res is None:
                continue
            # Mutating the shared seed + writing it must be serialized.
            with save_lock:
                apply_result(res)
                save()


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
    ap.add_argument(
        "--provider",
        type=str,
        default="openai",
        help="LLM backend: 'openai' (billed corpora_ai) or 'codex' "
        "(FREE subscription codex-cli).",
    )
    ap.add_argument("--completion-model", type=str, default=None)
    # Codex-only knobs (ignored by the openai path).
    ap.add_argument(
        "--concurrency",
        type=int,
        default=8,
        help="codex: max concurrent `codex exec` batches.",
    )
    ap.add_argument(
        "--reasoning",
        type=str,
        default="low",
        help="codex: model_reasoning_effort (low keeps latency down).",
    )
    ap.add_argument(
        "--timeout", type=float, default=240.0, help="codex: per-batch timeout (s)."
    )
    ap.add_argument(
        "--max-retries",
        type=int,
        default=2,
        help="codex: retries per batch on parse/validation failure before "
        "skip-and-log.",
    )
    ap.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip the origin-verification pass (NOT recommended).",
    )
    args = ap.parse_args()

    use_codex = args.provider == "codex"

    # Heavy imports deferred so parsing helpers stay import-safe for tests.
    # The codex path needs neither corpora_ai nor a billed key.
    if not use_codex:
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

    # --- Shared, backend-agnostic merge logic (same for openai + codex) ---
    save_lock = threading.Lock()

    def save():
        save_seed(out, seed)

    def apply_english(res: ExplanationBatch) -> None:
        for item in res.items:
            rec = seed.setdefault(item.word, {"explanation": {}})
            rec["explanation"]["en"] = item.explanation.strip()

    def apply_verify(res: VerifyBatch) -> None:
        for item in res.items:
            rec = seed.get(item.word)
            if not rec:
                continue
            rec["origin_confidence"] = (item.confidence or "medium").lower()
            if item.note:
                rec["origin_note"] = item.note.strip()
            if item.corrected.strip():
                rec["explanation"]["en"] = item.corrected.strip()

    def make_apply_translation(lang: str):
        def apply_translation(res: TranslationBatch) -> None:
            for item in res.items:
                rec = seed.get(item.word)
                if rec and item.text.strip():
                    rec["explanation"][lang] = item.text.strip()

        return apply_translation

    def english_payload(batch: List[str]) -> str:
        return "\n".join(batch)

    def en_para_payload(batch: List[str]) -> str:
        return "\n".join(f"{w}: {seed[w]['explanation']['en']}" for w in batch)

    # --- Work-set selectors (identical resume semantics for both backends) ---
    def missing_en_words() -> List[str]:
        return [
            w for w in words if "en" not in seed.get(w, {}).get("explanation", {})
        ]

    def to_verify_words() -> List[str]:
        return [
            w
            for w in words
            if "en" in seed.get(w, {}).get("explanation", {})
            and not seed[w].get("origin_confidence")
        ]

    def to_translate_words(lang: str) -> List[str]:
        return [
            w
            for w in words
            if "en" in seed.get(w, {}).get("explanation", {})
            and lang not in seed[w]["explanation"]
        ]

    if use_codex:
        # --- Codex backend: validated, retried, concurrent, lock-checkpointed.
        codex_kwargs = dict(
            concurrency=args.concurrency,
            reasoning=args.reasoning,
            model=args.completion_model,
            timeout=args.timeout,
            max_retries=args.max_retries,
            save=save,
            save_lock=save_lock,
        )

        # 1) English authoring.
        run_codex_stage(
            chunk(missing_en_words(), args.batch_size),
            lambda b: (ENGLISH_SYSTEM, english_payload(b)),
            ExplanationBatch,
            apply_english,
            stage="english",
            **codex_kwargs,
        )

        # 2) Origin verification (English only).
        if not args.skip_verify:
            run_codex_stage(
                chunk(to_verify_words(), args.batch_size),
                lambda b: (VERIFY_SYSTEM, en_para_payload(b)),
                VerifyBatch,
                apply_verify,
                stage="verify",
                **codex_kwargs,
            )

        # 3) Translation into each target language.
        for lang in [c for c in langs if c != "en"]:
            run_codex_stage(
                chunk(to_translate_words(lang), args.batch_size),
                lambda b, lang=lang: (translate_system(lang), en_para_payload(b)),
                TranslationBatch,
                make_apply_translation(lang),
                stage=f"translate {lang}",
                **codex_kwargs,
            )

        print(f"Done. Wrote {out}")
        return

    # --- OpenAI backend (billed corpora_ai) -- unchanged behavior. ---
    llm_kwargs = {}
    if args.completion_model:
        llm_kwargs["completion_model"] = args.completion_model
    llm = load_llm_provider(args.provider, **llm_kwargs)

    def msg(role: str, text: str):
        return ChatCompletionTextMessage(role=role, text=text)

    # 1) English authoring.
    for i, batch in enumerate(chunk(missing_en_words(), args.batch_size), start=1):
        print(f"[english] batch {i} ({len(batch)} words)", flush=True)
        res = llm.get_data_completion(
            [msg("system", ENGLISH_SYSTEM), msg("user", english_payload(batch))],
            ExplanationBatch,
        )
        apply_english(res)
        save()

    # 2) Origin verification (English only).
    if not args.skip_verify:
        for i, batch in enumerate(chunk(to_verify_words(), args.batch_size), start=1):
            print(f"[verify] batch {i} ({len(batch)} words)", flush=True)
            res = llm.get_data_completion(
                [msg("system", VERIFY_SYSTEM), msg("user", en_para_payload(batch))],
                VerifyBatch,
            )
            apply_verify(res)
            save()

    # 3) Translation of the verified English into each target language.
    for lang in [c for c in langs if c != "en"]:
        apply_translation = make_apply_translation(lang)
        for i, batch in enumerate(
            chunk(to_translate_words(lang), args.batch_size), start=1
        ):
            print(f"[translate {lang}] batch {i} ({len(batch)} words)", flush=True)
            res = llm.get_data_completion(
                [
                    msg("system", translate_system(lang)),
                    msg("user", en_para_payload(batch)),
                ],
                TranslationBatch,
            )
            apply_translation(res)
            save()

    print(f"Done. Wrote {out}")


if __name__ == "__main__":
    main()
