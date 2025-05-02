from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider

from itrary.models import Course, Unit, Lesson, Exercise
from itrary.agents import (
    ExerciseContentRequest,
    LessonContentRequest,
    get_course_plan,
    get_unit_plan,
    get_lesson_plan,
    get_lesson_content,
    get_exercise_content,
)


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

            self.stdout.write(f"Unit: {unit_obj.name}\n")
            self.stdout.write(f"Summary: {unit_obj.summary}\n")

            for i, lesson in enumerate(unit_plan.lessons):
                lesson_obj, _ = Lesson.objects.get_or_create(
                    unit=unit_obj,
                    name=lesson.name,
                )
                lesson_obj.number = i
                lesson_obj.save()

                if not lesson_obj.summary:
                    self.stdout.write(f"Lesson: {lesson_obj.name}\n")
                    lesson_plan = get_lesson_plan(course_name, unit.name, lesson.name)
                    lesson_obj.summary = lesson_plan.summary
                    self.stdout.write(f"Summary: {lesson_obj.summary}\n")
                    lesson_obj.save()
                else:
                    self.stdout.write(f"Skipping lesson: {lesson_obj.name}\n")

                if not lesson_obj.markdown:
                    self.stdout.write(f"Lesson content: {lesson_obj.name}\n")
                    lesson_content = get_lesson_content(
                        LessonContentRequest(
                            course_name=course_name,
                            unit_name=unit.name,
                            lesson_name=lesson.name,
                            lesson_summary=lesson_obj.summary,
                        )
                    )
                    lesson_obj.markdown = lesson_content.markdown
                    lesson_obj.save()
                else:
                    self.stdout.write(f"Skipping lesson content: {lesson_obj.name}\n")

                for exercise in lesson_plan.exercises:
                    self.stdout.write(f"Exercise: {exercise.name}\n")
                    ex, _ = Exercise.objects.get_or_create(
                        lesson=lesson_obj,
                        name=exercise.name,
                    )
                    if not (ex.summary and ex.markdown):
                        self.stdout.write(f"Exercise content: {exercise.name}\n")
                        exercise_content = get_exercise_content(
                            ExerciseContentRequest(
                                course_name=course_name,
                                unit_name=unit.name,
                                lesson_name=lesson.name,
                                exercise_name=exercise.name,
                            )
                        )
                        self.stdout.write(
                            f"Exercise:\n\n{exercise_content.summary[:100]}\n\n{exercise_content.markdown[:100]}\n"
                        )
                        ex.summary = exercise_content.summary
                        ex.markdown = exercise_content.markdown
                        ex.save()
                    else:
                        self.stdout.write(
                            "Skipping exercise content:\n\n"
                            f"{ex.name}\n\n{ex.summary[:100]}\n\n{ex.markdown[:100]}\n"
                        )
