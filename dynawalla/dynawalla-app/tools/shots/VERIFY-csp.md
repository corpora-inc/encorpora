# VERIFY-csp — adversarial verification of the premium/native design pass

Lens: *things that work in dev and die on device.* Nothing was fixed. Nothing was
committed. All paths absolute from `/Users/skyl/Code/corpora/wt/dw-premium/dynawalla/dynawalla-app`.

Environment: Node 24.18.0, Chrome headless (CDP, `Emulation.setDeviceMetricsOverride`,
never `--window-size`, so the 500px clamp is not in play — every capture asserts its
rendered viewport width).

---

## 0. Verdict

The four assigned checks **pass**. The build is CSP-clean under the exact shipped
policy: 100 captures, zero violations, zero console errors, zero exceptions.

Nine problems found by other means. One is a genuine dev-vs-device defect
(**P1**), one is a genuine touch-behaviour defect (**P2**), one is a claim the
measurements refute (**P5**). The rest are lower.

---

## 1. Inline styles — CLEAN

### 1.1 Source

```
$ grep -rn "style=" src/
src/app/capabilities.test.ts:70:  # comment
src/app/capabilities.test.ts:80:  # the assertion's own regex
src/app/boundary.test.ts:304:   # the assertion's own regex
$ grep -rn "setProperty\|cssText\|\.style\b" src/
NONE
$ grep -rn "dangerouslySetInnerHTML\|setAttribute(['\"]style\|innerHTML" src/
NONE
```

No `style` prop, no imperative style write, no innerHTML escape hatch anywhere in
`src/`, including all six changed `.tsx` files.

### 1.2 Built output

```
$ grep -o 'style=' dist/index.html dist/assets/*.js dist/assets/*.css
(no matches)
```

`dist/index.html` carries no inline `<script>` and no inline `<style>` — only two
same-origin `/assets/…` references.

### 1.3 The tests that hold the line — BOTH still exist, BOTH cover the changed files

| test | file:line | glob | regex |
|---|---|---|---|
| "no inline style anywhere — the CSP forbids it outright" | `src/app/boundary.test.ts:299` | every `.ts`/`.tsx` under `src/` except `*.test.ts` (`files()` at `boundary.test.ts:29-38`) | `/\sstyle=\{/` |
| "nothing sets a style attribute the CSP would refuse to apply" | `src/app/capabilities.test.ts:69` | every `.tsx` under `src/`, **plus `index.html`** (`capabilities.test.ts:84-92`) | `/(?:^\|[\s{])style=/m` |

I verified the globs by reading the walkers rather than trusting the names. Both
walk the whole tree recursively; between them they cover `Nav.tsx`, `Shell.tsx`,
`Catalog.tsx`, `Strapwork.tsx`, `PassSheet.tsx`, `Surface.tsx`. The
`capabilities` regex is the stronger of the two — it also catches a literal
`style="…"` attribute, which `boundary`'s `\sstyle=\{` would miss. The
`capabilities` test also self-disarms if `style-src` ever gains `'unsafe-inline'`
(`capabilities.test.ts:74`), which is correct.

Gap worth knowing, not a defect today: neither test looks for
`el.setAttribute("style", …)` or `dangerouslySetInnerHTML`. I grepped for both
by hand (§1.1) — clean.

---

## 2. Remote references — CLEAN

```
$ grep -rn "http://\|https://" src/          → only comments, and pack-manifest fixtures in *.test.ts
$ grep -rn "@import" src/                    → 3, all relative: tailwindcss, ./design/tokens.css, ./catalog/catalog.css
$ grep -rn "@font-face\|fonts.googleapis\|cdn\." src/   → NONE
$ grep -o -E "url\([^)]*\)" dist/assets/*.css → NO MATCHES AT ALL
```

The built stylesheet contains **no `url()` of any kind** — no font, no image, no
sheet. Type is system-only (`tokens.css:84-88`): `Iowan Old Style` / `system-ui` /
`ui-rounded` stacks, nothing to fetch, so `font-src 'self'` is satisfied trivially.

