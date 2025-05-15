from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider

from itrary.models import Course, Unit
from itrary.agents import (
    edit_unit,
)
from itrary.utils import load_book_config

llm = load_llm_provider("openai")

INSTRUCTIONS = """
You number 1 job is to **Remove excessive duplication from the unit.**
Make a cohesive arc where the lessons are connected but facts and stories are not repeated.
Where you find excessive duplication, you have options:

- You can make lessons a bit more concise by removing duplication.
- You can replace duplicate facts with different facts.
- You can replace duplicate facts with related facts that delve deeper into the topic.

Do not lose any of the facts or stories.
Do not lose the scholarly debates or the fun facts.
Do not change the order of the lessons.
Do not lose the depth or the quirkiness of the original material.
Maintain the same tone and style.
Keep the exact image captions for existing images.

Add definitions for terms that are not defined in the text.
You may add markdown features like bold and italics to make key points stand out.
You may put some paragraphs in block quotes where appropriate as asides.
You may add additional images `{{IMAGE: publication caption}}` to make the material more engaging.

Return the same unit with these specific improvements.
"""

INSTRUCTIONS = """
Keep everything exactly the same except for the following:

- Expand on the disparate facts and stories as much as you can to make the lessons more cohesive.
- The lesson should never devolve into a laundry list of random facts. Tie the lesson together or reorganize if it doesn't flow.
- Blockquotes should not be consecutive, they should be interspersed logically with the text.

Keep everything close to the original, even returning the exact same markdown, if nothing needs to be changed.

Do not change the image captions.

You are making a final editorial pass to make to book publication-quality with subtle improvements.
"""


class Command(BaseCommand):
    help = "Edit a course unit by unit"

    def add_arguments(self, parser):
        parser.add_argument(
            "--config",
            type=str,
            required=True,
            help="Path to book config YAML (e.g., 'book-input/georgia-state-history/config.yaml')",
        )
        parser.add_argument(
            "--instructions",
            type=str,
            default=INSTRUCTIONS,
            help="Instructions for the LLM to generate study markdown",
        )

    def handle(self, *args, **options):
        config_path = options["config"]
        instructions = options["instructions"]
        config = load_book_config(config_path)
        course = Course.objects.get(name=config.title)

        for unit in course.units.all():
            unit: Unit
            edit_unit(unit.name, instructions, config=config, llm=llm)
            self.stdout.write(f"Edited unit: {unit.name}\n")

        self.stdout.write("All units edited successfully.\n")
