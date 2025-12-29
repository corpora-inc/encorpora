# cor/management/commands/refine_punjabi.py
"""
Use LLM to refine and perfect Punjabi (Gurmukhi and Shahmukhi) translations.

This command sends existing translations to an LLM with expert linguistic
guidance to fix orthographic issues, normalize spellings, and ensure both
scripts follow proper conventions while maintaining semantic accuracy.
"""

from __future__ import annotations

import random
import time
import multiprocessing
from typing import List, Tuple, Optional, Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, close_old_connections
from pydantic import BaseModel

from cor.models import Language, Translation, Entry
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider


REFINEMENT_PROMPT = """You are an expert Punjabi linguist creating a high-quality language learning corpus.

# Our Goal

We're building a corpus where learners can compare Punjabi written in two scripts side-by-side:
- **Gurmukhi** (used in Indian Punjab)
- **Shahmukhi** (Perso-Arabic script used in Pakistani Punjab)

Both represent the SAME Punjabi language. Your task is to ensure both versions are authentic, natural, and academically sound so learners can see how the same content appears in each script.

# What Makes Quality Punjabi

## For Shahmukhi (Perso-Arabic)

**Write authentic Pakistani Punjabi as found in academic texts and literature:**

- Use native Punjabi vocabulary and grammar (not Urdu substitutes)
- Write words as single units - NEVER insert spaces within a word stem
- Use standard Arabic/Persian letters that render everywhere (avoid exotic Unicode)
- Follow natural Shahmukhi spelling conventions
- Use Arabic vowel markers (zabar/zer/pesh) naturally where they aid clarity, as you'd see in academic Punjabi texts
- CRITICAL: Use ONLY Arabic-script combining marks - never mix in marks from other scripts (Hebrew, Devanagari, etc.)

## For Gurmukhi

**Write standard Indian Punjabi as found in dictionaries and textbooks:**

- Follow conventional dictionary spellings
- Use tippi/bindi/adhak marks correctly and consistently
- Apply standard orthographic patterns

## For Romanization (ISO 15919)

**Provide accurate phonetic representation:**

- Must match the pronunciation of BOTH scripts (they're the same language)
- Use ISO 15919 diacritics properly for Punjabi sounds
- Be consistent across entries

# Your Task

You'll receive English text with current Gurmukhi, Shahmukhi, and romanization. Refine all three to be:

1. **Semantically identical** - all three express the exact same Punjabi meaning
2. **Authentically Punjabi** - natural vocabulary and grammar, not borrowed from Urdu or Hindi
3. **Academically sound** - the quality you'd see in university textbooks
4. **Technically correct** - proper Unicode, no script mixing, renders everywhere

**Key Quality Checks:**
- Do Gurmukhi and Shahmukhi say the same thing in natural Punjabi?
- Are words spelled as single units (no internal spaces)?
- Would a native speaker recognize this as authentic Punjabi (not Urdu-flavored)?
- Will the text render correctly on all devices?

Return JSON with your refinements:
```json
{
  "gurmukhi": "refined text",
  "shahmukhi": "refined text",
  "romanization": "refined ISO 15919"
}
```

Return ONLY the JSON, no explanation."""


class RefinedPunjabi(BaseModel):
    """Single refined Punjabi entry."""
    entry_id: int
    gurmukhi: str
    shahmukhi: str
    romanization: str


class RefinementBatchResponse(BaseModel):
    """Response model for batch of refined Punjabi translations."""
    refinements: List[RefinedPunjabi]


def _batched(
    seq: Iterable[Tuple[int, str, str, str, str]], size: int
) -> Iterable[List[Tuple[int, str, str, str, str]]]:
    """Batch an iterable into chunks of specified size."""
    buf: List[Tuple[int, str, str, str, str]] = []
    for item in seq:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def refine_punjabi_batch(
    batch: List[Tuple[int, str, str, str, str]],  # (entry_id, english, gurmukhi, shahmukhi, romanization)
    llm,
) -> Optional[RefinementBatchResponse]:
    """
    Send a batch of Punjabi entries to LLM for refinement in one call.

    Each item in batch is: (entry_id, english, gurmukhi, shahmukhi, romanization)

    Returns:
        RefinementBatchResponse with list of refined entries, or None if failed
    """
    # Format all entries for the prompt
    entries_text = []
    for entry_id, english, gurmukhi, shahmukhi, romanization in batch:
        entries_text.append(
            f"{entry_id}:\n"
            f"English: {english}\n"
            f"Gurmukhi: {gurmukhi}\n"
            f"Shahmukhi: {shahmukhi}\n"
            f"Romanization: {romanization}"
        )

    user_prompt = "\n\n".join(entries_text)

    messages = [
        ChatCompletionTextMessage(role="system", text=REFINEMENT_PROMPT),
        ChatCompletionTextMessage(
            role="user",
            text=(
                "Return a JSON tool call matching RefinementBatchResponse: "
                "`refinements` is a list of objects with `entry_id`, `gurmukhi`, `shahmukhi`, and `romanization`."
            ),
        ),
        ChatCompletionTextMessage(role="user", text=user_prompt),
    ]

    try:
        result = llm.get_data_completion(messages, RefinementBatchResponse)
        return result
    except Exception as e:
        print(f"  Error refining batch: {e}")
        import traceback
        traceback.print_exc()
        return None


