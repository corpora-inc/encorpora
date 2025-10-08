# cor/management/commands/sync_en_translations.py
from __future__ import annotations

import random
from typing import List, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import QuerySet

from cor.models import Entry, Language, Translation


def shorten(s: str, n: int = 160) -> str:
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


class Command(BaseCommand):
    help = "Copy Entry.en_text into the English Translation (create missing; update if changed)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview counts and show a random sample of pending changes without writing.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Bulk update/create batch size.",
        )
        parser.add_argument(
            "--ids",
            type=str,
            default="",
            help="Optional comma-separated Entry IDs to limit scope.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Optional cap on number of entries processed (after filtering/ids).",
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=12,
            help="Dry-run: number of examples to show for creates/updates (random).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help="Dry-run: RNG seed for reproducible sampling.",
        )

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        batch_size = opts["batch_size"]
        ids = [int(x) for x in opts["ids"].split(",") if x.strip().isdigit()]
        limit = opts["limit"]
        sample_n: int = opts["sample"]
        seed = opts["seed"]

        if dry and seed is not None:
            random.seed(seed)

        en_lang = Language.objects.get(code="en")

        # Scope
        qs: QuerySet[Entry] = Entry.objects.only("id", "en_text").order_by("id")
        if ids:
            qs = qs.filter(id__in=ids)
        if limit is not None:
            qs = qs[:limit]

        total_entries = qs.count()
        if total_entries == 0:
            self.stdout.write("Nothing to do.")
            return

        # Preload existing English translations
        existing = {
            t.entry_id: t
            for t in Translation.objects.filter(
                language=en_lang, entry_id__in=qs.values_list("id", flat=True)
            ).only("id", "entry_id", "text")
        }

        to_create: List[Translation] = []
        to_update: List[Translation] = []

        # For dry-run sampling with old/new visibility
        pending_creates: List[Tuple[int, str]] = []  # (entry_id, new_text)
        pending_updates: List[
            Tuple[int, str, str]
        ] = []  # (entry_id, old_text, new_text)

        for e in qs.iterator(chunk_size=5000):
            tr = existing.get(e.id)
            if tr is None:
                to_create.append(
                    Translation(entry_id=e.id, language=en_lang, text=e.en_text)
                )
                if dry:
                    pending_creates.append((e.id, e.en_text or ""))
            else:
                old_text = tr.text or ""
                new_text = e.en_text or ""
                if old_text != new_text:
                    # record old/new for preview before mutating
                    if dry:
                        pending_updates.append((e.id, old_text, new_text))
                    tr.text = new_text
                    to_update.append(tr)

        created_n = len(to_create)
        updated_n = len(to_update)
        unchanged_n = total_entries - created_n - updated_n

        self.stdout.write(
            self.style.NOTICE(
                f"Scope: {total_entries} entries  |  create: {created_n}  |  update: {updated_n}  |  unchanged: {unchanged_n}"
            )
        )

        if dry:
            # Random samples
            if pending_creates:
                k = min(sample_n, len(pending_creates))
                sample = (
                    random.sample(pending_creates, k)
                    if len(pending_creates) > k
                    else pending_creates
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\nCreates (random {len(sample)}/{len(pending_creates)}):"
                    )
                )
                for eid, new in sample:
                    self.stdout.write(f"+ #{eid}\n  NEW: {shorten(new)}")

            if pending_updates:
                k = min(sample_n, len(pending_updates))
                sample = (
                    random.sample(pending_updates, k)
                    if len(pending_updates) > k
                    else pending_updates
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\nUpdates (random {len(sample)}/{len(pending_updates)}):"
                    )
                )
                for eid, old, new in sample:
                    self.stdout.write(
                        f"~ #{eid}\n  OLD: {shorten(old)}\n  NEW: {shorten(new)}"
                    )

            self.stdout.write(self.style.WARNING("\nDry run: no changes written."))
            return

        # Apply writes
        with transaction.atomic():
            if to_create:
                Translation.objects.bulk_create(to_create, batch_size=batch_size)
            if to_update:
                Translation.objects.bulk_update(
                    to_update, ["text"], batch_size=batch_size
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_n}, updated {updated_n}, unchanged {unchanged_n}."
            )
        )
