# history/management/commands/augment_database.py
import logging
from django.core.management.base import BaseCommand
from history.agents import DirectorAgent

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Populate the historical database by spidering from a starting course."

    def add_arguments(self, parser):
        parser.add_argument(
            "course_name",
            type=str,
            help="Course name (e.g., 'AP United States History')",
        )
        parser.add_argument(
            "--max-topics",
            type=int,
            default=10000,
            help="Maximum topics to process (default: 10000)",
        )

    def handle(self, *args, **options):
        course_name = options["course_name"]
        max_topics = options["max_topics"]

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"Starting population for course: {course_name}")
        )
        try:
            director = DirectorAgent(course_name, max_topics)
            director.process()
            self.stdout.write(
                self.style.SUCCESS(
                    f"✔ Processed {director.processed_count} topics for {course_name}"
                )
            )
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("🛑 Stopped by user"))
            return
        except Exception as e:
            logger.exception(f"Error during population of {course_name}")
            self.stdout.write(self.style.ERROR(f"✖ Error: {e}"))
            return

        self.stdout.write(
            self.style.SUCCESS(f"✅ Population complete for {course_name}!")
        )
