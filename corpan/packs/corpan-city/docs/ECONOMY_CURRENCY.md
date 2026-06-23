# Corpan City — Economy, Currency, Markets & Trade

**Status:** Design + sequenced plan. DESIGN DOC ONLY — no code lives here; this is
the spec the implementation fans out from. Workstream **#1** of
`docs/NEXT_LEVEL_PLAN.md`. Orthogonal to XP/badges (`docs/BADGES_PROGRESSION.md`):
currency/markets are the *commerce* reward axis; XP/badges are the *mastery* axis.

**Author intent (verbatim spine):** kill the bland gray "coin" that looks like a
moon. Replace it with a fully articulated **multi-currency reward + market + trade**
economy — many era/place-flavored currencies (gold, silver, peso, yen, dollar,
Weimar mark…), **denominations** (stacks of bills, coins, ingots), **exchange
rates**, **player↔player and player↔NPC currency exchange + buy/sell**, **markets
with live prices**, and a watchable **global price feed**. An addictive economic
side-game that also drills numbers/math, and a *reason to chat*. The baseline
default reward should feel like a *smorgasbord* (stacks of bills, not one coin).

**The non-negotiable bar:** A++ premium / understated (no Duolingo dark patterns);
tablet + desktop + phone all first-class; localize every string in ~50 langs;
on-device-first privacy; data/CDN-driven so currencies, goods, and markets ship
**without an app release**; **no real money — in-game only, age-3+ safe**; no
placeholders — concrete schemas + pipelines + UI + scaling math.

---

## 0. Where this sits in the spine (read `LANGUAGE_PAIR_STATE.md` first)

Per `NEXT_LEVEL_PLAN.md`, the user's entire state is **one ordered language pair at
a time** — a **Track** `(native, target)`, e.g. `en→es`. **ALL economy state lives
INSIDE a Track.** A user with three active Tracks has **three independent wallets,
three market positions, three trade histories** — namespaced by the pair key.

- Storage key for every persisted economy record is **`wp:econ:<pairKey>:v1`**
  (`pairKey = "en-es"`). The current global `wp:economy:v1` migrates per §9.
- The *currency definitions, goods, and market configs* are GLOBAL catalog data
  (one CDN-driven library shared by all Tracks). Only **balances, positions,
  offers, and trade history** are per-Track.
- A currency is "native to" a Scene/era (`scene.place`/`scene.era`), so the
  *default reward currency* a Track grants follows the Track's active Scene — but
  the wallet can hold any currency the player has acquired or exchanged into.

