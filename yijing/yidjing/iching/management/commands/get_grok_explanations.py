import os
import time
from django.core.management.base import BaseCommand
from pydantic import BaseModel, ValidationError
from iching.models import Hexagram, Line, Phrase, Translation, Explanation
from openai import OpenAI

# DEFAULT_MODEL = "grok-3-beta"
DEFAULT_MODEL = "grok-3-mini-beta"
MAX_TOKENS = 8192

BASE_SYSTEM_MESSAGE = """
You are a scholar and expert in classical Chinese, oracle bone script, and early divination.
Your task is to explain each phrase from the I Ching in natural, flowing prose—focused solely on its earliest meaning.
Draw upon oracle bone and bronze inscriptions, ritual context, and the worldview of early Chinese diviners.

Do not include headings, bullet points, or markdown. Do not mention the hexagram or where the phrase comes from.
Write a few scholarly but readable paragraphs that explain the phrase's original function, imagery, and symbolism.
Prioritize the ancient, sacrificial, or divinatory meaning over later Confucian, Han, or Jesuit interpretations.

Do not imitate Wilhelm, Baynes, or modern glosses. Ignore modern psychological or moral readings.
Only include later interpretations if necessary to clarify the ancient meaning by contrast.

The goal is to recover the earliest intent of the characters, not reinterpret it through later philosophies.

Provide a clear, modern-language translation and explanation in target language.
""".strip()

LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ko": "Korean",
    "ja": "Japanese",
    "zh": "Chinese",
    "ru": "Russian",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "ar": "Arabic",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "nl": "Dutch",
    "sv": "Swedish",
    "fi": "Finnish",
    "da": "Danish",
    "no": "Norwegian",
    "hu": "Hungarian",
    "cs": "Czech",
    "ro": "Romanian",
    "sk": "Slovak",
    "bg": "Bulgarian",
    "el": "Greek",
    "he": "Hebrew",
    "uk": "Ukrainian",
    "hi": "Hindi",
    "bn": "Bengali",
    "sw": "Swahili",
    "tl": "Tagalog",
    "fa": "Persian",
}


class ExplanationData(BaseModel):
    explanation: str
    translation: str


tool_definition = {
    "type": "function",
    "function": {
        "name": "store_explanation",
        "description": "Return a deep explanation and modern translation of a Chinese I Ching phrase in the target language.",
        "parameters": ExplanationData.model_json_schema(),
    },
}


class PromptTranslationData(BaseModel):
    translated_prompt: str


tool_definition_prompt = {
    "type": "function",
    "function": {
        "name": "translate_prompt",
        "description": "Translate the following system prompt into the target language.",
        "parameters": {
            "type": "object",
            "properties": {
                "translated_prompt": {"type": "string"},
            },
            "required": ["translated_prompt"],
        },
    },
}


class Command(BaseCommand):
    help = "Generate Explanation and Translation for I Ching phrases."

    def add_arguments(self, parser):
        parser.add_argument(
            "--lang", default="en", help="Target language (default: en)"
        )
        parser.add_argument(
            "--model",
            default=DEFAULT_MODEL,
            help="Grok model name (default: grok-3-beta)",
        )

    def translate_system_prompt(
        self, lang_code: str, language_name: str, model: str
    ) -> str:
        prompt = BASE_SYSTEM_MESSAGE.replace("target language", language_name)
        client = OpenAI(
            api_key=os.getenv("XAI_API_KEY"), base_url="https://api.x.ai/v1"
        )
        messages = [
            {
                "role": "system",
                "content": "You are a careful translator who returns only the translated prompt.",
            },
            {
                "role": "user",
                "content": f"Translate the following prompt into {language_name}:\n\n{prompt}",
            },
        ]
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=[tool_definition_prompt],
                tool_choice={
                    "type": "function",
                    "function": {"name": "translate_prompt"},
                },
                temperature=0.3,
                max_tokens=2048,
            )
            args = response.choices[0].message.tool_calls[0].function.arguments
            data = PromptTranslationData.model_validate_json(args)
            return data.translated_prompt.strip()
        except Exception as e:
            self.stdout.write(
                f"⚠️ Failed to translate prompt to {lang_code}, falling back to English: {e}"
            )
            return prompt

    def get_client(self):
        return OpenAI(api_key=os.getenv("XAI_API_KEY"), base_url="https://api.x.ai/v1")

    def get_explanation(
        self, zh: str, model: str, lang: str, system_message: str
    ) -> ExplanationData:
        language_name = LANGUAGE_NAMES.get(lang, lang)
        client = self.get_client()
        for attempt in range(3):
            try:
                messages = [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": zh},
                ]
                tool_definition["function"]["description"] = (
                    f"Return a deep explanation and modern translation of the Chinese I Ching phrase '{zh}' in {language_name}."
                )
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=[tool_definition],
                    tool_choice={
                        "type": "function",
                        "function": {"name": "store_explanation"},
                    },
                    temperature=0.4,
                    max_tokens=MAX_TOKENS,
                )
                call = response.choices[0].message.tool_calls[0].function
                return ExplanationData.model_validate_json(call.arguments)
            except (ValidationError, IndexError) as e:
                self.stdout.write(f"Attempt {attempt+1} failed: {e}")
                time.sleep(2)
        raise RuntimeError("Failed to get explanation from xAI")

    def process_phrase(self, zh: str, lang: str, model: str, system_message: str):
        phrase, _ = Phrase.objects.get_or_create(phrase=zh)

        # Avoid duplicate explanation for same phrase/language/attribution
        if Explanation.objects.filter(
            phrase=phrase, language=lang, attribution=model
        ).exists():
            self.stdout.write(
                f"⏩ Explanation already exists for phrase ({lang}): {zh}"
            )
            return

        try:
            data = self.get_explanation(
                zh, model=model, lang=lang, system_message=system_message
            )
        except Exception as e:
            self.stdout.write(f"❌ Failed to explain '{zh}': {e}")
            return

        # Save Translation
        Translation.objects.get_or_create(
            phrase=phrase,
            language=lang,
            style="ancient",
            attribution=model,
            defaults={"translation": data.translation},
        )

        # Save Explanation
        Explanation.objects.create(
            phrase=phrase,
            language=lang,
            attribution=model,
            text=data.explanation,
        )

        self.stdout.write(f"✅ Explained phrase ({lang}): {zh}")

    def handle(self, *args, **options):
        lang = options["lang"]
        model = options["model"]
        language_name = LANGUAGE_NAMES.get(lang, lang)

        self.stdout.write(f"🌍 Target Language: {lang} ({language_name})")
        self.stdout.write(f"🤖 Using Model: {model}")

        if lang == "en":
            system_message = BASE_SYSTEM_MESSAGE.replace(
                "target language", language_name
            )
        else:
            system_message = self.translate_system_prompt(lang, language_name, model)
            self.stdout.write(
                f"🌐 Translated system prompt to {language_name}: {system_message}"
            )

        for hexagram in Hexagram.objects.all():
            self.process_phrase(hexagram.judgment_zh, lang, model, system_message)

        for line in Line.objects.all():
            self.process_phrase(line.text_zh, lang, model, system_message)

        self.stdout.write(self.style.SUCCESS("✅ All phrases processed."))
