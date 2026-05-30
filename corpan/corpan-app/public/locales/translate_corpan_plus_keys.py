#!/usr/bin/env python3
"""Translate the Corpán Plus keys (paywall + new onboarding + streak) into all
locales via Gemini Flash on Vertex. Merges only-missing keys into each
locale's common.json, preserving everything else.

Run:  /home/skyl/tts_venv/bin/python translate_corpan_plus_keys.py [--apply]
Dry run by default (translates + prints, writes nothing).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path.home() / ".env")

from google import genai
from google.genai import types as gtypes

HERE = Path(__file__).parent
MODEL = "gemini-2.5-flash"

# The canonical EN strings to translate (path -> English). Brand terms
# "Corpán", "Corpán Plus", "Corpanista(s)" MUST stay verbatim. {{...}}
# placeholders MUST be preserved exactly.
EN_FLAT: dict[str, str] = {
    "onboarding.back": "Back",
    "onboarding.continue": "Continue",
    "onboarding.class.title": "Who's this for?",
    "onboarding.class.subtitle": "We'll tailor Corpán to you. This stays on your device — we never send it anywhere.",
    "onboarding.class.learner": "I'm learning languages",
    "onboarding.class.learnerDesc": "Read and listen in the languages you're studying.",
    "onboarding.class.enjoyer": "I want to enjoy the content",
    "onboarding.class.enjoyerDesc": "Books, stories and games in your own language.",
    "onboarding.class.polyglot": "Both — I want it all",
    "onboarding.class.polyglotDesc": "Several languages at once, plus everything else.",
    "onboarding.class.kid": "It's for a kid",
    "onboarding.class.kidDesc": "Curated books and learning games for younger readers.",
    "onboarding.class.ageTitle": "How old is the reader?",
    "onboarding.class.ageUnder13": "Under 13",
    "onboarding.class.ageTeen": "13–17",
    "onboarding.pitch.title": "Join the Corpanistas",
    "onboarding.pitch.subtitle": "Corpán Plus opens the whole library. Try the first part of any book free, forever.",
    "onboarding.pitch.everything": "Every book, every language — unlocked.",
    "onboarding.pitch.private": "No ads. Your data stays on your device.",
    "onboarding.pitch.team": "We're a small team and put every cent back into Corpán.",
    "onboarding.pitch.tryPlus": "Try Corpán Plus",
    "onboarding.pitch.continueFree": "Continue with the free tier",
    "paywall.title": "Keep going with Corpán Plus",
    "paywall.thanksTitle": "You're a Corpanista",
    "paywall.thanksBody": "Thank you for supporting Corpán. Everything is unlocked.",
    "paywall.bookSubhead": "You've reached the end of the free preview of {{title}}.",
    "paywall.subhead": "Unlock every book in every language. No ads. Your data stays on your device.",
    "paywall.pitch": "We're a small team and put every cent back into Corpán. Corpanistas keep it ad-free and growing.",
    "paywall.maybeLater": "Maybe later",
    "paywall.continue": "Continue",
    "packs.unlockWithPlus": "Unlock with Corpán Plus",
    "packs.plus": "Corpán Plus",
    "packs.includedWithPlus": "Included with Plus",
    "streak.title": "{{count}}-day streak",
    "settings.showStreak": "Show reading streak",
    "settings.showStreakHint": "A small day-count in the header. On-device only, no reminders or notifications.",
    # 0.16.0 decision-graph onboarding + Home hub
    "onboarding.settingUp": "Setting things up…",
    "onboarding.fork.title": "What brings you to Corpán?",
    "onboarding.fork.subtitle": "We'll set everything up for you. You can change it later.",
    "onboarding.fork.enjoy.label": "Enjoy Corpán in {{lang}}",
    "onboarding.fork.enjoy.desc": "Books, stories, games, drills and more — all in your language.",
    "onboarding.fork.learn.label": "Learn a language",
    "onboarding.fork.learn.desc": "Stories, games, drills and audio in a new language.",
    "onboarding.fork.polyglot.label": "Explore many languages",
    "onboarding.fork.polyglot.desc": "Stack several languages and explore everything.",
    "onboarding.fork.child.label": "Set it up for a child",
    "onboarding.fork.child.desc": "Gentle, playful books and games for younger learners.",
    "onboarding.calibrate.enjoyTitle": "How well do you read {{lang}}?",
    "onboarding.calibrate.enjoyNative": "Fluently — it's my language",
    "onboarding.calibrate.enjoyComfortable": "Pretty well",
    "onboarding.calibrate.enjoyImproving": "I'm still learning to read it",
    "onboarding.calibrate.enjoyJustStarting": "Just starting — I'm new to reading it",
    "onboarding.ttsIntro": "Corpán reads aloud. Tap a voice to hear it at your speed.",
    "onboarding.engage.title": "You're all set",
    "onboarding.engage.subtitle": "Corpán is made by a tiny open-source team. Come say hi — and if you love it, you can support us.",
    "onboarding.engage.joinTitle": "Join the Corpanistas",
    "onboarding.engage.joinDesc": "Support Corpán and unlock everything. Optional, anytime.",
    "onboarding.engage.start": "Start exploring",
    "socials.instagram.cta": "Follow",
    "socials.instagram.title": "Follow on Instagram",
    "socials.instagram.desc": "@corpanapp",
    "onboarding.calibrate.learnTitle": "Have you studied {{lang}} before?",
    "onboarding.calibrate.learnNever": "Never — total beginner",
    "onboarding.calibrate.learnLittle": "A little",
    "onboarding.calibrate.learnAdvanced": "I'm fairly advanced",
    "onboarding.calibrate.childAgeTitle": "How old is the reader?",
    "onboarding.calibrate.childUnder13": "Under 13",
    "onboarding.calibrate.childTeen": "13–17",
    # Interests multi-select ("What do you want to do?")
    "onboarding.interests.title": "What do you want to do?",
    "onboarding.interests.subtitle": "Pick anything that appeals — we'll suggest experiences to match. Optional.",
    "onboarding.interests.read": "Read stories & books",
    "onboarding.interests.readDesc": "Dive into readers in your language.",
    "onboarding.interests.audio": "Listen to audio",
    "onboarding.interests.audioDesc": "Audiobooks, narration and radio.",
    "onboarding.interests.games": "Play games",
    "onboarding.interests.gamesDesc": "Learn through playful challenges.",
    "onboarding.interests.speak": "Practice speaking",
    "onboarding.interests.speakDesc": "Say phrases aloud and get feedback.",
    "onboarding.interests.study": "Study & drill",
    "onboarding.interests.studyDesc": "Build vocabulary with focused practice.",
    "onboarding.interests.wild": "Explore wild stuff",
    "onboarding.interests.wildDesc": "Surprising, experimental experiences.",
    # iOS/macOS voice-install interstitial (no Settings deep-link is possible)
    "onboarding.voiceGuide.title": "Add a Premium voice",
    "onboarding.voiceGuide.intro": "Apple's higher-quality voices live in your device settings — and they're free. Here's the quick path:",
    "onboarding.voiceGuide.step1": "Tap Open Settings below.",
    "onboarding.voiceGuide.step2": "Go to Accessibility → Spoken Content → Voices.",
    "onboarding.voiceGuide.step3": "Tap your language.",
    "onboarding.voiceGuide.step4": "Download a Premium or Enhanced voice.",
    "onboarding.voiceGuide.step5": "Come back to Corpán — it appears here automatically.",
    "onboarding.voiceGuide.macStep1": "Open System Settings.",
    "onboarding.voiceGuide.macStep2": "Go to Accessibility → Spoken Content.",
    "onboarding.voiceGuide.macStep3": "Under System Voice, open Manage Voices.",
    "onboarding.voiceGuide.macStep4": "Download a Premium or Enhanced voice for your language.",
    "onboarding.voiceGuide.macStep5": "Come back to Corpán — it appears here automatically.",
    "home.tryIt": "Try it",
    "home.showAnother": "Show me another",
    "home.recommended": "Recommended",
    "home.plusChip": "Corpán Plus — unlock everything",
    "packs.updateAll": "Update all ({{count}})",
    "quickSettings.title": "Quick settings",
    "quickSettings.fullSettings": "Full settings",
    "home.like": "Like",
    "home.notForMe": "Not for me",
    "tour.progress": "{{n}} of {{total}}",
    "tour.maybeLater": "Maybe later",
    "onboarding.voiceRecommended": "Recommended",
    "onboarding.voicePreviewAria": "Preview {{name}}",
    "onboarding.voicePreviewSelected": "Preview selected",
    "onboarding.voiceSelectedCount": "{{count}} of {{total}}",
    # Experience names + one-line blurbs (Home "For you" recommendation).
    # Brand/product names stay verbatim per the HARD RULES.
    "experiences.phrase_main.name": "Phrase Flip",
    "experiences.phrase_main.blurb": "Flip through phrases in your languages — quick, focused practice.",
    "experiences.earthgate_reader.name": "Earthgate Reader",
    "experiences.earthgate_reader.blurb": "Read along to narrated audiobooks — calm, with word-by-word highlighting.",
    "experiences.stargate_reader.name": "Stargate Reader",
    "experiences.stargate_reader.blurb": "The same audiobooks in immersive 3D — words stream through space as they're read.",
    "experiences.world_radio.name": "World Radio",
    "experiences.world_radio.blurb": "Tune into live radio from around the world.",
    "experiences.hover_runner.name": "Hover Runner",
    "experiences.hover_runner.blurb": "Hear a phrase, steer to match it — learn by playing.",
    "experiences.juice_squeeze.name": "Juice Squeeze",
    "experiences.juice_squeeze.blurb": "Build phrases piece by piece in a quick game.",
    "experiences.pronunciation_coach.name": "Parlometron",
    "experiences.pronunciation_coach.blurb": "Say phrases aloud and get pronunciation feedback.",
    "experiences.hanzipan.name": "Hanzipan",
    "experiences.hanzipan.blurb": "Master Mandarin characters, stroke by stroke.",
    "home.continueLearning": "Continue learning",
    "home.openPhrases": "Open phrases",
    "home.phraseFlipDesc": "Flip through phrases in your languages",
    "home.experiences": "Experiences",
    "home.forYou": "For you",
    "home.library": "Library",
    "home.open": "Open",
    "home.get": "Get",
    "home.installing": "Installing…",
}

# Locale dir -> human language name for the prompt.
LANG_NAMES: dict[str, str] = {
    "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali", "ca": "Catalan",
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "es": "Spanish", "fa": "Persian (Farsi)", "fi": "Finnish", "fr": "French",
    "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi", "hr": "Croatian",
    "hu": "Hungarian", "id": "Indonesian", "it": "Italian", "ja": "Japanese",
    "kn": "Kannada", "ko-polite": "Korean (polite/존댓말 register)", "lt": "Lithuanian",
    "mr": "Marathi", "ms": "Malay", "ne": "Nepali", "nl": "Dutch",
    "no": "Norwegian", "pa-Arab": "Punjabi (Shahmukhi/Arabic script)",
    "pa-Guru": "Punjabi (Gurmukhi script)", "pl": "Polish",
    "pt-BR": "Brazilian Portuguese", "pt-PT": "European Portuguese",
    "ro": "Romanian", "ru": "Russian", "sk": "Slovak", "sl": "Slovenian",
    "sr": "Serbian", "sv": "Swedish", "sw": "Swahili", "ta": "Tamil",
    "te": "Telugu", "th": "Thai", "tr": "Turkish", "uk": "Ukrainian",
    "ur": "Urdu", "vi": "Vietnamese", "yue-Hant-HK": "Cantonese (Traditional, Hong Kong)",
    "zh-Hans": "Simplified Chinese", "zh-Hant": "Traditional Chinese",
}


def make_client():
    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "corpora1")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    return genai.Client(vertexai=True, project=project, location=location)


def build_prompt(name: str) -> str:
    payload = json.dumps(EN_FLAT, ensure_ascii=False, indent=2)
    return f"""You are a senior app localizer. Translate the following UI strings from English into {name} for a privacy-first language-learning app called Corpán.

