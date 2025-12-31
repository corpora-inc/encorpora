# cor/management/commands/romanize_ta.py
"""
Tamil ISO 15919 romanization at production quality.

Tamil is one of the most phonetically consistent Dravidian scripts,
making it ideal for deterministic romanization. This implementation uses
Aksharamukha's ISO 15919 mode with minimal post-processing for optimal results.
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


SRC_SCRIPT = "Tamil"
TARGET_SCHEME = "ISO"

# Tamil-specific placeholder tags for edge cases
# (Tamil script is very regular, so we need fewer fixes than Bengali)
_KSHA_TAG = "\uf000"  # க்ஷ → kṣa (borrowed Sanskrit)
_SHRI_TAG = "\uf001"  # ஶ்ரீ → śrī (borrowed Sanskrit)


def _nfc(s: str) -> str:
    """Normalize to NFC (canonical composition)."""
    return unicodedata.normalize("NFC", s or "")


def ta_to_iso15919(text_ta: str) -> str:
    """
    Deterministic Tamil → ISO 15919 via Aksharamukha.

    Tamil script is highly phonetic with clear vowel-consonant boundaries.
    Key features:
    - 12 vowels (5 short + 5 long + 2 diphthongs)
    - 18 consonants (no aspirated consonants unlike North Indian scripts)
    - Distinctive retroflex/alveolar series: ṭ/ṟ, ṇ/ṉ, ḷ/ḻ
    - Borrowed Sanskrit clusters: க்ஷ (kṣa), ஶ்ரீ (śrī)

    ISO 15919 representations:
    - Vowels: a, ā, i, ī, u, ū, e, ē, ai, o, ō, au
    - Stops: k, ṅ, c, ñ, ṭ, ṇ, t, n, p, m
    - Approximants/laterals: y, r, l, v, ḻ, ḷ
    - Alveolars: ṟ, ṉ
    - Borrowed: ś, ṣ, h, j
    """
    # NFC normalize source
    src = _nfc(text_ta)

    # Pre-tag rare Sanskrit borrowings (optional, for consistency)
    # Most Tamil text won't have these, but included for completeness
    src = src.replace("க்ஷ", _KSHA_TAG)  # kṣa
    src = src.replace("ஶ்ரீ", _SHRI_TAG)  # śrī

    # Run Aksharamukha ISO 15919 transliteration
    # Tamil is already very regular, so minimal post-processing needed
    out = akshara_tr.process(
        SRC_SCRIPT, TARGET_SCHEME, src, nativize=True, pre_options=[], post_options=[]
    )

    # Restore tagged borrowings if needed (Aksharamukha usually handles these correctly)
    out = out.replace(_KSHA_TAG, "kṣa").replace(_SHRI_TAG, "śrī")

    # Replace Aksharamukha's clitic colon with apostrophe for consistency
    # (e.g., periya:ir → periya'ir, though this is rare in Tamil)
    out = out.replace(":", "'")

    # NFC normalize and trim
    return _nfc(out).strip()


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Tamil (ta) using "
        "Aksharamukha → ISO 15919. Tamil's phonetic script makes this "
        "nearly perfect with minimal post-processing."
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

        # Resolve Tamil language
        try:
            lang = Language.objects.get(code="ta")
        except Language.DoesNotExist:
            raise CommandError("Language(code='ta') not found.")

        # Random order for more varied samples
        qs = Translation.objects.filter(language=lang).order_by("?")

        if limit > 0:
            qs = qs[:limit]

        n = qs.count()
        if n == 0:
            self.stdout.write("ta: nothing to process.")
            return

        self.stdout.write(f"Processing {n} Tamil rows...")

        changes: List[Tuple[Translation, str]] = []
        processed = 0

        for t in qs.iterator(chunk_size=1000):
            processed += 1
            if processed % 1000 == 0:
                self.stdout.write(f"  Processed {processed}/{n}...")

            old = _nfc((t.romanization or "").strip())
            new = ta_to_iso15919(t.text)

            if new != old:
                changes.append((t, new))

        if dry:
            self.stdout.write(f"Would update {len(changes)} / {n} rows.")
            if changes:
                self.stdout.write("\nSample romanizations:")
                self.stdout.write("-" * 60)
                for t, new in random.sample(changes, min(sample_n, len(changes))):
                    old_display = t.romanization or "(empty)"
                    self.stdout.write(f"Tamil: {t.text}")
                    self.stdout.write(f"Old:   {old_display}")
                    self.stdout.write(f"New:   {new}")
                    self.stdout.write("-" * 60)
            self.stdout.write("✅ DRY RUN complete.")
            return

        if not changes:
            self.stdout.write("Nothing to update.")
            return

        # Assign new romanizations
        for t, new in changes:
            t.romanization = new

        # Bulk update in chunks
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
            self.style.SUCCESS(f"✅ Done: updated {total} Tamil romanizations.")
        )
