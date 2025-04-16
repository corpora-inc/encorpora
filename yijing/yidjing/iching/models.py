from django.db import models


class Hexagram(models.Model):
    number = models.PositiveIntegerField(unique=True)
    name_zh = models.CharField(max_length=20)
    name_en = models.CharField(max_length=64, blank=True)
    name_es = models.CharField(max_length=64, blank=True)
    name_pinyin = models.CharField(max_length=20, blank=True)
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
    compact_representation = models.CharField(
        max_length=6,
        unique=True,
        help_text="Compact representation of the consultation, e.g., 678967",
    )

    def __str__(self):
        return self.compact_representation

    def get_primary_hexagram(self):
        """
        Return the primary hexagram for this consultation.
        """
        binary = ""
        for line in self.compact_representation:
            if line == "6" or line == "8":
                binary += "0"
            elif line == "7" or line == "9":
                binary += "1"
        return Hexagram.objects.get(binary=binary)

    def get_secondary_hexagram(self):
        """
        Return the secondary hexagram for this consultation.
        """
        binary = ""
        if (
            "6" not in self.compact_representation
            and "9" not in self.compact_representation
        ):
            return None
        for line in self.compact_representation:
            if line == "6" or line == "7":
                binary += "1"
            elif line == "8" or line == "9":
                binary += "0"
        return Hexagram.objects.get(binary=binary)

    def get_changing_lines(self):
        if (
            "6" not in self.compact_representation
            and "9" not in self.compact_representation
        ):
            return []
        changing_lines = []
        for i, line in enumerate(self.compact_representation):
            if line == "6" or line == "9":
                changing_lines.append(int(i) + 1)
        # print(f"Changing lines: {changing_lines}")
        return self.get_primary_hexagram().lines.filter(line_number__in=changing_lines)

    def get_text(self, language):
        """
        Return the text for this consultation in the specified language.
        """
        primary = self.get_primary_hexagram()
        secondary = self.get_secondary_hexagram()
        changing_lines = self.get_changing_lines()

        resp = [
            f"Hexagram {primary.number}",
            getattr(primary, f"name_{language}"),
            getattr(primary, f"judgment_{language}"),
        ]
        if secondary:
            resp.append(f"Changing lines: {changing_lines}")
            resp.extend([getattr(line, f"text_{language}") for line in changing_lines])
            resp.append(f"Changing to Hexagram {secondary.number}")
            resp.append(getattr(secondary, f"judgment_{language}"))
        return resp


class ConsultationInterpretation(models.Model):
    consultation = models.ForeignKey(
        Consultation, related_name="interpretations", on_delete=models.CASCADE
    )
    text = models.TextField(
        help_text="Interpretation text for the consultation",
    )
    attribution = models.CharField(
        max_length=255,
        blank=True,
        help_text="Attribution for the interpretation",
    )

    def __str__(self):
        return f"{self.consultation} - {self.attribution}"


class Character(models.Model):
    character = models.CharField(max_length=1, unique=True)
    pinyin = models.CharField(max_length=10, blank=True)
    etymology = models.TextField(
        blank=True, help_text="Full historical breakdown in English"
    )

    class Meta:
        ordering = ["character"]

    def __str__(self):
        return self.character


class Phrase(models.Model):
    """
    A chinese phrase.
    """

    phrase = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["phrase"]

    def __str__(self):
        return self.phrase

    def best_translation(self, language):
        """
        Return the best translation for the given language.
        """
        return self.translations.filter(language=language).first()


class Explanation(models.Model):
    """
    A detailed explanation of a phrase.
    """

    phrase = models.ForeignKey(
        Phrase,
        related_name="explanations",
        on_delete=models.CASCADE,
    )
    language = models.CharField(max_length=2)
    text = models.TextField()
    attribution = models.CharField(
        max_length=255, blank=True, help_text="Attribution for the explanation"
    )

    class Meta:
        ordering = ["phrase", "language"]
        unique_together = ("phrase", "language", "attribution")

    def __str__(self):
        return f"{self.phrase} ({self.language})"


STYLES = (
    ("ancient", "Ancient"),
    ("wilhelm", "Wilhelm"),
    # ("modern", "Modern"),
    # ("poetic", "Poetic"),
    # ("interpretive", "Interpretive"),
)


class Translation(models.Model):
    """
    A translation of a phrase.
    """

    phrase = models.ForeignKey(
        Phrase,
        related_name="translations",
        on_delete=models.CASCADE,
    )
    language = models.CharField(max_length=2)
    style = models.CharField(max_length=10, choices=STYLES, default="ancient")
    attribution = models.CharField(
        max_length=255, blank=True, help_text="Attribution for the translation"
    )
    translation = models.TextField()
    score = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["phrase", "language", "-score"]
        unique_together = ("phrase", "language", "style", "attribution")

    def __str__(self):
        return f"{self.phrase} ({self.language})"
