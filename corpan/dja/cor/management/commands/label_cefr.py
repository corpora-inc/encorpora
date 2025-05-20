import json
import time
from typing import List
from enum import Enum

from django.core.management.base import BaseCommand

from pydantic import BaseModel

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider

from cor.models import Entry

llm = load_llm_provider(
    "local",
    # too small to understand CEFR?
    # completion_model="qwen2.5-0.5b-instruct-mlx",
    # completion_model="deepseek-r1-distill-qwen-7b",
    completion_model="llama-3.2-3b-instruct",
)


SYSTEM_MESSAGE = ChatCompletionTextMessage(
    role="system",
    text=(
        "You are a CEFR (Common European Framework of Reference for Languages) classification expert. "
        "Your task is to classify a single English sentence, phrase, or word into one of the following levels: "
        "A1, A2, B1, B2, C1, or C2. Return only the level as a string.\n\n"
        "Understand the complexity of the grammary and vocabulary used in the input and pick the most appropriate level.\n\n"
        "## CEFR LEVEL DEFINITIONS AND EXAMPLES\n\n"
        "• **A1 (Beginner)**: Extremely simple. One or two high-frequency words or a short, concrete sentence. "
        "Only present tense. No connectors, no abstract ideas, no subordination. "
        "Suitable for a complete beginner. Common for:\n"
        "  - single words: 'apple', 'goodbye'\n"
        "  - fragments: 'very hot', 'at school'\n"
        "  - minimal sentences: 'I have a dog.'\n\n"
        "• **A2 (Elementary)**: Slightly more structure. Simple past or future, short phrases with 'and' or 'but'. "
        "No modals, no relative clauses. Still simple and familiar vocabulary.\n"
        "Examples:\n"
        "  - 'I went to the store yesterday.'\n"
        "  - 'We play soccer on weekends.'\n"
        "  - 'She is tired but happy.'\n\n"
        "• **B1 (Intermediate)**: Includes modals (can, should), conditionals (if), or relative clauses (who, that). "
        "Vocabulary may be slightly abstract. Sentence is grammatically complete and expresses a full idea.\n"
        "Examples:\n"
        "  - 'He can help us move the boxes.'\n"
        "  - 'If I have time, I'll call you.'\n"
        "  - 'The man who fixed it was kind.'\n\n"
        "• **B2 (Upper-Intermediate)**: More complex. Passive voice, embedded clauses, contrastive structures (e.g., 'although', 'however'). "
        "Clear discourse structure and control over tense/aspect.\n"
        "Examples:\n"
        "  - 'Although she was tired, she kept working.'\n"
        "  - 'The documents were submitted last week.'\n"
        "  - 'He explained the plan in great detail.'\n\n"
        "• **C1 (Advanced)**: Precise vocabulary, idioms, inversion, embedded structures, or abstract reasoning. "
        "Tone may be formal or academic. The grammar shows fine control.\n"
        "Examples:\n"
        "  - 'Had I known, I would have declined the offer.'\n"
        "  - 'His comment was subtly ironic.'\n"
        "  - 'They achieved consensus after considerable negotiation.'\n\n"
        "• **C2 (Proficient)**: Fully native or near-native level. Elegant phrasing, metaphor, rhetoric, complex argument. "
        "May involve shifting register, humor, or layered nuance.\n"
        "Examples:\n"
        "  - 'The silence spoke volumes about their shared history.'\n"
        "  - 'Despite the façade of calm, tension simmered beneath.'\n"
        "  - 'Freedom, that elusive dream, danced always just ahead.'\n\n"
        "Use the JSON tool to respond with the EntryCEFRResult object."
    ),
)


class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class EntryCEFRResult(BaseModel):
    cefr_level: CEFRLevel


class Command(BaseCommand):
    help = "Test CEFR level classification via local LLM with function calling"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=1,
            help="Number of entries to classify (default: 1)",
        )
        parser.add_argument(
            "--random",
            action="store_true",
            help="Pick entries at random",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        # use_random = options["random"]

        entries = Entry.objects.all().order_by("?")[:limit]

        prompt_messages = [SYSTEM_MESSAGE]

        start_time = time.time()
        results: List[dict] = []

        i = 0
        for entry in entries:
            i += 1
            self.stdout.write(f"{entry.en_text}")
            self.stdout.write(f"Previously {entry.level}")
            messages = prompt_messages + [
                ChatCompletionTextMessage(
                    role="user",
                    text=(
                        "Use the JSON tool, to respond with only the `cefr_level`"
                        f"for the sentence:\n\n```{entry.en_text}```\n\n"
                    ),
                )
            ]

            try:
                cefr = llm.get_data_completion(messages, EntryCEFRResult)
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error on entry {entry.id}: {e}"))
                continue

            result = {
                "id": entry.id,
                "text": entry.en_text,
                "cefr_level": cefr.cefr_level,
            }
            results.append(result)

            self.stdout.write(
                self.style.SUCCESS(f"[{i}/{limit}] ID {entry.id} → {cefr.cefr_level}")
            )

        duration = time.time() - start_time
        self.stdout.write(
            self.style.NOTICE(f"\nProcessed {len(results)} entries in {duration:.2f}s")
        )
        self.stdout.write(json.dumps(results, indent=2, ensure_ascii=False))
