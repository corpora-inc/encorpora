# Corpan City — v1 Walkthrough Test Plan

What landed this round and exactly how to exercise it. Test in the **real
embedded Corpán app** (rebuild dist + reopen — pack changes don't HMR), not just
standalone. Six pillars are integrated and on the `corpan-city` branch now;
multiplayer (pillar 7) and the economy/transit localization pass are tracked as
"landing" at the bottom.

> Build state: `tsc` clean · `vitest` 512/512 · `npm run build` clean · dist rebuilt.

---

## 1. The Phone (extensible hub, ear-logo FAB)
The Corpán "all-hearing ear" logo is now a FAB that opens an app-shell phone.

- [ ] Tap the **ear FAB** → phone sheet slides up.
- [ ] **Things** app: shows your wallet + collected items (same source of truth as
      the menu's Inventory tab — change one, the other reflects it).
- [ ] **Music** app: now-playing / prev / next / volume; reflects the city radio.
      Ducks automatically when an NPC speaks (see pillar 5), un-ducks after.
- [ ] Close the sheet → FAB returns; no leftover overlay; ESC also closes it.

## 2. Quests at scale (16 quests, keyed + pair-agnostic)
- [ ] Default beginner quest is **winnable by tapping** (no mic required): walk to
      the glowing objective NPC → **Begin** → translate-fast challenge → **Claim
      reward** advances you. (Claiming is what fires the advance — confirm it does.)
- [ ] Switch/abandon quest from the menu → a different quest's objective beacon
      moves to the new target.
- [ ] Spot-check breadth: plaza greetings, café order, market numbers/groceries,
      fountain directions, harbor ferry/fishmonger, station departures, civic
      (city hall/clinic), bridge crossing. Each should start deterministically at
      its objective NPC, not depend on the LLM emitting a tool-call.

## 3. Richer minigame content (phrase DB draw)
- [ ] Repeat a challenge a few times on one quest → the phrases vary and stay
      on-topic (domain/level filtered), not the same 3 canned lines. Pulls from
      the host phrase DB via `getRandomEntries` with a quest-relevant domain/level.

## 4. Real economy — buy / sell / trade + wardrobe
- [ ] Talk to an NPC that has a standing offer → **"Make a deal"** chip → a real
      buy/sell/swap that actually moves items + wallet (no fake flavor). Decline,
      "can't afford", and "already own" paths all read cleanly.
- [ ] **Indoor shops**: Outfitter, Market stall, General Store each have an
      enter affordance → shop *vignette* (a 2D shop screen — NOT yet a walk-into
      building interior; that's the enterable-buildings work now in progress).
- [ ] **Wardrobe**: open "Change your look" (from Inventory/Things) → equip
      collected hats/outfits/colours/bling → the character on the world updates
      in place (`redress`, no world reload).

## 5. Transit you can actually find (taxi / bus / train / flight)
Four landmarks across the bigger city, each with a boarding vignette:
- [ ] **Taxi rank** (station) → "Take a taxi"
- [ ] **Bus terminal** (bus_station) → "Catch the coach"
- [ ] **Rail station** (rail_station) → "Board the train"
- [ ] **Airport** (airport) → "Check in to fly"
- [ ] Walk up to each → affordance appears → enter → pick a destination → quick
      "say the destination" challenge → you travel (respawn at the destination
      anchor). Fares show, partial fares read "(rest on us!)".

## 6. City scale + 60 FPS
- [ ] City is ~4× bigger (Mainland Isle + Central Green) with train/bus/airport
      landmarks — explore without hitting a fog dead-end.
- [ ] **Frame rate**: after the initial load calms, hold ~60 FPS while walking the
      full city. Watch specifically for the old regressions: no character
      dissolving piece-by-piece, no ghost-transparent buildings, no NPC in the
      fountain, no "screen dirt" (SSAO off by default), bridge stays solid while
      crossing and can't be walked under, camera doesn't clip into roofs.

---

## Landing next (not yet testable here)
- **Pillar 7 — real-human multiplayer** (agent E, in final locale-fill): trade /
  LLM chat / challenge another player, reveal their learning stack + country
  (only when the country cohort is large enough for k-anonymity). Will append a
  multiplayer section here when it integrates.
- **Economy + transit localization** (task #69): the economy offer/wardrobe and
  taxi/bus/train/flight vignette strings currently fall back to **English** on
  non-English stacks (~57 keys not yet in the i18n catalog). Functionally fine,
  not yet localized. One consolidated ~50-language pass runs right after pillar 7
  lands so it doesn't collide with E's catalog edits. Until then, test these two
  surfaces on an **English** native stack to see final copy.

## ROUND 2 — what to test (this session's agent round)

Rebuild dist + reopen the embedded app. All committed on `corpan-city`.

### The Phone (replaces the old menu)
- [ ] Bottom-left FAB is now the **Corpán logo** (the all-hearing ear brand mark),
      and it's the **only** FAB there (the satchel is gone). Tap → phone slides up.
- [ ] Phone is a **home-screen grid**: Map · Things · Quest · Badges · Music.
      Tap an app → it opens; back-chevron → home; "Leave the Plaza" on home → exit.
      (Same Map/Inventory/Quest/Badges content as before, now as apps.)
- [ ] Close fully — no drawer edge peeking at the bottom on **landscape or tablet**
      (that bug is fixed).

### Music is now consented, never from nowhere
- [ ] Onboarding has a new step: **"Want music while you explore?"** (Yes/No).
- [ ] Pick No → no music ever auto-plays. Pick Yes → radio plays your chosen
      station; the Music app toggles it; your choice + station + volume **persist**
      across restarts (no reset to defaults).

### Quests read like real scenes now
- [ ] "Order a coffee" sends you to an actual **Café** (not a fountain NPC). The
      café is **enterable** — walk to its door → step inside → order → quest advances.
- [ ] On a **non-Spanish** stack (e.g. German), quests now use **your** target
      language, not Spanish (the big pair-agnostic fix).
- [ ] You won't get the **same objective NPC 3 quests in a row** anymore.

### Minigame correctness
- [ ] With immersion OFF on an EN→ES stack, translate/match games are **EN↔ES**,
      never **ES→ES** (the tautology is fixed at the corpus-query root).
- [ ] Instructions say **"Tap the one that means…"** (no longer "Tap the WORD" when
      it's a sentence).
- [ ] The minigame **close (×)** sits cleanly inset, not straddling the corner.

### Discoverability + world
- [ ] **Map** now plots every venue: café, shops (Outfitter/General Store/Market),
      taxi/bus/train/airport, hospital, etc. — each with its own icon + legend, plus
      a **"go here"** cue toward your active objective.
- [ ] **NPC dialogue has no emoji** anymore.
- [ ] **Wardrobe**: one "None" per slot (no double), and the preview is the **full
      3D character** (drag-spin), premium framing.
- [ ] You can **walk under** the party bunting (no clip-through).
- [ ] Building **roofs fade** when the camera is behind them — the player is never
      hidden under a roof.
- [ ] No **"(P) perf"** hint or dev HUD in the build. (The "↓ tokens" meter is a
      host-side overlay, tracked separately — not the pack.)

### Multiplayer (present, needs a peer to fully exercise)
- [ ] With the Colyseus server + a second window, approaching another real player
      reveals their **learning stack + coarse place** (country only when the cohort
      is large enough) and offers chat / challenge / trade. Solo play is unchanged.

### Perf
- [ ] **60 FPS holds** — every round-2 world change was draw-call-flat by
      construction (café interiors are DOM overlays, bunting is a height tweak, the
      roof-fade is a one-constant eligibility fix). The `wp-60fps-baseline` tag is
      our known-good anchor.

> Note: a 46-language localization pass for the new Phone/Music/onboarding strings
> is finishing as you read this; `en` is complete, so test on English (or es — done)
> for final copy. Other languages briefly show English for those new labels until
> the gen commit lands.

## Known parked items
- Native on-device STT for speak challenges (#64) — genuine R&D, still parked.
- (Enterable-building interiors #14, "word vs phrase" #56, the ES→ES tautology
  #81, quest believability #75, phone-as-OS #77, map discoverability #72, wardrobe
  #84, emoji-strip #79 — all UN-parked and being built in the current agent round.)
