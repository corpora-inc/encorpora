# Journey — Phase 3 Build Plan

**Status: v1.0. Owner: CTO/integrator. Branch: `journey`.**
Rule zero: every workstream owns an **exclusive path set** — no two teams touch the
same file. Shared seams (`contentPacks/types.ts`, `hostApi.ts`, `App.tsx`, locales,
`quotas.ts`) belong to W0 or W10 only. Each workstream builds from its spec; specs are
post-reconciliation (CTO-RESOLUTIONS.md applied).

## Wave 0 — the keel (sequential, first)

**W0 Contract layer** — `specs/activity-contract.md`
Paths: `corpan-app/src/contentPacks/activityContract.ts` (new),
`activitySchemas.ts` (new), `types.ts` (widen PackLaunchEntry, add journey member),
`hostApi.ts` (journey seam + activitySession), `ContentPackHost.tsx` (HOST_CAPS.journey,
spec injection), `packs/sdk/sync-contract.mjs` (new) + SDK copies, mock host.
Exit gate: `npm run tsc` green; contract unit tests (session lifecycle, dedup,
teardown synthesis, Zod boundary); sync-contract --check green.

## Wave 1 — the big parallel build (after W0 merges)

| WS | Deliverable | Spec | Exclusive paths |
|----|-------------|------|-----------------|
| W1 | Storage platform + local analytics | storage-analytics.md | `src/lib/storage/**` (re-home of util/storage w/ shims), Rust `blob_store_*` commands |
| W2 | Offline cache + OfflineImage + Home covers | offline-cache.md | `src/lib/offlineCache/**`, `offline_cache_*` Rust commands, `<OfflineImage>` component + the 4 img call sites |
| W3 | Engine + simulation harness | engine.md | `src/journey/engine/**`, `scripts/journey-sim/**` |
| W4 | Feed surface + renderers + runtime | feed-ux.md | `src/journey/**` (minus engine/, content/), journey i18n keys in `public/locales/**` (all 54) |
| W5 | Content resolver | content-resolver.md | `src/journey/content/**` |
| W6 | Course-pack pipeline (builder/validator/publisher + app catalog) | course-pack.md | `dja/journey_pack/**`, `src/contentPacks/journeyPackCatalog.ts`, `src/util/journeyPack.ts`, `src/store/journeyPacks.ts` |
| W7 | Curriculum content: gap packs, grammar nodes, unit YAML, es overlay | authoring.md | `dja/journey_pack/courses/en/**`, gap phrase packs via existing tools |
| W8 | Capability modules ×3 (pronounce, squeeze, segment-player) | capability-modules.md | `packs/shared/capabilities/**` + consumer-side refactors inside pronunciation-coach, juice-squeeze, earthgate (move, never fork) |
| W9 | Provider instrumentation | activity-contract.md §6 | `packs/lingo-hero/**`, `packs/corpan-city/**` (adapter), earthgate journey params (coordinate with W8's earthgate touch — W8 owns earthgate files; W9's earthgate items fold into W8's brief) |

Cross-team stubs: W3 codes against `EnginePersistence` (W1's interface, frozen in the
spec) and the R4 registry (W0). W4 codes against a fixture engine + fixture resolver
until W3/W5 land. W6/W7 vendor the ACTIVITY_TYPES constant.

Each Wave-1 team: works in an isolated worktree; delivers a focused diff + changelog
entries + tests; CTO integrates onto `journey` in dependency order
(W1→W2→W3→W5→W6→W7→W8→W9→W4 last, biggest surface).

## Wave 2 — integration (W10, CTO-led)

`App.tsx` journey surface wiring, onboarding graph nodes, LandingIntent, HomeHub hero
card, `quotas.ts` journey quota, entitlement wiring, `check:i18n` green, full
`tsc`+build+test, engine simulation acceptance gates (P-gates from engine spec incl.
P8 against the real pack), airplane-mode cold start, es→en end-to-end walkthrough on
the built app, journey_en 0.1.0 pack build + validate (publish stays operator-gated).

## Standing rules for every team

- Read `CTO-RESOLUTIONS.md` before your spec; rulings override anything stale.
- House rules: changelog `[Unreleased]` entries per touched unit; no absolutes in
  copy; every new t() key ships in all ~54 locales; no `Date.now()` in engine core
  (injected clock); IndexedDB via the W1 adapters only; imports of another team's
  in-flight paths are forbidden — code to the spec'd interface, integration wires it.
- Tests ship with the code, runnable headless on this machine.
