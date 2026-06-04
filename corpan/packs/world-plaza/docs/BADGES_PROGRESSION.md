# World Plaza — Badges & Progression (the mastery axis)

**Status:** Design + sequenced plan. NO code in this doc — it is the spec the
implementation fans out from. Orthogonal sibling of `docs/ECONOMY_CURRENCY.md`
(currency/markets). This doc owns the **mastery/progression axis only.**

**Author intent in one line:** XP must stop being a static number in the corner.
Every XP a learner earns should **flow into specific, per-target-language
badges** — "Spanish · Greetings", "Spanish · Numbers — Listening" — which **fill
up and tier** (bronze → silver → gold → platinum). There are **~1000 badges per
language course**, generated **data-drivenly** from the existing 13-domain ×
6-CEFR × ~22-skill corpus, not hand-authored. Badges live **inside a Track**
(`(native, target)`, per `docs/NEXT_LEVEL_PLAN.md` §spine): switch from `en→es`
to `en→fr` and you see French's badge case, not Spanish's.

The non-negotiable bar (from `NEXT_LEVEL_PLAN.md`): A++ premium/understated, no
Duolingo dark patterns, tablet+desktop+phone first-class, localize every string
in ~50 langs, on-device-first, **data/CDN-driven so content ships without an app
release**, and **no placeholders** — concrete schemas, curves, UI, scaling math.

---

## 0. What already exists (do not regress — build on these)

This design plugs into the runtime that is already shipping, never replaces it:

- **`XpEvent`** (`contracts/src/economy.ts`) — the discriminated union XP arrives
  on: `challenge` (carries `toolId`), `pronunciation`, `coop`, `questStep`
  (carries `questId`), `daily`. **This is the routing key.** Badges are a *fan-out
  consumer* of XpEvents; they do not change how XP is earned.
- **`inventory()`** (`src/economy/inventory.ts`) — the singleton store with a tiny
  event bus + quota-safe compact localStorage persistence (`wp:economy:v1`). It
  already holds the scalar `xp` and emits `{type:"xp", delta, xp}`. The HUD reads
  it (`.wp-coinhud`, `game.ts:185`: `✨ ${inventory().xp()}`). **Pattern to copy:**
  the badge store mirrors this store's shape (event bus + `loadState`/`persist` +
  compact record + catalog-by-id index + quota-safe writes).
- **`ChallengeResult` / `ChallengeResultPlus`** (`contracts/src/challenge.ts`) —
  carries `toolId`, `score` (0..1), `detail`, and `xp: XpEvent[]`. The challenge
  also knows its `ChallengeContext { domain, entryIds, level, language }`. **These
  four — domain, skill(toolId), level, entryIds — are exactly the badge routing
  dimensions.**
- **`Quest` / `QuestState`** (`contracts/src/quest.ts`) — `Quest.domain`,
  `Quest.objective` (already has a `kind:"earnBadge", badge:string` variant!),
  `QuestRewards.badge?:string`. The badge string slot **already exists** in the
  reward + objective contracts — wiring is additive.
- **`LearningPath` / `LevelSpec` / `LevelCompletion`** (`contracts/src/curriculum.ts`)
  — `LevelCompletion` already has a `kind:"badgeEarned", badge:string` variant. So
  "a level requires a badge" is a contract that EXISTS and is unused. We honor it.
- **`createQuestEngine`** (`src/quest/questState.ts`) — the deterministic engine.
  On quest complete it calls `inventory().applyReward(quest.rewards)`. We extend
  the same seam to also credit the quest's badge.
- **Corpus host** (`src/challenges/host.ts`) — `ChallengeEntry { entry_id, level,
  domains[], translations[] }`. The 10k-phrase/lang corpus is tagged with
  **domain + CEFR level on every row**. This is the generative substrate.
- **Domains** (`dja/cor/fixtures/domains.json`) — the canonical **13 domains**:
  everyday, travel, business, health, education, social, housing, environment,
  emergency, civic, numbers, technology, culture.
- **CEFR levels** — **6**: A1, A2, B1, B2, C1, C2.
- **Skills (challenge tools)** (`contracts/src/challengeTool.ts`) — **~22 micro-
  challenge ids** that already cluster into skill families (vocab, listening,
  speaking/STT, reading/spelling, grammar, memory).
- **Localized-strings pattern** — every UI surface takes a `Partial<XStrings>`
  override merged over a `DEFAULT_X_STRINGS` (`src/shell/menuPanel.ts:38`,
  `exit.ts:22`). Badge copy follows this exact pattern.

