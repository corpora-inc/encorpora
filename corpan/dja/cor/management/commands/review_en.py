# cor/management/commands/review_en.py
from __future__ import annotations

from typing import List, Optional

from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from django.db.models import QuerySet

from pydantic import BaseModel, Field, confloat

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from cor.models import Entry, Translation


# ---------- Pydantic model for LLM response ----------


class EnSuggestion(BaseModel):
    entry_id: int = Field(..., description="Entry.id to revise")
    original: str
    suggestion: str
    rationale: str
    confidence: confloat(ge=0, le=1)


class BatchReviewResult(BaseModel):
    suggestions: List[EnSuggestion] = []


# ---------- Prompts (slightly creative, level-safe) ----------

SYSTEM_PROMPT = """
You are an expert English editor for a world-class language learning corpus.

Goal:
- Make short English utterances as natural and idiomatic as possible for native speakers.
- Maintain the CEFR level (A1..C2): vocabulary and structure must match the level.
- You MAY make a small creative improvement if it stays plausible, helpful, and level-appropriate.
  Examples: clarify an ambiguous phrasing, pick a more specific noun, or make a sentence slightly more interesting.
  - we also want to get rid of "Wow", "CD" and "DVD". You can change the ones with "wow" by just removing it; CD and DVD get creative with either modernized terms or an appropriate generic term like "music" or "movie". This is a big opportunity to get extra creative to make a great, natural sentence.
  - Let's also change single word entries to have a bit more context, e.g. "pretty" -> "She is pretty." OR "I'm pretty tired." since there is ambiguity in the translation. Keep these very short and simple.
  - when you choose to get creative and add words, try to use creativity so it's not the most common words you would expect. For example, "apple" and "book" are super common in our corpus, and we have not "mango" or much slightly less common words. We probably don't even have "guitar" or "violin" - IDK. So, if you're going to add a noun, don't use "apple" or "book", use something interesting that probably isn't in the corpus yet - but is still appropriate for the level. Existing phrases with "book" and "apple" are fine, just don't add new ones with those words. Similarly, if you add a verb or an adjective, get a bit creative and delight us with your unique choices. We don't need the absolute most common ones.
- Keep roughly similar length (±20%). Do not introduce niche/obscure vocabulary for lower levels.
- Return ONLY high-confidence wins. If the text is already excellent, omit it.
"""

USER_PROMPT = """
For each input item (entry_id, en_text, level), decide if an improvement is warranted:
- If YES: include it in `suggestions` with a concise rationale and confidence in [0..1].
- If NO: omit it entirely. Return a single object matching BatchReviewResult.
"""

# ---------- Helpers ----------


def select_entries(
    limit: int, ids: Optional[List[int]] = None, random_sample: bool = False
) -> QuerySet[Entry]:
    qs = Entry.objects.only("id", "en_text", "level")
    if ids:
        qs = qs.filter(id__in=ids)
    if random_sample:
        print("Selecting random sample...")
        sample = qs.order_by("?")[:limit]
        print("\n".join([f"{s.en_text}" for s in sample]))
        return sample
    return qs.order_by("id")[:limit]


def run_llm_batch(provider: str, items: List[Entry]) -> BatchReviewResult:
    llm = load_llm_provider(provider)
    # Keep it simple: hand the batch as a Python-ish list string; your provider already handles this pattern.
    batch = [{"entry_id": e.id, "en_text": e.en_text, "level": e.level} for e in items]
    messages = [
        ChatCompletionTextMessage(role="system", text=SYSTEM_PROMPT),
        ChatCompletionTextMessage(role="user", text=f"{USER_PROMPT}\n\n{batch}"),
    ]
    return llm.get_data_completion(messages, BatchReviewResult)


def apply_suggestions(suggestions: List[EnSuggestion]) -> int:
    """
    Apply suggestions and delete translations ONLY for rows actually changed.
    """
    updated_ids: List[int] = []
    with transaction.atomic():
        for s in suggestions:
            e = Entry.objects.get(id=s.entry_id)
            if s.suggestion == e.en_text:
                continue
            # Keep en_text unique
            if Entry.objects.filter(en_text=s.suggestion).exclude(id=e.id).exists():
                continue
            e.en_text = s.suggestion
            try:
                e.save(update_fields=["en_text"])
                updated_ids.append(e.id)
            except IntegrityError:
                continue

        if updated_ids:
            # Nuke translations for changed entries; they'll be refilled by translate_missing
            Translation.objects.filter(entry_id__in=updated_ids).delete()

    return len(updated_ids)


# ---------- CLI ----------


class Command(BaseCommand):
    help = "LLM-driven English review. Preview random samples or apply across the corpus (deletes translations for updated rows)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            default="openai",
            help="LLM provider (openai, claude, xai, local)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help="Number of entries (preview) or total (apply)",
        )
        parser.add_argument(
            "--ids", type=str, default="", help="Comma-separated IDs to review"
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply suggestions to the DB (also deletes translations for updated entries)",
        )
        parser.add_argument(
            "--batch-size", type=int, default=50, help="Batch size for apply mode"
        )

    def handle(self, *args, **opts):
        provider = opts["provider"]
        ids = [int(x) for x in opts["ids"].split(",") if x.strip().isdigit()]
        limit = opts["limit"]
        do_apply = opts["apply"]
        batch_size = opts["batch_size"]

        if not do_apply:
            # Preview: random sample
            qs = select_entries(limit=limit, ids=ids or None, random_sample=True)
            entries = list(qs)
            self.stdout.write(
                self.style.NOTICE(
                    f"Preview: {len(entries)} random entries → {provider}"
                )
            )
            result = run_llm_batch(provider, entries)
            if not result.suggestions:
                self.stdout.write(self.style.WARNING("No suggestions."))
            for s in result.suggestions:
                self._print_suggestion(s)
        else:
            # Apply: sequential batches, straightforward
            qs = select_entries(limit=limit, ids=ids or None, random_sample=False)
            entries = list(qs)
            self.stdout.write(
                self.style.WARNING(
                    f"APPLY mode: {len(entries)} entries, provider={provider}"
                )
            )
            total = 0
            for i in range(0, len(entries), batch_size):
                chunk = entries[i : i + batch_size]
                result = run_llm_batch(provider, chunk)
                applied = (
                    apply_suggestions(result.suggestions) if result.suggestions else 0
                )
                total += applied
                self.stdout.write(
                    self.style.SUCCESS(f"Batch {i//batch_size+1}: applied {applied}")
                )
            self.stdout.write(self.style.SUCCESS(f"TOTAL applied: {total}"))

    def _print_suggestion(self, s: EnSuggestion):
        old = s.original.strip().replace("\n", " ")
        new = s.suggestion.strip().replace("\n", " ")
        self.stdout.write(f"\n#{s.entry_id}  conf={s.confidence:.2f}")
        self.stdout.write(f"  OLD: {old}")
        self.stdout.write(f"  NEW: {new}")
        self.stdout.write(f"  WHY: {s.rationale}")
