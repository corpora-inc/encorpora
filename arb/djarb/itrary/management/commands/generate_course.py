from django.core.management.base import BaseCommand

from itrary.models import Course, Unit
from itrary.agents import (
    get_course_plan,
    get_unit,
)
from itrary.utils import load_book_config  # Utility to load YAML (to be defined)


class Command(BaseCommand):
    help = "Generate a course skeleton with units, lessons, and exercises for a book"

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
        course, _ = Course.objects.get_or_create(name=course_title)
        course_plan = get_course_plan(config=config)
        course.summary = course_plan.summary
        course.save()

        self.stdout.write(f"Course: {course_title}\n")
        self.stdout.write(f"Summary: {course.summary}\n")

        self.stdout.write("Generating units...\n")
        # create all units
        for unit in course_plan.units:
            unit_obj, _ = Unit.objects.get_or_create(
                course=course,
                name=unit.name,
                number=unit.number,
            )
            self.stdout.write(f"Unit: {unit_obj.name}\n")

        self.stdout.write("Generating unit content...\n")
        for unit in course.units.all():
            unit: Unit
            self.stdout.write(f"Unit: {unit.name}\n")
            unit_md = get_unit(unit_obj, config=config)
            self.stdout.write(
                f"Unit Markdown: {[less.name for less in unit_md.lessons]}\n"
            )
            unit.create_full_markdown(unit_md)

        self.stdout.write("Course generation complete.\n")
