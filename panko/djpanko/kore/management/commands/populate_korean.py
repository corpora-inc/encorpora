# kore/management/commands/populate_korean_full.py
import logging
from django.core.management.base import BaseCommand
from django.db import transaction

from kore.agents import (
    run_jamo_pipeline,
    run_syllable_pipeline,
    run_vocab_pipeline,
    run_sentence_pipeline,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Comprehensively populate the Korean DB: jamo, syllables, "
        "vocabulary, and example sentences."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--vocab-batches",
            type=int,
            default=50,
            help="Number of 1k-word batches to fetch (default: 50 for ~50k words)",
        )
        parser.add_argument(
            "--sentence-levels",
            nargs="+",
            default=["A1", "A2", "B1", "B2", "C1"],
            help="CEFR levels to generate sentences for (default: A1 A2 B1 B2 C1)",
        )

    def handle(self, *args, **options):
        batches = options["vocab_batches"]
        levels = options["sentence_levels"]

        self.stdout.write(
            self.style.MIGRATE_HEADING("Starting full Korean DB population...")
        )
        try:
            with transaction.atomic():
                # 1. Jamo
                self.stdout.write("▶ Loading Jamo entries...")
                run_jamo_pipeline()
                self.stdout.write(self.style.SUCCESS("✔ Jamo loaded."))

                # 2. Hangul syllables
                self.stdout.write("▶ Loading Hangul syllables...")
                run_syllable_pipeline()
                self.stdout.write(self.style.SUCCESS("✔ Syllables loaded."))

                # 3. Vocabulary batches
                for batch in range(batches):
                    self.stdout.write(f"▶ Loading vocab batch {batch+1}/{batches}...")
                    run_vocab_pipeline(batch)
                    self.stdout.write(
                        self.style.SUCCESS(f"✔ Vocab batch {batch+1} loaded.")
                    )

                # 4. Sentences per level
                for level in levels:
                    self.stdout.write(f"▶ Loading sentences for level {level}...")
                    run_sentence_pipeline(level)
                    self.stdout.write(
                        self.style.SUCCESS(f"✔ Sentences for {level} loaded.")
                    )

        except Exception as e:
            logger.exception("Error during Korean DB population")
            self.stdout.write(self.style.ERROR(f"✖ Error: {e}"))
            return

        self.stdout.write(self.style.SUCCESS("✅ Full Korean DB population complete!"))
