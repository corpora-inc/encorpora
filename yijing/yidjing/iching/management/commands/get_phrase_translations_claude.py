import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel

from iching.models import Character, Hexagram, Line, Phrase, Translation
from anthropic import Anthropic

# Configure the Anthropic client
api_key = os.getenv("ANTHROPIC_API_KEY")
client = Anthropic(api_key=api_key)
completion_model = "claude-3-7-sonnet-20250219"


# Pydantic model for Translation response
class TranslationData(BaseModel):
    translation: str


# Define tool definition using Pydantic schema
translation_schema = TranslationData.model_json_schema()
tool_definition_translation = {
    "name": "store_translation",
    "description": "Return a literal English translation of the given Zhouyi Chinese phrase, reflecting each character's ancient Zhou-era meaning (c. 1046-771 BCE) in natural modern English.",
    "input_schema": translation_schema,
}


def get_system_prompt():
    return (
        "You are a master of Chinese linguistics, paleography, and Zhouyi translation. "
        "Translate the given Zhouyi (I Ching) phrase into natural modern English, reflecting the exact, literal meanings of each Chinese character as understood in the Zhou era (c. 1046-771 BCE). "
        "Anchor each word to its primal oracle bone or bronze inscription sense—use the provided etymologies as your guide—but weave them into a flowing, native English sentence. "
        "Do not add interpretation, gloss, or later cultural overlays or moralizing. "
        "Stay true to the raw, ritual-divinatory intent while ensuring the result reads smoothly to a modern English speaker. "
        "Output one translation, no notes, no fluff. "
        "Use character etymologies follow to inform literal meanings in the historical context. "
        "Do not OVERUSE the etymologies. Return natural and fluent English. "
        "The eymologies are just to inform the translation. "
        "Find the ancient meaning and intent of the phrase and translate it into natural, modern English."
    )


class Command(BaseCommand):
    help = "Populate Phrase and Translation models with literal Zhouyi translations from Claude"

    def handle(self, *args, **kwargs):
        total_phrases = Hexagram.objects.count() + Line.objects.count()
        self.stdout.write(f"Processing {total_phrases} phrases...")
        idx = 0

        # Process Hexagram judgments
        for hexagram in Hexagram.objects.all():
            idx += 1
            phrase_text = hexagram.judgment_zh
            self.stdout.write(
                f"[{idx}/{total_phrases}] Processing hexagram judgment '{phrase_text}'..."
            )

            # Get etymologies only for characters in this phrase
            phrase_chars = set(phrase_text)
            characters = Character.objects.filter(character__in=phrase_chars)
            etymology_context = "\n".join(
                f"Character: {char.character}\nEtymology: {char.etymology}"
                for char in characters
            )

            response = client.messages.create(
                model=completion_model,
                max_tokens=1000,
                system=get_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": f"You can use these etymologies to inform the translation: {etymology_context}",
                    },
                    {
                        "role": "user",
                        "content": f"Translate this Zhouyi phrase into natural modern English: {phrase_text}",
                    },
                ],
                tools=[tool_definition_translation],
                tool_choice={"type": "tool", "name": "store_translation"},
            )

            # Extract the tool use block
            for block in response.content:
                if block.type == "tool_use" and block.name == "store_translation":
                    trans_data = TranslationData(**block.input)
                    break
            else:
                self.stdout.write(f"No tool use block found for '{phrase_text}'")
                raise ValueError("Expected tool use response not received")

            # Create or update Phrase and Translation
            phrase_obj, _ = Phrase.objects.get_or_create(phrase=phrase_text)
            Translation.objects.update_or_create(
                phrase=phrase_obj,
                language="en",
                style="ancient",
                defaults={
                    "translation": trans_data.translation,
                    "score": 0,
                    "attribution": "claude-3.7",
                },
            )
            self.stdout.write(
                f"Translated '{phrase_text}' to '{trans_data.translation}'"
            )

        # Process Lines
        for line in Line.objects.all():
            idx += 1
            phrase_text = line.text_zh
            self.stdout.write(
                f"[{idx}/{total_phrases}] Processing line '{phrase_text}'..."
            )

            # Get etymologies only for characters in this phrase
            phrase_chars = set(phrase_text)
            characters = Character.objects.filter(character__in=phrase_chars)
            etymology_context = "\n".join(
                f"Character: {char.character}\nEtymology: {char.etymology}"
                for char in characters
            )

            response = client.messages.create(
                model=completion_model,
                max_tokens=1000,
                system=get_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": f"You can use these etymologies to inform the translation: {etymology_context}",
                    },
                    {
                        "role": "user",
                        "content": f"Translate this Zhouyi phrase into natural modern English, keeping each character's ancient Zhou-era meaning literal: {phrase_text}",
                    },
                ],
                tools=[tool_definition_translation],
                tool_choice={"type": "tool", "name": "store_translation"},
            )

            # Extract the tool use block
            for block in response.content:
                if block.type == "tool_use" and block.name == "store_translation":
                    trans_data = TranslationData(**block.input)
                    break
            else:
                self.stdout.write(f"No tool use block found for '{phrase_text}'")
                raise ValueError("Expected tool use response not received")

            # Create or update Phrase and Translation
            phrase_obj, _ = Phrase.objects.get_or_create(phrase=phrase_text)
            Translation.objects.update_or_create(
                phrase=phrase_obj,
                language="en",
                style="ancient",
                defaults={
                    "translation": trans_data.translation,
                    "score": 0,
                    "attribution": "claude-3.7",
                },
            )
            self.stdout.write(
                f"Translated '{phrase_text}' to '{trans_data.translation}'"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Processed {total_phrases} phrases successfully.")
        )
