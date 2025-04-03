import os
import itertools
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError

from iching.models import Consultation, ConsultationInterpretation
from openai import OpenAI

# Configure the xAI client
api_key = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1",
)
completion_model = "grok-2-latest"


# Pydantic model for Interpretation response
class InterpretationData(BaseModel):
    interpretation: str


# Define tool definition using Pydantic schema
interpretation_schema = InterpretationData.model_json_schema()
tool_definition_interpretation = {
    "type": "function",
    "function": {
        "name": "store_interpretation",
        "description": "Return a thoughtful, imaginative interpretation of the given I Ching consultation based on its Chinese and English texts.",
        "parameters": interpretation_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Consultation and ConsultationInterpretation models for all 4096 I Ching readings with thoughtful, creative interpretations"

    def handle(self, *args, **kwargs):
        # Generate all 4096 permutations (666666 to 999999)
        line_options = ["6", "7", "8", "9"]
        all_consultations = [
            "".join(combo) for combo in itertools.product(line_options, repeat=6)
        ]
        total_consultations = len(all_consultations)
        self.stdout.write(f"Processing {total_consultations} consultations...")

        for idx, compact_rep in enumerate(all_consultations, 1):
            self.stdout.write(
                f"[{idx}/{total_consultations}] Processing consultation '{compact_rep}'..."
            )

            # Create or get Consultation
            consultation, _ = Consultation.objects.get_or_create(
                compact_representation=compact_rep
            )

            # Get Chinese and English texts
            zh_text = "\n".join(consultation.get_text("zh"))
            en_text = "\n".join(consultation.get_text("en"))
            context = f"Chinese Text:\n{zh_text}\n\nEnglish Text:\n{en_text}"

            # Generate thoughtful, creative interpretation with Grok 2
            try:
                message_dicts = [
                    {
                        "role": "system",
                        "content": (
                            "You are a seasoned I Ching diviner, rooted in its ancient Zhou-era wisdom (c. 1046-771 BCE). "
                            "Interpret the given I Ching consultation based on its Chinese and English texts with thoughtfulness and imagination. "
                            "Stay close to the texts, reflecting on the primary hexagram's judgment, the changing lines (if any), and the secondary hexagram's judgment (if present). "
                            "Draw from the raw meanings—oracle bones, bronze inscriptions, shamanic insights—and offer a clear, practical reading that guides the seeker. "
                            "Let the symbols inspire a narrative of fate, nature, or human experience, but keep it grounded and serious, avoiding exaggeration or mockery. "
                            "Use the store_interpretation tool to return the interpretation as a single, cohesive text—no notes, no extra commentary. "
                            "Context: The consultation's Chinese and English texts follow.\n\n"
                            + context
                        ),
                    },
                    {
                        "role": "user",
                        "content": "Provide a thoughtful, text-based interpretation of this I Ching consultation, using the store_interpretation tool.",
                    },
                ]
                response = client.chat.completions.create(
                    model=completion_model,
                    messages=message_dicts,
                    tools=[tool_definition_interpretation],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_interpretation"},
                    },
                    temperature=0.8,  # Slightly lower for less wildness, still creative
                    max_tokens=2000,  # Still allows rich responses
                )
                message = response.choices[0].message
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    if tool_call.function.name == "store_interpretation":
                        args_str = tool_call.function.arguments  # JSON string
                        interp_data = InterpretationData.model_validate_json(args_str)
                    else:
                        raise ValueError(
                            f"Unexpected tool call: {tool_call.function.name}"
                        )
                else:
                    raise ValueError(f"No tool call in response for '{compact_rep}'")

                # Create or update ConsultationInterpretation
                ConsultationInterpretation.objects.update_or_create(
                    consultation=consultation,
                    attribution="grok-2-latest",
                    defaults={"text": interp_data.interpretation},
                )
                self.stdout.write(
                    f"Interpreted '{compact_rep}' as '{interp_data.interpretation[:100]}...'"
                )
            except (ValidationError, ValueError, Exception) as e:
                self.stdout.write(f"Error processing consultation '{compact_rep}': {e}")
                continue

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {total_consultations} consultations successfully."
            )
        )
