from django.core.management.base import BaseCommand

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

        # Set course title from config if available, fallback to course_name
        course_title = config.title

        # Create or update course
        course, _ = Course.objects.get_or_create(name=course_title)
        course_plan = get_course_plan(config=config)
        course.summary = course_plan.summary
        course.save()

        self.stdout.write(f"Course: {course_title}\n")
        self.stdout.write(f"Summary: {course.summary}\n")

        for unit in course_plan.units:
            unit_obj, _ = Unit.objects.get_or_create(
                course=course,
                name=unit.name,
                number=unit.number,
            )
            unit_plan = get_unit_plan(unit.name, config=config)
            unit_obj.summary = unit_plan.summary
            unit_obj.save()

            self.stdout.write(f"Unit: {unit_obj.name}\n")
            self.stdout.write(f"Summary: {unit_obj.summary}\n")

            for lesson in unit_plan.lessons:
                lesson_obj, _ = Lesson.objects.get_or_create(
                    unit=unit_obj,
                    name=lesson.name,
                )
                lesson_obj.number = lesson.number
                lesson_obj.save()

                self.stdout.write(f"Lesson: {lesson_obj.name}\n")
                lesson_plan = get_lesson_plan(unit.name, lesson.name, config=config)

                if not lesson_obj.summary:
                    lesson_obj.summary = lesson_plan.summary
                    self.stdout.write(f"Summary: {lesson_obj.summary}\n")
                    lesson_obj.save()
                else:
                    self.stdout.write(f"Skipping lesson summary: {lesson_obj.name}\n")

                if not lesson_obj.markdown:
                    self.stdout.write(f"Lesson content: {lesson_obj.name}\n")
                    lesson_content = get_lesson_content(
                        LessonContentRequest(
                            course_name=config.title,
                            unit_name=unit.name,
                            lesson_name=lesson.name,
                            lesson_summary=lesson_obj.summary,
                        ),
                        config=config,
                    )
                    lesson_obj.markdown = lesson_content.markdown
                    lesson_obj.save()
                    self.stdout.write(f"Generated lesson content: {lesson_obj.name}\n")
                else:
                    self.stdout.write(f"Skipping lesson content: {lesson_obj.name}\n")

                for exercise in lesson_plan.exercises:
                    self.stdout.write(f"Exercise: {exercise.name}\n")
                    ex, _ = Exercise.objects.get_or_create(
                        lesson=lesson_obj,
                        name=exercise.name,
                    )
                    if not ex.summary or not ex.markdown:
                        self.stdout.write(f"Exercise content: {exercise.name}\n")
                        exercise_content = get_exercise_content(
                            ExerciseContentRequest(
                                course_name=config.title,
                                unit_name=unit.name,
                                lesson_name=lesson.name,
                                exercise_name=exercise.name,
                            ),
                            config=config,
                        )
                        self.stdout.write(
                            f"Exercise:\n{exercise_content.summary[:10]}\n{exercise_content.markdown[:10]}\n\n"
                        )
                        ex.summary = exercise_content.summary
                        ex.markdown = exercise_content.markdown
                        ex.save()
                    else:
                        self.stdout.write(
                            f"Skipping exercise content:\n{ex.name}\n{ex.summary[:100]}\n{ex.markdown[:100]}\n\n"
                        )
