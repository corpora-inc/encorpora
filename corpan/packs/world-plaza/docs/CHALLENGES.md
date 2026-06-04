# Micro-challenge library (§6)

Go from 2–3 heavyweight pack-games to **20 lightweight, embeddable language
exercises** an NPC can spin up with a story, in a **centered RPG encounter
overlay** — gold/XP/items at stake, juicy feedback, a confetti reward reveal.
Reusable as-is for future real-player duels (the same tools power PvP through
menus + AI).

## Modules (`src/challenges/`)

| File | Role |
|------|------|
| `host.ts` | `ChallengeRuntimeHost` — the capability surface tools pull content from: `getRandomEntries` / `searchEntries` / `getEntriesByIds` (corpus), `speak` (TTS), `sttAvailable` + `recordAndScore` (Whisper). `createChallengeHost(corpanHostApi)` adapts the real Corpán `HostApi`; `mockChallengeHost()` runs the whole library standalone (built-in EN↔ES corpus, fake STT) with zero native deps. |
| `overlay.ts` + `challenge.css` | The centered, framed **encounter card** (`.wp-ch-`): NPC pretext ribbon, timer/score/streak HUD, combo splashes, and the reward reveal. Out-of-flow `position:fixed` from frame 0; open/close is compositor-only (opacity + transform); inputs focus with `preventScroll`. **Cannot reflow the world canvas** (proven by `qa/challenges.mjs`). Tools render ONLY into `overlay.api.body`. |
| `tools/_shared.ts` | The `ToolImpl` shape, the **reward convention** (`computeReward`), seedable RNG + array/string helpers, DOM helpers. |
| `tools/choiceTools.ts` | fast-translate, tap-translation, listen-&-choose, true/false, odd-one-out, number-drill. |
| `tools/textTools.ts` | word-scramble, build-sentence, fill-the-blank, dialogue-fill, spot-typo, conjugation-tap, rhyme-match. |
| `tools/gridTools.ts` | picture-match, memory-pairs, category-sort, countdown-recall, word-search. |
| `tools/sttTools.ts` | read-aloud, say-it-back (both Whisper-scored, with graceful self-rate fallback when STT is off). |
| `registry.ts` | Registers all tools by `ChallengeToolId`, aliases the 6 legacy ids, and exposes **`runChallenge(...)`**. |
| `../content/challenges/prompts.json` | Localizable NPC pretext lines per tool (keyed by toolId; falls back to `en`). |

## `runChallenge` — the single entry point

```ts
import { runChallenge, createChallengeHost } from "./challenges/registry"
import type { ChallengeContext } from "@world-plaza/contracts"

const chHost = createChallengeHost(corpanHostApi) // or mockChallengeHost()

const result = await runChallenge(toolId, ctx, chHost, {
  container: overlay,                 // the game's `.wp-overlay` layer
  npc: { name: "Mateo", avatar: "🧑‍🍳", line /* optional override */ },
  partialSpec: intent.spec,           // the NPC's Partial<ChallengeSpec>
  uiLanguage: ctx.nativeLanguage,     // localize the pretext line
})
```

`ChallengeResultPlus` (a `ChallengeResult` + `rewards`):

```ts
{
  challengeId, toolId, playerId, score /* 0..1 */, detail, xp, completedAt, offline,
  rewards: { xp: number, coins: number, items: string[] }
}
```

`runChallenge` **never rejects**: a cancel/unknown-tool resolves with score 0 and
zero rewards, so the economy handoff is uniform.

### Reward convention (`computeReward(difficulty, score)`)

- `xp    = round(8  * difficulty * (0.4 + 0.6*score))`
- `coins = round(2  * difficulty * score)` (effort-gated — a miss earns coins ≈ 0)
- `items`: at `score ≥ 0.6` → a **common** item id; `≥ 0.8` → **uncommon**;
  `≥ 0.92` on a hard (difficulty-3) tool → a **rare `*-token`** (reads as 🎁 in the
  reveal). Item ids are **opaque strings** (`item-ferry-token`, …) — the Item model
  + inventory are owned by the economy agent; challenges only *award* ids.

`difficulty` is per-tool (1 easy … 3 hard), e.g. countdown-recall and
conjugation-tap are 3, word-scramble and picture-match are 1.

## game.ts integration (owned by the game/npc agents — not edited here)

The NPC runtime already fires `args.onIntent(intent)` for each parsed
`NpcIntent`. Wire `callTool` to `runChallenge`, then hand `result.rewards` to the
economy agent's inventory:

```ts
// in buildWorld(), when opening the dialogue:
const chHost = createChallengeHost(npcHost as unknown as CorpanChallengeHostApi)

openDialogue = npcRuntime.open({
  npcRole: role, scene, quest, learnerPair, container: overlay,
  onIntent: (intent) => {
    if (intent.kind !== "callTool") return
    void runChallenge(
      intent.tool,
      {
        language: learnerPair.target,
        nativeLanguage: learnerPair.native,
        level: quest.level, mode: "solo",
        entryIds: Array.isArray(intent.spec.entryIds) ? intent.spec.entryIds as number[] : undefined,
      },
      chHost,
      {
        container: overlay,
        npc: { name: role.id, avatar: GREET_EMOJI[role.anchorId] ?? "🧑" },
        partialSpec: intent.spec,
        uiLanguage: learnerPair.native,
      },
    ).then((res) => {
      // → economy agent: credit XP + coins, grant items into inventory
      economy.applyReward(res.playerId, res.rewards)   // { xp, coins, items }
      // (optional) reconcile res (ChallengeResult) server-side later
    })
  },
  onClose: () => { /* … */ },
})
```

The challenge overlay is modal by construction (fixed, top z-index, own ESC/scrim
handling); world input is already paused while a dialogue is open, so no extra
gating is needed.

## Self-verify

`node qa/challenges.mjs [http://localhost:5174]` (WebKit) mounts the overlay with
the mock host, plays a spread of DIFFERENT tools to completion, screenshots each
encounter + its reward reveal to `/tmp/wp-ch-*.png`, asserts the stand-in stage
box is byte-identical across open/danger-frame/settle/close (zero layout shift),
and asserts every run returns a normalized score + consistent `{xp,coins,items}`.
