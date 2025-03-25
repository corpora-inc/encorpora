from django.contrib import admin
from .models import Hexagram, Line, Consultation, Character, Phrase, Translation


@admin.register(Translation)
class Translation(admin.ModelAdmin):
    list_display = ("phrase", "translation")


@admin.register(Phrase)
class PhraseAdmin(admin.ModelAdmin):
    list_display = ("phrase",)


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ("character", "pinyin", "etymology")


class LineInline(admin.TabularInline):
    model = Line
    extra = 6  # provide 6 inlines by default


@admin.register(Hexagram)
class HexagramAdmin(admin.ModelAdmin):
    list_display = ("number", "name_zh", "pinyin")
    inlines = [LineInline]


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ("primary_hexagram", "changing_hexagram")
