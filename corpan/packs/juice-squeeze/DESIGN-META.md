# Juice Squeeze ✨ — Meta-Progression Design (STRETCH)

Ian's idea: completed jars → a basket that gets carried away → points convert to
coins → a running score. Not crazy — it's a clean, satisfying long-loop on top of
the existing bottle mechanic. Captured here to build **after** core feel + haptics + QA.

## The loop today (built)
Complete a phrase → juice pours +10% into the full-screen glass → **10 phrases = 1
bottle** → the glass tops off, **caps into a small jar, and flies to the header
collection** (jar-close sound) → glass resets fresh. Bottles-per-level = A0:3, A1:5,
A2:7, B1:10, B2:12, C1:15 → **level complete** modal + next-level suggestion. The
word-count score (`allTimeScore`, "+wordCount" per phrase) persists.

## Proposed meta-loop (stretch)
1. **Shelf:** completed jars accumulate in the header collection (already happening).
2. **Basket fills:** when the shelf hits `BASKET_SIZE` jars (tune ~6), the jars drop
   into a **basket** which animates **carried away** off-screen — a satisfying
   "clear the shelf" beat (and it stops the collection growing unbounded, which Ian
   flagged).
3. **Coins:** the carried jars **convert to coins** (each jar = N coins, scaled by
   level/fruit) with a coin-fountain/tally animation.
4. **Currency:** coins add to a persistent **coin total** shown in the header,
   *separate* from the word-count score — two satisfying numbers ("words learned"
   vs "rewards collected"). Coins could later unlock cosmetics (fruit skins, glass
   styles) — optional.

## Implementation sketch (all PACK-SIDE, no host changes)
- **Store** (`gameStore`, same persisted localStorage key): add `coins` (persist),
  `basketCount`. On bottle-complete: `basketCount++`; when `basketCount >=
  BASKET_SIZE` → fire the basket-carry sequence, `coins += jars * COIN_PER_JAR`,
  reset `basketCount` + (optionally) clear the visible shelf.
- **UI:** a small basket + coin counter in the header; reuse the `jarFly.ts` overlay
  pattern for the basket-carry + coin-fountain (DOM/Canvas overlays, pointer-events
  none, auto-cleanup).
- **Audio/haptics:** basket-carry whoosh + a coin-jingle (we have `whoosh.wav`,
  `vocal-bird.wav`, `ta da 1.wav` available); a celebratory haptic on payout.

## Open questions for Ian
- Basket size (how many jars before it's carried away)?
- Coin conversion rate / does it scale with CEFR level?
- Do coins *do* anything (cosmetic unlocks) or are they just a satisfying score?
- Keep BOTH numbers (words + coins) or fold into one?

**Status:** stretch — sequence it after the look/feel is locked and haptics ship.
