from django.contrib import admin

from .models import Course, Unit, Lesson, Exercise


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("name", "course")
    search_fields = ("name",)
    ordering = ("name",)
    list_filter = ("course",)
    autocomplete_fields = ("course",)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("name", "unit")
    search_fields = ("name", "summary", "markdown", "study_markdown")
    ordering = ("name",)
    list_filter = ("unit__course",)
    autocomplete_fields = ("unit",)


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("name", "lesson")
    search_fields = ("name", "markdown")
    ordering = ("name",)
    list_filter = ("lesson__unit__course",)
    autocomplete_fields = ("lesson",)
