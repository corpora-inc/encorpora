#!/usr/bin/env python3
"""Generate Tutomaton chrome translations and inject them into src/i18n.ts.

Reads the English `en` dict (the source of truth) out of src/i18n.ts, asks the
OpenAI API to translate the values into every target language (preserving the
{placeholder} tokens), and rewrites the block between GENERATED_LOCALES_START /
GENERATED_LOCALES_END with `en` + every generated locale.

Usage (from packs/tutomaton):
    OPENAI_API_KEY=... python3 tools/gen_i18n.py            # all manifest langs
    OPENAI_API_KEY=... python3 tools/gen_i18n.py fr de ja   # just these

Reads the key from the env, or from the repo-root .env (OPENAI_API_KEY=...).
Idempotent: re-running regenerates the block. English is always kept verbatim.
"""
import json, os, re, sys, pathlib, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
PACK = HERE.parent
I18N = PACK / "src" / "i18n.ts"
MANIFEST = PACK / "manifest.json"
MODEL = os.environ.get("TUTO_I18N_MODEL", "gpt-4o-mini")

def load_key():
    k = os.environ.get("OPENAI_API_KEY")
    if k:
        return k
    # walk up to find a .env
    for up in [PACK.parent.parent, PACK.parent.parent.parent]:
        env = up / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("OPENAI_API_KEY not found (env or .env)")

def extract_en():
    src = I18N.read_text()
    m = re.search(r"const en: Dict = \{(.*?)\n\}", src, re.S)
    if not m:
        sys.exit("could not find `const en: Dict = {...}` in i18n.ts")
    body = m.group(1)
    # parse `key: "value",` (values may contain escaped quotes). Decode via
    # json.loads on the quoted literal — the en dict has real Unicode (curly
    # quotes, em dashes); unicode_escape would mangle multi-byte UTF-8.
    pairs = re.findall(r'\n\s*(\w+):\s*"((?:[^"\\]|\\.)*)",', body)
    return {k: json.loads(f'"{v}"') for k, v in pairs}

def target_langs(argv):
    if argv:
        return argv
    m = json.loads(MANIFEST.read_text())
    return [l["code"] for l in m["languages"] if l["code"] != "en"]

def sys_prompt(lang):
    # NOTE: build by concatenation, not str.format — the text contains literal
    # {placeholder}/{name} braces that must NOT be treated as format fields.
    return (
        "You are a professional UI localizer for a language-learning app called Tutomaton. "
        "Translate the VALUES of this JSON object into " + lang + ". Keep keys unchanged. "
        "CRITICAL: preserve every {token} placeholder EXACTLY (same braces, same name) — "
        "for example {lang}, {model}, {size}, {error} must appear unchanged. "
        "Keep it natural, concise, app-UI tone (these are buttons, titles, hints). "
        "Return ONLY a JSON object mapping each key to its translated string."
    )

def translate(en_dict, lang, key):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": sys_prompt(lang)},
            {"role": "user", "content": json.dumps(en_dict, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.loads(r.read())
    txt = out["choices"][0]["message"]["content"]
    d = json.loads(txt)
    # validate placeholders survived
    for k, v in en_dict.items():
        want = set(re.findall(r"\{(\w+)\}", v))
        got = set(re.findall(r"\{(\w+)\}", d.get(k, "")))
        if want != got or k not in d:
            d[k] = v  # fall back to English for any broken/missing key
    return {k: d.get(k, v) for k, v in en_dict.items()}

def ts_literal(s):
    return json.dumps(s, ensure_ascii=False)

def extract_locales(en):
    """Parse the EXISTING LOCALES block out of i18n.ts so a partial --from-json
    can MERGE into it instead of resetting every untouched key to English.
    Returns {base: {key: value}} for every non-en locale already in the file."""
    src = I18N.read_text()
    m = re.search(
        r"// GENERATED_LOCALES_START\n(.*?)\n// GENERATED_LOCALES_END", src, re.S
    )
    if not m:
        return {}
    body = m.group(1)
    out = {}
    # match `  <code>: { ... },` blocks (code may be bare base like `pt`)
    for bm in re.finditer(r"\n  ([a-z]{2,3}(?:-[A-Za-z]+)?): \{(.*?)\n  \},", body, re.S):
        code, inner = bm.group(1), bm.group(2)
        if code == "en":
            continue
        pairs = re.findall(r'\n\s*(\w+):\s*"((?:[^"\\]|\\.)*)",', inner)
        # Values are written via json.dumps(ensure_ascii=False): real Unicode with
        # only \" \\ \n-style escapes. Reverse with json.loads on the quoted literal
        # — NEVER unicode_escape, which mangles raw multi-byte UTF-8 into mojibake.
        out[code] = {k: json.loads(f'"{v}"') for k, v in pairs}
    return out


def from_json(path, en):
    """Inject translations from a prebuilt JSON file: {code: {key: value}}.
    MERGES onto the locales already in i18n.ts: existing translated keys are
    preserved, the JSON's keys overlay them, and any key still missing falls
    back to English. Validates {placeholder} tokens per key."""
    data = json.loads(pathlib.Path(path).read_text())
    locales = {base: dict(d) for base, d in extract_locales(en).items()}
    for code, d in data.items():
        base = code.split("-")[0]
        if base == "en":
            continue
        locales.setdefault(base, {})
        for k, tv in d.items():
            if k not in en or not isinstance(tv, str) or not tv.strip():
                continue
            want = set(re.findall(r"\{(\w+)\}", en[k]))
            got = set(re.findall(r"\{(\w+)\}", tv))
            if want == got:
                locales[base][k] = tv
    # English-fallback for any key still missing in a locale (keeps Dict total)
    for base, merged in locales.items():
        for k, v in en.items():
            merged.setdefault(k, v)
    return locales

def main():
    en = extract_en()
    # --from-json <file> injects pre-translated JSON (no API). Otherwise call API.
    if len(sys.argv) >= 3 and sys.argv[1] == "--from-json":
        locales = from_json(sys.argv[2], en)
        print(f"injected {len(locales)} locales from {sys.argv[2]}")
    else:
        global key
        key = load_key()
        langs = target_langs(sys.argv[1:])
        print(f"translating {len(en)} keys into {len(langs)} languages via {MODEL}…")
        locales = {}
        for code in langs:
            base = code.split("-")[0]
            if base in locales:
                continue
            try:
                locales[base] = translate(en, code, base)
                print(f"  ✓ {code} ({base})")
            except Exception as e:
                print(f"  ✗ {code}: {e} — skipping (English fallback at runtime)")
    # build the LOCALES block
    lines = ["const LOCALES: Record<string, Partial<Dict>> = {", "  en,"]
    for base, d in sorted(locales.items()):
        lines.append(f"  {base}: {{")
        for k, v in d.items():
            lines.append(f"    {k}: {ts_literal(v)},")
        lines.append("  },")
    lines.append("}")
    block = "\n".join(lines)
    src = I18N.read_text()
    src = re.sub(
        r"// GENERATED_LOCALES_START\n.*?// GENERATED_LOCALES_END",
        "// GENERATED_LOCALES_START\n" + block + "\n// GENERATED_LOCALES_END",
        src, flags=re.S,
    )
    I18N.write_text(src)
    print(f"wrote {len(locales)} locales into {I18N}")

if __name__ == "__main__":
    main()
