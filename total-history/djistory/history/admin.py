# history/admin.py
from django.contrib import admin
from .models import Course, Theme, Period, Place, Person, Event, Document


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["name", "description_preview", "object_count"]
    list_filter = []
    search_fields = ["name", "description"]
    ordering = ["name"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def object_count(self, obj):
        # Count all related objects across models
        return sum(
            [
                obj.theme_set.count(),
                obj.period_set.count(),
                obj.place_set.count(),
                obj.person_set.count(),
                obj.event_set.count(),
                obj.document_set.count(),
            ]
        )

    object_count.short_description = "Objects"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related(
                "theme_set",
                "period_set",
                "place_set",
                "person_set",
                "event_set",
                "document_set",
            )
        )


class ThemeInline(admin.TabularInline):
    model = Theme.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ["name", "description_preview", "course_list"]
    list_filter = ["courses"]
    search_fields = ["name", "description"]
    ordering = ["name"]
    inlines = [ThemeInline]
    autocomplete_fields = ["courses"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("courses")


class PeriodInline(admin.TabularInline):
    model = Period.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Period)
class PeriodAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "start_date",
        "end_date",
        "description_preview",
        "course_list",
    ]
    list_filter = ["courses", "themes", "start_date"]
    search_fields = ["name", "description"]
    ordering = ["start_date", "name"]
    inlines = [PeriodInline]
    autocomplete_fields = ["courses", "themes"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("courses", "themes")


class PlaceInline(admin.TabularInline):
    model = Place.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ["name", "description_preview", "course_list", "period_list"]
    list_filter = ["courses", "periods", "themes"]
    search_fields = ["name", "description"]
    ordering = ["name"]
    inlines = [PlaceInline]
    autocomplete_fields = ["courses", "periods", "themes"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def period_list(self, obj):
        return ", ".join(period.name for period in obj.periods.all())

    period_list.short_description = "Periods"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related("courses", "periods", "themes")
        )


class PersonInline(admin.TabularInline):
    model = Person.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "birth_date",
        "death_date",
        "description_preview",
        "course_list",
    ]
    list_filter = ["courses", "periods", "themes"]
    search_fields = ["name", "description"]
    ordering = ["name"]
    inlines = [PersonInline]
    autocomplete_fields = ["courses", "places", "periods", "themes"]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related("courses", "places", "periods", "themes")
        )


class EventPeopleInline(admin.TabularInline):
    model = Event.people.through
    extra = 1
    autocomplete_fields = ["person"]


class EventInline(admin.TabularInline):
    model = Event.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "start_date",
        "end_date",
        "description_preview",
        "course_list",
    ]
    list_filter = ["courses", "periods", "themes", "start_date"]
    search_fields = ["name", "description"]
    ordering = ["start_date", "name"]
    inlines = [EventInline, EventPeopleInline]
    autocomplete_fields = [
        "courses",
        "places",
        "people",
        "periods",
        "themes",
        "related_events",
    ]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related(
                "courses", "places", "people", "periods", "themes", "related_events"
            )
        )


class DocumentInline(admin.TabularInline):
    model = Document.courses.through
    extra = 1
    autocomplete_fields = ["course"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "publication_date",
        "author",
        "parent_name",
        "children_count",
        "description_preview",
        "course_list",
    ]
    list_filter = ["courses", "periods", "themes", "publication_date"]
    search_fields = ["name", "description", "author"]
    ordering = ["name"]
    inlines = [DocumentInline]
    autocomplete_fields = [
        "courses",
        "parent",
        "events",
        "people",
        "places",
        "periods",
        "themes",
    ]

    def description_preview(self, obj):
        return obj.description[:100] + ("..." if len(obj.description) > 100 else "")

    description_preview.short_description = "Description"

    def course_list(self, obj):
        return ", ".join(course.name for course in obj.courses.all())

    course_list.short_description = "Courses"

    def parent_name(self, obj):
        return obj.parent.name if obj.parent else "-"

    parent_name.short_description = "Parent"

    def children_count(self, obj):
        return obj.children.count()

    children_count.short_description = "Children"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related(
                "courses",
                "parent",
                "children",
                "events",
                "people",
                "places",
                "periods",
                "themes",
            )
        )
