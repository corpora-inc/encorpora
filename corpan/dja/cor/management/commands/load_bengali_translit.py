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


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s or "")


def bn_to_iso15919(text_bn: str) -> str:
    """Deterministic Bengali → ISO 15919 via Aksharamukha, with NFC."""
    text_bn = _nfc(text_bn)
    out = akshara_tr.process(SRC_SCRIPT, TARGET_SCHEME, text_bn)
    return _nfc(out.replace(":", "'"))


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Bengali (bn) using "
        "Aksharamukha → ISO 15919 Indic. Deterministic, no post-processing."
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

        # Random order as requested
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

        # Write updates
        if not changes:
            self.stdout.write("Nothing to update.")
            return

        # Assign and bulk update in chunks
        # from math import ceil

        for t, new in changes:
            t.romanization = new

        CHUNK = 1000
        total = len(changes)
        # chunks = ceil(total / CHUNK)
        for i in range(0, total, CHUNK):
            Translation.objects.bulk_update(
                [t for (t, _new) in changes[i : i + CHUNK]],
                ["romanization"],
                batch_size=CHUNK,
            )

        self.stdout.write(f"✅ Done: updated {total} rows.")
