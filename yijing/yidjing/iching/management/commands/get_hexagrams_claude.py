import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Hexagram, Line
from iching.prompts import get_hexagram_prompt, get_line_prompt
from anthropic import Anthropic  # Anthropic client

# Instantiate the Anthropic client
api_key = os.getenv("ANTHROPIC_API_KEY")
client = Anthropic(api_key=api_key)


# Pydantic models for function responses
class HexagramData(BaseModel):
    name_zh: str
    name_pinyin: str
    name_en: str
    binary: str
    judgment_zh: str
    judgment_en: str


class LineData(BaseModel):
    text_zh: str
    text_en: str


class Command(BaseCommand):
    help = "Fill the I Ching corpus by querying Claude using function calling and Pydantic for validation."

    completion_model = "claude-3-7-sonnet-20250219"  # Using Claude 3.7 Sonnet

    def handle(self, *args, **kwargs):
        # Iterate over hexagrams 1 to 64
        for number in range(3, 65):
            hex_prompt = get_hexagram_prompt(number)
            self.stdout.write(f"Processing Hexagram {number}...")
            try:
                # Define the hexagram function tool
                store_hexagram_tool = {
                    "name": "store_hexagram",
                    "description": "Return hexagram data with Chinese name, pinyin, English name, binary sequence, and judgments in Chinese and English.",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "name_zh": {"type": "string"},
                            "name_pinyin": {"type": "string"},
                            "name_en": {"type": "string"},
                            "binary": {"type": "string"},
                            "judgment_zh": {"type": "string"},
                            "judgment_en": {"type": "string"},
                        },
                        "required": [
                            "name_zh",
                            "name_pinyin",
                            "name_en",
                            "binary",
                            "judgment_zh",
                            "judgment_en",
                        ],
                    },
                }

                # Make the API call with function calling
                response = client.messages.create(
                    model=self.completion_model,
                    max_tokens=1000,
                    system="You are a scholarly expert on the I Ching. Provide the strict, early Zhou Yi text for the hexagram.",
                    messages=[{"role": "user", "content": hex_prompt}],
                    tools=[store_hexagram_tool],
                    tool_choice={"type": "tool", "name": "store_hexagram"},
                )

                # Extract the function call response
                tool_call = response.content[0].tool_calls[0]
                hex_data_dict = tool_call.input
                hex_data = HexagramData(**hex_data_dict)

            except (ValidationError, Exception) as e:
                self.stdout.write(f"Error fetching Hexagram {number}: {e}")
                return

            # Update or create the Hexagram record.
            hexagram_obj, _ = Hexagram.objects.update_or_create(
                number=number,
                defaults={
                    "name_zh": hex_data.name_zh,
                    "name_pinyin": hex_data.name_pinyin,
                    "name_en": hex_data.name_en,
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
                    # Define the line function tool
                    store_line_tool = {
                        "name": "store_line",
                        "description": "Return line data with original Chinese text and literal English translation.",
                        "input_schema": {
                            "type": "object",
                            "properties": {
                                "text_zh": {"type": "string"},
                                "text_en": {"type": "string"},
                            },
                            "required": ["text_zh", "text_en"],
                        },
                    }

                    # Make the API call with function calling
                    response = client.messages.create(
                        model=self.completion_model,
                        max_tokens=1000,
                        system="You are a scholarly expert on the I Ching. Provide the strict, early Zhou Yi text for this line.",
                        messages=[{"role": "user", "content": line_prompt}],
                        tools=[store_line_tool],
                        tool_choice={"type": "tool", "name": "store_line"},
                    )

                    # Extract the function call response
                    tool_call = response.content[0].tool_calls[0]
                    line_data_dict = tool_call.input
                    line_data = LineData(**line_data_dict)

                except (ValidationError, Exception) as e:
                    self.stdout.write(
                        f"Error fetching Hexagram {number}, Line {line_number}: {e}"
                    )
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
