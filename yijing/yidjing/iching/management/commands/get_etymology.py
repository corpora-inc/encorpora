import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Character, Hexagram, Line
from openai import OpenAI

# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic model for Character response
class CharacterData(BaseModel):
    etymology: str
    pinyin: str


# Define tool definition using Pydantic schema
character_schema = CharacterData.model_json_schema()
tool_definition_character = {
    "type": "function",
    "function": {
        "name": "store_character_data",
        "description": "Return a detailed etymology for the given Chinese character.",
        "parameters": character_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Character model with detailed meaning and history etymology using xAI."

    def handle(self, *args, **kwargs):
        # Get unique characters from Hexagram and Line models
        unique_chars = set(
            "".join(h.name_zh + h.judgment_zh for h in Hexagram.objects.all())
            + "".join(li.text_zh for li in Line.objects.all())
        )
        total_chars = len(unique_chars)
        self.stdout.write(f"Processing {total_chars} unique characters...")

        for idx, char in enumerate(sorted(unique_chars)):
            # if Character.objects.filter(character=char).exists():
            #     c = Character.objects.get(character=char)
            #     if c.etymology and c.pinyin:
            #         self.stdout.write(
            #             f"[{idx}/{total_chars}] Skipping existing character '{char}'..."
            #         )
            #         continue

            self.stdout.write(f"[{idx}/{total_chars}] Processing character '{char}'...")

            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": (
                            "You are an expert in Chinese linguistics and paleography. "
                            "Provide a concise etymology for the given Chinese character in English. "
                            "Focus on: "
                            "all possible meanings and modern English translations with different context (e.g., different senses in different scenarios), "
                            "its complete history (origin in oracle bones, bronze, etc.), whether it's a pictograph and what it depicted, "
                            "its original intent if known (raw, no Confucian, Jesuit, or German gloss), "
                            "and how its meaning evolved over time. "
                            "Write 1-2 paragraphs of clear prose—no lists, no fluff, just a solid explanation - scholarly yet clear and accessible. "
                            "Explore depth of meaning and history. Keep it focused and factual. "
                            "Don't add wasted fluff filler like 'rich history'. The material should be dense, informative, and focused. "
                            "The material is interesting enough without empty words. No intro, no conclusion, just the straight etymology. "
                            "You may use examples to illustrate how the meaning can be different when paired with other characters."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Provide the etymology for this Chinese character: {char}",
                    },
                ]
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    tools=[tool_definition_character],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_character_data"},
                    },
                )
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_character_data":
                        args_str = tool_call.function.arguments  # JSON string
                        char_data = CharacterData.model_validate_json(args_str)
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError("No tool call in response")

                # Create or update the Character entry
                char_obj, created = Character.objects.get_or_create(
                    character=char,
                    defaults={
                        "etymology": char_data.etymology,
                        "pinyin": char_data.pinyin,
                    },
                )
                if not created:
                    char_obj.etymology = char_data.etymology
                    char_obj.pinyin = char_data.pinyin
                    char_obj.save()
                self.stdout.write(
                    f"Character '{char}' {'created' if created else 'updated'}"
                )
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error processing character '{char}': {e}")
                continue

        self.stdout.write(
            self.style.SUCCESS(f"Processed {total_chars} characters successfully.")
        )
