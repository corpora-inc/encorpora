# history/admin.py
from django.contrib import admin
from .models import Course, Period, Theme


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["name", "description_preview"]
    list_filter = []
    search_fields = ["name", "description"]
    ordering = ["name"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"


@admin.register(Period)
class PeriodAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "start_date",
        "end_date",
        "description_preview",
    ]
    list_filter = ["course", "start_date"]
    search_fields = ["name", "description"]
    ordering = ["start_date", "name"]
    autocomplete_fields = ["course"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def get_queryset(self, request):
        return super().get_queryset(request)


@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ("name", "course")
