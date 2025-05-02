import subprocess
from pathlib import Path
from typing import Any, Dict, List

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from itrary.models import Course


class Command(BaseCommand):
    help = "Export a whole course to Markdown, PDF, EPUB, and print-ready PDF."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "course_name",
            type=str,
            help="Name of the course to export (must match Course.name)",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default="",
            help="Directory to write outputs into",
        )
        # parser.add_argument(
        #     "--cover-image",
        #     type=str,
        #     default="cover.png",
        #     help="Path to cover image (for EPUB and PDFs)",
        # )
        parser.add_argument(
            "--isbn",
            type=str,
            default="",
            help="ISBN metadata (optional)",
        )
        parser.add_argument(
            "--template",
            type=str,
            default="book.md",
            help="Template to use for rendering the book",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        course_name: str = options["course_name"]
        course_slug = course_name.replace(' ', '-').lower()
        out_dir = Path(options["output_dir"] or f"./book-output/{course_slug}")
        out_dir.mkdir(parents=True, exist_ok=True)
        resources_dir = Path(f"./book-resources/{course_slug}")
        cover_image = resources_dir / "cover.png"
        isbn = options["isbn"]
        template_name = options["template"]

        # 1) Fetch the course
        try:
            course = Course.objects.prefetch_related("units__lessons__exercises").get(
                name=course_name
            )
        except Course.DoesNotExist:
            self.stderr.write(f'❌ Course "{course_name}" not found.')
            return

        # 2) Render Markdown
        md_filename = f"{course_slug}.md"
        md_path = out_dir / md_filename
        rendered = render_to_string(template_name, {"course": course})
        md_path.write_text(rendered, encoding="utf-8")
        self.stdout.write(f"✅ Markdown written to {md_path}")

        # 3) Common metadata
        #    override these in settings.py or environment as needed
        meta: Dict[str, str] = {
            "title": course.name,
            "author": getattr(settings, "BOOK_AUTHOR", "Skylar Saveland"),
            "lang": getattr(settings, "BOOK_LANG", "en-US"),
            "date": getattr(settings, "BOOK_DATE", ""),
            "publisher": getattr(settings, "BOOK_PUBLISHER", "Corpora Inc"),
            "isbn": isbn,
        }
        if not meta["date"]:
            # fall back to today in YYYY-MM-DD
            from datetime import date

            meta["date"] = date.today().isoformat()

        # 4) Define each Pandoc job
        jobs: List[Dict[str, Any]] = [
            {
                "name": "pdf",
                "outfile": out_dir / f"{md_path.stem}.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    f"--include-in-header={resources_dir}/custom_headings.tex",
                    f"--include-before-body={resources_dir}/custom_cover.tex",
                    f"--lua-filter={resources_dir}/hrule.lua",
                    "-V",
                    "documentclass=book",
                    "-V",
                    "geometry:margin=1in",
                    "--toc-depth=2",
                ],
            },
            {
                "name": "epub",
                "outfile": out_dir / f"{md_path.stem}.epub",
                "args": [
                    "--to=epub3",
                    "--mathml",
                    f"--css={resources_dir}/epub.css",
                    # "--epub-embed-font=fonts/STIXTwoText-Regular.ttf",
                    # "--epub-embed-font=fonts/STIXTwoMath-Regular.ttf",
                    f"--epub-cover-image={cover_image}",
                    "--toc",
                    f"--lua-filter={resources_dir}/hrule.lua",
                    "--toc-depth=2",
                    # metadata flags:
                    f"--metadata=title:{meta['title']}",
                    f"--metadata=author:{meta['author']}",
                    f"--metadata=lang:{meta['lang']}",
                    f"--metadata=date:{meta['date']}",
                    f"--metadata=publisher:{meta['publisher']}",
                    f"--metadata=isbn:{meta['isbn']}",
                ],
            },
            {
                "name": "print-pdf",
                "outfile": out_dir / f"{md_path.stem}-print.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    f"--include-in-header={resources_dir}/custom_headings.tex",
                    f"--include-before-body={resources_dir}/custom_cover.tex",
                    f"--lua-filter={resources_dir}/hrule.lua",
                    "-V",
                    "documentclass=book",
                    "-V",
                    "geometry:top=0.75in,bottom=0.75in,inner=0.75in,outer=0.5in",
                    "-V",
                    "fontsize=11pt",
                    "--toc-depth=2",
                ],
            },
        ]

        # 5) Run each job
        for job in jobs:
            cmd = ["pandoc", "-s", str(md_path), "-o", str(job["outfile"])] + job[
                "args"
            ]
            self.stdout.write(f"→ Building {job['name']} → {job['outfile'].name}")
            try:
                subprocess.run(cmd, check=True)
            except subprocess.CalledProcessError as e:
                self.stderr.write(f"❌ pandoc {job['name']} failed: {e}")
                return

        self.stdout.write("🎉 All formats built successfully!")
