# Corpan City — Pair Identity (R2-6)

> **Status:** Design only. No gameplay code in this doc. This is the spec a
> build agent fans out from (§8 phasing). It extends the existing identity /
> avatar / cosmetic / inventory / Track systems — it does **not** replace them.

**The ask (R2-6):** each language **pair** should invite a *different* character —
potentially a different **name**, a different **wardrobe**, and a different
**starting inventory**. Walking into a fresh `(native → target)` Track should
feel like stepping into a *new persona for a new world*, not re-skinning the
same paper doll.

**The mandate, the World-Plaza way:** do it **data-driven + seed-deterministic +
combinatorial**, scaling toward all **2,450 pairs** (50 langs × 49 others +
50 immersion) without hand-authoring each one, reusing every seam that already
exists, and keeping the **safety invariant** absolute: names are composed from
**curated, fixed lists only** — never freeform, never identifying, always
kid-safe (`content/identity/names.json` `_doc`, `WORLD_DIRECTION.md:127`).

---

## 0. What already exists (read the code first)

Pair Identity is mostly **wiring + one new data layer**, because the spine is
already built. The pieces:

| Concern | Where it lives today | Pair-awareness today |
| --- | --- | --- |
| Composed safe name | `src/onboarding/onboarding.ts` (`rollName`), `content/identity/names.json` | **none** — one global English `Adjective Noun` pool |
| Avatar / dress-up | `runOnboarding` step 2 + `content/cosmetics/starter.json` | **none** — one global starter kit |
| Render-ready body | `src/character/characterSpec.ts` (`CharacterSpec`, `avatarToCharacterSpec`) | n/a — shape only |
| Deterministic look generator | `src/character/characterGen.ts` (`generateCharacter(role, seed, theme)`, `WardrobeTheme`, `ANTIGUA_1770`) | theme-driven; **not yet pair-keyed** |
| Persona / archetype generator | `src/npc/personaGen.ts` (`Archetype`, FNV-1a + mulberry32) | scene-driven; **not yet pair-keyed** |
| Starting wallet + bag + equipped | `src/economy/inventory.ts` (`createInventory`, `Reward`, catalog) | per-Track *storage* exists; **no seeded starter grant** |
| Currency by world | `src/economy/currencies.ts` (`defaultCurrencyForScene`) | scene-tag driven (place/era), already great |
| **Per-pair save envelope** | `contracts/src/track.ts` (`TrackState`, `TrackId = native:target`) | **owns `identity` + `avatar` per Track already** ✅ |
| Pair derivation from the live stack | `src/entry/stackAdapter.ts` (`LearnerPair`, `pairFor`), `src/entry/index.ts` (`resolveEntry`) | derives `{target, native}` from `getStackConfig()` ✅ |

**Two facts that make R2-6 small:**

1. **`TrackState` already carries `identity` + `avatar` per `(native, target)`**
   (`contracts/src/track.ts:83-85`). "Different name + different dress per pair"
   is *already storable*; what's missing is a **seeded default** so a *fresh*
   Track of a given pair is born with a distinct, on-theme persona instead of
   the same global onboarding default.
2. **Every generator already takes `(role/kind, seed, theme)`** and is FNV-1a +
   mulberry32 deterministic (`CONTENT_SCALE.md §0.1`). The pair just becomes a
   **new seed namespace + a new theme selector**. No new generator family.

So R2-6 = **(a)** a `PairProfile` resolver `{target, native} → { themeId,
namePoolId, starterKitId, starterGrantId }`, **(b)** a *culturally-themed name
pool* data layer keyed by language, **(c)** a *seeded starter persona* that fills
a fresh `TrackState` (name + avatar + wallet/bag), all behind the existing
onboarding/inventory/Track seams.

---

## 1. The cultural question — name pools keyed to the TARGET (decided)

> *"culturally appropriate to the TARGET or the native? decide + justify."*

**Decision: the persona is themed to the TARGET language's world, with one
deliberate exception (immersion / single-language stacks, §1.3). Names are drawn
from a curated pool selected by the TARGET; the native only colours the *gloss*,
never the persona.**

### Why TARGET, not native

