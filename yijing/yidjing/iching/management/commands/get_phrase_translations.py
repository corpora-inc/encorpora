import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Character, Hexagram, Line, Phrase, Translation
from openai import OpenAI

# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic model for Translation response
class TranslationData(BaseModel):
    translation: str


# Define tool definition using Pydantic schema
translation_schema = TranslationData.model_json_schema()
tool_definition_translation = {
    "type": "function",
    "function": {
        "name": "store_translation",
        "description": "Return a modern English translation of the given "
        "Zhouyi Chinese phrase, rooted in its ancient Zhou-era intent "
        "(c. 1046-771 BCE).",
        "parameters": translation_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Phrase and Translation models with Zhouyi ancient intent English translations"

    def handle(self, *args, **kwargs):
        total_phrases = Hexagram.objects.count() + Line.objects.count()
        self.stdout.write(f"Processing {total_phrases} phrases...")
        idx = 0

        # Process Hexagram judgments
        for hexagram in Hexagram.objects.all():
            idx += 1
            phrase_text = hexagram.judgment_zh
            self.stdout.write(
                f"[{idx}/{total_phrases}] Processing phrase '{phrase_text}'..."
            )

            # Get etymologies only for characters in this phrase
            phrase_chars = set(phrase_text)
            characters = Character.objects.filter(character__in=phrase_chars)
            etymology_context = "\n".join(
                f"Character: {char.character}\nEtymology: {char.etymology}"
                for char in characters
            )

            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": (
                            "You are a master of Chinese linguistics, paleography, and Zhouyi translation. "
                            "Translate the given Zhouyi (I Ching) phrase into modern English, channeling its ancient Zhou-era intent (c. 1046-771 BCE). "
                            "Lean hard on the provided character etymologies to dig out raw, primal meanings—think oracle bones, bronze vessels, ancestral whispers. "
                            "Let the context and etymology steer each character's meaning—don't lock anything in; feel the nuance shift across the book. "
                            "Tap the ritual-divinatory heartbeat—shamans casting fates, not scribes moralizing. "
                            "Give one bold translation, no fluff, no notes. "
                            "Context: Character etymologies follow.\n\n"
                            + etymology_context
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Translate this Zhouyi phrase into modern English: {phrase_text}",
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
                )
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_translation":
                        args_str = tool_call.function.arguments  # JSON string
                        trans_data = TranslationData.model_validate_json(args_str)
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError("No tool call in response")

                # Create or update Phrase and Translation
                phrase_obj, _ = Phrase.objects.get_or_create(phrase=phrase_text)
                Translation.objects.update_or_create(
                    phrase=phrase_obj,
                    language="en",
                    defaults={"translation": trans_data.translation, "score": 0},
                )
                self.stdout.write(
                    f"Translated '{phrase_text}' to '{trans_data.translation}'"
                )
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error processing phrase '{phrase_text}': {e}")
                continue

        # Process Lines
        for line in Line.objects.all():
            idx += 1
            phrase_text = line.text_zh
            self.stdout.write(
                f"[{idx}/{total_phrases}] Processing phrase '{phrase_text}'..."
            )

            # Get etymologies only for characters in this phrase
            phrase_chars = set(phrase_text)
            characters = Character.objects.filter(character__in=phrase_chars)
            etymology_context = "\n".join(
                f"Character: {char.character}\nEtymology: {char.etymology}"
                for char in characters
            )

            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": (
                            "You are a master of Chinese linguistics, paleography, and Zhouyi translation. "
                            "Translate the given Zhouyi (I Ching) phrase into modern English, channeling its ancient Zhou-era intent (c. 1046–771 BCE). "
                            "Lean hard on the provided character etymologies to dig out raw, primal meanings—think oracle bones, bronze vessels, ancestral whispers. "
                            "Make it vivid and punchy—short bursts like Hemingway, but flow naturally if the phrase demands it. "
                            "Ditch Han Confucian polish (no 'virtue' or 'gentleman'), Song metaphysics, and Western sugarcoating (no unearned 'success' or 'happiness'). "
                            "Let the context and etymology steer each character's meaning—don't lock anything in; feel the nuance shift across the book. "
                            "Tap the ritual-divinatory heartbeat—shamans casting fates, not scribes moralizing. "
                            "Make the translation literal and direct. Punchy. "
                            "Give one bold translation, no fluff, no notes. "
                            "Context: Character etymologies follow.\n\n"
                            + etymology_context
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Translate this Zhouyi phrase into modern English: {phrase_text}",
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
                )
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_translation":
                        args_str = tool_call.function.arguments  # JSON string
                        trans_data = TranslationData.model_validate_json(args_str)
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError("No tool call in response")

                # Create or update Phrase and Translation
                phrase_obj, _ = Phrase.objects.get_or_create(phrase=phrase_text)
                Translation.objects.update_or_create(
                    phrase=phrase_obj,
                    language="en",
                    style="ancient",
                    defaults={"translation": trans_data.translation, "score": 0},
                )
                self.stdout.write(
                    f"Translated '{phrase_text}' to '{trans_data.translation}'"
                )
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error processing phrase '{phrase_text}': {e}")
                continue

        self.stdout.write(
            self.style.SUCCESS(f"Processed {total_phrases} phrases successfully.")
        )
