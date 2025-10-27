# cor/management/commands/romanize_ja.py
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from cor.models import Language, Translation

# Deps:
#   pip install cutlet fugashi unidic-lite
#   # For higher accuracy:
#   # pip install "fugashi[unidic]" && python -m unidic download
import cutlet


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for Japanese (ja) using "
        "Cutlet (Fugashi+UniDic) for robust Hepburn romaji. "
        "Only option: --dry-run to print 20 random examples."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show 20 random examples without saving.",
        )

    # Fixed, opinionated romanizer
    def _build_romanizer(self):
        # - system: hepburn
        # - phonemic (foreign spellings off)
        # - を → o
        # - 私 → watashi; 私たち/私達 → watashitachi
        # - lowercase output
        # - normalize leftover full-width punctuation
        katsu = cutlet.Cutlet(system="hepburn", ensure_ascii=False)
        katsu.use_foreign_spelling = False

        # particle preference
        katsu.update_mapping("を", "o")

        # lexical overrides
        katsu.add_exception("私", "watashi")
        katsu.add_exception("私たち", "watashitachi")
        katsu.add_exception("私達", "watashitachi")

        def romanize(text: str) -> str:
            if not text:
                return ""
            out = katsu.romaji(text).lower()
            out = (
                out.replace("！", "!")
                .replace("？", "?")
                .replace("：", ":")
                .replace("；", ";")
                .replace("（", "(")
                .replace("）", ")")
                .replace("［", "[")
                .replace("］", "]")
                .replace("｛", "{")
                .replace("｝", "}")
                .replace("／", "/")
                .replace("－", "-")
            )
            return " ".join(out.split())

        return romanize

    def handle(self, *args, **options):
        dry = bool(options["dry_run"])

        lang = Language.objects.get(code="ja")
        qs = Translation.objects.filter(language=lang)
        total = qs.count()
        if total == 0:
            self.stdout.write("ja: nothing to process.")
            return

        self.stdout.write(
            f"Found {total} Japanese rows ({'DRY RUN' if dry else 'updating all'})."
        )

        romanize = self._build_romanizer()

        if dry:
            sample = qs.order_by("?")[:20]
            self.stdout.write("Sample (20):")
            for t in sample:
                src = t.text or ""
                try:
                    r = romanize(src)
                except Exception as e:
                    r = f"[error: {e.__class__.__name__}]"
                self.stdout.write(f"{src} → {r}")
            self.stdout.write("✅ DRY RUN complete.")
            return

        updated = 0
        with transaction.atomic():
            for t in qs.iterator(chunk_size=1000):
                src = t.text or ""
                new = romanize(src)
                if (t.romanization or "").strip() != new:
                    t.romanization = new
                    t.save(update_fields=["romanization"])
                    updated += 1

        self.stdout.write(f"✅ Done. Updated {updated} / {total} rows.")
