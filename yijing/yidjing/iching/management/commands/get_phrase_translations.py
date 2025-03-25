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
        "description": "Return the best modern English translation for the given Chinese phrase based on ancient intent.",
        "parameters": translation_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Phrase and Translation models with Zhouyi data and ancient-intent English translations using xAI."

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
                            "You are an expert in Chinese linguistics, paleography, and Zhouyi translation. "
                            "Translate the given Chinese phrase from the Zhouyi (I Ching) into modern English, "
                            "drawing directly from its ancient Zhou-era intent (c. 1046–771 BCE). "
                            "Use the provided etymologies of the characters in the phrase to inform the translation. "
                            "Aim for a literal yet natural rendering—short, punchy, and vivid, like Hemingway. "
                            "Capture the primal, ritual-divinatory core (oracle bones, bronze vessels), "
                            "stripping away Han Confucian moralism, Song metaphysics, and Western glosses (e.g., no 'success' or 'virtue'). "
                            "Focus on raw meaning: 元 as 'primal/first,' 亨 as 'offering,' 利 as 'bounty/harvest,' 貞 as 'divination/fate.' "
                            "Take imagery liberties if it fits (e.g., 'riders mass' for 乘馬班如). "
                            "Provide only the best single translation—no alternatives, no explanation. "
                            "Context: Character etymologies for this phrase follow.\n\n"
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
                    defaults={"translation": trans_data.translation, "score": 10},
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
                            "You are an expert in Chinese linguistics, paleography, and Zhouyi translation. "
                            "Translate the given Chinese phrase from the Zhouyi (I Ching) into modern English, "
                            "drawing directly from its ancient Zhou-era intent (c. 1046–771 BCE). "
                            "Use the provided etymologies of the characters in the phrase to inform the translation. "
                            "Aim for a literal yet natural rendering—short, punchy, and vivid, like Hemingway. "
                            "Capture the primal, ritual-divinatory core (oracle bones, bronze vessels), "
                            "stripping away Han Confucian moralism, Song metaphysics, and Western glosses (e.g., no 'success' or 'virtue'). "
                            "Focus on raw meaning: 元 as 'primal/first,' 亨 as 'offering,' 利 as 'bounty/harvest,' 貞 as 'divination/fate.' "
                            "Take imagery liberties if it fits (e.g., 'riders mass' for 乘馬班如). "
                            "Provide only the best single translation—no alternatives, no explanation. "
                            "Context: Character etymologies for this phrase follow.\n\n"
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
                    defaults={"translation": trans_data.translation, "score": 10},
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
