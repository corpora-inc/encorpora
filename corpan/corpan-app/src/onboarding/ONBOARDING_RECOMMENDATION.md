# Onboarding Streamlining — Recommendation (0.20.2)

**Owner decision doc.** Prepared by Team 6 (Onboarding UX) in light of the new
Journey pack. Scope of this doc: propose the ideal streamlined first-run flow.
A small, low-risk subset was implemented now (see the last section); the larger
graph restructure is left for owner sign-off.

All file:line references are against `src/onboarding/graph.ts` at the time of
writing.

---

## 1. Current screen inventory (per path)

Entry is always: **welcome → pickPrimary → welcomePact → forkJourney**
(3 taps + a language picker before the fork). The fork (`forkJourney`, L151)
then splits into four journeys. Tail is shared: **tts → interests → whatToStart
→ commit** (with `whatToStart` skipped for Journey opt-ins).

Legend: (Q) single-select question, (A) adapter/custom component, (M)
multi-select, (T) terminal. "taps" counts user decisions on that screen.

### Shared head (every path)
| Screen | Kind | Purpose | Taps |
|---|---|---|---|
| welcome | A | Splash / start | 1 |
| pickPrimary | A | Choose the language you already know | 1 |
| welcomePact | A | Honest-hello interlude, sets expectations | 1 |
| forkJourney | Q | "What brings you to Corpán?" — enjoy / learn / polyglot / child | 1 |

### Path A — Enjoy (native/near-native content consumer)
| Screen | Kind | Purpose | Taps |
|---|---|---|---|
| calibrateEnjoy (L199) | Q | Reading-comfort → levels + rate | 1 |
| tts (L347) | A | Voice preference | 1 |
| interests (L351) | M | "What do you want to do?" seeds recs | 0–1 |
| whatToStart (L373) | Q | "Where should we begin?" deterministic landing | 1 |
| commit | T | flush + land | — |

**Enjoy total after fork: 3–4 taps.**

### Path B — Learn (the primary, growth-critical path)
| Screen | Kind | Purpose | Taps |
|---|---|---|---|
| pickLearning (L235) | A | Choose target language(s) | 1+ |
| calibrateLearn (L242) | Q | Prior exposure → levels + rate | 1 |
| **journeyOptIn (L272)** | Q | "Want a guided path?" guided / explore | 1 |
| journeyPlacementOffer (L299) | Q | *(guided only)* "I'm new" / "I know some" | 1 |
| pickPhrasePacks (L321) | A | Choose phrase-pack topics | 1+ |
| tts | A | Voice preference | 1 |
| interests | M | seeds recs | 0–1 |
| whatToStart | Q | *(explore only)* deterministic landing | 0–1 |
| commit | T | flush + land | — |

**Learn total after fork: 6–8 taps.** Guided-Journey user still passes through
`pickPhrasePacks` (phrase-experience setup) even though they land in the Journey
feed, not the phrase experience.

### Path C — Polyglot
| Screen | Kind | Purpose | Taps |
|---|---|---|---|
| pickLearning | A | Choose several targets | 1+ |
| *(calibrateLearn skipped — `pickLearning.next`, L239)* | | | |
| tts → interests → whatToStart → commit | | shared tail | 2–3 |

### Path D — Child
| Screen | Kind | Purpose | Taps |
|---|---|---|---|
| childAge (L324) | Q | Age band → gentlest defaults | 1 |
| tts → interests → whatToStart → commit | | shared tail | 2–3 |

---

## 2. Friction points (specific)

### F1 — The Journey fork is buried and framed as an opt-in *(highest priority)*
`journeyOptIn` (L272) sits **three screens deep** inside the Learn path
(`forkJourney` → `pickLearning` → `calibrateLearn` → *here*). Its copy — "Want a
guided path?" with options **"Start the Journey"** vs **"I'll explore on my
own"** — frames the guided course as a side feature the user opts *into*, when
the Journey is the product's strongest, most-supported learning path. A learner
who wants to be *taught* has to actively find it.

### F2 — `journeyPlacementOffer` is a whole extra screen (L299)
Splitting "do you want guided?" from "are you new / do you know some?" costs a
tap and a screen. The placement question is a *property of* choosing the guided
path; it can be folded into the same fork.

### F3 — Dead-code `landing` presets *(single-source-of-truth violation)*
`calibrateEnjoy` (L208/214/220/228), `calibrateLearn` (L251/257/263), the
`polyglot` option (L183) and `childAge` (L332/338) all write
`draft.landing = { … }`. **Nothing ever reads `draft.landing`.** `commitDraft`
(L48–133) computes the landing exclusively from `skipAutoLaunch` → `journeyOptIn`
→ `whatToStart` → best-fit fallback. Verified: `grep` for any read of
`draft.landing` / `.landing` in `src/` returns zero hits outside the writes and
the `LandingStore`/`LandingIntent` imports. These presets are stale from an
earlier design where calibration set the landing directly; `whatToStart`/commit
now always override them. They mislead future editors into thinking calibration
controls the landing.

### F4 — Guided-Journey users still walk through phrase-experience setup
A guided-Journey learner (journeyOptIn=true) still hits `pickPhrasePacks` (L321),
which configures the *phrase experience* they won't land in. Minor content
mismatch; a candidate cut in the ideal flow, but it touches an adapter with its
own eager writes, so it is **deferred** (not safe as a one-liner).

