# cor/management/commands/convert_gurmukhi_to_shahmukhi.py
"""
Convert all Punjabi (Gurmukhi) translations to Punjabi (Shahmukhi).

This creates pa-Arab translations from pa-Guru translations by converting
the Gurmukhi script to Shahmukhi (Perso-Arabic) script using Aksharamukha.
The romanizations are copied over since they're phonetically identical.
"""

from __future__ import annotations

import unicodedata
from typing import List, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cor.models import Language, Translation, Entry

try:
    from aksharamukha import transliterate as akshara_tr  # type: ignore
except Exception as e:
    raise CommandError(
        "aksharamukha is not installed or failed to import. "
        "Install with: pip install aksharamukha"
    ) from e


def _nfc(s: str) -> str:
    """Normalize to NFC (canonical composition)."""
    return unicodedata.normalize("NFC", s or "")


def gurmukhi_to_shahmukhi(text_gurmukhi: str) -> str:
    """
    Convert Gurmukhi script to Shahmukhi (Perso-Arabic) script.

    Uses Aksharamukha for script conversion. Both represent the same
    Punjabi language phonetically.
    """
    # NFC normalize source
    src = _nfc(text_gurmukhi)

    # Convert Gurmukhi → Perso-Arabic (Shahmukhi)
    # Aksharamukha uses "Gurmukhi" and "Urdu" for these scripts
    out = akshara_tr.process(
        "Gurmukhi", "Urdu", src, nativize=True, pre_options=[], post_options=[]
    )

    # NFC normalize and trim
    return _nfc(out).strip()


class Command(BaseCommand):
    help = (
        "Convert all pa-Guru (Gurmukhi) translations to pa-Arab (Shahmukhi) "
        "by converting the script. Romanizations are copied over."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without saving.",
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=10,
            help="In --dry-run, show up to this many example conversions.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process only this many rows (0 = all).",
        )

    def handle(self, *args, **opts):
        dry = bool(opts["dry_run"])
        sample_n = int(opts["sample"])
        limit = int(opts["limit"])

        try:
            lang_guru = Language.objects.get(code="pa-Guru")
            lang_arab = Language.objects.get(code="pa-Arab")
        except Language.DoesNotExist as e:
            raise CommandError(f"Language not found: {e}")

        # Get all Gurmukhi translations
        qs_guru = Translation.objects.filter(language=lang_guru).select_related("entry")

        total_available = qs_guru.count()
        if total_available == 0:
            self.stdout.write("No pa-Guru translations to convert.")
            return

        # In dry-run mode, only process a sample
        if dry:
            process_count = min(sample_n, total_available)
            self.stdout.write(f"Processing {process_count} random samples (out of {total_available} total)...")
            # Get random sample
            qs_guru = qs_guru.order_by("?")[:process_count]
        else:
            if limit > 0:
                qs_guru = qs_guru[:limit]
                process_count = min(limit, total_available)
            else:
                process_count = total_available
            self.stdout.write(f"Processing {process_count} Gurmukhi translations...")

        # Process translations
        conversions: List[
            Tuple[Entry, str, str, str]
        ] = []  # (entry, guru_text, arab_text, romanization)

        for t_guru in qs_guru:
            # Convert script
            text_shahmukhi = gurmukhi_to_shahmukhi(t_guru.text)

            # Copy romanization (identical for both scripts)
            romanization = t_guru.romanization or ""

            conversions.append(
                (t_guru.entry, t_guru.text, text_shahmukhi, romanization)
            )

        if dry:
            self.stdout.write(f"\nShowing {len(conversions)} sample conversions:")
            self.stdout.write(f"(Would create {total_available} total Shahmukhi translations)\n")
            self.stdout.write("=" * 80)

            for entry, guru, arab, rom in conversions:
                self.stdout.write(f"Entry:      {entry.en_text}")
                self.stdout.write(f"Gurmukhi:   {guru}")
                self.stdout.write(f"Shahmukhi:  {arab}")
                self.stdout.write(f"Roman:      {rom}")
                self.stdout.write("-" * 80)
            self.stdout.write("✅ DRY RUN complete.")
            return

        # Create Shahmukhi translations
        self.stdout.write(f"\nCreating {len(conversions)} Shahmukhi translations...")

        with transaction.atomic():
            # Delete any existing pa-Arab translations to avoid conflicts
            existing_count = Translation.objects.filter(language=lang_arab).count()
            if existing_count > 0:
                self.stdout.write(
                    f"  Deleting {existing_count} existing pa-Arab translations..."
                )
                Translation.objects.filter(language=lang_arab).delete()

            # Bulk create new translations
            new_translations = [
                Translation(
                    entry=entry,
                    language=lang_arab,
                    text=arab_text,
                    romanization=romanization,
                )
                for entry, guru_text, arab_text, romanization in conversions
            ]

            CHUNK = 1000
            total = len(new_translations)
            for i in range(0, total, CHUNK):
                chunk_end = min(i + CHUNK, total)
                Translation.objects.bulk_create(new_translations[i:chunk_end])
                self.stdout.write(f"  Created {chunk_end}/{total}...")

        self.stdout.write(
            self.style.SUCCESS(
                f"✅ Done: created {len(conversions)} Shahmukhi translations from Gurmukhi."
            )
        )