---

## 1. The generative taxonomy — how 13×6×22 yields ~1000 tastefully

We **do not hand-author 1000 badges.** We define a small set of **badge
*families*** (generators), each a function `(corpus facets) → badge[]`. The cross
product of {domain} × {CEFR} × {skill family} × {tier ladder}, pruned to where
the corpus actually has content, lands at **~1000 per language** with zero hand
authoring beyond the family templates + localized copy strings.

### 1.1 The routing dimensions (all already on every challenge)

| Dimension | Cardinality | Source |
|---|---|---|
| **Domain** | 13 | `domains.json` / `ChallengeEntry.domains[]` |
| **CEFR level** | 6 (A1…C2) | `ChallengeEntry.level` |
| **Skill family** | 6 | derived from `toolId` (table below) |
| **Challenge tool** | 22 | `ChallengeToolId` |

**Skill families** (each maps a set of the 22 tools → one family, so badges read
human, not as 22 tool names):

| Family | Tools (toolId) |
|---|---|
| **Vocabulary** | word-scramble, picture-match, fast-translate / translate-fast, tap-translation, memory-pairs, word-search, odd-one-out, category-sort |
| **Listening** | listen-choose(-pic), number-drill, say-it-back |
| **Speaking** | read-aloud, pronunciation-duel, repeat-after |
| **Reading** | dialogue-fill, fill-the-blank / fill-blank, build-sentence, spot-typo, true-false |
| **Grammar** | conjugation-tap, build-sentence (shared), dialogue-fill (shared) |
| **Sound** | rhyme-match, countdown-recall (auditory recall) |

(The exact tool→family map lives in data, §6.2 `skillFamilies` — additive, no
contract change. Tools may belong to two families; the router credits both.)

### 1.2 The badge families (generators) and their counts

Each family is a template that **stamps** badges from corpus facets. Counts below
are the *target per language*; they are **clamped to corpus coverage** (a domain
with no C2 rows produces no C2 badge there), which is why "≈" — the realized
number self-trims to what the corpus supports, typically landing **950–1080**.

| # | Family | Generative key | Count formula | ≈ badges |
|---|---|---|---|---|
| A | **Domain mastery** | domain | 13 | **13** |
| B | **Domain × CEFR** | domain × level | 13 × 6 (clamp empties) | **≈70** |
| C | **Skill mastery** | skill family | 6 | **6** |
| D | **Skill × CEFR** | skill × level | 6 × 6 | **36** |
| E | **Domain × Skill** | domain × skill | 13 × 6 (clamp) | **≈70** |
| F | **Domain × Skill × CEFR** | domain × skill × level | the long tail; clamp to coverage | **≈620** |
| G | **Subtopic / phrase-cluster** | clustered corpus rows within a domain (e.g. "Greetings", "At the café", "Days of the week") | ~6–12 named clusters per domain × 13 | **≈110** |
| H | **Challenge-type virtuoso** | one badge per tool (do this tool well, a lot) | 22 | **22** |
| I | **Consistency / streak** | dignified opt-in (3-day, 7-day, 30-day, 100-day "Faithful Visitor") | fixed | **6** |
| J | **Quest / story** | one per authored quest + arc capstones | grows with content | **≈12 (scales)** |
| K | **Seasonal / event** | CDN-pushed, time-boxed (Día de Muertos vocab, etc.) | rotating | **≈8 live at a time** |
| | **TOTAL realized** | | | **≈970–1080** |

The **long tail is family F** (domain × skill × CEFR), which is precisely the
shape the corpus already has and the challenge already routes on — so F badges
are *free*: they are generated, graded, and credited entirely from facets the
runtime already carries. **G (subtopic clusters)** is the one family that needs a
light authored/derived clustering pass (§7), and it is the most *charming* tier
("Spanish · Greetings mastered") so it earns its keep.

### 1.3 Subtopic clusters (family G) — the charm tier, data-derived

A subtopic is a **named set of corpus `entry_id`s** within a domain (e.g. `social`
→ {Greetings, Goodbyes, Politeness, Feelings, Family}). These are the badges that
read like a human curriculum. They come from a **derivation pass** (§7.2), not
hand authoring per language:

- Cluster the domain's rows by **English head-phrase embedding / keyword** ONCE
  (English is the pivot — every row has an English source). This yields ~6–12
  language-neutral clusters per domain → **`subtopicClusters.json`** (one file,
  all languages share the cluster *definitions* because entry_ids are shared
  across the corpus; only the *display name* localizes).
