# itrary/management/commands/export_course_md.py

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from itrary.models import Course


class Command(BaseCommand):
    help = (
        "Export a whole course (units, lessons, exercises) to a single Markdown file."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "course_name",
            type=str,
            help="Name of the course to export (must match Course.name)",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=None,
            help="Filepath to write the Markdown to (default: <course_name>.md)",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        course_name: str = options["course_name"]
        output_path = options["output"] or f"{course_name.replace(' ', '-').lower()}.md"

        try:
            course = Course.objects.prefetch_related("units__lessons__exercises").get(
                name=course_name
            )
        except Course.DoesNotExist:
            self.stderr.write(f'❌ Course "{course_name}" not found.')
            return

        context = {"course": course}
        rendered = render_to_string("book.md", context)

        Path(output_path).write_text(rendered, encoding="utf-8")
        self.stdout.write(f"✅ Exported course to {output_path}")
