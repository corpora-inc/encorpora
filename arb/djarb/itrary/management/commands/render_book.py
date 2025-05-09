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

llm = load_llm_provider("openai")


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
        print(f"Cover image path: {cover_image_path}")

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

        content = md_path.read_text(encoding="utf-8")

        # Find image tokens and generate or reuse images
        image_tokens = re.findall(r"\{\{IMAGE: (.*?)\}\}", content)
        skipped_captions: List[str] = []

        for alt_text in set(image_tokens):
            slugified = slugify(alt_text)

            # Check for existing image with any supported extension
            existing_ext = None
            for ext in ("png", "jpg", "jpeg"):
                if (images_dir / f"{slugified}.{ext}").exists():
                    existing_ext = ext
                    break

            token_pattern = f"{{{{IMAGE: {alt_text}}}}}"
            if existing_ext:
                self.stdout.write(
                    f"Image already exists for '{alt_text}' ({existing_ext}); skipping generation."
                )
                content = content.replace(
                    token_pattern,
                    f"\n![{alt_text}](images/{slugified}.{existing_ext})\n",
                )
                continue

            # Determine context header for prompt
            token_index = content.find(token_pattern)
            before = content[:token_index]
            header_pattern = r"^(#{1,6})\s+(.+)$"
            headers = [
                m.group(2).strip()
                for line in before.splitlines()
                if (m := re.match(header_pattern, line))
            ]
            context = headers[-1] if headers else ""

            # Build the image prompt
            prompt_parts = []
            if context:
                prompt_parts.append(f"Context:\n{config.title}\n{context}\n")
            prompt_parts.append(
                f"Image Instructions:\n{config.image_instructions}\n"
                f"The image caption is:\n`{alt_text}`\n\n"
                "Generate an image that matches the caption using the instructions."
            )
            image_prompt = "\n".join(prompt_parts)
            self.stdout.write(f"PROMPT:\n{image_prompt}")

            try:
                generated = llm.get_image(image_prompt)
            except Exception as e:
                self.stderr.write(f"❌ Error generating image for '{alt_text}': {e}")
                skipped_captions.append(alt_text)
                content = content.replace(token_pattern, "")
                continue

            if not generated:
                self.stdout.write(
                    f"⚠️ No images generated for '{alt_text}'; removing token."
                )
                skipped_captions.append(alt_text)
                content = content.replace(token_pattern, "")
                continue

            if len(generated) > 1:
                self.stdout.write(
                    f"⚠️ Multiple images for '{alt_text}'; using first one."
                )

            img = generated[0]
            fmt = img.format.lower()
            if fmt not in {"png", "jpg", "jpeg"}:
                self.stdout.write(
                    f"⚠️ Unsupported format '{fmt}' for '{alt_text}'; removing token."
                )
                skipped_captions.append(alt_text)
                content = content.replace(token_pattern, "")
                continue

            image_path = images_dir / f"{slugified}.{fmt}"
            image_path.write_bytes(img.data)
            content = content.replace(
                token_pattern,
                f"\n![{alt_text}](images/{slugified}.{fmt})\n",
            )

        # Write processed markdown
        proc_md = out_dir / f"{full_stem}-processed.md"
        proc_md.write_text(content, encoding="utf-8")
        self.stdout.write(f"✅ Processed markdown with images written to {proc_md}")

        if skipped_captions:
            self.stdout.write(f"\n⚠️ Skipped {len(skipped_captions)} captions:")
            for c in skipped_captions:
                self.stdout.write(f"- {c}")

        # Render cover and metadata
        cover_ctx = {
            "title": config.title,
            "subtitle": config.subtitle,
            "author": config.author or "Skylar Saveland",
            "publisher": config.publisher or "Corpora Inc",
            "cover_path": cover_image_name,
        }
        (out_dir / "custom_cover.tex").write_text(
            render_to_string("custom_cover.tex", cover_ctx), encoding="utf-8"
        )
        self.stdout.write("✅ Rendered cover template")

        from datetime import date

        meta: Dict[str, str] = {
            "title": config.title,
            "author": config.author or "The Encorpora Team",
            "lang": "en-US",
            "date": date.today().isoformat(),
            "publisher": config.publisher or "Corpora Inc",
            "isbn": config.isbn or "",
        }

        # Copy common files and cover image
        for item in common_dir.iterdir():
            if item.is_file():
                dest = out_dir / item.name
                dest.write_bytes(item.read_bytes())
                self.stdout.write(f"✅ Copied {item.name}")

        (out_dir / cover_image_name).write_bytes(cover_image_path.read_bytes())
        self.stdout.write("✅ Copied cover image")

        # Define and run pandoc jobs
        jobs = [
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

        for job in jobs:
            self.stdout.write(f"→ Building {job['name']} → {job['outfile']}")
            cmd = ["pandoc", "-s", proc_md.name, "-o", job["outfile"]] + job["args"]
            subprocess.run(cmd, check=True, cwd=out_dir)

        self.stdout.write("🎉 All formats built successfully!")
