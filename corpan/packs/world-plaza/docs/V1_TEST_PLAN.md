# World Plaza — v1 Walkthrough Test Plan

What landed this round and exactly how to exercise it. Test in the **real
embedded Corpán app** (rebuild dist + reopen — pack changes don't HMR), not just
standalone. Six pillars are integrated and on the `world-plaza` branch now;
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

## Known parked items
- Native on-device STT for speak challenges (#64) — genuine R&D, still parked.
- (Enterable-building interiors #14, "word vs phrase" #56, the ES→ES tautology
  #81, quest believability #75, phone-as-OS #77, map discoverability #72, wardrobe
  #84, emoji-strip #79 — all UN-parked and being built in the current agent round.)
