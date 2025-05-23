import time
from enum import Enum
from typing import List

from django.core.management.base import BaseCommand

from pydantic import BaseModel
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider

from cor.models import Entry

# Load the local LLM
llm = load_llm_provider(
    "local",
    # completion_model="llama-3.2-3b-instruct",
    completion_model="qwen2.5-7b-instruct-mlx",
)


# CEFR level enum
class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


# Result model for a single sentence
class EntryCEFRLabeled(BaseModel):
    text: str
    level: CEFRLevel


class EntryCEFRLabeledList(BaseModel):
    labeled_entries: List[EntryCEFRLabeled]


SYSTEM_MESSAGE = ChatCompletionTextMessage(
    role="system",
    text=(
        "You are a CEFR (Common European Framework of Reference for Languages) classification expert. "
        "Your task is to classify a single English sentence, phrase, or word into one of the following levels: "
        "A1, A2, B1, B2, C1, or C2. Return only the level as a string.\n\n"
        "Understand the complexity of the grammary and vocabulary used in the input and pick the most appropriate level.\n\n"
        "## CEFR LEVEL DEFINITIONS AND EXAMPLES\n\n"
        "- **A1 (Beginner)**: Extremely simple. One or two high-frequency words or a short, concrete sentence. "
        "Only present tense. No connectors, no abstract ideas, no subordination. "
        "Suitable for a complete beginner. Common for:\n"
        "  - single words: 'apple', 'goodbye'\n"
        "  - fragments: 'very hot', 'at school'\n"
        "  - minimal sentences: 'I have a dog.'\n\n"
        "- **A2 (Elementary)**: Slightly more structure. Simple past or future, short phrases with 'and' or 'but'. "
        "No modals, no relative clauses. Still simple and familiar vocabulary.\n"
        "Examples:\n"
        "  - 'I went to the store yesterday.'\n"
        "  - 'We play soccer on weekends.'\n"
        "  - 'She is tired but happy.'\n\n"
        "- **B1 (Intermediate)**: Includes modals (can, should), conditionals (if), or relative clauses (who, that). "
        "Vocabulary may be slightly abstract. Sentence is grammatically complete and expresses a full idea.\n"
        "Examples:\n"
        "  - 'He can help us move the boxes.'\n"
        "  - 'If I have time, I'll call you.'\n"
        "  - 'The man who fixed it was kind.'\n\n"
        "- **B2 (Upper-Intermediate)**: More complex. Passive voice, embedded clauses, contrastive structures (e.g., 'although', 'however'). "
        "Clear discourse structure and control over tense/aspect.\n"
        "Examples:\n"
        "  - 'Although she was tired, she kept working.'\n"
        "  - 'The documents were submitted last week.'\n"
        "  - 'He explained the plan in great detail.'\n\n"
        "- **C1 (Advanced)**: Precise vocabulary, idioms, inversion, embedded structures, or abstract reasoning. "
        "Tone may be formal or academic. The grammar shows fine control.\n"
        "Examples:\n"
        "  - 'Had I known, I would have declined the offer.'\n"
        "  - 'His comment was subtly ironic.'\n"
        "  - 'They achieved consensus after considerable negotiation.'\n\n"
        "- **C2 (Proficient)**: Fully native or near-native level. Elegant phrasing, metaphor, rhetoric, complex argument. "
        "May involve shifting register, humor, or layered nuance.\n"
        "Examples:\n"
        "  - 'The silence spoke volumes about their shared history.'\n"
        "  - 'Despite the façade of calm, tension simmered beneath.'\n"
        "  - 'Freedom, that elusive dream, danced always just ahead.'\n\n"
        # "You always use the JSON tool to respond with the EntryCEFRLabeled object with the `level` field."
        # "You always return a `level` as one of the following values: A1, A2, B1, B2, C1, C2."
        "You always use the JSON tool to respond with the EntryCEFRLabeledList "
        "object with the `labeled_entries` field. "
        "Each object in the `labeled_entries` list should have the `level` and `text` fields.\n\n"
    ),
)


class Command(BaseCommand):
    help = "Label CEFR levels in batches using local LLM"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limit the number of entries to process (default: 0 for all)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=10,
            help="Number of entries per batch (default: 10)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Don't write results to DB",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]

        entries = list(Entry.objects.all().order_by("?")[: limit or None])
        total = len(entries)
        processed = 0
        start_time = time.time()

        for i in range(0, total, batch_size):
            batch = entries[i : i + batch_size]
            text_list = [entry.en_text for entry in batch]

            user_message = ChatCompletionTextMessage(
                role="user",
                text=(
                    "Use the JSON tool to respond with the EntryCEFRLabeledList object. "
                    "Each entry in `labeled_entries` must contain a `text` and `level` field.\n\n"
                    f"```\n{text_list}\n```\n"
                ),
            )

            try:
                result = llm.get_data_completion(
                    [SYSTEM_MESSAGE, user_message],
                    EntryCEFRLabeledList,
                )
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(
                        f"[{processed}/{total}] Batch {i // batch_size + 1} failed: {e}"
                    )
                )
                continue

            label_map = {
                item.text.strip(): item.level for item in result.labeled_entries
            }
            to_update = []

            for entry in batch:
                predicted = label_map.get(entry.en_text.strip())
                if predicted:
                    processed += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[{processed}/{total}] {entry.id}: {entry.en_text} → {predicted} (was {entry.level})"
                        )
                    )
                    entry.level = predicted
                    to_update.append(entry)
                else:
                    self.stderr.write(
                        self.style.WARNING(
                            f"[{processed}/{total}] {entry.id}: No CEFR level returned ({entry.en_text})"
                        )
                    )

            if not dry_run and to_update:
                Entry.objects.bulk_update(to_update, fields=["level"])
                self.stdout.write(
                    self.style.NOTICE(
                        f"Batch {i // batch_size + 1}: {len(to_update)} updated"
                    )
                )

        duration = time.time() - start_time
        self.stdout.write(
            self.style.NOTICE(
                f"\nFinished: {processed}/{total} entries in {duration:.2f}s"
            )
        )
