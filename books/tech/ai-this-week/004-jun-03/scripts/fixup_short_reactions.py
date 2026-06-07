#!/usr/bin/env python3
"""Per-language rewrites for the short-reaction segments that Gemini
returns as ~250ms stubs (effectively empty audio).

The CONVENTIONS.md guidance is "When Vindy reacts, use 4-8 words" —
the EN manuscript shipped a few one-word reactions ("Sure.", "Exactly.",
"Third.", "And then?"). They work in EN at 0.7-1.3s but several
non-EN languages translated them to a single short word that Gemini
won't synthesize cleanly. This script rewrites only those segments
in only those languages to a natural longer reaction in the target
language, leaving everything else untouched.

After running, resync the affected segments and re-run master +
audio_gate + publish.

Usage:
    python3 fixup_short_reactions.py
"""
from __future__ import annotations

import json
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/004-jun-03"
            "/packs/vindy-ron-gemini-v1")

# Map (lang, seg_id) -> longer natural reaction in target lang.
# Source EN segments:
#   ch00-068 analyst: "Sure."
#   ch00-093 analyst: "Exactly."
#   ch00-116 host:    "Third."
#   ch00-178 host:    "And then?"
REWRITES: dict[tuple[str, str], str] = {
    # German
    ("de", "ch00-093"): "Genau, so ist es.",
    # Thai
    ("th", "ch00-068"): "ได้ครับ เริ่มเลยนะ",
    # Finnish
    ("fi", "ch00-178"): "Ja sitten mitä tapahtui?",
    # Slovak
    ("sk", "ch00-068"): "Jasne, poďme na to.",
    # Malay
    ("ms", "ch00-068"): "Ya, boleh kita teruskan.",
    # Telugu
    ("te", "ch00-116"): "మూడవ తలెత్తుబాటు.",
    # Bengali
    ("bn", "ch00-116"): "তৃতীয় খবরটা বলি।",
    # Marathi
    ("mr", "ch00-093"): "अगदी बरोबर बोललात.",
    # Romanian — ch00-101 same "lens" metaphor refusal as ES.
    ("ro", "ch00-101"): "Trecem rapid, cu accent pe ecosistemul open-source.",
    # Gujarati — ch00-061 language-leaked to Punjabi; rewrite cleanly.
    ("gu", "ch00-061"): "બે વર્ષ પહેલાં આવું વાક્ય શક્ય જ ન હતું.",
    # Gujarati — short-reaction stubs on Sure/Exactly
    ("gu", "ch00-068"): "હા, ચોક્કસ ચાલુ રાખીએ.",
    ("gu", "ch00-093"): "બરાબર, એ જ વાત છે.",
    ("gu", "ch00-116"): "ત્રીજો સમાચાર.",
    # Hindi — ch00-068 "Sure."
    ("hi", "ch00-068"): "हाँ, बिल्कुल आगे बढ़ते हैं.",
    # Korean — ch00-068 "Sure."
    ("ko", "ch00-068"): "네, 그렇게 진행하시죠.",
}


def main() -> None:
    by_lang: dict[str, list[str]] = {}
    for (lang, sid), new_text in REWRITES.items():
        by_lang.setdefault(lang, []).append(sid)
        p = PACK / f"segments_{lang}.json"
        d = json.loads(p.read_text())
        for s in d["segments"]:
            if s["id"] == sid:
                s["text"] = new_text
                s["text_markdown"] = new_text
                s["tts"]["text"] = new_text
                break
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        print(f"[{lang}] {sid} → {new_text}")

    print()
    print("To complete recovery, for each lang:")
    for lang, sids in by_lang.items():
        ids = ",".join(sids)
        print(f"  python3 scripts/reset_segments.py {PACK} {lang} {ids} && \\")
        print(f"  ttsctl generate {PACK} --lang {lang}  &&  ttsctl master {PACK} --lang {lang} --all  &&  \\")
        print(f"  python3 scripts/audio_gate.py {PACK} {lang}  &&  \\")
        print(f"  ttsctl publish {PACK} --lang {lang} --voice-id gemini-vindy --version 0.1.0 --with-preview")


if __name__ == "__main__":
    main()
