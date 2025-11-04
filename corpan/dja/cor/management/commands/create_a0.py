# cor/management/commands/create_a0.py
from __future__ import annotations

from typing import Dict, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cor.models import Domain, Entry
from cor.utils.a0 import PHRASES  # list[tuple[str, list[str]]]


class Command(BaseCommand):
    help = "Seed/overwrite A0 Entries from cor.utils.a0.PHRASES. No domain creation. No options."

    @transaction.atomic
    def handle(self, *args, **kwargs) -> None:
        # Validate PHRASES shape (quick, strict)
        for row in PHRASES:
            if not (
                isinstance(row, tuple)
                and len(row) == 2
                and isinstance(row[0], str)
                and isinstance(row[1], list)
            ):
                raise CommandError(f"Malformed PHRASES row: {row!r}")
            if not all(isinstance(code, str) for code in row[1]):
                raise CommandError(f"Non-string domain code in row: {row!r}")

        # Resolve domains required by PHRASES; do NOT create missing
        needed_codes = sorted({code for _, codes in PHRASES for code in codes})
        domains_by_code: Dict[str, Domain] = {
            d.code: d for d in Domain.objects.filter(code__in=needed_codes)
        }
        missing = [c for c in needed_codes if c not in domains_by_code]
        if missing:
            raise CommandError(
                "Missing Domain rows for codes: "
                + ", ".join(missing)
                + ". Create them first."
            )

        created_entries = 0
        updated_to_a0 = 0
        domains_set_ops = 0

        # Overwrite pass: ensure Entry exists with level=A0 and exact domain set
        for en_text, dom_codes in PHRASES:
            entry, created = Entry.objects.get_or_create(
                en_text=en_text,
                defaults={"level": "A0"},
            )
            if created:
                created_entries += 1
            elif entry.level != "A0":
                entry.level = "A0"
                entry.save(update_fields=["level"])
                updated_to_a0 += 1

            # Replace domains with exactly the declared set (dedup to be safe)
            target_domains: List[Domain] = [
                domains_by_code[c] for c in dict.fromkeys(dom_codes)
            ]
            entry.domains.set(target_domains)
            domains_set_ops += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"A0 seeding complete: entries created={created_entries}, "
                f"levels set-to-A0={updated_to_a0}, domain-sets replaced={domains_set_ops}"
            )
        )
