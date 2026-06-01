# Corpán Plus — agent-to-agent briefing (retention & monetization reform)

You're picking up on-device testing/iteration of the Corpán Plus work. I built
it without a device, so everything below is verified at the type/build level but
NOT exercised on a real phone with StoreKit. This document is everything I know
and was thinking. Read it fully before changing anything — several pieces look
removable but aren't.

Branch: **`moonshot-15-plus-v2`** (encorpora repo at `/home/skyl/encorpora`).
ttsctl work is on **`master`** (pushed, `/home/skyl/projects/ttsctl`).
Quick status doc: `CORPAN_PLUS_HANDOFF.md`. This doc is the deep version.

---

## 1. The strategy (what we're actually doing and why)

Corpán gave everything away free and asked people to pay out of goodwill →
~zero conversions. The reform:

- **Subscription-only.** Per-book IAP is RETIRED (a month of à-la-carte books
  drew zero buyers; per-book SKUs are operationally expensive). Product is
  **"Corpán Plus"**; members are **"Corpanistas"**. Existing per-book owners
  stay entitled forever; we just never show a per-book buy button again.
- **Generous, permanent free tier.** The first `min(floor(total/3), 100)`
  segments of EVERY book in EVERY language are free forever. The paywall lands
  at the moment of engagement: you finished the free preview and want more.
- **The free cut MUST be enforced server-side, not client-side.** Corpán is
  open source. A client-side `if (segment < freeN)` is trivially patched out of
  a fork. So the publisher emits a *physically truncated* preview ZIP — the free
  user never receives the bytes for the paid segments.