- A G-badge = `{ domain, clusterId, entryIds[] }`. Earning it = accumulate XP from
  challenges whose `entryIds` (or sampled rows) fall in the cluster.

So all 50 languages inherit the same ~110 cluster badges for free; only the
~110 cluster **names** need localizing (§7.4), and they're short noun phrases.

### 1.4 Tiers (the "filling up" within one badge)

Every badge has the **same 5-tier ladder** (premium, not infinite-grind):

`Locked → Bronze → Silver → Gold → Platinum (mastered)`

- A badge is **Locked** until first relevant XP lands (it then becomes Bronze-in-
  progress). Tiers fill with a progress arc (§2.3 curve). **Platinum is terminal**
  — no XP sinks past it; overflow re-routes to sibling badges (§2.5 anti-grind).
- Tier names localize; the *visual* is a consistent medal treatment (§4.3).

### 1.5 Why this is "tasteful," not badge-spam

- The learner is **never shown 1000 badges at once.** The default gallery view is
  **"In Progress" + "Recently earned"** (§4). The full grid is opt-in, grouped,
  and searchable. 1000 is the *latent* completionist depth, surfaced gently.
- Family F (the 620) is **collapsed by default** under its Domain×Skill parent
  (family E): you see "Travel · Listening — Gold", and expand to the 6 CEFR sub-
  badges only if you care. So the *perceived* surface is ~120 (A+B+C+D+E+G+H),
  with F as drill-down depth. **Casual sees ~120; completionist sees ~1000.**

---

## 2. XP → badge routing (the heart)

### 2.1 The router: one XpEvent fans out to N badges

Today `inventory().applyReward({xp})` bumps a scalar. We add a **BadgeRouter** as
a *second consumer* of the same reward, fed by the challenge's context. Crucially
the router needs the **facets** (domain, skill, level, entryIds), which the
scalar `xp` doesn't carry — so the router is fed from the **challenge result +
context**, not from the bare XpEvent. The bare XpEvent stays the wire/anti-cheat
record; the router consumes a richer `XpDeposit`:

```ts
// src/badges/router.ts (NEW) — pure, no UI, no storage
interface XpDeposit {
  amount: number               // the XP from this action
  trackKey: string             // "en|es" — namespaces into THIS Track's badges
  source: "challenge" | "questStep" | "daily" | "coop" | "pronunciation"
  domain?: string              // ChallengeContext.domain / Quest.domain
  toolId?: ChallengeToolId      // → skill family
  level?: string               // CEFR
  entryIds?: number[]          // exact corpus rows drilled → subtopic clusters
  score?: number               // 0..1, gates tier-up quality (see 2.4)
  questId?: string             // story badges
}

// Returns the list of badgeIds this deposit advances + the XP weight to each.
function route(d: XpDeposit, catalog: BadgeCatalog): Array<{ badgeId: string; xp: number }>
```

**One deposit advances multiple badges** (the owner's requirement). A single
`fast-translate` round in `travel` at `A2` drilling entryIds `{…}` advances:

- A · Travel mastery
- B · Travel — A2
- C · Vocabulary mastery
- D · Vocabulary — A2
- E · Travel · Vocabulary
- F · Travel · Vocabulary — A2
- G · whichever subtopic cluster(s) the entryIds belong to (e.g. "At the airport")
- H · `fast-translate` virtuoso

→ **up to ~8 badges** advance from one challenge. This is the dopamine-of-mastery
done *honestly*: real, different facets of the same act of learning lighting up.

### 2.2 Weight splitting (no XP inflation)

The deposit's XP is **not duplicated 8×** (that would make badges trivially
maxable and decouple the badge axis from the scalar). Each badge gets a
**fractional weight** of the deposit; weights sum to ≤ 1 across the fan-out so the
total "mastery work" credited equals the XP earned. Default weights (data-driven,
in `badgeWeights`):

| Badge family | weight of the deposit |
|---|---|
| F (most specific: domain×skill×CEFR) | 1.00 (the primary sink) |
| G (subtopic) | 0.60 |
| E (domain×skill) | 0.50 |
| B (domain×CEFR) | 0.40 |
| D (skill×CEFR) | 0.40 |
| A (domain) | 0.30 |
| C (skill) | 0.30 |
| H (tool virtuoso) | 0.25 |

These are **independent accumulators** (a badge is full when *its* arc fills), so
the broad badges (A/C) fill slower-feeling but from many sources — exactly right:
"Travel mastery" should take many travel challenges across skills. The scalar
`inventory().xp` is unchanged (it still gets the full `amount`); badges are a
parallel ledger.

