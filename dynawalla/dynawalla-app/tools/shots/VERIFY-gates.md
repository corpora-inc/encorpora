# VERIFY — independent gate + claim verification

Adversarial review of the harness design pass on branch `dw-premium`
(`/Users/skyl/Code/corpora/wt/dw-premium`). Nothing was fixed; nothing was
committed. Every number below was produced by re-running the tool, not by
reading a write-up.

Node used everywhere: `~/.nvm/versions/node/v24.18.0/bin` **on `$PATH`**.
Calling `~/.nvm/.../npm` alone is not enough — npm's shim resolves `node` from
the ambient `$PATH`, and the first `npm ci` ran under **v22.17.1** with
`EBADENGINE` warnings. Re-run with the directory prepended.

---

## 1. Gates — real exit codes

| Gate | Command | Exit | Output |
|---|---|---|---|
| install | `npm ci` | 0 | `added 168 packages, audited 169`, 0 vulnerabilities |
| types | `npm run tsc` | **0** | three passes (`tsconfig`, `.test`, `.node`), no output |
| tests | `npm test` | **0** | **tests 226 · pass 226 · fail 0 · skipped 0 · todo 0**, 536 ms |
| lint | `npm run lint` | **0** | no output |
| build | `npm run build` | **0** | 225 modules, `index-C4R7XWvh.css` 52.32 kB, `index-A_6JhyeR.js` 466.71 kB, 182 ms |

`node_modules` is a **real directory**, not a symlink (`drwxr-xr-x 122`), and
`npm ci` reinstalled it from the lockfile.

### Capture harness re-run
`node tools/capture.mjs` — **100 shots, 0 problems, exit 0.** Independently
re-derived from the regenerated `measurements.json` (100 screens):

* horizontal page overflow: **0** screens
* interactive targets under 44 px: **0** (incl. transient states, §5)
* AA failures: **0**; lowest measured pair **5.70:1** (`dark/pass-rest-390`,
  white on `rgb(124 58 237)`, 20 px/400). The `[rows]` write-up says
  "lowest pair 5.81:1" — that was their 50-shot subset; over all 100 it is 5.70.
  Still a pass. Not a defect, an imprecise claim.
* `escapingCount` 32 across 8 screens = the subject chips past the fold inside
  the rail at 390/430. Legitimate.

---

## 2. Scope and boundary

`git -C /Users/skyl/Code/corpora/wt/dw-premium status --porcelain`:

```
 M dynawalla/dynawalla-app/src/app/Nav.tsx
 M dynawalla/dynawalla-app/src/app/Shell.tsx
 M dynawalla/dynawalla-app/src/catalog/Catalog.tsx
 M dynawalla/dynawalla-app/src/catalog/catalog.css
 M dynawalla/dynawalla-app/src/design/Strapwork.tsx
 M dynawalla/dynawalla-app/src/design/tokens.css
 M dynawalla/dynawalla-app/src/index.css
 M dynawalla/dynawalla-app/src/pass/PassSheet.tsx
 M dynawalla/dynawalla-app/src/pass/parentalGate.ts
 M dynawalla/dynawalla-app/src/shell/Surface.tsx
?? dynawalla/dynawalla-app/src/pass/parentalGateReissue.test.ts
?? dynawalla/dynawalla-app/tools/.gitignore
?? dynawalla/dynawalla-app/tools/_probe2.mjs
?? dynawalla/dynawalla-app/tools/capture.mjs
?? dynawalla/dynawalla-app/tools/harness/
?? dynawalla/dynawalla-app/tools/shots/
?? dynawalla/dynawalla-app/tools/verify-a11y.mjs
```

* No `node_modules`, no symlink, nothing staged.
* Every path is inside `dynawalla-app/src` or `dynawalla-app/tools`. **PASS.**
* `tools/.gitignore` (`shots/**/*.png`) works — `git status -uall` lists **0**
  PNGs, so no LFS objects would be pushed.
