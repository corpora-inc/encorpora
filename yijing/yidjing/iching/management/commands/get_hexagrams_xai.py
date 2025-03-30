import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Hexagram, Line
from iching.prompts import get_hexagram_prompt, get_line_prompt
from openai import OpenAI

# Configure the XAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic models for structured responses
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


# Define tool definitions using Pydantic schemas
hexagram_schema = HexagramData.model_json_schema()
tool_definition_hex = {
    "type": "function",
    "function": {
        "name": "store_hexagram",
        "description": "Provide hexagram data with Chinese name, pinyin, English name, binary sequence, and judgments in Chinese and English.",
        "parameters": hexagram_schema,
    },
}

line_schema = LineData.model_json_schema()
tool_definition_line = {
    "type": "function",
    "function": {
        "name": "store_line",
        "description": "Provide line data with original Chinese text and literal English translation.",
        "parameters": line_schema,
    },
}


class Command(BaseCommand):
    help = "Fill the I Ching corpus by querying XAI using tool calling and Pydantic for validation."

    def handle(self, *args, **kwargs):
        for number in range(1, 65):
            hex_prompt = get_hexagram_prompt(number)
            self.stdout.write(f"Processing Hexagram {number}...")
            try:
                # Prepare messages for the hexagram call
                message_dicts = [
                    {
                        "role": "system",
                        "content": "You are a scholarly expert on the I Ching. Provide the strict, early Zhou Yi text for the hexagram.",
                    },
                    {"role": "user", "content": hex_prompt},
                ]
                # Make the API call with tools
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    tools=[tool_definition_hex],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_hexagram"},
                    },
                )
                # Parse the tool call from the response
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_hexagram":
                        args_str = tool_call.function.arguments  # JSON string
                        hex_data = HexagramData.model_validate_json(args_str)
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError("No tool call in response")
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error fetching Hexagram {number}: {e}")
                import traceback

                traceback.print_exc()
                return

            # Update or create the Hexagram record
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

            # Process each of the 6 lines
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
                    # Make the API call with tools for the line
                    response = client.chat.completions.create(
                        model=completion_model,
                        messages=message_dicts,
                        tools=[tool_definition_line],
                        tool_choice={
                            "type": "function",
                            "function": {"name": "store_line"},
                        },
                    )
                    # Parse the tool call from the response
                    message = response.choices[0].message
                    if message.tool_calls:
                        tool_call = message.tool_calls[0]
                        if tool_call.function.name == "store_line":
                            args_str = tool_call.function.arguments  # JSON string
                            line_data = LineData.model_validate_json(args_str)
                        else:
                            raise ValueError(
                                f"Unexpected tool call: {tool_call.function.name}"
                            )
                    else:
                        raise ValueError("No tool call in response")
                except (ValidationError, ValueError, Exception) as e:
                    self.stdout.write(
                        f"Error fetching Hexagram {number}, Line {line_number}: {e}"
                    )
                    import traceback

                    traceback.print_exc()
                    return

                # Update or create the Line record
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