def refine_and_save_batch(
    batch: List[Tuple[int, str, str, str, str]],  # (entry_id, english, gurmukhi, shahmukhi, romanization)
    provider: str,
    dry_run: bool,
    batch_num: int,
    total_batches: int,
):
    """
    Worker: refine a batch of Punjabi entries and optionally save to database.

    Each item in batch is: (entry_id, english, gurmukhi, shahmukhi, romanization)
    """
    close_old_connections()
    batch_start = time.time()

    # Load LLM provider
    if provider == "xai":
        llm = load_llm_provider("xai")
    elif provider == "anthropic":
        llm = load_llm_provider("claude")
    elif provider == "openai":
        llm = load_llm_provider("openai")
    else:
        raise ValueError(f"Unknown provider: {provider}")

    # Single LLM call for entire batch
    result = refine_punjabi_batch(batch, llm)

    if not result or not result.refinements:
        print(f"✗ Batch {batch_num}/{total_batches} FAILED")
        return

    if not dry_run:
        # Get entry IDs from batch
        entry_ids = [entry_id for entry_id, _, _, _, _ in batch]

        # Fetch all translations by entry_id + language
        lang_guru = Language.objects.get(code="pa-Guru")
        lang_arab = Language.objects.get(code="pa-Arab")

        guru_translations = {
            t.entry_id: t
            for t in Translation.objects.filter(entry_id__in=entry_ids, language=lang_guru)
        }
        arab_translations = {
            t.entry_id: t
            for t in Translation.objects.filter(entry_id__in=entry_ids, language=lang_arab)
        }

        guru_updates = []
        arab_updates = []

        for refined in result.refinements:
            # Update Gurmukhi
            if refined.entry_id in guru_translations:
                t_guru = guru_translations[refined.entry_id]
                t_guru.text = refined.gurmukhi
                t_guru.romanization = refined.romanization
                guru_updates.append(t_guru)

            # Update Shahmukhi
            if refined.entry_id in arab_translations:
                t_arab = arab_translations[refined.entry_id]
                t_arab.text = refined.shahmukhi
                t_arab.romanization = refined.romanization
                arab_updates.append(t_arab)

        # Bulk update
        if guru_updates:
            Translation.objects.bulk_update(guru_updates, ["text", "romanization"])
        if arab_updates:
            Translation.objects.bulk_update(arab_updates, ["text", "romanization"])

    elapsed = time.time() - batch_start
    entries_per_sec = len(batch) / elapsed if elapsed > 0 else 0
    print(f"✓ Batch {batch_num}/{total_batches} | {len(batch)} entries | {elapsed:.1f}s | {entries_per_sec:.1f} entries/sec")


