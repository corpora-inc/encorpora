# kore/management/commands/augment_sentences.py
import json
from typing import Literal

from django.core.management.base import BaseCommand
from django.db import transaction

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage
from pydantic import BaseModel
from typing import List

from kore.models import Word, Sentence


class SentenceEntry(BaseModel):
    text_korean: str
    text_english: str
    word_list: List[str]
    cefr_level: Literal["A1", "A2", "B1", "B2", "C1", "C2"]


class SentenceResponse(BaseModel):
    entries: List[SentenceEntry]


class Command(BaseCommand):
    help = "Generate example sentences for random stems in batches."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=5,
            help="Number of stems to sample per batch.",
        )
        parser.add_argument(
            "--sents-per-stem",
            type=int,
            default=7,
            help="Number of sentences to generate per stem.",
        )
        parser.add_argument(
            "--iterations",
            type=int,
            default=500,
            help="How many batches to run.",
        )

    def handle(self, *args, **options):
        llm = load_llm_provider("xai")
        batch_size = options["batch_size"]
        sents_per = options["sents_per_stem"]
        iterations = options["iterations"]

        total_generated = 0

        for batch_num in range(1, iterations + 1):
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Generating sentences for batch {batch_num}/{iterations}..."
                )
            )
            stems = list(
                Word.objects.filter(
                    log_frequency__gt=2.5,  # Top 10,000
                )
                .order_by("?")
                .values_list("text_korean", flat=True)[:batch_size]
            )
            if not stems:
                self.stdout.write(self.style.WARNING("No stems available."))
                break

            payload = {"stems": stems, "sents_per_stem": sents_per}
            messages = [
                ChatCompletionTextMessage(
                    role="system",
                    text=(
                        "You are a Korean teacher. "
                        "Given a JSON object with keys 'stems' and 'sents_per_stem', "
                        "return a JSON matching schema SentenceResponse. "
                        "Produce sentences of various levels A1-C2, mostly A1-A2. "
                        "Make many extremely simple sentences for A1. As simple as you can imagine. "
                        "For A1 level, also include words and phrases that are not complete sentences. "
                        "Return the cefr_level in the response using the JSON tool. "
                        "For each stem, produce 'sents_per_stem' unique Korean sentences "
                        "that include the stem, each with a fluent English translation "
                        "and list of which stems are used."
                    ),
                ),
                ChatCompletionTextMessage(
                    role="user",
                    text=json.dumps(payload, ensure_ascii=False),
                ),
            ]

            response: SentenceResponse = llm.get_data_completion(
                messages, SentenceResponse
            )

            self.stdout.write(
                f"\n\n\nstems:{stems}\n\nresponse: {response.model_dump_json()}\n\n\n"
            )

            total_generated += len(response.entries)

            with transaction.atomic():
                for entry in response.entries:
                    sentence_obj, _ = Sentence.objects.get_or_create(
                        text_korean=entry.text_korean,
                        defaults={
                            "text_english": entry.text_english,
                            "cefr_level": entry.cefr_level,
                        },
                    )
                    for stem in entry.word_list:
                        try:
                            word_obj = Word.objects.get(text_korean=stem)
                        except Word.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Word '{stem}' not found in the database."
                                )
                            )
                            continue
                        sentence_obj.words.add(word_obj)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Batch {batch_num}/{iterations}: generated "
                    f"{total_generated} sentences."
                )
            )

        self.stdout.write(self.style.SUCCESS("✅ Sentence augmentation complete!"))
