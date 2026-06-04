#!/usr/bin/env python3
"""check-translations — World Plaza localization FRESHNESS gate (LOCALIZATION.md §8).

Keeps localization current automatically, no big pushes. Two checks, FAIL LOUD:

  (A) COVERAGE — every chrome catalog key (`src/i18n/strings.ts` `en`) is present
      in EVERY shipped locale, with its {placeholder} tokens intact. A newly-added
      key that hasn't been filled yet → listed as "needs translation".

  (B) LEAKS — heuristic scan of the i18n-owned chrome surfaces for hardcoded,
      user-facing English string literals that DON'T go through the `t()` seam, so
      a string added straight into the DOM surfaces as a leak rather than silently
      drifting to English.

Exit code 0 = clean; 1 = drift found (CI-friendly). Pair with the auto-fill path:

    python3 tools/check_translations.py            # report; exit 1 on drift
    python3 tools/check_translations.py --fix      # then gen-fill missing locales

`--fix` shells out to `gen_i18n.py` for the locales missing keys (foreground, in
batches — backgrounded gen loses network). Intent: adding a key anywhere surfaces
as "needs translation" and the next `--fix` run fills its ~50-lang set.
"""
import importlib.util
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
PACK = HERE.parent
SRC = PACK / "src"

# Reuse the gen tool's parsers so the two stay in lockstep (one source of truth
# for "what's in the catalog" + "what locales we ship").
_spec = importlib.util.spec_from_file_location("gen_i18n", HERE / "gen_i18n.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


def tokens(s):
    return set(re.findall(r"\{(\w+)\}", s))


# ---------------------------------------------------------------- (A) coverage
def check_coverage():
    """Every shipped locale must carry every `en` key with matching tokens."""
    en = gen.extract_en()
    locales = gen.extract_locales(en)  # {code: {key: value}} for non-en
    shipped = gen.DEFAULT_LANGS  # the ~46-lang Corpán set we commit to
    problems = []
    missing_locales = sorted(set(shipped) - set(locales))
    if missing_locales:
        problems.append(
            f"locales declared in DEFAULT_LANGS but ABSENT from the catalog: "
            f"{', '.join(missing_locales)}"
        )
    for code in sorted(locales):
        d = locales[code]
        miss = [k for k in en if k not in d]
        if miss:
            problems.append(f"[{code}] missing {len(miss)} key(s): {', '.join(miss)}")
        bad = [
            k
            for k in en
            if k in d and tokens(en[k]) != tokens(d[k])
        ]
        if bad:
            problems.append(f"[{code}] {len(bad)} key(s) with broken {{tokens}}: {', '.join(bad)}")
    return en, locales, problems, _locales_needing_fill(en, locales, shipped)


def _locales_needing_fill(en, locales, shipped):
    """Which shipped locales are missing >=1 key (the gen --fix target set)."""
    need = []
    for code in shipped:
        d = locales.get(code, {})
        if any(k not in d for k in en):
            need.append(code)
    return need


# --------------------------------------------------------------- (C) lang names
def check_language_names():
    """Every shipped catalog code must have an entry in `languageNames.ts` (the
    chooser/welcome endonym source). A code in the catalog but NOT here → the
    chooser shows the raw code instead of the language's name. (This is the gap
    that hid lt/ne/sl — caught only by cross-referencing the two rosters.)"""
    f = SRC / "entry" / "languageNames.ts"
    if not f.exists():
        return []
    text = f.read_text()
    keys = set(re.findall(r'(?:^|[{,]\s*)["\']?([a-z]{2,3}(?:-[A-Za-z]+)?)["\']?\s*:', text, re.M))
    base = {k.split("-")[0] for k in keys}
    missing = sorted(set(gen.DEFAULT_LANGS) - base)
    return missing


# ------------------------------------------------------------------- (B) leaks
# The i18n-owned chrome surfaces. A user-facing literal here that isn't routed
# through `t()`/a `*Strings` builder is a leak. (Other dirs are other owners.)
LEAK_SCAN_DIRS = [
    "entry",
    "shell",
    "onboarding",
    "immersion",
]
# Plus specific quest CHROME files (the rest of quest/* is logic, owned elsewhere).
LEAK_SCAN_FILES = [
    "quest/questTracker.ts",
    "quest/questSection.ts",
    "vignettes/questInterlude.ts",
]

# Patterns that introduce a VISIBLE string. We flag a string literal of >=2 words
# (or a single capitalized word) of Latin letters that is NOT obviously a class
# name / css / selector / key. Heuristic — designed to catch English prose.
VISIBLE_CALL = re.compile(
    r"""(?:
        \.textContent\s*=|
        \.innerHTML\s*=|
        \.setAttribute\(\s*["'](?:aria-label|title|placeholder|alt)["']\s*,|
        \bel\([^,]+,[^,]+,|              # el(tag, cls, TEXT)
        \bsegButton\(|
        \.placeholder\s*=
    )""",
    re.VERBOSE,
)
# A quoted English-looking phrase: starts with a letter, has a space + lowercase
# run, OR is a single Capitalized word >=3 chars. Skips ALLCAPS consts, css, urls.
ENGLISH_LIT = re.compile(r'["\']([A-Za-z][A-Za-z .,!?;:\'’"—–-]{2,})["\']')

ALLOW_SUBSTR = (
    "wp-",          # css classes
    "data-",        # data attrs
    "http", "://",
    "aria-",
    "role",
    "button", "div", "span", "svg", "path", "circle", "canvas", "ol", "li", "h1", "h2",
)


def _looks_english(s):
    s = s.strip()
    if not s:
        return False
    if any(a in s for a in ALLOW_SUBSTR):
        return False
    if s.isupper():  # ALLCAPS = const/enum, not prose
        return False
    # multiword with a lowercase run → prose; or a single Capitalized word.
    if " " in s and re.search(r"[a-z]{2,}", s):
        return True
    if re.fullmatch(r"[A-Z][a-z]{2,}", s):
        return True
    return False


def check_leaks():
    files = []
    for d in LEAK_SCAN_DIRS:
        files += sorted((SRC / d).rglob("*.ts"))
    for f in LEAK_SCAN_FILES:
        p = SRC / f
        if p.exists():
            files.append(p)
    leaks = []
    for f in files:
        if f.name.endswith(".test.ts"):
            continue
        text = f.read_text()
        lines = text.splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith(("//", "*", "/*")):
                continue
            # Only lines that introduce a visible string AND aren't t()-routed.
            if not VISIBLE_CALL.search(line):
                continue
            if re.search(r"\bt\(|bindT|makeMenuStrings|make\w+Strings|strings\.", line):
                continue
            for m in ENGLISH_LIT.finditer(line):
                lit = m.group(1)
                if _looks_english(lit):
                    leaks.append(f"{f.relative_to(PACK)}:{i}  «{lit}»")
                    break
    return leaks


def main():
    fix = "--fix" in sys.argv[1:]
    en, locales, cov_problems, need_fill = check_coverage()
    leaks = check_leaks()
    name_gaps = check_language_names()

    print(f"check-translations · {len(en)} keys · {len(locales)} locales")
    ok = True

    if cov_problems:
        ok = False
        print("\n✗ COVERAGE drift (keys missing / broken tokens):")
        for p in cov_problems:
            print(f"  - {p}")
    else:
        print("✓ coverage: every locale has every key, tokens intact")

    if leaks:
        ok = False
        print(f"\n✗ POSSIBLE un-keyed strings ({len(leaks)}) — route through t():")
        for l in leaks:
            print(f"  - {l}")
    else:
        print("✓ no un-keyed user-facing strings in the chrome surfaces")

    if name_gaps:
        ok = False
        print(
            f"\n✗ {len(name_gaps)} catalog code(s) missing from languageNames.ts "
            f"(chooser would show the raw code): {', '.join(name_gaps)}"
        )
    else:
        print("✓ every catalog code has a languageNames.ts endonym")

    if fix and need_fill:
        print(f"\n→ --fix: gen-filling {len(need_fill)} locale(s): {', '.join(need_fill)}")
        # Batch in 10s (foreground; backgrounded gen loses network — known gotcha).
        for i in range(0, len(need_fill), 10):
            batch = need_fill[i : i + 10]
            print(f"  gen batch: {' '.join(batch)}")
            subprocess.run([sys.executable, str(HERE / "gen_i18n.py"), *batch], check=False)
        print("  re-run check-translations to confirm.")
        return 0  # the fill ran; next plain run gates

    if not ok:
        print("\nFAILED — fix the drift (or run with --fix to auto-fill missing keys).")
        return 1
    print("\nALL GOOD — localization is current.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
