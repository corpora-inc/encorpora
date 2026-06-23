# Quest Schema — pair-agnostic, keyed, data-driven (QUESTS-AT-SCALE)

This is the authoring contract + runtime seams for the quest layer. Read it with
`QUEST_FLOW.md` (the deterministic Begin→win→advance loop) — this doc is about the
DATA and how it scales to a large, varied, replayable catalog without per-pair or
per-language one-offs.

## Where things live

```
content/quests/*.json     # the authored catalog (one quest per file)
src/quest/questCatalog.ts  # static-imports + parses every quest; the quest GRAPH
src/quest/questState.ts    # the deterministic engine (gate → advance), per-pair
src/quest/questContent.ts  # step → challenge content (domain/level/entryIds)
src/quest/questVariety.ts  # pure replay-variety policy (rotation + recent ring)
src/quest/questLocalize.ts # the keyed-quest localizer (title/narrative/step label)
src/quest/questRuntime.ts  # the ONE seam game.ts wires: localizer + variety state
src/i18n/quests.ts         # the keyed quest-copy catalog (en + GENERATED locales)
```

## The Quest shape (frozen contract: `contracts/src/quest.ts`)

A quest is a TEMPLATE parameterised by `learnerPair` + `domain` — stamp-out toward
all ordered language pairs. Authoring rules that keep it pair-agnostic:

| field | rule |
| --- | --- |
| `id` | a stable, **pair-agnostic** id (`harbor-ferry-ride`, not `es-…`). The keys derive from it. |
| `title` / `narrative` | the **English source-of-truth** literal. The real copy is the keyed catalog (`quest.<id>.title`), with this literal as the fallback. |
| `learnerPair` | required by the contract but **vestigial at runtime** — the world is built with the LIVE stack's pair (`game.ts buildFor`), not the JSON. Author `{ "target": "es", "native": "en" }` as the example; it does not pin the quest to ES. |
| `domain` | a corpus domain (`food`, `market`, `directions`, `travel`, `transit`, `civic`, `health`, `business`, `greetings`, `social`). The phrase resolver themes the challenge by this. |
| `steps[].anchorId` | a **real city anchor**: `plaza`, `fountain`, `market`, `harbor`, `station`, `hospital`, `bridge_n`, `bridge_s` (what `city/generateCity.ts` produces). The orchestrator stations a talkable objective NPC + beacon at each. |
| `steps[].toolId` | the gate. **Beginner steps must be MIC-FREE** (`translate-fast`/`fast-translate`/`listen-choose`/`fill-the-blank`/`build-sentence`/`number-drill`/`picture-match`/…). Mic gates (`say-it-back`/`read-aloud`/`repeat-after`) are allowed **only as a capstone in an `advanced` quest, never the first step**. |
| `steps[].kind` | `talk` (default), `traverse` (walk to/across the anchor), or `find` (pick up at the anchor). `traverse`/`find` complete by REACHING the spot — always playable. |
| `steps[].entryIds` | **OMIT for new quests.** Pinning corpus row ids is ES-specific and breaks pair-agnosticism; let the resolver draw by domain+level for the live target. |
| `promptProgram.contentSelector.domains/levels` | **declare both** — the minigame phrase resolver (DOMAIN + CEFR, owned by the challenges layer) consumes these to source phrases for the active target. |
| `promptProgram.scaffold` | `beginner` / `intermediate` / `advanced`. The mic-gate-capstone rule keys off `advanced`. |
| `rewards.grant` | only **real economy item ids** (`content/items/catalog.json`). |
| `nextQuestIds` | the 2–3-way authored fork. The variety engine leads with these, then backfills. |

`questCatalogScale.test.ts` enforces all of the above mechanically.

## Localization (keyed, ~50 langs)

Quest copy renders through `makeQuestLocalizer(uiLocale)` → `questString(key, lang,
literal)`: prefer the catalog key, fall back to the authored literal — **never
blank**. Keys are DERIVED from ids (`quest.<id>.title`, `quest.<id>.step.<stepId>`,
`quest.<id>.narrative`), so authoring a quest needs no hand-assigned keys: add the
English value under the derived key in `src/i18n/quests.ts`'s `en`, then
`tools/gen_i18n.py` fills the other locales. The Status Capsule, Quest section, and
interlude all consume the localizer; it re-points on an immersion flip (native ⇄
target) with no teardown.

## Variety engine (`questVariety.ts` + `questRuntime.ts`)

- **Next-quest rotation.** `pickNextQuests` = authored fork first (de-duped, minus
  the completed quest), then catalog backfill **shuffled by a seed** with
  recently-played quests **sorted to the back** → replays rarely re-offer the same
  cards. Capped at 3, never empty.
- **Per-pair recent-history ring + play counter** (`questRuntime`, persisted in
  `wp:questvar:v1:<trackId>`, < 1KB) feed the seed so the branch rotates between
  replays and is scoped per language pair.
- **Per-play parameterisation.** `varyQuestPlay(quest, attempt)` derives a stable
  `vocabRotation` so even a replayed quest can window a fresh slice of its
  domain/level pool (advisory; the phrase resolver may use it).

## The single game.ts wiring point

Everything above is exposed behind **`createQuestRuntime({ trackId, uiLocale })`**
(`questRuntime.ts`). `game.ts`:
- builds it once per world (per-pair), `recordStarted(entryQuestId)`;
- passes `localizeQuest: questRuntime.localizer()` (or a getter) to the tracker +
  quest section + interlude;
- uses `questRuntime.nextOptions(completedId)` for the interlude branch;
- `recordStarted(next.id)` on each interlude pick (`setActiveQuest`);
- `questRuntime.setLocale(uiLocale)` + `tracker.relocalizeQuest(...)` on the
  immersion flip.

The deterministic engine, the Begin→win→advance loop, and the switch/abandon escape
hatch are unchanged — this layer only enlarges the catalog, localizes its copy, and
keeps the journey fresh.
