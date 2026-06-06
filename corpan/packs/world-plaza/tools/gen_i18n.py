#!/usr/bin/env python3
"""Generate World Plaza translations and inject them into an i18n catalog.

TWO catalogs share this tool (selected by `--quests`; default = chrome):
  • CHROME  src/i18n/strings.ts — the UI-chrome catalog (buttons/menus/hints).
  • QUESTS  src/i18n/quests.ts  — the quest-CONTENT catalog (title / description /
    step label), #112. Same machinery; only the file, the `en` declaration, the
    GENERATED markers, and the LOCALES type line differ (see TARGETS).

Reads the English `en` dict (the source of truth) out of the target file, asks the
OpenAI API to translate the VALUES into every target language (preserving the
{placeholder} tokens), and rewrites the GENERATED_…_START / …_END block with `en`
+ every generated locale.

Mirrors tutomaton's tools/gen_i18n.py (the proven repo pattern, MEMORY
"tutomaton-i18n-tooling"). Deltas: QUOTED dotted keys ("welcome.title": "…", and
hyphenated quest ids like "quest.es-cafe.title"), and the .env search walks up to
encorpora/.env.

Usage (from packs/world-plaza):
    OPENAI_API_KEY=... python3 tools/gen_i18n.py                     # chrome, all langs
    OPENAI_API_KEY=... python3 tools/gen_i18n.py --quests            # quests, all langs
    OPENAI_API_KEY=... python3 tools/gen_i18n.py --quests fr de ja   # quests, just these
    python3 tools/gen_i18n.py --quests --from-json <file.json>       # inject prebuilt JSON

Idempotent: re-running regenerates the block. English is always kept verbatim.
GOTCHA (cost time before): NEVER background this — a backgrounded run hangs on a
dropped network connection (CPU→0, no write). Run FOREGROUND in small batches, OR
build a key-subset JSON and `--from-json` (offline, insertions-only diff).
Pitfalls burned-in: never unicode_escape TS values (mojibake); locale regex allows
yue; post-merge diff is insertions-only.
"""
import json, os, re, sys, pathlib, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
PACK = HERE.parent
MANIFEST = PACK / "manifest.json"
MODEL = os.environ.get("WP_I18N_MODEL", "gpt-4o-mini")

# Two catalogs share this tool — the UI-chrome catalog (`strings.ts`) and the
# quest-CONTENT catalog (`quests.ts`, #112). They differ only in the file, the
# `en` declaration, the GENERATED markers, and the LOCALES type line; the
# translate/merge/inject machinery is identical. `--quests` selects the quest
# target; default is chrome. The `en`-extraction regex tolerates either type
# annotation (`Dict` for chrome, `Record<string, string>` for quests).
TARGETS = {
    "chrome": {
        "file": PACK / "src" / "i18n" / "strings.ts",
        "marker": "GENERATED_LOCALES",
        "locales_type": "Record<string, Partial<Dict>>",
    },
    "quests": {
        "file": PACK / "src" / "i18n" / "quests.ts",
        "marker": "GENERATED_QUEST_LOCALES",
        "locales_type": "Record<string, Record<string, string>>",
    },
}
# Selected at startup by `configure()`; module globals so the helper functions
# (extract_en/extract_locales/main) read the active target without threading args.
I18N = TARGETS["chrome"]["file"]
MARKER = TARGETS["chrome"]["marker"]
LOCALES_TYPE = TARGETS["chrome"]["locales_type"]


def configure(target):
    """Point the module globals at the chosen catalog ('chrome' | 'quests')."""
    global I18N, MARKER, LOCALES_TYPE
    cfg = TARGETS[target]
    I18N, MARKER, LOCALES_TYPE = cfg["file"], cfg["marker"], cfg["locales_type"]

# The Corpán shipping language set (the same ~45 tutomaton/pronunciation-coach
# ship). World Plaza's manifest only lists `en`, so we default to this set.
DEFAULT_LANGS = [
    "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fr",
    "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "mr", "ms",
    "ne", "nl", "no", "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv",
    "sw", "ta", "te", "th", "tr", "uk", "ur", "vi", "yue", "zh",
]


def load_key():
    k = os.environ.get("OPENAI_API_KEY")
    if k:
        return k
    # Walk up to find a .env (packs/, corpan/, encorpora/).
    for up in [PACK.parent.parent, PACK.parent.parent.parent,
               PACK.parent.parent.parent.parent]:
        env = up / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("OPENAI_API_KEY not found (env or .env)")


def extract_en():
    src = I18N.read_text()
    # The `en` declaration is `const en: Dict = {` (chrome) or
    # `const en: Record<string, string> = {` (quests) — accept either annotation.
    m = re.search(r"const en(?::[^=]+)? = \{(.*?)\n\}", src, re.S)
    if not m:
        sys.exit(f"could not find `const en ... = {{...}}` in {I18N.name}")
    body = m.group(1)
    # QUOTED dotted keys: `"welcome.title": "value",` (values may contain escaped
    # quotes). Decode values via json.loads on the quoted literal — NEVER
    # unicode_escape (mangles multi-byte UTF-8 → mojibake).
    pairs = re.findall(r'\n\s*"([\w.-]+)":\s*"((?:[^"\\]|\\.)*)",', body)
    return {k: json.loads(f'"{v}"') for k, v in pairs}