* `dynawalla/docs/` — **untouched**. See problem P8.

### games/ and packs/ — CLEAN, with a caveat about the literal command

The brief's command `git diff --name-only origin/main -- dynawalla/games
dynawalla/packs` returns **117 files**. That is **not** this branch touching
them — it is `origin/main` being **ahead**:

* branch `HEAD` = `ae45df70e`, which **is** the merge-base with `origin/main`
  (`7f3464cfa`). The branch has **zero commits of its own**; all work is
  uncommitted.
* `git diff --name-only ae45df70e origin/main -- dynawalla/games dynawalla/packs`
  = the same **117** files → they are the other agent's, arriving from main.
* `git diff --name-only HEAD -- dynawalla/games dynawalla/packs` = **0**
* `git status --porcelain -- dynawalla/games dynawalla/packs` = **0**

**Verdict: nothing under `games/` or `packs/` was modified by this pass.**

---

## 3. Tests — nothing weakened, nothing deleted

24 `*.test.*` files under `src/`. Diffed against both the merge-base and
`origin/main`:

* **This branch modified or deleted zero existing test files.**
  `git diff --name-only HEAD -- dynawalla/dynawalla-app/src` lists only the ten
  non-test sources.
* `src/packs/bridge.test.ts` and `src/packs/items.test.ts` show up in a diff
  against `origin/main` **only because main advanced**
  (`git diff --name-only ae45df70e origin/main` lists the same two). Not this pass.
* One test file added: `src/pass/parentalGateReissue.test.ts`, 82 lines, 5 tests,
  all with real assertions (500-iteration form-invariance loop; every gate word
  × every generator draw checked against re-issuing itself; a New-Year clock
  case). Only `"reissue holds no state between calls"` is near-vacuous for a
  pure function. Nothing here is a weakening.

**`src/shell/surfaces.test.ts` still asserts no destination renders empty** —
`surfaces.test.ts:128–136`:

```
test("no destination is empty on a device nobody has used yet", () => {
  assert.ok(sections.length > 0, `${destination} renders nothing at all`)
  assert.ok(section.rows.length > 0, `${destination}/${section.key} is an empty section`)
  assertCarries(row, destination)   // every row must carry real text/handlers
```

plus `surfaces.test.ts:179` (warm device), `:225` ("nothing a child can press
does anything"), `:232` (empty registry must say so). **All green.**

### One behaviour change smuggled in under a design mandate
`src/pass/parentalGate.ts:82` — the parental gate's form split moved from
**50/50 to `YEAR_SHARE = 0.2`** (`makeChallenge()` now serves the word form four
times in five). The reasoning in the comment is sound and no test broke
(`"both forms are reachable"` draws 400 times; `0.8^400 ≈ 0`, so not flaky).
But this is a **gate-behaviour change, not a design change**, and the `[pass]`
summary mentions only `reissue()`. It should be called out on the PR.

---

## 4. Confirmed claims (I tried to break these and could not)

Measured with an independent CDP probe over 20 screen×width combinations
(`verify-probe.mjs`, light theme, 390/834/1024/1440):

* **`style` prop: zero** in `src/**/*.{ts,tsx}`. `capabilities.test.ts:69`
  ("nothing sets a style attribute the CSP would refuse to apply") is intact
  and passing.
* **Hex literals in components: zero.** `tokens.test.ts:159`
  ("no colour literal exists outside the palette") gates it.
* **The Tailwind interpolation trap is real and fixed.** `Strapwork.tsx:95,101`
  carry a space before `${extra}`; the built CSS contains `md\:hidden` (1) and
  `md\:block` (1). All the other claimed classes exist in
  `dist/assets/index-C4R7XWvh.css`: `dw-press`(7) `dw-bar` `dw-frame`(17)
  `dw-sunk` `dw-raised` `dw-surface`(8) `dw-scrim`(4) `dw-overlay`
  `dw-anim-enter` `dw-rail`(2) `dw-hairline`(12) `dw-measure`(7)
  `dw-scroll-x` `dw-card-title` `dw-card-blurb` `min-h-target-comfort`
  `min-w-target` `dw-wordmark`, and the four thumb positions
  `translate-x-0` / `translate-x-full` / `translate-x-\[200\%\]` /
  `translate-x-\[300\%\]`.
* **The scroll-reset finding is real.** Probed live: `getComputedStyle(body)
  .overflowY === "auto"` and the same on `documentElement`. Body is the
  scroller, so `Shell.tsx:92–93` setting **both** is required.
* **Every screen fits without scrolling** (body `scrollHeight − clientHeight`):
  settings/progress/profiles/parents = **0 px overflow at 390, 834, 1024 and
  1440**. `settings-390` fits 844 px; `progress-1024` fits 768 px. Both
  specific claims hold.
* **Card small print lines up across a grid row** — the `Grades … / Play ›`
  line's y is identical for every card in a row at every width:
  390 → 544.4/544.4 · 834 → 578.9 ×4 · 1024 → 606.4 ×4 · 1440 → 645.9 ×4.
* **Segmented thumbs are inside their tracks** at every width and every control
  (12 controls probed, `inside: true` for all). Thumb widths are exact
  fractions (`w-1/2` 84.5 of 179; `w-1/3` 108.7 of 336).
* **Sticky ladder:** `header` sticky z-30, `nav` sticky z-30, `main` static.
  Pass sheet at `--z-modal: 1100`, `--dialog-max-h` defined (`tokens.css:713`).
* **Focus is keyboard-only** — `:focus-visible` is the only global outline
  (`index.css:160`). Pass-sheet `Panel` (`PassSheet.tsx:90–155`) is a real
  modal: `role="dialog"`, `aria-modal`, `aria-labelledby`, `tabIndex={-1}`,
  Tab trapped both directions, focus restored on unmount, `overscroll-contain`,
  per-side `max(frame-pad, safe-*)`.
* **Reduced motion is a branch, not a degradation** — both
  `:root[data-motion="reduced"]` and `@media (prefers-reduced-motion: reduce)`
  collapse the six duration tokens **and** `--dw-press-scale` **and**
  `--dw-enter-lift` (`tokens.css:912–962`), with a `!important` belt underneath.
  `Catalog.tsx:305–308` asks both sources before calling `scrollTo`.
* **The strapwork is no longer warm.** `--dw-band-strap: stone-400` /
  `--dw-band-knot: aurora-600` in light, `stone-600`/`aurora-500` in dark
  (`tokens.css:395–396, 756–757`). `Strapwork.tsx:55,58` reads them directly.
* **Native tells:** `-webkit-tap-highlight-color: transparent`,
  `-webkit-touch-callout: none`, `user-select: none` with inputs opting back in,
  `overscroll-behavior: none` on html **and** body, `text-size-adjust: 100%`,
  `font-size: max(1rem,16px)` on fields (iOS zoom), `color-scheme` following
  the theme class. All present in `index.css:19–96`.
* **Transient states hold up.** Probed the two states nobody captured — an empty
  search result and an armed "Remove": **0 targets under 44 px, 0 horizontal
  overflow** in both, at 390 and 1440. The clear control is exactly 44×44; the
  armed Remove is 76.4×44 with `aria-pressed="true"` and is the **same width**
  resting and armed, so arming causes no reflow.

---

## 5. PROBLEMS

### P1 — The chip rail's leading dissolve is on at rest, and it eats the selected chip. **(defect, front door, phone + iPad portrait, both themes)**

`src/catalog/Catalog.tsx:208` — `const lead = box.scrollLeft > 1`.

Measured live on first paint, nothing touched: **`scrollLeft === 4`** at 390 and
at 834, so `data-lead="on"` latches permanently and
`catalog.css:219` paints the left dissolve. The rail carries `px-1` (4 px) and
`.dw-scroll-x` sets `scroll-snap-type: x proximity` while every chip is
`snap-start` (`index.css:344`, `Catalog.tsx:521`) — the browser rests the
scroller on the first snap position, which is the 4 px padding, not 0.

Effect: the **"All" chip — the selected one — is drawn with its left border
gone and its white plate fading into the ground**, on the app's front door,
at rest. This is the exact defect §7(c) of the catalogue write-up claims to have
closed ("a control whose state you cannot see"), reintroduced by the fade the
same pass added. It is visible in the pass's own committed captures:
`tools/shots/light/packs-390.png` and `…/packs-834.png`.

Probe: `lead:"on", trail:"on", scrollLeft:4, scrollWidth:820, clientWidth:366`.
At 1440 `scrollLeft:0`, mask `none` — correct there only because nothing
overflows. The 1-px tolerance is smaller than the padding-induced snap offset.

### P2 — "A choice row is now the same 64 px object as a fact row" is false at every width. **(refuted claim + the rhythm tell the audit named)**

Measured `<li>` heights on the courses:

| width | Theme | Text size | Sound | Haptics | Reduce motion | Quality |
|---|---|---|---|---|---|---|
| 390 | **116.1** | **116.1** | 74 | 74 | 74 | 74 |
| 834 | 78 | 78 | 78 | 78 | 78 | 78 |
| 1024 | 70 | 70 | 70 | 70 | 70 | 70 |
| 1440 | 74 | 74 | 74 | 74 | 74 | 74 |

Parents, every width: facts **64**, the Developer-mode choice **74 / 78 / 70 /
74**. So a choice row is *never* 64 px, and at 390 the screen still alternates
between **116 px** and **74 px** rows — a 42 px swing on one screen. Cause: the
track is `p-1` + `dw-sunk` hairlines around a `min-h-target` (44 px) button
(`Surface.tsx:156,183`), which forces the row past `--dw-row-min`, and the
three-option controls still stack below `sm` (`Surface.tsx:143–146`).

"Inconsistent spacing rhythm between screens" is on the standing-bar defect list.
It survives at phone width, which is where a child meets it.

### P3 — "The wordmark, the writing and the tabs finally share one geometry" is false. Three x-origins became two, not one.

Measured left edges (light):

| width | wordmark | first card | course | tab list |
|---|---|---|---|---|
| 390 | 16 | 16 | 16 | 16 |
| 834 | **20** | 20 | **81** | **81** |
| 1024 | **14** | 14 | **176** | **176** |
| 1440 | **160** | 160 | **384** | **384** |

The lintel is on `--dw-measure-frame` (1152 px) and the tabs were moved onto
`--dw-measure-text` (672 px). They now agree with the **courses** — but the
**wordmark disagrees with both at every width ≥ 834**, and on the catalogue
(the default route) the cards sit on the frame at 160 while the tabs sit at 388,
a 228 px disagreement between the two most permanent things on the screen.
A real improvement over the audit's three origins; the claim overstates it.

### P4 — The search field's clear button is labelled "All" and silently drops the subject filter. **(a11y + behaviour)**

`src/catalog/Catalog.tsx:359–362`:

```
<button type="button" onClick={clearAll} aria-label={strings.catalog.all} …>   // ✕ glyph
```

* `strings.catalog.all === "All"` (`app/strings.ts:63`), documented there as
  *"the chip that clears the subject filter"*. A screen reader announces the ✕
  inside the search field as **"All"**.
* `clearAll` (`Catalog.tsx:311`) clears **query and subject**. Tapping the ✕ in
  the search box also un-picks Fractions, with no indication that it did.

Same string is reused for the empty-state reset button (`Catalog.tsx:446`), so
under **"No game here matches that."** the one way out is a button that says
**"All"** — verified on a live render (`v-packs-empty-390.png`). The stated
reason was "so no new string ships"; the cost is a control whose label does not
describe what it does, on the app's only prose screen.

### P5 — Three near-identical 900-line copies of the capture tool would be committed.

* `tools/capture.mjs` — 909 lines (the real one)
* `tools/_probe2.mjs` — 910 lines, **differs from `capture.mjs` by 4 lines**
  (one inlined probe expression + a `TMPDIR` output path). Pure debris.
* `tools/verify-a11y.mjs` — 1069 lines, a real fork (577 changed lines: it adds
  `pass-gate-miss`, `parents-armed`, `profiles-armed` and a gradient-aware
  ground walk) — but it is a **copy-paste fork**, not a module, and its header
  still reads `node tools/capture.mjs` and *"Output: tools/shots/…"*.

All three are untracked and inside the allowed `tools/` path, so the orchestrator
will commit them. `tools/shots/csp-console.json` (236 B) and
`tools/shots/verify-a11y.json` (22 kB) would land too.

### P6 — The strapwork band is still drawn twice on every screen, now in high-contrast violet.

`app/Shell.tsx:65` and `app/Nav.tsx:49` both render `<Strapwork />`; each renders
**two** `<Band>` SVGs (narrow + wide, one `display:none`). The colour defect is
genuinely fixed — the knots are `aurora-600` (#6d28d9), not brass. But that is
**7.10:1 against the light ground**, ~48 knots per row × 2 rows per screen.
The audit's complaint was "~120 warm points against a brand rule of one per
screen"; it is now ~96 maximum-contrast violet points. Whether an open interlace
at that contrast reads as *"elegant and minimal"* or as a repeating chain is a
founder call — see `tools/shots/light/packs-1440.png`. Naming it because the
band was named as a worst defect and only half of it was addressed.

### P7 — Dead compat block left behind, contradicting the write-up.

`[chrome]` claim 4: *"Component reads `--dw-band-*` directly, **which retires
the compat block at index.css:193**"*. The component does read them directly
(`Strapwork.tsx:55,58`), but `index.css:193–196` is **still there**:

```
pattern[id^="dw-strapwork"] {
  --dw-line-strong: var(--dw-band-strap);
  --dw-index: var(--dw-band-knot);
}
```

Nothing inside the pattern reads either variable any more. Harmless, but it is
dead code the write-up says was removed, and its own comment says *"When that
component is next touched it should read `--dw-band-*` directly and this block
can go"* — which has now happened.

### P8 — `docs/HARNESS_FEEDBACK.md` was not updated, and both of its open items were acted on.

The file's stated purpose is *"feedback given once should not need giving twice"*.
Its **"Noted, not yet acted on"** section still lists (a) the coral
"Erase everything" and (b) the gold strapwork band. Both were changed in this
pass — (a) is now a bounded rose plate with an armed state
(`Surface.tsx:233–247`), (b) is now cool (`tokens.css:395`). `git status`
confirms `dynawalla/docs/` is untouched. The next agent will re-derive both.

### P9 — The pass sheet cannot be reached in the shipped app, so a third of the pass is unverifiable on device.

`tools/harness/main.tsx:3–10`, written by the pass agent:

> `PassSheet` is mounted by `packs/Stage.tsx` … only when `usePass.mayOpen()` is
> false. That decision runs through `pass/model.ts`, which opens unconditionally
> while `billing().wired` is false — and **nothing in the shipped app ever calls
> `setBilling`**. So in a browser, and in fact in today's build on a device,
> **there is no sequence of taps that puts the sheet on screen.**

Honest and correctly documented. But it means the 271-line `PassSheet.tsx`
rewrite is verified only inside a second, dev-only Vite build, and its
`pass-rest / pass-gate / pass-offer` captures (30 of the 100 shots) are of a
harness, not of the app. Nothing in this pass changes that.

### P10 — Two files in the same tree state opposite rules about the mark.

* `app/Shell.tsx:19–21`: *"the mark takes `currentColor` from the wordmark
  beside it, which is the brand rule made structural: white or black ink, and
  **no coloured wash of the mark, ever**."*
* `pass/PassSheet.tsx:152`: `<Mark className="text-index …" />` — the mark in
  brass, deliberately, as the sheet's one warm point.

`brand/README.md:12` says only that the mark *"recolours from `currentColor`"*,
so the README does not forbid it. One of the two comments is wrong and a future
agent will pick the wrong one.

### P11 — The branch is 17 commits behind `origin/main`, and main has moved under `dynawalla-app/src`.

`HEAD = ae45df70e` is the merge-base; `origin/main = 7f3464cfa`. Main has since
changed **`src/packs/bridge.ts`, `src/packs/items.ts`, `src/packs/services.ts`**
and their two tests. Every gate above was therefore run against a stale base.
None of those files is touched by this pass, so a textual conflict is unlikely —
but `surfaces.test.ts` and `Catalog.tsx` both consume `packs/` types, so the
226-pass result is not evidence about post-rebase main. Rebase, then re-run.

### P12 — Minor, but on the list

* **Painted scrollbars on any fine pointer.** `index.css:126–155` applies
  `scrollbar-width: thin` under `@media (pointer: fine)`. An **iPad with a
  Magic Keyboard or trackpad reports `pointer: fine`**, so a first-class tablet
  target gets drawn tracks — "a drawn scrollbar track" is the first named tell.
  The measurement file records `scrollbarWidth: "thin"` on every page scroller.
* **The rail scrolls by 18 px at 834.** `scrollWidth 820 / clientWidth 802`.
  Both dissolves are on for 18 px of content on iPad portrait — a rail that
  looks scrollable and travels less than a fingertip.
* **The outer gutter is non-monotonic with width** because the rungs are keyed
  to **height** (`tokens.css:646–690`): 16 px @390, **20 px @834**, **14 px
  @1024**, 16 px @1440. Rotating an iPad from portrait to landscape re-guttters
  the whole app (and changes `--dw-stack-gap`, `--dw-row-pad`, `--dw-grid-gap`
  with it). Deliberate and documented — but it is the largest single
  cross-size inconsistency left in the spacing rhythm.
* **`.dw-card-subjects` always reserves two chip rows** (`catalog.css:298`)
  while `Card` only ever emits two chips, which fit on one line in every column
  ≥ 640 px. Every card carries ~22 px of dead reserve at 834/1024/1440.
  It is what makes P-confirmed "same y on every card" work; the cost is real.
* **Segmented option buttons do not carry `.dw-press`** (`Surface.tsx:182–187`)
  — colour transition only, no press scale — against `index.css:285`'s
  *"one press behaviour for everything a finger lands on."*
* **`.dw-find:focus-within`** (`catalog.css:170`) draws the ring on any focus,
  including a touch tap, unlike the app's `:focus-visible`-only rule. Correct
  for a text field on iOS; inconsistent with the stated policy.
* **Three red "Remove" words on one Profiles screen** (`Surface.tsx:330`,
  `tools/shots/light/profiles-390.png`) against a brand governor of "elegant
  and minimal". AA passes; the restraint question is open.

---

## Bottom line

Every gate is genuinely green (226/226, tsc/lint/build clean, 100 captures with
0 overflow / 0 sub-44 targets / 0 AA failures), no test was weakened or deleted,
`surfaces.test.ts` still does its job, and nothing outside
`dynawalla-app/{src,tools}` was touched — `games/` and `packs/` are clean.

The work is real and most of the audit's findings are genuinely closed. Three
things should not ship as-claimed: **P1** (a live visual defect the pass itself
introduced, on the front door, visible in its own screenshots), **P2** and
**P3** (two headline claims that the measurements refute). **P4** and **P5** are
cheap to fix. **P11** means all of the above must be re-run after a rebase.
