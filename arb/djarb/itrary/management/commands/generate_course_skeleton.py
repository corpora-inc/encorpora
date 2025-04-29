from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider

from itrary.models import Course, Unit, Lesson, Exercise
from itrary.agents import get_course_plan, get_unit_plan, get_lesson_plan


llm = load_llm_provider("xai")


class Command(BaseCommand):
    help = "Generate a course skeleton with units, lessons, and exercises"

    def add_arguments(self, parser):
        parser.add_argument(
            "course_name",
            type=str,
            help="Course name prompt (e.g., '3rd grade English Composition')",
        )

    def handle(self, *args, **options):
        course_name = options["course_name"]
        course, _ = Course.objects.get_or_create(name=course_name)
        course_plan = get_course_plan(course_name)
        course.summary = course_plan.summary
        course.save()

        for unit in course_plan.units:
            unit_obj, _ = Unit.objects.get_or_create(
                course=course, name=unit.name, number=unit.number
            )
            unit_plan = get_unit_plan(course_name, unit.name)
            unit_obj.summary = unit_plan.summary
            unit_obj.save()

            for lesson in unit_plan.lessons:
                lesson_obj, _ = Lesson.objects.get_or_create(
                    unit=unit_obj, name=lesson.name
                )
                lesson_plan = get_lesson_plan(course_name, unit.name, lesson.name)
                lesson_obj.summary = lesson_plan.summary
                lesson_obj.save()

                for exercise in lesson_plan.exercises:
                    Exercise.objects.get_or_create(
                        lesson=lesson_obj, name=exercise.name
                    )
