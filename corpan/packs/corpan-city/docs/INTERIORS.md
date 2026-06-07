# Corpan City — Enterable Building Interiors (R2-14)

> **Status:** Design only. No gameplay code in this doc. This is the spec a build
> agent fans out from (§9 phasing). It is built ENTIRELY on the shipped **vignette
> seam** (`src/vignettes/*`) — an interior is "just another vignette," exactly as
> `docs/VIGNETTES.md §6` already anticipated (café / bank / restaurant are listed
> "planned" there). R2-14 turns that roster line into a real, reusable subsystem.

**The ask (repeated owner request):** *"go inside some buildings and play out
different kinds of scenes inside."* A building on the street should have a **door
you can enter**; entering drops you into a **fullscreen interior scene** (a café,
a shop, a bank, a home…) where you **talk to interior NPCs, do a challenge, browse
and buy**; leaving returns you to the **street at the same door**.

**The thesis:** we do NOT build a new scene engine. The vignette host already owns
the enter → run → exit lifecycle, the pause/resume, the chrome recede, the
fullscreen mount, the universal Exit/ESC, and the injected services (Qwen3
`openNpc`, `runChallenge`, `wallet`, `grant`, `speak`, `t`, `iconRenderer`). The
taxi proves it end to end. R2-14 adds **(a)** a building→door portal binding,
**(b)** a small shared **interior scaffold** so the roster doesn't become seven
ad-hoc files, and **(c)** the data + localization to drive distinct interiors,
themeable per Scene/locale.

---

## 0. What already exists (read the code first)

R2-14 is mostly **a scaffold + data + roster**, because the spine is shipped:

| Concern | Where it lives today | Interior-readiness |
| --- | --- | --- |
| Enter→run→exit lifecycle, pause/resume, chrome recede, fullscreen mount, Exit/ESC | `src/vignettes/host.ts` (`createVignetteHost`, `registerRootHooks`) | **complete** — interiors are `VignetteFactory`s ✅ |
| The scene contract a vignette implements | `src/vignettes/types.ts` (`Vignette`, `VignetteContext`, `VignetteResult`) | **complete** — interiors implement it ✅ |
| Reference scene (framing + NPC tray + challenge beat + wallet + reward + juice) | `src/vignettes/taxi.ts` | **the template** for every interior ✅ |
| Injected services (NPC, challenge, wallet, grant, TTS, i18n, icons) | `VignetteContext` adapters | **complete** — interiors reuse all ✅ |
| The street door affordance (proximity prompt + Enter button) | `src/world/portalAffordance.ts` (`createPortalAffordance`, `PortalSpec`) | **complete** — a door IS a portal ✅ |
| Anchor typing (a building/door anchor) | `contracts/src/room.ts` (`AnchorKind` incl. `"portal"`) | needs an interior BINDING (§4) |
| Per-Scene skin (palette / place / era / mood) | `contracts/src/scene.ts` (`Scene.setting`, `.palette`, `.themeId`) | themes the interior (§4.2) ✅ |
| Localization (keyed catalog, native-locale, per-key EN fallback, RTL) | `src/i18n/strings.ts` (`I18nKey`, `t`), threaded into `VignetteContext.t` | interiors add an `interior.*` namespace (§6) ✅ |

**Two facts that make R2-14 small:**

1. **An interior is a `Vignette`.** It implements `enter(ctx) → VignetteResult`
   and resolves on exit. The host already does ALL the orchestration. We add zero
   new lifecycle code.
2. **The taxi already demonstrates every interior ingredient** — a framed scene,
   an `openNpc` conversation tray, a `runChallenge` beat, a `wallet.debit` payment,
   a `grant` reward, the arrival/juice. An interior is the taxi with a *room*
   instead of a *back seat*, and a `VignetteResult` with `rewards`/`questStep`
   instead of `travelTo`.

So R2-14 = **a building→door portal binding** + **a shared `createInterior(spec)`
scaffold** (so café/shop/bank are *data*, not seven hand-rolled DOM files) + **an
interior content data layer** + **the `interior.*` i18n namespace**.

---

## 1. Lifecycle — door → enter → interior → exit-at-the-same-door

The vignette host already gives us enter→run→exit. R2-14 specifies the **street
binding** (the door) and the **return** (exit at the same door).

