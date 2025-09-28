# cor/management/commands/review_en.py
from __future__ import annotations

from typing import List, Optional

from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from django.db.models import QuerySet

from pydantic import BaseModel, Field

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from cor.models import Entry, Translation


# ---------- Data models ----------


class EnSuggestion(BaseModel):
    entry_id: int = Field(..., description="Entry.id to revise")
    original: str
    suggestion: str


class BatchReviewResult(BaseModel):
    suggestions: List[EnSuggestion] = Field(default_factory=list)


# ---------- Minimal prompts ----------

BASE_SYSTEM_PROMPT = """
You edit English lines for a language-learning corpus.
Make each line A++: natural, idiomatic, useful, and a touch lively.
Keep CEFR level, meaning, and ~±20% length.
If a line is awkward or suboptimal for learning, rewrite it to a clearly better phrasing.
If it's already excellent, omit it.
Return only improved items.
""".strip()

BASE_USER_PROMPT = """
For each {entry_id, en_text, level}, output ONLY improved items:
{ entry_id, original, suggestion } inside `suggestions`.
If an item needs no change, omit it.
Return exactly one BatchReviewResult object.
""".strip()


# ---------- Helpers ----------


def select_entries(
    limit: Optional[int],
    ids: Optional[List[int]] = None,
    random_sample: bool = False,
) -> QuerySet[Entry]:
    qs = Entry.objects.only("id", "en_text", "level")
    if ids:
        qs = qs.filter(id__in=ids)
    if random_sample:
        return qs.order_by("?")[: (limit or 50)]
    qs = qs.order_by("id")
    return qs if limit is None else qs[:limit]


def run_llm_batch(
    provider: str,
    items: List[Entry],
    system_prompt: str,
    user_prompt: str,
) -> BatchReviewResult:
    llm = load_llm_provider(provider)
    batch = [{"entry_id": e.id, "en_text": e.en_text, "level": e.level} for e in items]
    messages = [
        ChatCompletionTextMessage(role="system", text=system_prompt),
        ChatCompletionTextMessage(role="user", text=f"{user_prompt}\n\n{batch}"),
    ]
    return llm.get_data_completion(messages, BatchReviewResult)


def apply_suggestions(suggestions: List[EnSuggestion]) -> int:
    """
    Apply suggestions and delete translations ONLY for rows actually changed.
    Skips if the suggestion duplicates another Entry.en_text (uniqueness).
    """
    updated_ids: List[int] = []
    with transaction.atomic():
        for s in suggestions:
            e = Entry.objects.select_for_update().get(id=s.entry_id)
            new_text = s.suggestion.strip()
            if not new_text or new_text == e.en_text:
                continue
            if Entry.objects.filter(en_text=new_text).exclude(id=e.id).exists():
                continue
            e.en_text = new_text
            try:
                e.save(update_fields=["en_text"])
                updated_ids.append(e.id)
            except IntegrityError:
                continue

        if updated_ids:
            Translation.objects.filter(entry_id__in=updated_ids).delete()

    return len(updated_ids)


# ---------- CLI ----------


class Command(BaseCommand):
    help = "LLM-driven English review. Preview 50 random entries (shows changed + skipped) or apply across the corpus (deletes translations for updated rows)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            default="openai",
            help="LLM provider (openai, claude, xai, local)",
        )
        parser.add_argument(
            "--apply", action="store_true", help="Apply suggestions to the DB"
        )
        parser.add_argument(
            "--batch-size", type=int, default=50, help="Batch size for apply mode"
        )
        parser.add_argument(
            "--ids",
            type=str,
            default="",
            help="Comma-separated Entry IDs to review (limits scope)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Preview size (default 50). Ignored in --apply unless --ids given.",
        )

    def handle(self, *args, **opts):
        provider = opts["provider"]
        do_apply = opts["apply"]
        batch_size = opts["batch_size"]
        ids = [int(x) for x in opts["ids"].split(",") if x.strip().isdigit()]
        limit = opts["limit"]

        system_prompt = BASE_SYSTEM_PROMPT
        user_prompt = BASE_USER_PROMPT

        if not do_apply:
            # Preview: random 50 (or --limit) unless --ids provided
            preview_limit = (limit or 50) if not ids else (limit or None)
            qs = select_entries(
                limit=preview_limit, ids=ids or None, random_sample=(not ids)
            )
            entries = list(qs)
            self.stdout.write(
                self.style.NOTICE(f"Preview: {len(entries)} entries → {provider}")
            )

            result = run_llm_batch(provider, entries, system_prompt, user_prompt)
            suggs = result.suggestions or []
            suggested_ids = {s.entry_id for s in suggs}
            skipped = [e for e in entries if e.id not in suggested_ids]

            # Proposed changes
            if suggs:
                self.stdout.write(
                    self.style.SUCCESS(f"\nProposed changes: {len(suggs)}")
                )
                for s in suggs:
                    old = s.original.strip().replace("\n", " ")
                    new = s.suggestion.strip().replace("\n", " ")
                    self.stdout.write(f"~ #{s.entry_id}\n  OLD: {old}\n  NEW: {new}\n")
            else:
                self.stdout.write(self.style.WARNING("\nNo proposed changes."))

            # Skipped items
            if skipped:
                self.stdout.write(
                    self.style.NOTICE(f"Skipped (no change): {len(skipped)}")
                )
                for e in skipped:
                    txt = e.en_text.strip().replace("\n", " ")
                    self.stdout.write(f"· #{e.id}  {txt}")
            return

        # APPLY: whole corpus unless --ids given (then honor ids, optionally --limit)
        apply_limit = None if not ids else limit
        qs = select_entries(limit=apply_limit, ids=ids or None, random_sample=False)
        entries = list(qs)
        self.stdout.write(
            self.style.WARNING(
                f"APPLY mode: {len(entries)} entries, provider={provider}"
            )
        )

        total_applied = 0
        for i in range(0, len(entries), batch_size):
            chunk = entries[i : i + batch_size]
            result = run_llm_batch(provider, chunk, system_prompt, user_prompt)
            suggs = result.suggestions or []
            applied = apply_suggestions(suggs) if suggs else 0
            total_applied += applied
            self.stdout.write(
                self.style.SUCCESS(f"Batch {i//batch_size+1}: applied {applied}")
            )

        self.stdout.write(self.style.SUCCESS(f"TOTAL applied: {total_applied}"))
