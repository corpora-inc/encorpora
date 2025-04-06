import os
import time
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Hexagram, Line
from openai import OpenAI

from iching.models import Phrase, Translation


# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic model for Translation response
class TranslationData(BaseModel):
    translation_es: str


# Define tool definition using Pydantic schema
translation_schema = TranslationData.model_json_schema()
tool_definition_translation = {
    "type": "function",
    "function": {
        "name": "store_translation",
        "description": "Return an accurate Spanish translation based on the provided Chinese and English texts.",
        "parameters": translation_schema,
    },
}


class Command(BaseCommand):
    help = "Populate missing Spanish ('es') fields in Hexagram and Line models and create Phrase/Translation entries"

    def translate_text(self, zh_text, en_text, context_description):
        """Helper to call xAI API for translation."""
        max_retries = 5
        context = f"Chinese Text:\n{zh_text}\n\nEnglish Text:\n{en_text or 'N/A'}"
        for attempt in range(max_retries):
            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": (
                            "You are an expert translator familiar with the I Ching. "
                            "Translate the given text into Spanish with precision and cultural sensitivity, "
                            "using the provided Chinese and English texts as the basis. "
                            "Ensure the translation preserves the symbolic depth and intent of the I Ching, "
                            f"adapting naturally to Spanish for {context_description}. "
                            "Use the store_translation tool to return a single, cohesive Spanish translation—no extra commentary. "
                            "Context: The Chinese and English texts follow.\n\n"
                            + context
                        ),
                    },
                    {
                        "role": "user",
                        "content": "Translate this text into Spanish using the store_translation tool.",
                    },
                ]
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    tools=[tool_definition_translation],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_translation"},
                    },
                    temperature=0.7,
                    max_tokens=1000,
                )
                message = response.choices[0].message
                if (
                    message.tool_calls
                    and message.tool_calls[0].function.name == "store_translation"
                ):
                    args_str = message.tool_calls[0].function.arguments
                    trans_data = TranslationData.model_validate_json(args_str)
                    es = trans_data.translation_es
                    self.stdout.write(f"Translated from {en_text} to {es}")
                    return es
                else:
                    self.stdout.write(
                        f"Attempt {attempt + 1}/{max_retries}: No valid tool call"
                    )
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    raise ValueError("No valid translation after retries")
            except (ValidationError, ValueError) as e:
                self.stdout.write(f"Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise
            except Exception as e:
                self.stdout.write(f"Unexpected error: {e}")
                raise

    def handle(self, *args, **kwargs):
        self.stdout.write("Processing Hexagrams and Lines for Spanish translations...")

        # Process Hexagrams
        hexagrams = Hexagram.objects.all()
        total_hexagrams = len(hexagrams)

        for idx, hexagram in enumerate(hexagrams, 1):
            self.stdout.write(
                f"[{idx}/{total_hexagrams}] Processing Hexagram {hexagram.number}..."
            )

            # Name
            if not hexagram.name_es:
                translation_es = self.translate_text(
                    hexagram.name_zh, hexagram.name_en, "the hexagram name"
                )
                hexagram.name_es = translation_es
                phrase, _ = Phrase.objects.get_or_create(
                    phrase=hexagram.name_zh,
                )
                Translation.objects.get_or_create(
                    phrase=phrase,
                    language="es",
                    defaults={"translation": translation_es},
                )
                self.stdout.write(f"Translated name_es for Hexagram {hexagram.number}")

            # Judgment
            if not hexagram.judgment_es:
                translation_es = self.translate_text(
                    hexagram.judgment_zh, hexagram.judgment_en, "the hexagram judgment"
                )
                hexagram.judgment_es = translation_es
                phrase, _ = Phrase.objects.get_or_create(
                    phrase=hexagram.judgment_zh,
                )
                Translation.objects.get_or_create(
                    phrase=phrase,
                    language="es",
                    defaults={"translation": translation_es},
                )
                self.stdout.write(
                    f"Translated judgment_es for Hexagram {hexagram.number}"
                )

            hexagram.save()

        # Process Lines
        lines = Line.objects.all()
        total_lines = len(lines)

        for idx, line in enumerate(lines, 1):
            self.stdout.write(
                f"[{idx}/{total_lines}] Processing Line {line.hexagram.number}.{line.line_number}..."
            )
            translation_es = self.translate_text(
                line.text_zh, line.text_en, f"line {line.line_number} text"
            )
            self.stdout.write(f"{line.text_zh}\n\n{line.text_en}\n\n{translation_es}")
            line.text_es = translation_es
            line.save()
            phrase, _ = Phrase.objects.get_or_create(
                phrase=line.text_zh,
            )
            Translation.objects.get_or_create(
                phrase=phrase,
                language="es",
                defaults={"translation": translation_es},
            )
            self.stdout.write(
                f"Translated text_es for Line {line.hexagram.number}.{line.line_number}"
            )

        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f"Hexagrams Processed {total_hexagrams}\n"
                f"Lines: Processed Total {total_lines}"
            )
        )