```
   STREET (3D world)                         INTERIOR (fullscreen vignette)
   ┌──────────────────────┐   tap "Enter"    ┌────────────────────────────┐
   │  building facade      │ ───────────────▶ │ host.enter("interior:cafe",│
   │  + door (portal       │                  │   { anchorId: "cafe_door_3"})│
   │   affordance, §1.1)   │                  │  → createInterior(spec).enter│
   │                       │ ◀─────────────── │  run: NPC tray + challenge   │
   │  player re-spawns AT  │   Exit / Leave   │       + browse/buy + reward  │
   │  the same door (§1.3) │                  │  resolve VignetteResult      │
   └──────────────────────┘                  └────────────────────────────┘
```

### 1.1 The door is a portal affordance (reuse, don't reinvent)

A building's door is exactly the `PortalSpec` the taxi rank already uses
(`portalAffordance.ts`): proximity prompt + a ≥44px "Enter" button that swallows
its own pointer events (the joystick-steals-taps discipline). The only difference
is the **label** and **what it enters**:

- Taxi rank → `label: t("interior.cafe.enter")` ("Step inside") · `onEnter →
  host.enter("interior:cafe", { anchorId })`.
- The label + the vignette id come from the door anchor's **interior binding**
  (§4). The affordance code is untouched.

### 1.2 Enter (the host owns it)

`host.enter("interior:cafe", { anchorId: doorAnchorId })` runs the shipped
lifecycle verbatim (`host.ts §1`): guard one-at-a-time → `pauseWorld()` (halt sim
+ free the LLM) → recede chrome → create `.wp-vig-root` inside `.wp-overlay`
(NEVER body) → transition IN → build `VignetteContext` → run the interior →
transition OUT → `dispose()` → `resumeWorld()` → restore chrome → resolve. **No
new orchestration.**

### 1.3 Exit back to the SAME door (the one genuinely-new street rule)

The taxi is a *transit* — it resolves `{ travelTo: destinationAnchor }` so the
city re-spawns the player elsewhere. An **interior is the opposite**: you leave
exactly where you came in. Two clean ways, both already supported:

- **Default (recommended): no `travelTo`.** An interior resolves `{ rewards?,
  questStep? }` (no `travelTo`). The integration's existing rule —
  `if (result?.travelTo) movement.respawnAt(result.travelTo)` — simply doesn't
  fire, so **the player stays where they were** (right at the door). This is the
  `NO_TRAVEL` path the host already implements; an interior is the natural user
  of it. *Zero new code: an interior that never sets `travelTo` returns you to the
  door for free.*
