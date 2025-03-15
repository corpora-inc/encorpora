from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from iching.models import Hexagram


class Command(BaseCommand):
    help = "Export I Ching data to Markdown"

    def handle(self, *args, **kwargs):
        hexagrams = Hexagram.objects.prefetch_related("lines").all().order_by("number")
        output = render_to_string(
            "iching/export_template.md",
            {
                "hexagrams": hexagrams,
                # TODO: support for other languages
            },
        )
        with open("../iching_export.md", "w", encoding="utf-8") as f:
            f.write(output)
        self.stdout.write(self.style.SUCCESS("Export complete."))