### 2.3 The progress curve (XP per tier)

Per badge, define tier thresholds as **cumulative weighted-XP**. A geometric
ladder gives the satisfying "first tiers come quick, mastery is earned":

```
tierXp(t):   Bronze=120,  Silver=400,  Gold=1000,  Platinum=2400   (cumulative)
```

- Specific badges (F, G) use this base ladder — a focused learner platinums a
  single F badge in a few dozen rounds.
- Broad badges (A, C) use a **×2.5 multiplier** on the ladder (Platinum ≈ 6000
  weighted-XP) because they aggregate everything; mastering "Travel" should feel
  like a real journey.
- The multiplier is a per-family field (`tierScale`) in the catalog — tunable
  from CDN, no app release.

**Display fill** = `clamp((wxp − tierStart) / (tierEnd − tierStart), 0, 1)`, shown
as a radial/arc fill on the medal (§4.3). The number on the HUD is replaced by a
*nearest-to-completing badge* arc (§4.5), not a raw integer.

### 2.4 Quality gate (score-weighted, anti-mash)

XP credited to a badge is **score-weighted** so mashing a challenge badly doesn't
fill mastery: `credited = amount × (0.4 + 0.6 × score)`. A 100%-score round
credits full; a 50% round credits 70%; bailing credits the 40% floor. Mastery
should track *competence*, not button presses. (The scalar XP can keep its own
rule; this gate is badge-side.)

### 2.5 Diminishing returns + anti-grind (dignified, not punitive)

- **Per-badge soft cap when near a tier:** the last 15% of a tier's arc credits at
  0.6× — so the final push is felt but the badge can't be cheesed in one lucky
  round. Pure UX texture; never a wall.
- **Platinum overflow re-routes:** XP that would land on an already-platinum badge
  is **redistributed to its still-incomplete siblings** in the same family group
  (e.g. platinum "Travel · Vocab · A2" overflow → "Travel · Vocab · B1"). No XP is
  wasted; completionists are pulled toward *new* mastery, not idle grinding.
- **No daily caps, no streak-loss penalties, no FOMO.** Consistency badges (family
  I) reward *showing up* and are opt-in; missing a day never *removes* progress
  (anti-Duolingo). A broken streak just pauses the streak badge's arc.
- **Repetition decay is OFF by default** (we never *remove* earned mastery). A
  future opt-in "review nudge" (spaced-repetition surfacing) can *highlight* a
  badge whose words are due, without ever decrementing it.

### 2.6 questStep / quest badges

- A `questStep` XpEvent routes by the **quest's `domain`** (and the step's
  `entryIds` if present) into the normal domain/skill/subtopic badges — so quest
  play *also* feeds the corpus badge case. No special path.
- The **quest's `rewards.badge`** (already in the contract) and a
  `objective.kind:"earnBadge"` are handled at the **quest-complete seam**
  (`createQuestEngine` §6.3): completing the quest grants/levels a dedicated
  **story badge** (family J) by id. Story badges are *direct-grant* (tier up on
  the event), not XP-accumulated.

---

## 3. Per-target-language: badges belong to the Track

### 3.1 Namespacing

