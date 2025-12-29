# cor/management/commands/romanize_ur.py
"""
Urdu ISO 15919 romanization at production quality.

Urdu is written in a variant of the Perso-Arabic script (Nastaliq style)
with additional letters for retroflex and other sounds specific to Indo-Aryan languages.
"""

from __future__ import annotations

import random
import unicodedata
from typing import List, Tuple

from django.core.management.base import BaseCommand, CommandError

from cor.models import Language, Translation


def _nfc(s: str) -> str:
    """Normalize to NFC (canonical composition)."""
    return unicodedata.normalize("NFC", s or "")


# ISO 15919 romanization mapping for Urdu characters
URDU_TO_ISO = {
    # Vowels
    "ا": "ā",
    "آ": "ā",
    "ع": """,  # ain - glottal stop
    'ء': """,  # hamza
    "و": "o",  # can be u/ū/o depending on context
    "ی": "ī",
    "ے": "e",
    # Consonants
    "ب": "b",
    "پ": "p",
    "ت": "t",
    "ٹ": "ṭ",
    "ث": "s̱",  # se
    "ج": "j",
    "چ": "c",
    "ح": "ḥ",
    "خ": "x",
    "د": "d",
    "ڈ": "ḍ",
    "ذ": "z̤",  # zāl
    "ر": "r",
    "ڑ": "ṛ",
    "ز": "z",
    "ژ": "ž",
    "س": "s",
    "ش": "š",
    "ص": "ṣ",
    "ض": "ẓ",
    "ط": "ṯ",
    "ظ": "ẕ",
    "غ": "ġ",
    "ف": "f",
    "ق": "q",
    "ک": "k",
    "گ": "g",
    "ل": "l",
    "م": "m",
    "ن": "n",
    "ں": "ṅ",
    "ہ": "h",
    "ھ": "h",
    "ؤ": "o",
    "ئ": "y",
    # Diacritics
    "َ": "a",  # zabar (fatha)
    "ِ": "i",  # zer (kasra)
    "ُ": "u",  # pesh (damma)
    "ّ": "",  # shadda (gemination)
    "ٰ": "ā",  # alif khanjariyah
    "ً": "an",  # tanwin fath
    "ٍ": "in",  # tanwin kasr
    "ٌ": "un",  # tanwin zamm
    "ْ": "",  # sukun
    # Special
    "۔": ".",  # Urdu period
    "؍": "/",
    "،": ",",
    "؟": "?",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
}


def ur_to_iso15919(text_ur: str) -> str:
    """
    Deterministic Urdu → ISO 15919 romanization.

    Urdu script features (Perso-Arabic with Indo-Aryan extensions):
    - Written right-to-left (RTL)
    - Additional retroflex letters: ٹ (ṭ), ڈ (ḍ), ڑ (ṛ)
    - Aspirated consonants marked with ھ: بھ (bh), پھ (ph), تھ (th), etc.
    - Vowel diacritics (zabar, zer, pesh) often omitted in writing
    - Special consonants: ژ (ž), ڑ (ṛ), ں (ṅ), ے (e)

    Uses custom ISO 15919 character mapping with digraph handling.
    """
    # NFC normalize source
    src = _nfc(text_ur)

    # Handle aspirated consonants (digraphs) first
    # These must be processed before individual character mapping
    aspirates = {
        "بھ": "bh",
        "پھ": "ph",
        "تھ": "th",
        "ٹھ": "ṭh",
        "جھ": "jh",
        "چھ": "ch",
        "دھ": "dh",
        "ڈھ": "ḍh",
        "کھ": "kh",
        "گھ": "gh",
        "ڑھ": "ṛh",
    }

    # Replace aspirated consonants with placeholders
    for aspirate, roman in aspirates.items():
        src = src.replace(aspirate, f"◆{roman}◆")

    # Character-by-character transliteration
    result = []
    for char in src:
        if char == "◆":
            # Marker for already-processed aspirates
            continue
        elif char in URDU_TO_ISO:
            result.append(URDU_TO_ISO[char])
        elif char.isspace() or char.isascii():
            result.append(char)
        else:
            # Unknown character - keep as is
            result.append(char)

    out = "".join(result)

    # Restore aspirated consonants
    out = out.replace("◆", "")

    # NFC normalize and trim
    return _nfc(out).strip()


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Urdu (ur) using "
        "Aksharamukha → ISO 15919. Urdu uses Perso-Arabic script (RTL)."
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
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force update all rows, even if romanization appears unchanged.",
        )

    def handle(self, *args, **opts):
        dry = bool(opts["dry_run"])
        sample_n = int(opts["sample"])
        limit = int(opts["limit"])
        force = bool(opts["force"])

        try:
            lang = Language.objects.get(code="ur")
        except Language.DoesNotExist:
            raise CommandError("Language(code='ur') not found.")

        qs = Translation.objects.filter(language=lang).order_by("?")

        if limit > 0:
            qs = qs[:limit]

        n = qs.count()
        if n == 0:
            self.stdout.write("ur: nothing to process.")
            return

        self.stdout.write(f"Processing {n} Urdu rows...")

        changes: List[Tuple[Translation, str]] = []
        processed = 0

        for t in qs.iterator(chunk_size=1000):
            processed += 1
            if processed % 1000 == 0:
                self.stdout.write(f"  Processed {processed}/{n}...")

            old = _nfc((t.romanization or "").strip())
            new = ur_to_iso15919(t.text)

            if force or new != old:
                changes.append((t, new))

        if dry:
            self.stdout.write(f"Would update {len(changes)} / {n} rows.")
            if changes:
                self.stdout.write("\nSample romanizations:")
                self.stdout.write("-" * 60)
                for t, new in random.sample(changes, min(sample_n, len(changes))):
                    old_display = t.romanization or "(empty)"
                    self.stdout.write(f"Urdu:    {t.text}")
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
            self.style.SUCCESS(f"✅ Done: updated {total} Urdu romanizations.")
        )
