# Dynawalla — Architecture

Reversible decisions live here. Irreversible ones are ADRs — see
[DECISIONS.md](DECISIONS.md).

## Placement

`dynawalla/` is a **top-level sibling of `corpan/`**. Every product in this repo is
already top-level; there is no `apps/` or `packages/`, no npm workspaces and no Cargo
workspace. Every `ci.yml` area filter is rooted at a top-level path segment, so
introducing an `apps/` layer would mean rewriting every filter and relocating 5,000+
Corpán files for no benefit.

```
encorpora/
├── AGENTS.md                  # one trunk runbook, both products
├── native/                    # M3 — product-neutral Rust
│   ├── plugins/tauri-plugin-{haptics,tts,iap,subscriptions,llm,game-packs,...}
│   ├── crates/{corpora-crash-breadcrumb, corpora-asr-contract}
│   └── vendor/{ndk-context, llama-cpp-sys-2}   # dirs move; [patch] does NOT
├── shared/                    # alias @platform/* — three modules only
│   ├── kernel/                # rng.ts, clock.ts, boundary.test.ts
│   ├── i18n-gate/             # check-i18n.mjs, parameterized
│   └── tooling/               # bump-version.mjs, parameterized
├── corpan/                    # unchanged
└── dynawalla/
    ├── AGENTS.md              # delta only; inherits root AGENTS.md
    ├── docs/                  # this directory
    ├── curriculum/            # no React, no DOM — own CI filter
    │   ├── graph/domains/*.ts · generators/*.ts · malrules/*.ts
    │   ├── validate/          # C-gates, `dw-curriculum check`
    │   └── build/compile.ts   # -> dynawalla-app/public/curriculum/*.sqlite3
    ├── engine/                # pure TS learner model, no IO
    │   ├── {types,constants,elo,facts,bugs,scheduler,flow,latency}.ts
    │   ├── boundary.test.ts · sim/  (personas, G-gates)
    └── dynawalla-app/
        ├── public/{locales,curriculum}/
        ├── src/{app,design,number,work,reactions,world,profiles,store}/
        └── src-tauri/         # OWN workspace root, OWN Cargo.lock, OWN [patch]
```

`curriculum/` and `engine/` are **siblings of the app, not inside it**: both must be
importable and testable without building Tauri, and both need their own CI filter so a
curriculum edit does not rebuild the app.

`native/` and `shared/` stay separate because a Rust change and a TypeScript change have
different toolchains and different blast radii. One coarse `platform/` filter would run
cargo on a TypeScript edit.

## Reversible decisions, made

| Concern | Decision |
|---|---|
| Frontend | React 19 + Vite + TS + Tailwind 4 — the versions CI already builds |
| Routing | react-router v7 `createHashRouter` ([ADR-0005](DECISIONS/ADR-0005-shell-and-routing.md)) |
| State | zustand 5, per-entity persisted stores read at point of use; never prop-drilled |
| Tests | `node --experimental-strip-types --test`, Node 24 via `.nvmrc` + `engines`. No vitest |
| Generators | TypeScript, exact integer/rational arithmetic, own seeded PRNG |
| Curriculum authoring | Typed TS modules compiled to SQLite |
| Event namespace | `corpora:` prefix, typed dispatcher |
| Reference devices | Samsung Galaxy Tab A9 SM-X110 (4 GB) · Pixel 6a · iPad 10th gen |

## The eight layers

### L1 — Shell
One Tauri window, hash router, theme applied synchronously at module load via a store
subscription toggling one `classList` entry. The design system is built fresh. Exactly
one mechanical layer is inherited from Corpán's stylesheet: the
`--safe-{top,right,bottom,left}` `env()` tokens, `--dialog-max-h`, and the `--z-*`
ladder. Those are platform facts, not taste.

The `<ParentalGate>` component and route guard ship here, in M1
([ADR-0005](DECISIONS/ADR-0005-shell-and-routing.md)).

**Architectural law: the work surface never waits for the world.** Problem, keypad and
verdict own input in DOM/CSS; reactions live on one `pointer-events: none` canvas; the
world is procedural SVG. A static AST test fails the build if anything under
`src/world/` or `src/reactions/` imports from `src/work/` or `engine/`.

### L2 — Number layer (`src/number/`)
This layer does not exist anywhere in this repo today: `rg 'Intl\.NumberFormat|toLocaleString'`
over the Corpán app returns **zero** hits, and zero CLDR plural-category keys exist
across 55 locale directories.

`NumberFormat` owns the decimal separator, grouping separator, numbering system and
numeral direction. It drives the keypad glyphs, the slate renderer **and `judge`**, which
normalizes the locale separator before comparison and accepts `3,5` in fr/de. Gate CG-14
requires every generator's `canonical` and `alsoAccept` to round-trip through
format→parse in all launch locales. `columnAlgorithm` is forced `dir="ltr"` with an
explicit test.

It is L2 and it ships in M2 because math notation is content, not chrome. See
[ADR-0007](DECISIONS/ADR-0007-launch-locales.md).

### L3 — Work surface (`src/work/`)
Four answer schemas in V1, not eight:

```ts
type AnswerSchema =
  | { kind: "integer"; digits: number }
  | { kind: "columnAlgorithm"; cols: number; marks: "carry" | "borrow" | "none" }
  | { kind: "fraction"; parts: ("num" | "den" | "whole")[] }
  | { kind: "choice"; k: 2 | 3 | 4 }

judge(schema, submitted, canonical, alsoAccept, locale): Verdict
```

