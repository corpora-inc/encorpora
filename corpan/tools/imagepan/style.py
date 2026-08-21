"""Locked house style for the imagepan concept image pack.

One style_id per pack version (research/images.md §4.4). The style is enforced
mechanically via a fixed STYLE_PREFIX + a fixed negative prompt, exactly the
pattern proven in the Spark's generate_monte_alban_flux.py STYLE_PREFIX batcher.

Rules baked in here (do not drift without bumping STYLE_ID + pack version):
  - flat, friendly, soft-shaded vector-look illustration
  - thick clean outlines, 2-3 value cel shading, limited warm palette
  - plain solid background, subject centered, fills ~70% of frame
  - NO text/words/labels ever (unlocalizable across 54 UI langs; diffusion
    mangles glyphs anyway)
  - one subject, unambiguous at card size, no clutter
"""

STYLE_ID = "flat-vector-v1"

STYLE_PREFIX = (
    "flat vector illustration of a single {subject}, centered, "
    "friendly modern children's-book style, thick clean dark outlines, "
    "soft cel shading with two to three value steps, limited warm palette, "
    "plain solid pale neutral background, subject fills about seventy percent "
    "of the frame, simple and instantly recognizable, no text, no words, no labels"
)

NEGATIVE_PROMPT = (
    "photorealistic, photograph, 3d render, realistic, text, words, letters, "
    "typography, caption, watermark, signature, logo, brand, "
    "multiple objects, extra objects, cluttered, busy background, scene, "
    "frame, border, drop shadow, gradient background, blurry, low quality, "
    "distorted, deformed, extra limbs, extra fingers"
)


def build_prompt(subject: str, extra: str = "") -> str:
    """Compose the full positive prompt for a concept.

    `subject` is the sense-specific noun phrase (e.g. "glass of drinking water",
    "loaf of bread") — always disambiguate the sense here, never the bare lemma.
    `extra` appends optional per-concept composition hints.
    """
    prompt = STYLE_PREFIX.format(subject=subject)
    if extra:
        prompt = f"{prompt}, {extra}"
    return prompt
