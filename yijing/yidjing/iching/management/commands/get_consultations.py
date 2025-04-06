import os
import itertools
import time
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
        "description": "Return a thoughtful, symbol-rich interpretation of the given I Ching consultation based on its Chinese and English texts.",
        "parameters": interpretation_schema,
    },
}


class Command(BaseCommand):
    help = "Populate Consultation and ConsultationInterpretation models for all 4096 I Ching readings with thoughtful, symbol-rich interpretations, skipping existing ones and retrying failures"

    def handle(self, *args, **kwargs):
        # Generate all 4096 permutations (666666 to 999999)
        line_options = ["6", "7", "8", "9"]
        all_consultations = [
            "".join(combo) for combo in itertools.product(line_options, repeat=6)
        ]
        total_consultations = len(all_consultations)
        self.stdout.write(f"Processing up to {total_consultations} consultations...")

        processed = 0
        skipped = 0
        for idx, compact_rep in enumerate(all_consultations, 1):
            self.stdout.write(
                f"[{idx}/{total_consultations}] Processing consultation '{compact_rep}'..."
            )

            # Create or get Consultation
            consultation, _ = Consultation.objects.get_or_create(
                compact_representation=compact_rep
            )

            # Skip if interpretation already exists
            if ConsultationInterpretation.objects.filter(
                consultation=consultation, attribution="grok-2-latest"
            ).exists():
                self.stdout.write(f"Skipping '{compact_rep}' - already interpreted")
                skipped += 1
                continue

            # Get Chinese and English texts
            zh_text = "\n".join(consultation.get_text("zh"))
            en_text = "\n".join(consultation.get_text("en"))
            context = f"Chinese Text:\n{zh_text}\n\nEnglish Text:\n{en_text}"

            # Retry logic for API call
            max_retries = 10
            for attempt in range(max_retries):
                try:
                    message_dicts = [
                        {
                            "role": "system",
                            "content": (
                                "You are an expert interpreter of the I Ching. "
                                "Interpret the given I Ching consultation with depth and precision, rooted in its Chinese and English texts. "
                                "Focus tightly on the primary hexagram's judgment, each changing line (if any), and the secondary hexagram's judgment (if present). "
                                "Draw out the raw, specific symbolism reflecting the oracle's ancient intent. "
                                "Offer a clear, practical reading that guides the seeker through fate, nature, or human experience, enriched with restrained creative insight into the symbols' ancient weight. "
                                "Stay serious and text-grounded, avoiding vague platitudes (e.g., 'true nature') or mockery—think like a Zhou diviner giving real counsel. "
                                "Use the store_interpretation tool to return the interpretation as a single, cohesive text—no notes, no extra commentary. "
                                "Context: The consultation's Chinese and English texts follow.\n\n"
                                + context
                            ),
                        },
                        {
                            "role": "user",
                            "content": "Provide a thoughtful, symbol-specific interpretation of this I Ching consultation, using the store_interpretation tool.",
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
                        temperature=0.8,
                        max_tokens=2000,
                    )
                    message = response.choices[0].message
                    if message.tool_calls:
                        tool_call = message.tool_calls[0]
                        if tool_call.function.name == "store_interpretation":
                            args_str = tool_call.function.arguments  # JSON string
                            interp_data = InterpretationData.model_validate_json(
                                args_str
                            )
                            break  # Success, exit retry loop
                        else:
                            raise ValueError(
                                f"Unexpected tool call: {tool_call.function.name}"
                            )
                    else:
                        self.stdout.write(
                            f"Attempt {attempt + 1}/{max_retries}: No tool call for '{compact_rep}'"
                        )
                        if attempt < max_retries - 1:
                            time.sleep(2)  # Brief delay before retry
                            continue
                        raise ValueError(
                            f"No tool call after {max_retries} attempts for '{compact_rep}'"
                        )
                except (ValidationError, ValueError) as e:
                    self.stdout.write(
                        f"Attempt {attempt + 1}/{max_retries} failed: {e}"
                    )
                    if attempt < max_retries - 1:
                        time.sleep(2)  # Brief delay before retry
                        continue
                    raise  # Re-raise on final failure
                except Exception as e:
                    self.stdout.write(f"Unexpected error for '{compact_rep}': {e}")
                    raise  # Let unexpected errors crash

            # Create or update ConsultationInterpretation
            ConsultationInterpretation.objects.update_or_create(
                consultation=consultation,
                attribution="grok-2-latest",
                defaults={"text": interp_data.interpretation},
            )
            self.stdout.write(
                f"Interpreted '{compact_rep}' as '{interp_data.interpretation[:100]}...'"
            )
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {processed} new consultations, skipped {skipped}, total {total_consultations} permutations."
            )
        )
