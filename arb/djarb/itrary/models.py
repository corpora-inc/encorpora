from django.db import models


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

    def __str__(self):
        return self.name


class Lesson(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="lessons")
    name = models.CharField(max_length=255)
    number = models.FloatField(null=True, blank=True)
    summary = models.TextField(blank=True)
    markdown = models.TextField(blank=True)
    study_markdown = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Exercise(models.Model):
    lesson = models.ForeignKey(
        Lesson, on_delete=models.CASCADE, related_name="exercises"
    )
    name = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    markdown = models.TextField(blank=True)

    def __str__(self):
        return self.name
