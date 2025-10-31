# cor/management/commands/load_thai_rtgs.py
from __future__ import annotations

"""
Thai RTGS romanization at production quality.

Pipeline (deterministic core + utterance-level cleanup):
  1) Segment Thai with AttaCut (required) to get real word boundaries.
  2) Per-word RTGS via PyThaiNLP ROYIN (tone-less, standard mappings).
  3) Re-join with conventional spacing (spaces between words, tight punctuation).
  4) Utterance-level LLM "RTGS normalizer" to fix segmentation artifacts, dropped vowels,
     compounds, loanwords, and spacing. (Provider via load_llm_provider().)

Only flag: --dry-run (prints a random sample of 10 without saving).

Requirements:
  pip install pythainlp attacut
"""

import json
import random
import re
import time
import unicodedata
import multiprocessing as mp
from typing import List, Tuple, Dict

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.db import close_old_connections

from cor.models import Language, Translation

# ---------- Third-party: Thai NLP ----------
try:
    from pythainlp.tokenize import word_tokenize  # uses engine="attacut"
    from pythainlp.transliterate import romanize
except Exception as e:
    raise CommandError(
        "PyThaiNLP not available. Install with: pip install pythainlp attacut"
    ) from e

# ---------- LLM glue (utterance-level cleaner) ----------
try:
    from pydantic import BaseModel
    from corpora_ai.provider_loader import load_llm_provider
    from corpora_ai.llm_interface import ChatCompletionTextMessage
except Exception as e:
    raise CommandError(
        "corpora_ai provider loader not available; required for LLM cleanup."
    ) from e

# --------------------------- Tunables ---------------------------
SAMPLE_N = 10
BATCH_SIZE_IDS = 1000  # DB update chunk
USE_LLM_CLEAN = True  # Single utterance-level cleanup pass
LLM_BATCH = 10  # items per LLM request
LLM_PROCESSES = max(1, mp.cpu_count() // 2)
LLM_MAX_RETRIES = 3

# --------------------------- Regex / Unicode helpers ---------------------------
_SPLIT_PUNCT = re.compile(r"(\s+|[.,!?;:()\"'…—\-])")
_TH_RANGE = re.compile(r"[\u0E00-\u0E7F]")
_TH_COMBINING = re.compile(r"[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]")  # Thai marks


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s or "")


def _is_thai_text(tok: str) -> bool:
    return bool(_TH_RANGE.search(tok))


def _is_punct_or_space(tok: str) -> bool:
    return bool(tok) and _SPLIT_PUNCT.fullmatch(tok) is not None


def _sanitize_roman(out: str) -> str:
    # Strip any stray Thai marks/letters an engine might leak; collapse spaces
    out = _TH_COMBINING.sub("", out or "")
    out = _TH_RANGE.sub("", out)
    out = re.sub(r"\s{2,}", " ", out.strip())
    return out


def _join_with_spaces(tokens: List[str]) -> str:
    """
    Conventional spacing:
      - Space between word tokens
      - No extra space before closers , . ! ? ; : ) " … — -
      - No extra space after openers ( "
    """
    out: List[str] = []
    prev = ""
    closers = set('.,!?;:)]”"’…—-')
    openers = set('([“"’(')
    for tok in tokens:
        if not tok:
            continue
        if not out:
            out.append(tok)
        else:
            if tok in closers:
                out[-1] = out[-1] + tok
            elif prev in openers:
                out[-1] = out[-1] + tok
            elif tok.isspace():
                if not out[-1].endswith(" "):
                    out.append(" ")
            else:
                out.append(" " + tok)
        prev = tok
    return re.sub(r"\s{2,}", " ", "".join(out)).strip()


