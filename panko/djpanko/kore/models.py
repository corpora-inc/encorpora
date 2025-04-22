from django.db import models


class Jamo(models.Model):
    """
    A single modern Korean jamo (initial, medial, or final component of a Hangul syllable).
    """

    INITIAL = "L"
    MEDIAL = "V"
    FINAL = "T"
    JAMO_TYPE_CHOICES = [
        (INITIAL, "Initial"),
        (MEDIAL, "Medial"),
        (FINAL, "Final"),
    ]

    char = models.CharField(
        max_length=1,
        unique=True,
        help_text="The single-character jamo, e.g. 'ㄱ', 'ㅏ'.",
    )
    unicode_codepoint = models.CharField(
        max_length=10,
        help_text="Unicode codepoint, e.g. 'U+1100'.",
    )
    jamo_type = models.CharField(
        max_length=1,
        choices=JAMO_TYPE_CHOICES,
        help_text="Type of jamo: Initial (L), Medial (V), or Final (T).",
    )

    class Meta:
        verbose_name = "Jamo"
        verbose_name_plural = "Jamo"
        ordering = ["jamo_type", "unicode_codepoint"]

    def __str__(self) -> str:
        return f"{self.char} ({self.get_jamo_type_display()})"


class HangulSyllable(models.Model):
    """
    A composed Hangul syllable and its decomposed jamo components.
    """

    syllable = models.CharField(
        max_length=1,
        unique=True,
        help_text="The composed syllable character, e.g. '가'.",
    )
    codepoint = models.CharField(
        max_length=10,
        help_text="Unicode codepoint for the syllable, e.g. 'U+AC00'.",
    )
    initial = models.ForeignKey(
        Jamo,
        on_delete=models.PROTECT,
        related_name="initial_syllables",
        limit_choices_to={"jamo_type": Jamo.INITIAL},
        help_text="Initial jamo component.",
    )
    medial = models.ForeignKey(
        Jamo,
        on_delete=models.PROTECT,
        related_name="medial_syllables",
        limit_choices_to={"jamo_type": Jamo.MEDIAL},
        help_text="Medial jamo component.",
    )
    final = models.ForeignKey(
        Jamo,
        on_delete=models.PROTECT,
        related_name="final_syllables",
        limit_choices_to={"jamo_type": Jamo.FINAL},
        null=True,
        blank=True,
        help_text="Final jamo component (optional).",
    )

    class Meta:
        verbose_name = "Hangul Syllable"
        verbose_name_plural = "Hangul Syllables"
        ordering = ["codepoint"]

    def __str__(self) -> str:
        return self.syllable


class Word(models.Model):
    """
    A Korean word or lexeme.
    """

    text_korean = models.CharField(
        max_length=100,
        unique=True,
        help_text="The headword in Korean script.",
    )
    romanization = models.CharField(
        max_length=100,
        help_text="Revised Romanization of the word.",
    )
    pronunciation = models.CharField(
        max_length=100,
        blank=True,
        help_text="Pronunciation guide (e.g. IPA).",
    )
    noun = "N"
    verb = "V"
    adjective = "ADJ"
    adverb = "ADV"
    particle = "P"
    pos_choices = [
        (noun, "Noun"),
        (verb, "Verb"),
        (adjective, "Adjective"),
        (adverb, "Adverb"),
        (particle, "Particle"),
    ]
    part_of_speech = models.CharField(
        max_length=5,
        choices=pos_choices,
        help_text="Part of speech.",
    )
    frequency_rank = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Frequency rank in a reference corpus (1 = most frequent).",
    )

    class Meta:
        verbose_name = "Word"
        verbose_name_plural = "Words"
        ordering = ["frequency_rank", "text_korean"]
        indexes = [
            models.Index(fields=["text_korean"]),
            models.Index(fields=["frequency_rank"]),
        ]

    def __str__(self) -> str:
        return self.text_korean


class Definition(models.Model):
    """
    A definition or translation for a Word in a given language.
    """

    word = models.ForeignKey(
        Word,
        on_delete=models.CASCADE,
        related_name="definitions",
        help_text="The word this definition belongs to.",
    )
    language = models.CharField(
        max_length=2,
        choices=[("en", "English"), ("ko", "Korean")],
        help_text="Definition language.",
    )
    text = models.TextField(
        help_text="The definition text.",
    )

    class Meta:
        verbose_name = "Definition"
        verbose_name_plural = "Definitions"
        ordering = ["language"]
        unique_together = [["word", "language", "text"]]

    def __str__(self) -> str:
        return f"{self.word.text_korean} [{self.language}]: {self.text[:50]}"


class Sentence(models.Model):
    """
    A bilingual example sentence with links to vocabulary words.
    """

    text_korean = models.TextField(
        help_text="Example sentence in Korean.",
    )
    text_english = models.TextField(
        help_text="English translation of the sentence.",
    )
    words = models.ManyToManyField(
        Word,
        blank=True,
        related_name="sentences",
        help_text="Vocabulary words appearing in this sentence.",
    )

    class Meta:
        verbose_name = "Sentence"
        verbose_name_plural = "Sentences"
        ordering = [models.F("id").asc()]

    def __str__(self) -> str:
        return self.text_korean[:50] + ("..." if len(self.text_korean) > 50 else "")