- **The fiction is "you travel *into* the target's world."** A `en→es` learner
  walks into Antigua's plaza; a `en→ja` learner walks into a Tokyo market. The
  Scene, currency (`defaultCurrencyForScene` already keys on place/era), NPC
  speech, and quests are all *target-flavoured*. A persona named "Brave Otter"
  (generic English) standing in 1770 Antigua is a tonal seam; a persona drawn
  from a **Spanish-flavoured friendly-nickname pool** belongs there.
- **It makes each pair feel like a different character — which is the literal
  ask.** If we keyed on the native, all of one user's Tracks (`en→es`, `en→ja`,
  `en→ko`) would share an English name pool and feel same-y. Keying on the
  target means each new target = a visibly new persona, *for free*.
- **It reinforces the learning frame.** Being greeted as a target-flavoured
  nickname in the target's world is a tiny, dignified immersion cue — consistent
  with `IMMERSION_TOGGLE.md` and the per-Track `immersion` setting already on
  `TrackState`.

### The hard safety guardrail (non-negotiable)

"Culturally appropriate to the target" does **NOT** mean *real first/last names
of that culture*. That path is unsafe (identifying, stereotyping, mispronounced,
moderation nightmare) and violates the existing `names.json` contract. Instead:

- We keep the **`Adjective + Noun` storybook-nickname** construction (the proven
  safe-by-construction shape — `identity.ts :: GeneratedIdentity.nameSeed`).
- We **localize the *words*** of that pool per language using the **same
  per-locale override pattern** the whole pack already uses
  (`LOCALIZATION_SCALE.md`): the *structure* (adjective + noun + optional number)
  is language-agnostic; the *vocabulary* is a curated, reviewed, on-theme word
  set per language. "Brave Otter" → "Valiente Nutria" (es) → "勇敢なカワウソ" /
  a kana-friendly equivalent (ja), etc.
- Every word in every pool is **hand-curated + reviewed** to the same bar as the
  English list: wholesome, global, non-identifying, no places, nothing edgy
  (the `names.json` `_doc` bar). A native-speaker / model review gate is part of
  the pipeline (§8.4), never an unreviewed MT dump.

So: **persona theme = target; name construction = the same safe Adjective+Noun;
name vocabulary = a curated per-target pool; native = gloss only.**

### 1.3 The immersion / single-language exception

`SINGLE_LANGUAGE_RULE.md`: a one-language stack is `target === native` (e.g.
`es:es`). There is no "other" world to travel into — the user is practising
*their own* language (immersion, native-literacy, a child learning to read).
Here the target IS the native, so "theme to the target" naturally resolves to
"theme to that one language," which is correct: an `es:es` Track gets the
Spanish-flavoured pool, an immersion persona at home in a Spanish plaza. No
special case needed beyond what `isImmersion(pair)` / `isImmersionTrack(id)`
already express — the resolver (§3) keys on `target`, and `target === native`
falls out for free.

---

## 2. Data schema

Three small JSON layers + one tiny code resolver. All CDN-overridable (the pack
already ships a SHA-256-verified two-zip installer; new pools = a catalog push,
**no app release** — `CONTENT_SCALE.md §0.5`).

### 2.1 `content/identity/pairProfiles.json` — the language → persona map

The **one genuinely-new lookup**: maps a *language* (BCP-47 corpus code, the
same `LanguageCode` everything else uses) to its persona ingredients. Keyed by
**target language**, because §1 themes the persona to the target.

```jsonc
{
  "_doc": "Maps a TARGET language (BCP-47 corpus code) to its persona profile: which name pool, wardrobe theme, and starter kit a fresh Track of that target is born with. Pair Identity (R2-6). Resolved by src/identity/pairProfile.ts. CDN-overridable. Defaults (`_default`) cover any target with no explicit row, so 2,450 pairs work day one and rows are added as a QUALITY upgrade, never a prerequisite.",
  "version": 1,

  // Fallback used for any target language with no explicit entry. This is what
  // makes the whole 2,450-pair space work on day one — every pair resolves.
  "_default": {
    "namePoolId": "pool-universal",     // the curated, language-neutral fallback pool
    "themeId": "antigua-1770",          // the shipping WardrobeTheme (characterGen)
    "starterKitId": "kit-traveler",     // which cosmetic starter set (§2.3)
    "starterGrantId": "grant-traveler"  // which seeded wallet+bag grant (§2.4)
  },

  // Explicit rows = QUALITY upgrades for the most-used targets, added over time.
  "targets": {
    "es": { "namePoolId": "pool-es", "themeId": "antigua-1770", "starterKitId": "kit-market",   "starterGrantId": "grant-market" },
    "ja": { "namePoolId": "pool-ja", "themeId": "tokyo-2050",    "starterKitId": "kit-tokyo",    "starterGrantId": "grant-tokyo" },
    "zh": { "namePoolId": "pool-zh", "themeId": "changan-tang",  "starterKitId": "kit-silkroad", "starterGrantId": "grant-silkroad" }
    // …added incrementally; everything else falls through to `_default`.
  }
}
```

