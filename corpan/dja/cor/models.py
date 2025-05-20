from django.db import models


class Language(models.Model):
    code = models.CharField(max_length=10, unique=True)  # e.g., 'es', 'ko', 'ko-polite'
    name = models.CharField(max_length=100)  # e.g., 'Spanish', 'Korean'

    def __str__(self):
        return self.name


class Domain(models.Model):
    code = models.CharField(max_length=20, unique=True)  # e.g., 'travel', 'business'
    name = models.CharField(max_length=100)  # e.g., 'Travel'
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


CEFR_LEVELS = [
    ("A1", "A1"),
    ("A2", "A2"),
    ("B1", "B1"),
    ("B2", "B2"),
    ("C1", "C1"),
    ("C2", "C2"),
]


class Entry(models.Model):
    en_text = models.TextField(unique=True)
    level = models.CharField(max_length=3, choices=CEFR_LEVELS)
    domains = models.ManyToManyField(Domain, related_name="entries")

    def __str__(self):
        return self.en_text


class Translation(models.Model):
    entry = models.ForeignKey(
        Entry, on_delete=models.CASCADE, related_name="translations"
    )
    language = models.ForeignKey(Language, on_delete=models.CASCADE)
    text = models.TextField()

    class Meta:
        unique_together = [("entry", "language")]

    def __str__(self):
        return f"[{self.language.code}] {self.text}"
