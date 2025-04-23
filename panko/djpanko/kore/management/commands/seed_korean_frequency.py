# kore/management/commands/seed_frequency_counts.py
import csv
import os
from django.core.management.base import BaseCommand
from kore.models import Word


class Command(BaseCommand):
    help = (
        "Seed the Word table from a frequency CSV (adult_frequency_counts_final.csv). "
        "This will set `text_korean` and `frequency_rank` for each headword."
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
            self.stdout.write(self.style.ERROR(f"File not found: {csv_path}"))
            return

        with open(csv_path, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for idx, row in enumerate(reader, start=1):
                word = row.get("WORD") or row.get("word")
                if not word:
                    continue
                # Use CSV ordering as frequency_rank
                Word.objects.update_or_create(
                    text_korean=word,
                    defaults={
                        "frequency_rank": idx,
                    },
                )
        self.stdout.write(
            self.style.SUCCESS(
                f"✔ Seeded {Word.objects.count()} words from {os.path.basename(csv_path)}."
            )
        )