- **Explicit (belt-and-suspenders):** the integration can `respawnAt(anchorId)`
  (the door's own anchor) after any interior exit, guaranteeing the camera faces
  the door even if the world drifted. Documented as an integration option, not
  required.

The interior's own "leave" is the host's **universal Exit/ESC** plus an in-scene
**door affordance** registered via `registerRootHooks(root, { exit, exitLabel:
t("interior.leave") })` — mirroring the taxi's `"Get out"`. So an interior is
leavable two ways (a visible in-scene door + the framework chevron), and both
resolve once through the same guarded `finish()`.

---

## 2. Interiors reuse the vignette host + openNpc + challenge host

This is the heart of "an interior is just another vignette." Every interior beat
maps to a service already on `VignetteContext` (`types.ts`):

| Interior beat | Reuses | How |
| --- | --- | --- |
| Talk to the barista / teller / shopkeeper | `ctx.openNpc(args)` | a real Qwen3 conversation mounted in the interior's dialogue tray; persona = the role's tone+quirks; TARGET-language TTS; scripted fallback with no LLM. Same as the taxi driver. |
| A purposeful language beat ("order it", "say the amount") | `ctx.runChallenge({ tool, ctx, container, npc })` | a centered challenge over the interior; the result's score scales the reward. Same path the taxi's `say-it-back` uses. |
| Pay the bill / buy an item / exchange money | `ctx.wallet()` (`balance`/`debit`/`defaultCurrency`) | physical-money debit in the Track's default currency; can't-afford degrades gracefully (a discount / "on the house"), never a wall. |
| Earn XP / currency / an item on success | `ctx.grant(reward)` | the `applyReward` path → HUD reveal + badges fire. |
| Speak a menu item / a greeting aloud | `ctx.speak(lang, text)` | host TTS in target. |
| Every visible string | `ctx.t(key, params)` | the keyed catalog, native locale, per-key EN fallback (§6). |
| Coins / item icons | `ctx.iconRenderer` | procedural, **zero emoji**. |

**The shopkeeper/teller is `openNpc`, not the world's wandering-NPC machinery.**
Like the taxi driver, an interior NPC is a *synthetic persona* (tone + quirks +
scriptedFallback), so it needs none of the quest-engine / special-NPC plumbing —
the orchestrator's existing `adaptOpenNpc` bind (`VIGNETTES.md §5`) covers it
unchanged. (An interior MAY host a *story* NPC by passing a stable `npcId` the
quest layer recognizes — but that's an enhancement, not the baseline.)

---

## 3. The shared interior scaffold — `createInterior(spec)`

If each interior were a bespoke file like `taxi.ts`, seven interiors = seven
hand-rolled DOM trees. Instead R2-14 adds ONE data-driven scaffold,
`src/vignettes/interior.ts`, that builds the common interior frame and runs a
declarative set of **stations**. Café/shop/bank/home become **specs**, not code.

### 3.1 What's common to every interior (the scaffold owns it)

- **The room frame** — a back wall + floor + a soft depth gradient + a warm
  light wash, all from `ctx.scene.palette` so the interior matches the world (HD-2D
  discipline: a painted backdrop, parallax-lite, never flat). One scoped
  `.wp-vig-interior-*` CSS block (namespaced like `.wp-vig-taxi-*`, never the
  shared sheet).
- **A counter/table** the NPC stands behind (the read-at-a-glance "this is a
  café").
- **The NPC** — a 2D paper-person billboard (reuse the `driverArt.ts` billboard
  approach generalized to a front-facing shopkeeper; see §8 art note), opened as a
  conversation tray via `ctx.openNpc`.
- **The in-scene door** (registered exit) + the framework Exit.
- **The reward/receipt payoff** + the two-note ding + reduced-motion path
  (lifted from the taxi).

### 3.2 The interior spec (the per-interior DATA)

```ts
// src/vignettes/interior.ts  (shape, not final code)
import type { Vignette } from "./types"

/** A declarative interior — café/shop/bank are just different specs. */
export interface InteriorSpec {
  /** vignette id ("interior:cafe") — what the door's portal enters. */
  id: string
  /** i18n key prefix for this interior's copy ("interior.cafe"). §6. */
  copyKey: string
  /** The NPC behind the counter. */
  host: {
    npcId: string                 // stable id → sticky per-NPC voice
    nameKey: string               // "interior.cafe.host" → "the barista"
    persona: { tone: string; quirks: string[] }
    scriptedFallbackKeys: string[]
    starterChipKeys?: string[]
  }
  /** The ordered stations the player can engage (see §3.3). At least one. */
  stations: InteriorStation[]
  /** Visual kit: which counter/backdrop motif + accent source. */
  look?: { motif?: "cafe" | "shop" | "bank" | "home" | string; accent?: string }
}

export function createInterior(spec: InteriorSpec): Vignette
```

### 3.3 Stations — the declarative interaction kit

A **station** is one thing the player can do inside, expressed as data so the
scaffold renders + runs it. The kit is small and composable; each maps to an
already-injected service:

```ts
export type InteriorStation =
  // ORDER / BUY — pick from a list (menu, shelf), a challenge earns it, pay, reward.
  | { kind: "order"
      labelKey: string                     // "interior.cafe.order" → "Order"
      items: InteriorItem[]                // menu/shelf entries (§4.3, corpus-fed)
      challengeTool?: string               // e.g. "say-it-back" — earns the purchase
      payFrom?: "wallet"                   // debit the price (default), or omit = free sample
    }
  // CONVERSE — a focused chat beat (the host asks something; pure openNpc).
  | { kind: "converse"; labelKey: string; promptKey?: string }
  // EXCHANGE — bank only: swap currencies (reuse economy/exchange).
  | { kind: "exchange"; labelKey: string }
  // TASK — a standalone challenge with a reward (a "quiz the menu" / "count change").
  | { kind: "task"; labelKey: string; challengeTool: string; reward?: InteriorReward }
  // REST — home only: a quiet beat (read a note, change clothes) → small reward.
  | { kind: "rest"; labelKey: string }
```

Each `InteriorItem` is `{ entryRef?, nameKey, price?, motif? }` — a menu/shelf
line. `entryRef` lets a menu line bind a **real corpus entry** (a food phrase),
so the challenge teaches the exact words (the café's "un café con leche" is a real
phrase, not invented copy) — §4.3.

**Why a station kit (not free-form per interior):** it keeps the roster *uniform*
(the scaffold handles layout, focus, the exit, the reward reveal) while the
*content* (which stations, which items, which challenge tool) is pure data —
authorable + CDN-overridable + localizable without new code. The taxi's "destination
picker → challenge → pay → reward" is structurally one `order` station; the café
is the same machine pointed at a menu.

### 3.4 The result an interior resolves

```ts
// café paid the bill + earned XP:   { rewards: { xp, items } }            (no travelTo)
// a shop purchase advanced a quest:  { rewards, questStep: "bought-bread" }
// just looked around, left:          {}  (NO_TRAVEL — back to the door)
```

Interiors **never** set `travelTo` (that's the transit family). The city's
existing `if (result?.travelTo)` guard therefore leaves the player at the door
(§1.3).

---

## 4. Data shape — how a building advertises an enterable interior

Three layers: the **door binding** (which building → which interior), the **Scene
theme** (how it looks per world), and the **interior content** (stations/items).

### 4.1 The door→interior binding (`content/interiors/doors.json` + an anchor tag)

A building becomes enterable when its door anchor carries an **interior binding**.
The anchor already supports `kind: "portal"` (`room.ts :: AnchorKind`); R2-14 adds
a small side-table keyed by anchor id (so the Room contract stays untouched — the
binding is pack content, not a contract change):

```jsonc
{
  "_doc": "Binds a building/door topology anchor to an enterable interior (R2-14). Keyed by the anchor id the city generates for that door. `interiorId` is the vignette id the door's portal enters; `enterLabelKey` localizes the street 'Enter' button. Absent anchors are simply not enterable (most buildings are scenery). CDN-overridable. `weight` lets the city pick how many of which interior to place when seeding a district.",
  "version": 1,
  "doors": {
    "cafe_door_3":  { "interiorId": "interior:cafe",  "enterLabelKey": "interior.cafe.enter" },
    "shop_door_1":  { "interiorId": "interior:shop",  "enterLabelKey": "interior.shop.enter" },
    "bank_door_2":  { "interiorId": "interior:bank",  "enterLabelKey": "interior.bank.enter" }
  },
  // For PROCEDURAL placement: when a district is generated, the city assigns
  // interiors to a fraction of building doors by these weights (so a plaza has a
  // few cafés, one bank, some shops) — no hand-authoring every anchor.
  "placement": {
    "interior:cafe": { "weight": 4, "enterLabelKey": "interior.cafe.enter" },
    "interior:shop": { "weight": 3, "enterLabelKey": "interior.shop.enter" },
    "interior:bank": { "weight": 1, "enterLabelKey": "interior.bank.enter" },
    "interior:home": { "weight": 2, "enterLabelKey": "interior.home.enter" }
  }
}
```

- **Explicit `doors` rows** pin a known anchor to a known interior (authored
  Scenes). **`placement` weights** drive procedural assignment for generated
  districts (most buildings stay plain scenery; a curated fraction get doors).
  Either way the city ends with a set of `(doorAnchorId → interiorId, label)`
  bindings it turns into `PortalSpec`s.
- **Day-one-works:** an anchor with no binding is just a building you can't enter
  (the common case). Adding interiors is pure upside, never a prerequisite — the
  same discipline as R2-6's `_default`.

### 4.2 Themeable per Scene — the interior reskins with the world

The interior reads `ctx.scene` (already injected), so the SAME `interior:cafe`
spec renders era-correct per world WITHOUT a new spec:

- **Accent / palette** from `scene.palette.accent` (the host already passes it as
  `--vig-accent`).
- **Currency** is the Track's default (the café's prices are quoted in reales in
  Antigua, yen in Tokyo) — `ctx.wallet().defaultCurrency()`, no per-interior config.
- **Motif** (`look.motif`) + a per-Scene override let a Scene swap the café's
  backdrop/props token ("antigua-cafe" vs "tokyo-cafe") the same way
  `Scene.buildingStyle` switches facades — a forward hook; the procedural backdrop
  is the default.
- **NPC dress** comes from the persona/era via the existing character system
  (the front-facing host billboard is themed like any crowd NPC).

So "café in Antigua" and "café in Tokyo" are ONE spec + the live Scene — the
reskin axis is the Scene, exactly as `CONTENT_SCALE §0.4` mandates.

### 4.3 Interior content — stations + items (`content/interiors/<id>.json`)

Each interior's stations/items live in a small JSON, localizable + corpus-bound:

```jsonc
// content/interiors/cafe.json
{
  "_doc": "The café interior content (R2-14). The host persona + the stations the player can do inside. Menu items bind REAL corpus entries (entryRef) so the order challenge teaches the exact target-language phrase; copy flows through the interior.* i18n namespace (§6). Prices are MINOR units of the Track's default currency. CDN-overridable.",
  "id": "interior:cafe",
  "copyKey": "interior.cafe",
  "host": {
    "npcId": "cafe-barista",
    "nameKey": "interior.cafe.host",
    "persona": { "tone": "a warm neighborhood barista who loves a regular", "quirks": ["recommends the day's special","counts your change aloud","wishes you a good morning"] },
    "scriptedFallbackKeys": ["interior.cafe.fallback.greet","interior.cafe.fallback.offer","interior.cafe.fallback.prompt"]
  },
  "stations": [
    { "kind": "order", "labelKey": "interior.cafe.order", "challengeTool": "say-it-back", "payFrom": "wallet",
      "items": [
        { "entryRef": "corpus:food.coffee_with_milk", "nameKey": "interior.cafe.item.coffee", "price": 120, "motif": "cup" },
        { "entryRef": "corpus:food.fresh_bread",      "nameKey": "interior.cafe.item.bread",  "price": 80,  "motif": "bread" }
      ]
    },
    { "kind": "converse", "labelKey": "interior.cafe.chat", "promptKey": "interior.cafe.chatPrompt" }
  ],
  "look": { "motif": "cafe" }
}
```

`entryRef` is resolved by the orchestrator's existing entry/corpus access (the
challenge already takes a `ChallengeContext` that can bind an entry); the interior
spec only carries the *reference*, keeping the scaffold corpus-agnostic.

---

## 5. The interior roster

Each is the SAME `createInterior(spec)` machine — a persona, a station set, a
look. (Mirrors `VIGNETTES.md §6`, now concretized.)

| interior | host NPC | signature stations | result |
| --- | --- | --- | --- |
| **café** (first, §7) | barista | `order` (menu, `say-it-back`, pay) + `converse` | `rewards` |
| **shop / market** | shopkeeper | `order`/buy goods (browse a shelf) + `task` (haggle/count) | `rewards`, maybe `questStep` |
| **bank** | teller | `exchange` (reuse `economy/exchange`) + `task` (read the amount) | `rewards` |
| **home** | (none / a note) | `rest` (read a letter, change clothes) + `converse` | `rewards`/`questStep` |
| **restaurant** | waiter | multi-course `order` chain + `converse` + pay the check | `rewards` |
| **post office** | clerk | `task` (address a letter — quest delivery) + pay postage | `questStep` |

All seven (with the taxi/bus/subway transit family) share the vignette host;
interiors share `createInterior`. "An arbitrary new place" = a new spec JSON +
its `interior.*` strings + a door binding. **No new orchestration, no new chrome.**

---

## 6. Localization — interior copy flows through the keyed catalog

Every interior string goes through the SAME seam as all chrome
(`src/i18n/strings.ts`): a keyed catalog, resolved in the learner's **native**
language, with a **per-key English fallback** and **RTL** support. The interior's
`ctx.t` is already bound to that resolver by the host (`VIGNETTES.md §5`,
`t: (key, params) => t(key, immersion.uiLocale(), params)`).

**The plan (coordinate with the localization foundation, task #11 / `src/i18n`):**

1. **Add an `interior.*` key namespace** to `I18nKey` + the `en` source-of-truth
   dict in `strings.ts` (e.g. `interior.leave`, `interior.cafe.enter`,
   `interior.cafe.host`, `interior.cafe.order`, `interior.cafe.item.coffee`,
   `interior.cafe.fallback.greet`, …). English is the source of truth; the
   generated locales fill the rest via the existing `tools/gen_i18n.py` flow.
2. **The two language axes stay distinct** (the taxi already gets this right):
   - **Chrome copy** ("Order", "Leave", "the barista", item *labels* the player
     reads) → **native** language (the language they KNOW), via `ctx.t`.
   - **What the NPC SPEAKS + what a challenge drills** → **target** language
     (`learnerPair.target`), via `ctx.speak(target, …)` / `runChallenge` with the
     target `ChallengeContext`. A menu item's *taught phrase* is the corpus
     entry's target text; its *gloss label* is the native `nameKey`.
3. **No hardcoded copy, ever.** Like the taxi's inline-fallback pattern
   (`t(key, fallback, params)`), an interior may carry a self-contained English
   fallback per key so it runs standalone before a LOCALE row exists — but the
   production string always resolves through the catalog.
4. **RTL** is automatic: the pack root already gets `dir="rtl"` for RTL natives
   (`applyDir`), and the interior CSS uses logical properties (the `.wp-vig-*`
   convention), so an Arabic learner's café mirrors correctly.

This makes interior content **localize in ~50 languages by construction**, with no
per-interior i18n code — the foundation task #11 is building is exactly the carrier.

---

## 7. The café, speccable end-to-end (the first interior)

The proof-of-seam, the way the taxi proved transit. Built as `createInterior` +
`content/interiors/cafe.json` + the `interior.cafe.*` strings.

**Enter:** the player is near a café door on the street → the portal affordance
shows `t("interior.cafe.enter")` ("Step inside") → tap → `host.enter("interior:cafe",
{ anchorId: "cafe_door_3" })`.

**The scene:** a warm interior frame (back wall + counter + a soft morning wash
from `scene.palette`), a barista paper-person behind the counter (front-facing
billboard, idle sway, drop shadow — HD-2D, never paper-thin). A lower dialogue
tray holds the real Qwen3 barista (`ctx.openNpc`, target-language TTS, scripted
fallback). A small menu board lists the day's items (from `cafe.json`, each an
icon + native label + price in the Track's currency).

**The beat (one `order` station):** tap an item → the barista acknowledges in the
**target** language (`ctx.speak`) → a `say-it-back` challenge earns the order
(drills the real corpus phrase, e.g. "un café con leche") → on success, **pay the
price** from the wallet (`ctx.wallet().debit`, can't-afford → "on the house," never
a wall) → a receipt/cup-pop + the two-note ding → `ctx.grant({ xp, items:
["cup-of-coffee"] })` (real catalog id) fires the HUD reveal + badges.

**Converse station:** tap "Chat" → a focused `openNpc` beat (the barista asks how
your morning is) — pure conversation, no purchase.

**Exit:** the in-scene door (registered `registerRootHooks` exit, label
`t("interior.leave")`) OR the framework chevron → resolve `{ rewards }` (NO
`travelTo`) → the host transitions out, resumes the world, restores chrome → the
player is **back on the street at the café door** (§1.3).

**Standalone-playable:** like the taxi, the café runs against trivial stubs (a
demo menu, inline English fallbacks) so it's testable with no orchestrator, then
the integration injects the real corpus menu + door bindings.

---

## 8. Notes the build agent must respect (hard-won)

- **NEVER `document.body`** — interiors mount inside `ctx.mountRoot` (already
  inside `.wp-overlay`); the host clips body-fixed modals (`GAME_DEV_PLAYBOOK §4.2`).
- **Scoped CSS only** — one injected `.wp-vig-interior-*` block; never touch the
  shared `styles.css`. (And never `.wp-vignette` — that's the unrelated color-fx div.)
- **Joystick-steals-taps** — the street door button already swallows its pointer
  events (`portalAffordance.ts`); any in-scene buttons follow the same rule.
- **One resolve** — every exit path (in-scene door, framework Exit, ESC, a station
  completing) routes through a single guarded `finish()` (the taxi's `settled`
  pattern). Resolve `enter` exactly once; do NOT remove `mountRoot` (the host owns
  removal).
- **Front-facing host billboard** — the taxi's `driverArt.ts` draws the driver
  from BEHIND. An interior NPC faces the player; the build adds a small
  front-facing variant (or reuses the crowd character art via a billboard) behind
  the same "never paper-thin: idle sway + drop shadow" discipline. This is the one
  net-new art piece; everything else is reuse.
- **Zero emoji in premium surfaces** — coins/items via `ctx.iconRenderer`; the taxi
  passing `avatar: "🚕"` to a challenge card is the lone exception (a tiny
  encounter glyph) and interiors should prefer an `iconRenderer` motif there too.
- **Reduced-motion** — gate the ding + any non-essential motion on
  `ctx.reducedMotion` (the taxi pattern).
- **No `window.confirm/alert`** — in-pack affordances only (project rule).

---

## 9. Phased build plan

Each phase is independently shippable and leaves the pack working.

### Phase 0 — The interior scaffold (no street wiring)
- Add `src/vignettes/interior.ts` (`createInterior(spec)`) + the
  `InteriorSpec`/`InteriorStation`/`InteriorItem` types + scoped `.wp-vig-interior-*`
  CSS. Implement the room frame, the front-facing host billboard, the station
  renderer for `order` + `converse`, the reward/receipt payoff (lift the taxi's).
- It runs against the SAME stub services the taxi uses (standalone-playable).
- **Outcome:** `createInterior(cafeSpec)` is a registerable `VignetteFactory`,
  testable in isolation. No street/world change yet.

### Phase 1 — The café, end-to-end (§7)
- Author `content/interiors/cafe.json` (demo menu + inline-fallback copy) and the
  `interior.cafe.*` + `interior.leave` keys in `strings.ts` (English source).
- A unit/render test: enter → order → challenge (stubbed) → pay → grant → exit
  resolves `{ rewards }` with no `travelTo`.
- **Outcome:** the café is a complete, standalone-playable interior — the proof
  the taxi was for transit.

### Phase 2 — Street binding (door → interior)  *[hand-off to integration]*
- The door→interior side-table (`content/interiors/doors.json`) + the city wiring:
  for each enterable door anchor, build a `PortalSpec` whose `onEnter` calls
  `host.enter(interiorId, { anchorId })`; on exit, the existing `travelTo` guard
  leaves the player at the door (optionally `respawnAt(anchorId)`).
- Register the café in `registerBuiltinVignettes` alongside the taxi.
- **Outcome:** you can walk to a café door and go inside in the real world.
- *(I keep this phase as a documented integration snippet — `game.ts`/world wiring
  is owned at integration, like the R2-6 resolveEntry hand-off.)*

### Phase 3 — Roster: shop, bank, home (data, mostly)
- Add `interior:shop` / `interior:bank` / `interior:home` specs + content + strings.
  Bank reuses `economy/exchange`; shop reuses `order`/buy; home adds the `rest`
  station. Each is a spec JSON + its `interior.*` keys + a placement weight — almost
  no new code beyond any net-new station kind.
- **Outcome:** a district of enterable places, all on one scaffold.

### Phase 4 — Per-Scene reskin + CDN content
- Per-Scene motif overrides (antigua-cafe / tokyo-cafe backdrops) behind the
  `look.motif` hook; CDN-push new interiors/menus without an app release.
- **Outcome:** interiors reskin with the world; content scales via the catalog.

---

## 10. File/Seam summary (for the build agent)

| New / changed | Path | Role |
| --- | --- | --- |
| **new** | `src/vignettes/interior.ts` | `createInterior(spec)` scaffold + station kit (a `Vignette`) |
| **new** | `content/interiors/cafe.json` (then shop/bank/home) | per-interior persona + stations + items (corpus-bound, localizable) |
| **new** | `content/interiors/doors.json` | door-anchor → interior binding + procedural placement weights |
| change | `src/i18n/strings.ts` | add the `interior.*` key namespace + `en` source (coordinate w/ task #11) |
| reuse | `src/vignettes/host.ts`, `types.ts`, `taxi.ts` | the lifecycle + contract + reference template — **unchanged** |
| reuse | `src/world/portalAffordance.ts` | the door affordance — **unchanged** (new label + onEnter only) |
| wire (integration) | `game.ts` / world seeding | build door `PortalSpec`s; `host.enter(interiorId, {anchorId})`; leave-at-door |

**The throughline:** an interior is a `Vignette`; the host already runs it. R2-14
adds a door→interior binding, ONE shared `createInterior` scaffold so the roster is
*data*, an interior content layer that binds real corpus phrases, and the
`interior.*` i18n namespace — and you can walk into a café, order in the target
language, pay, and step back out to the same door, all on seams the pack already
shipped.
