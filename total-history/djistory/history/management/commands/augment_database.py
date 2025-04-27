from django.core.management.base import BaseCommand

from history.agents.courses import (
    DescribeCourseAgent,
    CourseNameInput,
)
from history.agents.periods import (
    DescribePeriodAgent,
    PlanPeriodsAgent,
    DescribePeriodInput,
)
from history.agents.themes import (
    PlanThemesAgent,
    DescribeThemeAgent,
    DescribeThemeInput,
)


class Command(BaseCommand):
    help = "Populate the historical database by spidering from a starting course."

    def add_arguments(self, parser):
        parser.add_argument(
            "course_name",
            type=str,
            help="Course name (e.g., 'AP United States History')",
        )

    def handle(self, *args, **options):
        course_name = options["course_name"]

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"Starting population for course: {course_name}")
        )

        dca = DescribeCourseAgent()
        course = dca.run(input=CourseNameInput(name=course_name))
        self.stdout.write(
            self.style.MIGRATE_HEADING(f"Course description: {course.description}")
        )

        ppa = PlanPeriodsAgent()
        periods = ppa.run(input=course).list
        self.stdout.write(self.style.MIGRATE_HEADING(f"Generated periods: {periods}"))

        dpa = DescribePeriodAgent()
        for period in periods:
            period_data = dpa.run(
                input=DescribePeriodInput(**period.model_dump(), course=course)
            )
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Period description: {period_data.description}"
                )
            )

        pta = PlanThemesAgent()
        themes = pta.run(input=course)
        self.stdout.write(self.style.MIGRATE_HEADING(f"Generated themes: {themes}"))

        dta = DescribeThemeAgent()
        for theme in themes.list:
            theme_data = dta.run(
                input=DescribeThemeInput(**theme.model_dump(), course=course)
            )
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Theme description: {theme_data.description}"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(f"✅ Population complete for {course_name}!")
        )
