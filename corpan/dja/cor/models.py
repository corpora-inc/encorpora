import uuid

from django.db import models
from django.db.models import Q


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
    romanization = models.TextField(
        blank=True,
        default="",
        help_text="optional transliteration (e.g. pīnyīn for 中文)",
    )

    class Meta:
        unique_together = [("entry", "language")]

    def __str__(self):
        if self.romanization:
            return f"[{self.language.code}] {self.text} ({self.romanization})"
        return f"[{self.language.code}] {self.text}"


class Narrator(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    language = models.ForeignKey("Language", on_delete=models.PROTECT)
    description_pack = models.ForeignKey(
        "Pack",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="narrator_descriptions",
        help_text="Pack whose entries describe this narrator. Blank title = internal use only.",
    )

    def __str__(self):
        return self.name

    def description_text(self, language):
        """Return description text in the requested language, joined as paragraphs."""
        if not self.description_pack:
            return ""
        return self.description_pack.get_full_text(language)


class Pack(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, blank=True)
    narrator = models.ForeignKey(
        Narrator, on_delete=models.PROTECT, null=True, blank=True, related_name="packs"
    )
    description_pack = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="describes_packs",
        help_text="Optional pack whose entries form a translatable description for this pack.",
    )

    def __str__(self):
        return self.title or f"Pack {self.id}"

    # --- Helper methods ---

    @property
    def is_public(self):
        """Public packs have a title."""
        return bool(self.title.strip())

    @classmethod
    def public(cls):
        """Queryset of all packs with titles."""
        return cls.objects.filter(~Q(title=""), ~Q(title=None))

    def get_full_text(self, language):
        """Return concatenated text of all entries in this pack in the given language."""
        texts = []
        for pe in self.entries.select_related("entry"):
            if translation := pe.entry.translations.filter(language=language).first():
                texts.append(translation.text)
            else:
                texts.append(pe.entry.en_text)  # fallback to English
        return " ".join(texts)

    @classmethod
    def create_from_text(
        cls, text, language, narrator=None, title="", llm_provider="openai"
    ):
        """
        Create a pack by splitting description into sentences (naive split on '.').
        Each sentence becomes an Entry + PackEntry in order.
        """
        from cor.packs.service import create_pack_from_text

        # TODO: maybe we don't even need this classmethod wrapper?
        return create_pack_from_text(
            text=text,
            source_lang_code=language.code,
            title=title,
            narrator=narrator,
            # llm_provider=llm_provider,
            # default_level="A1",
            # batch_size=2
        )


class PackEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pack = models.ForeignKey(Pack, on_delete=models.CASCADE, related_name="entries")
    entry = models.ForeignKey("Entry", on_delete=models.CASCADE, related_name="packs")
    order = models.PositiveIntegerField()

    class Meta:
        unique_together = [("pack", "order")]
        ordering = ["order"]

    def __str__(self):
        return f"{self.pack.title or 'internal'} [{self.order}] – {self.entry.en_text[:50]}"