All badge state is keyed by **`trackKey = ``${native}|${target}``** (the same key
`docs/LANGUAGE_PAIR_STATE.md` establishes for every per-Track ledger). The badge
*catalog* is parameterized by **target** only (the badges are about the language
you're learning); the *progress* is per Track (your `en→es` progress is distinct
from a hypothetical `de→es`, because they're different learners' journeys).

- Switching Tracks → the gallery + HUD read the new Track's `BadgeState` and the
  target's catalog. **Lazy-loaded** (only the active Track's catalog is parsed;
  inactive Tracks' progress sits compact in storage, §5).
- **Single-language stack** (the SINGLE_LANGUAGE_RULE memory): if `target ===
  native` (immersion/native practice), badges still work — they're about that one
  language; copy uses the immersion framing (no "translate to native" badges
  surface, since there's no second language; the Vocabulary/Listening/Reading
  families are language-internal and fine). The router simply omits any
  native-glossed subtopic naming.

### 3.2 One catalog generator, 50 languages

The **catalog is generated per target from shared, language-neutral structure**:

- Families A–H derive purely from `(domain, CEFR, skill)` facets that are
  **identical across all 50 languages** (the corpus has the same 13 domains and 6
  levels for every language). So the *structure* of ~960 badges is **one shared
  generator**; only the **display strings** localize.
- Family G clusters are defined on **shared English-pivot entry_ids** (§1.3), so
  the cluster *membership* is shared; only cluster *names* localize.
- ⇒ Adding a language is **free for the badge structure** and costs only a
  localized strings file (~140 short strings: 13 domains + 6 skills + 6 levels +
  ~110 cluster names + tier/family labels) — and most of those (domain names,
  CEFR labels) already exist in Corpán's i18n. **Net new copy per language ≈ 110
  cluster names + a dozen family/tier labels.**

---

## 4. Premium UI — the Badge Case

### 4.1 Where it lives (the M0 lesson: never `document.body`)

Everything mounts **inside `.wp-overlay`** (Band A), per the hard-won
COHESION_ITERATION §1.3 rule — a `document.body`-appended modal is clipped when
embedded in Corpán. The Badge Case is a **new section of the in-overlay Menu**
(`src/shell/menuPanel.ts` already has a tabbed `.wp-menu` panel with Map /
Inventory / Quest; we add **Badges**, or fold it into a **Progress** tab):

```
.wp-overlay (z:10, host-painted surface)
└── .wp-menu (z: --wp-z-menu:70)
    └── .wp-menu-panel
        └── .wp-menu-body
            └── .wp-badges            ← NEW (the Badge Case)
                ├── .wp-badges-summary   (Track name · X mastered · arc to next)
                ├── .wp-badges-filter    (In Progress · Recent · All · search)
                ├── .wp-badges-grid      (medal cells, grouped/collapsible)
                └── .wp-badge-detail     (slide-in: arc, tiers, "what advances this")
