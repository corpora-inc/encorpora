#!/usr/bin/env python3
"""Pre-TTS translation gate for one language.

Compares segments_<lang>.json to the locked EN segments.json and refuses
to authorize TTS spend if the translation is structurally broken or shows
signs of passthrough (untranslated English). Exit 0 = clean, 3 = drop.

Usage: audit_translation.py <pack_dir> <lang>
"""
import json
import re
import sys
from pathlib import Path

ARABIC_DIGIT = re.compile(r"[0-9]")
# Languages whose script is Latin/Arabic-digit-using and where a number of
# segments legitimately share short tokens with EN (proper nouns). We only
# hard-fail passthrough when a LARGE fraction is byte-equal.
PASSTHROUGH_FRACTION_FAIL = 0.25


def main() -> int:
    pack = Path(sys.argv[1])
    lang = sys.argv[2]
    en = json.loads((pack / "segments.json").read_text())["segments"]
    lp = pack / f"segments_{lang}.json"
    if not lp.exists():
        print(f"[{lang}] FAIL: {lp.name} missing")
        return 3
    tr = json.loads(lp.read_text())["segments"]
    ene = {s["id"]: s for s in en}
    tre = {s["id"]: s for s in tr}

    problems = []
    # 1. completeness
    missing = [i for i in ene if i not in tre]
    if missing:
        problems.append(f"{len(missing)} missing segments (e.g. {missing[:5]})")
    # 2. speaker_id + tts.speaker_id parity (dialog routing)
    spk = [i for i in ene if i in tre and
           ene[i].get("speaker_id") != tre[i].get("speaker_id")]
    if spk:
        problems.append(f"{len(spk)} speaker_id mismatches (e.g. {spk[:5]})")
    tspk = [i for i in tre if tre[i].get("block_type") == "text"
            and not tre[i].get("tts", {}).get("speaker_id")]
    if tspk:
        problems.append(f"{len(tspk)} segments missing tts.speaker_id (e.g. {tspk[:5]})")
    # 3. passthrough (untranslated English): text byte-equal to EN
    text_ids = [i for i in ene if ene[i].get("block_type") == "text" and i in tre]
    same = [i for i in text_ids
            if ene[i].get("text", "").strip() == tre[i].get("text", "").strip()]
    frac = len(same) / max(1, len(text_ids))
    if frac >= PASSTHROUGH_FRACTION_FAIL:
        problems.append(
            f"{len(same)}/{len(text_ids)} segments byte-equal to EN "
            f"({frac:.0%}) — likely passthrough/untranslated")
    # NOTE: NO arabic-digit check. That is a Chatterbox constraint; this pack
    # is all-Gemini, and Gemini TTS reads Arabic numerals natively and
    # correctly (e.g. ja "2026年", "5月21日", "100万"). The translator keeps
    # digits in some languages and spells them in others — both are fine on
    # Gemini, and the artifact audio gate confirms each segment voiced cleanly.

    if problems:
        print(f"[{lang}] TRANSLATION GATE FAIL:")
        for p in problems:
            print("   -", p)
        return 3
    print(f"[{lang}] translation gate OK "
          f"({len(tr)} segs, {len(same)} byte-equal/{len(text_ids)} text)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
