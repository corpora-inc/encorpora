"""Scan every published pack's segments_{lang}.json for display vs tts.text
content divergence beyond the legit digit-vs-spelled-out convention.

Heuristic: normalize both fields by stripping digits, language-specific
spelled-out number words, and punctuation. If the remaining word-sets
diverge (Jaccard < 0.85), the seg is suspect — likely a translation-phase
bug or pre-fix auto_rewrite stomp.

Output: ~/encorpora/books/tech/ai-this-week/lang_records/display_tts_divergence.jsonl
+ summary per lang.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1")
OUT = Path("/home/skyl/encorpora/books/tech/ai-this-week/lang_records/display_tts_divergence.jsonl")

# Words in many target languages that are spelled-out numbers we should
# ignore when computing content divergence. Conservative: covers the
# most common 0-100 + months + currency words.
NUMBER_WORDS = set("""
zero one two three four five six seven eight nine ten eleven twelve thirteen
fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty
sixty seventy eighty ninety hundred thousand million billion trillion
january february march april may june july august september october november december
percent point dollars cents
cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce
quince dieciseis diecisiete dieciocho diecinueve veinte treinta cuarenta cincuenta
sesenta setenta ochenta noventa cien ciento mil millon millones por ciento
zero un une deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze
quinze seize dixsept dixhuit dixneuf vingt trente quarante cinquante soixante septante
octante huitante nonante cent mille million milliard pourcent
null eins zwei drei vier funf sechs sieben acht neun zehn elf zwolf dreizehn vierzehn
funfzehn sechzehn siebzehn achtzehn neunzehn zwanzig dreissig vierzig funfzig sechzig
siebzig achtzig neunzig hundert tausend million milliarde prozent
zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici
quattordici quindici sedici diciassette diciotto diciannove venti trenta quaranta
cinquanta sessanta settanta ottanta novanta cento mille milione miliardo percento
nul een twee drie vier vijf zes zeven acht negen tien elf twaalf dertien veertien
vijftien zestien zeventien achttien negentien twintig dertig veertig vijftig zestig
zeventig tachtig negentig honderd duizend miljoen miljard procent
nula jedan jedna dva dvije tri cetiri pet sest sedam osam devet deset jedanaest
dvanaest trinaest cetrnaest petnaest sesnaest sedamnaest osamnaest devetnaest
dvadeset trideset cetrdeset pedeset sezdeset sedamdeset osamdeset devedeset sto
hiljada tisuca milijun milijarda postotak posto
trinaestog sedmog petog sestog cetvrtog desetog dvanaestog cetrnaestog petnaestog
sesnaestog dvadesetog tridesetog tisuce sestog dvadeset
""".split())

# Months and date helpers for the issue
DATE_BITS = set("""
maj may mai mayo mayis svibnja maja maja maja maja maja
""".split())


def norm(s: str) -> set[str]:
    """Return a normalized word-set for divergence detection."""
    s = unicodedata.normalize("NFC", s).casefold()
    # Strip digits and common punctuation
    s = re.sub(r"[0-9]", " ", s)
    s = re.sub(r"[.,!?\"'()\[\]{};:\-—–%/§*]", " ", s)
    words = set()
    for w in s.split():
        if len(w) < 2:
            continue
        if w in NUMBER_WORDS or w in DATE_BITS:
            continue
        words.add(w)
    return words


def find_pack_segs():
    """Return list of (lang, segments_file)."""
    out = []
    out.append(("en", PACK / "segments.json"))
    for f in sorted(PACK.glob("segments_*.json")):
        lang = f.stem.replace("segments_", "")
        out.append((lang, f))
    return out


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    by_lang_count = {}
    for lang, path in find_pack_segs():
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except Exception as e:
            print(f"[{lang}] read err: {e}")
            continue
        segs = data.get("segments", data) if isinstance(data, dict) else data
        suspect_n = 0
        for s in segs:
            sid = s.get("id", "")
            if not sid.startswith("ch"):
                continue
            disp = s.get("text", "")
            tts = (s.get("tts") or {}).get("text", "")
            if not tts or not disp:
                continue
            wd, wt = norm(disp), norm(tts)
            if not wd and not wt:
                continue
            inter = wd & wt
            union = wd | wt
            jac = len(inter) / len(union) if union else 1.0
            extra_tts = sorted(wt - wd)
            extra_disp = sorted(wd - wt)
            # Suspect if jaccard low or many non-number extras
            if jac < 0.85 or len(extra_tts) >= 3 or len(extra_disp) >= 3:
                rows.append({
                    "lang": lang,
                    "seg_id": sid,
                    "jaccard": round(jac, 3),
                    "extra_tts": extra_tts[:8],
                    "extra_disp": extra_disp[:8],
                    "display": disp[:160],
                    "tts": tts[:160],
                })
                suspect_n += 1
        by_lang_count[lang] = suspect_n

    with OUT.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # Summary
    print(f"\n=== Display vs tts.text divergence audit ({sum(by_lang_count.values())} suspects across {len(by_lang_count)} langs) ===")
    for lang in sorted(by_lang_count):
        n = by_lang_count[lang]
        marker = "  " if n == 0 else "  ⚠️ " if n <= 3 else "  🚨 "
        print(f"{marker}{lang:6} : {n} suspect segs")
    print(f"\nFull rows: {OUT}")


if __name__ == "__main__":
    main()
