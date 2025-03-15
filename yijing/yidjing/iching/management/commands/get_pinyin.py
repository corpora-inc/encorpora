import os
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Hexagram, Line
from openai import OpenAI

# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic models for Pinyin responses
class HexagramPinyinData(BaseModel):
    judgment_pinyin: str


class LinePinyinData(BaseModel):
    text_pinyin: str


# Define tool definitions using Pydantic schemas
hexagram_pinyin_schema = HexagramPinyinData.model_json_schema()
tool_definition_hex_pinyin = {
    "type": "function",
    "function": {
        "name": "store_hexagram_pinyin",
        "description": "Return Pinyin transcription for the hexagram judgment with tones.",
        "parameters": hexagram_pinyin_schema,
    },
}

line_pinyin_schema = LinePinyinData.model_json_schema()
tool_definition_line_pinyin = {
    "type": "function",
    "function": {
        "name": "store_line_pinyin",
        "description": "Return Pinyin transcription for the line text with tones.",
        "parameters": line_pinyin_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Pinyin fields for Hexagram judgments and lines using xAI with tool calling."

    def handle(self, *args, **kwargs):
        # Process all 64 hexagrams
        for hexagram in Hexagram.objects.all():
            number = hexagram.number
            self.stdout.write(f"Processing Hexagram {number}...")

            # Generate Pinyin for the judgment
            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": "You are an expert in Chinese linguistics. Provide accurate Pinyin transcription for the given Chinese text, including tones (e.g., mā, má, mǎ, mà). Use standard Mandarin romanization.",
                    },
                    {
                        "role": "user",
                        "content": f"Convert this Chinese text to Pinyin with tones: {hexagram.judgment_zh}",
                    },
                ]
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    tools=[tool_definition_hex_pinyin],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_hexagram_pinyin"},
                    },
                )
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_hexagram_pinyin":
                        args_str = tool_call.function.arguments  # JSON string
                        hex_pinyin_data = HexagramPinyinData.model_validate_json(
                            args_str
                        )
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError("No tool call in response")

                # Update the hexagram with Pinyin
                hexagram.judgment_pinyin = hex_pinyin_data.judgment_pinyin
                hexagram.save()
                self.stdout.write(
                    f"Hexagram {number} judgment Pinyin added: {hexagram.judgment_pinyin}"
                )
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error processing Hexagram {number} judgment: {e}")
                continue

            # Process each of the 6 lines
            for line in Line.objects.filter(hexagram=hexagram):
                line_number = line.line_number
                self.stdout.write(
                    f"  Processing Hexagram {number}, Line {line_number}..."
                )

                try:
                    message_dicts = [
                        {
                            "role": "system",
                            "content": "You are an expert in Chinese linguistics. Provide accurate Pinyin transcription for the given Chinese text, including tones (e.g., mā, má, mǎ, mà). Use standard Mandarin romanization.",
                        },
                        {
                            "role": "user",
                            "content": f"Convert this Chinese text to Pinyin with tones: {line.text_zh}",
                        },
                    ]
                    response = client.chat.completions.create(
                        model=completion_model,
                        messages=message_dicts,
                        tools=[tool_definition_line_pinyin],
                        tool_choice={
                            "type": "function",
                            "function": {"name": "store_line_pinyin"},
                        },
                    )
                    message = response.choices[0].message
                    if message.tool_calls:
                        tool_call = message.tool_calls[0]
                        if tool_call.function.name == "store_line_pinyin":
                            args_str = tool_call.function.arguments  # JSON string
                            line_pinyin_data = LinePinyinData.model_validate_json(
                                args_str
                            )
                        else:
                            raise ValueError(
                                f"Unexpected tool call: {tool_call.function.name}"
                            )
                    else:
                        raise ValueError("No tool call in response")

                    # Update the line with Pinyin
                    line.text_pinyin = line_pinyin_data.text_pinyin
                    line.save()
                    self.stdout.write(
                        f"  Hexagram {number}, Line {line_number} Pinyin added: {line.text_pinyin}"
                    )
                except (ValidationError, ValueError, Exception) as e:
                    self.stdout.write(
                        f"Error processing Hexagram {number}, Line {line_number}: {e}"
                    )
                    continue

        self.stdout.write(
            self.style.SUCCESS(
                "All hexagram judgments and lines Pinyin populated successfully."
            )
        )
