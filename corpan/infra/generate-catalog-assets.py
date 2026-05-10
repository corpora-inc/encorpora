#!/usr/bin/env python3
"""
Generate book covers + narrator avatars/banners via OpenAI gpt-image-1
and upload them to s3://corpan-prod/artifacts/{books,characters}/.

URLs the catalog will reference:
  Book covers:        https://d38iwc9748jekz.cloudfront.net/books/{bookId}/cover.jpg
  Narrator avatars:   https://d38iwc9748jekz.cloudfront.net/characters/{characterId}/avatar.jpg
  Narrator banners:   https://d38iwc9748jekz.cloudfront.net/characters/{characterId}/banner.jpg

Reads keys from <repo>/.env. Use --dry-run to print actions without spending money.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import boto3
import openai
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
DOTENV = REPO_ROOT / ".env"

S3_BUCKET = "corpan-prod"
S3_PREFIX = "artifacts"  # CloudFront origin path; CDN strips this.
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net"
AWS_REGION = "us-east-2"

# OpenAI image generation model
IMAGE_MODEL = "gpt-image-1"
COVER_SIZE = "1024x1024"   # square — matches Spotify/Apple Music vocabulary
AVATAR_SIZE = "1024x1024"  # square
BANNER_SIZE = "1536x1024"  # landscape, ~3:2 — banner gets cropped via CSS


# ── Brand-aligned prompt building blocks ────────────────────────────────
COMMON_TAIL = (
    "Editorial illustration, painterly digital art, high craftsmanship, "
    "deliberate composition, restrained color palette, no text, no logos, "
    "no watermarks, no captions, no UI elements. Cover art only."
)


# ── Catalog content ─────────────────────────────────────────────────────


@dataclass
class CharacterSpec:
    id: str
    display_name: str
    tagline: str
    bio: str
    avatar_prompt: str
    banner_prompt: str
    accent_color: str


@dataclass
class BookSpec:
    book_id: str
    title: str
    description: str
    cover_prompt: str


CHARACTERS: list[CharacterSpec] = [
    CharacterSpec(
        id="ian",
        display_name="Ian",
        tagline="Calm, deliberate — built for long-form.",
        bio=(
            "Ian's voice was cloned from a fifteen-second reading and trained to "
            "narrate across many languages while keeping the same human warmth. "
            "He reads the way a patient teacher does: slow enough to think with, "
            "honest with the silences, never theatrical. Ian narrates most of "
            "the Corpora catalog — history, science, scripture, short fiction."
        ),
        avatar_prompt=(
            "Editorial portrait of a thoughtful man in his mid-forties, soft "
            "natural daylight, warm but understated palette of moss greens and "
            "muted earth tones, gentle slight smile, eyes off-camera, looking "
            "at something he is reading. Painterly digital illustration, low "
            "saturation, very high craftsmanship, no photorealism. Centered "
            "square portrait, head and shoulders. " + COMMON_TAIL
        ),
        banner_prompt=(
            "Wide horizontal landscape: a single shaft of warm afternoon light "
            "falling across an old wooden reading desk with an open book, a "
            "small ceramic mug, and a window showing distant low hills in haze. "
            "Painterly editorial illustration, restrained moss-green and "
            "umber palette, contemplative mood, no people in frame. " + COMMON_TAIL
        ),
        accent_color="#6db3a8",
    ),
    CharacterSpec(
        id="august",
        display_name="August",
        tagline="A boy's voice for young readers learning a new language.",
        bio=(
            "August is a young narrator with a clear, friendly voice. He reads "
            "the way an unusually thoughtful nine-year-old does — short, plain "
            "sentences, simple words, room to breathe. August narrates the "
            "Motorcycles series and other books written for boys learning a "
            "second language."
        ),
        avatar_prompt=(
            "Editorial portrait of a thoughtful blond-haired boy who looks "
            "about nine years old, full round cherubic cheeks, calm steady "
            "gaze with eyes off-camera as if looking at something he is "
            "reading. Soft natural daylight, warm but understated palette of "
            "honey gold and pale blue. He carries a quiet, knowing maturity "
            "that is unusual for his age. Painterly digital illustration, "
            "low saturation, very high craftsmanship, no photorealism. "
            "Centered square portrait, head and shoulders. " + COMMON_TAIL
        ),
        banner_prompt=(
            "Wide horizontal landscape: a young blond-haired boy of about "
            "nine standing alone on a high overlook in golden afternoon "
            "light, seen from behind and slightly to the side, looking out "
            "across a vast green valley folded with low hills, a glinting "
            "river winding through it far below. Soft warm gold sky near "
            "the horizon shifting to deep blue overhead. Painterly editorial "
            "illustration, restrained palette of greens, golds and warm "
            "blues, contemplative mood, no other people in frame. "
            + COMMON_TAIL
        ),
        accent_color="#d4a14a",
    ),
    CharacterSpec(
        id="kym",
        display_name="Kym",
        tagline="A friend's voice from the American South.",
        bio=(
            "Kym is a warm, direct narrator from the Southern United States. "
            "She reads the way a friend tells you about the food she grew up "
            "with — short sentences, real names, no fuss. Kym narrates the "
            "Food of the World series, beginning with soul food, the "
            "everyday cooking of Black families in the American South."
        ),
        avatar_prompt=(
            "Editorial portrait of a stylish dark-skinned Black woman in her "
            "late forties from the American South. Her hair is dressed in a "
            "fancy cornrow pattern braided close to her scalp — not "
            "dreadlocks, not loose hanging braids, but elegant geometric "
            "cornrows forming a beautiful sculptural pattern across her "
            "head. She wears stylish sunglasses that catch a warm afternoon "
            "light. Calm, confident, the faintest hint of a knowing smile. "
            "Soft natural daylight, warm understated palette of warm browns, "
            "deep amber, copper, and cream tones. Painterly digital "
            "illustration, low saturation, very high craftsmanship, no "
            "photorealism. Centered square portrait, head and shoulders. "
            + COMMON_TAIL
        ),
        banner_prompt=(
            "Wide horizontal landscape: a quiet wooden porch of a Southern "
            "home in late golden afternoon light. A heavy black cast-iron "
            "skillet rests on a sturdy weathered wooden table beside a "
            "folded linen cloth and a tall glass jar of sweet tea sweating "
            "with condensation. Beyond the porch railing, a vast green "
            "field stretches to a distant tree line, with a soft gold sky "
            "shifting to warm rose at the horizon. Painterly editorial "
            "illustration, restrained warm palette of warm browns, ambers, "
            "deep greens, and gold, contemplative mood, no people in frame. "
            + COMMON_TAIL
        ),
        accent_color="#c66a3d",
    ),
    CharacterSpec(
        id="sky",
        display_name="Skylar",
        tagline="A reader's voice for stories worth slowing down for.",
        bio=(
            "Skylar narrates the Musical Instruments of the World series. He "
            "reads the way a thoughtful host on late-night radio does — slow, "
            "even, a little curious, always making room for the music. Skylar "
            "is at home in nine of the catalog's languages today, with more "
            "coming as the series grows."
        ),
        avatar_prompt=(
            "Editorial portrait of a calm Scandinavian man in his late "
            "thirties to early forties, neat trimmed sandy-blond beard, short "
            "tidy hair, plain dark soft-cotton t-shirt, gentle steady gaze "
            "with a faint, knowing smile. He carries the quiet confidence of "
            "someone who reads more than he speaks. Soft natural daylight, "
            "warm but understated palette of weathered teak, slate blue, and "
            "pale linen. Painterly digital illustration, low saturation, very "
            "high craftsmanship, no photorealism. Centered square portrait, "
            "head and shoulders. " + COMMON_TAIL
        ),
        banner_prompt=(
            "Wide horizontal landscape: an interior of a quiet Nordic-modern "
            "wood-paneled listening room in late afternoon light, a single "
            "warm shaft of sun falling across a low wooden bench. On the "
            "bench rests a single pear-shaped oud, its rounded back catching "
            "the light. A small turntable sits silent on a side shelf, and a "
            "few stringed instruments hang on the wall in soft shadow. "
            "Restrained palette of pale linen, weathered teak, slate blue, "
            "and warm gold. Painterly editorial illustration, contemplative "
            "mood, no people in frame. " + COMMON_TAIL
        ),
        accent_color="#5a7d8c",
    ),
    CharacterSpec(
        id="aoede",
        display_name="Aoede",
        tagline="A native voice of the Muses.",
        bio=(
            "Aoede is the Greek muse of voice and song. Here she stands in for "
            "a class of native, provider-rendered voices — voices that have no "
            "single human source recording behind them, but emerge whole from "
            "the model. The Aoede voice is rendered by Google's Gemini "
            "speech synthesis. She narrates a small but growing slice of the "
            "Corpora catalog where a non-cloned voice serves the work."
        ),
        avatar_prompt=(
            "Stylized illustrated portrait of a Greek muse, profile view, "
            "neoclassical sculpture aesthetic interpreted in painterly digital "
            "art. Pale ivory and deep cobalt palette, faint gold leaf accents, "
            "a single olive branch in her hair, gentle introspective expression, "
            "eyes lowered. Centered square composition, head and shoulders. "
            "Not photorealistic. " + COMMON_TAIL
        ),
        banner_prompt=(
            "Wide horizontal landscape: a quiet predawn Aegean coast, smooth "
            "water, distant Greek headlands silhouetted, a single gull. "
            "Pale ivory sky shifting to deep cobalt at the horizon, faint "
            "golden glow at the eastern edge. Painterly editorial illustration, "
            "no people, no text. " + COMMON_TAIL
        ),
        accent_color="#5b6fb0",
    ),
]


BOOKS: list[BookSpec] = [
    BookSpec(
        book_id="book_monte_alban",
        title="The Mystery of Monte Albán",
        description=(
            "An illustrated investigation of the great Zapotec city built on a "
            "leveled hilltop in Oaxaca — why it rose, why it was abandoned, and "
            "what its carved stones still refuse to tell us."
        ),
        cover_prompt=(
            "A single weathered Zapotec stone carving (a danzante figure) "
            "standing on a windy hilltop above terraced ruins at sunset, distant "
            "mountains of Oaxaca in haze. Painterly editorial illustration, "
            "ochre and burnt sienna palette, deliberate composition, contemplative "
            "mystery, no people, no text. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_motorcycles_history",
        title="The Story of the Motorcycle",
        description=(
            "Volume one of the Motorcycles series. The big story of the "
            "motorcycle, from the first sputtering steam contraption in 1885 "
            "to the electric superbikes of today. Read aloud in twenty-three "
            "languages by August, for boys six to fifteen learning a new "
            "language."
        ),
        cover_prompt=(
            "Picture-book illustration of a single classic vintage motorcycle "
            "parked on a sunlit empty road that curves toward distant low "
            "mountains, warm late afternoon light, a faint dust haze in the "
            "air, long shadow on the road. Friendly storybook style with "
            "clean shapes and bold but unsaturated color, a sense of "
            "adventure and the long open story of the road. Approachable "
            "for boys six to fifteen. No riders, no team logos, no text "
            "anywhere on the bike. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="bible_genesis",
        title="Genesis",
        description=(
            "The first book of the Hebrew Bible — creation, the garden, the "
            "flood, the patriarchs. Read across many languages."
        ),
        cover_prompt=(
            "A single olive branch and a small clay oil lamp resting on dark "
            "stone, lit by one warm flame. Pre-dawn deep navy background fading "
            "to faint amber where the lamp glows. Painterly editorial "
            "illustration, sacred but understated, no people, no text. "
            + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_u10_goalie",
        title="You Are the Goalkeeper",
        description=(
            "Read along as a young goalkeeper — angles, footwork, courage. "
            "Part of the U10 7v7 Soccer series."
        ),
        cover_prompt=(
            "Picture-book illustration of a child goalkeeper in a green jersey "
            "and gloves, low athletic stance ready for a shot, on a sunlit "
            "grass pitch. Bright friendly storybook style, clean shapes, warm "
            "afternoon light, very approachable for kids 7–10. No team logos, "
            "no text on the jersey. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_u10_sweeper",
        title="You Are the Sweeper",
        description=(
            "Read along as a young sweeper — reading the play, holding the "
            "line, calm under pressure. Part of the U10 7v7 Soccer series."
        ),
        cover_prompt=(
            "Picture-book illustration of a child defender in a blue jersey "
            "calmly tracking the play from the back, sunlit grass pitch, hands "
            "out organizing teammates. Bright friendly storybook style, clean "
            "shapes, warm afternoon light, very approachable for kids 7–10. "
            "No team logos, no text on the jersey. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_u10_defender",
        title="You Are the Defender",
        description=(
            "Read along as a young defender — tackling, marking, "
            "communication. Part of the U10 7v7 Soccer series."
        ),
        cover_prompt=(
            "Picture-book illustration of a child defender in a red jersey "
            "shoulder-to-shoulder with an attacker, focused expression, sunlit "
            "grass pitch. Bright friendly storybook style, clean shapes, warm "
            "afternoon light, very approachable for kids 7–10. No team logos, "
            "no text on the jersey. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_u10_striker",
        title="You Are the Striker",
        description=(
            "Read along as a young striker — first touch, finishing, finding "
            "space. Part of the U10 7v7 Soccer series."
        ),
        cover_prompt=(
            "Picture-book illustration of a child striker in a yellow jersey "
            "mid-stride about to shoot at goal, sunlit grass pitch, ball at "
            "their feet. Bright friendly storybook style, clean shapes, warm "
            "afternoon light, very approachable for kids 7–10. No team logos, "
            "no text on the jersey. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_science_atom",
        title="What Is an Atom",
        description=(
            "A friendly first walk through the structure of matter — protons, "
            "neutrons, electrons, and the empty space between them."
        ),
        cover_prompt=(
            "Stylized educational illustration of a single atom — a small "
            "warm-orange nucleus with a few soft-blue electron orbits drawn as "
            "elegant ellipses, against a deep indigo background with faint "
            "scientific notation textures. Clean modern editorial science "
            "illustration, kid-friendly but grown-up enough to feel real. "
            + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_mystery_of_the_olmec",
        title="The Mystery of the Olmec",
        description=(
            "An investigation of the earliest great Mesoamerican civilization, "
            "told through their colossal stone heads."
        ),
        cover_prompt=(
            "A single colossal Olmec stone head emerging from dense jungle "
            "undergrowth at dusk, mist between vines, faint mossy lichen on the "
            "stone, deep emerald and basalt-grey palette. Painterly editorial "
            "illustration, contemplative mystery, no people, no text. "
            + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_zheng_yi_sao",
        title="Zheng Yi Sao",
        description=(
            "The pirate queen who commanded eighty thousand sailors across the "
            "South China Sea — and walked away from it alive."
        ),
        cover_prompt=(
            "A weathered Chinese junk under full red battened sails on a "
            "stormy South China Sea at dusk, dramatic side lighting, a small "
            "silhouette of a woman captain on the bow looking out. Painterly "
            "editorial illustration, deep teal and crimson palette, cinematic. "
            "No text, no logos. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_science_volcanoes",
        title="Volcanoes",
        description=(
            "A friendly first walk through volcanoes — magma, eruptions, "
            "and the islands they leave behind."
        ),
        cover_prompt=(
            "Stylized educational illustration of a single conical volcano at "
            "night with a glowing lava plume rising into a starless sky, deep "
            "obsidian black silhouette, vivid orange and red glow at the cone, "
            "gentle ash haze. Clean modern editorial science illustration, "
            "kid-friendly but grown-up enough to feel real. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_tolstoy_three_questions",
        title="Three Questions",
        description=(
            "Tolstoy's parable: when is the right time to act, who is the most "
            "important person, and what is the most important thing to do?"
        ),
        cover_prompt=(
            "A lone figure in 19th-century Russian peasant clothing seen from "
            "behind, walking on a wooden plank path through a quiet birch "
            "forest at dawn, soft mist between the trunks. Painterly editorial "
            "illustration, muted palette of pale green, birch white, and warm "
            "grey, contemplative, no text. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_tolstoy_what_men_live_by",
        title="What Men Live By",
        description=(
            "Tolstoy's parable about a poor cobbler and the stranger he takes "
            "in — and the truth about love, suffering, and what holds a life "
            "together."
        ),
        cover_prompt=(
            "Interior of a small 19th-century Russian cobbler's workshop at "
            "night, single oil lamp on a wooden bench casting warm light on "
            "scattered leather scraps and a half-finished boot, a window "
            "showing snow outside. Painterly editorial illustration, warm "
            "amber and cold winter blue palette, no people in frame, no text. "
            + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_sky_diving",
        title="Skydiving",
        description=(
            "A small escape into the sky — what it actually feels like to step "
            "out of an airplane and fall."
        ),
        cover_prompt=(
            "A single solo skydiver in stable belly-to-earth freefall position "
            "seen from above, against a vast view of patchwork farmland and "
            "river bends far below, soft cumulus clouds drifting at the edges, "
            "wind rippling the jumpsuit. Painterly editorial illustration, "
            "high altitude blue palette with warm gold sunlight, exhilarating "
            "but calm, no text. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_gardening",
        title="Gardening",
        description=(
            "A small escape into soil, seeds, and the slow craft of growing "
            "things. For everyone who has ever pressed a finger into damp "
            "earth and felt the year start over."
        ),
        cover_prompt=(
            "Editorial illustration of two hands working in dark loamy soil "
            "around a row of small green seedlings in a wooden flat, soft "
            "morning light raking across the bed, restrained palette of moss "
            "greens, terracotta, and pale ochre. Painterly digital art, "
            "high craftsmanship, contemplative, no text. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_sailing",
        title="Sailing",
        description=(
            "A small escape onto the water — wind on the cheek, lines in the "
            "hand, the long quiet between tacks. For everyone who has ever "
            "leaned into a heel and stopped thinking about anything else."
        ),
        cover_prompt=(
            "Editorial illustration of a small single-mast sloop heeled gently "
            "against a low afternoon sun on open water, the line of the "
            "horizon clean, soft cool palette of slate blues, weathered teak, "
            "and pale sail canvas, faint warm light at the edge. Painterly "
            "digital art, high craftsmanship, reflective mood, no people in "
            "frame, no text. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_soul_food_southern_us",
        title="Soul Food of the Southern United States",
        description=(
            "Volume one of the Food of the World series. A short tour of an "
            "American cuisine with deep roots — West African and Indigenous "
            "ingredients, the cast-iron skillet, the regional barbecue map, "
            "the Sunday plate."
        ),
        cover_prompt=(
            "Editorial illustration of a heavy black cast-iron skillet on a "
            "weathered wooden table in late golden afternoon light, a piece "
            "of golden cornbread resting on a folded linen cloth beside the "
            "skillet, a small sprig of dark collard greens just visible at "
            "the edge of the frame, soft warm shadow falling across the "
            "wood. Restrained warm palette of deep browns, burnt umber, "
            "honey gold, cream, and the deep green of the leaves. Painterly "
            "digital art, low saturation, very high craftsmanship, no "
            "photorealism, dignified and homey, no people in frame, no text "
            "anywhere. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_persian_food",
        title="Persian Food",
        description=(
            "Volume two of the Food of the World series. A short tour of one "
            "of the oldest cuisines on earth — saffron from Khorasan, the "
            "pomegranate orchard, tahdig at the bottom of the rice pot, "
            "sangak baked on hot pebbles, a stew written on cuneiform "
            "tablets, and the table set for Nowruz."
        ),
        cover_prompt=(
            "Editorial illustration of a Persian table at golden afternoon "
            "light, a heavy copper pot tipped to show a perfect golden disk "
            "of crisp saffron rice tahdig, a small bowl of fresh pomegranate "
            "seeds beside it, a few pistachio shells and a sprig of fresh "
            "herbs, all resting on a richly patterned Persian kilim rug. "
            "Restrained warm palette of saffron gold, deep pomegranate red, "
            "burnished copper, cream, and the dusty teal and rose of the "
            "kilim. Painterly digital art, low saturation, very high "
            "craftsmanship, no photorealism, dignified and inviting, no "
            "people in frame, no text anywhere. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_oud_history",
        title="The Oud",
        description=(
            "Volume one of the Musical Instruments of the World series. The "
            "story of the oud — the pear-shaped wooden lute of the Arab "
            "world, great-grandfather of the European lute and the modern "
            "guitar. Its makers, its great players, and the maqam, the older "
            "system of music it speaks in."
        ),
        cover_prompt=(
            "Editorial illustration of a single beautifully crafted "
            "pear-shaped Arabic oud lying flat in warm afternoon light on a "
            "weathered wooden surface, its deep rounded back catching the "
            "sun, an ornately carved rosette in the soundboard, eleven "
            "strings catching faint highlights. In the soft background, a "
            "blurred suggestion of a Levantine or Andalusian courtyard with "
            "an arched stone window opening onto distant pale hills at dusk. "
            "Restrained warm palette of weathered teak, deep amber, dusty "
            "rose, and slate blue. Painterly digital art, low saturation, "
            "very high craftsmanship, no photorealism, no people in frame, "
            "no text anywhere. " + COMMON_TAIL
        ),
    ),
    BookSpec(
        book_id="book_train_history",
        title="The Story of the Train",
        description=(
            "Volume one of the Vehicles of the World series. The big arc of "
            "rail — Stephenson's Rocket, the Transcontinental, the "
            "Trans-Siberian, the Shinkansen, the maglev. From the first "
            "steam locomotive to the floating trains of today."
        ),
        cover_prompt=(
            "Picture-book illustration of a sleek modern white-and-blue "
            "Japanese-style bullet train cresting a long elevated viaduct at "
            "golden hour. The train's long aerodynamic nose dominates the "
            "frame, low and pointed, headlights catching the sun. A single "
            "clean elevated track curves gently to the right, with rolling "
            "green countryside and distant blue mountains beyond. Soft "
            "contrails of motion blur behind the train. Friendly storybook "
            "style with clean modern shapes, restrained palette of pearl "
            "white, sky blue, soft warm gold, and deep mountain blue. A "
            "sense of speed and the future. No riders visible inside, no "
            "team logos, no text on the train. Single track only. "
            + COMMON_TAIL
        ),
    ),
]


# ── Plumbing ────────────────────────────────────────────────────────────


def load_dotenv(path: Path) -> None:
    if not path.exists():
        sys.exit(f"missing {path}")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)
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


def openai_client() -> openai.OpenAI:
    return openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def generate_image(client: openai.OpenAI, prompt: str, size: str) -> bytes:
    """Call gpt-image-1 once. Returns PNG bytes."""
    print(f"  → generating ({size})…", flush=True)
    t0 = time.time()
    resp = client.images.generate(
        model=IMAGE_MODEL,
        prompt=prompt,
        size=size,
        quality="high",
        n=1,
    )
    elapsed = time.time() - t0
    print(f"  ← generated in {elapsed:.1f}s", flush=True)
    b64 = resp.data[0].b64_json
    if not b64:
        raise RuntimeError("OpenAI returned no image data")
    return base64.b64decode(b64)


def png_to_jpeg(png_bytes: bytes, quality: int = 88) -> bytes:
    """Convert PNG bytes from OpenAI to JPEG bytes for smaller CDN payload."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def upload(s3, key: str, jpeg_bytes: bytes, dry_run: bool) -> str:
    full_key = f"{S3_PREFIX}/{key}"
    public_url = f"{CDN_BASE}/{key}"
    if dry_run:
        print(f"  [dry-run] would upload s3://{S3_BUCKET}/{full_key}  ({len(jpeg_bytes)} bytes)")
        return public_url
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=full_key,
        Body=jpeg_bytes,
        ContentType="image/jpeg",
        CacheControl="public, max-age=31536000, immutable",
    )
    print(f"  ✓ uploaded {public_url} ({len(jpeg_bytes)} bytes)")
    return public_url


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


