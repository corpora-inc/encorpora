# cor/management/commands/fill_pinyin.py
from __future__ import annotations

import random
import re
import time
from typing import List, Tuple

from django.core.management.base import BaseCommand
from django.db.models import Q

from pypinyin import lazy_pinyin, Style

from cor.models import Language, Translation


# ---------- helpers ----------

_PUNCT_FIX = re.compile(r"\s+([。，、！？；：“”‘’…,.!?;:])")


def _normalize_spaces(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = _PUNCT_FIX.sub(r"\1", s)
    return s


def to_pinyin(text: str, *, style: Style) -> str:
    # pypinyin is deterministic for both Simplified & Traditional.
    # errors="default" leaves non-CJK untouched (numbers, latin, punctuation).
    toks = lazy_pinyin(text, style=style, strict=True, errors="default")
    return _normalize_spaces(" ".join(toks))


# ---------- command ----------


class Command(BaseCommand):
    help = (
        "Fill/refresh Translation.romanization for zh-Hans and/or zh-Hant using pypinyin. "
        "Deterministic, no external services."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--lang",
            choices=["zh-Hans", "zh-Hant", "both"],
            default="both",
            help="Which language(s) to process.",
        )
        parser.add_argument(
            "--style",
            choices=["tone", "tone3"],
            default="tone",
            help="Pinyin style: diacritics (tone) or numeric (tone3).",
        )
        parser.add_argument(
            "--missing-only",
            action="store_true",
            help="Only fill rows where romanization is NULL/empty. Omit to refresh all.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max rows per language after filtering. 0 = no limit.",
        )
        parser.add_argument(
            "--random",
            action="store_true",
            help="Randomize processing order (useful with --limit).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Compute and show a sample of changes without saving.",
        )
        parser.add_argument(
            "--sample",
            type=int,
            default=10,
            help="In --dry-run, show up to this many example updates per language.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Bulk update batch size when writing.",
        )

    def handle(self, *args, **opts):
        langs = ["zh-Hans", "zh-Hant"] if opts["lang"] == "both" else [opts["lang"]]
        style = Style.TONE if opts["style"] == "tone" else Style.TONE3
        missing_only = bool(opts["missing_only"])
        limit = int(opts["limit"])
        randomize = bool(opts["random"])
        dry = bool(opts["dry_run"])
        sample_n = int(opts["sample"])
        batch_size = int(opts["batch_size"])

        self.stdout.write(
            f"Scope: langs={langs}, style={opts['style']}, "
            f"{'missing-only' if missing_only else 'refresh-all'}"
            + (f", limit={limit}" if limit else "")
            + (", random" if randomize else "")
            + (", DRY RUN" if dry else "")
        )

        t_start = time.time()
        total_updates = 0

        for code in langs:
            lang = Language.objects.get(code=code)

            qs = Translation.objects.filter(language=lang)
            if missing_only:
                qs = qs.filter(Q(romanization__isnull=True) | Q(romanization__exact=""))

            count = qs.count()
            if count == 0:
                self.stdout.write(f"'{code}': nothing to process.")
                continue

            qs = qs.order_by("?") if randomize else qs.order_by("id")
            if limit:
                qs = qs[:limit]

            n = qs.count()
            self.stdout.write(f"'{code}': processing {n} row(s)…")
            t0 = time.time()

            # Compute changes
            changes: List[Tuple[Translation, str]] = []
            for t in qs.iterator(chunk_size=1000):
                old = (t.romanization or "").strip()
                new = to_pinyin(t.text, style=style)
                if new != old:
                    changes.append((t, new))

            compute_time = time.time() - t0

            if dry:
                self.stdout.write(
                    f"  Would update {len(changes)} / {n} rows (computed in {compute_time:.2f}s)."
                )
                if changes:
                    self.stdout.write("  Sample:")
                    for t, new in random.sample(changes, min(sample_n, len(changes))):
                        old = (t.romanization or "").strip()
                        self.stdout.write(
                            f"    #{t.id}\n"
                            f"      TEXT: {t.text}\n"
                            f"      OLD : {old}\n"
                            f"      NEW : {new}"
                        )
                continue

            # Write updates in bulk
            updated = 0
            if changes:
                # Assign first
                for t, new in changes:
                    t.romanization = new
                # Bulk update
                # from math import ceil
                # chunks = ceil(len(changes) / batch_size)
                for i in range(0, len(changes), batch_size):
                    Translation.objects.bulk_update(
                        [t for (t, _new) in changes[i : i + batch_size]],
                        ["romanization"],
                        batch_size=batch_size,
                    )
                updated = len(changes)

            total_updates += updated
            t1 = time.time() - t0
            self.stdout.write(
                f"  Updated {updated} / {n} rows in {t1:.2f}s"
                + (f" ({updated / t1:.1f}/s)." if updated and t1 > 0 else ".")
            )

        total_time = time.time() - t_start
        if dry:
            self.stdout.write(f"✅ DRY RUN complete in {total_time:.2f}s.")
        else:
            self.stdout.write(
                f"✅ Done: updated {total_updates} rows total in {total_time:.2f}s."
            )
