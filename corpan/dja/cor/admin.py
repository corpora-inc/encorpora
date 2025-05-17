from django.contrib import admin
from .models import Language, Domain, Entry, Translation


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "description")
    search_fields = ("code", "name", "description")
    ordering = ("code",)


class TranslationInline(admin.TabularInline):
    model = Translation
    extra = 0
    fields = ("language", "text")
    readonly_fields = ("language",)
    show_change_link = True


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ("short_en_text", "level", "domain_count", "translation_count")
    search_fields = ("en_text",)
    list_filter = ("level", "domains")
    ordering = ("level",)
    inlines = [TranslationInline]
    filter_horizontal = ("domains",)

    def short_en_text(self, obj):
        return obj.en_text[:60] + ("…" if len(obj.en_text) > 60 else "")

    short_en_text.short_description = "English Text"

    def domain_count(self, obj):
        return obj.domains.count()

    domain_count.short_description = "Domains"

    def translation_count(self, obj):
        return obj.translations.count()

    translation_count.short_description = "Translations"


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ("entry_summary", "language", "short_text")
    search_fields = ("text", "entry__en_text")
    list_filter = ("language",)
    ordering = ("language",)
    autocomplete_fields = ("entry",)

    def entry_summary(self, obj):
        return obj.entry.en_text[:60] + ("…" if len(obj.entry.en_text) > 60 else "")

    entry_summary.short_description = "English Entry"

    def short_text(self, obj):
        return obj.text[:60] + ("…" if len(obj.text) > 60 else "")

    short_text.short_description = "Translation"
