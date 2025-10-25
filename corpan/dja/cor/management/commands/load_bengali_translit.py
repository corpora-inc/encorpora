# cor/management/commands/load_bengali_translit.py
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


SRC_SCRIPT = "Bengali"
TARGET_SCHEME = "ISO"

# Private-Use placeholders (won't collide with real text)
_SW_TAG = "\uf000"  # স্ব  → sw
_JV_TAG = "\uf001"  # জ্ব  → jv
_JJV_TAG = "\uf002"  # জ্জ্ব → jjv


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s or "")


def bn_to_iso15919(text_bn: str) -> str:
    """
    Deterministic Bengali → ISO 15919 via Aksharamukha, with two surgical
    conjunct fixes to match modern Bangla/Google-like expectations:

      • স্ব  → sw  (not sb)
      • জ্ব/জ্জ্ব → jv/jjv (not jb/jjb)

    We tag those conjuncts before transliteration, then enforce the
    intended roman output after transliteration. No other post-editing.
    """
    # NFC normalize source
    src = _nfc(text_bn)

    # Tag special conjuncts (longest first)
    src = src.replace("জ্জ্ব", _JJV_TAG)
    src = src.replace("জ্ব", _JV_TAG)
    src = src.replace("স্ব", _SW_TAG)

    # Run Aksharamukha in ISO 15919 with nativization
    out = akshara_tr.process(
        SRC_SCRIPT, TARGET_SCHEME, src, nativize=True, pre_options=[], post_options=[]
    )

    # Enforce our mappings via placeholder replacement
    out = out.replace(_JJV_TAG, "jjv").replace(_JV_TAG, "jv").replace(_SW_TAG, "sw")

    # Replace Aksharamukha’s clitic colon with apostrophe (e.g., āja:i → āja'i)
    out = out.replace(":", "'")

    # NFC normalize and trim
    return _nfc(out).strip()


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Bengali (bn) using "
        "Aksharamukha → ISO 15919. Deterministic; minimal targeted fixes "
        "for স্ব→sw and জ্ব/জ্জ্ব→jv/jjv."
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

    def handle(self, *args, **opts):
        dry = bool(opts["dry_run"])
        sample_n = int(opts["sample"])

        # Resolve Bengali language
        try:
            lang = Language.objects.get(code="bn")
        except Language.DoesNotExist:
            raise CommandError("Language(code='bn') not found.")

        # Random order (for more varied samples)
        qs = Translation.objects.filter(language=lang).order_by("?")
        n = qs.count()
        if n == 0:
            self.stdout.write("bn: nothing to process.")
            return

        self.stdout.write(f"Processing {n} Bengali rows...")

        changes: List[Tuple[Translation, str]] = []
        for t in qs.iterator(chunk_size=1000):
            old = _nfc((t.romanization or "").strip())
            new = bn_to_iso15919(t.text)
            if new != old:
                changes.append((t, new))

        if dry:
            self.stdout.write(f"Would update {len(changes)} / {n} rows.")
            if changes:
                self.stdout.write("Sample:")
                for t, new in random.sample(changes, min(sample_n, len(changes))):
                    self.stdout.write(f"{t.text} → {new}")
            self.stdout.write("✅ DRY RUN complete.")
            return

        if not changes:
            self.stdout.write("Nothing to update.")
            return

        # Assign and bulk update in chunks
        for t, new in changes:
            t.romanization = new

        CHUNK = 1000
        total = len(changes)
        for i in range(0, total, CHUNK):
            Translation.objects.bulk_update(
                [t for (t, _new) in changes[i : i + CHUNK]],
                ["romanization"],
                batch_size=CHUNK,
            )

        self.stdout.write(f"✅ Done: updated {total} rows.")