Every `https?://` string in `dist/assets/*.js` is a React error URL, a React
Router doc URL, or an XML namespace (`http://www.w3.org/2000/svg` etc.). One in
the CSS: the Tailwind banner comment.

---

## 3. Served under the EXACT shipped CSP — ZERO VIOLATIONS

Policy read verbatim from `src-tauri/tauri.conf.json` `app.security.csp` and set
as a `Content-Security-Policy` response header on every response:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; media-src 'none';
object-src 'none'; frame-src dynawalla-pack: http://dynawalla-pack.localhost;
worker-src 'none'; base-uri 'none'; form-action 'none'
```

Method: the real capture harness (`tools/capture.mjs`) patched to (a) add that
header, (b) `Log.enable` + `Runtime.enable` per target, (c) install a
`securitypolicyviolation` listener via `Page.addScriptToEvaluateOnNewDocument`
before navigation. Ran the full matrix — 10 screens × 5 widths × 2 themes = **100
captures**, every destination, the pass sheet at rest / gate / offer, and
parents in dev mode.

Result — the complete event log for all 100 captures:

```
=== CSP/CONSOLE EVENTS: 1 ===
  [log:network:error] light/packs-390 :: Failed to load resource: 404 (Not Found)
      url: http://127.0.0.1:62909/favicon.ico
```

Zero CSP violations. Zero console errors. Zero uncaught exceptions. Zero
`Runtime.exceptionThrown`. The only entry is the harness server not serving a
favicon.

### 3.1 Positive control — the rig is not blind

A rig that reports "no violations" because it cannot see them is worthless, so I
proved it. Same CSP string, same header mechanism, same CDP listener, a page
containing one `style="color:red"` and one inline `<script>`:

```
CONTROL RESULT: {"v":[{"directive":"style-src-attr","blocked":"inline","sample":""},
                      {"directive":"script-src-elem","blocked":"inline","sample":""}],
                 "inlineRan":0,"color":"rgb(0, 0, 0)"}
