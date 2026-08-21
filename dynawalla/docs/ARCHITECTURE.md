# Dynawalla — Architecture

Reversible decisions live here. Irreversible ones are ADRs — see
[DECISIONS.md](DECISIONS.md).

> **Rewritten 2026-07-26 for the host/pack split.** The founder ruled that the
> core app ships no content: every exercise, game, world and asset is a pack, and
> the app is a shell around them
> ([ADR-0022](DECISIONS/ADR-0022-host-ships-no-content.md),
> [ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md)). The layer
> model below is the one that survived that; the layers that were content are
> named where they went rather than deleted.

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
    └── dynawalla-app/         # the HOST: no content, as small as it can be
        ├── public/locales/
        ├── src/app/           # routes, shell, navigation, theme, storage keys
        ├── src/shell/         # the surface model every destination is made of
        ├── src/design/        # tokens, strapwork, the index mark
        ├── src/packs/         # the registry, and the capability boundary
        ├── src/profiles/ src/settings/ src/learner/
        ├── src/world/         # the progress figure: geometry over one integer
        └── src-tauri/         # OWN workspace root, OWN Cargo.lock, OWN [patch]
```

`curriculum/` and `engine/` are **siblings of the app, not inside it**: both must be
importable and testable without building Tauri, and both need their own CI filter so a
curriculum edit does not rebuild the app.

Since the split they are also **not imported by the app at all**, and a test fails
the build if that changes. `curriculum/` is a library for packs to import;
`engine/` is the host's learner model and is unwired until a pack declares a
skill catalog for it to model. `boundary.test.ts` in `src/app/` is the gate.

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

## The layers

Four layers now, not eight. The four that are gone are named below with where
they went, because "we deleted the work surface" is the sort of thing a future
agent re-invents inside the host if nobody says why.

### L1 — Shell (`src/app/`, `src/shell/`)
One Tauri window, hash router, theme and accessibility settings applied
synchronously at module load via store subscriptions that write one class and two
attributes on `<html>`. The design system is built fresh. Exactly one mechanical
layer is inherited from Corpán's stylesheet: the `--safe-{top,right,bottom,left}`
`env()` tokens, `--dialog-max-h`, and the `--z-*` ladder. Those are platform
facts, not taste.

Five destinations — packs, progress, profiles, settings, parents — in a
persistent bottom navigation. **Every destination is described as data**
(`src/shell/surfaces.ts`: rows over a snapshot of host state) and drawn by one
renderer. That is what makes "no destination is ever empty" a test rather than a
habit: `surfaces.test.ts` builds a device nobody has used yet and asserts every
destination still returns rows that carry a value or a working control. Two of
five used to render an empty recess, permanently, with a green suite.

The `<ParentalGate>` component and route guard are still owed
([ADR-0005](DECISIONS/ADR-0005-shell-and-routing.md)); nothing in the host links
out yet, and the one destructive control is two-press rather than gated.

### L2 — Pack boundary (`src/packs/`)
The registry — what is installed, at what version, digest and size — and the
capability object a mounted pack is handed. A pack is given the learner it is for
and the device settings it must honour; it can do exactly one thing back, which
is report an outcome. Forty lines, so that reviewing what a pack can reach is
reading a file rather than auditing an app. The installer and the URI scheme
handler are native and are the next milestone
([ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md)).

### L3 — Storage (`src/app/profile.ts`, `src/app/persist.ts`)
`localStorage`, read synchronously at module load so no screen has a loading
state. Two namespaces: `dynawalla.<profileId>.<name>` belongs to one learner and
is erased with them; `dynawalla.<name>` belongs to the device
([ADR-0018](DECISIONS/ADR-0018-multi-child-profiles.md)). One adapter, shared by
every store, because six copies of "degrade to process lifetime when storage is
disabled" is six chances for one of them to be the copy that throws.

Every persisted store has a `merge` that treats what is on disk as untrusted
input. That is not defensive habit: a bad `currentId` points one child at another
child's record, and a bad total takes away history a child earned.

The IndexedDB tier for an event ring is unbuilt and unneeded — there is no event
ring while the host has no content to generate one.

### L4 — Native boundary (`src/app/platform.ts`, `src/app/permissions.ts`)
The host's own native surface is **one command**: `core:app:allow-version`, read
on the parent surface. `capabilities.test.ts` fails the build if the declared
list and `src-tauri/capabilities/default.json` disagree in either direction — a
new call with no grant fails, and a grant nothing uses fails too, because a live
app cannot narrow its permissions without breaking installed clients.

Non-null CSP and per-command grants, from day one. What a *pack* may reach is a
separate question answered per pack
([ADR-0021](DECISIONS/ADR-0021-pack-capabilities-are-per-pack.md)).

### The layers that left, and where they went

| Was | Now |
|---|---|
| L2 number layer — `NumberFormat`, keypad glyphs, separator-aware judging | A pack's, and a strong candidate for `shared/`. Locale-correct notation is content, and it belongs beside the content that uses it. |
| L3 work surface — answer schemas, `judge`, input, read-aloud | A pack's. The host has no opinion about arithmetic; it knows an outcome was reported. |
| L4 reactions — the effect layer, the picker, the stage | A pack's. Juice belongs to the thing being juicy. The host draws no effects at all. |
| L5 curriculum | `dynawalla/curriculum/`, as a library packs import — exact rational arithmetic, seeded generators, executable mal-rules, the `CG-*` gates. Not deleted, not bundled. |
| L6 learner model | Still the host's (`dynawalla/engine/`), because the host is what follows a learner across packs. Unwired until a pack declares a skill catalog. The host's own record is two totals. |

**The architectural law that survives, in a new form.** "The work surface never
waits for the world" is void — there is no work surface here. What replaces it:
`src/world/` is geometry over one integer with its text alternative handed in,
and a static test fails the build if it reaches for a store, a setting or the
app's copy. A drawing that cannot reach anything cannot be blocked by anything.

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

**Reconsidered by the split.** `shared/net-cache` and `shared/pack-install` were
"moot" under ADR-0003 and are not moot now: Dynawalla installs packs
([ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md)), and the Corpán
pack runtime is the thing to start from rather than the thing to avoid. It is
still real surgery — ~2,900 lines inside `corpan_lib` reached through eight Tauri
commands, with `corpan-pack://` baked into installed packs' JS on user devices,
so the scheme name cannot be renamed without breaking every installed pack — but
"reuse or extend" is now the question, and a second from-scratch runtime in one
repository is the outcome to avoid. It gets its own ADR.

**Still share-later:** `shared/feel` (the host has no reaction layer to share)
and `shared/storage` (the host's per-child state is bounded and small; packs may
well need the real thing).

**Kept separate permanently:** Corpán's corpus/SQLite layer and Django CMS, the TTS
voice-picker machinery, the Journey exercise renderers and its strand/CEFR/phonology
model, the onboarding draft flow, `hostApi.ts`, `tauri-plugin-stt`,
`tauri-plugin-radio-stream`, and `corpan/corpan-app/AGENTS.md`.
