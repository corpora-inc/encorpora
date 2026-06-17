# Tutomaton — "out of quota on entry → wall before the tutor loads"

Spec for the tutomaton/model-tiering agent. Goal: when a **free user opens
tutomaton already at their daily cap**, do NOT wake the on-device model (wasted
RAM + time — they can't send anything) and do NOT show the "waking up your tutor"
setup screen. Show the green-check accomplishment lock immediately (wait or
Plus). The model loads only if they subscribe.

This is paywall behavior authored by the monetization lead; it sits in the
model-load path you own, so you apply it. There are already cap-UX hunks from me
in the working tree (`chat.css`, `i18n.ts`, `chat.ts`) — **preserve them** (list
at the bottom).

## Relevant current code (`corpan/packs/tutomaton/src/chat.ts`)
- Quota gate: `quotaGate` (created ~L283 via `createPaywallGate({ packId: PACK_ID,
  surface: "tutomaton_daily", mode: "daily", dailyLimit: FREE_DAILY_LIMIT,
  softNagEvery: FREE_DAILY_NAG_EVERY, unitLabel: "messages", isSubscribed: () =>
  plus })`). API used here: `quotaGate.isBlocked()`, `quotaGate.requestDailyLock()`.
- Model kickoff (ONCE, at mount): `void modelMgr.check()` (~L1864, in the
  bootstrap block right after `await switchLanguage(initialCode)`).
- Setup / "waking up your tutor" screen = `$setup` (`.lt-setup`). It starts
  `hidden` in the markup (~L602) and is only revealed by `renderModelPhase()`
  (`$setup.hidden = modelReady`, ~L815). **So if `modelMgr.check()` never runs,
  `renderModelPhase` never fires and `$setup` stays hidden — no setup screen.**
- `onEntitlementChanged` (~L1484) flips `let plus` + calls `syncSendEnabled()` on
  the host's `corpan:entitlement-changed`.
- `syncSendEnabled()` already keeps the composer calm-but-inert when
  `quotaBlocked()` (placeholder `quotaEmpty`, no red — the cap-UX hunk).

## Change 1 — gate the mount-time model load (~L1864)
Replace:
```ts
    void modelMgr.check()
    syncSendEnabled()
```
with:
```ts
    // Out of free quota on entry → DON'T wake the on-device model (wasted: they
    // can't send). Pop the accomplishment lock straight away; the setup screen
    // ($setup) stays hidden because renderModelPhase never runs. The model loads
    // later only if they go Plus (see onEntitlementChanged).
    if (quotaGate.isBlocked()) {
      quotaGate.requestDailyLock()
    } else {
      void modelMgr.check()
    }
    syncSendEnabled()
```

## Change 2 — load the model if they subscribe from the lock (~L1484)
In `onEntitlementChanged`, after `plus = nextPlus; syncSendEnabled()`:
```ts
      plus = nextPlus
      syncSendEnabled()
      if (plus) {
        systemNote(t("quotaPlusActivated"))
        if (!modelReady) void modelMgr.check() // capped-entry skipped it — load now
      }
```
(`modelReady` is the existing flag set in `renderModelPhase`.)

## Behavior matrix
| State on open | Result |
|---|---|
| Free, **capped** | No model load, no `$setup` screen — green-check lock pops (wait/Plus). Dismiss → calm chat chrome (suggestions + inert composer); tapping the composer re-pops the lock. |
| Free, quota left | Normal: `modelMgr.check()` → setup/load as today. |
| Subscriber | `isBlocked()` false → normal load. |
| Subscribes **from the lock** | `onEntitlementChanged` → `modelMgr.check()` → model loads, chat works. |

## PRESERVE (already in the working tree — do not revert)
- `chat.css`: `.lt-quota.is-empty` and `.lt-input.is-quota-empty .lt-field` /
  `::placeholder` are de-red'd (calm `var(--lt-muted)` / `var(--lt-border)`,
  `opacity`, `cursor:pointer`) — NOT `--lt-danger`. The cap is an accomplishment,
  never a red error.
- `i18n.ts` (EN source block): `quotaEmpty` = "That's your free tutoring for
  today", `quotaEmptyNote` = "Nice work — that's your free tutoring for today.
  Corpán Plus keeps the conversation going.", `quotaPlus` / `quotaPlusActivated`
  use "Corpán". (These EN strings drifted from ~50 locales → flag a re-gen.)
- `chat.ts`: the `$inputBar` capture-phase `pointerdown` →
  `quotaGate.requestDailyLock()` (a capped tap re-pops the shared lock).

## Verify
- `cd corpan/packs/tutomaton && npm run build && npm run typecheck && npm test`.
- On device (dev manifest `http://10.0.0.49:1421/packs/tutomaton/manifest.json`,
  rebuilt via `npm run dev:watch`): force the cap —
  `localStorage["corpan:gate:tutomaton:tutomaton_daily"] = JSON.stringify({day:
  <YYYY-MM-DD local>, count: 20, lastFireAt: 0})` then reload — open tutomaton:
  the lock pops, NO "waking up your tutor", no model load. Tap "Continue with
  Corpán Plus" → (sandbox) subscribe → model loads + chat works.