- **Onboarding personalizes.** A short, on-device-only survey ("Who's this
  for?") tailors the landing experience and lets the Plus pitch speak to the
  user. Primary-language-FIRST so every later screen (and the pitch) is
  localized.
- **Principles (non-negotiable, enforced in code review):** no ads ever; no
  login (Apple/Google account = identity); on-device analytics only (no
  persistent device ID); localize everything; no Duolingo dark patterns (streak
  is opt-in + silent).

---

## 2. The core architecture — three ZIPs, hybrid catalog, clean runtime

This is the most important thing to understand.

**Publisher emits THREE artifacts per narration** (`ttsctl publish --with-preview`):
```
narrations/<id>-<ver>.zip            LEGACY — public, full content. Old runtimes only. Unchanged.
narrations/preview/<id>-<ver>-preview.zip   NEW — public, first freeN segments. New runtime, non-subscribers.
narrations/premium/<id>-<ver>.zip    NEW — CloudFront-signed, Plus-gated. New runtime, subscribers.
```

**One catalog entry carries BOTH field sets.** `catalog-v2.json` entries keep
the legacy `downloadUrl`/`tier`/`purchase` (old runtimes read these) AND gain
`preview`/`full`/`totalSegments`/`freeSegments` (new runtime reads ONLY these).
Each side ignores the other's fields. No catalog version split.

**Why three, not two:** people don't update. Old app builds must keep working
indefinitely off the legacy public ZIP. So legacy publishing continues forever
(or until we decide to sunset it). **Consequence — the paywall is "soft" during
this transition:** the full content is still publicly fetchable via the legacy
`downloadUrl` for old clients, so a crafted request could grab it. New users on
new builds get preview→paywall; existing users lose nothing. The paywall only
"hardens" if/when legacy publishing is ever stopped. This is an accepted,
deliberate tradeoff — don't "fix" it by breaking old clients.

**The new runtime reads ONLY `preview`+`full`.** An entry without those fields
is invisible to the new Library/flow — this forces every pack to be republished
through `--with-preview` before it shows to new users. No fallback to
`downloadUrl` in the new path. Single clean codepath.

`--with-preview` defaults **OFF** right now (so active auto-publishing is
unaffected). The plan is: prove it on one sacrificial pack in prod, then flip
the default ON.

Free cutoff: `compute_free_segments(total, override)` = `min(total//3, 100)`,
overridable via `--free-segments` or `narration.yaml` `narration.free_segments`.

---

## 3. The event bus — how packs talk to the host (CRITICAL mental model)

Reader/Library packs are loaded as `<script>` injected into the SAME `window`
as the main app (NOT iframes) — but each pack is a **separately bundled dist**,
so it has its OWN module instances. **A pack CANNOT read the app's Zustand
stores directly.** They communicate two ways:

1. **The `HostApi` object** passed to the pack at mount (speak, getStackConfig,
   stt, etc.) — see `corpan-app/src/contentPacks/hostApi.ts`.
2. **`window` CustomEvents** — the established cross-context channel. The
   existing code already uses `corpan:purchase-recorded`,
   `corpan:subscription-recorded`, `corpan:restore-purchases-requested`.

I added two new events on this bus:

- **`corpan:request-unlock`** — a pack asks the host to open the paywall.
  `detail: { surface, bookTitle?, bookId?, language? }`. Dispatched by the
  readers at end-of-preview and by `PackActions` "Unlock with Plus". App.tsx
  listens and opens `PaywallSheet`.
- **`corpan:segment-progress`** — a reader reports the deepest segment reached.
  `detail: { bookId, language, segmentsReached, totalSegments }`. App.tsx writes
  it to the progress store.

**Why events, not HostApi methods:** the plan originally specified
`hostApi.requestUnlock()` etc., but the window-event pattern was already
established for purchases and is simpler (no SDK type changes, works across the
bundle boundary). This is an intentional deviation from the written plan.

The reader-side entitlement/purchase logic lives in
`packs/shared/catalog/src/purchaseManager.ts` — it talks to the IAP plugin
DIRECTLY via Tauri `invoke` (`plugin:iap|get_product_status`, `restore_purchases`,
etc.), because it can't read the app's entitlement store. `isCurrentlySubscribed()`
is the live check.

---

## 4. File-by-file: what changed and why

### ttsctl (separate repo, on master, pushed)
- `ttsctl/publisher.py` — `package_narration()` gained additive preview params
  (`limit_to_segments`, `preview_of_total`, `zip_suffix`). When set: include only
  those segments' audio + audio_manifest entries, truncate segments docs to the
  document prefix ending at the last included segment (keeps interleaved
  display-only headings), stamp narration manifest `isPreview:true`/
  `previewOfTotal`, and stamp `is_preview:true` into the truncated segments.json
  wrapper. Default (no params) = byte-identical to before (verbatim copy
  preserved — important so existing full-ZIP SHAs don't churn). Helpers:
  `_ordered_tts_segment_ids`, `compute_free_segments`, `_truncate_segments_doc`,
  `_read_free_segments_override`.
- `ttsctl/cli.py` — `publish` gained `--with-preview` (default off) +
  `--free-segments`. When on: builds preview ZIP → `narrations/preview/`, copies
  the full ZIP → `narrations/premium/`, adds the new catalog fields. Legacy
  upload + catalog fields untouched.
- `changelog/decisions/2026-05-28_corpan_plus_two_zip_publishing.md`.

### Reader catalog shared lib (`packs/shared/catalog/`)
- `src/types.ts` — `NarrationArtifact` type + additive optional
  `preview`/`full`/`totalSegments`/`freeSegments` on `CatalogNarrationEntry`.
- `src/installManager.ts` — **the install switch.** `installNarration` now
  branches FIRST on `isTwoZipEntry(entry)` (has preview+full): subscriber →
  request a signed URL for `full.url` (signed with `corpan.plus` + restored sub
  receipt) and download it; else → download `preview.url` directly (public). I
  generalized the old `getSignedDownloadUrl` into `requestSignedUrl(url,
  productId, packId, txn, receipt, platform)` and made `SignedUrlResult` an
  `ok`-discriminated union (the old `{url:string}|{url:null,...}` shape didn't
  narrow on `!signed.url`). Legacy entries fall through to the unchanged path.
- `src/purchaseManager.ts` — added `resolveSubscriptionReceipt()` (restores a
  sub receipt for the full-ZIP download).
- `index.ts` — re-exports the new type + `isTwoZipEntry` + the purchase helpers.

### Reader packs (`packs/earthgate-reader/`, `packs/stargate-reader/`)
Both got the SAME three edits in `src/game.ts`:
- `let isPreview` set on load: `segData.is_preview === true || segments.length <
  total_segments`.
- In the audio engine's **"Playback ended"** callback: `if (isPreview)
  maybeOfferPlus()` → dispatches `corpan:request-unlock` with book context.
- In the **segment-change** callback: `reportSegmentProgress(index)` →
  dispatches `corpan:segment-progress`.
- **`dist/app.js` + `dist/app.css` were rebuilt and committed** (these dirs are
  gitignored BUT the files are tracked — force-added historically; the narration
  pipeline bundles them at publish time, so changes don't ship until rebuilt).
  If you edit reader src, you MUST `npm run build` in the pack and force-add dist.

### Main app (`corpan-app/src/`)
- `store/paywall.ts` — NEW. `usePaywallStore` (open/context/openPaywall/close).
- `components/paywall/PaywallSheet.tsx` — NEW. A shadcn `Dialog` that WRAPS the
  existing `SubscriptionOffer` (which is a complete purchase state machine — I
  reused it rather than rebuild). Headline + book subhead + dismiss + a
  post-subscribe "Continue". Subscription-only, no per-book option.
- `App.tsx` — listens for `corpan:request-unlock` (→ open paywall) and
  `corpan:segment-progress` (→ progress store). Mounts `<PaywallSheet/>`,
  `<SystemPackInstaller/>`, `<StreakChip/>` (in the top-right header flex).
- `components/packs/PackActions.tsx` — per-book Buy button → "Unlock with Corpán
  Plus" (opens paywall). Entitlement = subscribed OR legacy per-book owned.
  Removed `purchaseAndVerify`/`isPurchasing`.
- `store/settings.ts` — added `userClass`/`ageBand`/`goalIntensity` +
  `setUserProfile` (persisted in `corpan-stacks-v1`). Types `UserClass`,
  `AgeBand`, `GoalIntensity`.
- Onboarding (see §5).
- `store/progress.ts` — NEW. `useProgressStore` (localStorage `corpan-progress-v1`),
  per-(book,lang) deepest segment + selectors `booksInFlight`/`booksFinished`/
  `streakDays`/`segmentsToday`.
- `components/StreakChip.tsx` + `components/StreakToggle.tsx` — opt-in streak
  (off by default via `localStorage corpan-streak-enabled`). Toggle is in
  Settings.
- `components/SystemPackInstaller.tsx` — silently installs/upgrades catalog
  packs flagged `systemPack:true` on launch (via `installPack`+`addGame`, no
  dialog). Renders null.
- `contentPacks/catalog.ts` — `systemPack?:boolean` on `CatalogGame`; two-ZIP
  fields + `NarrationArtifact` on the app-side narration type (parity).
- `util/analytics.ts` — `trackPaywallShown/Dismissed/Converted`.

### i18n
- `public/locales/en/common.json` seeded with the new keys
  (`add_corpan_plus_keys.py`).
- `public/locales/translate_corpan_plus_keys.py` — translated all new keys into
  the **50 non-en locales** via Vertex Gemini Flash (`gemini-2.5-flash`),
  preserving brand terms + `{{placeholders}}`. Re-runnable (only-missing merge).

### Docs / infra
- `APP_STORE_DESCRIPTION_0_13_0.md`, `APP_STORE_WHATS_NEW_0_13_0.md`.
- `infra/scripts/backfill_two_zip.py` — migrate existing catalog to two-ZIP
  (dry-run default; verified it identifies 532 entries).
- `CLAUDE.md` — Corpán Plus architecture section.

---

## 5. Onboarding flow — and a fragility to respect

Step machine is **hardcoded numeric indices** in `OnboardingWizard.tsx`. New order:
```
0 Welcome → 1 PickPrimary → 2 UserClass
  learner/polyglot: → 3 PickLearning → 4 TTS → 5 Pitch → 6 Finish
  enjoyer/kid:      →                          5 Pitch → 6 Finish
```
- `OnboardingUserClass.tsx` (NEW, step 2): 4 cards (learner/enjoyer/polyglot/
  kid_native) + age band for kids. On Continue: learner/polyglot → `setStep(3)`;
  enjoyer/kid → `setStep(5)`. Sets `userClass`/`goalIntensity`/`ageBand`.
- `OnboardingPlusPitch.tsx` (NEW, step 5): localized pitch. Primary CTA opens
  the paywall (`surface: onboarding_pitch`); secondary → `setStep(6)`. Back
  routes to 4 (learner/polyglot) or 2 (enjoyer/kid).
- Existing steps I retargeted: `PickLearning` onBack 1→2, onNext 3→4; `Finish`
  onBack 4→5. `PickPrimary`(→2), `Welcome`(→1), `TTS`(→5/back 3) happened to
  already match the new indices.

**GOTCHA:** because indices are hardcoded across components, if you insert/remove
a step you must re-audit every `setStep(n)` call. Grep `setStep\(` /
`setOnboardingStep\(` across `components/Onboarding*.tsx`. I deliberately left
`OnboardingPickPhrasePacks` OUT of the flow (component still exists, just not
referenced).

**NOT done:** the simplified endonym-search language picker (Phase 3.5 in the
plan). `PickPrimary`/`PickLearning` use the existing reorderable stack widget.
The user noted that widget is too complex for onboarding beginners — building a
search/autocomplete picker that reads naturally in all ~50 langs is open work.

**NOT done:** enjoyer/kid finish-routing should land them in the Library; right
now everyone lands in `MainExperience` (Library pack doesn't exist yet).

---

## 6. What's VERIFIED vs NOT (be skeptical of the NOTs)

**Verified:**
- `corpan-app` `tsc --noEmit` clean at every commit.
- earthgate-reader `vite build` clean (143 KB) WITH the shared-catalog changes;
  stargate built too. (Both readers' game.ts compile; stargate has 1 PRE-EXISTING
  unrelated `WaveformConfig` tsc error that also exists on main.)
- Preview packaging offline test (Olmec EN, 904 segs → 100 free): preview ZIP
  has exactly 100 m4a, filtered audio_manifest, truncated segments.json (103
  entries = 100 tts + 3 headings), `isPreview` stamps. Full ZIP byte-stable.
- Backfill dry-run against the LIVE catalog: 532 entries, keys resolve.
- 50-locale translation: brand + placeholders preserved (spot-checked
  es/ja/ar/zh-Hans/hi/uk); all 51 common.json valid JSON.

**NOT verified (your job on-device):**
- The actual paywall purchase flow (StoreKit/Play sandbox). I never ran it.
- That `corpan:request-unlock` / `corpan:segment-progress` events actually fire
  from the rebuilt reader dist at runtime and reach App.tsx. (The wiring is
  there; runtime behavior unconfirmed.)
- That `PaywallSheet` renders correctly (Dialog sizing, the embedded
  SubscriptionOffer states, RTL locales).
- The new onboarding flow end-to-end (step transitions, branch for enjoyer/kid,
  the pitch CTA opening the paywall over the wizard).
- SystemPackInstaller actually installing a `systemPack` (nothing in the catalog
  is flagged yet, so it's a no-op until a pack is).
- Two-ZIP install switch on a real device (needs a real preview/premium entry in
  the catalog → needs the backfill or a `--with-preview` publish first).
- StreakChip rendering in the header once enabled.

---

## 7. Device test plan (suggested order)

1. **Onboarding** (wipe `corpan-stacks-v1` or reinstall): Welcome → primary lang
   → "Who's this for?" → learner shows langs+voices then pitch; enjoyer/kid jump
   straight to pitch → Finish. Confirm everything after step 1 renders in the
   chosen primary language (try a non-English primary). Confirm the pitch CTA
   opens the paywall over the wizard.
2. **Manually trigger the paywall** without needing a preview pack yet — in a
   devtools console (or a temporary button):
   `window.dispatchEvent(new CustomEvent('corpan:request-unlock', {detail:{surface:'reader_eof_free', bookTitle:'Test Book'}}))`
   → PaywallSheet should open with the title. Tap "Maybe later" → closes. Confirm
   `SubscriptionOffer` fetches prices in StoreKit sandbox.
3. **StoreKit sandbox subscribe** from the paywall → it should flip to the
   "You're a Corpanista" state; entitlement store `subscription.active` true.
4. **Progress/streak:** read some segments in a reader → enable "Show reading
   streak" in Settings → StreakChip appears with a day count. Confirm
   `corpan:segment-progress` is firing (devtools: listen for it).
5. **Two-ZIP end-to-end** (after you publish ONE book with `--with-preview` to a
   staging/real catalog, OR run the backfill on a test entry): install as a
   non-subscriber → only preview segments present → play to the end → paywall
   opens naming the book. Subscribe → reinstall → full content. Confirm the
   legacy `downloadUrl` is NOT what the new runtime used (check it pulled
   `preview/` then `premium/`).
6. **PackActions:** a premium pack shows "Unlock with Corpán Plus" (no price),
   opens the paywall.

---

## 8. Gotchas / sharp edges

- **Reader dist must be rebuilt** to ship reader src changes (see §4). `dist/` is
  gitignored but the files are tracked — use `git add -f`.
- **Two catalogs:** `catalog.json` (free packs, old readers ≤0.10) and
  `catalog-v2.json` (all packs, new readers). The publisher writes both; free
  packs go in both, premium only in v2. The new fields live in v2.
- **Version immutability (ttsctl law):** published ZIPs are write-once; never
  overwrite. The backfill avoids version bumps (it adds catalog fields + new S3
  keys, never rewrites the legacy ZIP).
- **Preview `totalSegments` quirk:** a reader on a PREVIEW pack reports
  `totalSegments = segments.length` (the preview's own length), so the progress
  store sees a finished preview as "100% complete." The paywall still fires
  correctly (via `isPreview`), but if the Library needs the TRUE full total for
  "X to your Plus moment," read `freeSegments`/`totalSegments` from the catalog
  entry instead of from the installed pack.
- **`--with-preview` is OFF by default** — nothing produces two-ZIP packs until
  you pass it (or run the backfill). Until then the new runtime sees no
  preview/full entries and the paywall never triggers from readers.
- **Don't reintroduce per-book buy UI.** `purchasedProducts`/`corpan.book.*` are
  honored for legacy owners but deprecated; no new purchase path.
- **Analytics stays anonymous/on-device.** The new `app_paywall_*` events follow
  the existing safe-by-construction wrapper; don't add identifiers.
- **`trackPaywallConverted`** exists but I didn't wire a call site (the
  SubscriptionOffer success path is the place to call it). Minor TODO.

---

## 9. Remaining work (also in CORPAN_PLUS_HANDOFF.md §Remaining)

**Visual/UX (warrant your eyes on a device — build carefully, don't ship blind):**
- **Library pack** (`packs/library/`): curated Continue (from progress store) /
  Recommended (by `userClass`) / All shelves, as a `systemPack`. Overlaps
  existing `createCatalogBrowser`/`createAppShell` — the genuinely new part is
  the progress-driven Continue shelf + recommendations. Clone earthgate-reader
  scaffolding. Auto-install is already wired (flag it `systemPack:true`). Then
  point enjoyer/kid finish-routing at it.
- **BookEndCard:** themed next-book recommendations when a FULL book ends.
- **Simplified onboarding language picker** (endonym search, §5).

**Production-mutating (do NOT run unattended — money / live catalog / stores):**
- Run `infra/scripts/backfill_two_zip.py` (dry-run → review → `--apply` → CDN
  invalidate `/catalog-v2.json`).
- One `ttsctl publish <pack> --lang en --with-preview` smoke test (preview 200 /
  premium 403-without-sig), then flip `--with-preview` default ON.
- App Store Connect / Play Console product attach + submit (see
  `IAP_IMPLEMENTATION_STATE.md` — code is complete, console config is the gap).

---

## 10. Why I made the calls I made (so you can overrule with context)

- **Reused `SubscriptionOffer` inside `PaywallSheet`** instead of refactoring it
  into `SubscriptionOfferInline` (as the plan said) — it's already a complete,
  robust state machine; wrapping it was lower-risk than surgery. If you need the
  inline-only piece elsewhere, that refactor is still worth doing.
- **Window events over `hostApi` methods** — matches the existing purchase event
  pattern, no SDK boundary changes. If you prefer the typed SDK approach, the
  events are easy to wrap.
- **StreakChip default-off** — I couldn't see the header to confirm it looks
  right, and the principle is "no nagging." Opt-in is the safe default.
- **Didn't build the Library pack / BookEndCard** — these are design-sensitive
  and partly overlap existing components; shipping unreviewed UI is its own
  failure mode. They're well-specified above.
- **Didn't run anything against prod** — backfill/publish/stores are
  irreversible-ish or cost money. Explicit human go required.

Ping me (or leave notes in CORPAN_PLUS_HANDOFF.md) if a runtime behavior
contradicts what's written here — that's the most likely place reality diverges
from my type-level confidence.
