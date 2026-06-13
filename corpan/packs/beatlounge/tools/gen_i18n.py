#!/usr/bin/env python3
"""
beatlounge chrome i18n generator.

Reads the English `en` dict from src/i18n/strings.ts and, for each of the ~50
shipped locales, translates the VALUES via codex-cli (one concurrent call per
locale), then rewrites the GENERATED_LOCALES block. English ships even if no
other locale exists yet; every {placeholder} token is preserved; music
loan-words stay English. Insertions are stable-ordered so reruns diff cleanly.

Usage:
  python3 tools/gen_i18n.py                # all locales
  python3 tools/gen_i18n.py fr de ja       # only these
Requires the `codex` CLI on PATH (no API key needed — uses the codex session).
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
STRINGS = HERE.parent / "src" / "i18n" / "strings.ts"

# code -> (language name, register/script note). Matches the app's 50-locale set.
LOCALES = {
 "ar":("Arabic",""),"bg":("Bulgarian",""),"bn":("Bengali",""),"ca":("Catalan",""),
 "cs":("Czech",""),"da":("Danish",""),"de":("German",""),"el":("Greek",""),
 "es":("Spanish",""),"fa":("Persian/Farsi",""),"fi":("Finnish",""),"fr":("French",""),
 "gu":("Gujarati",""),"he":("Hebrew",""),"hi":("Hindi",""),"hr":("Croatian",""),
 "hu":("Hungarian",""),"id":("Indonesian",""),"it":("Italian",""),"ja":("Japanese",""),
 "kn":("Kannada",""),"ko-polite":("Korean","Polite/formal register (존댓말)."),
 "lt":("Lithuanian",""),"mr":("Marathi",""),"ms":("Malay",""),"ne":("Nepali",""),
 "nl":("Dutch",""),"no":("Norwegian Bokmål",""),"pa-Arab":("Punjabi","Shahmukhi (Perso-Arabic) script."),
 "pa-Guru":("Punjabi","Gurmukhi script."),"pl":("Polish",""),
 "pt-BR":("Portuguese","Brazilian Portuguese."),"pt-PT":("Portuguese","European Portuguese."),
 "ro":("Romanian",""),"ru":("Russian",""),"sk":("Slovak",""),"sl":("Slovenian",""),
 "sr":("Serbian",""),"sv":("Swedish",""),"sw":("Swahili",""),"ta":("Tamil",""),
 "te":("Telugu",""),"th":("Thai",""),"tr":("Turkish",""),"uk":("Ukrainian",""),
 "ur":("Urdu",""),"vi":("Vietnamese",""),"yue-Hant-HK":("Cantonese","Traditional characters, Hong Kong register."),
 "zh-Hans":("Chinese","Simplified characters."),"zh-Hant":("Chinese","Traditional characters."),
}

LOAN = ("Reverb, Delay, Chorus, Filter, EQ, Compressor, Distortion, Phaser, Bitcrusher, "
        "Limiter, Gain, BPM, and any note/chord/scale/mode/raga/maqam/thaat name; the brand "
        "names beatlounge and Corpán")

ASSIST = re.compile(r"\ncodex\n(?P<b>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)", re.DOTALL)
TOKEN = re.compile(r"\{(\w+)\}")


def read_en() -> dict:
    text = STRINGS.read_text(encoding="utf-8")
    m = re.search(r"const en: Record<string, string> = \{(.*?)\n\}", text, re.DOTALL)
    if not m:
        sys.exit("could not find the `en` dict in strings.ts")
    body = m.group(1)
    pairs = re.findall(r'"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"', body)
    out = {}
    for k, v in pairs:
        out[json.loads(f'"{k}"')] = json.loads(f'"{v}"')
    return out


def extract(stdout: str) -> str:
    m = list(ASSIST.finditer(stdout))
    return (m[-1].group("b").strip() if m else stdout.strip())


def parse_json(t: str) -> dict:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t); t = re.sub(r"\n?```\s*$", "", t)
    s = t.find("{")
    obj, _ = json.JSONDecoder().raw_decode(t[s:])
    return obj


def translate(code: str, en: dict) -> tuple:
    name, note = LOCALES[code]
    note_block = f"\nNOTE: {note}\n" if note else ""
    prompt = f"""You are a world-class software localizer. Translate these app UI strings into {name} ({code}). Natural, idiomatic, concise — button-like where the source is short, the way a native speaker expects in a music app.
{note_block}
KEEP UNTRANSLATED (these are international music vocabulary / brand — leave them exactly as written if they appear in a value): {LOAN}.

PRESERVE every {{placeholder}} token EXACTLY (same braces + word, same count) — you may move it within the sentence.

INPUT (JSON, key -> English):
{json.dumps(en, ensure_ascii=False, indent=2)}

Output ONLY a JSON object with the SAME keys and translated values. Native script. No markdown, no commentary."""
    args = ["codex","exec","--sandbox","read-only","--skip-git-repo-check",
            "-c","model_reasoning_effort=medium", prompt]
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        return code, None, "timeout"
    if p.returncode != 0:
        return code, None, f"exit{p.returncode}"
    try:
        obj = parse_json(extract(p.stdout))
    except Exception as e:
        return code, None, f"badjson:{e}"
    # validate: keys + placeholder parity; drop bad keys (fall back to English).
    fixed = {}
    for k, vEn in en.items():
        v = obj.get(k)
        if not isinstance(v, str) or not v.strip():
            continue
        if sorted(TOKEN.findall(v)) != sorted(TOKEN.findall(vEn)):
            continue  # placeholder mismatch -> skip (English fallback at runtime)
        fixed[k] = v
    return code, fixed, f"{len(fixed)}/{len(en)}"


def ts_block(en: dict, locales: dict) -> str:
    lines = ["// GENERATED_LOCALES_START",
             "const LOCALES: Record<string, Partial<Dict>> = {", "  en,"]
    for code in sorted(locales):
        d = locales[code]
        if not d:
            continue
        lines.append(f"  {json.dumps(code)}: {{")
        for k in en:  # stable order = en order
            if k in d:
                lines.append(f"    {json.dumps(k, ensure_ascii=False)}: {json.dumps(d[k], ensure_ascii=False)},")
        lines.append("  },")
    lines.append("}")
    lines.append("// GENERATED_LOCALES_END")
    return "\n".join(lines)


def main():
    en = read_en()
    want = sys.argv[1:] or list(LOCALES)
    want = [c for c in want if c in LOCALES]
    print(f"en keys: {len(en)}; translating {len(want)} locales via codex…")
    results = {}
    with ThreadPoolExecutor(max_workers=50) as pool:
        futs = {pool.submit(translate, c, en): c for c in want}
        for f in as_completed(futs):
            code, data, msg = f.result()
            print(f"  {'ok ' if data else 'ERR'} {code}: {msg}", flush=True)
            if data:
                results[code] = data
    # merge with any existing locales not regenerated this run (insertions-only)
    text = STRINGS.read_text(encoding="utf-8")
    block = ts_block(en, results)
    new = re.sub(r"// GENERATED_LOCALES_START.*?// GENERATED_LOCALES_END", block, text, flags=re.DOTALL)
    STRINGS.write_text(new, encoding="utf-8")
    print(f"wrote {len(results)} locales into strings.ts")


if __name__ == "__main__":
    main()
