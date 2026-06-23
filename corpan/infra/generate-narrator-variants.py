#!/usr/bin/env python3
"""Generate N avatar/banner variants per narrator so the user can pick winners.

Reuses the upload + image-generation contract from generate-catalog-assets.py
but writes to variant keys (avatar-v1.jpg, avatar-v2.jpg, …) instead of the
canonical avatar.jpg. After the user picks, a separate one-line S3 copy
promotes the winner to the canonical key.

Usage:
    python3 generate-narrator-variants.py [--only NAME] [--dry-run] [--force]
"""
from __future__ import annotations

import argparse
import base64
import io
import os
import time
from pathlib import Path

import boto3
import openai
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
DOTENV = REPO_ROOT / ".env"

S3_BUCKET = "corpan-prod"
S3_PREFIX = "artifacts"
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net"
AWS_REGION = "us-east-2"

IMAGE_MODEL = "gpt-image-1"
AVATAR_SIZE = "1024x1024"
BANNER_SIZE = "1536x1024"

# Brand-aligned style suffix appended to every prompt
COMMON_TAIL = (
    "Editorial illustration, painterly digital art, high craftsmanship, "
    "deliberate composition, restrained color palette, no text, no logos, "
    "no watermarks, no captions, no UI elements."
)


# ── Vindy ──────────────────────────────────────────────────────────────
# Tamil Indian woman, middle-aged, attractive, smiling. Polished, chic,
# western clothes. NPR-style podcast host.

VINDY_AVATAR_VARIANTS = [
    # v1 — three-quarter, gentle, structured neutrals
    "Editorial portrait of a poised middle-aged Tamil Indian woman, "
    "warm brown skin, shoulder-length softly waved dark hair, structured "
    "cream blazer over a crisp ivory shirt, a single fine gold chain at "
    "her collar. She is in three-quarter view, looking just past the "
    "camera with a gentle, knowing smile. Soft afternoon daylight from a "
    "window to her right. Warm but understated palette of cream, "
    "weathered teak, and old gold. Painterly digital illustration, "
    "low saturation, very high craftsmanship, no photorealism. Centered "
    "square portrait, head and shoulders. " + COMMON_TAIL,
    # v2 — direct gaze, jewel tone, confident
    "Editorial portrait of a confident middle-aged Tamil Indian woman, "
    "warm brown skin, sleek dark hair pulled back, small gold studs at "
    "her ears. She wears a sapphire-blue silk blouse with a subtle pleated "
    "collar. Near-direct gaze toward the viewer with a quiet half-smile, "
    "calm and intelligent. Cool morning light, slightly diffused. "
    "Restrained palette of deep sapphire, ink, and pale linen. Painterly "
    "digital illustration, low saturation, very high craftsmanship, no "
    "photorealism. Centered square portrait, head and shoulders. "
    + COMMON_TAIL,
    # v3 — golden hour, warmth, full smile
    "Editorial portrait of a radiant middle-aged Tamil Indian woman, "
    "warm brown skin, shoulder-length wavy dark hair with a touch of "
    "natural grey at the temples, soft natural makeup. She wears a camel-"
    "colored turtleneck. Slight tilt of the head, a warm full smile that "
    "reaches her eyes. Golden-hour daylight from her left. Warm palette "
    "of camel, terracotta, and burnished bronze. Painterly digital "
    "illustration, low saturation, very high craftsmanship, no "
    "photorealism. Centered square portrait, head and shoulders. "
    + COMMON_TAIL,
]

