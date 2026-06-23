# Corpán scenario framework

Drive the iPad through scripted user journeys for **testing** (assert + screenshot
every beat) and **video sessions** (timed pauses + narration + frame capture for
campaign ads). Built on the existing on-device tooling — no new plumbing.

## Why
- **Comprehensive route testing**: walk every route as a persona, assert what
  should be on screen, screenshot each step → a report + filmstrip. The goal is
  to catch the things a human would point out (untranslated string, broken CTA,
  bad layout) *without* a human eye on every run.
- **Scripted demos for ads**: the same scenarios, run in `--video` mode with
  reflective pauses + narration, become the raw footage for targeted campaigns
  (e.g. "young Javanese speaker learning English") — recorded, mastered, and
  uploaded per language/persona.

## Run
```bash
# prerequisites: sudo pymobiledevice3 remote tunneld running, Web Inspector ON,
#   app foregrounded. STRONGLY recommended — start the persistent daemon first so
#   each step is a ~30ms round-trip instead of a multi-second WebInspector
#   reconnect (cdp.sh auto-uses it; see memory/ipad-debug-pipeline):
PMD=$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python
nohup "$PMD" scripts/dev/ipad/cdpd.py > /tmp/cdpd.log 2>&1 &   # wait for "cdpd ready"

python3 scripts/dev/ipad/scenario.py scripts/dev/ipad/scenarios/id_english_beginner.json
python3 scripts/dev/ipad/scenario.py .../id_english_beginner.json --video   # honor reflection pauses

# Suite: discover + run EVERY scenarios/*.json, one combined roll-up report:
python3 scripts/dev/ipad/suite.py
python3 scripts/dev/ipad/suite.py --video
python3 scripts/dev/ipad/suite.py --only id_english_beginner        # subset by name/stem
python3 scripts/dev/ipad/suite.py --ts 20260530-1200                # pin the timestamp tag
```
Output: `scripts/dev/ipad/runs/<name>-<ts>/` with numbered screenshots + `report.md`
(inline filmstrip, per-beat pass/fail). The suite writes
`scripts/dev/ipad/runs/suite-<ts>/report.md` — a per-scenario pass/fail/warn
table plus links into each scenario's own report + artifacts. Suite exit code is
0 only if every scenario passed (warnings do not fail the suite).

## Scenario format (JSON)
```json
{ "name": "...", "title": "...", "persona": "...", "beats": [ { ...beat } ] }
```
A **beat** runs these keys in order (any subset):
| key | effect |
|-----|--------|
| `narrate` | caption line (report + console; future: burned-in subtitle) |
| `reset` | clear onboarding + landing, reload (fresh first run) |
| `set_state` | merge into the persisted stack `{languages?, interests?, levels?, onboarded?}`, reload |
| `goto` | deep-link a pack via `?game=<id>` |
| `reload` | reload the web view |
| `wait_text` / `wait_heading` | poll until visible text / the h1·h2 contains the needle (20s) |
| `tap` / `tap_any` | click first visible `<button>` (or button/role) whose text contains the needle |
| `tap_anchor` | **language-agnostic** click by stable attribute (see Anchors below) |
| `assert_text` | record pass/fail on whether the text is visible |
| `assert_anchor` | pass/fail on whether an anchored element is present + visible |
| `assert_in_viewport` | fail if an anchor (or `"last"` = last tapped element) is clipped/off-screen |
| `screenshot` | capture a named pixel screenshot into the run dir |
| `pause` / `pause_video` | hold (ms); `pause_video` only applies with `--video` |
| `settle` | per-beat wait after a tap (default 1.2s) |

Scenario-level keys: `name`, `title`, `persona`, `beats`, and optional
`ui_lang` (BCP-47 of the UI language; otherwise inferred from the first
`set_state.languages[0]`) which drives the untranslated-screen heuristic.

## Language-agnostic anchors

Substring `tap`/`assert_text` reference *visible* text, which breaks across
localizations. Anchors target **stable attributes** instead. A `tap_anchor`,
`assert_anchor`, or `assert_in_viewport` value is either a raw CSS selector
string, or an object whose keys AND together into a selector:

