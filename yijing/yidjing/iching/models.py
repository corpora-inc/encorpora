from django.db import models


class Hexagram(models.Model):
    number = models.PositiveIntegerField(unique=True)
    name_zh = models.CharField(max_length=20)
    name_en = models.CharField(max_length=64, blank=True)
    pinyin = models.CharField(max_length=20, blank=True)
    binary = models.CharField(
        max_length=6, help_text="Binary representation of the hexagram", unique=True
    )
    judgment_zh = models.TextField(help_text="Judgment in Chinese")
    judgment_en = models.TextField(help_text="Judgment in English", blank=True)
    judgment_es = models.TextField(help_text="Judgment in Spanish", blank=True)
    judgment_pinyin = models.TextField(help_text="Judgment in Pinyin", blank=True)

    def __str__(self):
        return f"{self.number} - {self.name_zh}"

    class Meta:
        ordering = ["number"]


class Line(models.Model):
    hexagram = models.ForeignKey(
        Hexagram, related_name="lines", on_delete=models.CASCADE
    )
    line_number = models.PositiveIntegerField(help_text="Line number, e.g., 1 for 初九")
    text_zh = models.TextField(help_text="Original Chinese text for the line")
    text_pinyin = models.TextField(help_text="Pinyin for the line", blank=True)
    text_en = models.TextField(help_text="English translation for the line", blank=True)
    text_es = models.TextField(help_text="Spanish translation for the line", blank=True)

    def __str__(self):
        return f"Hexagram {self.hexagram.number}, Line {self.line_number}"

    class Meta:
        ordering = ["hexagram", "line_number"]
        unique_together = ("hexagram", "line_number")


class Consultation(models.Model):
    primary_hexagram = models.ForeignKey(
        Hexagram, related_name="consultations_as_primary", on_delete=models.CASCADE
    )
    changing_hexagram = models.ForeignKey(
        Hexagram,
        related_name="consultations_as_transformed",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    compact_representation = models.CharField(
        max_length=6,
        help_text="Compact representation of the consultation, e.g., 678967",
    )

    def __str__(self):
        # return f"Consultation: {self.primary_hexagram} -> {self.changing_hexagram}"
        if self.changing_hexagram:
            return f"{self.primary_hexagram} -> {self.changing_hexagram}"
        return f"{self.primary_hexagram}"