class Command(BaseCommand):
    help = (
        "Use LLM to refine and perfect Punjabi (Gurmukhi and Shahmukhi) translations "
        "based on proper linguistic and orthographic conventions."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            type=str,
            default="xai",
            choices=["xai", "anthropic", "openai"],
            help="LLM provider to use (default: xai)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show refined versions without saving to database.",
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=10,
            help="In --dry-run, number of examples to show (default: 10)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process only this many entries (0 = all). Good for testing.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=10,
            help="Number of entries per batch (default: 10)",
        )
        parser.add_argument(
            "--processes",
            type=int,
            default=multiprocessing.cpu_count(),
            help="Number of parallel processes (default: CPU count)",
        )

    def handle(self, *args, **opts):
        provider_name = opts["provider"]
        dry = bool(opts["dry_run"])
        sample_n = int(opts["sample"])
        limit = int(opts["limit"])
        batch_size = int(opts["batch_size"])
        processes = int(opts["processes"])

        try:
            lang_guru = Language.objects.get(code="pa-Guru")
            lang_arab = Language.objects.get(code="pa-Arab")
        except Language.DoesNotExist as e:
            raise CommandError(f"Language not found: {e}")

        # Get all entries that have both Gurmukhi and Shahmukhi translations
        entries_with_both = Entry.objects.filter(
            translations__language=lang_guru
        ).filter(
            translations__language=lang_arab
        ).distinct()

        total_count = entries_with_both.count()
        if total_count == 0:
            self.stdout.write("No entries with both Gurmukhi and Shahmukhi translations.")
            return

        self.stdout.write(f"Found {total_count} entries with both Gurmukhi and Shahmukhi translations.")

        # DRY RUN MODE: Batch processing for display
        if dry:
            # Load LLM provider for dry run
            self.stdout.write(f"Loading LLM provider '{provider_name}'...")
            if provider_name == "xai":
                llm = load_llm_provider("xai")
            elif provider_name == "anthropic":
                llm = load_llm_provider("claude")
            elif provider_name == "openai":
                llm = load_llm_provider("openai")
            else:
                raise CommandError(f"Unsupported provider: {provider_name}")

            process_count = min(sample_n, total_count)
            self.stdout.write(
                f"Processing {process_count} random samples in batches of {batch_size}..."
            )
            entries_to_process = list(entries_with_both.order_by("?")[:process_count])

            # Collect work items
            work_items: List[Tuple[int, str, str, str, str]] = []
            entry_lookup = {}  # entry_id → (entry, trans_guru, trans_arab)

            for entry in entries_to_process:
                try:
                    trans_guru = Translation.objects.get(entry=entry, language=lang_guru)
                    trans_arab = Translation.objects.get(entry=entry, language=lang_arab)
                except Translation.DoesNotExist:
                    continue

                work_items.append((
                    entry.id,
                    entry.en_text,
                    trans_guru.text,
                    trans_arab.text,
                    trans_guru.romanization or "",
                ))
                entry_lookup[entry.id] = (entry, trans_guru, trans_arab)

            all_refinements = []

            # Process in batches
            for batch in _batched(work_items, batch_size):
                result = refine_punjabi_batch(batch, llm)
                if result and result.refinements:
                    all_refinements.extend(result.refinements)

            self.stdout.write(f"\nSuccessfully refined {len(all_refinements)} entries:")
            self.stdout.write("=" * 100)

            for refined in all_refinements:
                if refined.entry_id not in entry_lookup:
                    continue

                entry, t_guru, t_arab = entry_lookup[refined.entry_id]

                guru_changed = refined.gurmukhi != t_guru.text
                arab_changed = refined.shahmukhi != t_arab.text
                rom_changed = refined.romanization != (t_guru.romanization or "")

                self.stdout.write(f"\nEnglish: {entry.en_text}")

                if guru_changed:
                    self.stdout.write(f"Gurmukhi:  {t_guru.text} → {refined.gurmukhi}")
                else:
                    self.stdout.write(f"Gurmukhi:  {t_guru.text} (unchanged)")

                if arab_changed:
                    self.stdout.write(f"Shahmukhi: {t_arab.text} → {refined.shahmukhi}")
                else:
                    self.stdout.write(f"Shahmukhi: {t_arab.text} (unchanged)")

                if rom_changed:
                    self.stdout.write(f"Roman:     {t_guru.romanization or '(empty)'} → {refined.romanization}")
                else:
                    self.stdout.write(f"Roman:     {refined.romanization} (unchanged)")

                self.stdout.write("-" * 100)

            self.stdout.write(f"\n✅ DRY RUN complete. Processed {len(all_refinements)} entries.")
            return

        # PRODUCTION MODE: Parallel processing with multiprocessing
        if limit > 0:
            process_count = min(limit, total_count)
            entries_to_process = entries_with_both[:process_count]
        else:
            process_count = total_count
            entries_to_process = entries_with_both

        self.stdout.write(
            f"Processing {process_count} entries with {provider_name} "
            f"(batch size: {batch_size}, processes: {processes})..."
        )

        # Collect all work items: (entry_id, english, gurmukhi, shahmukhi, romanization)
        work_items: List[Tuple[int, str, str, str, str]] = []

        for entry in entries_to_process:
            try:
                trans_guru = Translation.objects.get(entry=entry, language=lang_guru)
                trans_arab = Translation.objects.get(entry=entry, language=lang_arab)
            except Translation.DoesNotExist:
                continue

            work_items.append((
                entry.id,
                entry.en_text,
                trans_guru.text,
                trans_arab.text,
                trans_guru.romanization or "",
            ))

        if not work_items:
            self.stdout.write("No work items to process.")
            return

        # Calculate batches
        batches = list(_batched(work_items, batch_size))
        total_batches = len(batches)
        total_entries = len(work_items)

        self.stdout.write(
            f"\n{'='*60}\n"
            f"Processing {total_entries} entries in {total_batches} batches\n"
            f"Batch size: {batch_size} | Processes: {processes} | Provider: {provider_name}\n"
            f"{'='*60}\n"
        )

        # Start parallel processing
        start_time = time.time()
        pool = multiprocessing.Pool(processes=processes)

        for batch_num, batch in enumerate(batches, 1):
            pool.apply_async(
                refine_and_save_batch,
                args=(batch, provider_name, dry, batch_num, total_batches),
            )

        pool.close()
        pool.join()

        elapsed = time.time() - start_time
        rate = total_entries / elapsed if elapsed > 0 else 0
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'='*60}\n"
                f"✅ COMPLETE\n"
                f"Processed: {total_entries} entries\n"
                f"Time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)\n"
                f"Rate: {rate:.1f} entries/sec\n"
                f"{'='*60}"
            )
        )
