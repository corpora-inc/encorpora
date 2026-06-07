# Corpan City — Analytics Pulse (privacy-first anonymous aggregate telemetry)

**Status:** Design + plan ONLY. No code here — this is the spec the
implementation fans out from, and the artifact the owner signs off on before any
network byte leaves a device.

**Author intent in one line:** the per-Track signal (which ordered language pairs
people actually play, how far they get, where they churn) is *fantastic* product
intelligence — and we want it **without breaking the project's privacy
principle.** This doc designs a system that delivers the signal while staying
honest about "no login / no PII," and it states the *exact, minimal* principle
amendment the owner is being asked to approve.

---

## 0. Lead with the reconciliation (read this first; the owner approves THIS)

### 0.1 The tension, stated plainly
The repo principle (CLAUDE.md, MEMORY) is verbatim:

> **no ads ever; no login; on-device analytics only; no PII.**

The owner's mandate is to **pulse anonymous aggregate analytics to our backend.**
Taken literally, "**on-device analytics only**" forbids *any* egress, so the two
cannot both be true as written. Every other clause is **fully preservable** and we
preserve them all:

| Principle clause | Verdict under this design |
| --- | --- |
| no ads ever | **Untouched.** Telemetry is not advertising; no ad SDK, no ad identifier, ever. |
| no login | **Untouched.** No account, no auth, no email. Identity stays at the OS layer (Apple/Google), never on our server. |
| no PII | **Untouched + enforced.** Nothing identifying leaves the device. No raw text, no names, no avatar, no precise geo, no device id, no stable user id, no IP retention (see §2, §4). |
| on-device analytics **only** | **This is the one clause that must be amended** (see §0.2). It is the literal blocker. |

### 0.2 The exact, minimal amendment requested
Change **one clause** from a blanket prohibition to a privacy-bounded allowance:

> **Before:** "on-device analytics only."
>
> **After:** "on-device analytics by default; in addition we may pulse
> **anonymous, pre-aggregated, non-identifying** product signals to our own
> backend — **opt-out** (and, where a store/region requires it, opt-IN),
> k-anonymous, no PII, no stable identifier, no IP retention, never raw user
> content. The device remains fully functional, and fully private, with the
> pulse disabled."

This is **not** "we now track users." It is "we count *behaviours in aggregate*,
in a way that is mathematically incapable of re-identifying an individual." The
spirit of the original — *the user is never a product, never surveilled, never
asked to log in* — is fully intact. If the owner declines even this bounded
amendment, the fallback in **§7 (Tier 0)** ships **zero egress** and still
surfaces the headline signal via an *opt-IN, manual, one-tap* "share anonymous
stats" — i.e. the principle stays verbatim and the feature degrades to nothing
until a user explicitly consents.

