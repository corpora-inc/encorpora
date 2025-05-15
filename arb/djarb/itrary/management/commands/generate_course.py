from django.core.management.base import BaseCommand

from itrary.models import Course, Unit, Lesson, Exercise
from itrary.agents import (
    # get_course_plan,
    get_course_outline,
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
        self.stdout.write(f"Generating course: {course_title}\n")
        course_outline = get_course_outline(config=config)

        self.stdout.write("Writing course outline...\n")
        for unit in course_outline.units:
            unit_obj, _ = Unit.objects.get_or_create(
                course=course,
                name=unit.name,
                number=unit.number,
            )
            unit_obj.summary = unit.summary
            unit_obj.save()
            self.stdout.write(f"Wrote unit: {unit_obj.name}\n")

            for lesson in unit.lessons:
                lesson_obj, _ = Lesson.objects.get_or_create(
                    unit=unit_obj,
                    name=lesson.name,
                    number=lesson.number,
                )
                lesson_obj.summary = lesson.summary
                lesson_obj.save()
                self.stdout.write(f"\tWrote lesson: {lesson_obj.name}\n")

                for exercise in lesson.exercises:
                    exercise_obj, _ = Exercise.objects.get_or_create(
                        lesson=lesson_obj,
                        name=exercise.name,
                    )
                    self.stdout.write(f"\t\tWrote exercise: {exercise_obj.name}\n")

        self.stdout.write("Generating unit content...\n")
        units = Unit.objects.filter(course=course)
        for unit in units:
            unit_markdown = get_unit(
                unit_name=unit.name,
                course_outline=course_outline,
                config=config,
            )

            unit.rewrite_full_markdown(unit_markdown)
