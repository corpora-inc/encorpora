"""
Generate unit intros for a course using an LLM.
"""

from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider
from itrary.models import Course, Unit
from itrary.agents import (
    UnitIntroResponse,
    get_unit_intro,
)
from itrary.utils import load_book_config  # Utility to load YAML (to be defined)

openai = load_llm_provider("openai")


class Command(BaseCommand):
    help = "Add unit content to a course using an LLM"

    def add_arguments(self, parser):
        parser.add_argument(
            "--config",
            type=str,
            default=None,
            help="Path to config YAML (e.g., 'book-input/georgia-state-history/config.yaml')",
        )

    def handle(self, *args, **options):
        config = load_book_config(options["config"])
        course_title = config.title
        course = Course.objects.get(name=course_title)
        self.stdout.write(f"Working course: {course_title}\n")

        for unit in course.units.all():
            self.stdout.write(f"Adding intro to unit: {unit.name}\n")
            unit: Unit

            response: UnitIntroResponse = get_unit_intro(
                unit,
                config=config,
                llm=openai,
            )

            unit.intro_markdown = response.intro_markdown
            unit.save()

        self.stdout.write("\nUnit intros added successfully.\n")
