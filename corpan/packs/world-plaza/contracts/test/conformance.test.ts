import { describe, it, expect } from "vitest"
import {
  RoomTopology,
  Scene,
  Quest,
  LearningPath,
  PresenceSnapshot,
  InteractionRequest,
  ChallengeResult,
  MediatedChatArtifact,
  NpcIntent,
  SyncEvent,
  OfflineProgressEvent,
  parseScene,
  parseQuest,
  CONTRACTS_VERSION,
} from "@world-plaza/contracts"

/* ---- valid sample payloads (as they'd arrive over the wire / from pack JSON) ---- */

const validTopology = {
  id: "plaza-sq-a",
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  spawns: [{ x: 0, z: 0 }],
  blockers: [{ x: 5, z: 5, w: 2, d: 2 }],
  anchors: [
    { id: "cafe_counter", role: "npc_station", x: 4, z: -3, facing: 1.57 },
    { id: "fountain", role: "decor", x: 0, z: 0 },
  ],
}

const validScene = {
  id: "antigua-1770",
  topologyId: "plaza-sq-a",
  setting: { place: "Antigua", era: "1770", mood: "warm colonial morning" },
  themeId: "paper",
  narrativeBlurb: "Cobblestones still wet with dew; a café opens its shutters.",
  anchorSkins: {
    cafe_counter: { spriteRef: { url: "corpan-pack://localhost/corpan_city/scenes/antigua/cafe.webp" } },
    fountain: { spriteRef: { url: "corpan-pack://localhost/corpan_city/scenes/antigua/fountain.webp" } },
  },
  npcSkins: {
    baker: { spriteRef: { url: "corpan-pack://localhost/corpan_city/scenes/antigua/baker.webp" }, voiceHint: "es-ES" },
  },
}

const validQuest = {
  id: "marietta-to-guadalajara-cafe",
  title: "Café Spanish on the road to Guadalajara",
  narrative: "From Marietta, GA to Guadalajara — order, chat, and belong.",
  learnerPair: { target: "es", native: "en" },
  domain: "travel",
  objective: { kind: "completeChallenges", toolId: "speed-drill", count: 3 },
  steps: [
    { id: "greet", label: "Greet the café owner", anchorId: "cafe_counter" },
    { id: "order", label: "Order a coffee", toolId: "speed-drill" },
  ],
  promptProgram: {
    personaTemplate:
      "You are {persona}, a {domain} guide teaching {target} to a {native} speaker at a {scaffold} level. Goal: {objective}.",
    scaffold: "beginner",
    contentSelector: { levels: ["A1", "A2"], domains: ["travel"], languageCodes: ["es", "en"] },
    toolWhitelist: ["speed-drill", "pronunciation-duel"],
  },
  rewards: { xp: 50, coins: 10, badge: "travel-1" },
}

const validPath = {
  id: "es-from-en-v1",
  learnerPair: { target: "es", native: "en" },
  levels: [
    {
      id: "lvl-0",
      index: 0,
      sceneId: "antigua-1770",
      questIds: ["marietta-to-guadalajara-cafe"],
      completion: { kind: "allQuestsComplete" },
    },
  ],
}

const validPresence = {
  roomId: "plaza-sq-a#inst-3",
  players: [
    {
      playerId: "p-abc",
      name: "Brave Otter 7",
      avatar: { base: "body-1", layers: [{ slot: "hat", itemId: "straw-hat" }] },
      pos: { x: 1, z: 2, facing: 0 },
      sceneId: "antigua-1770",
      questId: "marietta-to-guadalajara-cafe",
    },
  ],
}

const validInteraction = {
  kind: "challenge",
  from: "p-abc",
  to: "p-xyz",
  tool: "pronunciation-duel",
  spec: {
    toolId: "pronunciation-duel",
    challengeId: "c-1",
    language: "es",
    nativeLanguage: "en",
    level: "A2",
    mode: "duel",
  },
}

const validChallengeResult = {
  challengeId: "c-1",
  toolId: "pronunciation-duel",
  playerId: "p-abc",
  score: 0.82,
  detail: { acoustic_score: 0.79, transcript_score: 0.9 },
  xp: [{ kind: "pronunciation", amount: 12 }],
  completedAt: 1717000000000,
  offline: false,
}

const validArtifact = {
  artifactId: "a-1",
  interactionId: "i-1",
  sourcePlayerId: "p-abc",
  targetPlayerId: "p-xyz",
  sourceLanguage: "es",
  targetLanguage: "fr",
  visibleText: "Bonjour ! On parle de musique ?",
  naturalTranslation: "Hello! Shall we talk about music?",
  suggestedReplies: [{ id: "r1", label: "Oui, j'adore", entryId: 42 }],
  lessonNotes: [{ kind: "vocab", text: "musique = music" }],
  moderation: { decision: "allow", reasons: [], confidence: 0.98 },
  safetyClass: "ok",
}

const validSync = {
  kind: "pushProgress",
  events: [
    {
      id: "e-1",
      t: 1717000000000,
      payload: { kind: "questStep", questId: "marietta-to-guadalajara-cafe", amount: 10 },
      sig: "deadbeef",
    },
  ],
}

describe("contracts v0 — valid payloads parse", () => {
  it("RoomTopology", () => expect(() => RoomTopology.parse(validTopology)).not.toThrow())
  it("Scene", () => expect(() => parseScene(validScene)).not.toThrow())
  it("Quest", () => expect(() => parseQuest(validQuest)).not.toThrow())
  it("LearningPath", () => expect(() => LearningPath.parse(validPath)).not.toThrow())
  it("PresenceSnapshot", () => expect(() => PresenceSnapshot.parse(validPresence)).not.toThrow())
  it("InteractionRequest (challenge)", () =>
    expect(() => InteractionRequest.parse(validInteraction)).not.toThrow())
  it("ChallengeResult", () => expect(() => ChallengeResult.parse(validChallengeResult)).not.toThrow())
  it("MediatedChatArtifact", () => expect(() => MediatedChatArtifact.parse(validArtifact)).not.toThrow())
  it("NpcIntent (callTool)", () =>
    expect(() =>
      NpcIntent.parse({ kind: "callTool", tool: "fill-blank", spec: { challengeId: "x" } }),
    ).not.toThrow())
  it("SyncEvent (pushProgress)", () => expect(() => SyncEvent.parse(validSync)).not.toThrow())
  it("OfflineProgressEvent", () =>
    expect(() => OfflineProgressEvent.parse(validSync.events[0])).not.toThrow())
})

describe("contracts v0 — invalid payloads reject", () => {
  it("Scene missing themeId", () => {
    const { themeId, ...bad } = validScene
    expect(Scene.safeParse(bad).success).toBe(false)
  })
  it("ChallengeResult score out of range", () => {
    expect(ChallengeResult.safeParse({ ...validChallengeResult, score: 2 }).success).toBe(false)
  })
  it("InteractionRequest unknown kind", () => {
    expect(InteractionRequest.safeParse({ kind: "nope", from: "p" }).success).toBe(false)
  })
  it("Quest with bad objective discriminant", () => {
    expect(Quest.safeParse({ ...validQuest, objective: { kind: "bogus" } }).success).toBe(false)
  })
  it("RoomTopology with no spawns", () => {
    expect(RoomTopology.safeParse({ ...validTopology, spawns: [] }).success).toBe(false)
  })
})

describe("contracts v0 — meta", () => {
  it("exposes a version", () => expect(CONTRACTS_VERSION).toBe("0.2.0"))
})
