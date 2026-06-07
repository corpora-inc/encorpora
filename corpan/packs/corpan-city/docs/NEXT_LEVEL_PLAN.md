# Corpan City — Next-Level Scale-Out (orchestration index)

This is the map. Each facet below is articulated in depth in its own doc by a
dedicated planning agent. Goal: **A++ premium in every detail, no demo
placeholders, fully articulated, endlessly amusing — scaled in every direction.**

## The spine everything hangs off: the per-pair "Track" (the stack)
The user's ENTIRE mode/state is **one ordered language pair** at a time —
a **Track** = `(native, target)`, e.g. `en→es`. Per Track, the user has their own
**character, inventory (multi-currency), XP/badges, quests/arc, level/path,
immersion setting**. There are 50×49 = **2,450 possible ordered pairs**, so a user
*could* have up to ~2,450 independent Tracks; realistically **1–5** active.

- At game start the user **picks which target** (incl. playing their native only =
  immersion/native practice — honor the SINGLE-language-stack rule).
- **Jumping tracks is easy** — play a few levels in `en→es`, switch to `en→fr`;
  different character/inventory/XP/quest entirely.
- **Rooms stay shared**: the Track is PERSONAL (per-screen Scene/Quest skin +
  state). It does NOT change other players or global room state — this is just the
  Room×Scene×Quest spine extended so the *pair* is part of the per-player layer.
- **Storage**: namespace ALL per-Track state by the pair key; IndexedDB
  (quota-safe per `corpan-pack-storage`); lazy-load; never assume a 2-language stack.

## Workstreams (each = one planning agent → one design doc)
1. **`docs/ECONOMY_CURRENCY.md`** — kill the bland gray "coin" (moon icon). A fully
   articulated **multi-currency reward + market + trade** system: many currencies
   (gold/silver/peso/yen/dollar/Weimar-mark/…), denominations, **exchange rates**,
   **player↔player currency exchange + buy/sell**, **markets with live prices**, a
   watchable global price feed — an addictive economic side-game + a reason to chat.
   Baseline default = stacks of bills (not a coin); drill into currency types in the
   inventory. Data-driven, anti-abuse, premium UI. Orthogonal to XP/badges.
2. **`docs/BADGES_PROGRESSION.md`** — XP is NOT a static number; it **fills badges**.
   Badges are **per-target-language** ("Spanish greetings", …), a taxonomy of
   **~1000 per language course**, how XP maps to/levels badges, categories,
   progression curves, premium UI. Orthogonal to currency/markets.
3. **`docs/LANGUAGE_PAIR_STATE.md`** — the Track architecture above: state model
   keyed per ordered pair, the start-screen target picker, the in-game
   track-switcher, storage scaling to thousands of Tracks (few active), migration
   from today's single-state, and how character/inventory/XP/badges/quests/immersion
   are all namespaced per Track. **The foundational spine; docs 1,2,5,6,7 build on it.**
4. **`docs/LOCALIZATION_SCALE.md`** — minigames are ALL English today (native=EN);
   make **all 50 languages** first-class in BOTH the **minigames** (challenge
   content, prompts, segues, UI strings) AND the **LLM character prompts** (persona
   templates, quest clues, mood beats). Leverage the 51-language corpus. A pipeline
   that makes adding/maintaining 50 langs as EASY as possible. Localize every new
   string. This is the biggest force-multiplier.
5. **`docs/CONTENT_SCALE.md`** — prove + engineer **massive variety, no
   placeholders**: faces/expressions, character art, inventory item art, bigger &
   more varied maps/scenes/rooms/topologies, quests, NPC personalities. Granular
   modular generators; quality bars; how each facet scales toward thousands of
   tasteful, distinct instances. (May recommend sub-facet agents.)
6. **`docs/IMMERSION_TOGGLE.md`** — a **per-Track "total immersion"** toggle: ON =
   NO English anywhere on screen (for a target you're strong in); OFF = plenty of
   native help (for a hard target). Full audit of every surface (dialogue gloss,
   challenges, tracker, badges, menu, UI) so immersion can be cleanly toggled.
7. **`docs/ANALYTICS_PULSE.md`** — efficiently pulse **anonymous aggregate**
   analytics to the backend (the set of active Tracks per anon user is rich signal).
   ⚠️ Reconcile with the project's stated **"on-device analytics only / no login /
   no PII"** principle: design a PRIVACY-FIRST, identity-free, opt-outable,
   aggregate-only pulse, and call out the principle tension explicitly for the owner.

## How they compose (sequencing after planning)
- **#3 (Track state) is the keystone** — others assume a Track context. Read it first
  when synthesizing.
- #1 (economy) + #2 (badges) are the two orthogonal reward axes (currency/markets vs
  XP/badges); both live *inside* a Track.
- #4 (localization) unblocks real reach; #6 (immersion) is a per-Track presentation
  layer over #4.
- #5 (content scale) feeds every facet with variety; #7 (analytics) observes it.
- The in-progress cohesion milestones (M2 special NPCs / M3 map / M4 inventory) will
  be **re-sequenced** to incorporate these designs — e.g. M4 inventory must be the
  multi-currency + badges UI, not a plain item list.

## Non-negotiable bar (every doc)
Premium/understated/elegant (no Duolingo dark patterns); tablet+desktop+phone all
first-class; localize every string in ~50 langs; on-device-first privacy; data/CDN-
driven so content ships without an app release; honest about on-device model limits;
**no placeholders — fully articulated, concrete schemas + pipelines + UI + scaling math.**
