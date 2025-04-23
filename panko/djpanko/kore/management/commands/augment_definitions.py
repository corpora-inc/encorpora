# kore/management/commands/augment_definitions.py
from typing import List

from django.core.management.base import BaseCommand
from django.db import transaction
from pydantic import BaseModel

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from kore.models import Word, Definition


class DefinitionEntry(BaseModel):
    text_korean: str
    definitions: List[str]


class DefinitionResponse(BaseModel):
    entries: List[DefinitionEntry]


class Command(BaseCommand):
    help = "Augment English definitions for all Korean headwords using XAI, in batches."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of words to process per XAI call.",
        )

    def handle(self, *args, **options):
        llm = load_llm_provider("xai")
        batch_size = options["batch_size"]

        # Select words missing definitions
        qs = Word.objects.all().exclude(definitions__language="en")
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No words to augment."))
            return

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"Starting definition augmentation ({total} words)..."
            )
        )

        processed = 0
        # Iterate in batches
        for start in range(0, total, batch_size):
            batch_words = list(qs[start : start + batch_size])
            word_list = [w.text_korean for w in batch_words]

            # Prepare XAI messages
            messages = [
                ChatCompletionTextMessage(
                    role="system",
                    text=(
                        "You are a Korean-English lexicographer. "
                        "Given this JSON list of Hangul words under 'words', "
                        "return a JSON matching schema `DefinitionResponse` with key 'entries'. "
                        "Each entry must include 'text_korean' and a list of English definitions. "
                        "Output only JSON."
                    ),
                ),
                ChatCompletionTextMessage(
                    role="user",
                    text=f'{{"words": {word_list}}}',
                ),
            ]

            resp: DefinitionResponse = llm.get_data_completion(
                messages, DefinitionResponse
            )

            self.stdout.write(
                f"\n\n\nwords:{word_list}\n\nresponse: {resp.model_dump_json()}\n\n\n"
            )

            # Persist into DB
            with transaction.atomic():
                for entry in resp.entries:
                    try:
                        w_obj = next(
                            w for w in batch_words if w.text_korean == entry.text_korean
                        )
                    except StopIteration:
                        continue

                    for def_text in entry.definitions:
                        Definition.objects.get_or_create(
                            word=w_obj, language="en", text=def_text
                        )

            processed += len(batch_words)
            self.stdout.write(
                self.style.SUCCESS(
                    f"✔ Augmented definitions for {processed}/{total} words"
                )
            )

        self.stdout.write(self.style.SUCCESS("✅ Definition augmentation complete!"))