Notes:
- **`themeId` is a soft hint, not the source of truth.** The *world* (Scene) and
  its currency are chosen by the existing Scene/curriculum + `defaultCurrencyForScene`
  pipeline. `themeId` here only seeds the persona's *wardrobe* (so the player's
  dress is era-coherent with the world they'll enter) and matches an existing
  `WardrobeTheme` id from `characterGen.ts` (`antigua-1770` today; `tokyo-2050`,
  `changan-tang` as Theme bundles land). Absent / unknown → `_default.themeId`.
- **No row required to function.** A target with no entry uses `_default`,
  yielding the universal pool + shipping theme. Rows are added *to make a popular
  target feel bespoke*, never to make a pair *work*. This is the §0.5 "data, not
  prerequisites" discipline.

### 2.2 Name pools — `content/identity/names.json` extended (not replaced)

The current `names.json` is one global `{adjectives, nouns}`. Extend it to a
**multi-pool** shape, with the existing global lists becoming `pool-universal`
so nothing breaks and the fallback is the proven-good English set:

```jsonc
{
  "_doc": "Safe-by-construction display-name pools for Corpan City. Names compose as `<Adjective> <Noun>` (+ optional number) — the SAME construction across every pool (R2-6 §1). `pool-universal` is the fixed, reviewed, language-neutral fallback (the original global list). Per-language pools localize the WORDS only; the structure never changes. Every word is curated to the same bar: wholesome, global, non-identifying, no real names/places, kid-safe.",
  "schemaV": 2,

  "pools": {
    "pool-universal": {
      "adjectives": [ { "id": "adj-brave", "label": "Brave" }, /* …the existing list… */ ],
      "nouns":      [ { "id": "noun-otter", "label": "Otter" }, /* …the existing list… */ ]
    },
    "pool-es": {
      // Same IDS where the concept maps 1:1 (so a name SEED is stable across
      // pools when possible — see §4 on nameSeed portability), localized labels.
      "adjectives": [ { "id": "adj-brave", "label": "Valiente" }, { "id": "adj-sunny", "label": "Soleado" } /* … */ ],
      "nouns":      [ { "id": "noun-otter", "label": "Nutria" }, { "id": "noun-lantern", "label": "Farol" } /* … */ ]
    }
    // pool-ja, pool-zh, … added as curated bundles.
  }
}
```

Key design choices:
- **Shared IDs, localized labels.** Where an adjective/noun concept exists in
  multiple pools, it reuses the *same `id`*. The persisted `nameSeed` (`{adjId,
  nounId, numId}` on `GeneratedIdentity`) therefore stays meaningful, and a name
  can be *re-rendered* into the active pool's labels (the §4 portability win:
  read your `es` Track in a different UI language and the nickname still resolves).
- **Pools may be SUPERSETS or SUBSETS.** A per-language pool needn't be a 1:1
  translation of the universal list; it can drop concepts that don't localize
  cleanly and add culturally-resonant ones (with new ids). The resolver always
  has the universal pool to fall back to for any missing id.
- **Migration is loud-but-safe** (the `inventory.ts` discipline): a `schemaV:1`
  (old flat) `names.json` is read as `{ pools: { "pool-universal": <the flat
  lists> } }`. No data lost; one console line.

### 2.3 Starter cosmetic kits — `content/cosmetics/starter.json` → keyed kits

Today `starter.json` is one global `{ items: [...] }`. Generalize to **named
kits**, with the current set becoming `kit-traveler` (the universal default):