# --------------------------- Base RTGS (deterministic) ---------------------------
def _rtgs_base(text: str) -> str:
    """
    Deterministic RTGS baseline:
      • Split coarse punctuation to preserve it.
      • For Thai chunks: word_tokenize(..., engine="attacut"), then ROYIN per word.
      • Join with spaces; sanitize any stray Thai codepoints.
    """
    src = _nfc(text)
    coarse = _SPLIT_PUNCT.split(src)
    result_tokens: List[str] = []

    for chunk in coarse:
        if not chunk:
            continue
        if _is_punct_or_space(chunk):
            result_tokens.append(chunk)
            continue

        if _is_thai_text(chunk):
            # REQUIRE AttaCut for high-quality word boundaries
            words = word_tokenize(chunk, engine="attacut")
            for w in words:
                if not w.strip():
                    continue
                if _is_thai_text(w):
                    try:
                        rt = romanize(w, engine="royin")
                    except Exception:
                        rt = w  # very rare; LLM pass can fix
                    result_tokens.append(_sanitize_roman(rt))
                else:
                    result_tokens.append(w)
        else:
            result_tokens.append(chunk)

    return _join_with_spaces(result_tokens)


# --------------------------- LLM cleanup (utterance-level) ---------------------------
class CleanItem(BaseModel):
    id: int
    thai: str
    rtgs_base: str


class CleanOutItem(BaseModel):
    id: int
    rtgs: str


class CleanOut(BaseModel):
    romanizations: List[CleanOutItem]


_SYSTEM_PROMPT = (
    "You are an expert Thai linguist performing *final* RTGS normalization.\n"
    "INPUT: a Thai sentence and a baseline RTGS romanization.\n"
    "TASK: output a single, perfect RTGS line:\n"
    "  • Tone-less, lowercase latin letters for words; keep punctuation as in source.\n"
    "  • Use official RTGS consonants (kh, ch, th, ph, ng, y, r, l, w, s, h, f).\n"
    "  • Vowels per RTGS (examples): a, i, u, e, o, ae, oe, ai, ao, am, ia, ua, uea; "
    "    ฤ/ฤๅ/ฦ → rue/lue as appropriate; ำ → am; เ-า → ao; เ-ีย → ia; เ-ือ → uea.\n"
    "  • Insert SPACES between words (no hyphens); DO NOT join compounds incorrectly.\n"
    "  • Fix segmentation/royin mistakes (dropped vowels, loanwords, compounds) but DO NOT translate.\n"
    "  • Remove any stray Thai characters from the output.\n"
    'OUTPUT: JSON only: {"romanizations":[{"id":<id>,"rtgs":"<final>"}...]}\n'
)

# --- Parallel LLM kernel ---
_LLM = None  # per-process


def _init_worker():
    """Initialize per-process LLM client once."""
    global _LLM
    close_old_connections()
    _LLM = load_llm_provider()  # no args


def _llm_call(batch: List[CleanItem]) -> Dict[int, str]:
    """One LLM request for <= LLM_BATCH items with light retries."""
    global _LLM
    if _LLM is None:
        _LLM = load_llm_provider()

    user_prompt = (
        "Normalize each item to perfect RTGS. Use the baseline as a hint but correct it when wrong. "
        "Return ONLY the JSON object described above."
    )
    messages = [
        ChatCompletionTextMessage(role="system", text=_SYSTEM_PROMPT),
        ChatCompletionTextMessage(role="user", text=user_prompt),
        ChatCompletionTextMessage(
            role="user",
            text=CleanItem.schema_json()
            + "\n"
            + CleanOut.schema_json()
            + "\n"
            + json.dumps([it.dict() for it in batch], ensure_ascii=False),
        ),
    ]

    delay = 1.0
    for _ in range(LLM_MAX_RETRIES):
        try:
            resp = _LLM.get_data_completion(messages, CleanOut)
            out = {
                it.id: _sanitize_roman(it.rtgs) for it in resp.romanizations if it.rtgs
            }
            return out
        except Exception:
            time.sleep(delay)
            delay = min(delay * 2.0, 8.0)
    return {}  # fallback handled by caller


def _chunk(seq: List[CleanItem], n: int) -> List[List[CleanItem]]:
    return [seq[i : i + n] for i in range(0, len(seq), n)]


