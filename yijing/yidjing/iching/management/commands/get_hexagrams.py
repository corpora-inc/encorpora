import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Hexagram, Line
from iching.prompts import get_hexagram_prompt, get_line_prompt
from openai import OpenAI

# Instantiate the OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
completion_model = "o3-mini"

# api_key = os.getenv("XAI_API_KEY")
# client = OpenAI(
#     api_key=api_key,
#     base_url="https://api.x.ai/v1",
# )
# completion_model = "grok-2-latest"


# Pydantic models for function responses
class HexagramData(BaseModel):
    chinese_name: str
    pinyin: str
    english_name: str
    binary: str
    judgment_zh: str
    judgment_en: str


class LineData(BaseModel):
    text_zh: str
    text_en: str


class Command(BaseCommand):
    help = "Fill the I Ching corpus by querying OpenAI using function calling and Pydantic for validation."

    def handle(self, *args, **kwargs):
        for number in range(64, 0, -1):
            hex_prompt = get_hexagram_prompt(number)
            self.stdout.write(f"Processing Hexagram {number}...")
            try:
                # Prepare messages for the hexagram call.
                message_dicts = [
                    {
                        "role": "system",
                        "content": "You are a scholarly expert on the I Ching. Provide the strict, early Zhou Yi text for the hexagram.",
                    },
                    {"role": "user", "content": hex_prompt},
                ]
                function = {
                    "name": "store_hexagram",
                    "description": (
                        "Return hexagram data with Chinese name, pinyin, "
                        "English name, binary sequence, and judgments in Chinese and English."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "chinese_name": {"type": "string"},
                            "pinyin": {"type": "string"},
                            "english_name": {"type": "string"},
                            "binary": {"type": "string"},
                            "judgment_zh": {"type": "string"},
                            "judgment_en": {"type": "string"},
                        },
                        "required": [
                            "chinese_name",
                            "pinyin",
                            "english_name",
                            "binary",
                            "judgment_zh",
                            "judgment_en",
                        ],
                    },
                }
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    functions=[function],
                    function_call={"name": "store_hexagram"},
                )
                func_call = response.choices[0].message.function_call
                args_str = func_call.arguments  # This is a JSON string
                hex_data = HexagramData.model_validate_json(args_str)
            except (ValidationError, Exception) as e:
                self.stdout.write(f"Error fetching Hexagram {number}: {e}")
                import traceback

                traceback.print_exc()
                return

            # Update or create the Hexagram record.
            hexagram_obj, _ = Hexagram.objects.update_or_create(
                number=number,
                defaults={
                    "chinese_name": hex_data.chinese_name,
                    "pinyin": hex_data.pinyin,
                    "english_name": hex_data.english_name,
                    "binary": hex_data.binary,
                    "judgment_zh": hex_data.judgment_zh,
                    "judgment_en": hex_data.judgment_en,
                },
            )
            self.stdout.write(f"Hexagram {number} processed.")

            # Process each of the 6 lines.
            for line_number in range(1, 7):
                self.stdout.write(
                    f"  Processing Hexagram {number}, Line {line_number}..."
                )
                line_prompt = get_line_prompt(number, line_number)
                try:
                    message_dicts = [
                        {
                            "role": "system",
                            "content": "You are a scholarly expert on the I Ching. Provide the strict, early Zhou Yi text for this line.",
                        },
                        {"role": "user", "content": line_prompt},
                    ]
                    function_line = {
                        "name": "store_line",
                        "description": (
                            "Return line data with original Chinese text and literal English translation."
                        ),
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "text_zh": {"type": "string"},
                                "text_en": {"type": "string"},
                            },
                            "required": ["text_zh", "text_en"],
                        },
                    }
                    response = client.chat.completions.create(
                        model=completion_model,
                        messages=message_dicts,
                        functions=[function_line],
                        function_call={"name": "store_line"},
                    )
                    func_call = response.choices[0].message.function_call
                    args_str = func_call.arguments
                    line_data = LineData.model_validate_json(args_str)
                except (ValidationError, Exception) as e:
                    self.stdout.write(
                        f"Error fetching Hexagram {number}, Line {line_number}: {e}"
                    )
                    import traceback

                    traceback.print_exc()
                    return

                Line.objects.update_or_create(
                    hexagram=hexagram_obj,
                    line_number=line_number,
                    defaults={
                        "text_zh": line_data.text_zh,
                        "text_en": line_data.text_en,
                    },
                )
                self.stdout.write(f"  Hexagram {number}, Line {line_number} processed.")

        self.stdout.write(
            self.style.SUCCESS("All hexagrams and lines processed successfully.")
        )