def target_langs(argv):
    if argv:
        return argv
    return list(DEFAULT_LANGS)


def sys_prompt(lang):
    # Build by concatenation, not str.format — the text contains literal
    # {placeholder} braces that must NOT be treated as format fields.
    return (
        "You are a professional UI localizer for a language-learning game called "
        "World Plaza — a warm, understated paper-craft town where you meet AI "
        "characters and real players. Translate the VALUES of this JSON object "
        "into " + lang + ". Keep keys unchanged. "
        "CRITICAL: preserve every {token} placeholder EXACTLY (same braces, same "
        "name) — for example {name}, {lang}, {place}, {item}, {who}, {done}, "
        "{total}, {level}, {where}, {quest}, {n} must appear unchanged. "
        "Keep it natural, concise, warm app-UI tone (these are titles, buttons, "
        "hints — never marketing hype). Curly quotes/em-dashes are welcome. "
        "Return ONLY a JSON object mapping each key to its translated string."
    )


def translate(en_dict, lang, code):
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
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.loads(r.read())
    txt = out["choices"][0]["message"]["content"]
    d = json.loads(txt)
    # Validate placeholders survived; fall back to English for any broken key.
    for k, v in en_dict.items():
        want = set(re.findall(r"\{(\w+)\}", v))
        got = set(re.findall(r"\{(\w+)\}", d.get(k, "")))
        if want != got or k not in d:
            d[k] = v
    return {k: d.get(k, v) for k, v in en_dict.items()}


def ts_literal(s):
    return json.dumps(s, ensure_ascii=False)


def extract_locales(en):
    """Parse the EXISTING LOCALES block so a partial run MERGES instead of
    resetting every untouched key to English. Returns {base: {key: value}}."""
    src = I18N.read_text()
    m = re.search(
        rf"// {MARKER}_START\n(.*?)\n// {MARKER}_END", src, re.S
    )
    if not m:
        return {}
    body = m.group(1)
    out = {}
    for bm in re.finditer(r"\n  ([a-z]{2,3}(?:-[A-Za-z]+)?): \{(.*?)\n  \},", body, re.S):
        code, inner = bm.group(1), bm.group(2)
        if code == "en":
            continue
        pairs = re.findall(r'\n\s*"([\w.-]+)":\s*"((?:[^"\\]|\\.)*)",', inner)
        out[code] = {k: json.loads(f'"{v}"') for k, v in pairs}
    return out


def from_json(path, en):
    """Inject translations from {code: {key: value}}, merging onto existing
    locales; English-fallback any still-missing key. Validates placeholders."""
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
            if set(re.findall(r"\{(\w+)\}", en[k])) == set(re.findall(r"\{(\w+)\}", tv)):
                locales[base][k] = tv
    for base, merged in locales.items():
        for k, v in en.items():
            merged.setdefault(k, v)
    return locales


def main():
    # Catalog selector: `--quests` (or `--target quests|chrome`) anywhere in argv,
    # popped before the rest is parsed. Default = chrome (back-compat).
    argv = list(sys.argv[1:])
    target = "chrome"
    if "--quests" in argv:
        target = "quests"
        argv.remove("--quests")
    if "--target" in argv:
        i = argv.index("--target")
        target = argv[i + 1]
        del argv[i : i + 2]
    configure(target)

    en = extract_en()
    if len(argv) >= 2 and argv[0] == "--from-json":
        locales = from_json(argv[1], en)
        print(f"[{target}] injected {len(locales)} locales from {argv[1]}")
    else:
        global key
        key = load_key()
        langs = target_langs(argv)
        print(f"[{target}] translating {len(en)} keys into {len(langs)} languages via {MODEL}…")
        # Preserve any already-translated locales so a partial/failed run never
        # resets untouched languages to English.
        locales = {base: dict(d) for base, d in extract_locales(en).items()}
        for code in langs:
            base = code.split("-")[0]
            try:
                locales[base] = translate(en, code, base)
                print(f"  ✓ {code} ({base})")
            except Exception as e:
                print(f"  ✗ {code}: {e} — skipping (English fallback at runtime)")
    # Build the LOCALES block (type line differs per catalog).
    lines = [f"const LOCALES: {LOCALES_TYPE} = {{", "  en,"]
    for base, d in sorted(locales.items()):
        lines.append(f"  {base}: {{")
        for k in en:  # stable key order = source order → insertions-only diffs
            if k in d:
                lines.append(f"    {ts_literal(k)}: {ts_literal(d[k])},")
        lines.append("  },")
    lines.append("}")
    block = "\n".join(lines)
    src = I18N.read_text()
    src = re.sub(
        rf"// {MARKER}_START\n.*?// {MARKER}_END",
        f"// {MARKER}_START\n" + block + f"\n// {MARKER}_END",
        src, flags=re.S,
    )
    I18N.write_text(src)
    print(f"[{target}] wrote {len(locales)} locales into {I18N}")


if __name__ == "__main__":
    main()
