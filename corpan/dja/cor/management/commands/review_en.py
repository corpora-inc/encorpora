# cor/management/commands/review_en.py
from __future__ import annotations

from typing import List, Optional, Set

from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from django.db.models import QuerySet

from pydantic import BaseModel, Field, confloat

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from cor.models import Entry, Translation


class EnSuggestion(BaseModel):
    entry_id: int = Field(..., description="Entry.id to revise")
    original: str
    suggestion: str
    rationale: str
    confidence: confloat(ge=0, le=1)


class BatchReviewResult(BaseModel):
    suggestions: List[EnSuggestion] = []


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


def select_entries(
    limit: Optional[int],
    ids: Optional[List[int]] = None,
    random_sample: bool = False,
) -> QuerySet[Entry]:
    qs = Entry.objects.only("id", "en_text", "level")
    if ids:
        qs = qs.filter(id__in=ids)

    if random_sample:
        print("Selecting random sample...")
        sample = qs.order_by("?")[: (limit or 50)]
        print("\n".join([f"{s.en_text}" for s in sample]))
        return sample

    qs = qs.order_by("id")
    return qs if limit is None else qs[:limit]


def run_llm_batch(provider: str, items: List[Entry]) -> BatchReviewResult:
    llm = load_llm_provider(provider)
    batch = [{"entry_id": e.id, "en_text": e.en_text, "level": e.level} for e in items]
    messages = [
        ChatCompletionTextMessage(role="system", text=SYSTEM_PROMPT),
        ChatCompletionTextMessage(role="user", text=f"{USER_PROMPT}\n\n{batch}"),
    ]
    return llm.get_data_completion(messages, BatchReviewResult)


# --- Collision re-prompt (optional) ---

COLLISION_SYSTEM = SYSTEM_PROMPT.strip()


def reprompt_collision(
    provider: str,
    entry: Entry,
    forbidden: List[str],
    note: str = "",
) -> Optional[str]:
    """
    Ask the LLM for an alternative that avoids any string in `forbidden`.
    Returns a new suggestion string or None.
    """
    llm = load_llm_provider(provider)
    avoid_list = ", ".join([f'"{t}"' for t in forbidden if t])
    extra = f"\nExtra creative guidance: {note}" if note else ""
    user = (
        "A previous suggestion collided with an existing sentence in the corpus.\n"
        f"COLLISION AVOIDANCE: Do NOT produce exactly any of these strings: {avoid_list}\n"
        "Provide ONE equally good, level-appropriate alternative for this item, or skip if you cannot improve.\n"
        "Return the same BatchReviewResult schema (sparse; at most one suggestion here)."
        f"{extra}\n\n"
        f"[ITEM]\n{{'entry_id': %d, 'en_text': %r, 'level': %r}}\n"
        % (entry.id, entry.en_text, entry.level)
    )
    messages = [
        ChatCompletionTextMessage(role="system", text=COLLISION_SYSTEM),
        ChatCompletionTextMessage(role="user", text=user),
    ]
    res: BatchReviewResult = llm.get_data_completion(messages, BatchReviewResult)
    if res.suggestions:
        # Take the first suggestion targeting this entry (or any)
        for s in res.suggestions:
            if s.entry_id == entry.id:
                return s.suggestion.strip()
        return res.suggestions[0].suggestion.strip()
    return None


