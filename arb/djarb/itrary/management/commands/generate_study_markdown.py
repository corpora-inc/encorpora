"""
The Complete, Unabridged Versions can be brutally long.
So, we will generate just the minimal facts for quick test preparation.
"""

from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider

from itrary.models import Course, Lesson
from itrary.agents import (
    LessonContentRequest,
    get_study_content,
)


llm = load_llm_provider("xai")


class Command(BaseCommand):
    help = "Generate the study markdown for every lesson in a course"

    def add_arguments(self, parser):
        parser.add_argument(
            "course_name",
            type=str,
            help="Course name prompt (e.g., '3rd grade English Composition')",
        )

    def handle(self, *args, **options):
        course_name = options["course_name"]
        course, _ = Course.objects.get_or_create(name=course_name)
        lessons = Lesson.objects.filter(
            unit__course=course,
        ).prefetch_related("unit")

        for lesson in lessons:
            if not lesson.study_markdown:
                self.stdout.write(f"Lesson: {lesson.name}\n")
                lesson_content = get_study_content(
                    LessonContentRequest(
                        course_name=course_name,
                        unit_name=lesson.unit.name,
                        lesson_name=lesson.name,
                        lesson_summary=lesson.summary,
                        # TODO: won't work - ;/
                        # maybe make a different request for the study markdown
                        # or just delete this file.
                        lessons=lessons,
                    )
                )
                self.stdout.write(f"Lesson:\n\n{lesson_content.markdown[:100]}\n")
                lesson.study_markdown = lesson_content.markdown
                lesson.save()
            else:
                self.stdout.write(f"Skipping lesson content: {lesson.name}\n")
