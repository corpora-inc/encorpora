# cor/management/commands/romanize_te.py
"""
Telugu ISO 15919 romanization at production quality.

Telugu script is a Brahmic script used for Telugu language,
with a complete set of vowels and consonants including aspirated forms.
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


SRC_SCRIPT = "Telugu"
TARGET_SCHEME = "ISO"


def _nfc(s: str) -> str:
    """Normalize to NFC (canonical composition)."""
    return unicodedata.normalize("NFC", s or "")


def te_to_iso15919(text_te: str) -> str:
    """
    Deterministic Telugu → ISO 15919 via Aksharamukha.

    Telugu script features:
    - Full set of vowels including short and long forms
    - Complete consonant inventory including aspirated consonants
    - Extensive conjunct forms
    - Retroflex series: ṭ, ḍ, ṇ, ṟ
    - Aspirated consonants: kh, gh, ch, jh, ṭh, ḍh, th, dh, ph, bh

    ISO 15919 provides unambiguous representation of all Telugu characters.
    """
    # NFC normalize source
    src = _nfc(text_te)

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
        "Fill/refresh Translation.romanization for Telugu (te) using "
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
            lang = Language.objects.get(code="te")
        except Language.DoesNotExist:
            raise CommandError("Language(code='te') not found.")

        qs = Translation.objects.filter(language=lang).order_by("?")

        if limit > 0:
            qs = qs[:limit]

        n = qs.count()
        if n == 0:
            self.stdout.write("te: nothing to process.")
            return

        self.stdout.write(f"Processing {n} Telugu rows...")

        changes: List[Tuple[Translation, str]] = []
        processed = 0

        for t in qs.iterator(chunk_size=1000):
            processed += 1
            if processed % 1000 == 0:
                self.stdout.write(f"  Processed {processed}/{n}...")

            old = _nfc((t.romanization or "").strip())
            new = te_to_iso15919(t.text)

            if new != old:
                changes.append((t, new))

        if dry:
            self.stdout.write(f"Would update {len(changes)} / {n} rows.")
            if changes:
                self.stdout.write("\nSample romanizations:")
                self.stdout.write("-" * 60)
                for t, new in random.sample(changes, min(sample_n, len(changes))):
                    old_display = t.romanization or "(empty)"
                    self.stdout.write(f"Telugu: {t.text}")
                    self.stdout.write(f"Old:    {old_display}")
                    self.stdout.write(f"New:    {new}")
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
            self.style.SUCCESS(f"✅ Done: updated {total} Telugu romanizations.")
        )
