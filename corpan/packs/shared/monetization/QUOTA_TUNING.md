# Quota & pay-or-wait tuning

Companion to `src/quotas.ts` (the registry — the single source of truth for the
numbers) and `QUOTA_STANDARD.md` (how the gate/wall are built). This file is the
**rationale + the dials**: what every pack does today, and how to tune the free
tier toward "happy but tantalized."

All daily caps reset at local midnight. Subscribers bypass everything. Each number
is one line in `quotas.ts`; on device, `__corpanDebug.quota.set(surface, n)`
retunes a live gate instantly (both directions, no reload).

---

## Every experience — how the wall triggers

| Experience | Trigger | Free allowance / day | Wall |
|---|---|---|---|
| **Phrase Flip** (core app) | daily quota — only **new** phrases (Random / Next past the newest); back/forward review + TTS are unlimited | **20** new phrases · soft nag @5/10/15 | green-check lock |
| **Tutomaton** | daily quota — messages sent | **20** messages · nag @5 | green-check lock |
| **Parlometron** (pronunciation-coach) | daily quota — scored rounds | **15** rounds · nag @5 | green-check lock |
| **Hover Runner** | daily quota — phrases played | **20** · nag @5 | green-check lock |
| **Juice Squeeze** | daily quota — phrases built | **20** · nag @5 | green-check lock |
| **Hanzipan** | daily quota — new characters | **20** · nag @5 | green-check lock |
| **Beatlounge** | **timed** — soft nag on the next tap after **~5 min** of use (no hard cap — never interrupts the music) | unlimited, gentle nag | dismissible paywall sheet |
| **Earthgate / Stargate Readers** | **end-of-preview** — `corpan:request-unlock` at the preview boundary | first **~⅓** of each book (server-truncated, `min(floor(total/3), 100)` segments) | paywall sheet |
| **World Radio** | **free**, ungated (ad-free recitations) | unlimited | — |
| **Corpán City / Teletron** | excluded for now (preview) | — | — |

Surfaces/limits live in `quotas.ts`:
`phrase_flips` 20 · `tutomaton_daily` 20 · `parlometron_daily` 15 ·
`hover_phrases` 20 · `juice_phrases` 20 · `hanzipan_chars` 20 (all nag every 5).
Beatlounge is `mode:"timed"`, `intervalMs: 5·60·1000` (not in the daily registry).

---

## The principle: bite the engaged tail, not the median

A casual user should rarely hit a wall (stays happy, builds the habit); your top
**~10–20%** of a pack's daily users should hit it (those are who convert).

- `< 5%` of daily users hit a wall → too loose (no pull).
- `> 40%` hit it **every day** → too tight (frustration / churn risk).

You can read this directly per pack now (analytics are instrumented + `trial_started`
is fixed): `daily_lock_shown / DAU`, and the funnel
`daily_lock_shown → daily_lock_upgrade_tapped → paywall_shown → paywall_cta_tapped → paywall_converted`,
all carrying `pack_id` + `surface`.

---

## Starting moves to test

- **Don't gate day 1 / the aha.** Let a brand-new user get deep free value first
  (onboarding already auto-launches their best-fit pack) — fall in love before any
  wall. Consider no cap (or 2× allowance) on the first calendar day, then the daily
  cap on return. Usually lifts both activation and eventual conversion.
- **The daily reset is the retention engine, not just a gate.** "Come back
  tomorrow" + the per-pack streak make the *free* tier a daily habit — engaged even
  when free. That habit IS the conversion pipeline; protect it.
- **Keep "already-unlocked" abundant, "new" scarce.** Already true (free unlimited
  review / TTS / history; only *new* consumption is metered). Never stingy with what
  they have; just a gentle ceiling on new.
- **The trial is the release valve at the wall.** "7 days free — no payment now" is
  the easy yes for someone tantalized (~45% trial→paid industry band). Keep it the
  prominent action on the lock; the discount code is the partner path, not the front
  door. (Apple = trial **or** code; Google could stack both, but we ship XOR.)

### Right-size by pack character, not by cost
On-device inference ≈ $0, so this is about **value perception**, not compute.

| Pack | Today | Lean | Why |
|---|---|---|---|
| Tutomaton | 20 msgs | keep tight (15–20) | highest-value (on-device tutor) → strongest upgrade pull |
| Phrase Flip | 20 new | test 15–25 | core loop; generous for casual, blown through by the keen |
| Parlometron | 15 rounds | hold | speaking is effortful; 15 is a real session |
| Hover / Juice / Hanzipan | 20 | **more generous (25–30)** | fun, convert indirectly — don't frustrate for little conversion |
| Beatlounge | ~5 min soft | stretch to ~7–10 min | creative flow; a hard cap would kill it |
| Readers | ~⅓ preview | hold | proven hook |

---

## The #1 lever: experiment cadence

The registry is built to accept a **remote-config override** (`getQuota` is the
single override point). Standing up that small endpoint (the Phase-4 fast-follow)
lets you A/B caps per pack **without shipping**, tuned against
wall→trial→convert and D7/D30 retention + uninstall signal. That iteration
compounds far past any single starting number.

## Frustration guardrails (keep these)

- Never interrupt an in-progress action (the cap is at the new-item boundary).
- The wall is an **accomplishment** (green check + "nicely done" + streak +
  countdown), never a red error.
- One hard lock/day with a couple of soft nudges before it; dignified streak (no
  dark-pattern anxiety).

---

## Workflow to tune

1. Ship the table above as the v1 baseline.
2. Watch each pack's `daily_lock_shown → trial_started → paywall_converted` for
   1–2 weeks (by `pack_id` × `surface` in Athena).
3. For packs where almost nobody hits the wall → tighten; where the engaged hit it
   but conversion is low → loosen (don't frustrate for nothing); where it hits +
   converts → that's the sweet spot, hold.
4. Once the remote-config endpoint exists, A/B the borderline numbers instead of
   guessing.