`decimal` is a parameterization of `integer` + `NumberFormat`. `orderCards`,
`plotPoint`, `buildExpression` and the V2 manipulation schemas (`dragPlace`,
`drawSegment`, `dialRead`, `buildChart`) are V2, each with its own judge branch,
touch-target model and accessibility story.

`judge` is pure, synchronous and sub-millisecond; persistence happens *after* the verdict
paints. Input binds `pointerdown` with `touch-action: manipulation`, with ≥2 cm targets
for grades 1–3.

**No auto-submit keyed off digit count.** A unit test asserts no schema exposes
`canonical.length` to the input layer, because that silently tells a child how many
digits the answer has.

**Read-aloud lives in this layer, in M2.** Grade-1 content ships at M4 and a six-year-old
cannot read the prompts, so read-aloud is an input method, not an accessibility nicety.
WebView `speechSynthesis` first (free, no plugin), native TTS plugin behind the same seam
from M3.

### L4 — Reactions (`src/reactions/`)
See [EXPERIENCE_DESIGN.md](EXPERIENCE_DESIGN.md) for the vocabulary and budgets. The
architectural contract:

```ts
interface Reaction { play(): void; settleNow(): void; dispose(): void }
```

The input handler calls `settleNow()` **synchronously** before processing any event. No
reaction is ever awaited. Reactions anchor in world space so the world can animate around
the next problem while the work surface has already moved on.

### L5 — Curriculum
See [CURRICULUM.md](CURRICULUM.md).

### L6 — Learner model
See [ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md). Engine purity is enforced by
`boundary.test.ts` in the **first** engine PR, before any model code.

### L7 — Storage
Two tiers: `localStorage` for settings that must be read synchronously at module load,
IndexedDB for the event ring. Both namespaced by `profileId` from the first write
([ADR-0018](DECISIONS/ADR-0018-multi-child-profiles.md)).

Dynawalla writes its own ~300-line adapter and does **not** adopt Corpán's storage layer.
With a bundled curriculum, no audio assets, no models and bounded per-child state, the
`QuotaExceededError` class of failure that justifies Corpán's much larger layer does not
exist here.

### L8 — Native boundary
V1 plugin set: **haptics, tts**; iap/subscriptions only if
[ADR-0013](DECISIONS/ADR-0013-monetization-model.md) requires them. Nothing else — see
[ADR-0004](DECISIONS/ADR-0004-no-mic-no-llm-no-3d.md).

The Tauri capability surface is narrow from day one: **non-null CSP and per-command
grants**, not Corpán's single `capabilities/default.json` with almost every plugin at
`:default` and `csp: null` — 11 of its 14 grants are `:default`; only
`clipboard-manager:allow-write-text`, `tts:allow-speak` and
`subscriptions:allow-show-manage-subscriptions` name a command. A live app cannot narrow
permissions later, so this is creation-time.

## Shared platform

The policy, tightened by adversarial review: **extract only where it deletes lines net,
today, with both consumers already calling it.** Anything else is three units of work
(write it in Dynawalla, write it again generically, delete one, re-verify Corpán) plus a
production risk, for a module with two callers.

**Wave 0 (M0a, blocking): the native CI gate.** Nothing moves until one exists. Today
there is zero `cargo`/`clippy`/`rustup` invocation in any required check;
`corpan/plugins/**` matches none of the area filters; the only cargo in PR CI is a
non-required workflow with workflow-level `paths:` and no `merge_group:`.

**Wave 1 (M3): `native/`.** The plugin directory move, the vendor directory move (with
`[patch]` staying put — [ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md)),
a new `corpora-crash-breadcrumb` crate, a generated `.cargo/config.toml`, and the
hygiene items.

**Wave 2 (M1–M2): `shared/`, three TypeScript modules and no more.**

| Module | Contents | Corpán cost | When |
|---|---|---|---|
| `shared/kernel/` | `rng.ts` (FNV-1a + mulberry32, pinned known-answer vectors), `clock.ts`, `boundary.test.ts` | ~3 import lines, migrated in the same PR | M2 |
| `shared/i18n-gate/` | `check-i18n.mjs` parameterized by locale root and reference locale; preserves the existing checks and **adds CLDR plural-category checking** | 1 line | M1 |
| `shared/tooling/` | `bump-version.mjs` parameterized by app dir; keeps package.json / tauri.conf.json / Cargo.toml / Cargo.lock in lockstep and exits nonzero rather than no-op | 1 line | M1 |

Consumption is a build-time source alias `@platform/*` → `shared/*`, matching the
existing `@shared/*` precedent in the Corpán app's tsconfig and vite config. The old
alias is untouched.

**Moved to share-later**, on the "does it delete lines today" test: `shared/feel`
(Dynawalla's reaction layer is built in M2 and the picker's streak coupling means it must
diverge anyway), `shared/storage` (no quota problem here), `shared/net-cache` and
`shared/pack-install` (moot — [ADR-0003](DECISIONS/ADR-0003-no-downloadable-packs-v1.md)),
and the Corpán pack runtime (~2,900 lines inside `corpan_lib` reached through eight Tauri
commands, with `corpan-pack://` URLs baked into installed packs' JS on user devices —
real surgery, not a move).

**Kept separate permanently:** Corpán's corpus/SQLite layer and Django CMS, the TTS
voice-picker machinery, the Journey exercise renderers and its strand/CEFR/phonology
model, the onboarding draft flow, `hostApi.ts`, `tauri-plugin-stt`,
`tauri-plugin-radio-stream`, and `corpan/corpan-app/AGENTS.md`.