### F5 — `whatToStart` is asymmetrically skipped (by design, but worth noting)
`interests.next` (L367) routes journey opt-ins straight to `commit`, skipping
`whatToStart`. This is *correct* (they already made a landing decision), but the
asymmetry means the same fork position produces a different number of remaining
screens. Re-onboarding a user who previously chose Journey vs. explore shows a
different tail. Acceptable, but any restructure should make the "you already have
a landing" state explicit rather than implicit in the routing.

> Note on the brief's phrasing: the audit called this "interests silently
> skipped." In the current graph, `interests` is reached by **every** path; it
> is **`whatToStart`** that is conditionally skipped for Journey users. There is
> no contained one-line fix for interests because there is no interests-skip to
> fix. (See §"Implemented vs deferred".)

---

## 3. Recommended ideal flow

Design intent: the Journey should read as **the** happy path for anyone who
picks "Learn a language," without adding screens. Fewer decisions, each one
carrying real weight.

### Learn path — merge the fork + placement into ONE screen
Replace `journeyOptIn` + `journeyPlacementOffer` with a single question framed
as *how* to learn, with the guided path first:

```
How do you want to learn {{lang}}?
  ▸ Guided daily path      A short daily session, planned for you   → Journey
  ▸ Self-paced             Browse stories, drills and games yourself → explore
```

- **Keep** it after `calibrateLearn` (calibration still feeds the Journey's
  starting level), but **consider hoisting** the how-to-learn choice directly
  after `pickLearning` so calibration only runs for self-paced users (guided
  users get placed by the Journey's own PlacementFlow). This is the bigger
  restructure — flagged for owner decision, not done now.
- **Merge** placement: the guided option's `apply` can set
  `journeyPlacement` based on the calibrateLearn answer already collected
  (`never` → `zero-beginner`; anything else → let PlacementFlow probe). This
  **cuts `journeyPlacementOffer` entirely** — we already know if they're brand
  new from calibration. (Bigger change; deferred to this doc.)

### Cuts
- **Cut** `journeyPlacementOffer` (L299) — derivable from calibrateLearn.
- **Cut** the dead `landing` presets everywhere (F3) — done now (safe).
- **Cut** `pickPhrasePacks` for guided-Journey users (F4) — via a conditional
  `next` on `journeyOptIn`'s guided option straight to `tts`. Deferred (adapter
  has eager writes; wants its own review).

### Keep / merge summary
| Screen | Decision | Rationale |
|---|---|---|
| welcome / pickPrimary / welcomePact | Keep | Language-first is correct (localizes everything after). |
| forkJourney | Keep | The four-audience split is sound. |
| calibrateEnjoy / calibrateLearn / childAge | Keep (clean up) | Real signal; strip dead `landing`. |
| journeyOptIn | **Keep, reframe** | Primary happy path, guided-first (done now). |
| journeyPlacementOffer | **Cut → merge** | Derive from calibration. |
| pickPhrasePacks | Keep for self-paced; **skip for guided** | Guided users don't land there. |
| tts / interests / whatToStart | Keep | Shared tail; `whatToStart` already skipped for guided. |

### Rough implementation notes for the bigger refactor
1. Delete `journeyPlacementOffer` node; in `journeyOptIn.guided.apply`, set
   `journeyPlacement` from `c.draft.levels` (only-`A0` ⇒ `zero-beginner`, else
   `probe`).
2. Point `journeyOptIn.guided.next` at `tts` (skip `pickPhrasePacks`).
3. Consider moving the how-to-learn question ahead of `calibrateLearn` and
   skipping calibration for guided users (Journey self-places). Requires the
   Journey team to confirm PlacementFlow covers the zero-beginner case.
4. Delete the `Draft.landing` field from `types.ts` once the presets are gone
   (done — field retained only if any adapter still writes it; verify).

---

## 4. Implemented now (safe subset) vs deferred

**Implemented (this PR):**
1. **Reframed `journeyOptIn` (F1).** New title "How do you want to learn
   {{lang}}?"; options **"Guided daily path"** (guided-first) and
   **"Self-paced"**, each with a one-line subtitle. Guided now reads as the
   primary path. New i18n keys (below).
2. **Removed dead `landing` presets (F3).** Stripped `landing: {…}` from every
   `apply` in `calibrateEnjoy`, `calibrateLearn`, the `polyglot` fork option and
   `childAge`. Verified `commitDraft` and all of `src/` never read
   `draft.landing`. The `Draft.landing` field is retained in `types.ts` (typed,
   harmless, referenced by `LandingIntent`) to keep the change minimal; remove it
   in the bigger refactor.

**Deferred to this doc (not safe as small changes):**
- F2 merge of `journeyPlacementOffer` into the fork.
- F4 skip of `pickPhrasePacks` for guided users.
- Hoisting the how-to-learn question / skipping calibration for guided users.
- Deleting the `Draft.landing` type field.

---

## 5. New i18n keys (English) — integration fills all locales

```
onboarding.journey.title    = "How do you want to learn {{lang}}?"
onboarding.journey.guided.label = "Guided daily path"
onboarding.journey.guided.desc  = "A short daily session, planned for you."
onboarding.journey.explore.label = "Self-paced"
onboarding.journey.explore.desc  = "Browse stories, drills and games yourself."
```

`onboarding.journey.subtitle` is unchanged and still used.
