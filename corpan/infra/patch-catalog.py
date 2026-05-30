#!/usr/bin/env python3
"""
Download s3://corpan-prod/artifacts/catalog-v2.json, merge in the
narrator-first model fields (characters, voiceProfiles, books) plus
characterId/coverImageUrl on each narration, and upload the result back.

Then issue a CloudFront invalidation so readers see the new fields.

CAUTION: ttsctl publish on the backend machine will overwrite this catalog
unless ttsctl has been updated to preserve the new fields. Treat this as
bootstrap data — once the backend pipeline learns the schema, this script
becomes unnecessary.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from pathlib import Path

import boto3

REPO_ROOT = Path(__file__).resolve().parents[2]
DOTENV = REPO_ROOT / ".env"

S3_BUCKET = "corpan-prod"
S3_KEY = "artifacts/catalog-v2.json"
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net"
AWS_REGION = "us-east-2"
CLOUDFRONT_DISTRIBUTION_ID = "E1RDNUCVE70SCI"

ASSET_URLS_DEFAULT = REPO_ROOT / "corpan" / "infra" / "asset-urls.json"


# ── Character + voice-profile content ──────────────────────────────────
# Same metadata as in generate-catalog-assets.py. Kept in sync by hand for
# now; if this drifts past two narrators we should factor a shared module.

CHARACTERS_META = {
    "ian": {
        "displayName": "Ian",
        "tagline": "Calm, deliberate — built for long-form.",
        "bio": (
            "Ian's voice was cloned from a fifteen-second reading and trained to "
            "narrate across many languages while keeping the same human warmth. "
            "He reads the way a patient teacher does: slow enough to think with, "
            "honest with the silences, never theatrical. Ian narrates most of "
            "the Corpora catalog — history, science, scripture, short fiction."
        ),
        "accentColor": "#6db3a8",
        "status": "active",
        "order": 1,
    },
    "aoede": {
        "displayName": "Aoede",
        "tagline": "A native voice of the Muses.",
        "bio": (
            "Aoede is the Greek muse of voice and song. Here she stands in for "
            "a class of native, provider-rendered voices — voices that have no "
            "single human source recording behind them, but emerge whole from "
            "the model. The Aoede voice is rendered by Google's Gemini "
            "speech synthesis. She narrates a small but growing slice of the "
            "Corpora catalog where a non-cloned voice serves the work."
        ),
        "accentColor": "#5b6fb0",
        "status": "active",
        "order": 2,
    },
    "august": {
        "displayName": "August",
        "tagline": "A boy's voice for young readers learning a new language.",
        "bio": (
            "August is a young narrator with a clear, friendly voice. He reads "
            "the way an unusually thoughtful nine-year-old does — short, plain "
            "sentences, simple words, room to breathe. August narrates the "
            "Motorcycles series and other books written for boys learning a "
            "second language."
        ),
        "accentColor": "#d4a14a",
        "status": "active",
        "order": 3,
    },
    "kym": {
        "displayName": "Kym",
        "tagline": "A friend's voice from the American South.",
        "bio": (
            "Kym is a warm, direct narrator from the Southern United States. "
            "She reads the way a friend tells you about the food she grew up "
            "with — short sentences, real names, no fuss. Kym narrates the "
            "Food of the World series, beginning with soul food, the "
            "everyday cooking of Black families in the American South."
        ),
        "accentColor": "#c66a3d",
        "status": "active",
        "order": 4,
    },
    "vindy": {
        "displayName": "Vindy",
        "tagline": "Host of AI This Week.",
        "bio": (
            "Vindy is the host of AI This Week, the weekly conversation "
            "about what actually happened in artificial intelligence over "
            "the past seven days. She reads the way an NPR host does — "
            "warm, relaxed, friendly, with a quiet gleam of wonder. "
            "Polished and intelligent, conversational not theatrical. The "
            "Vindy voice is rendered by Google's Gemini speech synthesis."
        ),
        "accentColor": "#7a5cb0",
        "status": "active",
        "order": 5,
    },
    "ron": {
        "displayName": "Ron",
        "tagline": "Resident analyst on AI This Week.",
        "bio": (
            "Ron is the resident analyst on AI This Week. He brings the "
            "numbers and the context — the patient explainer beside Vindy's "
            "host chair. He reads with academic-business polish, clear and "
            "unhurried, the way a thoughtful colleague walks you through "
            "a paper at lunch. The Ron voice is rendered by Google's "
            "Gemini speech synthesis."
        ),
        "accentColor": "#3a6d7a",
        "status": "active",
        "order": 6,
    },
    "ryan": {
        "displayName": "Ryan",
        "tagline": "A baseball kid's voice — all enthusiasm, no filter.",
        "bio": (
            "Ryan is ten years old and loves baseball more than almost "
            "anything. He reads the way a kid on the dugout bench does — "
            "short sentences, big energy, every play remembered like it "
            "happened yesterday. Ryan narrates the Sports for Kids series "
            "book about baseball."
        ),
        "accentColor": "#4a8bce",
        "status": "active",
        "order": 7,
    },
    "isabelle": {
        "displayName": "Isabelle",
        "tagline": "A gymnast's voice — focused, joyful, just nine years old.",
        "bio": (
            "Isabelle is nine and a competitive gymnast. She reads the way "
            "a kid does when she is telling you about the thing she loves "
            "most — carefully, brightly, with a small pause before the parts "
            "that matter to her. Isabelle narrates the Sports for Kids "
            "series book about gymnastics."
        ),
        "accentColor": "#c98ba0",
        "status": "active",
        "order": 8,
    },
    "avery": {
        "displayName": "Avery",
        "tagline": "A cheerleader's voice — team-first, loud-proud, all heart.",
        "bio": (
            "Avery is ten years old and a competitive cheerleader. She reads "
            "the way a kid who loves being part of a team does — fast at the "
            "exciting parts, slower at the trust parts, never apologizing "
            "for how much fun the sport is. Avery narrates the Sports for "
            "Kids series book about cheerleading."
        ),
        "accentColor": "#5fa0a8",
        "status": "active",
        "order": 9,
    },
    # Skylar (sky-21.wav) and Victor (victor-business.wav) have avatars +
    # banners on S3 from the 2026-05-10 generate-catalog-assets.py pass, but
    # no narrations are using them yet. Hold them out of the catalog until
    # there's a real shipping pack. To restore: add a CHARACTERS_META entry +
    # matching VOICE_PROFILES entry + VOICE_PREVIEW_URLS entry. Avatar/banner
    # JPGs are already live at:
    #   /characters/sky/{avatar,banner}.jpg
    #   /characters/victor/{avatar,banner}.jpg
}

# voiceId → CDN URL of a short mastered preview clip (~15-25s).
# Sources are concatenated chapter-opening segments from real published packs;
# see /home/skyl/tmp/voice-previews/cut.sh on the build machine.
VOICE_PREVIEW_URLS = {
    "ian-narration":   f"{CDN_BASE}/voice-previews/ian-narration.m4a",
    "ian-chill-clear": f"{CDN_BASE}/voice-previews/ian-chill-clear.m4a",
    "aoede-gemini":    f"{CDN_BASE}/voice-previews/aoede-gemini.m4a",
    "august":          f"{CDN_BASE}/voice-previews/august.m4a",
    "kym":             f"{CDN_BASE}/voice-previews/kym.m4a",
    "gemini-vindy":    f"{CDN_BASE}/voice-previews/gemini-vindy.m4a",
    "gemini-ron":      f"{CDN_BASE}/voice-previews/gemini-ron.m4a",
}

# voiceId → (characterId, displayName, provider, source kind, supportedLanguages)
VOICE_PROFILES = [
    {
        "id": "ian-narration",
        "characterId": "ian",
        "displayName": "Default",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 15,
        },
        "traits": ["narrator", "warm", "deliberate"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "ian-chill-clear",
        "characterId": "ian",
        "displayName": "Chill / Clear",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 15,
        },
        "traits": ["narrator", "calm", "clear"],
        "status": "active",
        "order": 2,
    },
    {
        "id": "aoede-gemini",
        "characterId": "aoede",
        "displayName": "Aoede",
        "provider": "gemini",
        "providerVoiceId": "aoede",
        "source": {"kind": "native"},
        "traits": ["native", "provider-voice"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "august",
        "characterId": "august",
        "displayName": "August",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 21,
        },
        "traits": ["narrator", "boy", "young", "kids", "language-learning"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "kym",
        "characterId": "kym",
        "displayName": "Kym",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 38,
        },
        "traits": ["narrator", "warm", "friend", "southern-american", "language-learning"],
        "status": "active",
        "order": 1,
    },
    # Skylar + Victor voice profiles withheld until a real narration ships
    # under either voiceId (see CHARACTERS_META comment above).
    {
        "id": "gemini-vindy",
        "characterId": "vindy",
        "displayName": "Vindy",
        "provider": "gemini",
        "providerVoiceId": "Vindemiatrix",
        "source": {"kind": "native"},
        "traits": ["narrator", "host", "warm", "npr-style", "dialog"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "gemini-ron",
        "characterId": "ron",
        "displayName": "Ron",
        "provider": "gemini",
        "providerVoiceId": "Charon",
        "source": {"kind": "native"},
        "traits": ["narrator", "analyst", "academic", "business", "dialog"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "ryan",
        "characterId": "ryan",
        "displayName": "Ryan",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 25,
        },
        "traits": ["narrator", "boy", "kid", "sports", "language-learning"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "isabelle",
        "characterId": "isabelle",
        "displayName": "Isabelle",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 16,
        },
        "traits": ["narrator", "girl", "kid", "sports", "language-learning"],
        "status": "active",
        "order": 1,
    },
    {
        "id": "avery",
        "characterId": "avery",
        "displayName": "Avery",
        "provider": "chatterbox",
        "source": {
            "kind": "cloned",
            "sourceWaveUrl": "",
            "sourceWaveSha256": "",
            "lengthSeconds": 15,
        },
        "traits": ["narrator", "girl", "kid", "sports", "cheer", "language-learning"],
        "status": "active",
        "order": 1,
    },
]

# Book descriptions — matches generate-catalog-assets.py
BOOK_META = {
    "book_monte_alban": {
        "description": (
            "An illustrated investigation of the great Zapotec city built on a "
            "leveled hilltop in Oaxaca — why it rose, why it was abandoned, and "
            "what its carved stones still refuse to tell us."
        ),
        "tags": ["history", "mesoamerica", "archaeology"],
    },
    "bible_genesis": {
        "description": (
            "The first book of the Hebrew Bible — creation, the garden, the "
            "flood, the patriarchs. Read across many languages."
        ),
        "tags": ["scripture", "ancient", "hebrew"],
    },
    "book_u10_goalie": {
        "description": (
            "Read along as a young goalkeeper — angles, footwork, courage. "
            "Part of the U10 7v7 Soccer series."
        ),
        "tags": ["kids", "soccer", "u10"],
    },
    "book_u10_sweeper": {
        "description": (
            "Read along as a young sweeper — reading the play, holding the "
            "line, calm under pressure. Part of the U10 7v7 Soccer series."
        ),
        "tags": ["kids", "soccer", "u10"],
    },
    "book_u10_defender": {
        "description": (
            "Read along as a young defender — tackling, marking, "
            "communication. Part of the U10 7v7 Soccer series."
        ),
        "tags": ["kids", "soccer", "u10"],
    },
    "book_u10_striker": {
        "description": (
            "Read along as a young striker — first touch, finishing, finding "
            "space. Part of the U10 7v7 Soccer series."
        ),
        "tags": ["kids", "soccer", "u10"],
    },
    "book_science_atom": {
        "description": (
            "A friendly first walk through the structure of matter — protons, "
            "neutrons, electrons, and the empty space between them."
        ),
        "tags": ["kids", "science", "physics"],
    },
    "book_mystery_of_the_olmec": {
        "description": (
            "An investigation of the earliest great Mesoamerican civilization, "
            "told through their colossal stone heads."
        ),
        "tags": ["history", "mesoamerica", "archaeology"],
    },
    "book_zheng_yi_sao": {
        "description": (
            "The pirate queen who commanded eighty thousand sailors across the "
            "South China Sea — and walked away from it alive."
        ),
        "tags": ["history", "biography", "maritime"],
    },
    "book_hayreddin_barbarossa": {
        "description": (
            "The Ottoman corsair who became admiral of the Mediterranean — "
            "built Algiers into a power, sailed against the Habsburg fleets, "
            "and died in his bed in Istanbul."
        ),
        "tags": ["history", "biography", "maritime"],
    },
    "book_science_volcanoes": {
        "description": (
            "A friendly first walk through volcanoes — magma, eruptions, "
            "and the islands they leave behind."
        ),
        "tags": ["kids", "science", "geology"],
    },
    "book_tolstoy_three_questions": {
        "description": (
            "Tolstoy's parable: when is the right time to act, who is the most "
            "important person, and what is the most important thing to do?"
        ),
        "author": "Lev Tolstoy",
        "tags": ["fiction", "russian", "tolstoy", "parable"],
    },
    "book_tolstoy_what_men_live_by": {
        "description": (
            "Tolstoy's parable about a poor cobbler and the stranger he takes "
            "in — and the truth about love, suffering, and what holds a life "
            "together."
        ),
        "author": "Lev Tolstoy",
        "tags": ["fiction", "russian", "tolstoy", "parable"],
    },
    "book_sky_diving": {
        "description": (
            "A small escape into the sky — what it actually feels like to step "
            "out of an airplane and fall."
        ),
        "tags": ["adventure", "first-person"],
    },
    "book_gardening": {
        "description": (
            "A small escape into soil, seeds, and the slow craft of growing "
            "things. For everyone who has ever pressed a finger into damp "
            "earth and felt the year start over."
        ),
        "tags": ["adventure", "first-person", "nature", "craft"],
    },
    "book_sailing": {
        "description": (
            "A small escape onto the water — wind on the cheek, lines in the "
            "hand, the long quiet between tacks. For everyone who has ever "
            "leaned into a heel and stopped thinking about anything else."
        ),
        "tags": ["adventure", "first-person", "water", "craft"],
    },
    "book_motorcycles_history": {
        "description": (
            "Volume one of the Motorcycles series. The big story of the "
            "motorcycle, from the first sputtering steam contraption in 1885 "
            "to the electric superbikes of today. Read aloud in twenty-three "
            "languages by August, for boys six to fifteen learning a new "
            "language."
        ),
        "tags": ["kids", "vehicles", "motorcycles", "history", "language-learning"],
    },
    "book_oud_history": {
        "description": (
            "Volume one of the Musical Instruments of the World series. The "
            "story of the oud — the pear-shaped wooden lute of the Arab "
            "world, great-grandfather of the European lute and the modern "
            "guitar. Its makers, its great players, and the maqam, the older "
            "system of music it speaks in."
        ),
        "tags": ["all-ages", "music", "instruments", "oud", "arabic", "history", "language-learning"],
    },
    "book_persian_food": {
        "description": (
            "Volume two of the Food of the World series. A short tour of one "
            "of the oldest cuisines on earth. Saffron from Khorasan, "
            "pomegranate orchards, the sacred crisp of tahdig at the bottom "
            "of the rice pot, sangak baked on hot pebbles, a stew written on "
            "cuneiform tablets, and the table set for Nowruz. Read aloud by "
            "Kym."
        ),
        "tags": ["all-ages", "food", "persia", "iran", "cuisine", "history", "language-learning"],
    },
    "book_train_history": {
        "description": (
            "Volume one of the Vehicles of the World series. The big arc of "
            "rail — Stephenson's Rocket, the Transcontinental, the "
            "Trans-Siberian, the Shinkansen, the maglev. From the first "
            "steam locomotive to the floating trains of today."
        ),
        "tags": ["all-ages", "vehicles", "trains", "history", "language-learning"],
    },
    "book_ai_this_week_2026_05_13": {
        "description": (
            "AI This Week for May 13, 2026 — Rate Cuts and Routers. A two-host "
            "dialog show on what actually happened in artificial intelligence "
            "this week. Vindy hosts, Ron analyzes. Four sections: model "
            "releases, leaderboard movement, the concept of the week, and the "
            "bigger picture. About ten minutes."
        ),
        "tags": ["adults", "tech", "ai", "news", "podcast", "dialog", "weekly"],
    },
    "book_ai_this_week_2026_05_27": {
        "description": (
            "AI This Week for May 27, 2026 — The Most-Used Model on Earth. A "
            "quiet release week, so two hosts go where the keynotes don't: "
            "SGLang and DeepSeek's permanent price cut reshape self-hosting, "
            "OpenRouter shows an open MIT-licensed Chinese model is now the "
            "most-used on Earth, and the chip war is the same story. Top story "
            "is the state of open text-to-speech — Chatterbox, OmniVoice, "
            "VoxCPM2, MOSS-TTS-Nano, and the license trap. Concept of the week "
            "is mixture of experts. About fifteen minutes."
        ),
        "tags": ["adults", "tech", "ai", "news", "podcast", "dialog", "weekly", "open-weights", "on-device", "tts"],
    },
    "book_ai_this_week_2026_05_20": {
        "description": (
            "AI This Week for May 20, 2026 — Magnifica Humanitas. Two hosts on "
            "the open-weights front: GLM-5 on Huawei Ascend, ZAYA1-8B on AMD, "
            "DeepSeek V4-Pro, and vLLM v0.21. Then a fast clip through Google "
            "I/O, Karpathy to Anthropic, and the Musk-OpenAI verdict. Top story "
            "is Pope Leo XIV's first encyclical on artificial intelligence. "
            "Concept of the week is quantization — how a seven-billion-parameter "
            "model fits on your phone. About twelve minutes."
        ),
        "tags": ["adults", "tech", "ai", "news", "podcast", "dialog", "weekly", "open-weights"],
    },
    "book_sports_for_kids_baseball": {
        "description": (
            "A kid named Ryan tells another kid what baseball actually feels "
            "like — the smell of grass, the crack of the bat, the dugout, the "
            "one home run he is still thinking about. Part of the Sports for "
            "Kids series."
        ),
        "tags": ["kids", "sports", "baseball", "language-learning"],
    },
    "book_sports_for_kids_gymnastics": {
        "description": (
            "A nine-year-old gymnast tells another kid what gymnastics is — "
            "the gym, the events, the chalk in the air, the moment after "
            "sticking a landing. Part of the Sports for Kids series."
        ),
        "tags": ["kids", "sports", "gymnastics", "language-learning"],
    },
    "book_sports_for_kids_cheerleading": {
        "description": (
            "A ten-year-old cheerleader tells another kid what cheer really "
            "is — the team, the chants, the stunts, the routine that "
            "everybody practiced a thousand times. Part of the Sports for "
            "Kids series."
        ),
        "tags": ["kids", "sports", "cheerleading", "language-learning"],
    },
}


# ── Plumbing ────────────────────────────────────────────────────────────


def load_dotenv(path: Path) -> None:
    if not path.exists():
        sys.exit(f"missing {path}")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if "AWS_ACCESS_KEY" in os.environ and "AWS_ACCESS_KEY_ID" not in os.environ:
        os.environ["AWS_ACCESS_KEY_ID"] = os.environ["AWS_ACCESS_KEY"]


def s3_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cf_client():
    return boto3.client(
        "cloudfront",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def derive_primary_language(narrations: list[dict], book_id: str) -> str:
    # Pick the first narration's language as a stand-in. Most have many
    # translations; the source is encoded only in the per-book pack manifest
    # which we don't load here. Catalog primaryLanguage is informational only.
    for n in narrations:
        if n["bookId"] == book_id:
            return n["language"]
    return "en"


def voice_supported_languages(narrations: list[dict], voice_id: str) -> list[str]:
    langs = sorted({n["language"] for n in narrations if n["voiceId"] == voice_id})
    return langs


def build_books(narrations: list[dict], asset_urls: dict) -> list[dict]:
    seen: dict[str, dict] = {}
    for n in narrations:
        bid = n["bookId"]
        if bid in seen:
            continue
        meta = BOOK_META.get(bid, {})
        cover = asset_urls.get("books", {}).get(bid, {}).get("coverImageUrl", "")
        seen[bid] = {
            "bookId": bid,
            "title": n.get("bookTitle", bid),
            "description": meta.get("description"),
            "author": meta.get("author"),
            "coverImageUrl": cover,
            "series": n.get("series"),
            "volume": n.get("volume"),
            "primaryLanguage": derive_primary_language(narrations, bid),
            "tags": meta.get("tags"),
        }
    # Drop any None values for cleanliness
    out = []
    for b in seen.values():
        out.append({k: v for k, v in b.items() if v is not None})
    return out


def build_characters(asset_urls: dict) -> list[dict]:
    out = []
    for cid, meta in CHARACTERS_META.items():
        urls = asset_urls.get("characters", {}).get(cid, {})
        out.append(
            {
                "id": cid,
                **meta,
                "avatarUrl": urls.get("avatarUrl", ""),
                "bannerUrl": urls.get("bannerUrl", ""),
            }
        )
    return out


def build_voice_profiles(narrations: list[dict]) -> list[dict]:
    out = []
    for v in VOICE_PROFILES:
        v2 = dict(v)
        v2["supportedLanguages"] = voice_supported_languages(narrations, v["id"])
        preview = VOICE_PREVIEW_URLS.get(v["id"])
        if preview:
            v2["previewClipUrl"] = preview
        out.append(v2)
    return out


def annotate_narrations(narrations: list[dict], asset_urls: dict) -> list[dict]:
    voice_to_char = {v["id"]: v["characterId"] for v in VOICE_PROFILES}
    out = []
    for n in narrations:
        n2 = dict(n)
        cid = voice_to_char.get(n["voiceId"])
        if cid:
            n2["characterId"] = cid
        cover = asset_urls.get("books", {}).get(n["bookId"], {}).get("coverImageUrl")
        if cover:
            n2["coverImageUrl"] = cover
        out.append(n2)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-urls", type=Path, default=ASSET_URLS_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "corpan" / "infra" / "catalog-v2.patched.json",
    )
    parser.add_argument("--no-invalidate", action="store_true")
    args = parser.parse_args()

    load_dotenv(DOTENV)

    if not args.asset_urls.exists():
        sys.exit(f"missing {args.asset_urls}; run generate-catalog-assets.py first")
    asset_urls = json.loads(args.asset_urls.read_text())

    s3 = s3_client()
    print(f"Fetching s3://{S3_BUCKET}/{S3_KEY}…")
    obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
    catalog = json.loads(obj["Body"].read().decode("utf-8"))

    narrations = catalog.get("narrations", [])
    print(f"  {len(narrations)} narrations in catalog")

    catalog["characters"] = build_characters(asset_urls)
    catalog["voiceProfiles"] = build_voice_profiles(narrations)
    catalog["books"] = build_books(narrations, asset_urls)
    catalog["narrations"] = annotate_narrations(narrations, asset_urls)
    catalog["generatedAt"] = (
        time.strftime("%Y-%m-%dT%H:%M:%S.000+00:00", time.gmtime())
    )

    print(
        f"  + {len(catalog['characters'])} characters,",
        f"{len(catalog['voiceProfiles'])} voice profiles,",
        f"{len(catalog['books'])} books",
    )

    payload = json.dumps(catalog, indent=2, ensure_ascii=False).encode("utf-8")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(payload)
    print(f"Wrote local copy to {args.out}")

    if args.dry_run:
        print("[dry-run] skipping S3 upload + CloudFront invalidation")
        return

    print(f"Uploading patched catalog to s3://{S3_BUCKET}/{S3_KEY}…")
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=S3_KEY,
        Body=payload,
        ContentType="application/json",
        CacheControl="public, max-age=60, stale-while-revalidate=300",
    )
    print("  ✓ uploaded")

    if not args.no_invalidate:
        print("Issuing CloudFront invalidation for /catalog-v2.json…")
        cf = cf_client()
        resp = cf.create_invalidation(
            DistributionId=CLOUDFRONT_DISTRIBUTION_ID,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/catalog-v2.json"]},
                "CallerReference": f"narrator-redesign-{int(time.time())}",
            },
        )
        inv_id = resp["Invalidation"]["Id"]
        print(f"  ✓ created invalidation {inv_id}")


if __name__ == "__main__":
    main()