def _llm_cleanup_batch(items: List[CleanItem]) -> List[str]:
    """
    Parallel utterance-level cleanup:
      - chunk into small requests (LLM_BATCH),
      - run across LLM_PROCESSES workers,
      - merge by id, return in original order.
    """
    if not items:
        return []

    # Map original order
    order = [it.id for it in items]

    # Split into small batches (better model focus & latency)
    batches = _chunk(items, LLM_BATCH)

    # Parallel pool (fork on unix)
    ctx = mp.get_context("fork") if hasattr(mp, "get_context") else mp
    merged: Dict[int, str] = {}
    with ctx.Pool(
        processes=LLM_PROCESSES, initializer=_init_worker, maxtasksperchild=100
    ) as pool:
        for partial_map in pool.imap_unordered(_llm_call, batches, chunksize=1):
            if partial_map:
                merged.update(partial_map)

    # Fallback: if any id missing, use baseline
    base_by_id = {it.id: _sanitize_roman(it.rtgs_base) for it in items}
    out_by_id = {i: merged.get(i, base_by_id[i]) for i in order}

    # Return in original order
    return [out_by_id[i] for i in order]


# --------------------------- Batch sentence pipeline ---------------------------
def _romanize_batch(sentences: List[str]) -> List[str]:
    base = [_rtgs_base(s) for s in sentences]
    if not USE_LLM_CLEAN:
        return base
    clean_items = [
        CleanItem(id=i, thai=t, rtgs_base=b)
        for i, (t, b) in enumerate(zip(sentences, base))
    ]
    cleaned = _llm_cleanup_batch(clean_items)
    # Final sanitation & spacing normalization (idempotent)
    return [_sanitize_roman(_join_with_spaces(s.split(" "))) for s in cleaned]


# --------------------------- Django command ---------------------------
class Command(BaseCommand):
    help = "Fill/refresh Translation.romanization for Thai (th) using AttaCut+ROYIN with parallel utterance-level LLM cleanup. --dry-run prints a random sample of 10."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview a random sample of 10 without saving.",
        )

    def handle(self, *args, **opts):
        dry = bool(opts["dry_run"])

        try:
            th = Language.objects.get(code="th")
        except Language.DoesNotExist as e:
            raise CommandError("Language(code='th') not found.") from e

        qs = Translation.objects.filter(language=th).filter(
            Q(romanization__isnull=True) | Q(romanization__exact="")
        )
        total = qs.count()
        if total == 0:
            self.stdout.write("th: nothing to process.")
            return

        id_text: List[Tuple[int, str]] = list(qs.values_list("id", "text"))

        if dry:
            random.shuffle(id_text)
            sample = id_text[: min(SAMPLE_N, len(id_text))]
            texts = [t for _, t in sample]
            outs = _romanize_batch(texts)
            for (tid, txt), rom in zip(sample, outs):
                print(f"[dry] ID {tid}: '{txt}' → '{rom}'")
            self.stdout.write("✅ DRY RUN complete.")
            return

        # Write path
        updated = 0
        for i in range(0, len(id_text), BATCH_SIZE_IDS):
            batch = id_text[i : i + BATCH_SIZE_IDS]
            ids = [tid for tid, _ in batch]
            texts = [txt for _, txt in batch]

            roms = _romanize_batch(texts)

            objs = list(Translation.objects.filter(id__in=ids))
            by_id = {tid: rom for (tid, _), rom in zip(batch, roms)}
            for o in objs:
                new_val = by_id.get(o.id, "").strip()
                if new_val and new_val != (o.romanization or "").strip():
                    o.romanization = new_val
                    updated += 1
            if objs:
                Translation.objects.bulk_update(
                    objs, ["romanization"], batch_size=BATCH_SIZE_IDS
                )
            self.stdout.write(f"[batch {i//BATCH_SIZE_IDS + 1}] saved {len(objs)}")

        self.stdout.write(self.style.SUCCESS(f"✅ Done: updated {updated} rows."))