VINDY_BANNER_VARIANTS = [
    # v1 — Paris boulevard at night, lit up, traffic streaks, no face
    "Wide horizontal landscape: Place de la Concorde and the Champs-Elysees "
    "at dusk fading into night. The boulevard alive with traffic — long "
    "streaks of red taillights and warm white headlights. The Eiffel Tower "
    "lit in the distance. A spill of sidewalk-cafe glow on the right edge, "
    "warm cream and amber. A few small distant figures along the sidewalks, "
    "none in foreground. No face visible. Restrained palette of navy, gold, "
    "ember, and pale stone. Painterly editorial illustration, cosmopolitan "
    "evening mood, energetic but composed. " + COMMON_TAIL,
    # v2 — Montmartre brasserie street, warm evening, no face
    "Wide horizontal landscape: a narrow cobbled Pigalle/Montmartre street "
    "in the evening. Glowing brasserie windows on both sides, gold light "
    "spilling onto wet cobblestones from a light earlier rain. Tasteful "
    "scattered figures walking away from camera in coats — no faces, just "
    "silhouettes and backs. A distant red-and-yellow Metro sign glows at "
    "the far end of the street. Warm amber, ember, deep red, and black "
    "palette. Painterly editorial illustration, lively but unrushed evening "
    "mood. " + COMMON_TAIL,
    # v3 — Rainy Haussmann boulevard, back of one figure, twilight
    "Wide horizontal landscape: a wet cobblestone Paris boulevard at twilight "
    "after light rain. Reflections of red and amber lights ripple on the "
    "stones. A row of glowing Haussmann buildings on the left. Streaking taxi "
    "taillights moving away. The very faint silhouette of Sacre-Coeur on its "
    "hill in the far background. In the lower-right corner, the small back "
    "of one figure in a tailored navy coat walking away from camera — only "
    "shoulders and the back of her head visible, NO FACE SHOWN, never "
    "centered, never large. Blue-gold-ember palette. Painterly editorial "
    "illustration, cinematic, atmospheric. " + COMMON_TAIL,
]


# ── Ron ────────────────────────────────────────────────────────────────
# Light-skinned Black man, happy, crisp, tie, glasses, handsome. Academic-
# business vibe — happy Gus Fring meets John McWhorter.

RON_AVATAR_VARIANTS = [
    # v1 — soft window light, three-quarter, navy + burgundy
    "Editorial portrait of a confident middle-aged Black man with light "
    "honey-brown skin, short closely-trimmed hair, a neat trimmed beard, "
    "tortoise-shell glasses. He wears a navy two-button suit, crisp white "
    "shirt, and a burgundy tie with a subtle small dotted pattern. Soft "
    "window light from his left, three-quarter view, looking slightly "
    "off-camera with a knowing, intelligent smile. Restrained palette of "
    "navy, burgundy, warm ivory, and dark tortoise. Painterly digital "
    "illustration, low saturation, very high craftsmanship, no "
    "photorealism. Centered square portrait, head and shoulders. "
    + COMMON_TAIL,
    # v2 — direct gaze, no tie, casual-academic
    "Editorial portrait of a friendly middle-aged Black man with light "
    "honey-brown skin, clean-shaven, thin metal-frame glasses, salt-and-"
    "pepper close-cropped hair. He wears a charcoal blazer over a crisp "
    "white shirt with the top button undone, no tie. Direct gaze toward "
    "the viewer, calm confident smile with a hint of teeth. Bookshelf "
    "softly out of focus in the background. Restrained palette of "
    "charcoal, ivory, warm wood, and slate. Painterly digital "
    "illustration, low saturation, very high craftsmanship, no "
    "photorealism. Centered square portrait, head and shoulders. "
    + COMMON_TAIL,
    # v3 — warm light, knit tie, broad relaxed smile
    "Editorial portrait of a happy middle-aged Black man with light "
    "honey-brown skin, short hair, a closely-trimmed beard, classic "
    "rounded glasses. He wears a light blue oxford shirt and a navy "
    "knit tie. Three-quarter view, broad relaxed smile, warm conference-"
    "room light from above and to his right. Restrained palette of "
    "powder blue, navy, warm ivory, and weathered teak. Painterly "
    "digital illustration, low saturation, very high craftsmanship, "
    "no photorealism. Centered square portrait, head and shoulders. "
    + COMMON_TAIL,
]

