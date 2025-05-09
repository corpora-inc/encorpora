"""
Just a quickie to test the image functionality.
"""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from corpora_ai.provider_loader import load_llm_provider

xai = load_llm_provider("xai")


class Command(BaseCommand):
    help = "Generate an image using the XAI LLM provider"

    def add_arguments(self, parser):
        parser.add_argument(
            "prompt",
            type=str,
            help="Prompt for the image generation (e.g., 'A cat in a hat')",
        )
        parser.add_argument(
            "output_directory",
            nargs="?",
            default="output",
            help="Directory to save the generated image (default: 'output/')",
        )
        parser.add_argument(
            "--n",
            type=int,
            default=1,
            help="How many images to generate (default: 1)",
        )

    def handle(self, *args, **options):
        prompt: str = options["prompt"]
        out_dir = Path(options["output_directory"])
        n = options["n"]

        out_dir.mkdir(parents=True, exist_ok=True)
        self.stdout.write(f"Generating {n} image(s) for prompt: {prompt!r}…")
        images = xai.get_image(prompt, n=n)

        for img in images:
            ext = img.format or "png"
            name = slugify(prompt)[:100]
            filename = out_dir / f"{name}.{ext}"
            with open(filename, "wb") as f:
                f.write(img.data)

        self.stdout.write(self.style.SUCCESS(f"Wrote {filename}"))