```jsonc
{
  "_doc": "Free starter dress-up KITS for Corpan City onboarding. Each kit is the cosmetic palette a fresh Track of a given target is born able to wear (CosmeticItem[] — contracts/src/identity.ts). `kit-traveler` is the universal default (the original starter set). Per-theme kits (kit-market, kit-tokyo, …) swap the garment vocabulary + tints to the world's era so the player's paper self is dressed FOR the world they enter. All items remain unlock.kind=xp value=0 (free from start). Wholesome + dignified only.",
  "schemaV": 2,
  "kits": {
    "kit-traveler": { "items": [ /* …the existing 8 items… */ ] },
    "kit-market":   { "items": [ /* tunic/huipil/rebozo tints biased Antigua-warm */ ] },
    "kit-tokyo":    { "items": [ /* sleeker silhouettes, neon-cool tints */ ] }
  }
}
```

- **Every kit is still all-free, all-wholesome** — a *palette swap*, not a
  paywall. The free tier stays generous + permanent (the project monetization
  principle). Premium cosmetics remain a *separate* unlock axis (`CosmeticUnlock`
  `kind:"premium"`), untouched by R2-6.
- **The dress-up UI is unchanged** — `runOnboarding` step 2 simply iterates the
  resolved kit's `items` instead of the hardcoded `STARTER`. Slots (`top/hat/
  accessory`) and the `bySlot` chip rows are identical.
- **A kit references the same `CosmeticItem` shape** that the inventory catalog
  + `equip()` already understand, so an equipped starter garment is the same kind
  of thing an NPC wears (`characterSpec.ts` one-character-model note).

### 2.4 Starter inventory grants — `content/economy/starterGrants.json` (new)

The "different starting inventory" half. A **grant** is a tiny seed bundle a
fresh Track receives once, expressed as the **existing `Reward` shape**
(`src/economy/inventory.ts :: Reward`) so it flows through `applyReward()` with
zero new economy code:

```jsonc
{
  "_doc": "Seeded starting inventory per starter kit/world (R2-6). Each grant is a Reward (src/economy/inventory.ts): xp + currency (multi-currency minor units) + item ids (looked up in content/items/catalog.json). Applied ONCE to a fresh Track via inventory().applyReward(). Currency ids must exist in content/economy/currencies.json; item ids in the item catalog. Grants are MODEST + dignified (a small pouch + a couple of useful items), never pay-to-win.",
  "version": 1,
  "grants": {
    "grant-traveler": { "currency": { "gold-real": 300 }, "items": ["consumable-travel-snack"], "xp": 0 },
    "grant-market":   { "currency": { "gold-real": 500 }, "items": ["tool-market-basket"], "xp": 0 },
    "grant-tokyo":    { "currency": { "jpy-yen": 2000 },  "items": ["consumable-bento"], "xp": 0 }
  }
}
```

- **Currency matches the world.** `grant-tokyo` seeds yen, `grant-market` seeds
  reales — the same currencies `defaultCurrencyForScene` will mint for that
  world, so the starter pouch is *already the right money* when the player walks
  in. (If a grant's currency and the resolved Scene currency disagree, the Scene
  wins for *rewards*; the grant is only the *opening balance*.)
- **Modest + dignified.** A small pouch and one or two useful, on-theme items —
  never a pay-to-win head start. This keeps the economy's earned-progression feel
  intact (`ECONOMY_CURRENCY.md`).
- **Validated at load** (the `starter.json` discipline): every `currency` id is
  checked against `getCurrency()`, every item id against the catalog; unknowns
  are dropped with a loud warn, never crash.

---

## 3. Selection at entry — the resolver + where it plugs in

A tiny new module, `src/identity/pairProfile.ts`, owning *only* the lookup. It
imports nothing from `game.ts`; it's a pure data adapter like `stackAdapter.ts`.

```ts
// src/identity/pairProfile.ts  (shape, not final code)
import type { LearnerPair } from "@corpan-city/contracts"

export interface PairProfile {
  namePoolId: string
  themeId: string         // a WardrobeTheme id known to characterGen
  starterKitId: string
  starterGrantId: string
}

/** Resolve a pair → its persona profile. Keys on TARGET (§1); always returns a
 *  profile (falls back to `_default`), so every one of the 2,450 pairs works. */
