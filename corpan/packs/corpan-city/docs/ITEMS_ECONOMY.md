# Corpan City — Items, Inventory & Economy

> Implements PREMIUM_FOUNDATIONS §6 ("Items, inventory & economy — develop
> 'Item' as first-class") and §7 (quota-safe storage). Gold (coins) + XP + items
> are the stakes that make the language challenges feel like a real RPG: reasons
> to **earn, trade, buy, sell, and hunt**.

## The Item — a first-class model

`src/items/itemTypes.ts` defines `Item` (Zod-validated, data-only, serializable):

| field | meaning |
|---|---|
| `id` | stable kebab id (`ferry-token`, `straw-hat`) |
| `name` | display name (i18n keys layer on later) |
| `art` | cutout/`placeholder:*` id resolved by `cutoutArt` (3D) / glyph map (DOM) |
| `kind` | `cosmetic` \| `consumable` \| `quest` \| `trade-good` |
| `slot?` | cosmetics only — the `CosmeticSlot` it fills (hat/top/…) |
| `rarity` | reuses contract `Rarity`: common \| rare \| epic \| seasonal |
| `value` | base worth in coins (`0` = priceless/untradeable) |
| `description` | one-line wholesome flavour |
| `tags[]` | quest-relevance + shop filtering + clue matching |
| `tints?` | cosmetic swatches; `tradable`/`stackable` flags |

A `cosmetic` Item is the inventory-facing twin of the contract `CosmeticItem`;
`cosmeticToAvatarLayer()` projects it onto the `AvatarLayer` the character system
equips, so **a cosmetic you earn/buy is literally what your avatar wears**.

### The four kinds

- **cosmetic** — wearable; the marquee reward, feeds the character system (§2).
- **consumable** — one-shot effect (coffee = pep, map scrap = reveal a district).
- **quest** — a key/clue that satisfies a quest step. Often `value:0` + untradeable.
- **trade-good** — bought low / sold high; the raw currency of commerce + swaps.

### Rarity / value curve

`RARITY_VALUE_BAND` (coins): common `1–30`, rare `25–120`, epic `100–400`,
seasonal `150–600`. Deliberately gentle — a kid earning ~10 coins/challenge
affords a common hat in a couple plays, an epic in a week. No pay-to-win; rewards
are signed offline and reconciled server-side later. `isValueInBand()` is a dev
lint (quest keys with `value 0` are exempt).

## The catalog

`content/items/catalog.json` — 38 era-appropriate Antigua-Guatemala-1770 items,
validated through `parseItemCatalog`:

- **8 quest keys** — ferry token, city-gate pass, sealed letter, market list,
  lost spectacles, cathedral key, song fragment, merchant ledger.
- **10 trade-goods** — cinnamon, cacao, vanilla, woven cloth, clay pot, old
  silver real, jade bead, beeswax candle, salt, coffee sack.
- **7 consumables** — bread, coffee, fruit basket, water skin, map scrap, lucky
  charm, herbal tea.
- **13 cosmetics** — straw/tricorn/bonnet/feathered hats, linen shirt,
  embroidered blouse, traveler's coat, leather shoes, courier satchel, woolen
  shawl, quill, round spectacles, festival/marigold auras.

New items "light up" on the right quests automatically via their `tags` (see
quest-relevance).

## Inventory + wallet (`src/economy/inventory.ts`)

A single store: `coins`, `xp`, a `bag` of `{id, qty}` stacks, and `equipped`
cosmetics. Singleton via `inventory()`; events via `subscribe`.

### API

- **`applyReward({ xp, coins, items })`** — the entry point challenges/quests
  call. Adds xp + coins, grants each item id (looked up in the catalog), persists
  once, emits a `reward` event, returns the granted ids.
- `addCoins` / `spendCoins` (returns `false` if insufficient) / `addXp`
- `grant(id, qty?)` / `consume(id, qty?)` (returns `false` if not enough)
- `equip(itemId, tint?)` (cosmetic + owned only) / `unequip(slot)`
- queries: `coins`, `xp`, `qtyOf`, `has`, `hasAll`, `bagWithDefs`,
  `equippedLayers`
- `subscribe(fn)`, `reset()` (QA)

### Storage — quota-safe by construction (§7)

Persisted under `wp:economy:v1` in a **compact** shape: `{v, c (coins), x (xp),
b: [[id,qty]…], e: equipped}`. We persist **ids + counts only**, never item
bodies (those live in the bundled catalog, re-indexed at boot). A maxed bag is a
few hundred bytes — a good citizen of the shared ~5 MB origin budget.

`persist()` **never throws** into the game loop. On `QuotaExceededError` it logs
loudly (noisy-not-silent), retries ONCE after trimming consumable stacks to 1,
then keeps the in-memory state authoritative for the session if it still fails.
On load, ids no longer in the catalog are dropped (content can change between
releases). If the bag ever grows large, the same API moves behind IndexedDB with
zero caller changes.

## Quest-relevance — the spice (`src/economy/questItems.ts`)

The same Ferry Token is **precious** on the Guadalajara route (gates the docks
step) and **junk** on the café quest. `QUEST_ITEM_RULES[questId]` declares:

- `requirements[]` — `{stepId, itemId, clue, sourceAnchorId?}`: the item a step
  needs + the **in-character clue** an NPC is leaned to reveal (so progress feels
  *discovered*, not handed over) + where to find it.
- `relevantTags[]` — items whose `tags` overlap count as "useful here" even
  without an explicit rule (new catalog items auto-light-up).
- `junkTags?[]` — steer-to-sell hints.

Helpers the quest engine + NPCs + shop use:

- `relevance(questId, item) → "required" | "useful" | "junk"` (the core "precious
  here, useless there" classifier).
- `hasNeeded(store, questId, stepId)` / `missingFor(...)` — "does the player have
  the piece?" for gating a step.
- `cluesFor(store, questId, stepId?)` — clues for items the player does NOT yet
  hold; the **prompt-program injects these into the NPC system prompt**.
- `sourceHints(...)` — `{itemId, anchorId}` for on-map hint markers.
- `safeToSell(questId, item)` — true when junk-here AND tradable (the shop's
  gentle "SELL OK" badge; never auto-sells).

### The clue / item → quest-progression loop

```
NPC contrives a micro-challenge  ──▶  ChallengeResult
       (prompt-program)                      │
                                             ▼
                  inventory.applyReward({xp, coins, items})
                                             │
                       ┌─────────────────────┴───────────────┐
                       ▼                                      ▼
        item is a QUEST key for the next step      item is a TRADE-GOOD/COSMETIC
                       │                                      │
        hasNeeded(store, quest, step) ✔               buy/sell/equip in the shop
                       ▼                                      ▼
        quest step unlocks (e.g. docks)            avatar updates / coins grow
                       ▼
        next station → level → curriculum
```

Quests carry clues+required items in static data **and** the AI NPCs are leaned
(via `cluesFor`) to reveal the needed piece in character.

## Commerce (`src/economy/shop.ts` + `shop.css`)

A premium overlay: buy / sell / trade / equip with an NPC merchant.

- **Layout discipline (§4):** `position:fixed` from the first frame (can't push
  the world canvas into flow); open/close is **compositor-only** (opacity +
  transform), never width/height — **no layout shift, guaranteed**. ESC + scrim
  close; `transitionend` (with a timeout fallback) tears down.
- **Buy** — merchant stock; coins flow out; `relevance` badges "NEEDED/USEFUL".
- **Sell** — player bag; buy-back at `SELL_BACK_FRACTION` (0.5, no money
  printer); "SELL OK" badge for junk-here tradables; quest keys can't be sold.
- **Trade** — opens a player-to-player swap (below).
- **Equip** — owned cosmetics offer Equip/Unequip on any tab → `store.equip`.
- Merchant presets: `grocer`, `tailor`, `cafe`, `trader`. `openMerchant(container,
  "tailor")` one-call. `markup` per merchant.

## Player-to-player trade — AI-mediated, safe by construction (`src/economy/trade.ts`)

Two real humans swap items, but **never exchange raw UGC**. A trade is a typed
ARTIFACT built entirely from MENU CHOICES:

```
[give owned items] + [coins]  ⇄  [ask for items] + [coins]   (+ a CANNED note)
```

No free-text field anywhere; the only expressive channel is a fixed list of
curated, localizable canned notes (`TRADE_NOTES`: "Fair deal?", "Thank you!"…),
chosen never typed. Safe for a seven-year-old by design.

### The mediated pipeline (same seam as chat, §8)

1. Proposer builds a `TradeProposal` from menus (`draftProposal`, locally).
2. On send it rides the mediated pipeline: each device's local model (or the
   server moderator) validates against policy (`validateProposal`: items exist,
   are owned, not wildly lopsided — a `>8x` value guard against coercion, the
   note is on the allow-list) and may attach a gentle, **localized,
   in-character framing** for the recipient, and **"lessonify"** by surfacing item
   names in both players' target languages (`lessonifyTradeItems`).
3. Recipient sees the framed/translated artifact → Accept / Counter / Decline,
   all menus.
4. On mutual accept the server applies the atomic bilateral swap; offline,
   `applyTradeLocally(store, p, side)` applies our side directly.

### Server seam

`TradeTransport` is the interface the Colyseus client implements later
(`propose` / `respond` / `onUpdate`). `LocalTradeTransport` is a zero-network
stub that plays the partner in-process (accept/decline behavior), so the full
UI + data model + apply path build and test **today** with no network. Swapping
in the real transport changes nothing above it.

## game.ts integration (exact wiring)

The orchestrator wires three seams (none touch this module's internals):

**1. Apply challenge rewards → inventory.** Where the challenge overlay reports a
result:

```ts
import { inventory } from "./economy/inventory"
// rewards: { xp:number; coins:number; items:string[] } from the challenge/quest
inventory().applyReward(result.rewards)
```

The HUD subscribes once for live coins/xp:

```ts
const unsub = inventory().subscribe((e) => { if (e.type === "change") updateHud(...) })
```

**2. Open the shop from a merchant NPC.** On engaging a merchant role
(grocer/tailor/café), pass the active quest id for relevance badges:

```ts
import { openMerchant } from "./economy/shop"
openMerchant(container, "tailor", { questId: activeQuest.id, playerId: identity.name.playerId })
```

On close, re-read `inventory().equippedLayers()` and re-skin the player avatar
via the character system (cosmetics you bought/equipped are now worn).

**3. Surface quest-needed items / clues.** The quest engine gates a step and the
NPC prompt-program injects clues:

```ts
import { hasNeeded, cluesFor, missingFor } from "./economy/questItems"
const ready = hasNeeded(inventory(), quest.id, step.id)          // gate the step
const clues = cluesFor(inventory(), quest.id, step.id)           // → NPC system prompt
const missing = missingFor(inventory(), quest.id, step.id)       // → on-map hint markers
```

Completing a challenge yields the clue/item that advances the quest → level →
curriculum; a hat you bought with coins is on your avatar.
