from django.db import models


class Course(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]


class Period(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    course = models.ForeignKey(
        Course,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="periods",
    )

    class Meta:
        unique_together = ("name", "course")
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["start_date", "end_date"]),
        ]
        ordering = ["start_date", "name"]


class Theme(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    course = models.ForeignKey(
        Course,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="themes",
    )

    class Meta:
        unique_together = ("name", "course")

    def __str__(self):
        return self.name


class Who(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Birth date",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Death date",
    )
    course = models.ForeignKey(
        Course,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="whos",
    )

    class Meta:
        unique_together = ("name", "course")

    def __str__(self):
        return self.name


class When(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    course = models.ForeignKey(
        Course,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="whens",
    )

    class Meta:
        unique_together = ("name", "course")

    def __str__(self):
        return self.name
