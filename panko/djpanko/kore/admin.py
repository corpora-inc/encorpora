from django.contrib import admin

from kore.models import (
    Word,
    Definition,
    Sentence,
    HangulSyllable,
    Jamo,
)


@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    list_display = ("text_korean", "frequency_rank")
    search_fields = ("text_korean",)
    list_filter = ("frequency_rank",)
    ordering = ("frequency_rank",)
    list_per_page = 20
    list_select_related = True
    autocomplete_fields = ("sentences",)


@admin.register(Definition)
class DefinitionAdmin(admin.ModelAdmin):
    list_display = ("word", "language", "text")
    search_fields = ("word__text_korean", "text")
    list_filter = ("language",)
    ordering = ("word__text_korean",)
    list_per_page = 20
    list_select_related = ("word",)
    autocomplete_fields = ("word",)


@admin.register(Sentence)
class SentenceAdmin(admin.ModelAdmin):
    list_display = ("text_korean", "text_english")
    search_fields = ("text_korean", "text_english")
    ordering = ("id",)
    list_per_page = 20
    list_select_related = True
    autocomplete_fields = ("words",)


@admin.register(HangulSyllable)
class HangulSyllableAdmin(admin.ModelAdmin):
    list_display = ("syllable", "codepoint", "initial", "medial", "final")
    search_fields = ("syllable",)
    ordering = ("syllable",)
    list_per_page = 20
    list_select_related = True
    autocomplete_fields = ("initial", "medial", "final")


@admin.register(Jamo)
class JamoAdmin(admin.ModelAdmin):
    list_display = ("char", "unicode_codepoint", "jamo_type")
    search_fields = ("char",)
    ordering = ("char",)
    list_per_page = 20
    list_select_related = True
