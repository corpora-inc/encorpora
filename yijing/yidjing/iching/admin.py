from django.contrib import admin
from .models import Hexagram, Line, Consultation


class LineInline(admin.TabularInline):
    model = Line
    extra = 6  # provide 6 inlines by default


@admin.register(Hexagram)
class HexagramAdmin(admin.ModelAdmin):
    list_display = ("number", "chinese_name", "pinyin")
    inlines = [LineInline]


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ("primary_hexagram", "changing_hexagram")
