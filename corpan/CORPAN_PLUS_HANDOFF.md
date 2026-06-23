# Corpán Plus — overnight build handoff (2026-05-28)

Branch: **`moonshot-15-plus-v2`** (encorpora) + **`master`** (ttsctl, pushed).
All commits typecheck clean (`corpan-app` `tsc --noEmit` exits 0). Nothing was
run against production S3/catalog. No app-store submission touched.

## What shipped (committed)

**Phase 1 — two-ZIP publishing (ttsctl, pushed to origin/master)**
- `ttsctl publish --with-preview` (default OFF) emits 3 artifacts: legacy public
  ZIP (unchanged), `narrations/preview/` (public, first `min(floor(total/3),100)`
  segments), `narrations/premium/` (CloudFront-signed, Plus-gated). Catalog entry
  gains `preview`/`full`/`totalSegments`/`freeSegments` alongside legacy fields.
- `--free-segments` flag + `narration.yaml narration.free_segments` override.
- Verified offline on Olmec EN (904 segs → 100 free; full ZIP byte-stable).

**Phase 2 — paywall + reader hookup + per-book retirement**
- `installManager` two-ZIP switch: subscriber → signed full ZIP; else preview ZIP.
- `PaywallSheet` (subscription-only) + `store/paywall.ts`, opened by the
  `corpan:request-unlock` window event. Wraps the existing `SubscriptionOffer`.
- Readers (earthgate + stargate) detect a finished preview → dispatch unlock.
- `PackActions`: per-book Buy button → "Unlock with Corpán Plus"; subscribers +
  legacy per-book owners stay entitled.
- analytics: `app_paywall_shown/dismissed/converted`.

**Phase 3 — onboarding redesign**
- Flow: Welcome → Primary language → **Who's this for?** → (learners: target
  langs → voices) → **localized Plus pitch** → Finish. Enjoyers/kids skip the
  language+voice steps. New `OnboardingUserClass` + `OnboardingPlusPitch`.
- `settings.ts`: `userClass`/`ageBand`/`goalIntensity` (+ `setUserProfile`, persisted).

**Phase 4 — progress, auto-install, streak (substrate complete)**
- `store/progress.ts` (localStorage): deepest segment per (book,lang), with
  `booksInFlight`/`booksFinished`/`streakDays`/`segmentsToday`. Fed by the
  `corpan:segment-progress` window event from both readers (dist rebuilt).
- `SystemPackInstaller`: silently installs/upgrades catalog packs flagged
  `systemPack:true` on launch (via installPack+addGame, no dialog). Mounted.
- `StreakChip` mounted in header (opt-in) + `StreakToggle` in Settings;
  strings localized in all 50 locales.
- Catalog `systemPack?` flag + two-ZIP fields added to app-side types.

**i18n — DONE for all of the above**
- All new paywall + onboarding + streak strings translated into the 50 shipped
  locales via Vertex Gemini Flash (`translate_corpan_plus_keys.py`), brand terms
  + `{{placeholders}}` preserved, JSON validated.

**Phase 5 — copy, i18n, backfill, docs**
- `APP_STORE_DESCRIPTION_0_13_0.md` + `APP_STORE_WHATS_NEW_0_13_0.md`.
- Canonical EN keys seeded (`en/common.json` + `add_corpan_plus_keys.py`).
- `infra/scripts/backfill_two_zip.py` (dry-run verified: 532 entries).
- `CLAUDE.md` Corpán Plus architecture section.

## Remaining work

### A. Genuinely visual/UX — warrant eyes on a device (built blind = risky)
1. **Library pack** (`packs/library/`) — curated Continue/Recommended/All
   shelves as a standalone `systemPack`. Partly overlaps existing
   `createCatalogBrowser`/`createAppShell` in `@shared/catalog`; the new part
   is the progress-driven Continue shelf + userClass recommendations. Clone
   `packs/earthgate-reader/` scaffolding; mark `systemPack:true` in the catalog
   (auto-install already wired). When it exists, point enjoyer/kid onboarding
   finish-routing at it.
2. **BookEndCard** — themed next-book recommendations when a FULL book ends
   (readers already have catalog access via appShell; the data/event hook is
   easy, the card visual is the judgment call).

### B. Production-mutating — must NOT run unattended (money / live catalog / stores)
3. **Run the backfill** — `python infra/scripts/backfill_two_zip.py` (dry run
   verified: 532 entries), review, `--apply`, then invalidate `/catalog-v2.json`.
4. **Prod publish test** — `ttsctl publish <pack> --lang en --with-preview` on one
   sacrificial book; confirm preview URL 200 / premium URL 403-without-signature;
   then flip `--with-preview` default to ON.
5. **App Store / Play Console** — attach products, submit (per IAP_IMPLEMENTATION_STATE.md).

## Verification guide (when you're at a device)

- Fresh install → onboarding: Welcome → pick primary lang → "Who's this for?"
  → learner path shows langs+voices, enjoyer/kid skip to pitch → Plus pitch
  (localized) → Finish.
- Install a preview pack (after backfill) on a non-subscriber → only preview
  segments present; play to the end → PaywallSheet opens naming the book.
- Subscribe in StoreKit sandbox → next install of that book pulls the full ZIP.
- Packs tab: premium packs show "Unlock with Corpán Plus" (no per-book price).

## Risk notes
- Paywall is "soft" during the transition: the legacy public full ZIP stays on
  S3 for old runtimes, so a crafted request could still fetch full content. New
  users on new builds get preview→paywall. Hardens only if legacy publishing is
  sunset (deferred — people don't update).
- Reader `totalSegments` reported to the progress store is the *installed* pack's
  length (preview = its own length), so a finished preview reads as "complete."
  The paywall still fires correctly; refine if Library needs true full totals.
