from django.core.management.base import BaseCommand

from django.db.models import Q

from history.models import Who

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
from history.agents.whos import (
    PlanWhosInput,
    PlanWhosAgent,
    DescribeWhoInput,
    DescribeWhoAgent,
)
from history.agents.whens import (
    PlanWhensInput,
    PlanWhensAgent,
    DescribeWhenInput,
    DescribeWhenAgent,
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

        plan_who_agent = PlanWhosAgent()
        whos = plan_who_agent.run(
            input=PlanWhosInput(
                course=course.name,
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Generated whos for {course.name}:\n" f"{whos.list_of_names[:3]}"
            )
        )

        describe_who_agent = DescribeWhoAgent()

        # only the ones in the course that have no description or no start_date
        data_whos = Who.objects.filter(
            Q(description="") | Q(start_date=None),
            course__name=course.name,
        ).values_list("name", flat=True)
        for who in data_whos:
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Generating description for {who} in {course.name}"
                )
            )
            who_data = describe_who_agent.run(
                input=DescribeWhoInput(
                    name=who,
                    course=course,
                )
            )
            self.stdout.write(
                self.style.MIGRATE_HEADING(f"Who description: {who_data.description}")
            )

        plan_when_agent = PlanWhensAgent()
        whens = plan_when_agent.run(
            input=PlanWhensInput(
                course=course.name,
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Generated whens for {course.name}:\n" f"{whens.list_event_names[:3]}"
            )
        )

        describe_when_agent = DescribeWhenAgent()
        for event in whens.list_event_names:
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Generating description for {event} in {course.name}"
                )
            )
            when_data = describe_when_agent.run(
                input=DescribeWhenInput(
                    name=event,
                    course=course.name,
                )
            )
            self.stdout.write(
                self.style.MIGRATE_HEADING(f"When description: {when_data.description}")
            )

        self.stdout.write(
            self.style.SUCCESS(f"✅ Population complete for {course_name}!")
        )