HARD RULES:
- Keep the brand names EXACTLY as-is, never translate or transliterate: "Corpán", "Corpán Plus", "Corpanista", "Corpanistas".
- Preserve every placeholder EXACTLY, including the double braces: {{{{title}}}}, {{{{count}}}}. Do not translate text inside braces.
- Keep it concise and natural for a mobile UI in {name} — match length/tone, not word-for-word.
- Warm, calm, non-pushy register (this is an ad-free indie app, not a hard-sell).
- Return ONLY a JSON object with the SAME keys as the input, values translated into {name}. No commentary.

INPUT (key -> English):
{payload}
"""


def translate_locale(lang: str, client) -> tuple[str, dict | None, str]:
    name = LANG_NAMES.get(lang, lang)
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=build_prompt(name),
            config=gtypes.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        if not isinstance(data, dict):
            return lang, None, "not a dict"
        # Keep only known keys, require all present.
        missing = [k for k in EN_FLAT if k not in data]
        if missing:
            return lang, None, f"missing {len(missing)} keys"
        return lang, {k: str(data[k]) for k in EN_FLAT}, "ok"
    except Exception as e:
        return lang, None, f"{type(e).__name__}: {str(e)[:160]}"


def set_path(tree: dict, dotted: str, value: str) -> None:
    parts = dotted.split(".")
    node = tree
    for p in parts[:-1]:
        node = node.setdefault(p, {})
        if not isinstance(node, dict):
            return  # don't clobber a non-dict
    node.setdefault(parts[-1], value)  # only-missing


def merge_into_locale(lang: str, flat: dict[str, str], apply: bool) -> int:
    path = HERE / lang / "common.json"
    if not path.is_file():
        return 0
    data = json.loads(path.read_text())
    before = json.dumps(data, ensure_ascii=False)
    for k, v in flat.items():
        set_path(data, k, v)
    after = json.dumps(data, ensure_ascii=False)
    changed = before != after
    if apply and changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return 1 if changed else 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only", default=None, help="single locale for testing")
    args = ap.parse_args()

    targets = [args.only] if args.only else list(LANG_NAMES.keys())
    client = make_client()

    results: dict[str, dict] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(translate_locale, lang, client): lang for lang in targets}
        for fut in as_completed(futs):
            lang, flat, status = fut.result()
            if flat is None:
                errors[lang] = status
                print(f"  ✗ {lang}: {status}", file=sys.stderr)
            else:
                results[lang] = flat
                print(f"  ✓ {lang}")

    written = 0
    for lang, flat in results.items():
        written += merge_into_locale(lang, flat, args.apply)

    print(f"\n{'APPLIED' if args.apply else 'DRY RUN'}: {len(results)} translated, "
          f"{written} locale files {'updated' if args.apply else 'would change'}, "
          f"{len(errors)} errors.")
    if errors:
        print("Errors:", errors)


if __name__ == "__main__":
    main()
