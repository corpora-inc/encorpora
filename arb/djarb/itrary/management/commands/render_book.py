import subprocess
import re
from pathlib import Path
from typing import Any, Dict, List

from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

from corpora_ai.provider_loader import load_llm_provider
from itrary.models import Course
from itrary.utils import load_book_config

llm = load_llm_provider("xai")


class Command(BaseCommand):
    help = "Export a course to Markdown, PDF, EPUB, and print-ready PDF with generated images and templated cover."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--config",
            type=str,
            required=True,
            help="Path to book config YAML (e.g., 'book-input/georgia-state-history/config.yaml')",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default="",
            help="Directory to write outputs into (defaults to 'book-output/<course-slug>')",
        )
        parser.add_argument(
            "--cover-image",
            type=str,
            default="cover.png",
            help="Name of cover image file (e.g., 'cover.png' or 'study-guide-cover.png')",
        )
        parser.add_argument(
            "--template",
            type=str,
            default="book",
            help="Template to use for rendering the book (e.g., 'book', 'study_guide')",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        config_path = options["config"]
        config = load_book_config(config_path)
        course_slug = config.title.replace(" ", "-").lower()
        out_dir = Path(options["output_dir"] or f"book-output/{course_slug}")
        out_dir.mkdir(parents=True, exist_ok=True)
        images_dir = out_dir / "images"
        images_dir.mkdir(exist_ok=True)
        template_name = options["template"]

        # Input paths
        input_dir = Path(config_path).parent
        common_dir = Path("book-input/common")
        cover_image_name = options["cover_image"]
        cover_image_path = (
            input_dir / cover_image_name
            if (input_dir / cover_image_name).exists()
            else common_dir / cover_image_name
        )
        if not cover_image_path.exists():
            self.stderr.write(f"❌ Cover image not found: {cover_image_path}")
            return

        # Fetch the course
        try:
            course = Course.objects.prefetch_related("units__lessons__exercises").get(
                name=config.title
            )
        except Course.DoesNotExist:
            self.stderr.write(f'❌ Course "{config.title}" not found.')
            return

        # Render initial markdown
        full_stem = f"{course_slug}-{template_name}"
        md_filename = f"{full_stem}.md"
        md_path = out_dir / md_filename
        rendered = render_to_string(f"{template_name}.md", {"course": course})
        md_path.write_text(rendered, encoding="utf-8")
        self.stdout.write(f"✅ Initial markdown written to {md_path}")

        # Process markdown for images
        processed_md_filename = f"{full_stem}-processed.md"
        processed_md_path = out_dir / processed_md_filename
        with open(md_path, "r") as f:
            content = f.read()

        # Find image tokens and generate images
        image_tokens = re.findall(r"\{\{IMAGE: (.*?)\}\}", content)
        for alt_text in set(image_tokens):  # Avoid duplicates
            slugified_alt_text = alt_text.replace(" ", "-").lower()

            # Generate image
            image_prompt = f"{config.image_instructions or 'Create a high-quality illustration'}: {alt_text}. "
            # Extract context (preceding paragraph)
            context = ""
            token_index = content.index(f"{{IMAGE: {alt_text}}}")
            before_token = content[:token_index].split("\n")
            for line in reversed(before_token):
                if line.strip() and not line.startswith("#"):
                    context = line.strip()
                    break
            if context:
                image_prompt += f"Context: {context}"

            self.stdout.write(f"Generating image: {alt_text}")
            generated_images = llm.get_image(image_prompt)
            if not generated_images:
                self.stderr.write(f"❌ No images generated for: {alt_text}")
                continue
            if len(generated_images) > 1:
                self.stdout.write(
                    f"Warning: Multiple images generated for '{alt_text}', using first one"
                )

            # Use the first image
            generated_image = generated_images[0]
            image_format = (
                generated_image.format or "png"
            )  # Default to png if format is None
            image_path = images_dir / f"{slugified_alt_text}.{image_format}"
            if image_path.exists():
                self.stdout.write(f"Skipping existing image: {image_path}")
                continue

            # Save image
            with open(image_path, "wb") as f:
                f.write(generated_image.data)

            # Replace token with markdown image (relative to markdown file)
            content = content.replace(
                f"{{IMAGE: {alt_text}}}",
                f"\n![{alt_text}](images/{slugified_alt_text}.{image_format})\n",
            )

        # Save processed markdown
        processed_md_path.write_text(content, encoding="utf-8")
        self.stdout.write(
            f"✅ Processed markdown with images written to {processed_md_path}"
        )

        # Render custom_cover.tex
        cover_template = "templates/custom_cover.tex"
        cover_context = {
            "title": config.title,
            "subtitle": config.subtitle,
            "author": config.author or "Skylar Saveland",
            "publisher": config.publisher or "Corpora Inc",
            "cover_path": cover_image_name,  # Relative to book-output/<course-slug>/
        }
        rendered_cover = render_to_string(cover_template, cover_context)
        cover_path = out_dir / "custom_cover.tex"
        cover_path.write_text(rendered_cover, encoding="utf-8")
        self.stdout.write(f"✅ Rendered cover template to {cover_path}")

        # Metadata
        meta: Dict[str, str] = {
            "title": config.title,
            "author": config.author or "Skylar Saveland",
            "lang": "en-US",
            "date": "",
            "publisher": config.publisher or "Corpora Inc",
            "isbn": config.isbn or "",
        }
        from datetime import date

        meta["date"] = meta["date"] or date.today().isoformat()

        # Define pandoc jobs
        jobs: List[Dict[str, Any]] = [
            {
                "name": "pdf",
                "outfile": out_dir / f"{full_stem}.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    f"--include-in-header={common_dir / 'custom_headings.tex'}",
                    f"--include-before-body={cover_path}",
                    f"--lua-filter={common_dir / 'hrule.lua'}",
                    "-V",
                    "documentclass=book",
                    "-V",
                    "geometry:margin=1in",
                    "--toc-depth=2",
                ],
            },
            {
                "name": "epub",
                "outfile": out_dir / f"{full_stem}.epub",
                "args": [
                    "--to=epub3",
                    "--mathml",
                    f"--css={common_dir / 'epub.css'}",
                    f"--epub-cover-image={cover_image_path}",
                    "--toc",
                    f"--lua-filter={common_dir / 'hrule.lua'}",
                    "--toc-depth=2",
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
                "outfile": out_dir / f"{full_stem}-print.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    f"--include-in-header={common_dir / 'custom_headings.tex'}",
                    f"--include-before-body={cover_path}",
                    f"--lua-filter={common_dir / 'hrule.lua'}",
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

        # Run pandoc jobs
        for job in jobs:
            cmd = [
                "pandoc",
                "-s",
                str(processed_md_path),
                "-o",
                str(job["outfile"]),
            ] + job["args"]
            self.stdout.write(f"→ Building {job['name']} → {job['outfile'].name}")
            try:
                subprocess.run(cmd, check=True)
            except subprocess.CalledProcessError as e:
                self.stderr.write(f"❌ pandoc {job['name']} failed: {e}")
                return

        self.stdout.write("🎉 All formats built successfully!")
