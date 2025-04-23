import csv
import os
from django.core.management.base import BaseCommand
from kore.models import Word


class Command(BaseCommand):
    help = (
        "Seed Word table from adult_frequency_counts_final.csv, "
        "populating text_korean, raw_pos_tag, frequency_rank, "
        "frequency_count, count_adjust and log_frequency."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=os.path.join("data", "adult_frequency_counts_final.csv"),
            help="Path to the frequency CSV file.",
        )

    def handle(self, *args, **opts):
        csv_path = opts["path"]
        if not os.path.exists(csv_path):
            return self.stderr.write(f"File not found: {csv_path}")

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for idx, row in enumerate(reader, start=1):
                word = row.get("WORD")
                if not word:
                    self.stderr.write("No word found in row, skipping...")
                    continue

                # Parse CSV columns
                raw_pos = row.get("POS_TAG", "")
                count = int(row.get("COUNT", 0))
                count_adj = float(row.get("COUNT_ADJUST", 0.0))
                log_freq = float(row.get("LOG10", count_adj or count))

                word, created = Word.objects.update_or_create(
                    text_korean=word,
                    defaults={
                        "raw_pos_tag": raw_pos,
                        "frequency_rank": idx,
                        "frequency_count": count,
                        "count_adjust": count_adj,
                        "log_frequency": log_freq,
                    },
                )
                # if created:
                #     self.stdout.write(
                #         self.style.SUCCESS(f"✔ Created word: {word.text_korean}")
                #     )
                # else:
                #     self.stdout.write(
                #         self.style.WARNING(f"⚠️  Updated word: {word.text_korean}")
                #     )

                if idx % 100 == 0:
                    self.stdout.write(self.style.SUCCESS(f"✔ Processed {idx} words..."))

        total = Word.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"✔ Seeded {total} words from {os.path.basename(csv_path)}"
            )
        )
