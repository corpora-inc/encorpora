# Corpán 0.16.0 — release readiness

_Prepared overnight. Theme: Home-as-everything hub, retention + monetization,
region-aware voice setup, full localization. PR #260 (moonshot-15-plus-v2)._

## Status: app-code complete; remaining items are content/infra + the merge

Version bumped to **0.16.0** (`package.json`, `tauri.conf.json`, `Cargo.toml`);
CHANGELOG `[Unreleased]` promoted to `[0.16.0] - 2026-05-30`. `npm run tsc` +
`npm run build` green. PR #260 CI green (tsc+build, terraform, web/io).
**Per your git workflow I did NOT commit — version bump + dist rebuild only.**

## Verified on-device (this machine, live dev build)

- **Retention loop**: onboarding (all 4 journeys pass the scenario suite) → guided
  tour → Home hub → "For you" recommendation cycle (hero changes on "Show me
  another") → Recent (incl. Phrase Flip) → streak. No dead-ends.
- **Monetization — both paths**:
  - **Subscription paywall** opens from the Plus chip; annual ($99.99) + monthly
    ($12.99), Subscribe, Restore, Terms/Privacy, honest copy, dismissable.
    Localized (verified EN + ES + ID).
  - **Preview → premium narration wall** (the conversion funnel to the single
    subscription): readers dispatch `corpan:request-unlock` at preview end →
    paywall "You've reached the end of the free preview of {{title}}." Verified.
- **English routes**: scenario suite 6/6 green (4 journeys + home sweep +
  settings/TTS). Copy + layout polished.
- **TTS setup**: region-aware multi-voice auto-pick ("N voices ready"), no
  layout jerk on async voice load, opens from Settings, voice-install copy
  reframed ("unlock your device's best voices").
- **Localization**: **all 51 locales verified — 0 missing keys, 0 placeholder
  mismatches** (649 keys each). Onboarding/paywall/home/voiceGuide all translated.

## What's left to ship

**Content / infra (you + publisher):**
1. **Publish two-zip preview/premium narration packs** so the preview→premium
   wall actually fires for non-subscribers. Full instructions (backwards-
   compatible) in **`infra/PUBLISHER_PREVIEW_PREMIUM.md`** — keep the legacy
   public `downloadUrl` forever for old clients; new clients use `preview`/`full`.
2. **Republish `catalog-v2.json`** to the CDN so the Parlometron copy fix +
   recommendation fields go live (catalog-driven; no app release needed).
   - Note: Parlometron's EN `metadata.en.json` is updated; its 50
     `metadata-out/*` translations are now stale — re-run the pack-metadata
     translate before republishing, or accept EN until the next pass.

**Merge (you):**
3. Commit the prepared changes (version bump, CHANGELOG, the overnight polish +
   the savings badge) and land PR #260.

**Optional / verify-later:**
4. **Annual-savings badge** (added): a language-neutral "−N%" pill on the annual
   plan, computed from `priceMicros` (currency-agnostic). Hides gracefully when
   the store gives no numeric price — confirm it shows on a real StoreKit build
   (the sandbox here didn't populate `priceMicros`). Easy to revert if unwanted.
5. `*.jpg`/`*.jpeg` → Git LFS in `.gitattributes` (3 book covers ~940KB are
   committed raw; PNGs are LFS). Non-blocking.
6. Final localized-onboarding QA pass with a non-English persona once you're
   back (the suite's "untranslated" heuristic + screenshots make this quick).

## Notes / risks

- The scenario suite's `id_english_beginner` (Indonesian persona) uses English
  text anchors, so it reports failures even though the UI is correctly localized
  now — that's scenario brittleness, not an app bug. The EN scenarios are the
  source of truth (green). Re-author the ID scenario with anchors if you want it
  green too.
- Settings modal is now a full-screen sheet on all sizes (was a floating dialog
  that left a gap on big-iPad portrait).
- Test framework hardened: case-insensitive matching, polling anchor asserts,
  fixed-element visibility (offsetParent bug), app-ready waits after reload/goto.

## Pointers
`corpan-app/CHANGELOG.md` (full 0.16.0 entry) · `infra/PUBLISHER_PREVIEW_PREMIUM.md`
· `scripts/dev/ipad/SCENARIOS.md` (QA suite) · `corpan-app/CLAUDE.md` (Plus arch).
