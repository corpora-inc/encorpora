from django.db import models


# Helper for consistent unique constraints
def UNIQUE_NAME_CONSTRAINT(model):
    return models.UniqueConstraint(fields=["name"], name=f"unique_{model}_name")


class HistoricalEntity(models.Model):
    """
    Abstract base model for historical entities.
    Note: Uniqueness of 'name' is enforced per concrete model, not globally,
    allowing e.g., 'Gettysburg' as both Place and Event.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)  # ~3 paragraphs
    courses = models.ManyToManyField("Course", related_name="%(class)s_set", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        abstract = True
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]


class Course(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]


class Theme(HistoricalEntity):
    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]
        constraints = [UNIQUE_NAME_CONSTRAINT("theme")]


class Period(HistoricalEntity):
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    themes = models.ManyToManyField(Theme, related_name="periods", blank=True)

    class Meta:
        ordering = ["start_date", "name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["start_date", "end_date"]),
        ]
        constraints = [
            UNIQUE_NAME_CONSTRAINT("period"),
            models.CheckConstraint(
                name="period_dates_valid",
                check=models.Q(start_date__lte=models.F("end_date"))
                | models.Q(end_date__isnull=True),
            ),
        ]


class Place(HistoricalEntity):
    periods = models.ManyToManyField(Period, related_name="places", blank=True)
    themes = models.ManyToManyField(Theme, related_name="places", blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]
        constraints = [UNIQUE_NAME_CONSTRAINT("place")]


class Person(HistoricalEntity):
    birth_date = models.DateField(null=True, blank=True)
    death_date = models.DateField(null=True, blank=True)
    places = models.ManyToManyField(Place, related_name="people", blank=True)
    periods = models.ManyToManyField(Period, related_name="people", blank=True)
    themes = models.ManyToManyField(Theme, related_name="people", blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["birth_date", "death_date"]),
        ]
        constraints = [
            UNIQUE_NAME_CONSTRAINT("person"),
            models.CheckConstraint(
                name="person_dates_valid",
                check=models.Q(birth_date__lte=models.F("death_date"))
                | models.Q(death_date__isnull=True),
            ),
        ]


class Event(HistoricalEntity):
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    places = models.ManyToManyField(Place, related_name="events", blank=True)
    people = models.ManyToManyField(Person, related_name="events", blank=True)
    periods = models.ManyToManyField(Period, related_name="events", blank=True)
    themes = models.ManyToManyField(Theme, related_name="events", blank=True)
    related_events = models.ManyToManyField("self", blank=True, symmetrical=True)

    class Meta:
        ordering = ["start_date", "name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["start_date", "end_date"]),
        ]
        constraints = [
            UNIQUE_NAME_CONSTRAINT("event"),
            models.CheckConstraint(
                name="event_dates_valid",
                check=models.Q(start_date__lte=models.F("end_date"))
                | models.Q(end_date__isnull=True),
            ),
        ]


class Document(HistoricalEntity):
    publication_date = models.DateField(null=True, blank=True)
    author = models.CharField(max_length=255, blank=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    events = models.ManyToManyField(Event, related_name="documents", blank=True)
    people = models.ManyToManyField(Person, related_name="documents", blank=True)
    places = models.ManyToManyField(Place, related_name="documents", blank=True)
    periods = models.ManyToManyField(Period, related_name="documents", blank=True)
    themes = models.ManyToManyField(Theme, related_name="documents", blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["publication_date"]),
        ]
        constraints = [UNIQUE_NAME_CONSTRAINT("document")]