```

Both caught, the inline script did not run, and the inline colour was discarded —
which is exactly the failure mode the `style` prop rule exists to prevent.
The app's clean result is therefore real.

---

## 4. prefers-reduced-motion — COVERED, TWICE, GLOBALLY

`src/design/tokens.css:912-930` (`:root[data-motion="reduced"]`, the in-app switch)
and `src/design/tokens.css:944-963` (`@media (prefers-reduced-motion: reduce)`, the
OS setting). Each block does two things:

1. collapses **all six** duration tokens to `0ms` **and both displacement tokens**
   (`--dw-press-scale: 1`, `--dw-enter-lift: 0px`) — so a 0ms transition into a
   displaced position, which is still a jump, cannot happen;
2. a belt-and-braces `*, *::before, *::after { animation-duration: 1ms !important;
   animation-iteration-count: 1 !important; transition-duration: 1ms !important;
   scroll-behavior: auto !important }` that catches anything hard-coding its own
   duration.

Every animation added by this pass resolves through those tokens:

| animation | where | guard |
|---|---|---|
| `.dw-anim-enter` (destination transition) | `Shell.tsx:113` | `@keyframes dw-enter{0%{opacity:0;transform:translate3d(0,var(--dw-enter-lift),0)}}` — lift → 0, duration → 0 |
| `.dw-press` (90ms press) | `Nav.tsx:64`, `Surface.tsx:224`, `Catalog.tsx:105` | `transform:scale(var(--dw-press-scale))` → 1 |
| segmented-control thumb slide | `Surface.tsx:168` | `duration-[var(--dw-motion-detent)]` → 0ms |
| chip-rail reveal (`scrollTo`) | `Catalog.tsx:306-311` | **imperative**, and correctly handled: a `behavior` argument beats the computed `scroll-behavior`, so the code asks **both** sources (`document.documentElement.dataset.motion === "reduced" \|\| matchMedia(...)`) and passes `"auto"` |
| grid cross-fade, scrim fade | `catalog.css`, `PassSheet` | `@keyframes dw-fade` is opacity-only; duration → 0 |

The imperative case at `Catalog.tsx:306-311` is the one that a `@media` block
cannot reach, and it is the one they got right. No gap found.

---

## 5. Other claims I tried to refute and could not

* **`translate-x-[200%]` / `translate-x-[300%]` are in the built CSS.** My first
  scan said they were missing; my scan was wrong — Tailwind escapes `%` as `\%`.
  Confirmed present: `.translate-x-\[200\%\]`, `.translate-x-\[300\%\]`.
* **The `md:hidden${extra}` fix is real.** The two bare occurrences at
  `src/design/Strapwork.tsx:83-84` are inside the explanatory comment; the code at
  `:95` and `:101` has the space, and `.md\:hidden` / `.md\:block` are both in
  `dist/assets/*.css`.
* **Body really is the scroller.** Measured: `document.scrollingElement` is
  `documentElement` while `documentElement.scrollHeight === clientHeight (844)` and
  `body.scrollHeight === 5573`. `Shell.tsx:91-94` setting both is necessary.
* **Every WebKit prefix survives the build.** `-webkit-tap-highlight-color` (3),
  `-webkit-touch-callout` (1), `-webkit-user-select` (2), `-webkit-backdrop-filter`
  (paired with every `backdrop-filter`), `-webkit-mask-image` (16, paired with
  `mask-image`). *(My first pass reported zero for these — `grep -F '-webkit-…'`
  parses a leading dash as a flag. Corrected.)*
* **Tailwind's own Safari <16.4 fallback layer ships** — 2955 bytes under
  `@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or …`, so the
  55 `@property` rules degrade.
* **Focus is `:focus-visible`, once, globally** — `:focus-visible{outline:2px solid
  var(--dw-focus);outline-offset:2px}`. No bare `:focus` rule anywhere. (One
  exception: §P2.)
* **The pass-sheet no-jump claim is TRUE, measured.** Drove the real gate, submitted
  a wrong answer, re-measured. Continue's `top` before → after: 508→508 (390),
  555→555 (430), 645→645 (834), 464→464 (1024), 536→536 (1440). Panel height
  identical. Word swapped each time (INFRASTRUCTURE→MANUFACTURING, …), never
  re-issued as itself. `overscroll-behavior: contain` on the panel, `aria-modal`,
  `tabindex="-1"`, `inputMode` switches to `numeric` for the year form
  (`PassSheet.tsx:300`), zero underlined links in the dialog.
* **The vertical-fit claims hold.** `scrollers: []` for settings / progress /
  parents / profiles at all five widths in both themes — nothing on those four
  destinations scrolls at all.
* **The measured headline numbers hold.** 100 captures: 0 horizontal overflow,
  0 targets under 44px, 0 AA failures. 8 `escaping` elements, all of them the chip
  rail at 390/430 as described. Lowest contrast pair 5.70:1 (dark pass sheet,
  "Choose another game" / "Continue") — the rows write-up says 5.81, a different
  sample; both pass AA comfortably.
* **Scope respected.** `git diff --stat -- . ':(exclude)dynawalla/dynawalla-app'`
  is empty. Nothing in `dynawalla/games/**` or `packs/shared/**`.
* **Gates green.** `npm run tsc` clean, `npm run lint` clean, `npm test` 226/226
  across 46 runs (see P8).

---

## 6. PROBLEMS

### P1 — the `lh` fallback is stripped by the minifier and does not ship *(real dev-vs-device)*

`src/catalog/catalog.css:269-282` authors the fallback-first pattern:

```css
.dw-card-title { line-height: 1.3; min-block-size: 2.6em; min-block-size: 2lh; }
.dw-card-blurb { min-block-size: 2.7em; min-block-size: 2lh; }
```

The built stylesheet:

```
.dw-card-title{min-block-size:2lh;line-height:1.3}
.dw-card-blurb{min-block-size:2lh}
$ grep -c "2\.6em" dist/assets/*.css   → 0
$ grep -c "2\.7em" dist/assets/*.css   → 0
```

Lightning CSS de-duplicates two declarations of the same property, having no way
to know the second is a progressive enhancement. `lh` is Safari **16.4**;
`src-tauri/tauri.conf.json` declares `"minimumSystemVersion": "16.0"`. On iOS
16.0–16.3 the declaration is invalid and dropped, **nothing** reserves the box,
and audit §1.3 (the grid rhythm — "the `Grades … / Play ›` line lands at the same
y on every card") is silently unfixed on exactly the devices the comment was
written to protect.

The write-up's stated reasoning — *"`lh` is Safari 16.4, floor is 16.0, so em
first"* — is correct reasoning whose implementation does not survive the build.
It was never verified against `dist/`.

The only construction the minifier cannot collapse is a feature query:
`@supports (min-block-size: 1lh) { … }`. Alternatively raise the declared floor
to 16.4, which is arguably already true (see P3).

`src/catalog/catalog.css:274`, `src/catalog/catalog.css:280`

### P2 — the search field draws a focus ring on touch *(named tell)*

`src/catalog/catalog.css:170-173`

```css
.dw-find:focus-within { border-color: var(--dw-focus); box-shadow: 0 0 0 2px var(--dw-focus); }
```

`:focus-within` has no "was this focus keyboard-driven" heuristic — it matches
whenever any descendant holds focus, including from a finger. The shell contains
both the input and the 44px clear button (`Catalog.tsx:330`+), so tapping either
one halos the whole box in 2px of `--dw-focus` on a tablet. Everything else in
the app is correctly `:focus-visible` (§5), which is why this one stands out.

The catalogue write-up describes this as *"the same one `:focus-visible` draws
everywhere else"* — the **colour** is the same, the **trigger** is not. The
standing bar names "a focus ring that appears on touch" as a defect.
`:focus-visible:has(…)` on the shell, or `:has(input:focus-visible)`, keeps the
one-object framing without the touch case.

`src/catalog/catalog.css:170`

### P3 — the `color-mix` fallbacks are fully opaque, and one of them is the tab seat

Tailwind emits every fractional-opacity utility twice — once inside
`@supports (color: color-mix(in lab, red, red))` and once bare:

```
.bg-accent\/12{background-color:var(--dw-accent)}                                    ← bare
.bg-accent\/12{background-color:color-mix(in oklab, var(--dw-accent) 12%, transparent)}  ← guarded
.dark\:bg-accent\/18…{background-color:var(--dw-accent)}                             ← bare
.bg-ground-deep\/85{background-color:var(--dw-ground-deep)}                          ← bare
.bg-ground\/85{background-color:var(--dw-ground)}                                    ← bare
```

`color-mix()` is Safari **16.2**. Below it, the active tab's "seat" — carefully
measured at 1.22:1 light / 1.24:1 dark (`Nav.tsx:67-74`) — paints as a **solid
`--dw-accent` plate** carrying `text-ink`, which is a different design and very
likely an AA failure. The pass sheet's scrim `bg-ground-deep/85` goes fully
opaque too.

Only matters if the declared 16.0 floor is real. Combined with P1 and the 55
`@property` rules, the honest position is that this build's CSS baseline is
Safari 16.4 and `tauri.conf.json` says 16.0. Pick one.

`src/app/Nav.tsx:74`, `src-tauri/tauri.conf.json` (`minimumSystemVersion`)

### P4 — the rail's scrollbar suppression uses logical sizes on a non-standard pseudo *(unverified risk)*

`src/catalog/catalog.css:210-217`

```css
.dw-rail { scrollbar-width: none; }
.dw-rail::-webkit-scrollbar { block-size: 0; inline-size: 0; }
```

competing with `src/index.css:132-135`, under `@media (pointer: fine)`:

```css
*::-webkit-scrollbar { width: 10px; height: 10px; }
```

`scrollbar-width` is Safari 18.2+, so on iOS 16/17 and on macOS WKWebView the
`::-webkit-scrollbar` rule is the only suppression that exists. `::-webkit-scrollbar`
is a non-standard pseudo-element with its own layout path; whether it honours
`block-size`/`inline-size` rather than `width`/`height` is not something I could
establish here — macOS uses overlay scrollbars, so my control case (a scroller
with `width:10px` and no suppression) also measured a 0px gutter. It does parse
in Blink (verified via CSSOM: `.a::-webkit-scrollbar {block-size: 0px; inline-size: 0px;}`).

The exposure is a **Windows/Linux desktop build**, where classic scrollbars are
the default and a painted 10px channel under the chip rail would return — the
exact defect §7(a) of the catalogue write-up claims to have closed. The sibling
rule two files away uses `width`/`height`; making them agree costs nothing and
removes the question.

`src/catalog/catalog.css:215`

### P5 — "the wordmark, the writing and the tabs finally share one geometry" is not true on the catalogue

`src/app/Nav.tsx:36-41` and the chrome write-up claim the third x-axis is gone.
Measured left edges (Chrome, CDP viewport override, light theme):

| width | wordmark | first card | course (`.dw-measure`) | first tab |
|---:|---:|---:|---:|---:|
| 390 | 16 | 16 | 16 | **20** |
| 430 | 20 | 20 | 20 | **24** |
| 834 | 20 | 20 | 81 | **85** |
| 1024 | 14 | 14 | 176 | **180** |
| 1440 | 160 | 160 | 384 | **388** |

On the four Surface destinations the claim **holds**: the course and the tab row
share a centre and agree to within the tab's own 4px inner margin (1440: course
384..1056, tabs 388..1052; 1024: 176..848 vs 180..844).

On **packs — the front door, and the screen the audit's §0.8 was written about** —
the grid uses `--dw-measure-frame` (1152) while the tabs use `--dw-measure-text`
(672). At 1440 the wordmark and the first card start at 160 and the tab labels
start at 388: still two left edges, 228px apart. At 1024 it is 14 vs 180.

The pass genuinely fixed *lintel vs content* (that was 16 vs 384 before). It did
not fix *content vs tabs* on the one destination that uses the wide measure. The
write-up should say so, or the catalogue's first column should start where the
first tab does.

`src/app/Nav.tsx:54`, `src/app/Shell.tsx:106`

### P6 — frame padding is keyed on viewport HEIGHT, so a wider screen gets a tighter margin

`src/design/tokens.css:645-646`, `:660-661`, `:671-672`, `:685-686` step
`--dw-frame-pad` down at `max-height: 900 / 820 / 720 / 620`. Measured
consequence:

* 430 × 932 phone → **20px**
* 834 × 1112 iPad portrait → **20px**
* 390 × 844 phone → **16px**
* 1024 × 768 iPad landscape → **14px**

An iPad in landscape gets less screen-edge padding than a phone. It is
deliberate and documented (the comment at `:658-660` says iPad landscape got its
own rung so Settings would fit the fold), and the fold problem is real and now
solved — but the standing bar names "inconsistent spacing rhythm between screens"
as a defect, and a user moving one device between portrait and landscape sees the
margin change by 6px. Worth a conscious ruling rather than a side effect.

`src/design/tokens.css:661`

### P7 — the dark catalogue carries 36 warm points, not one

Brand rule: one warm point per screen. Measured by resolving `--dw-index` to rgb
and counting every visible element painting that exact value:

| screen | light | dark |
|---|---:|---:|
| packs | 6 *(one `IndexMark` svg + its 5 opacity-0 siblings' paths)* | **36** |
| progress / profiles / settings / parents | 6 | 6 |
| pass (all three stages) | 8 *(the 36px mark's paths)* | 8 |

`--dw-index` in dark is `#ffe7b0`; the pack artwork's `--dw-art-warm` is
`--color-brass-300` (`tokens.css:496`, `:800`) and resolves to the same rgb. So
in dark, 36 shapes across the visible cards paint in precisely the gold that the
navigation uses to say "you are here", on the front door.

The good news, and it is the audit's headline defect closed: `--dw-index` in
light is now `#7d5a10`, not brass-700 `#b45309` — the "red-brown sandstorm
ribbon" is gone — and the strapwork band's knots are now `--dw-band-knot:
#6d28d9` (violet), so the ~120 apex-coloured knots per screen are gone too.

This is the pack artwork, `src/catalog/art.ts` was not touched by this pass, and
the brand does say the brand lives "in the artwork on the cards". Reporting it
because it is what the screen shows, not because the pass caused it.

`src/design/tokens.css:496`, `src/design/tokens.css:800`

### P8 — one unexplained, unreproduced test-suite failure

The **first** `npm test` of this session reported:

```
1..221
# tests 221
# pass 220
# fail 1
```

Every run since reports `# tests 226 # pass 226 # fail 0`. The difference, 5, is
exactly the number of top-level tests in the new
`src/pass/parentalGateReissue.test.ts`, and `221 = 226 − 5` with `fail 1` is the
signature of a test **file** throwing during load (Node counts the file as one
failing test and never registers its subtests).

Not reproduced in **46** subsequent runs: 20 serial, 18 six-way concurrent, 8
more. Not caused by a missing built-packs directory — I moved
`src-tauri/packs` aside and ran: still 226/226.

Recording it because it is unexplained and because it points at the one file this
pass added. Not a blocker.

### P9 — two nits in the new test file

`src/pass/parentalGateReissue.test.ts:64`

```ts
assert.ok(passes(next, next.word.toLowerCase()), "a reissued word rejects lower case")
```

`passes()` upper-cases both sides (`src/pass/parentalGate.ts:145`), so this can
never fail — and the message asserts the opposite of what the line tests. It
should either be deleted or become `assert.equal(passes(next, next.word.toLowerCase()), true, "…accepts lower case")`.

Same test, `:60`: `reissue(missed)` uses the real `Math.random`, which makes it
the one non-deterministic test in a file whose header promises "a generator that
walks a fixed sequence, so a test is a test not a coin toss". It cannot currently
fail (every `GATE_WORD` is ≥13 letters), but it is the shape of a flake, and P8
happened in this file.

### Minor, not numbered

* No body scroll lock while the pass sheet is open. The scrim is `position: fixed`
  with `overscroll-behavior: auto` and the shell behind it is still the scrolling
  box, so a drag on the scrim scrolls the catalogue underneath. Invisible (the
  stage is opaque `fixed inset-0`) and `overscroll-behavior: none` on `body`
  suppresses the rubber-band, so this is cosmetic — the sheet closes onto a
  different scroll offset.
* Focus after the gate opens lands on the **input**, not the dialog container
  (measured: `activeElement` = `INPUT.dw-sunk …`). The write-up says focus goes to
  the container. Landing on the field is the better behaviour for a gate — it
  raises the keyboard — so this is a documentation mismatch, not a defect.

---

## 7. How to re-run any of this

```
# full CSP sweep (patch tools/capture.mjs: CSP header + Log.enable + Runtime.enable
# + Page.addScriptToEvaluateOnNewDocument installing a securitypolicyviolation listener)
node tools/capture.mjs                       # 100 captures, ~2 min

# built-CSS interrogation
grep -c "2\.6em" dist/assets/*.css           # P1: expect >0 once fixed
grep -o -E -- '\.dw-card-title\{[^}]*\}' dist/assets/*.css

# class-token audit (every className token vs the built stylesheet;
# remember Tailwind escapes % as \% and : as \:)
```