| key | → selector | example |
|-----|-----------|---------|
| `aria` | `[aria-label*="…"]` | `{ "aria": "Continue" }` |
| `role` | `[role="…"]` | `{ "role": "option" }` |
| `testid` | `[data-testid="…"]` | `{ "testid": "primary-cta" }` |
| `data` | `[data-<name>]` or `[data-<name>="<value>"]` | `{ "data": { "name": "lang", "value": "en" } }` |
| `selector` | raw CSS (escape hatch) | `{ "selector": "footer button.primary" }` |

```json
{ "tap_anchor": { "testid": "onboarding-continue" }, "settle": 1.8 }
{ "assert_anchor": { "role": "dialog" } }
{ "assert_in_viewport": "last" }
{ "assert_in_viewport": { "aria": "Continue" } }
```

Substring matching still works exactly as before; anchors are additive. Prefer
anchors for anything you'd otherwise match by an English label.

## Heuristic assertions (automatic — no beat needed)

The runner flags, on its own, the issues a human reviewer would point out:

- **Untranslated screen** (soft `⚠️ WARN`): when the persona's UI language is
  non-English (`ui_lang`, or inferred `languages[0] != "en"`), every captured
  screenshot is scanned for telltale English UI words appearing as **whole
  words** ("Continue", "Settings", "Skip", "Open", "Back", "Next", "Done",
  "Cancel", "Save", "Search", "Close", "Start", "Finish", "Begin", "Submit",
  "Loading", "Welcome", "Choose", "Select", "Learn"). Offending strings are
  listed; whole-word matching avoids false hits like "Selection"/"Backstage".
  Opt out per beat with `"check_untranslated": false`.
- **Dead CTA** (soft `⚠️ WARN`): every successful `tap`/`tap_any`/`tap_anchor`/
  `tap_primary` snapshots a cheap DOM signature (`document.body.innerText`
  length + `location.href`) before and after the settle; if neither changed,
  it flags "possible dead CTA".
- **Off-screen / overflow primary button** (hard fail): `assert_in_viewport`
  checks the element's `getBoundingClientRect` is inside the viewport — failing
  on a clipped (partly outside) or fully off-screen / zero-size element, with
  the rect + viewport dimensions in the message.

Warnings appear in each scenario report and are summed in the suite roll-up;
they do **not** fail a run. Hard failures (missing asserts, off-screen buttons)
do. The scenario report header notes the detected UI language.

## Architecture
- `scenario.py` — single-scenario orchestrator. Reuses `cdp.sh` (WebInspector
  eval/click with retries) + `screenshot.py` (pixel grabs). Robust to CDP blips
  via the wrapper's retry loop; taps match either a visible substring or a
  language-agnostic anchor. `run()` returns a result dict (pass/fail/warnings +
  report path) so the suite can roll it up.
- `suite.py` — discovers `scenarios/*.json`, calls `scenario.run()` per file
  (recording, not swallowing, any runner exception), and writes one combined
  `runs/suite-<ts>/report.md` roll-up. Stdlib only; imports `scenario` directly.
- `scenarios/*.json` — the persona library (doubles as the QA suite + video scripts).
- `runs/` — timestamped outputs (gitignored).

## Roadmap (next layers)
1. ~~**Autonomous coverage**: a suite runner over all `scenarios/*`, plus
   heuristic assertions baked into the runner~~ — **done** (`suite.py` +
   untranslated/dead-CTA/off-screen heuristics + anchors; see above).
2. **Video pipeline** — **in progress** (`studio.py`, see `infra/captures/STUDIO.md`):
   (a) screen-record hook — built two ways: a headless Swift recorder
   (`record.sh`/`ipad-record.swift`) for Macs/devices AVFoundation can see, and
   the **working** path for the tunneled iPad, iOS Control Center recording +
   `studio.py pull`. (b) `assemble` step — **done**: `studio.py assemble` reuses
   `build-capture.sh` (blur-pad/aspects) + `mix-bgm.py` (music bed + ducking) and
   auto-generates the YouTube sidecar from the scenario. Scenarios gained
   `country`/`scene`/`playlist`/`ui_lang`; `scenario.run` emits `timeline.json`
   (caption/screenshot offsets) as the narration/subtitle alignment backbone.
   Still TODO: (c) OAuth auto-upload wiring, narration TTS stem, PiP overlay.
3. **Scenario authoring from a brief**: generate a scenario JSON from a natural-
   language persona ("Javanese speaker, Bahasa Indonesia UI, English from
   scratch") + the route graph.

See `memory/ipad-debug-pipeline.md` for the underlying device tooling.
