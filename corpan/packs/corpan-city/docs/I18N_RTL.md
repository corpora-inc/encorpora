# Corpan City — UI chrome i18n + RTL (R2-4 / R2-5)

**Status:** Implemented (round 2). The UI-chrome string layer is localized into the
learner's **NATIVE** language across the full Corpán language set, and the whole
chrome **orients RTL** when the native is a right-to-left script. This is the
in-app *chrome* layer only; NPC dialogue content (npc-lang) and challenge
instructions/segues (LOCALIZATION_SCALE §3–§4) are separate, parallel tables.

## The core rule

- **ALL UI chrome renders in `learnerPair.native`** — the language the player
  KNOWS (Corpán stack `languages[0]`), not the target they're learning.
- **The whole chrome is RTL-oriented** when that native is Arabic / Hebrew /
  Farsi / Urdu.

`learnerPair` comes from the entry orchestrator; the native is known *before*
onboarding (it's `languages[0]`, independent of which target is chosen), so even
the very first onboarding card + welcome already speak the user's language.

## The seam (one catalog → `t()`)

Built on the **proven repo pattern** (tutomaton `src/i18n.ts` + `tools/gen_i18n.py`,
also pronunciation-coach; MEMORY `tutomaton-i18n-tooling`) — NOT reinvented.

```
src/i18n/
  strings.ts        # en = source of truth + GENERATED_LOCALES block + t()/isRtl()/applyDir()
  surfaceStrings.ts # make{Menu,Tracker,Section,Interlude}Strings(native) → typed *Strings
  index.ts          # barrel
  strings.test.ts   # missing-key / orphan-key / placeholder / RTL CI gate
tools/gen_i18n.py   # OpenAI generator (adapted from tutomaton; quoted dotted keys)
```

- `t(key, lang, params)` resolves into `lang`, collapsing variants
  (`ko-polite→ko`, `pt-BR→pt`, `zh-Hans→zh`, `pa-Guru→pa`) and falling back
  **per-key to English** so a missing/partial locale never shows a blank — it
  shows clean English. `bindT(lang)` binds it to one native locale.
- The committed `GENERATED_LOCALES` block is the **offline floor** (~tens of KB of
  code — it is code, not localStorage). A CDN string-pack *could* merge over it
  later (LOCALIZATION_SCALE §2.2); not wired yet, the committed table stands alone.
- `{token}` placeholders (e.g. `{name}`, `{place}`, `{item}`, `{who}`, `{n}`) are
  preserved by the gen tool and interpolated by `t(...)` at the call site.

### Which surfaces are routed (this domain)

| Surface | File | How it gets native copy |
|---|---|---|
| Welcome interlude (the first visible bug) | `src/entry/surfaces.ts` `showWelcome` | direct `bindT(pair.native)` |
| Language chooser | `src/entry/surfaces.ts` `showLanguageChooser` | direct `bindT(opts.native)` |
| Onboarding (name/dress/skip) | `src/onboarding/onboarding.ts` | direct `bindT(opts.native)` |
| Menu panel | `src/shell/menuPanel.ts` | `makeMenuStrings(native)` via shell |
| Status capsule / tracker | `src/quest/questTracker.ts` | `makeTrackerStrings(native)` |
| Quest detail section | `src/quest/questSection.ts` | `makeSectionStrings(native)` |
| Quest-complete interlude | `src/vignettes/questInterlude.ts` | `makeInterludeStrings(native)` |
| Place tag (online pip) | `src/shell/placeTag.ts` | `chromeT` (3-arg) seam |

`game.ts` is the single wiring point: it derives `nativeLocale()` from the host
stack, passes `native` to onboarding + `resolveEntry`, builds the localized
`*Strings` for each surface, and backs the legacy `vt`/`chromeT` seams with the
catalog. **Unknown keys (taxi/vignette dynamic keys not in the chrome catalog)
return the key unchanged**, preserving those callers' existing inline-English
fallback contract.

## RTL

- `isRtl(lang)` / `dirFor(lang)` — base-collapsed; RTL = `ar`, `he`, `fa`, `ur`.
- `applyDir(root, native)` sets `dir` + `lang` on the **pack root** (`.wp-root`)
  and `.wp-overlay` (`game.ts`, in `buildWorld`), and on each fullscreen surface
  root (welcome/chooser/onboarding). The 3D world is direction-neutral; only the
  DOM chrome flips.
- Chrome CSS uses **logical properties** (`margin-inline-start`, `inset-inline-end`,
  `text-align: start`) so a single `dir="rtl"` mirrors it. The one text glyph that
  can't auto-mirror (the `›` chooser chevron) is flipped via
  `[dir="rtl"] .wp-entry-lang__chev { transform: scaleX(-1) }`.

## Verify standalone (`:5174`)

Dev-only mock stack via `?stack=` (in `main.ts`, gated on the dev root):

- `http://localhost:5174/?stack=es` → native **Spanish** welcome/onboarding (LTR).
- `http://localhost:5174/?stack=ar` → native **Arabic**, RTL chrome.
- `http://localhost:5174/?stack=es,ja` → Spanish native studying Japanese; the
  multi-target **chooser** appears, both localized.

`languages[0]` = native, `[1..]` = targets (Corpán stack order). Absent `?stack=`
→ no host → native `en` (unchanged dev behavior).

## Regenerating translations

From `packs/corpan-city` (reads `OPENAI_API_KEY` from env or a walked-up `.env`,
incl. `encorpora/.env`):

```bash
python3 tools/gen_i18n.py            # all ~45 Corpán langs
python3 tools/gen_i18n.py fr de ja   # just these
python3 tools/gen_i18n.py --from-json strings.json   # inject a prebuilt JSON, no API
```

Idempotent; English is always kept verbatim; partial runs MERGE (untouched
locales preserved). Pitfalls already burned-in: never `unicode_escape` TS values
(mojibake); the locale regex allows `yue`; post-merge diff should be
insertions-only.

## CI gate

`src/i18n/strings.test.ts` asserts: every key has a non-blank `en` source; no
locale carries an orphan key; every locale preserves each key's `{placeholder}`
tokens; `t()` never returns blank and collapses variants; RTL detection is correct;
and the seed shipped ≥40 locales.

## Remaining surfaces (next round)

This was a comprehensive first pass over the chrome domain. Still to audit/route as
they land or are confirmed English-bound:
- Toasts emitted from `game.ts` (the `toast(text)` helper currently takes a raw
  string — route call sites through `t` as their copy is finalized).
- Any new shell affordance (menu button SR labels, exit/leave confirm copy —
  `shell/exit.ts` `ExitStrings`; wire `makeExitStrings` when that copy is settled).
- Map/minimap labels (`src/map/*`) — owned by world-fix; coordinate keys there.
- `aria-label`s added by future chrome — every new visible string goes through the
  catalog, never a hardcoded literal.
- **Language NAMES in native** (LOCALIZATION_SCALE §3.3): the chooser's
  SR `aria-label` ("Play in {lang}") currently substitutes `englishName(code)`
  ("Japanese"), so the SR string reads e.g. "Jugar en Japanese". The VISIBLE card
  already shows the endonym (日本語/Français) via `bilabel`. Making the name render
  in the native (a `languageName(code, native)` table) is the §3.3 work that
  overlaps npc-lang's prompt-layer `LANG_NAME`; route `chooser.playIn`'s `{lang}`
  through it once that table lands.

## Verified (standalone `:5174`, headless)

- `?stack=es` welcome: "Buenos días, …", "Bienvenido", facts "Eres tú / Dónde
  estás / La práctica de hoy", CTA "Entra en la luz de la mañana" — LTR.
- `?stack=ar` welcome: "صباح الخير، …", RTL `dir` on root + fact rows mirrored
  (glyph on the right, text right-aligned).
- `?stack=es,ja,fr` chooser: Spanish chrome ("Tus idiomas", "¿Qué mundo hoy?")
  with endonym cards.
- 45 locales (en + 44) seeded; 0 placeholder mismatches; `strings.test.ts` green.