export function profileForPair(pair: LearnerPair): PairProfile
```

### The entry flow (extends `resolveEntry`, `src/entry/index.ts`)

`resolveEntry` already produces the session's `learnerPair`. R2-6 hangs off it:

1. `resolveEntry()` → `learnerPair` (existing).
2. The Track layer (`LANGUAGE_PAIR_STATE.md §2`) looks up / creates the
   `TrackState` for `trackId(native, target)`.
3. **If the Track is FRESH** (no stored `identity`/`avatar`): build the **seeded
   default persona** (§3.1) from `profileForPair(pair)`, write it into the new
   `TrackState.identity` + `.avatar`, and apply the starter grant **once** to
   that Track's inventory (`bindInventory(track.inventory)` then `applyReward`).
4. **If the Track EXISTS:** load its stored persona — the player's *own* choices
   from a previous visit win. R2-6 only ever sets the *birth* state.
5. Onboarding (`runOnboarding`) is shown **only for a fresh Track** (or on
   explicit "remake my character"), and it is *pre-seeded* from the profile: the
   name roller's opening roll uses the resolved name pool, the dress-up is the
   resolved kit, so even before the player touches anything they see an on-theme
   persona. Reroll / Skip behave exactly as today, now within the pair's pool.

### 3.1 The seeded default persona (no UI required)

For Skip-flows, multi-Track auto-creation, and the pre-seed, we need a *valid
default persona for a pair with zero interaction*. This is `defaultIdentity()`
(`onboarding.ts:561`) generalized to take a pair:

- **Name:** `rollName()` but drawing from the resolved pool, **seeded** by
  `trackId` (FNV-1a + mulberry32, the house PRNG) so a given pair always opens on
  the *same* default nickname (stable across reloads, like every NPC). The
  player can reroll; the seed only fixes the *opening* roll.
- **Avatar:** reuse **`generateCharacter(role:"traveler", seed: trackId, theme:
  profile.themeId)`** to get an on-theme `CharacterSpec`, then map it down to the
  broadcast `AvatarSpec` (the inverse of `avatarToCharacterSpec` — a small
  `characterSpecToAvatar`, the one genuinely-new mapping helper; the player's
  in-world body already round-trips the other direction). Net: the player's
  default look is *generated by the same engine that dresses the crowd*, themed
  to their target's world, from a pair-stable seed. This is the §0.2
  "combinatorial, not a giant list" win applied to the *player*.
- **Inventory:** `applyReward(profile starterGrant)` once.

Result: **a fresh `(native, target)` Track is born with a distinct,
pair-themed name + dress + pouch, with no hand-authoring and no required UI.**

---

## 4. Ties into per-Track state (the keystone)

This is where R2-6 is *already* mostly free, because `LANGUAGE_PAIR_STATE.md`
built the envelope:

- **Persona lives on `TrackState`.** `identity` + `avatar` are already per-Track
  fields (`contracts/src/track.ts:83-85`). R2-6 adds *the seeded birth values*,
  not a new store. Switching Tracks (the picker) already swaps persona for free.
- **Inventory is already per-Track** (`inventory.ts` `binding` namespace,
  `wp:track:{id}:economy`). The starter grant lands in *that* Track's wallet/bag
  via the existing `applyReward`. No cross-pair bleed: your `en→ja` yen and your
  `en→es` reales are separate envelopes, exactly as the doc intends.
- **Badges / progression are already per-Track** (`wp:track:{id}:badges`), so
  "a different character per pair" extends naturally to a different *progression*
  per pair — no R2-6 work needed.
- **The denormalized registry headline** (`TrackHeadline.headline.displayName`)
  already paints the picker without loading heavy stores — it shows each pair's
  *persona name* on the start screen for free. R2-6's seeded name flows straight
  into it.
- **Privacy invariant preserved.** `ANALYTICS_PULSE` reads only `(native,
  target)` counts, never `displayName`. Pair-themed names add zero PII (they're
  composed from fixed pools), so the analytics surface is unaffected.

**One small contract touch (optional, additive):** record which profile a Track
was *born under*, so re-deriving a default (e.g. after a pool CDN update) is
reproducible and the picker can show a tiny world glyph. Add an optional
`bornProfile?: { namePoolId; themeId; starterKitId }` to `TrackState` (defaulted
→ legacy manifests parse, the `track.ts` discipline). Not required for v1.

### 4.1 nameSeed portability (a quiet correctness win)

Because pools share ids where concepts map (§2.2), the persisted
`nameSeed = {adjId, nounId, numId}` is **pool-independent**. Rendering a Track's
name = `pool.adjectives[adjId].label + " " + pool.nouns[nounId].label`. So:

- A name seeded in `pool-es` re-renders correctly even if the UI later resolves a
  different pool, falling back to `pool-universal` labels for any id the active
  pool lacks. No name ever becomes unreadable.
- This is the same robustness `itemTypes`/catalog give items: **store the seed,
  resolve the presentation** — never store the rendered string as the source of
  truth.

---

## 5. Defaults & fallbacks (the day-one-works contract)

Every layer degrades to a known-good value, so **all 2,450 pairs function before
a single bespoke row exists** (the §0.5 discipline). The cascade:

| Missing thing | Fallback | Result |
| --- | --- | --- |
| No `pairProfiles` row for target | `_default` | universal pool + shipping theme + traveler kit/grant |
| `pairProfiles.json` absent entirely | hardcoded `_default` in the resolver | identical to "no row" |
| Name pool id unknown / pool absent | `pool-universal` (the original English list) | proven-good storybook names |
| A `nameSeed` id missing in the active pool | `pool-universal` label for that id | name still renders |
| Starter kit id unknown | `kit-traveler` (original starter set) | the current onboarding wardrobe |
| Starter grant id unknown / bad currency or item | drop the bad entry, loud warn; empty grant ⇒ no grant | Track starts with empty pouch, never crashes |
| Theme id unknown to `characterGen` | `ANTIGUA_1770` (its existing default param) | on-theme-enough default dress |
| Single-language stack (`target===native`) | resolver keys on `target` → that lang's pool | immersion persona, no special case (§1.3) |

**Invariant:** the resolver **always** returns a complete `PairProfile`, and
every consumer treats every id as *possibly-unknown* and substitutes the
universal default with a console warn (never silent — `feedback_noisy_errors`).
Adding bespoke content is **pure upside**, never a prerequisite.

---

## 6. Variety math + the safety/quality gate

**Variety (the proof obligation, `CONTENT_SCALE.md §0`):**
- *Per pair, the name* is `|adj| × |noun| × (numbers)` from that pool — the
  English pool alone is `60 × 60 × ~90 ≈ 324k` distinct nicknames; ×N curated
  pools as they land.
- *Per pair, the avatar* is the full `generateCharacter` space (skin × build ×
  hair × the rich parametric face × clothing layers × props — "millions of
  combinations," `characterGen.ts` docstring), themed by the pair's `themeId`.
- *Across pairs*, the seed namespace is the `trackId`, so two of one user's
  Tracks are coherent-but-distinct (§0.8). 2,450 pairs each open on their own
  stable, on-theme persona.

**Safety / quality gate (premium, not a vibe):**
- **Names:** every word in every pool passes the `names.json` bar (wholesome,
  global, non-identifying, no real names/places, kid-safe) via a **review gate**
  — native-speaker or strong-model review (the project's `codex-cli-llm-judge`
  pattern), never an unreviewed MT dump. A CI lint asserts: no freeform path
  exists, every pool entry has a stable id, no pool introduces a banned token,
  every `nameSeed`-producible combination is in-bounds.
- **Wardrobe:** reuses `characterGen`'s already-art-directed weighted bags +
  the symmetric/wholesome face guarantees — no new uncanny surface.
- **Contact-sheet CI** (`CONTENT_SCALE.md §8`): render the *seeded default
  persona* for the top-N targets (name + dress + opening pouch) onto a contact
  sheet a human signs off — "premium proven by a sheet," not self-certified.

---

## 7. What R2-6 explicitly does NOT do

- **No freeform names. Ever.** Composition stays `Adjective + Noun (+ number)`
  from fixed, reviewed pools. (The single hardest invariant.)
- **No real first/last names of any culture** (unsafe + stereotyping; §1).
- **No new economy / inventory / Track engine.** It reuses `Reward` +
  `applyReward`, the per-Track namespace, and `TrackState.identity/avatar`.
- **No paywall on the per-pair look.** Starter kits + grants are all-free,
  on-theme palette swaps. Premium cosmetics remain a separate, untouched axis.
- **No render-seam changes.** The procedural look ships now; Spark/3D slots in
  behind the same `CharacterLook`/`WorldLook` seams later (`CONTENT_SCALE.md §0.6`).
- **No app release to add a culture.** New pools/kits/grants/profiles are a
  catalog/CDN push (§0.5).

---

## 8. Phased build plan

Each phase is independently shippable and leaves the pack working.

### Phase 0 — Resolver + universal fallback (no new content)
- Add `src/identity/pairProfile.ts` with `profileForPair(pair)` returning a
  hardcoded `_default` for everything.
- Extend `names.json`/`starter.json` readers to the multi-pool/multi-kit shape
  with the **existing data as `pool-universal` / `kit-traveler`** (loud-but-safe
  migration). Add empty `starterGrants.json` + reader (validated, omit-safe).
- Wire `resolveEntry` → on FRESH Track, seed `TrackState.identity/avatar` from
  the universal default + apply the (empty) grant.
- **Outcome:** behaviour identical to today, but the *seam exists* and fresh
  Tracks are born from the seeded path. `npm run tsc` + `vitest` green.

### Phase 1 — Pair-stable seeded default persona
- Add `characterSpecToAvatar` (inverse map) + the seeded `defaultPersonaForPair`.
- Pre-seed the onboarding name roller + dress-up from the resolved profile.
- **Outcome:** every pair opens on a *stable, generated* default persona (still
  universal pool/theme), distinct per `trackId`. Contact-sheet a dozen pairs.

### Phase 2 — First bespoke targets (es, ja, zh)
- Author + **review** `pool-es/ja/zh` (curated, on-theme nickname words),
  `kit-market/tokyo/silkroad`, `grant-market/tokyo/silkroad`, and the
  `pairProfiles.targets` rows. Theme bundles (`tokyo-2050`, `changan-tang`) land
  in `characterGen` as part of the parallel Content-Scale theme work.
- Add the names CI lint + the persona contact-sheet to CI.
- **Outcome:** the three highest-traffic targets feel bespoke; everything else
  still works via `_default`.

### Phase 3 — Scale the pools (CDN-driven, no app release)
- Author/review per-target pools for the long tail, pushed via catalog/CDN.
  Optional: `bornProfile` on `TrackState` + a tiny world glyph in the picker.
- A `tools/gen_name_pools.py`-style helper drafts candidate pools (strong-model
  review pattern) into the per-locale override files; **human/native review is a
  hard gate** before any pool ships (§6).
- **Outcome:** progressively, all 50 targets bespoke; the immersion (`x:x`)
  Tracks come along for free.

---

## 9. File/Seam summary (for the build agent)

| New / changed | Path | Role |
| --- | --- | --- |
| **new** | `src/identity/pairProfile.ts` | `profileForPair(pair) → PairProfile`; pure data adapter |
| **new** | `content/economy/starterGrants.json` | seeded opening wallet+bag per kit (as `Reward`) |
| **new** | `content/identity/pairProfiles.json` | target lang → `{namePoolId, themeId, starterKitId, starterGrantId}` |
| change | `content/identity/names.json` | flat lists → `pools{ pool-universal, pool-es, … }` (schemaV 2, migrate) |
| change | `content/cosmetics/starter.json` | flat items → `kits{ kit-traveler, kit-market, … }` (schemaV 2, migrate) |
| change | `src/onboarding/onboarding.ts` | name roller + dress-up read the *resolved pool/kit*; `defaultIdentity` takes a pair + seed |
| add helper | `src/character/characterSpec.ts` | `characterSpecToAvatar` (inverse of `avatarToCharacterSpec`) |
| wire | `src/entry/index.ts` (+ Track layer) | fresh-Track birth: seed persona + apply starter grant once |
| optional | `contracts/src/track.ts` | additive `bornProfile?` on `TrackState` |

**The throughline:** R2-6 is *one new lookup* (`pairProfile`) + *three data
layers keyed to the target* (names, kits, grants), feeding the *already-existing*
seeded generators and the *already-per-Track* identity/avatar/inventory envelope.
Different character per pair — name, wardrobe, pouch — falls out of seams the
pack already shipped, scales to 2,450 pairs via `_default`, and never opens a
freeform or unsafe naming path.
