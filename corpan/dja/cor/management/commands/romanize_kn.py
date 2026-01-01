# cor/management/commands/romanize_kn.py
"""
Kannada ISO 15919 romanization at production quality.

Kannada script is a Brahmic script with rounded characters,
used for Kannada and Tulu languages.
"""

from __future__ import annotations

import random
import unicodedata
from typing import List, Tuple

from django.core.management.base import BaseCommand, CommandError

from cor.models import Language, Translation

try:
    from aksharamukha import transliterate as akshara_tr  # type: ignore
except Exception as e:
    raise CommandError(
        "aksharamukha is not installed or failed to import. "
        "Install with: pip install aksharamukha"
    ) from e


SRC_SCRIPT = "Kannada"
TARGET_SCHEME = "ISO"


def _nfc(s: str) -> str:
    """Normalize to NFC (canonical composition)."""
    return unicodedata.normalize("NFC", s or "")


def kn_to_iso15919(text_kn: str) -> str:
    """
    Deterministic Kannada → ISO 15919 via Aksharamukha.

    Kannada script features:
    - Complete vowel inventory (short and long)
    - Full consonant set with aspirated forms
    - Distinctive retroflex consonants: ṭ, ḍ, ṇ
    - Aspirated consonants: kh, gh, ch, jh, ṭh, ḍh, th, dh, ph, bh
    - Rich conjunct forms

    ISO 15919 provides standard romanization for all Kannada characters.
    """
    # NFC normalize source
    src = _nfc(text_kn)

    # Run Aksharamukha ISO 15919 transliteration
    out = akshara_tr.process(
        SRC_SCRIPT, TARGET_SCHEME, src, nativize=True, pre_options=[], post_options=[]
    )

    # Replace Aksharamukha's clitic colon with apostrophe
    out = out.replace(":", "'")

    # NFC normalize and trim
    return _nfc(out).strip()


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Kannada (kn) using "
        "Aksharamukha → ISO 15919."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Compute and show a sample of changes without saving.",
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=20,
            help="In --dry-run, show up to this many example updates.",
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
            lang = Language.objects.get(code="kn")
        except Language.DoesNotExist:
            raise CommandError("Language(code='kn') not found.")

        qs = Translation.objects.filter(language=lang).order_by("?")

        if limit > 0:
            qs = qs[:limit]

        n = qs.count()
        if n == 0:
            self.stdout.write("kn: nothing to process.")
            return

        self.stdout.write(f"Processing {n} Kannada rows...")

        changes: List[Tuple[Translation, str]] = []
        processed = 0

        for t in qs.iterator(chunk_size=1000):
            processed += 1
            if processed % 1000 == 0:
                self.stdout.write(f"  Processed {processed}/{n}...")

            old = _nfc((t.romanization or "").strip())
            new = kn_to_iso15919(t.text)

            if new != old:
                changes.append((t, new))

        if dry:
            self.stdout.write(f"Would update {len(changes)} / {n} rows.")
            if changes:
                self.stdout.write("\nSample romanizations:")
                self.stdout.write("-" * 60)
                for t, new in random.sample(changes, min(sample_n, len(changes))):
                    old_display = t.romanization or "(empty)"
                    self.stdout.write(f"Kannada: {t.text}")
                    self.stdout.write(f"Old:     {old_display}")
                    self.stdout.write(f"New:     {new}")
                    self.stdout.write("-" * 60)
            self.stdout.write("✅ DRY RUN complete.")
            return

        if not changes:
            self.stdout.write("Nothing to update.")
            return

        for t, new in changes:
            t.romanization = new

        CHUNK = 1000
        total = len(changes)
        self.stdout.write(f"Saving {total} updates...")

        for i in range(0, total, CHUNK):
            chunk_end = min(i + CHUNK, total)
            Translation.objects.bulk_update(
                [t for (t, _new) in changes[i:chunk_end]],
                ["romanization"],
                batch_size=CHUNK,
            )
            self.stdout.write(f"  Saved {chunk_end}/{total}...")

        self.stdout.write(
            self.style.SUCCESS(f"✅ Done: updated {total} Kannada romanizations.")
        )
