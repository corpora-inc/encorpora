import subprocess
import re
from pathlib import Path
from typing import Any, Dict, List

from django.core.management.base import BaseCommand
from django.template.loader import render_to_string
from django.utils.text import slugify

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
        course_slug = slugify(config.title)
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

        # Copy cover image to output directory
        cover_image_dest: Path = out_dir / cover_image_name
        cover_image_dest.write_bytes(cover_image_path.read_bytes())

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
        skipped_captions = []
        for alt_text in set(image_tokens):
            slugified_alt_text = slugify(alt_text)

            # Check if the image already exists
            image_path = images_dir / f"{slugified_alt_text}.jpg"
            if image_path.exists():
                self.stdout.write(
                    f"Image already exists for: {alt_text}. Skipping generation."
                )
                content = content.replace(
                    f"{{{{IMAGE: {alt_text}}}}}",
                    f"\n![{alt_text}](images/{slugified_alt_text}.jpg)\n",
                )
                continue

            # Find the image token position
            token = f"{{IMAGE: {alt_text}}}"
            print(f"Token: {token}")

            try:
                token_index = content.index(token)
            except Exception:
                import IPython

                IPython.embed()

            # Get the content before the token
            before_token = content[:token_index]

            # Find the last header (e.g., #, ##, ###) before the token
            header_pattern = r"^(#{1,6})\s+(.+)$"  # Matches # Header, ## Header, etc.
            headers = []
            for line in before_token.splitlines():
                match = re.match(header_pattern, line, re.MULTILINE)
                if match:
                    headers.append(
                        match.group(2).strip()
                    )  # Capture the header text (without #)

            # Use the last header as context (or empty if none found)
            context = headers[-1] if headers else ""

            # Build the prompt
            image_prompt = f"Image Instructions:\n{config.image_instructions}\n\nThe image caption is:\n`{alt_text}`\n\nGenerate an image that matches the caption using the instructions."
            if context:
                image_prompt = f"Context:\n{context}\n\n{image_prompt}"
            self.stdout.write(f"PROMPT:\n{image_prompt}")

            try:
                generated_images = llm.get_image(image_prompt)
            except Exception as e:
                self.stderr.write(f"❌ Error generating image for '{alt_text}': {e}")
                skipped_captions.append(alt_text)
                content = content.replace(f"{{{{IMAGE: {alt_text}}}}}", "")
                continue

            if not generated_images:
                self.stdout.write(
                    f"⚠️ No images generated for: {alt_text}. Removing token."
                )
                skipped_captions.append(alt_text)
                content = content.replace(f"{{{{IMAGE: {alt_text}}}}}", "")
                continue
            if len(generated_images) > 1:
                self.stdout.write(
                    f"Warning: Multiple images generated for '{alt_text}', using first one"
                )

            # Use the first image
            generated_image = generated_images[0]
            image_format = generated_image.format
            if image_format not in {"png", "jpg", "jpeg"}:
                self.stdout.write(
                    f"⚠️ Unsupported image format '{image_format}' for: {alt_text}. Removing token."
                )
                skipped_captions.append(alt_text)
                content = content.replace(f"{{{{IMAGE: {alt_text}}}}}", "")
                continue

            image_path = images_dir / f"{slugified_alt_text}.{image_format}"

            # Save image
            with open(image_path, "wb") as f:
                f.write(generated_image.data)

            # Replace token with markdown image
            content = content.replace(
                f"{{{{IMAGE: {alt_text}}}}}",
                f"\n![{alt_text}](images/{slugified_alt_text}.{image_format})\n",
            )

        # Save processed markdown
        processed_md_path.write_text(content, encoding="utf-8")
        self.stdout.write(
            f"✅ Processed markdown with images written to {processed_md_path}"
        )

        # Log skipped captions
        if skipped_captions:
            self.stdout.write(
                f"\n⚠️ Skipped {len(skipped_captions)} captions due to no images generated:"
            )
            for caption in skipped_captions:
                self.stdout.write(f"- {caption}")

        # Render custom_cover.tex
        cover_template = "custom_cover.tex"
        cover_context = {
            "title": config.title,
            "subtitle": config.subtitle,
            "author": config.author or "Skylar Saveland",
            "publisher": config.publisher or "Corpora Inc",
            "cover_path": cover_image_name,
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

        # cp everything from common dir to output dir
        for item in common_dir.iterdir():
            if item.is_file():
                dest_path = out_dir / item.name
                dest_path.write_bytes(item.read_bytes())
                self.stdout.write(f"✅ Copied {item} to {dest_path}")

        # Define pandoc jobs
        jobs: List[Dict[str, Any]] = [
            {
                "name": "pdf",
                "outfile": f"{full_stem}.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    "--include-in-header=custom_headings.tex",
                    "--include-before-body=custom_cover.tex",
                    "--lua-filter=hrule.lua",
                    "-V",
                    "documentclass=book",
                    "-V",
                    "geometry:margin=1in",
                    "--toc-depth=2",
                ],
            },
            {
                "name": "epub",
                "outfile": f"{full_stem}.epub",
                "args": [
                    "--to=epub3",
                    "--mathml",
                    "--css=epub.css",
                    f"--epub-cover-image={cover_image_name}",
                    "--toc",
                    "--lua-filter=hrule.lua",
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
                "outfile": f"{full_stem}-print.pdf",
                "args": [
                    "--pdf-engine=xelatex",
                    "--toc",
                    "--include-in-header=custom_headings.tex",
                    "--include-before-body=custom_cover.tex",
                    "--lua-filter=hrule.lua",
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
                str(processed_md_filename),
                "-o",
                str(job["outfile"]),
            ] + job["args"]
            self.stdout.write(f"→ Building {job['name']} → {job['outfile']}")
            try:
                subprocess.run(cmd, check=True, cwd=out_dir)
            except subprocess.CalledProcessError as e:
                self.stderr.write(f"❌ pandoc {job['name']} failed: {e}")
                return

        self.stdout.write("🎉 All formats built successfully!")