# ── Orchestration ───────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        choices=["characters", "books", "ian-pilot"],
        help="Limit which assets are generated",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print plan without spending money"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even if the asset already exists in S3",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "corpan" / "infra" / "asset-urls.json",
        help="Write the produced asset URL map to this file",
    )
    args = parser.parse_args()

    load_dotenv(DOTENV)
    s3 = s3_client()
    oai = openai_client()

    existing = existing_keys(s3, f"{S3_PREFIX}/books/") | existing_keys(
        s3, f"{S3_PREFIX}/characters/"
    )

    # Load existing asset-urls.json so a partial run (--only books or
    # --only characters) doesn't blank the half it isn't touching. Without
    # this, `--only books` rewrites the file with empty `characters: {}`
    # and patch-catalog drops every narrator's avatar/banner from the
    # catalog. Has happened. Will not happen again.
    out: dict[str, dict[str, str]] = {"books": {}, "characters": {}}
    if args.out.exists():
        try:
            existing_map = json.loads(args.out.read_text())
            out["books"] = existing_map.get("books") or {}
            out["characters"] = existing_map.get("characters") or {}
        except Exception:
            pass

    def needs_upload(key: str) -> bool:
        full = f"{S3_PREFIX}/{key}"
        return args.force or full not in existing

    def do_image(prompt: str, size: str, key: str) -> str:
        if not needs_upload(key):
            url = f"{CDN_BASE}/{key}"
            print(f"  ✓ already exists: {url}")
            return url
        png = generate_image(oai, prompt, size)
        jpg = png_to_jpeg(png)
        return upload(s3, key, jpg, args.dry_run)

    only = args.only

    if only == "ian-pilot":
        # Single-image pilot to verify pipeline + aesthetic
        ian = next(c for c in CHARACTERS if c.id == "ian")
        print(f"Pilot: {ian.id} avatar")
        url = do_image(ian.avatar_prompt, AVATAR_SIZE, f"characters/{ian.id}/avatar.jpg")
        out["characters"][ian.id] = {"avatarUrl": url}
    else:
        if only in (None, "characters"):
            for c in CHARACTERS:
                print(f"\nCharacter: {c.id}")
                avatar_url = do_image(
                    c.avatar_prompt, AVATAR_SIZE, f"characters/{c.id}/avatar.jpg"
                )
                banner_url = do_image(
                    c.banner_prompt, BANNER_SIZE, f"characters/{c.id}/banner.jpg"
                )
                out["characters"][c.id] = {
                    "avatarUrl": avatar_url,
                    "bannerUrl": banner_url,
                }
        if only in (None, "books"):
            for b in BOOKS:
                print(f"\nBook: {b.book_id}")
                cover_url = do_image(
                    b.cover_prompt, COVER_SIZE, f"books/{b.book_id}/cover.jpg"
                )
                out["books"][b.book_id] = {"coverImageUrl": cover_url}

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2))
    print(f"\nWrote URL map to {args.out}")


if __name__ == "__main__":
    main()