### 0.3 Why this is safe to approve (the one-paragraph pitch)
We never send events; we send **periodic counts**. The device keeps a small set
of integer counters (e.g. "started an `en→es` Track: +1", "reached level 3 in
some Track: +1"), pre-aggregated over a coarse window, with **k-anonymity
suppression** (a bucket that would describe fewer than *k* users is dropped) and
**small calibrated noise** on the way out. The payload carries **no id of any
kind** — not even a rotating one in the MVP. The backend can therefore answer
"what % of new players pick Spanish?" and "where does the level funnel leak?" but
**cannot** answer "what did *this person* do," because that information never
existed in the pipeline.

---

## 1. What's worth pulsing — and what must NEVER leave the device

The Track spine (`NEXT_LEVEL_PLAN.md`) makes the headline signal obvious: **the
set of active ordered pairs a user plays, and how their per-Track journey
progresses.** We pulse *aggregate shapes of that*, never the per-user vector.

### 1.1 HIGH-VALUE aggregate signals (pulse these, as counts)
All of these are **dimensioned by low-cardinality, non-identifying buckets** and
**counted**, never streamed per-event with a user key.

1. **Track adoption — the headline.**
   - `track_started{pair}` — count of new Tracks opened, dimensioned by the
     ordered pair (`en→es`, `en→fr`, …). 2,450 possible pairs is low-cardinality
     and content-only (a language *code* pair is not PII).
   - `track_active{pair}` — count of Tracks that saw play in the window (a coarse
     "this pair was touched today" tick, **one per pair per window per device**,
     so it can't fingerprint a multi-Track power user — see §2.4).
   - `single_language_track{lang}` — immersion/native-only Tracks (honors the
     SINGLE_LANGUAGE_RULE; tells us how many play immersion-only).

2. **Progression funnels (where people advance / stall).**
   - `level_reached{pair, level}` — bucketed level index per pair (the funnel).
   - `quest_started{questId}` / `quest_completed{questId}` /
     `quest_abandoned{questId, atStep}` — the quest funnel, by authored quest id
     and the step index where it was abandoned (content ids, not user data).
   - `badge_filled{lang, badgeCategory}` — progression on the ~1000-badge
     taxonomy (`BADGES_PROGRESSION.md`), category-level only.

3. **Challenge engagement.**
   - `challenge_completed{toolKind}` / `challenge_abandoned{toolKind}` — by
     challenge *type* (e.g. `match`, `stt`), never by the words drilled.
   - Coarse `challenge_score_band{toolKind, band}` (e.g. low/mid/high) — tells us
     difficulty calibration without a per-attempt record.

4. **Immersion usage.**
   - `immersion_toggled{pair, on|off}` — how often the per-Track immersion toggle
     (`IMMERSION_TOGGLE.md`) is used, by pair. Reveals which pairs are "strong
     enough for full immersion."

5. **Retention & session shape (privacy-safe scalars).**
   - `session{durationBand, trackCount Band}` — a session happened; its length
     and how many Tracks were touched, both **bucketed into coarse bands** (e.g.
     `<1m / 1–5m / 5–20m / 20m+`), never a precise duration.
   - `dN_return` — a **coarse retention bucket** (D1 / D7 / D30 *band*), derived
     **entirely on-device** from a local last-seen date and sent as a single
     bucket tick, never a timestamp or a per-day history (§2.5).

6. **Capability / environment (for triage, not tracking).**
   - `llm_available{bool}`, `stt_available{bool}`, `tts_available{bool}` — whether
     on-device AI was usable (helps us understand low-end-device experience).
   - `form_factor{phone|tablet|desktop}` — coarse, three-valued (tablet/desktop
     are first-class, MEMORY). **Not** OS version, not model, not screen size.

### 1.2 What must NEVER leave the device (hard deny-list)
This list is **normative** — the implementation must make these *structurally
impossible* to send, not merely "avoided":

- **Any stable identifier.** No device id, IDFV/IDFA/Android id, install id,
  account id, push token, or persistent client id. (MVP sends **no id at all.**)
- **Any free text.** No NPC chat, no STT transcripts, no player name, no typed
  input — ever. The whole pack's user-generated text stays on-device by design.
- **Avatar / character composition** at the individual level (it's a quasi-id).
- **Exact content rows.** No `entryId` lists, no the-specific-words-you-missed.
  Challenge signals are by *type*, not by drilled vocabulary.
- **Precise time.** No event timestamps; only the coarse window the rollup
  belongs to (e.g. the day) and bucketed bands.
- **Precise geo / locale chain.** No GPS, no IP-derived location stored
  server-side (§4.4 drops IP at the edge). The UI language is *not* sent in the
  MVP (it narrows the anonymity set); if ever added, only after k-anonymity
  review.
- **High-cardinality joins.** We never emit a single payload that pairs many
  dimensions together (e.g. "pair × level × quest × score × session" in one row),
  because the *combination* is re-identifying even when each field isn't. The
  device emits **independent per-dimension counters** (§3.2), not a wide per-user
  fact row.

### 1.3 The re-identification test (apply to every new signal)
Before any signal is added, it must pass: *"Could a motivated analyst with the
full server dataset single out one real person, or learn one new fact about a
named person?"* If yes → it's redesigned (coarser bucket, dropped dimension, or
k-anonymity suppression) or rejected. This test is a checklist item in the schema
PR template (§6.4).

---

## 2. Privacy model (the heart — maximum privacy by default)

### 2.1 No login, no account, ever
Identity is an OS-level concern (Apple/Google), and it **never reaches our
server**. The pulse has no notion of "who." This is unchanged from the principle.

### 2.2 No stable identifier — and in the MVP, no identifier at all
The default and **MVP posture is fully aggregate-only / id-less.** A payload is a
bag of counts for a window; two payloads from the same device are
**unlinkable** because they carry nothing in common to link on.

- This sacrifices *cross-window per-device cohorting* (we cannot, server-side,
  say "this device returned"). We accept that for MVP because **retention is
  computed on-device** and sent as a *bucket* (§2.5) — we get the retention
  *distribution* without any linkable id.
- **If** product later needs same-batch dedup (not cross-time tracking), the
  upgrade is a **rotating ephemeral salt** (§2.3), explicitly NOT a stable id.

### 2.3 (Optional, Tier 2) rotating ephemeral salt — never a user id
If a future need (e.g. de-duplicating a single rollup that got retried) requires
*intra-window* identity:

- Generate a **random salt that rotates every window** (e.g. daily), stored only
  in volatile/short-TTL local storage and **discarded on rotation**. It is a
  *nonce for one batch*, not a profile key.
- It is **never** derived from device hardware, never persisted across rotations,
  and the server **must not** join across salts (enforced by salt rotation +
  server-side aggregation that collapses the salt away immediately, §4.3).
- The salt exists to make a *single* batch idempotent under retry, nothing more.
  The default build does **not** ship it; it's behind a flag and a privacy review.

### 2.4 On-device pre-aggregation (the core privacy mechanism)
The device **never emits raw events.** It maintains a small local **counter
ledger** and emits the *ledger*, periodically:

- Every behaviour increments an integer counter keyed by `(metric, bucketedDims)`
  (e.g. `track_started|en>es += 1`). No event log, no per-event timestamps.
- "Touched this pair today" style signals are **idempotent per window**: the
  ledger records a *boolean-collapsed* tick (set, not increment), so a player who
  plays `en→es` fifty times in a day contributes the same `1` as one who played
  once — this both protects the heavy user and keeps counts interpretable.
- Pre-aggregation means **the raw behavioural detail literally does not exist in
  the payload** — the minimization happens before transport, on the device the
  user controls.

### 2.5 On-device retention derivation (no timestamps leave)
- The device stores **only** a coarse `lastSeenDay` (a local date, never sent) and
  an `installDay` band.
- At rollup it computes a **single retention bucket** for the window — e.g. "this
  device is in the D7-active band" — and sends *that bucket as a count*. The
  server learns the *shape* of retention across the population, never any
  device's timeline.

### 2.6 k-anonymity suppression (the device's own gate)
A bucket that is too specific to be safe is **suppressed on-device before send**:

- Each emitted `(metric, dims)` must belong to an **allow-listed, low-cardinality
  bucket set** (e.g. `level ∈ {1,2,3,4,5+}`, `durationBand ∈ {4 bands}`). No
  free-form dimension values.
- The device drops any bucket whose dimension *combination* depth exceeds the
  allow-list (we never emit deep crossed tuples — §1.2). This makes a *single*
  payload incapable of describing a rare individual.
- Server-side, an **aggregate is only ever surfaced when it covers ≥ k distinct
  payloads** (k ≥ a published threshold, e.g. 50). Buckets under k are held back
  from any dashboard/export (§4.3). k-anonymity is enforced in **two places**
  (device emits only coarse buckets; server hides sub-k aggregates) so neither
  layer alone is the single point of failure.

### 2.7 Differential-privacy-style noise (defense in depth)
On top of bucketing + k-anonymity, the device **perturbs counts** before send:

- Add small calibrated noise (e.g. discrete Laplace / randomized-response on
  boolean ticks) to each counter. At population scale the noise averages out, so
  aggregates stay accurate; for any *individual* payload, the exact count is
  plausibly deniable.
- This is **belt-and-suspenders**: even if a payload were somehow attributed to a
  device, its contents are noisy enough that no single behaviour is certain.
- The noise parameters are documented and conservative; the goal is honest
  deniability, not a formal ε guarantee we'd have to defend rigorously (we state
  this limitation plainly in §8).

### 2.8 Opt-out by default; opt-IN where required; always honored
- **Default = opt-out model**, surfaced with a **plain, dignified disclosure** in
  Settings ("Help improve Corpan City — share anonymous, aggregated stats. No
  account, no personal data, no tracking. [On/Off]"). Default state is
  configurable per the owner's call and per store/region law (see below).
- **Opt-IN where a store/region demands it** (e.g. ATT-adjacent expectations,
  GDPR/UK, jurisdictions requiring affirmative consent). The build reads a
  **policy flag** (catalog-driven, `feedback_catalog_driven_everything`) so we
  can flip default-on/default-off per region without an app release.
- **Honoring opt-out is total and immediate:** the ledger is cleared, no rollup
  is computed, no payload is queued, and the network path is never constructed.
  Opt-out is the **zero-egress** state — identical, on the wire, to having no
  telemetry code at all.
- **No dark patterns** (MEMORY brand voice): the toggle is honest, reversible in
  one tap, and never re-prompts naggingly. This is the anti-Duolingo posture the
  whole pack holds.

### 2.9 Why this respects the principle (the crisp claim)
> We send **counts of behaviours, bucketed and noised, with no identifier and no
> content** — a shape of the population, never a record of a person. No login, no
> ads, no PII, no surveillance. The device is fully private and fully functional
> with the pulse off. The only principle change is allowing *this bounded,
> non-identifying egress* alongside (not replacing) on-device analytics.

---

## 3. Schema + on-device aggregation

### 3.1 The on-device counter ledger (local, never sent raw)
A tiny IndexedDB record (per `corpan-pack-storage`: large/long-lived → IndexedDB,
not localStorage's shared ~5 MB budget). Shape (illustrative):

```
wp:pulse:ledger        (IndexedDB)
{
  v: 1,
  window: "2026-06-03",            // the coarse rollup window (day); NEVER an event time
  optIn: boolean,                  // resolved opt state (false ⇒ ledger stays empty)
  counters: {
    "track_started|en>es": 1,
    "track_active|en>fr":  1,      // boolean-collapsed tick (max 1 per window)
    "level_reached|en>es|3": 1,
    "quest_abandoned|es-cafe-travel|step2": 1,
    "challenge_completed|match": 4,
    "immersion_toggled|en>es|on": 1,
    "session|dur:5-20m|tracks:2-3": 1,
    "retention|d7": 1,
    "cap|llm:1|stt:0|tts:1": 1
  },
  // local-only, NEVER serialized into a payload:
  _local: { lastSeenDay: "...", installDay: "..." }
}
```

- **Bounded size:** counters are a small allow-listed key space; the ledger is a
  few KB. No unbounded growth (e.g. we don't key by `entryId`).
- **`_local` is partitioned** so the serializer that builds a payload reads ONLY
  `counters` (with bucketing/noise applied) and is structurally unable to touch
  `_local`.

### 3.2 The pulse payload (what crosses the wire)
Independent per-dimension counters, **never a wide per-user fact row** (§1.2):

```
POST  (one compact, gzipped JSON body)
{
  "s": "wp",                       // surface/pack tag (constant)
  "pv": 1,                         // pulse schema version
  "av": "0.0.1",                   // pack version (coarse; for funnel-by-version)
  "w":  "2026-06-03",              // window only (no event timestamps)
  "n":  true,                      // noise applied flag (so server knows it's perturbed)
  "c": {                           // the noised, bucketed counters
    "track_started|en>es": 1,
    "level_reached|en>es|3": 1,
    "challenge_completed|match": 4,
    "session|dur:5-20m|tracks:2-3": 1,
    "retention|d7": 1
    // ...sub-k / non-allow-listed buckets already dropped on-device
  }
  // NO id field. NO ip (dropped at edge). NO content. NO precise time.
}
```

- **Tiny + compressed:** a typical body is a few hundred bytes gzipped.
- **Versioned (`pv`)** so the schema can evolve without an app release breaking
  the backend (catalog/endpoint tolerant of unknown keys; drops them).
- **Allow-list enforced both ends:** the device only writes allow-listed counter
  keys; the server **rejects** any key not in its allow-list (so a buggy/forged
  client can't inject high-cardinality or PII-ish keys — §4.2).

### 3.3 Schema governance
- A single `pulse-schema.json` (allow-list of metric keys + permitted bucket
  values + the re-identification note per metric) is the **source of truth**,
  shared conceptually by device and server. Adding a metric = adding an
  allow-list entry + passing the §1.3 test in review.
- Bucket value sets are **closed enumerations** (no free strings), which is what
  makes k-anonymity tractable.

---

## 4. Transport + backend

### 4.1 Where the pulse rides
The pack runs in the Corpán WebView origin and has **no host network capability**
(the `HostApi` is TTS + LLM only — verified in `src/npc/hostTypes.ts`). So the
pulse uses the **standard web egress** the WebView already permits:

- **Primary: `navigator.sendBeacon(endpoint, blob)`** — purpose-built for
  fire-and-forget telemetry, survives page/app backgrounding, non-blocking, can't
  delay teardown. Ideal for "flush the rollup as the pack unmounts."
- **Fallback: `fetch(..., { keepalive: true })`** where `sendBeacon` is
  unavailable, with a short timeout and silent-but-LOGGED failure
  (`feedback_noisy_errors`: every catch logs visibly).
- **Offline:** if neither succeeds, the rollup **stays queued in IndexedDB** and
  is retried on next online window (§4.5). Zero data loss, zero blocking.

### 4.2 The endpoint (co-located with the presence server)
We **extend the existing `server/` boot** (`server/src/index.ts`, currently a
`node:http` server hosting Colyseus) with a **single ingest route**, e.g.
`POST /pulse`. (The `NEXT_LEVEL_PLAN.md` note says "Fastify"; the actual server
is Colyseus over `node:http` — this design rides that `node:http` server, adding
a tiny router or a minimal framework only if the team prefers; **no Fastify
dependency is required**.) The route:

- **Validates** the body against `pulse-schema.json` (Zod, matching the server's
  existing Zod-validated message posture in `PlazaRoom`). Rejects unknown counter
  keys and out-of-enum buckets — the allow-list is enforced server-side too.
- **Drops the client IP immediately** — does not log it, does not store it, does
  not derive geo from it (§4.4). The reverse proxy is configured to not forward
  or persist it either.
- **Rate-limits coarsely** by no-stored-identity means (a sliding global/edge
  rate cap), purely to blunt spam/DoS — never to profile.
- **Appends to a rollup store** (counts only), then **discards the raw payload**
  after aggregation (§4.3). The endpoint is **separate** from the realtime room
  hot-path so it never affects movement latency.

### 4.3 Server-side aggregation + k-anonymity gate
- Incoming counters are **summed into windowed aggregates** (e.g.
  `track_started|en>es` total for the day) in a small store. Individual payloads
  are **not** retained beyond the aggregation step (no per-payload table to mine).
- Any rotating salt (if Tier 2 is ever enabled) is **collapsed away at
  aggregation** — it never lands in the aggregate store.
- **The k-anonymity gate lives here too:** an aggregate bucket is only readable
  in a dashboard/export when it covers **≥ k payloads**; sub-k buckets are
  withheld (and may be merged into a coarser bucket). This is the server half of
  the two-layer k-anonymity (§2.6).
- **Retention/aggregation policy:** keep only rolled-up aggregates (small,
  non-identifying); set a TTL on raw-ingest scratch (e.g. hours) and on
  fine-grained windows (e.g. collapse days → weeks after N weeks). Documented,
  short, and enforced.

### 4.4 No IP retention (explicit)
IP is transport metadata we **never want**. The edge/proxy is configured to not
log it; the app server drops it before any handler reads it. We do **not** derive
country/region from it. (If coarse country is ever desired for product reasons,
it requires a separate privacy review and a k-anonymity check, and is out of MVP
scope.)

### 4.5 Efficiency, resilience, battery/data friendliness
- **Batched + infrequent:** at most **one pulse per rollup window** (e.g. daily),
  plus an opportunistic flush on pack unmount. Not per-event, not per-session-end
  necessarily — the window coalesces a day of play into one tiny body.
- **Tiny + compressed:** few-hundred-byte gzipped bodies; negligible data.
- **Resilient queue:** rollups persist in IndexedDB; if offline or send fails,
  they wait and retry on the next online window. Bounded queue (drop oldest beyond
  a small cap) so a long-offline device can't accumulate unboundedly.
- **Degrades to zero:** opted out, or offline, or endpoint unreachable → the pack
  behaves *exactly* as if telemetry didn't exist. Never blocks UI, never delays
  teardown (sendBeacon is fire-and-forget), never spins the radio for telemetry
  alone (piggybacks the next time the app is already online).
- **Best-effort, like presence:** mirrors `netClient`'s posture — failure is
  logged, never thrown, never user-visible.

---

## 5. How it observes the Track spine without coupling to it

- The pulse is a **passive consumer of existing events**, not a new source of
  truth. It subscribes to the same in-app signals the HUD already uses:
  `QuestEngine` events (§COHESION `questState.ts`), `inventory()` changes, the
  `corpan:segment-progress`-style window events, the Track switcher, and the
  immersion toggle. Each interesting transition bumps a local counter.
- It **never reads PII-bearing state** (name, avatar, transcripts) — it's wired
  only to the *typed, bucketable* transitions. This keeps the deny-list (§1.2)
  structural: the pulse module is simply not given a handle to the sensitive
  stores.
- A single `src/pulse/*` module (future, when built) owns: the ledger, the
  bucketing/noise, the k-anonymity drop, the rollup scheduler, the transport, and
  the opt-state read. It exposes a narrow `track(metricKey, dims)` the
  orchestrator calls — nothing else in the pack knows about networking.

---

## 6. Phased build plan

### Phase 0 — Decision gate (no code)
Owner approves the §0.2 amendment (or chooses the §7 Tier-0 zero-egress fallback).
**Nothing ships until this is signed.** Settle: default opt-out vs opt-in per
region, the rollup window (recommend daily), and `k` (recommend ≥ 50).

### Phase 1 — MVP: id-less, opt-out, headline + a couple of funnels
- On-device ledger (IndexedDB) with the allow-listed counter keys for: **active
  Track pairs** (the headline), `track_started`, `level_reached`,
  `challenge_completed/abandoned`, a **session band**, and a **retention band**.
- Bucketing + k-anonymity drop + small noise on-device. **No identifier at all.**
- Settings opt-out toggle (honest copy, localized in ~50 langs per the
  non-negotiable bar) wired to total zero-egress when off.
- `POST /pulse` on the existing `server/` boot: Zod-validate against the
  allow-list, **drop IP**, sum into a daily aggregate, discard raw, serve nothing
  back. A trivial read of the daily aggregates (CSV/JSON) for the owner.
- **Verify in the REAL embedded Corpán app** (MEMORY: verify the real app, not
  standalone): confirm a body is sent on unmount, confirm opt-out sends nothing,
  confirm no id/content in the payload (inspect the wire).

### Phase 2 — Richer funnels
- Add `quest_started/completed/abandoned{atStep}`, `badge_filled{category}`,
  `immersion_toggled`, `challenge_score_band`, capability flags.
- Add the §1.3 re-identification checklist to the schema PR template; freeze the
  allow-list as `pulse-schema.json` shared by device + server.
- Server: windowed rollups + the k-anonymity *read* gate + retention TTLs.

### Phase 3 — Rollups, dashboards, (optional) Tier-2 hardening
- Server: day→week collapse, a small internal dashboard reading **only** k-safe
  aggregates (Track-adoption map, level/quest funnels, retention curve).
- **Optional Tier 2** (only if a concrete need + a passed privacy review): the
  rotating ephemeral salt (§2.3) for intra-window dedup, behind a flag; never a
  stable id.
- Document the noise parameters + retention policy publicly (open-source repo →
  the privacy posture is auditable, which is itself a feature).

### Always (cross-cutting)
- Localize every new string (~50 langs). Tablet/desktop/phone first-class.
- Noisy errors (log every catch). No `window.confirm/alert/prompt`.
- Add a `CHANGELOG.md` `[Unreleased]` line when the toggle/feature becomes
  user-visible (CLAUDE.md release-notes rule).

---

## 7. Fallback if the owner declines the amendment (Tier 0 = zero egress)

If the owner wants the principle kept **verbatim** ("on-device analytics only"):

- Ship **no automatic egress at all.** The ledger + on-device dashboards stay
  local (the user can see their *own* aggregate journey — a nice feature).
- Provide a **manual, explicit, opt-IN "Share anonymous stats" one-tap** that
  sends a *single* k-anonymous/noised rollup only when the user actively chooses
  to — affirmative consent, no default egress. This is arguably still inside
  "on-device only by default," with sharing as a deliberate user act.
- We get *some* signal from willing users, zero from everyone else, and the
  principle text never changes. This is the maximally-conservative landing spot.

---

## 8. Honest limitations (call out for the owner)

- **No cross-time per-device cohorting** in MVP (id-less by design). We get
  *distributions* (retention curve, funnel shape) but not "this exact device's
  longitudinal path." That's the privacy price; we think it's worth it.
- **Noise is a "plausible deniability" measure, not a formal DP guarantee.** We
  don't claim a rigorous ε budget; we claim conservative, documented perturbation
  + k-anonymity + id-less + bucketed. If a formal DP claim is ever needed, that's
  a separate, larger effort.
- **k must be tuned to real volume.** Until population is large, set k
  conservatively (sub-k buckets simply won't surface) — correct early product
  behaviour is "we don't know yet," not "here's a number from 3 users."
- **Self-hosted endpoint = our responsibility.** Whoever runs `server/` must
  honor the IP-drop + retention TTL + no-raw-retention rules; they're part of the
  contract, not optional ops hygiene.

---

## Exec summary

**Privacy reconciliation (lead):** the only principle clause this requires
changing is "**on-device analytics only**" → "**on-device by default, PLUS
anonymous, pre-aggregated, non-identifying, opt-out, k-anonymous, no-PII, no-IP,
no-content pulses.**" Every other clause — **no ads, no login, no PII** — is fully
preserved. If the owner declines even that bounded change, **Tier 0 (§7)** ships
zero automatic egress behind an explicit opt-IN one-tap, keeping the principle
verbatim.

**High-value signals:** the headline is **active Track pairs** (`en→es` adoption,
the set of pairs people play); plus level/quest **funnels** (where they advance
and abandon), challenge completion by *type*, immersion-toggle usage, and coarse
session/retention **bands** — all as bucketed counts, never per-user records.

**Pulse mechanism + schema:** the device keeps a tiny **IndexedDB counter ledger**
(boolean-collapsed ticks + counts), applies **bucketing → k-anonymity drop → small
noise** on-device, and emits **at most one tiny gzipped payload per daily window**
(plus an opportunistic unmount flush) via `navigator.sendBeacon` (fetch+keepalive
fallback). The payload carries **no identifier, no content, no precise time** — a
bag of allow-listed counters only. It rides a new `POST /pulse` route on the
existing `server/` `node:http` boot (no Fastify needed), which **Zod-validates
the allow-list, drops the IP, sums into windowed aggregates, discards raw, and
gates dashboard reads behind k ≥ threshold**. Offline → queued in IndexedDB and
retried; opted out → total zero egress, identical to no telemetry at all.

**Phased plan:** Phase 0 owner sign-off → Phase 1 id-less opt-out MVP (active
pairs + a couple funnels + session/retention bands, verified in the real embedded
app) → Phase 2 richer funnels + frozen `pulse-schema.json` + server k-gate →
Phase 3 rollups/dashboards + optional rotating-salt hardening behind a review.