```

### 4.2 The case, not a list (premium feel)

- **Paper-cutout / display-case aesthetic** consistent with the world's art
  language (PREMIUM_FOUNDATIONS). Medals sit in a **stitched-felt case** with soft
  embossed wells; earned medals catch a gentle specular sheen, locked ones are a
  quiet debossed silhouette. No neon, no confetti spam.
- **Grouped + collapsed by default** (§1.5): Domains row, Skills row, then "All
  badges" grouped by domain with the F long-tail collapsed under each E parent.
- **Default filter = "In Progress"** so the learner sees the 3–8 badges actually
  moving, with live arcs — never a wall of 1000.

### 4.3 The medal (the "filling up" feel)

Each medal cell:
- A **radial arc** around the medal fills toward the next tier (the literal "XP
  filling up the badge"). Smooth `requestAnimationFrame` ease on credit, honoring
  `prefers-reduced-motion` (snap, no animation).
- The medal **face** shows the family glyph (a domain icon / skill icon / cluster
  motif) in the tier's metal (bronze/silver/gold/platin;  platinum = a soft
  iridescent rim, not a loud rainbow).
- Tier-up = a **single, dignified** transition: the medal settles into the next
  metal with one quiet shimmer + a small haptic on mobile. **No full-screen
  takeover, no mascot, no "STREAK!" scream.** A small toast (reusing the existing
  `toast()`): *"Travel · Listening — Silver."*

### 4.4 Detail view ("what advances this")

Tapping a medal slides in a detail panel:
- The tier ladder (Bronze…Platinum) with the current arc and the **weighted-XP to
  next tier** (honest, exact).
- **"How to fill this"** — a plain-language line generated from the badge's facets:
  *"Play Vocabulary challenges about Travel at A2."* For a subtopic badge: the
  cluster's sample words. For a tool-virtuoso badge: *"Win Word-Scramble rounds."*
- A **"Practice this"** button → if the menu is open over the world, it can seed
  the next challenge's `ChallengeContext` with this badge's `domain/skill/level/
  entryIds` (a direct, opt-in mastery loop). Reuses the existing `runChallenge`
  path — the badge becomes a *content selector*, closing the loop both ways.

### 4.5 HUD: replace the static XP integer

`game.ts:190` currently renders `✨ ${inventory().xp()}`. We **replace the bare
integer** with a **"focus badge" chip**:

- The chip shows the **medal closest to its next tier** for the active Track (its
  glyph + a thin radial arc + a tiny "+N" pip on credit). It *is* the XP readout,
  but as visible progress toward a named mastery, not an abstract number.
- On credit, the pip animates and, if a tier completed, the chip briefly swaps to
  the just-leveled badge before returning to the next focus badge.
- Tapping the chip opens the **Badge Case** (menu → Badges). Keeps the corner
  uncluttered: one chip, not a number that means nothing.
- The raw integer can still live in the detail/summary for the data-minded, but
  the **default HUD treatment is the badge arc**, per the owner's vision.

### 4.6 Mobile-first + all form factors

- Grid is `auto-fill, minmax(72px,1fr)` medal cells — comfortable thumb targets on
  phone, denser on tablet/desktop (the `md:`-equivalent just shows more columns +
  the grouped expansion open by default on wide screens — tablet/desktop are
  first-class per the MEMORY rule, not phone-scaled).
- Safe-area aware (the case respects notch/home-indicator insets like the rest of
  `.wp-overlay`).
- Pointer + touch + keyboard (arrow-navigable grid, Esc closes via the existing
  `shell.handleKey` chain). No `window.confirm/alert` anywhere.

### 4.7 No dark patterns (explicit)

- Consistency/streak badges are **opt-in** and **never punish** a missed day
  (arc pauses, never resets earned tiers).
- No "you'll lose X if you don't play" copy. No countdown timers except the
  honestly time-boxed **seasonal** badges (family K), which are framed as *bonus*,
  never loss.
- The case is a **place of pride**, not a guilt ledger.

---

## 5. Storage + scaling (per-Track, quota-safe)

### 5.1 The compact representation

The catalog (badge *definitions*) is **never persisted** — it's regenerated from
the bundled/CDN catalog at boot (exactly as `inventory.ts` re-indexes the item
catalog and never stores item bodies). Only **per-badge progress** persists, and
it's tiny.

Per badge we store **one packed number**: `tier (3 bits) · weightedXp (varint)`.
But we only store badges the learner has **actually touched** — Locked badges
(the vast majority early on) store **nothing** (absent = Locked, 0 xp). So a
fresh Track is ~0 bytes; an active Track touches maybe 80–200 badges.

```ts
// Persisted per Track (IndexedDB, see 5.2). `p` = touched badges only.
interface PersistedBadges {
  v: 1
  // badgeId → packed [tier, weightedXp]. Absent id ⇒ Locked.
  p: Record<string, [number, number]>   // e.g. { "F:travel:vocab:A2": [2, 612] }
}
```

### 5.2 Footprint math + IndexedDB

- A touched badge entry ≈ a short key string (~24 bytes) + 2 small ints (~6 bytes
  JSON) ≈ **~32 bytes**. A *heavily*-played Track touching **400 badges ≈ 13 KB**.
  A maxed Track touching all ~1000 ≈ **~32 KB**.
- **Per-Track localStorage would blow the budget at scale** (multiple Tracks ×
  tens of KB, against the shared ~5 MB origin budget the MEMORY flags). So badge
  progress goes to **IndexedDB** (quota-safe, per `corpan-pack-storage`), keyed
  `wp:badges:${trackKey}`. Only the active Track's record is loaded into memory.
- **Write discipline copied from `inventory.ts`:** batched/debounced writes
  (coalesce a burst of credits into one write), noisy-not-silent on failure,
  in-memory authoritative for the session if a write fails. Even 5 active Tracks
  maxed ≈ **160 KB** total — trivial for IndexedDB, would have been borderline for
  localStorage.
- **Catalog cache:** the per-language generated catalog (≈1000 defs ≈ 120–200 KB
  JSON) is cached in **IndexedDB** too (not localStorage), re-fetched only on
  catalog-version bump. Memory holds only the active target's catalog.

### 5.3 Migration from today's scalar

A one-time migration reads the existing `inventory().xp()` scalar for the active
Track and seeds a single **"Explorer"** meta-badge (or distributes nothing and
just starts badges fresh — recommended: **start badges fresh**, keep the scalar as
a legacy total in the summary). No destructive change to `wp:economy:v1`.

---

## 6. Contract + code seams (all small/additive)

No breaking changes; bump `CONTRACTS_VERSION` per the additive change.

### 6.1 New module map

```
src/badges/
  catalog.ts        // BadgeCatalog: generate badge defs from corpus facets +
                    //   subtopic clusters; index by id; load from CDN/bundle
  router.ts         // pure route(XpDeposit, catalog) → [{badgeId, xp}] + weights
  badgeStore.ts     // per-Track progress store (IndexedDB), mirrors inventory.ts
                    //   shape: applyDeposit(deposit), tierOf, arcOf, subscribe
  badgeCase.ts      // the in-overlay Badge Case UI (mounts into .wp-menu-body)
  badgeChip.ts      // the HUD focus-badge chip (replaces the ✨ integer)
content/badges/
  families.json     // family templates: id, tierScale, weight, glyph, copyKeys
  skillFamilies.json// toolId → skill family map
  subtopicClusters.json // shared clusterId → {domain, entryIds[]} (English-pivot)
  strings/<lang>.json   // localized: domain/skill/level/cluster/tier/family labels
