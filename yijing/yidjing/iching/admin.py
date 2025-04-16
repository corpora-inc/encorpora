from django.contrib import admin
from .models import (
    Hexagram,
    Line,
    Consultation,
    Character,
    Phrase,
    Translation,
    ConsultationInterpretation,
    Explanation,
)


@admin.register(Explanation)
class ExplanationAdmin(admin.ModelAdmin):
    list_display = ("phrase", "language", "attribution")
    search_fields = ("phrase__phrase", "language", "attribution")
    list_filter = ("language",)
    autocomplete_fields = ("phrase",)


@admin.register(ConsultationInterpretation)
class ConsultationInterpretationAdmin(admin.ModelAdmin):
    list_display = ("consultation", "attribution")
    search_fields = ("consultation__compact_representation", "attribution")


@admin.register(Translation)
class Translation(admin.ModelAdmin):
    list_display = ("phrase", "translation", "language", "style", "attribution")
    autocomplete_fields = ("phrase",)
    search_fields = ("phrase__phrase", "translation")


@admin.register(Phrase)
class PhraseAdmin(admin.ModelAdmin):
    list_display = ("phrase",)
    search_fields = ("phrase",)


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ("character", "pinyin", "etymology")
    search_fields = ("character", "pinyin", "etymology")


class LineInline(admin.TabularInline):
    model = Line
    extra = 6  # provide 6 inlines by default


@admin.register(Hexagram)
class HexagramAdmin(admin.ModelAdmin):
    list_display = ("number", "name_zh", "name_pinyin")
    search_fields = (
        "name_zh",
        "name_pinyin",
        "name_en",
        "judgment_zh",
        "judgment_en",
        "judgment_pinyin",
        "judgment_es",
        "lines__text_zh",
        "lines__text_en",
        "lines__text_pinyin",
        "lines__text_es",
    )
    inlines = [LineInline]


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ("compact_representation",)