RON_BANNER_VARIANTS = [
    # v1 — Sun Dial evening rush, panoramic view, NO face
    "Wide horizontal landscape: interior of the Sun Dial restaurant atop "
    "the Westin Peachtree Plaza in Atlanta, full evening rush. Panoramic "
    "floor-to-ceiling windows looking south over downtown Atlanta. The "
    "skyline is alive with thousands of lit windows; the freeways below "
    "trace red-and-white moving streaks of car lights. A warm interior "
    "bokeh of brass chandeliers and amber pendants at the edges of the "
    "frame contrasts the cool city beyond. NO figures shown — vibe-first. "
    "Restrained palette of ember, brass, deep indigo, and city-light "
    "gold. Painterly editorial illustration, energetic urban evening "
    "mood. " + COMMON_TAIL,
    # v2 — Midtown view at golden-to-blue hour, pure city, NO figure
    "Wide horizontal landscape: top-of-Peachtree-Plaza panoramic view of "
    "the Atlanta skyline, golden hour rolling into blue hour. Bank of "
    "America Plaza's spire and the entire Midtown skyline twinkling — "
    "thousands of lit windows, distant car-light streams on Peachtree "
    "Street. Sweeping view, almost cinematic. NO figures, no interior "
    "people. Deep indigo, ember, and gold palette. Painterly editorial "
    "illustration, cinematic top-of-the-world mood. " + COMMON_TAIL,
    # v3 — Sun Dial, back-of-head silhouette small in corner, no face
    "Wide horizontal landscape: interior of the Sun Dial restaurant at "
    "twilight. Downtown Atlanta lights dominate the frame through "
    "floor-to-ceiling windows. In the lower-right corner, a small "
    "back-of-head silhouette of a man in a sharp suit looking out — "
    "ONLY shoulders and back of head, NO FACE SHOWN, never centered, "
    "never large. Warm wood interior at the very edges of the frame. "
    "Restrained palette of charcoal, ember, brass, and city-light gold. "
    "Painterly editorial illustration, contemplative urban-evening "
    "mood. " + COMMON_TAIL,
]


VARIANTS = {
    "vindy": {"avatar": VINDY_AVATAR_VARIANTS, "banner": VINDY_BANNER_VARIANTS},
    "ron":   {"avatar": RON_AVATAR_VARIANTS,   "banner": RON_BANNER_VARIANTS},
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    # AWS CLI / boto expects AWS_ACCESS_KEY_ID; the .env uses AWS_ACCESS_KEY.
    if "AWS_ACCESS_KEY" in os.environ and "AWS_ACCESS_KEY_ID" not in os.environ:
        os.environ["AWS_ACCESS_KEY_ID"] = os.environ["AWS_ACCESS_KEY"]


def s3_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def existing_keys(s3, prefix: str) -> set[str]:
    keys: set[str] = set()
    token = None
    while True:
        kwargs = {"Bucket": S3_BUCKET, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            keys.add(obj["Key"])
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return keys


def generate_image(client: openai.OpenAI, prompt: str, size: str) -> bytes:
    print(f"  → generating ({size})…", flush=True)
    t0 = time.time()
    resp = client.images.generate(
        model=IMAGE_MODEL, prompt=prompt, size=size,
        quality="high", n=1,
    )
    print(f"  ← generated in {time.time() - t0:.1f}s", flush=True)
    b64 = resp.data[0].b64_json
    if not b64:
        raise RuntimeError("OpenAI returned no image data")
    return base64.b64decode(b64)


def png_to_jpeg(png_bytes: bytes, quality: int = 88) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=list(VARIANTS.keys()),
                        help="Limit to one narrator")
    parser.add_argument("--kind", choices=["avatar", "banner"],
                        help="Limit to one asset kind")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate even if variant exists in S3")
    args = parser.parse_args()

    load_dotenv(DOTENV)
    s3 = s3_client()
    oai = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    existing = existing_keys(s3, f"{S3_PREFIX}/characters/")

    narrators = [args.only] if args.only else list(VARIANTS.keys())

    for name in narrators:
        print(f"\n=== {name} ===")
        for asset_kind, prompts in VARIANTS[name].items():
            if args.kind and asset_kind != args.kind:
                continue
            size = AVATAR_SIZE if asset_kind == "avatar" else BANNER_SIZE
            for i, prompt in enumerate(prompts, start=1):
                key = f"characters/{name}/{asset_kind}-v{i}.jpg"
                full_key = f"{S3_PREFIX}/{key}"
                if not args.force and full_key in existing:
                    print(f"  ✓ already exists: {CDN_BASE}/{key}")
                    continue
                print(f"\n  [{name} {asset_kind} v{i}]")
                if args.dry_run:
                    print(f"  [dry-run] would generate + upload {full_key}")
                    continue
                png = generate_image(oai, prompt, size)
                jpg = png_to_jpeg(png)
                s3.put_object(
                    Bucket=S3_BUCKET, Key=full_key, Body=jpg,
                    ContentType="image/jpeg",
                    CacheControl="public, max-age=31536000, immutable",
                )
                print(f"  ✓ uploaded {CDN_BASE}/{key} ({len(jpg)} bytes)")


if __name__ == "__main__":
    main()
