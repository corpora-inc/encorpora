from django.db import models

from pydantic import BaseModel
from typing import List


class ExercisePydanticModel(BaseModel):
    name: str
    markdown: str


class LessonMarkdownModel(BaseModel):
    name: str
    markdown: str
    exercises: List[ExercisePydanticModel]


class UnitMarkdownModel(BaseModel):
    name: str
    lessons: List[LessonMarkdownModel]


class NewExerciseMarkdownModel(BaseModel):
    name: str
    markdown: str


class NewLessonMarkdownModel(BaseModel):
    name: str
    markdown: str
    number: float
    exercises: List[NewExerciseMarkdownModel]


class NewUnitMarkdownModel(BaseModel):
    name: str
    lessons: List[NewLessonMarkdownModel]


class Course(models.Model):
    name = models.CharField(max_length=255)
    summary = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Unit(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="units")
    name = models.CharField(max_length=255)
    number = models.FloatField(null=True, blank=True)
    summary = models.TextField(blank=True)

    class Meta:
        unique_together = ("course", "name")
        ordering = ["number"]

    def __str__(self):
        return self.name

    def get_full_markdown(self) -> UnitMarkdownModel:
        lessons = []
        for lesson in self.lessons.all():
            lesson: Lesson
            lesson_data = LessonMarkdownModel(
                name=lesson.name,
                markdown=lesson.markdown,
                exercises=[
                    ExercisePydanticModel(
                        name=exercise.name,
                        markdown=exercise.markdown,
                    )
                    for exercise in lesson.exercises.all()
                ],
            )
            lessons.append(lesson_data)
        return UnitMarkdownModel(name=self.name, lessons=lessons)

    def rewrite_full_markdown(self, unit: NewUnitMarkdownModel) -> None:
        for lesson in unit.lessons:
            lesson_obj = Lesson.objects.get(unit=self, name=lesson.name)
            lesson_obj.markdown = lesson.markdown
            lesson_obj.save()
            for exercise in lesson.exercises:
                exercise_obj, _ = Exercise.objects.get_or_create(
                    lesson=lesson_obj,
                    name=exercise.name,
                )
                exercise_obj.markdown = exercise.markdown
                exercise_obj.save()

    def create_full_markdown(self, unit: NewUnitMarkdownModel) -> None:
        for lesson_data in unit.lessons:
            lesson = Lesson.objects.create(
                unit=self,
                name=lesson_data.name,
                number=lesson_data.number,
                markdown=lesson_data.markdown,
            )
            for exercise_data in lesson_data.exercises:
                Exercise.objects.create(
                    lesson=lesson,
                    name=exercise_data.name,
                    markdown=exercise_data.markdown,
                )


class Lesson(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="lessons")
    name = models.CharField(max_length=255)
    number = models.FloatField(null=True, blank=True)
    summary = models.TextField(blank=True)
    markdown = models.TextField(blank=True)
    study_markdown = models.TextField(blank=True)

    class Meta:
        unique_together = ("unit", "name")
        ordering = ["number"]

    def __str__(self):
        return self.name


class Exercise(models.Model):
    lesson = models.ForeignKey(
        Lesson, on_delete=models.CASCADE, related_name="exercises"
    )
    name = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    markdown = models.TextField(blank=True)

    class Meta:
        unique_together = ("lesson", "name")

    def __str__(self):
        return self.name