def apply_with_collision_resolution(
    suggestions: List[EnSuggestion],
    *,
    provider: str,
    existing_texts: Set[str],
    reprompt: bool,
    attempts: int,
    note: str,
) -> tuple[int, List[int]]:
    """
    Apply suggestions; on collision optionally re-prompt.
    Returns (applied_count, collided_ids_skipped).
    """
    updated_ids: List[int] = []
    collided_ids: List[int] = []

    with transaction.atomic():
        for s in suggestions:
            e = Entry.objects.select_for_update().get(id=s.entry_id)

            # No-op?
            if s.suggestion == e.en_text:
                continue

            # Collision check (fast set lookup)
            if s.suggestion in existing_texts and s.suggestion != e.en_text:
                # Try to resolve via re-prompt, if enabled
                if reprompt:
                    alt = None
                    forbidden = [s.suggestion, e.en_text]
                    for _ in range(max(0, attempts)):
                        alt = reprompt_collision(provider, e, forbidden, note=note)
                        if alt and alt != e.en_text and alt not in existing_texts:
                            break
                        if alt:
                            forbidden.append(alt)
                    if not alt or alt in existing_texts:
                        collided_ids.append(e.id)
                        continue
                    # Use alt
                    s.suggestion = alt
                else:
                    collided_ids.append(e.id)
                    continue

            # Apply
            try:
                old_text = e.en_text
                e.en_text = s.suggestion
                e.save(update_fields=["en_text"])
                updated_ids.append(e.id)

                # Keep the in-memory set current
                if old_text in existing_texts:
                    existing_texts.remove(old_text)
                existing_texts.add(s.suggestion)

            except IntegrityError:
                collided_ids.append(e.id)
                continue

        if updated_ids:
            Translation.objects.filter(entry_id__in=updated_ids).delete()

    return len(updated_ids), collided_ids


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
            default=None,
            help="(Preview only) If provided with --ids, can bound the selection; otherwise ignored for --apply.",
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
        # --- new, minimal collision controls ---
        parser.add_argument(
            "--reprompt-collisions",
            action="store_true",
            help="On collision, re-prompt to get a distinct alternative",
        )
        parser.add_argument(
            "--collision-attempts",
            type=int,
            default=2,
            help="Max re-prompt attempts per collided entry",
        )
        parser.add_argument(
            "--collision-note",
            type=str,
            default="",
            help="Optional extra creative guidance used only when re-prompting collisions",
        )

    def handle(self, *args, **opts):
        provider = opts["provider"]
        ids = [int(x) for x in opts["ids"].split(",") if x.strip().isdigit()]
        do_apply = opts["apply"]
        batch_size = opts["batch_size"]
        reprompt = opts["reprompt_collisions"]
        attempts = opts["collision_attempts"]
        note = opts["collision_note"]

        if not do_apply:
            preview_limit = 50 if not ids else (opts["limit"] or 50)
            qs = select_entries(
                limit=preview_limit, ids=ids or None, random_sample=(not ids)
            )
            entries = list(qs)
            self.stdout.write(
                self.style.NOTICE(f"Preview: {len(entries)} entries → {provider}")
            )
            result = run_llm_batch(provider, entries)
            if not result.suggestions:
                self.stdout.write(self.style.WARNING("No suggestions."))
            for s in result.suggestions:
                self._print_suggestion(s)
        else:
            # Apply over whole corpus unless ids provided
            apply_limit = None if not ids else opts["limit"]
            qs = select_entries(limit=apply_limit, ids=ids or None, random_sample=False)
            entries = list(qs)
            self.stdout.write(
                self.style.WARNING(
                    f"APPLY mode: {len(entries)} entries, provider={provider}"
                )
            )

            # Preload existing en_texts for fast collision checks
            existing_texts: Set[str] = set(
                Entry.objects.values_list("en_text", flat=True)
            )

            total_applied = 0
            all_collided: List[int] = []

            for i in range(0, len(entries), batch_size):
                chunk = entries[i : i + batch_size]
                result = run_llm_batch(provider, chunk)
                if not result.suggestions:
                    self.stdout.write(f"Batch {i//batch_size+1}: no suggestions")
                    continue

                applied, collided = apply_with_collision_resolution(
                    result.suggestions,
                    provider=provider,
                    existing_texts=existing_texts,
                    reprompt=reprompt,
                    attempts=attempts,
                    note=note,
                )
                total_applied += applied
                all_collided.extend(collided)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Batch {i//batch_size+1}: applied {applied}, collisions {len(collided)}"
                    )
                )

            self.stdout.write(self.style.SUCCESS(f"TOTAL applied: {total_applied}"))
            if all_collided:
                ids_str = ",".join(str(x) for x in sorted(set(all_collided)))
                self.stdout.write(
                    self.style.WARNING(f"Collisions skipped (IDs): {ids_str}")
                )
                self.stdout.write(
                    self.style.NOTICE(
                        "Tip: re-run with --ids <list> --apply --reprompt-collisions [--collision-note 'be wild about X']"
                    )
                )
                # keep stdout-only; no files

    def _print_suggestion(self, s: EnSuggestion):
        old = s.original.strip().replace("\n", " ")
        new = s.suggestion.strip().replace("\n", " ")
        self.stdout.write(f"\n#{s.entry_id}  conf={s.confidence:.2f}")
        self.stdout.write(f"  OLD: {old}")
        self.stdout.write(f"  NEW: {new}")
        self.stdout.write(f"  WHY: {s.rationale}")
