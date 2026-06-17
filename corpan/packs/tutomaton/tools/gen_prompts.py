#!/usr/bin/env python3
"""Generate prompt-only Tutomaton language modules for every supported language.

WHY THE METADATA IS EMBEDDED HERE
---------------------------------
The brief pointed at dja/cor/fixtures/languages.json as the source of truth with
fields code/name/native_name/tts_locale/rtl/romanization/lcid. In this repo that
fixture only carries {code, name} for 30 languages and there is no single file
that also has the native endonym + BCP-47 TTS locale + RTL flag + romanization
label. The native endonyms below are cross-checked against the app's own
AUTONYM_BY_LANG (corpan-app/src/store/translations.ts); TTS locales mirror the
app's voiceLanguageCode convention (es-MX, zh-CN, ...). The full per-language
table lives here (LANGS) so generation is reproducible and one-stop. Edit LANGS
to add/adjust a language, then re-run.

WHAT IT WRITES (for every language NOT hand-authored — skips es, zh, en)
-----------------------------------------------------------------------
  packs/tutomaton/languages/<code>/module.json
  packs/tutomaton/languages/<code>/prompts/system_prompt.txt
  packs/tutomaton/languages/<code>/prompts/grounding_instruction.txt

These are PROMPT-ONLY tutors: no bundled retriever, no sqlite. The
LanguageManager._loadRetriever no-op fallback makes them run ungrounded
(0 corpora). A language gains RAG later by adding a bundled retriever + sqlite;
nothing here forecloses that.

It also emits /tmp/tutomaton_manifest_langs.json — the manifest languages[]
fragment for the prompt-only langs (es/zh keep their real CDN URLs + sha).

Usage:  python tools/gen_prompts.py
Idempotent: rewrites the generated files each run. Writes a run summary to
tools/_last_run_report.txt.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PACK_ROOT = os.path.abspath(os.path.join(HERE, ".."))
LANG_DIR = os.path.join(PACK_ROOT, "languages")
CDN = "https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages"

# Hand-authored modules with real RAG corpora — never overwrite.
# (es' system prompt is bent toward the new persona by hand, not by this script.)
SKIP_CODES = {"es", "zh", "en"}

# code, English name, native endonym, BCP-47 TTS locale, RTL, romanization label
LANGS = [
    ("es", "Spanish", "Español", "es-MX", False, None),
    ("zh", "Mandarin Chinese", "普通话", "zh-CN", False, "Pinyin"),
    ("fr", "French", "Français", "fr-FR", False, None),
    ("de", "German", "Deutsch", "de-DE", False, None),
    ("it", "Italian", "Italiano", "it-IT", False, None),
    ("pt-BR", "Portuguese (Brazilian)", "Português (Brasil)", "pt-BR", False, None),
    ("pt-PT", "Portuguese (European)", "Português (Portugal)", "pt-PT", False, None),
    ("ru", "Russian", "Русский", "ru-RU", False, None),
    ("zh-Hans", "Chinese (Simplified)", "简体中文", "zh-CN", False, "Pinyin"),
    ("zh-Hant", "Chinese (Traditional)", "繁體中文", "zh-TW", False, "Pinyin"),
    ("yue-Hant-HK", "Cantonese (Traditional)", "粵語", "zh-HK", False, "Jyutping"),
    ("ja", "Japanese", "日本語", "ja-JP", False, "Romaji"),
    ("ko-polite", "Korean (Polite)", "한국어", "ko-KR", False, "Revised Romanization"),
    ("vi", "Vietnamese", "Tiếng Việt", "vi-VN", False, None),
    ("th", "Thai", "ไทย", "th-TH", False, "RTGS"),
    ("id", "Indonesian", "Bahasa Indonesia", "id-ID", False, None),
    ("ms", "Malay", "Bahasa Melayu", "ms-MY", False, None),
    ("hi", "Hindi", "हिन्दी", "hi-IN", False, "IAST"),
    ("bn", "Bengali", "বাংলা", "bn-IN", False, "IAST"),
    ("ta", "Tamil", "தமிழ்", "ta-IN", False, "ISO 15919"),
    ("gu", "Gujarati", "ગુજરાતી", "gu-IN", False, "IAST"),
    ("kn", "Kannada", "ಕನ್ನಡ", "kn-IN", False, "ISO 15919"),
    ("mr", "Marathi", "मराठी", "mr-IN", False, "IAST"),
    ("ne", "Nepali", "नेपाली", "ne-NP", False, "IAST"),
    ("pa-Guru", "Punjabi (Gurmukhi)", "ਪੰਜਾਬੀ", "pa-IN", False, "IAST"),
    ("ur", "Urdu", "اردو", "ur-PK", True, "ALA-LC"),
    ("ar", "Arabic (Standard)", "العربية", "ar-SA", True, "ALA-LC"),
    ("fa", "Persian", "فارسی", "fa-IR", True, "DMG"),
    ("he", "Hebrew", "עברית", "he-IL", True, "ISO 259"),
    ("pl", "Polish", "Polski", "pl-PL", False, None),
    ("cs", "Czech", "Čeština", "cs-CZ", False, None),
    ("sk", "Slovak", "Slovenčina", "sk-SK", False, None),
    ("sl", "Slovenian", "Slovenščina", "sl-SI", False, None),
    ("hr", "Croatian", "Hrvatski", "hr-HR", False, None),
    ("sr", "Serbian", "Српски", "sr-RS", False, "Latin (Gaj)"),
    ("bg", "Bulgarian", "Български", "bg-BG", False, "ISO 9"),
    ("uk", "Ukrainian", "Українська", "uk-UA", False, "ISO 9"),
    ("ro", "Romanian", "Română", "ro-RO", False, None),
    ("hu", "Hungarian", "Magyar", "hu-HU", False, None),
    ("ca", "Catalan", "Català", "ca-ES", False, None),
    ("lt", "Lithuanian", "Lietuvių", "lt-LT", False, None),
    ("nl", "Dutch", "Nederlands", "nl-NL", False, None),
    ("sv", "Swedish", "Svenska", "sv-SE", False, None),
    ("da", "Danish", "Dansk", "da-DK", False, None),
    ("no", "Norwegian", "Norsk", "nb-NO", False, None),
    ("fi", "Finnish", "Suomi", "fi-FI", False, None),
    ("el", "Greek", "Ελληνικά", "el-GR", False, "ISO 843"),
    ("tr", "Turkish", "Türkçe", "tr-TR", False, None),
    ("en", "English", "English", "en-US", False, None),
]


def build_system_prompt(name, native, tts, rtl, rom):
    return (
        f"You are a friendly {name} tutor and conversation partner. "
        f"Always reply in {native} and teach through simple, natural conversation.\n"
    )


def build_grounding(name, native):
    return """Use the reference below only when it helps. Reply naturally and never mention the reference or its internal markup.

