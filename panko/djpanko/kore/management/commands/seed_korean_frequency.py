# https://raw.githubusercontent.com/jinseo0904/korean_frequency/refs/heads/main/final_word_frequency/adult_frequency_counts_final.csv
import csv
import math
import os

from django.core.management.base import BaseCommand
from kore.models import Word


class Command(BaseCommand):
    help = (
        "Seed & merge Word frequency data from a corpus CSV, handling "
        "duplicates, accumulating counts, and preserving best ranks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=os.path.join("data", "adult_frequency_counts_final.csv"),
            help="Path to the frequency CSV file.",
        )

    def handle(self, *args, **options):
        csv_path = options["path"]
        if not os.path.exists(csv_path):
            self.stderr.write(f"File not found: {csv_path}")
            return

        # Pre-count for progress reporting (exclude header)
        with open(csv_path, encoding="utf-8") as fp:
            total_rows = sum(1 for _ in fp) - 1
        processed = 0

        with open(csv_path, newline="", encoding="utf-8") as fp:
            reader = csv.DictReader(fp)
            for idx, row in enumerate(reader, start=1):
                text = row.get("WORD")
                if not text:
                    self.stderr.write("No WORD field in row, skipping...")
                    continue

                # Parse CSV columns
                raw_pos = row.get("POS_TAG", "").strip()
                count = int(row.get("COUNT", 0))
                count_adj = float(row.get("COUNT_ADJUST", 0.0))

                # Retrieve or create the Word
                word_obj, _ = Word.objects.get_or_create(text_korean=text)

                # 1. Merge POS tags
                existing_tags = (
                    set(word_obj.raw_pos_tag.split(","))
                    if word_obj.raw_pos_tag
                    else set()
                )
                if raw_pos:
                    existing_tags.add(raw_pos)
                word_obj.raw_pos_tag = ",".join(sorted(existing_tags))

                # 2. Accumulate counts
                word_obj.frequency_count = (word_obj.frequency_count or 0) + count
                word_obj.count_adjust = (word_obj.count_adjust or 0.0) + count_adj
                word_obj.log_frequency = math.log10(word_obj.count_adjust + 1)

                # 3. Preserve best (lowest) rank
                word_obj.frequency_rank = (
                    min(word_obj.frequency_rank, idx)
                    if word_obj.frequency_rank
                    else idx
                )

                word_obj.save()
                processed += 1

                # Progress feedback
                if processed % 1000 == 0:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Processed {processed}/{total_rows} rows..."
                        )
                    )

        total = Word.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"✔ Completed: seeded {total} words (processed {processed}/{total_rows})."
            )
        )