```

### 6.2 Contract additions

- `contracts/src/badges.ts` (NEW): `Badge`, `BadgeFamily`, `BadgeTier` (enum
  `locked|bronze|silver|gold|platinum`), `BadgeState`, `XpDeposit` Zod schemas.
- **Reuse what exists:** `Quest.rewards.badge`, `QuestObjective.earnBadge`,
  `LevelCompletion.badgeEarned` are already in the contracts — no change, just
  honor them at the seams below.

### 6.3 Runtime wiring (the 4 seams)

1. **Challenge result** (`game.ts` `onIntent` `.then((res)=>…)`, line ~257):
   after `inventory().applyReward(res.rewards)`, build an `XpDeposit` from
   `res.rewards.xp` + the `ChallengeContext` (`domain`, `entryIds`) + `intent.tool`
   (toolId→skill) + `res.score` + the active `trackKey`, and call
   `badgeStore.applyDeposit(deposit)`. (The badge medal toast piggybacks the
   existing `toast()`.)
2. **Quest complete** (`src/quest/questState.ts` `advance()` → completion block):
   alongside `inventory().applyReward(quest.rewards)`, if `quest.rewards.badge` or
   `objective.kind==="earnBadge"`, call `badgeStore.grantStoryBadge(badge)`; route
   the quest XP as a `questStep`-sourced deposit (domain from `quest.domain`).
3. **HUD** (`game.ts:186`): replace the `.wp-coinhud` ✨-integer with `badgeChip`
   (subscribes to `badgeStore`); keep the 🪙 coins readout (economy's, untouched).
4. **Menu** (`src/shell/menuPanel.ts`): add the **Badges** tab → `badgeCase`,
   bound to the active Track's `badgeStore` + catalog.

5. **Levels** (when `LearningPath` lands, COHESION M5): `LevelCompletion.
   badgeEarned` is checked against `badgeStore.tierOf(badge) >= bronze` (or a
   threshold tier) — a level can *require* a badge, already contract-supported.

### 6.4 Localization

Every label flows through the established `Partial<XStrings>` override pattern
(`menuPanel.ts`/`exit.ts`): a `DEFAULT_BADGE_STRINGS` + the per-locale
`content/badges/strings/<lang>.json` merged in. Reuses Corpán's existing domain
+ CEFR i18n keys where possible; only cluster names + family/tier labels are new.

---

## 7. Data / authoring pipeline (generate → grade → localize → ship)

### 7.1 Generate (one script, all languages)

`infra/scripts/gen_badge_catalog.py` (NEW, mirrors the other `infra/scripts/*`
generators):
1. Read the corpus coverage matrix from `release.sqlite3` (or the per-language
   phrase packs): for each target language, the set of `(domain, level)` pairs
   that actually have rows, and per-domain row counts.
2. Stamp families A–H from the facet cross product, **clamped to coverage** (skip
   empty `(domain,level)` cells) → the language-neutral structure (~960 defs).
3. Attach family G subtopic clusters from `subtopicClusters.json`.
4. Emit `content/badges/catalog/<lang>.json` (or a single sharded CDN blob).

### 7.2 Subtopic clustering (family G, run once, English-pivot)

`infra/scripts/cluster_subtopics.py`:
- For each domain, pull the English source phrases, cluster by keyword/embedding
  into 6–12 named clusters, write `clusterId → {domain, entryIds[]}` +
  a default English `name`. **Run once** (clusters are shared across languages
  because entry_ids are shared). Human review of the ~110 cluster names is the
  only hand pass — a single afternoon, not per language.

### 7.3 Grade / validate

`infra/scripts/validate_badge_catalog.py` (CI gate):
- Every catalog parses against the `Badge` Zod schema.
- Realized per-language count ∈ [900, 1150] (the "tasteful ~1000" guardrail).
- No badge references an `entryId`/`domain`/`toolId` absent from the corpus.
- Every `copyKey` resolves in **every** of the ~50 strings files (no missing
  localization) — fail the build if a cluster name is untranslated.
- Weight sums per fan-out group ≤ 1 (no XP inflation, §2.2).

### 7.4 Localize (~50 langs)

- Net new copy per language ≈ **~110 cluster names + ~25 family/tier/label
  strings** (§3.2). Generated via the existing Corpán localization tooling
  (the `tools/gen_i18n.py`-style pipeline referenced in MEMORY), reusing existing
  domain + CEFR translations.
- Strings ship in `content/badges/strings/<lang>.json`, CDN-served, so **adding a
  language or fixing a name needs no app release** (catalog-driven-everything,
  MEMORY).

### 7.5 Ship via catalog (no app release)

- The badge **catalog + strings are CDN content** (the same mechanism as the
  phrase-pack catalog and `catalog-v2`). A `catalogVersion` bump → clients refetch
  + re-index into IndexedDB; progress (keyed by stable badgeId) survives a catalog
  change. New seasonal badges (family K) are a pure CDN push.
- **Stable ids are load-bearing:** badgeIds are derived from facets
  (`F:travel:vocab:A2`), so regenerating the catalog yields identical ids and
  progress never orphans. Removing a domain/level only *hides* a badge; its
  progress is retained dormant (forward-compatible).

---

## 8. Phased build plan

Disjoint file ownership so this fans out without colliding with the
COHESION_ITERATION milestones; `game.ts` wiring is serialized through that doc's
single orchestrator owner.

### Phase B0 — MVP: a few dozen badges, one language, real routing + a real case
**Goal:** XP visibly fills badges for `en→es`, end to end, in the real app.
- `content/badges/families.json` + `skillFamilies.json` + a **hand-trimmed ~40-
  badge** `catalog/es.json` (families A+C+E + a few G clusters for the shipping
  Antigua content: Greetings, Café, Market, Travel, Numbers).
- `src/badges/router.ts` + `badgeStore.ts` (IndexedDB, per-Track key).
- Seam #1 (challenge result → deposit) + Seam #3 (HUD chip replaces ✨ integer) +
  Seam #4 (Badges tab → a real `badgeCase`).
- **Verify in the REAL Corpán app** (not just standalone — the M0 lesson): play a
  challenge → the focus-badge chip arc moves → open Badges → see the medal fill →
  tier up to Bronze with a dignified toast. `.wp-badges` is a child of
  `.wp-overlay` (DOM-inspected on phone+tablet+desktop).
**Exit:** a Spanish learner sees XP fill named badges; tiering feels premium.

### Phase B1 — Full generative catalog (one language, ~1000)
- `gen_badge_catalog.py` + `cluster_subtopics.py` → real `catalog/es.json` (~1000,
  families A–H + G + I). `validate_badge_catalog.py` in CI.
- Router weights + curve (§2.2–2.5) tuned; quality gate (§2.4) + anti-grind (§2.5).
- Badge Case grouping/collapse (§4.2), detail view + "Practice this" (§4.4),
  consistency badges (family I, opt-in).
**Exit:** ~1000 ES badges, casual sees ~120 / completionist sees 1000; CI-validated.

### Phase B2 — Per-language scale (~50 langs)
- Run the generator across all targets (structure is shared → free); localize the
  ~135 strings/language via the existing i18n pipeline; ship via CDN.
- Track-switch reads the new target's catalog + per-Track progress (lazy-load).
- Single-language-stack framing audited (§3.1).
**Exit:** every language has a full, localized badge case; switching Tracks just
works; no app release needed to add a language.

### Phase B3 — Level / quest / story integration + seasonal
- Quest-complete seam (#2): story badges (family J), `rewards.badge` /
  `earnBadge` honored.
- `LevelCompletion.badgeEarned` gates levels (#5) once `LearningPath` lands.
- Seasonal badges (family K) as CDN pushes; the opt-in spaced-review *highlight*
  (§2.5, non-decrementing).
**Exit:** badges thread through quests + levels + the daily loop, all dignified.

---

## 9. Open questions for the owner

1. **HUD default:** replace the ✨ integer entirely with the focus-badge chip
   (recommended), or show both? (Recommend chip-only; integer in detail.)
2. **F long-tail surfacing:** keep family F collapsed-by-default under E
   (recommended — casual sees ~120), or expose flat? Affects perceived badge-spam.
3. **Subtopic granularity (G):** 6–12 clusters/domain (≈110 total) — sign-off on
   the cluster *names* (the one hand-review pass). More clusters = more charm but
   more localization.
4. **Tier ladder feel:** the geometric `120/400/1000/2400` base — tune for "first
   bronze in ~1 challenge, platinum is a real grind"? Easily CDN-tunable.
5. **Migration:** start every Track's badges fresh and keep the old scalar XP as a
   legacy "lifetime total" line (recommended), vs back-distribute old XP into
   badges (lossy, not recommended).
6. **Story badges (J):** direct-grant on quest complete (recommended) vs XP-
   accumulated like the rest.
