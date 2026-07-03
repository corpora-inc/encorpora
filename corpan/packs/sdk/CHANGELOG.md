# Changelog — @corpan/sdk (pack SDK)

All notable changes to the Corpán pack SDK are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
- **Journey W10 — host seam typings.** `HostApi` gains three optional,
  feature-detected members mirrored from the host: `storage?: PackStorageApi`
  (pack-scoped durable KV; `__CORPAN_HOST_CAPS.storageKv >= 1`),
  `localAnalytics?: PackLocalAnalyticsApi` (namespaced on-device events +
  own-aggregate reads; `__CORPAN_HOST_CAPS.localAnalytics >= 1`), and
  `offlineCache?: HostOfflineCacheApi` (cached image URLs + cache-first JSON;
  `__CORPAN_HOST_CAPS.offlineCache === true`). SDK-lagging packs see nothing
  new.
- **Journey activity contract.** `activityContract.ts` — a GENERATED,
  dependency-free copy of the authoritative
  `corpan-app/src/contentPacks/activityContract.ts` (ItemRef +
  `itemRefKey`/`parseItemRef`, ActivitySpec/ActivityResult, the
  `ACTIVITY_TYPES` registry, `PackActivityDeclaration`, `JourneyHostApi`),
  re-exported from `index.d.ts`. Synced by `node packs/sdk/sync-contract.mjs`
  (also refreshes `packs/shared/capabilities/core` and any opted-in vendored
  `packs/<pack>/src/sdk/activityContract.ts`); `--check` mode gates CI on
  drift. `HostApi` gains the optional `journey` seam and
  `ContentPackManifest` the optional `activities` declaration list — both
  additive; packs feature-detect.
- **Mock journey seam for standalone dev.** `createMockHostApi` and
  `mountStandalone` accept `activity?: ActivitySpec`; the mock
  `hostApi.journey` logs reports and stashes them on
  `window.__corpanMockJourney = { items: [], results: [] }` so a pack's
  emissions can be asserted without a host. `mountStandalone` threads the
  spec into `initialState.activity`, mirroring the real host spread.