Reference:
"""


def main():
    generated, hand, template_only = [], [], []
    manifest_langs = []

    for code, name, native, tts, rtl, rom in LANGS:
        if code not in {"es", "zh"}:
            manifest_langs.append(
                {
                    "code": code,
                    "displayName": {"en": name, code: native},
                    "voiceLanguageCode": tts,
                    "contentVersion": "0.1.0",
                    "sizeMb": 1,
                    "moduleUrl": f"{CDN}/{code}-0.1.0.zip",
                    "sha256": "",
                }
            )

        if code in SKIP_CODES:
            continue

        d = os.path.join(LANG_DIR, code)
        os.makedirs(os.path.join(d, "prompts"), exist_ok=True)

        system = build_system_prompt(name, native, tts, rtl, rom)
        template_only.append(code)

        with open(os.path.join(d, "prompts", "system_prompt.txt"), "w", encoding="utf-8") as f:
            f.write(system)
        with open(os.path.join(d, "prompts", "grounding_instruction.txt"), "w", encoding="utf-8") as f:
            f.write(build_grounding(name, native))

        module = {
            "code": code,
            "displayName": {"en": name, code: native},
            "voiceLanguageCode": tts,
            "contentVersion": "0.1.0",
            "minTutomatonVersion": "0.1.0",
            "files": {
                "database": "",
                "systemPrompt": "prompts/system_prompt.txt",
                "groundingInstruction": "prompts/grounding_instruction.txt",
                "retriever": "",
            },
            "rag": {"schemaVersion": 1, "themeBypassEnabled": False},
        }
        with open(os.path.join(d, "module.json"), "w", encoding="utf-8") as f:
            json.dump(module, f, ensure_ascii=False, indent=2)
            f.write("\n")
        generated.append(code)

    with open("/tmp/tutomaton_manifest_langs.json", "w", encoding="utf-8") as f:
        json.dump(manifest_langs, f, ensure_ascii=False, indent=2)

    report = "\n".join(
        [
            f"languages in LANGS: {len(LANGS)}",
            f"generated prompt-only modules: {len(generated)}",
            f"hand-tuned in-language examples ({len(hand)}): {', '.join(hand)}",
            f"template-only ({len(template_only)}): {', '.join(template_only)}",
            f"manifest fragment ({len(manifest_langs)} langs) -> /tmp/tutomaton_manifest_langs.json",
        ]
    )
    print(report)


if __name__ == "__main__":
    main()