This doc therefore assumes a `Track` context object is available to the runtime
(provided by the keystone workstream #3). Where it says "the wallet," read
"this Track's wallet."

---

## 1. Currency model

### 1.1 The shift: from one scalar `coins` to a multi-currency `Wallet`

Today `InventoryState.coins: number` and `EconomyState.coins` are a single scalar
rendered as `🪙 N` (the "moon coin"). We replace the scalar with a **`Wallet` =
`Record<CurrencyId, MinorUnits>`** — a map from currency id to an integer count of
that currency's **smallest denomination** (its "minor unit," like cents). Integers
only: no floats in balances, ever (avoids drift, makes anti-cheat hashing exact).

```
Wallet = Record<CurrencyId, number>   // minor units, integer, nonnegative
// e.g. { "gold-real": 1840, "mxn-peso": 5000, "jpy-yen": 220 }
```

A `CurrencyId` is a stable kebab id (`gold-real`, `mxn-peso`, `jpy-yen`,
`weimar-mark`, `usd-dollar`). The "moon coin" becomes one *legacy* currency,
`coin-base`, kept only for migration (§9) and never shown with the moon glyph again.

### 1.2 Currency definition (catalog data — the heart of "data-driven")

Currencies are **not hardcoded**. They live in a CDN-driven catalog
`content/economy/currencies.json` (plus a fallback bundled copy), validated by a
new contract `Currency` (added to `contracts/src/economy.ts`):

```ts
Currency = {
  id: CurrencyId                  // "gold-real"
  name: string                    // "Spanish Real"           (localizable, §1.7)
  symbol: string                  // "₧" or "R"               (short ticker glyph)
  // --- denominations: how this currency is physically rendered + counted ---
  minorPerMajor: number           // 100  (100 cents = 1 real); 1 for indivisible
  denominations: Denomination[]   // ordered small→large; drives "make change" + art
  // --- flavor + provenance ---
  era?: string                    // "colonial-1770"
  place?: string                  // "antigua-guatemala"
  sceneTags?: string[]            // ["market","colonial"] — which Scenes mint it natively
  // --- economic identity ---
  family: "metal" | "coin" | "note" | "ingot" | "token" | "shell" | "gem"
  baseValue: number               // reference value in the COMMON UNIT (§3.2), e.g. 1.0
  volatility: number              // 0..1 — how much its rate drifts (§3 / §4)
  rarity: "common" | "rare" | "epic" | "seasonal"
  // --- art (premium icon, NOT a moon) ---
  art: CurrencyArt                // §1.6
  paletteHint?: string            // base hue for the auto-generated icon
}

Denomination = {
  id: string                      // "real-1", "real-8" (a "piece of eight"), "bill-100"
  label: string                   // "1 real", "8 reales", "100 mark"
  units: number                   // value in MINOR units (e.g. 800 for 8 reales)
  form: "coin" | "bill" | "ingot" | "note-stack" | "pouch" | "gem"
  art: CurrencyArt                // the specific bill/coin/ingot art
}
```

**Why denominations matter:** the owner's instinct was "stacks of bills." A reward
of `12,000` Weimar marks should *render* as a few **100-mark notes + a fat banded
stack**, not "12000 🪙." The denomination list lets the renderer do greedy
"make-change" decomposition into the right physical objects (§1.4), which is the
entire visual upgrade from a lonely coin to a smorgasbord.

### 1.3 Launch currency set (era/place-flavored, extensible)

Ships as catalog data; grows without an app release. **Launch set (~12), each tied
to a Scene/era where it makes sense:**

| id | name | family | denoms | flavor / Scene |
|---|---|---|---|---|
| `gold-real` | Spanish Real | coin | 1, 2, 8-real ("piece of eight"), gold escudo | Antigua-1770 (default for the colonial scene) |
| `silver-tael` | Silver Tael | ingot | small sliver, sycee ingot | Tang/Song market scene |
| `mxn-peso` | Mexican Peso | note | 20/50/100/500-peso bills | modern Mexico scene |
| `jpy-yen` | Japanese Yen | coin+note | 1/5/100 coin, 1000/10000 note | Tokyo scene |
| `usd-dollar` | US Dollar | note | $1/$5/$20/$100 bill, banded stack | modern/global scene |
| `weimar-mark` | Weimar Mark | note | 100 / 10,000 / 1,000,000-mark notes | 1920s Berlin (a *deliberately inflationary* novelty — §7.4) |
| `eur-euro` | Euro | note+coin | €1/€2 coin, €5/€20/€50 note | modern Europe scene |
| `roman-denarius` | Denarius | coin | as, sestertius, denarius, aureus | Roman forum scene |
| `cowrie-shell` | Cowrie Shell | shell | single shell, string-of-shells | ancient trade scene |
| `dutch-guilder` | Guilder | coin | stuiver, guilder, ducat | 17th-c. Amsterdam scene |
| `inr-rupee` | Indian Rupee | note | ₹10/₹100/₹500 note | modern India scene |
| `krw-won` | Korean Won | note | ₩1000/₩10000/₩50000 note | modern Korea / `ko` Tracks |

The set is intentionally **broad in form** (coins, ingots, note-stacks, shells,
gems) so the inventory *looks* varied, and **broad in value scale** (a yen ≪ a
piece of eight ≪ a banded dollar stack ≪ a million-mark note) so exchange math is
interesting. New eras add currencies by appending rows; the runtime reads only ids
it knows and skips unknowns (forward-compatible like catalog-v2).

### 1.4 Denomination decomposition ("stacks of bills" rendering)

Given a balance of `N` minor units of currency `C`, the **decompose** routine does
greedy large→small over `C.denominations` to produce a render list:

```
decompose(C, N) -> Array<{ denom: Denomination; count: number }>
// 12000 weimar-mark (minorPerMajor=1) with denoms [100, 10000, 1000000]:
//   → [ {bill-10000 ×1}, {bill-100 ×20→ shown as a banded "20×" stack} ]
```

A reward toast / wallet cell renders the **top 1–3 denominations** as physical art
+ a count, capping visual clutter ("a banded stack of 100-mark notes + 3 loose").
This is the concrete "stacks of bills" upgrade. The HUD shows the **major-unit
total** compactly (`R 18.40`, `₩ 50,000`), tapping it expands the physical
breakdown.

### 1.5 Counting / formatting (also a numbers drill)

- **Major/minor formatting:** `format(C, units) → "R 18.40"` using `minorPerMajor`
  + locale grouping (Intl.NumberFormat with the Track's native locale — large
  numbers grouped per locale, which is itself a localization win).
- Because every price/exchange/trade is shown in real grouped numbers across many
  scales (¥, ₩, million-mark), **the economy is a passive numbers/place-value
  drill** — leaned into in the market UI (§4.5) with optional "round-the-change"
  micro-challenges.

### 1.6 Art direction — premium currency icons (kill the moon)

`CurrencyArt` is a **procedural icon spec**, not a static PNG, so we ship ~12+
distinct, tasteful currency icons with zero binary assets and they re-tint per
denomination. Mirrors the pack's `cutoutArt` / `WorldLook` seam.

```ts
CurrencyArt = {
  shape: "coin-round" | "coin-square-hole" | "bill-rect" | "ingot-bar"
       | "note-stack" | "shell" | "gem-faceted" | "pouch"
  motif: string        // a small emblem id drawn on the face: "castle","quetzal",
                       // "eagle","chrysanthemum","eagle-globe","oak-leaf","laurel"
  metal?: "gold" | "silver" | "copper" | "bronze" | "patina"  // for coins/ingots
  paper?: { hue: string; guilloche: boolean }                 // for bills (engraved lines)
  bandColor?: string   // the paper band on a note-stack
}
```

- **Coins** render as a beveled disc (radial-gradient metal + rim highlight + a
  drawn `motif` emblem + subtle milled edge). NOT flat gray. NOT a moon — there is
  always an emblem and a metallic rim, so it reads as *money*, never a sphere.
- **Bills/note-stacks** render as a layered rectangle with a guilloche line motif,
  a denomination numeral, and (for stacks) a colored paper band + a "fan" of 2–3
  offset notes so a stack reads as a *wad*.
- **Ingots** render as an angled bar with a stamped weight; **shells** a scalloped
  form; **gems** a faceted polygon with a specular glint.
- Same icon system is used **in-world** (a `trade-good`/pickup glyph), **in the
  HUD**, **in the reward toast**, and **in the market ticker** — one
  `drawCurrencyIcon(ctx, art, size)` routine, three render targets (in-world canvas
  cutout, DOM `<canvas>` cell, CSS background data-URL). Reduced-motion respected
  (no glint animation).
- **Quality bar:** each currency must be **instantly distinguishable at 24px** by
  silhouette + color (a yen coin with a square hole vs. a banded dollar stack vs. a
  green-patina ingot). The icon generator is reviewed against this at authoring
  time, the same "instantly distinct at thumbnail size" bar `CONTENT_SCALE.md` sets.
- 3D-asset upgrade later slots behind the same seam (a Spark/glTF coin model can
  replace `drawCurrencyIcon` per the `WorldLook` pattern) — design for it, ship
  procedural.

### 1.7 Localization (~50 langs)

- `Currency.name`, `Denomination.label`, and all economy UI strings go through the
  **same per-locale `strings` override pattern** the shell/runtime already use
  (`LOCALIZATION_SCALE.md` owns the pipeline). Names are i18n keys
  (`econ.currency.gold-real.name`) with an English default in the catalog.
- Numerals/grouping localize via `Intl.NumberFormat(track.native)`.
- Symbols (`₧`, `¥`, `₩`, `€`) are Unicode and locale-neutral; the *spoken/labelled*
  name localizes.
- Single-language-stack rule: when `target === native` (immersion/native practice),
  all economy copy still works — currency names show in the one language; no copy
  assumes a translation pair.

---

## 2. Reward model — the smorgasbord (replacing the single coin)

### 2.1 What grants currency now

`Reward.coins: number` becomes **`Reward.currency: Wallet`** (a multi-currency
grant) plus the existing `xp` and `items`. `applyReward` (§8.2) ingests it. A
single challenge can grant **several currencies at once** — that's the smorgasbord.

```ts
Reward = {
  xp?: number
  currency?: Wallet         // { "gold-real": 240, "jpy-yen": 30 }  ← NEW (replaces coins)
  items?: string[]
  // legacy: coins?: number  (mapped to the Track's default currency on read — §9)
}
```

### 2.2 How a reward is *rolled* (data-driven, weighted, scene-appropriate)

Rewards are not hand-authored per challenge. A **`RewardTable`** (catalog data,
per Scene/quest/challenge-tier) describes *what kinds of money* a win pays, and the
runtime rolls a concrete `Wallet` from it deterministically-seeded (so it's
reproducible for anti-cheat, §7.1):

```ts
RewardTable = {
  id: string                       // "antigua-market-tier1"
  base: number                     // baseline payout in COMMON UNITS (§3.2), e.g. 10
  // weighted mix of currencies this context pays; weights sum-normalized
  mix: Array<{ currency: CurrencyId; weight: number; minShare?: number; maxShare?: number }>
  // multiplier by challenge difficulty/score band
  scoreCurve: { floor: number; perfect: number }   // e.g. 0.5 at floor → 1.5 at perfect
  // chance to also drop a bonus currency (the "ooh, a piece of eight!" moment)
  bonus?: Array<{ currency: CurrencyId; chance: number; units: number }>
  // optional item drops piggyback the existing items[] path
  itemDrops?: Array<{ itemId: string; chance: number }>
}
```

Rolling: take `base × scoreCurve(score)` common units, split across `mix` by weight
into each currency's value, convert each share to that currency's minor units via
its `baseValue` (so the player visibly receives *a fistful of yen AND a real or
two*), then roll `bonus`. **Default Track currency always gets the largest share**
so progression feels grounded, but the spread is what makes it a smorgasbord.

- **Scene-appropriate:** the colonial market's table pays mostly `gold-real` +
  occasional `silver-tael`; the Tokyo scene pays `jpy-yen`; the Weimar novelty
  scene pays *millions* of marks (huge numerals, tiny real value — a deliberate
  comedic/math beat, §7.4).
- **Daily/quest rewards** use richer tables (bigger `base`, more `bonus`) so a
  daily feels like opening a varied purse, not "+50 coins."

### 2.3 How it reads as a smorgasbord (UX)

The reward toast (§5.1) shows **a row of physical currency icons + counts** (decomposed
per §1.4) sliding in — e.g. *"+8 reales 🪙🪙 · +30 yen · a banded stack of pesos
💵 · +1 jade bead 💎"* — not a single number ticking up. This is the literal,
visible kill of the moon coin.

---

## 3. Exchange & rates

### 3.1 What "exchange" is

Converting currency A → currency B at a **rate**, with a **spread** (the house/NPC
takes a cut, the universal money sink). Three venues:

1. **NPC money-changer** (player↔NPC) — always available, even solo/offline. The
   "cambio" stall. Quotes a rate from the live feed + a spread.
2. **Player↔player exchange** — a `TradeProposal` whose offer/request are *pure
   currency* (no items). Same mediated, menus-only, anti-coercion pipeline as item
   trade (§5.3, reuses `trade.ts`). Players can agree a rate between the spread —
   the "find a good exchange rate and get rich" loop.
3. **Market FX pair** (advanced) — currency pairs that trade on the market like any
   good (`fx:gold-real/jpy-yen`), with their own price walk (§4).

### 3.2 How rates are set — the common unit + the feed

Every currency has a `baseValue` in an abstract **Common Unit (CU)** — an internal
numéraire, *never shown to the player* (it's the pivot, like SDR/USD). The
**exchange rate** A→B is `rate(A,B) = price(A) / price(B)`, where `price(C)` is
`C.baseValue` *modulated by the live feed* (§4.3). So:

```
rate(A→B) = (baseValue_A × feedMult_A) / (baseValue_B × feedMult_B)
```

`feedMult_C` is a slowly-drifting multiplier around 1.0 (the "market"), bounded by
`C.volatility`. This makes rates **move over time** (the watchable feed) while
staying anchored (anti-inflation, §7).

### 3.3 Authoritative server feed vs. simulated — the mix (the key decision)

**A hybrid, degrade-gracefully design:**

- **Online (server present):** the co-located TS server (`server/`, §6) runs the
  **single authoritative price simulation** (a deterministic random walk + event
  shocks, §4.3) and broadcasts `feedMult` for every currency + market good at a low
  cadence (≈1 tick / 5–10s, binary delta via Colyseus or a lightweight Fastify
  SSE). Every client sees the **same global feed** → "watch the global prices"
  is real and shared. Authoritative = anti-cheat: the client can't move the price.
- **Offline / solo (no server):** the client runs the **identical deterministic
  walk** seeded by `(currentDayEpoch, currencyId)` so prices still drift sensibly
  and *agree across sessions on the same day* (reproducible). Exchanges still work;
  the player just isn't seeing other humans' trades move the book. On reconnect the
  server feed takes over (authoritative reconciliation).
- The **simulation core is one shared module** (`src/economy/priceSim.ts`)
  imported by BOTH the server and the client-offline path, so they can't diverge —
  same trap-avoidance discipline as `validateProposal` running both sides.

### 3.4 Spreads & anti-abuse on exchange

- **NPC spread:** `spreadBps` per money-changer (e.g. 150–400 bps = 1.5–4%). Buy
  high / sell low around the mid-rate. This is a **money sink** (every round-trip
  loses a little) — the primary defense against infinite-money exchange loops.
- **No closed-loop arbitrage profit at a single NPC:** because spread > 0, `A→B→A`
  always returns *less* A. Cross-venue arbitrage (NPC vs. player vs. market) CAN be
  profitable *if you find a real mispricing* — that's the intended skill game — but
  is bounded by spreads + the server's authoritative mid so it can't run away.
- **Rate-of-change clamp:** the server caps how far `feedMult` moves per tick
  (`volatility`-scaled) so no single event lets a player 100× their wealth.
- **Wash-trade guard (player↔player):** the same `>8x` lopsidedness guard
  (`validateProposal`) applies to currency; plus a per-pair, per-window velocity
  cap server-side (two accounts can't ping-pong currency to mint value — there's no
  value minted in a fair swap anyway, but the cap stops feed-timing exploits).
- **Offline reconciliation:** exchanges done offline are signed
  (`EconomyTransaction.sig`, already in the contract) and reconciled when online;
  rates are snapped to the server's authoritative feed for that timestamp, so an
  offline client can't pick a fantasy rate.

### 3.5 The "get rich on a good rate" loop (the fun)

A player watching the feed spots that **yen is cheap vs. reales right now** (feed
drifted), exchanges reales→yen at a good NPC rate, waits/plays, the feed reverts,
exchanges back → net more reales. This is **mean-reversion trading**, bounded and
spread-taxed, and it *teaches numbers* (comparing rates, computing the spread, the
percentage gain). It is a *skill*, not a money printer.

---

## 4. Markets & prices

### 4.1 What trades

- **Goods** — the existing `trade-good` items (cinnamon, cacao, jade bead, coffee
  sack…) each have a **live market price** per market, quoted in that market's local
  currency. Buy low in one market, sell high in another (spatial arbitrage) or
  across time (the price walk).
- **FX pairs** (advanced) — currency/currency as a tradable pair.
- Each **market** is a venue (a Scene's marketplace, or a global exchange) defined
  in `content/economy/markets.json`.

### 4.2 Mechanism: simulated price walk + light AMM (NOT a real order book at MVP)

We deliberately **do not** ship a full central-limit order book at MVP (it needs
deep liquidity + matching latency + is hard to make legible to a child). Instead:

- **Each good in each market has a simulated mid-price** that moves via the price
  sim (§4.3). The player buys/sells against the **market maker** (the NPC/house) at
  `mid ± spread`. This is effectively a **constant-spread AMM with an exogenous
  mid** — simple, always-liquid, legible, and bounded.
- **Player participation moves price slightly (impact):** a large buy nudges that
  good's `feedMult` up a touch (and decays back) — so a player *can* move a thin
  market, and others *see it on the feed*. Impact is capped (anti-manipulation) and
  scales with order size / market depth.
- **Player offers (advanced / phase 4):** players can post a *limit offer* ("sell
  10 cacao at 32 reales") to a lightweight **server-matched book** that other
  players (or the house) can hit. This is where a *real* order book appears, but
  only once there's multiplayer liquidity (§10 phase 4). MVP and even single-player
  never need it.

**Decision rationale (order book vs AMM vs walk):** AMM-with-exogenous-mid gives
the *feel* of a live market (prices move, you can move them, you watch a feed)
with the *robustness* of a simulation (always liquid, no empty-book dead-ends, no
unbounded manipulation), and degrades to solo perfectly. The order book is added
later as a multiplayer *enrichment*, not a dependency.

### 4.3 How prices move — the price sim (`src/economy/priceSim.ts`)

A single deterministic function `priceMult(id, tEpoch, seed) → number` shared by
server + offline client (§3.3):

```
feedMult(id, t) = clamp(
  1
  + meanReversion(id, t)          // Ornstein-Uhlenbeck pull toward 1.0
  + walk(id, t, seed)             // bounded random walk, step ∝ volatility
  + Σ eventShock(id, t)           // scheduled/seasonal/quest events (§4.4)
  + impact(id, t)                 // decayed sum of recent player order impact
, 1 - maxDev(id), 1 + maxDev(id)) // volatility-bounded, never runaway
```

- **Mean-reversion** keeps the long-run economy stable (anti-inflation core).
- **Walk** gives minute-to-minute life to watch.
- **maxDev** (∝ `volatility`) hard-bounds every price so nothing 100×'s — the
  inflation guard. `weimar-mark` is the one currency with huge `volatility` +
  designed drift, on purpose (§7.4), and even it is bounded in *real* (CU) terms.

### 4.4 Events — the spice on the feed

Catalog-driven `content/economy/events.json`: scheduled or random shocks that move
specific goods/currencies and **show up as headlines on the ticker** ("☕ Coffee
harvest in! Coffee dips." / "⚓ Ferry strike — tokens spike."). Events can be tied
to **Scene** (a festival raises festival-goods), **quests** (completing a route
opens a trade lane that cheapens a good), or **time** (a daily "market mood").
Events are *informative flavor + a numbers reason to trade*, never pay-to-win.

### 4.5 The premium market UI — the watchable ticker + trade floor

A new in-overlay surface (`src/economy/market/`), opened from the menu's
**Market** tab (§5.4) or a market-NPC, mounted **inside `.wp-overlay`** (the M0
lesson — NEVER `document.body`):

- **The Ticker (the marquee feature).** A horizontally scrolling, glanceable strip
  of currency/good rows: icon · symbol · current price · ▲▼ delta · a tiny
  sparkline. Updates live from the feed. A "global trades" lane scrolls recent
  *(anonymized)* fills ("someone sold 12 cacao @ 31R") so the world feels alive —
  "watch the trades and global prices." Reduced-motion → static, tap-to-refresh.
- **A good/currency detail card.** Bigger sparkline (last N ticks), buy/sell at
  `mid ± spread`, your position (qty held + avg cost → **unrealized P/L**, a gentle
  numbers lesson), and the relevant events. Buy/Sell are quantity steppers with a
  **live total in grouped numerals** (the place-value drill).
- **FX board.** A matrix of exchange rates between the currencies you hold,
  refreshed live; tap a pair → exchange via the money-changer flow.
- **Premium feel:** paper-cutout/ledger aesthetic on-brand; sparklines are crisp
  canvas; numbers animate by rolling digits (respecting reduced-motion); no red
  "FOMO" pressure — deltas are calm, informative (the no-dark-patterns rule).
- **Mobile-first:** the ticker is a single scroll strip; detail is a bottom-sheet;
  steppers are thumb-sized. Identical on tablet/desktop (wider grid, hover
  sparkline preview) — first-class, not a phone port.

---

## 5. Trade UX (all in-overlay, premium, mobile-first)

All surfaces mount **inside `.wp-overlay`** (Band A), `position:absolute; inset:0`
— structurally immune to the host clip that killed the body-fixed modal (the M0
root-cause lesson). Compositor-only open/close (opacity+transform), ESC + scrim
close, safe-area aware, touch + pointer + ESC paths all wired.

### 5.1 Reward toast (the smorgasbord moment)
Already lives in `.wp-overlay`. Upgraded to render the decomposed physical
currency row (§2.3) instead of `+N🪙`. The single most-seen surface — this is
where the moon dies.

### 5.2 Wallet HUD (replaces `.wp-coinhud`)
Top-right. Shows the **Track's 1–3 most-held currencies** as compact icon + grouped
major total (`R 18.40 · ¥ 50,000`); the rest collapse behind a "+more" chip.
Tapping opens the **Wallet** view (menu Inventory/Wallet tab) with every currency,
its physical breakdown, and a "Exchange" action per currency. Live via
`inventory().subscribe`. (The XP `✨` moves out of here entirely — XP/badges is a
separate HUD per `BADGES_PROGRESSION.md`.)

### 5.3 Exchange screen (money-changer)
A two-pane "give A → get B" with the live mid-rate, the spread shown honestly
("rate 1R = 132¥, changer keeps 2%"), a quantity stepper, and the **resulting
amount in grouped numerals** updating live. One tap to confirm (player↔NPC,
instant, offline-ok). Player↔player exchange reuses the §5.5 trade sheet with
currency-only sides.

### 5.4 Menu integration
The cohesion menu (`COHESION_ITERATION.md` §2) gains/repurposes tabs:
- **Wallet** (currencies + exchange) — was "Inventory"'s money half.
- **Bag** (items — the existing inventory panel).
- **Market** (ticker + trade floor, §4.5).
Each is a section factory the orchestrator wires via `getWalletView()` /
`getMarketView()` getters, exactly like the existing `getInventoryView()` seam.

### 5.5 Give/receive + trade sheet
Reuses the existing `shop.ts` Trade tab + `trade.ts` artifact pipeline (menus-only,
canned notes, anti-coercion). Extended so a trade side can carry **currency stacks**
(not just `coins`) and **multiple currencies**, e.g. *"give 8 reales + 1 jade bead ⇄
get 1000 yen."* Currency lessonify (§trade.ts `lessonifyTradeItems` sibling)
surfaces currency *names* in both players' target languages — the swap doubles as
vocab.

---

## 6. Backend / realtime (`server/`, Colyseus + Fastify)

The co-located TS server already owns authoritative presence/movement
(`PlazaRoom`). The economy adds **one authoritative simulation + a few typed
message handlers** alongside `"move"` — *no architectural change*, same `onMessage`
seam the chat/trade seam already anticipates.

### 6.1 What the server MUST do
1. **Run the price sim** (the single source of truth): tick `priceSim` every
   5–10s for all currencies + market goods, write `feedMult`s into a new
   `MarketState` schema, broadcast binary deltas (Colyseus auto-syncs). This is
   the **global price feed** every client watches.
2. **Quote + settle exchanges** that are player↔player or market orders: validate
   against the authoritative mid + spread, apply atomically, sign the
   `EconomyTransaction`.
3. **Match player limit offers** (phase 4 order book) — a simple price-time
   priority match in a `MarketBook` schema; emit fills to the global-trades lane
   (anonymized).
4. **Anti-cheat reconciliation:** verify offline `EconomyTransaction.sig`s on
   reconnect; reject/clamp impossible balances; snap offline exchange rates to the
   authoritative feed-at-timestamp; enforce velocity/wash caps (§3.4, §7).
5. **Broadcast the anonymized global-trades lane** (recent fills, no player ids) —
   the "watch the trades" social texture.

New server modules: `server/src/MarketState.ts` (schema: `feedMult` map, `book`
map), `server/src/priceFeed.ts` (the tick loop importing the shared `priceSim`),
`server/src/economyHandlers.ts` (`onMessage("exchange"|"order"|"trade")`). A
Fastify SSE/GET endpoint `/feed` exposes the current feed for clients that only
want the read-only ticker without a Colyseus room (cheap, cacheable).

### 6.2 What stays on-device / offline (degrade to solo)
- The **wallet, bag, positions, and history** are local (per-Track IndexedDB/
  localStorage) — the server never holds the canonical wallet (no login, no PII,
  on-device-first). The server is the **price + settlement referee**, not the bank.
- The **offline price path** runs the same `priceSim` seeded by the day, so solo
  play has a sensible, reproducible market and working exchange (NPC money-changer
  + simulated market maker). **Everything single-player works with zero server.**
- Reconnect → the server feed supersedes the offline sim; pending offline txns
  reconcile. No feature is *gated* on the network — multiplayer adds *shared* feed,
  human counterparties, and the order book, but never gates the side-game.

### 6.3 Privacy (reconcile with "on-device analytics only / no login")
- No account, no server-side wallet, no PII. The global-trades lane is
  **anonymized + aggregated** (no player id, just "12 cacao @ 31R"). Designed to
  align with `ANALYTICS_PULSE.md`'s privacy-first stance — the feed is *broadcast*
  state, not *collected* user data.

---

## 7. Anti-abuse + economy health

### 7.1 Faucets & sinks (the balance sheet)
- **Faucets (money in):** challenge/quest/daily reward tables (§2). Tuned so a
  ~10-min session earns enough to feel rich but not trivialize cosmetics
  (`RARITY_VALUE_BAND` already sets the cosmetic price scale; reward `base` is
  tuned against it).
- **Sinks (money out):** cosmetics/consumables purchase, **exchange spreads**
  (every FX round-trip leaks), **market spreads** (every buy/sell leaks),
  **order/listing fees** (phase 4), event-driven prices. Spreads are the *always-on*
  ambient sink that keeps the closed loop from inflating.
- **Net design:** mean-reversion (§4.3) + bounded `maxDev` cap the *value* of total
  wealth growth; spreads ensure trading is net-negative *unless you're skillful* →
  wealth tracks *skill + play time*, not exploits.

### 7.2 No infinite-money loops
- Single-NPC FX round-trip is always lossy (spread > 0) → §3.4.
- Buy-then-sell same good same market is lossy (spread) → no instant arb.
- Cross-venue arb is bounded by the authoritative mid + impact caps + velocity caps.
- Player↔player fair swaps mint no value; lopsided ones are blocked (`>8x` guard).

### 7.3 No pay-to-win, no real money
- **Explicitly: there is NO real-money purchase of any currency, good, item, or
  market advantage. All currency is in-game, earned by playing.** This is an
  age-3+ product; the economy is a *learning game*, not gambling. No loot-box
  purchase, no "buy gems with $." (Corpán Plus is a *subscription to content*, per
  the project's monetization doc — it never sells in-game currency.)
- No dark patterns: the ticker informs, never pressures; deltas are calm; there is
  no artificial scarcity timer, no "your stack will expire," no streak-shaming.
  Reduced-motion kills all the animation. (Same dignity bar as the cohesion doc.)

### 7.4 The Weimar mark — a *deliberate* novelty (safely bounded)
A currency whose numerals balloon (rewards of *millions* of marks) for the comedic/
historical/math beat — but its `baseValue` is tiny and its `maxDev` bounded, so a
million marks is worth *little* in CU and can't break the economy. It teaches
big-number reading + the *concept* of inflation in a contained, wholesome way. It
is the clearest demonstration that **numerals ≠ value** — a genuine learning moment.

### 7.5 Age-safety on trade
All player↔player exchange/trade is **menus-only, canned-notes-only, no free text**
(reuses `trade.ts`'s safe-by-construction artifact). The anti-coercion `>8x` guard
+ server velocity caps protect kids from being talked out of their stuff.

---

## 8. Schemas & runtime changes (concrete)

### 8.1 Contract additions (`contracts/src/economy.ts`, additive — bump `CONTRACTS_VERSION`)
- `CurrencyId` (branded string), `Currency`, `Denomination`, `CurrencyArt` (§1.2/§1.6).
- `Wallet = Record<CurrencyId, number>` (minor units).
- `InventoryState.coins: number` → **`wallet: Wallet`** (keep `coins` readable for
  one version as a deprecated alias for migration — §9).
- `EconomyTransaction.delta.coins` → `delta.currency?: Wallet` (keep `coins`
  optional for legacy sig compatibility).
- `RewardTable`, `MarketGood`, `Market`, `MarketEvent`, `FxQuote`, `ExchangeOrder`,
  `MarketOrder`, `Fill` (the new market/exchange wire types).
- `Reward.coins` → `Reward.currency?: Wallet` (legacy `coins` mapped on read).

### 8.2 Runtime (`src/economy/`)
- **`inventory.ts`** — `coins: number` → `wallet: Wallet`. New API:
  `balance(currencyId)`, `credit(currencyId, units)`, `debit(currencyId, units)→bool`,
  `walletEntries()`, `defaultCurrency()` (from the Track's Scene). `applyReward`
  ingests `Reward.currency`. `spendCoins`/`addCoins` kept as thin shims over the
  default currency for back-compat during migration. Persistence shape extends to
  `{ v:2, w: [[currencyId, units]…], … }` — still ids+counts, still quota-safe, now
  keyed per-Track (`wp:econ:<pairKey>:v2`).
- **`currencies.ts`** (NEW) — loads/validates `currencies.json`, indexes by id,
  `decompose`, `format`, `defaultCurrencyForScene`.
- **`priceSim.ts`** (NEW, SHARED with server) — the deterministic price function.
- **`exchange.ts`** (NEW) — `quote(A,B)`, `applyExchange` (local + server seam),
  spread logic, offline-sign + reconcile.
- **`market/`** (NEW) — `marketState.ts` (client mirror of the feed),
  `ticker.ts` + `marketFloor.ts` (the UI), `marketData.ts` (catalog load).
- **`shop.ts` / `trade.ts`** — generalized from scalar `coins` to `Wallet`
  (offer/request carry currency stacks; pricing in the merchant's local currency).

### 8.3 Catalog/CDN data (ships without an app release)
`content/economy/{currencies,goods,markets,events,rewardTables}.json` — bundled
fallback + CDN-overridable (the catalog-driven-everything pattern). New
currencies/goods/markets/events appear by editing data, no app build.

---

## 9. Migration (keep old saves valid)

- On load, if `wp:economy:v1` exists (old global single-Track scalar `coins`),
  migrate to `wp:econ:<defaultPairKey>:v2`: set
  `wallet = { [defaultCurrencyForScene]: coins }` (the moon coin's balance becomes
  the Track's default currency, 1:1 — `coin-base.baseValue = defaultCurrency.baseValue`
  so no value is lost). XP carries over to the badges store (`BADGES_PROGRESSION.md`).
  The bag (`b`) and `equipped` (`e`) carry over unchanged.
- `Reward.coins` (legacy challenge rewards still emitting a scalar) is read as
  `{ [defaultCurrency]: coins }` — old challenge code keeps working untouched.
- `coin-base` currency exists in the catalog *only* so legacy data resolves; it is
  never offered as a reward and never rendered with the moon glyph.
- Forward-compat: unknown currency ids in a save are dropped on load with a loud
  warn (same discipline as the existing catalog-drop logic), never crash.
- Version bump is additive; no breaking change to anyone on an old runtime (they
  just see the default currency).

---

## 10. Scaling math & launch-vs-scale numbers

### 10.1 Counts
| facet | launch | at scale (data-only growth) |
|---|---|---|
| currencies | ~12 | 50–80 (one+ per era/Scene; Tracks pick natives) |
| tradable goods | ~10 (reuse existing `trade-good`s) | 100–300 across markets |
| markets | 2–3 (colonial market, Tokyo, a global exchange) | dozens (one per Scene + global) |
| events | ~12 | hundreds (seasonal/quest-tied) |
| reward tables | ~6 (per Scene × tier) | hundreds (per quest/daily) |

All of the above are **catalog rows** → grow without an app release (catalog-v* on
CDN). The runtime is fixed-size; content scales.

### 10.2 Storage footprint per Track
- Wallet: `[currencyId, units]` pairs — even holding all ~80 currencies is < 2 KB.
- Bag + equipped: unchanged, few hundred bytes.
- Market positions (avg cost per held good): tens of held goods × small record < 2 KB.
- Trade/exchange history: capped ring buffer (last ~50), or moved to IndexedDB if
  it grows. Per-Track total comfortably < **8 KB localStorage** — well under the
  tens-of-KB per-pack budget (`corpan-pack-storage` memory). Big/volatile data (the
  live feed, sparkline history) is **in-memory only**, never persisted (it's
  server-authoritative / recomputable). 1–5 active Tracks ⇒ < 40 KB total.

### 10.3 Network footprint
- Feed broadcast: ~12–80 floats every 5–10s as binary Colyseus deltas (or one
  small SSE frame) — negligible. Sparklines are client-accumulated from the feed,
  not transmitted. The global-trades lane is a tiny rolling list.

---

## 11. Phased build plan (disjoint workstreams; which touch the server)

Each phase ships independently and degrades to solo. **All depend on the Track
keystone (#3).** Orchestrator-owned files (`game.ts`, `styles.css`, `inventory.ts`,
the contracts) serialize through one owner per merge window (additive diffs).

### Phase E0 — Multi-currency rewards + wallet (NO server)
**The moon dies here.** Currency catalog + `currencies.ts` + `decompose`/`format` +
`CurrencyArt` icon generator; `inventory.ts` → `Wallet`; `RewardTable` roll;
upgraded reward toast (smorgasbord) + Wallet HUD; migration (§9). **Exit:** a win
grants a varied currency spread rendered as physical denominations; old saves
migrate; no coin/moon anywhere. *Server: none.*

### Phase E1 — NPC exchange + simulated market maker (NO server)
`priceSim.ts` (offline-seeded) + `exchange.ts` (money-changer, spread) + a basic
**Market floor** (buy/sell goods vs. the AMM market-maker at `mid ± spread`) +
positions/P-L. **Exit:** solo player exchanges currencies + trades goods against a
living simulated price, watches a local ticker. *Server: none (offline sim).*

### Phase E2 — The premium ticker + global feed (TOUCHES SERVER)
Server `priceFeed.ts` + `MarketState` + `/feed` SSE; client feed mirror; the
premium **scrolling ticker** + sparklines + the anonymized global-trades lane;
event headlines (`events.json`). **Exit:** every online client watches the SAME
live global prices + trades; offline still works via the shared sim. *Server:
price feed + broadcast.*

### Phase E3 — Player↔player currency exchange + currency-trade (TOUCHES SERVER)
Generalize `trade.ts`/`shop.ts` to carry `Wallet` sides; server
`economyHandlers.ts` settles atomic mediated exchanges; velocity/wash caps;
offline-sign + reconcile. **Exit:** two humans agree a rate within the spread and
swap currency safely (menus-only). *Server: exchange settlement + anti-cheat.*

### Phase E4 — Player markets / limit order book (TOUCHES SERVER)
`MarketBook` schema + price-time matching + listing fees + fills → global lane.
**Exit:** players post/hit limit offers; a real (small) order book exists where
liquidity warrants; everything else still uses the AMM. *Server: matching engine.*

**Disjoint ownership:** E0 = inventory/currency owner; E1 = exchange/market-sim
owner; E2 = ticker-UI owner + server-feed owner (two workstreams meeting at the
feed contract); E3 = trade/mediation owner + server-settlement owner; E4 = order-book
owner. `priceSim.ts` is shared (one owner, both sides import). Contracts + `game.ts`
+ `styles.css` serialize through the orchestrator.

---

## 12. Open questions for the owner
1. **Common-Unit visibility:** keep the CU hidden (recommended — rates are always
   shown *between real currencies*) vs. ever surface a "world value" number?
2. **How aggressive is the feed?** Calm/slow (premium, low-stakes, recommended)
   vs. lively/volatile (more game-y, risks FOMO). Recommend calm with a per-Scene
   `volatility` so some scenes feel more "market."
3. **Order book scope:** is the AMM-only market (no player limit orders) acceptable
   indefinitely, or is the player-posted book a must-have? (Recommend AMM-first,
   book as a later multiplayer enrichment.)
4. **Weimar mark inclusion:** confirm the deliberately-inflationary novelty
   currency is wanted at launch (it's a great math/history beat but unusual).
5. **Default-currency-follows-Scene** vs. a single "home currency" per Track —
   recommend Scene-native default (richer), confirm.
```
