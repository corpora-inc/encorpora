import { RoomTopology, Scene as WorldSceneSchema, NpcRole, Quest, type ChallengeContext, type ChallengeToolId } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/corpan-city.json"
import { generateCity, mountCity } from "./city"
import rolesJson from "../content/npc/roles.json"
import questJson from "../content/quests/es-guadalajara.json"
import specialJson from "../content/npc/special.json"
import { createWorldEngine } from "./world/engine"
import { applyAtmosphere } from "./world/atmosphere"
import { createVista } from "./world/vista"
import { createInput } from "./movement/input"
import { createPlayerController } from "./movement/controller"
import { createJuice } from "./juice/juice"
import { createNpcFocus } from "./world/npcFocus"
import { createCrowd, type CrowdFocusHandle } from "./world/crowd"
import { createCameraFade } from "./world/cameraFade"
import { createShell } from "./shell"
import { createNpcRuntime } from "./npc/npcRuntime"
import { createMockHost } from "./npc/mockHost"
import { runOnboarding, defaultIdentity, type OnboardingResult } from "./onboarding/onboarding"
import type { HostApi as NpcHostApi } from "./npc/hostTypes"
import { runChallenge } from "./challenges/registry"
import {
  createChallengeHost,
  mockChallengeHost,
  type ChallengeRuntimeHost,
  type CorpanChallengeHostApi,
} from "./challenges/host"
import { inventory } from "./economy/inventory"
import { createQuestEngine } from "./quest/questState"
import { createSpecialNpcResolver } from "./quest/specialNpc"
import { resolveStepContent, challengeSatisfiesStep } from "./quest/questContent"
import { mountQuestTracker } from "./quest/questTracker"
import { createQuestSection } from "./quest/questSection"
import { createInventorySection } from "./inventory/inventoryPanel"
import { mountPlaceTag } from "./shell/placeTag"
import { createChromeVisibility, type ChromeState } from "./shell/chromeVisibility"
import { createEconomyHud } from "./economy/economyHud"
import { createBadgesRuntime } from "./badges"
import { iconRenderer } from "./items/itemArt"
import { setIconRenderer } from "./economy/currencies"
import { mountMinimap } from "./map/minimap"
import { openFullMap, createMapSection } from "./map/fullMap"
import type { MapView } from "./contracts/runtime"
import {
  createVignetteHost,
  registerBuiltinVignettes,
  VIGNETTE_IDS,
  type OpenNpcArgs,
  type VignetteNpcHandle,
  type TaxiDestination,
} from "./vignettes"
import { createPortalAffordance } from "./world/portalAffordance"

/**
 * World Plaza — game wiring. Onboarding (pick a safe name, dress an avatar) →
 * a walkable, premium paper-cutout plaza with atmosphere, dual-stick movement,
 * proximity NPC focus, and real on-device Qwen3 dialogue (mock host in
 * standalone dev). All driven by data validated against @world-plaza/contracts.
 */

const IDENTITY_KEY = "wp:identity:v1"

export interface GameHandle {
  dispose: () => void
}

function loadIdentity(): OnboardingResult | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    return raw ? (JSON.parse(raw) as OnboardingResult) : null
  } catch (err) {
    console.warn("[world-plaza] could not read saved identity:", err)
    return null
  }
}

function saveIdentity(id: OnboardingResult) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
  } catch (err) {
    console.warn("[world-plaza] could not save identity:", err)
  }
}

export function startGame(container: HTMLElement, host?: unknown): GameHandle {
  let disposed = false
  let teardownWorld: (() => void) | null = null
  const npcHost = (host as NpcHostApi | undefined) ?? createMockHost()
  // Corpus/TTS/STT-backed host for challenges (real corpan host, else a mock
  // with a built-in EN↔ES corpus so challenges run standalone in the browser).
  const chHost: ChallengeRuntimeHost = host
    ? createChallengeHost(host as CorpanChallengeHostApi)
    : mockChallengeHost()

  const begin = (identity: OnboardingResult) => {
    if (disposed) return
    teardownWorld = buildWorld(container, npcHost, chHost, identity)
  }

  const saved = loadIdentity()
  if (saved) {
    begin(saved)
  } else {
    runOnboarding(container, { playerId: "player-local" })
      .then((res) => {
        saveIdentity(res)
        begin(res)
      })
      .catch((err) => {
        console.error("[world-plaza] onboarding failed; using defaults:", err)
        begin(defaultIdentity())
      })
  }

  return {
    dispose: () => {
      disposed = true
      teardownWorld?.()
      teardownWorld = null
      container.replaceChildren()
    },
  }
}

function buildWorld(
  container: HTMLElement,
  npcHost: NpcHostApi,
  chHost: ChallengeRuntimeHost,
  identity: OnboardingResult,
): () => void {
  // Validate the data-driven content against the frozen contracts (fail loud).
  // The topology is no longer a hand-authored plaza JSON — it's SYNTHESIZED from
  // the procedurally generated Corpan City below (one big streaming map).
  const scene = WorldSceneSchema.parse(sceneJson)
  const roles = NpcRole.array().parse(rolesJson)
  const quest = Quest.parse(questJson)
  const learnerPair = quest.learnerPair

  // ---- DOM: canvas + overlay (joysticks, dialogue, toasts, title) ----
  const rootEl = document.createElement("div")
  rootEl.className = "wp-root"
  const canvas = document.createElement("canvas")
  canvas.className = "wp-canvas"
  const overlay = document.createElement("div")
  overlay.className = "wp-overlay"
  rootEl.appendChild(canvas)
  // Screen-space vignette — welded to the VIEWPORT (a DOM layer), so it can never
  // drift/jerk relative to the screen the way a world-space camera quad does.
  const vignette = document.createElement("div")
  vignette.className = "wp-vignette"
  rootEl.appendChild(vignette)
  rootEl.appendChild(overlay)
  container.appendChild(rootEl)

  // TOP HUD (consolidated, TOP_HUD §0): ONE coherent warm-Antigua theme of TWO
  // anchors — the LEFT Status Capsule (quest + glances, expandable) and the RIGHT
  // Place Tag (demoted scene name + presence). The center is intentionally empty
  // (the toast/level-up bloom zone). The old centered `.wp-title` pill, the
  // standalone `econHud` wallet readout, and the separate `badges.chip` are all
  // RETIRED — the capsule is the single wallet + focus-badge display.

  const hint = document.createElement("div")
  hint.className = "wp-hint"
  hint.textContent =
    "Left half: move · Right half: look · Walk up to a character to Talk · (P) perf"
  overlay.appendChild(hint)

  const world = createWorldEngine(canvas, overlay, { skyColor: scene.palette?.sky })
  // Scene-DEPENDENT visuals are `let` so the live Antigua⇄Tokyo flip can rebuild
  // them (atmosphere, horizon vista, world look) without disturbing gameplay.
  let activeScene = scene
  let atmo = applyAtmosphere(world.scene, scene.palette, world.onFrame, scene.sky)
  let vista = createVista(world.scene, scene.landmark)
  const juice = createJuice(world.scene)
  const input = createInput(overlay)

  // ── Corpan City: one big procedurally-generated, STREAMING 3D city ─────────
  // Replaces the hand-authored plaza topology + one-shot renderScene. The city is
  // chunked; `mountCity` loads/unloads chunk meshes by camera proximity (frustum +
  // distance culled, props thin-instanced) so the map scales without tanking the
  // frame. Roads are BAKED into each chunk's ground mesh (never overlays — the
  // §2 z-fight rule). We derive a stable seed from the scene id so the city is
  // deterministic per scene yet swappable later.
  const citySeed = Array.from(scene.id).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const layout = generateCity(citySeed)
  const city = mountCity(world.scene, {
    layout,
    getCameraPos: () => world.camera.position, // streaming origin (camera follows player)
    palette: scene.palette,
  })
  // Synthesize a RoomTopology for the consumers that still expect one (player
  // controller bounds, crowd placement, the MapView). Collision now comes from the
  // STREAMING field (city.getCollision()), not topology blockers, so blockers is
  // empty; anchors are the city's generic landmarks (plaza/market/harbor/…).
  const topology = RoomTopology.parse({
    id: "corpan-city",
    bounds: layout.bounds,
    spawns: [city.getSpawn()],
    blockers: [],
    anchors: city.getAnchors(),
  })
  // Unified collision field, rebuilt from the ACTIVE streamed chunks (building
  // boxes + prop circles). A stable facade the controller captures once and that
  // re-points itself as chunks stream in/out — player + crowd both consume it.
  const obstacles = city.getCollision()
  // The player IS their dressed avatar (grounded cutout, self-animated).
  const player = createPlayerController(world, topology, input, identity.avatar, obstacles)
  // Camera occlusion fade: any building between the camera and the player (or one
  // the camera clips into) smoothly fades transparent so you never lose sight of
  // your character, then restores. Ticked in the frame loop; disposed on teardown.
  const cameraFade = createCameraFade(world.scene, world.camera, () => player.getPos())
  // The special quest NPCs (boatman/gatekeeper/traveler/clerk) the active quest
  // designates at specific anchors. The resolver parses content/npc/special.json;
  // `forQuest(quest.id)` returns the entries (anchorId/name/role) we STATION in the
  // crowd so the player finds each where its map marker points. (The resolver also
  // drives the M2 dialogue marking + the engine's delivery routing elsewhere.)
  const specialNpc = createSpecialNpcResolver(specialJson)
  const questSpecials = specialNpc.forQuest(quest.id).map((s) => ({
    anchorId: s.anchorId,
    name: s.name,
    role: s.role,
  }))
  // Autonomous wandering townsfolk — EVERY one gets a generated persona (passing
  // `scene` gives them era/place/language flavour), so all are talkable. The quest
  // specials are bound as STATIONED agents hovering at their anchors.
  const crowd = createCrowd(world.scene, topology, {
    count: 28,
    roles,
    seed: scene.id,
    scene,
    obstacles,
    specials: questSpecials,
  })
  // Dev-only inspection hook: lets a headless harness read live agent positions
  // (e.g. assert the stationed specials stay near their anchors). No-op when
  // packaged in the host (we only expose it on the standalone window).
  if (typeof window !== "undefined") {
    ;(window as unknown as { __wpCrowd?: () => unknown }).__wpCrowd = () =>
      crowd.focusables.map((f) => ({
        anchorId: f.anchorId,
        name: (f.role as { name?: string }).name,
        x: f.billboard.root.position.x,
        z: f.billboard.root.position.z,
      }))
    // Dev memory probe: live scene texture/mesh/vertex footprint (for sizing the
    // pre-warm-the-whole-city option). Reads Babylon's scene stats directly.
    ;(window as unknown as { __wpSceneStats?: () => unknown }).__wpSceneStats = () => {
      const s = world.scene
      let texBytes = 0
      const sizes: Record<string, number> = {}
      for (const t of s.textures) {
        const sz = t.getSize?.()
        const px = sz ? sz.width * sz.height : 0
        const bytes = px * 4 * 1.33 // RGBA + mips
        texBytes += bytes
        const key = sz ? `${sz.width}x${sz.height}` : "?"
        sizes[key] = (sizes[key] ?? 0) + 1
      }
      return {
        meshes: s.meshes.length,
        textures: s.textures.length,
        textureMB: Math.round(texBytes / 1e6),
        vertices: s.getTotalVertices(),
        texSizeHistogram: sizes,
      }
    }
  }

  const toast = (text: string) => {
    const el = document.createElement("div")
    el.className = "wp-toast"
    el.textContent = text
    overlay.appendChild(el)
    setTimeout(() => el.classList.add("wp-toast--in"), 10)
    setTimeout(() => {
      el.classList.remove("wp-toast--in")
      setTimeout(() => el.remove(), 300)
    }, 2600)
  }
  toast(`Welcome, ${identity.name.displayName}`)

  // ── Economy + Badges HUD ──────────────────────────────────────────────────
  // Swap the REAL procedural icon renderer into the currency catalog (replaces
  // the stub disc with beveled coins/bills/ingots — zero call-site change).
  setIconRenderer(iconRenderer)
  // The reward smorgasbord reveal + the `walletGlance()` getter the Status Capsule
  // consumes. `suppressReadout` mounts NO standalone wallet chip — the capsule is
  // the single wallet display (this kills the cryptic floating "R 18.40").
  const econHud = createEconomyHud({
    overlay,
    store: inventory(),
    sceneKeys: [scene.setting.place, scene.setting.era],
    locale: learnerPair.native,
    suppressReadout: true,
  })
  // XP fills per-target-language BADGES. The Badge Case is a real menu section;
  // the focus-badge glance rides in the capsule's detail card (the standalone
  // `badges.chip` is RETIRED — not appended to the overlay). `openCase` is
  // late-bound to `shell` (below).
  const badges = createBadgesRuntime({
    trackKey: `${learnerPair.native}:${learnerPair.target}`,
    lang: learnerPair.native,
    trackLabel: learnerPair.target,
    accent: scene.palette?.accent,
    openCase: () => shell.openSection("badges"),
    renderer: iconRenderer,
  })

  // Quest engine — the deterministic state machine that makes the quest PRESENT.
  // It reads inventory + authored item rules to know each step's state (needs-item
  // / ready-to-deliver / done), GATES advancement (the model can't fake progress),
  // and drives both the tracker HUD and the challenge's content selection.
  const questEngine = createQuestEngine({
    quest,
    inventory: inventory(),
    playerId: identity.name.playerId,
  })

  // Map: a pure consumer of the MapView bundle — topology + live player position +
  // remote players (empty until the net client lands) + quest markers from the
  // engine. Feeds the corner minimap + the full-screen map + the menu Map tab.
  const mapView: MapView = {
    topology,
    getPlayerPos: () => ({ ...player.getPos(), facing: player.getFacing() }),
    getRemotePositions: () => [],
    getQuestMarkers: () => questEngine.getQuestMarkers(),
  }
  const mapOpts = { view: mapView, accent: scene.palette?.accent, lang: learnerPair.native }

  // Proximity NPC engagement → open a real (or scripted-fallback) Qwen3 chat.
  const npcRuntime = createNpcRuntime(npcHost)
  let openDialogue: { close: () => void } | null = null
  // The NPC we're currently engaged with (dialogue open). While set, it stays
  // HELD (frozen) regardless of focus churn, so it can't wander off mid-chat.
  let engagedId: string | null = null

  // A dialogue is a MODAL overlay: while it is open, pause ALL world input —
  // joystick pointers, WASDQE/arrow keys, taps, and NPC focus/engage — so events
  // don't bleed through to the world underneath.
  const setWorldActive = (active: boolean) => {
    input.setEnabled(active)
    focus.setEnabled(active)
  }

  // Chrome visibility (TOP_HUD §4) — the SINGLE owner of top-band + pack-button
  // visibility. The five existing game.ts edges (focus / dialogue open+close /
  // challenge / menu open+close) route into `chrome.set(state)`; surfaces are
  // registered just below once the capsule + place tag + pack button exist. This
  // RECEDES the chrome during a blocking surface (fixing the pack-button-over-NPC
  // overlap) instead of z-stacking the dialogue over still-painted chrome.
  const chrome = createChromeVisibility("world")
  // A challenge can run concurrently with no dialogue; track both so closing one
  // doesn't prematurely restore chrome while the other still owns the screen.
  let challengeDepth = 0
  const deriveChromeState = (): ChromeState => {
    if (challengeDepth > 0) return "challenge"
    if (openDialogue) return "dialogue"
    if (focus.getFocused()) return "focused"
    return "world"
  }
  const refreshChrome = () => chrome.set(deriveChromeState())

  // A friendly NPC/anchor name for the capsule + quest section hints ("the
  // boatman" at `docks`), resolved through the special-NPC content when present.
  const anchorName = (anchorId: string): string =>
    specialNpc.anchorName(anchorId, quest.id, undefined, learnerPair.target) ?? prettyAnchorId(anchorId)

  // Focus locks onto the nearest WANDERING crowd agent (live position each frame).
  const focus = createNpcFocus(world, overlay, crowd.focusables, (it) => {
    if (openDialogue) return // hard guard: never stack a second conversation
    const role = (it as CrowdFocusHandle).role
    if (!role) return // every wanderer has a persona now; defensive only
    juice.ring(it.billboard.root.position.x, it.billboard.root.position.z, activeScene.palette?.accent)
    // Lock this NPC for the whole conversation (survives the focus-disable that
    // setWorldActive(false) triggers — the onFocusChange handler ignores churn
    // while engagedId is set).
    engagedId = it.anchorId
    crowd.setHeld(engagedId)
    setWorldActive(false)
    // If this is a SPECIAL quest NPC (boatman/gatekeeper/clue-giver stationed at a
    // quest anchor), pass the quest engine + `isSpecial` so npcRuntime activates the
    // authored clue/questFacts dialogue (M1) + the deterministic hand-over chain.
    // Generic wanderers get none of this → their dialogue is byte-identical to before.
    const special = specialNpc.forAnchor(it.anchorId, quest.id)
    openDialogue = npcRuntime.open({
      npcRole: role,
      scene,
      quest,
      learnerPair,
      container: overlay,
      npcName: special ? specialNpc.displayName(special, undefined, learnerPair.target) : undefined,
      ...(special ? { questEngine, inventory: inventory(), isSpecial: true } : {}),
      // A clue-giver special NPC deterministically GRANTS its item (idempotent) +
      // fires a juicy "🎁 Received…" reveal — never the model claiming it.
      ...(special?.duty ? { specialDuty: special.duty } : {}),
      ...(special?.gives ? { givesItemId: special.gives } : {}),
      onIntent: (intent) => {
        // The NPC contrived a game → launch the centered challenge → reward the win.
        if (intent.kind !== "callTool") return
        // Bind the challenge to the player's CURRENT quest step: drill THAT step's
        // vocab (entryIds) so "help me with this" teaches the exact words the quest
        // is about — the data binding that makes challenge↔quest feel cohesive.
        const stepContent = resolveStepContent(quest, questEngine.currentStep())
        const ctx: ChallengeContext = {
          language: learnerPair.target,
          nativeLanguage: learnerPair.native,
          mode: "solo",
          domain: stepContent.domain,
          entryIds: stepContent.entryIds.length ? stepContent.entryIds : undefined,
        }
        // A centered challenge is launching → recede the chrome for its duration.
        challengeDepth++
        refreshChrome()
        runChallenge(intent.tool, ctx, chHost, {
          container: overlay,
          npc: { name: (role as { name?: string }).name ?? "A townsperson", avatar: "🧑" },
          partialSpec: intent.spec,
        })
          .then((res) => {
            const granted = inventory().applyReward(res.rewards)
            // The smorgasbord reveal (stacks of bills/coins/ingots) replaces the
            // old "+🪙" toast; route the win's XP into the per-language badges.
            econHud.revealReward(res.rewards, granted)
            badges.depositChallenge({
              result: { toolId: intent.tool, score: res.score, rewards: res.rewards },
              context: ctx,
            })
            // Advance the quest IF this challenge satisfies the current step
            // (deterministically gated inside the engine — never faked).
            const step = questEngine.currentStep()
            if (step && challengeSatisfiesStep(step, intent.tool, res.score)) {
              questEngine.advance(step.id)
            }
          })
          .catch((e) => console.error("[world-plaza] challenge failed:", e))
          .finally(() => {
            // Challenge closed → restore chrome (or stay receded if dialogue/another
            // challenge still owns the screen).
            challengeDepth = Math.max(0, challengeDepth - 1)
            refreshChrome()
          })
      },
      onClose: () => {
        engagedId = null
        openDialogue = null
        setWorldActive(true)
        // Dialogue closed → chrome returns (or stays `focused` if still near).
        refreshChrome()
      },
    })
    // The NPC window is now open → recede the whole top band + pack button.
    refreshChrome()
  }, (target) => {
    // Focus changed (Talk button shows/hides) → freeze the newly-focused NPC so
    // it waits for you, release the previous one. While engaged, ignore the
    // churn: the engaged NPC stays held until its conversation closes, and on
    // close this fires again to re-hold (if still near) or release (you left).
    if (engagedId) return
    crowd.setHeld(target ? target.anchorId : null)
    // Talk button shown/hidden → the pack dims (`focused`) or restores (`world`).
    refreshChrome()
  })

  // ── Vignettes: enterable sub-experiences (the taxi back-seat) ──────────────
  // The host owns the full enter/exit lifecycle (pause world + free the LLM,
  // recede chrome, build a fullscreen root INSIDE `.wp-overlay`, run, restore).
  // We inject the REAL game services as thin adapters (VIGNETTES.md §5) so a
  // vignette reuses every shipped system (Qwen3 NPCs, challenges, the wallet,
  // TTS, the icon renderer) without importing the orchestrator or a sibling slice.

  // No immersion resolver is wired in this world yet, so the UI locale is the
  // Track's NATIVE (the language the learner reads). The vignette `t` resolves a
  // key in that locale; there is no LOCALE table in standalone/dev, so it returns
  // the key and EACH vignette applies its own inline English fallback (the
  // badgeStrings convention — never a raw key on screen).
  const uiLocale = learnerPair.native
  // There is no concrete pack `t` (no LOCALE table wired); resolve in `uiLocale`
  // and return the key unchanged so each vignette applies its inline fallback. The
  // locale is threaded so wiring a real resolver later is a one-line change.
  const vt = (key: string, _params?: Record<string, string | number>): string => {
    void uiLocale
    return key
  }

  // The ONE non-trivial bind: map the thin OpenNpcArgs onto the real
  // `npcRuntime.open` by SYNTHESIZING an NpcRole from the persona seed +
  // scriptedFallback, then return the runtime handle's `{ send, close, dispose }`
  // slice. The taxi never needs the quest-engine/special-NPC machinery, so those
  // args are omitted (the generic-persona path — byte-identical to a crowd NPC).
  const adaptOpenNpc = (args: OpenNpcArgs): VignetteNpcHandle => {
    const npcRole: NpcRole = {
      id: args.npcId,
      anchorId: args.npcId, // synthetic anchor; generic NPCs don't read it
      basePersona: { tone: args.persona.tone, quirks: args.persona.quirks },
      scriptedFallback: args.scriptedFallback.map((text) => ({ text })),
    }
    const handle = npcRuntime.open({
      npcRole,
      scene,
      quest,
      learnerPair,
      container: args.container,
      npcName: args.npcName,
      voiceCode: args.voiceCode,
      starterChips: args.starterChips,
      onClose: args.onClose,
    })
    return {
      send: (text) => handle.send(text),
      close: () => handle.close(),
      dispose: () => handle.dispose(),
    }
  }

  // The taxi's destinations are the OTHER city landmarks (not the player's own
  // `station` rank), mapped to localized labels + small fares in the Track's
  // default currency; each `anchorId` is a REAL city anchor the player re-spawns
  // at on arrival. Fares are in MINOR units (the wallet's physical-money model).
  const taxiDestinations = (): TaxiDestination[] => {
    const ride: Array<{ anchorId: string; label: string; fare: number; motif: string }> = [
      { anchorId: "harbor", label: "the harbor", fare: 260, motif: "harbor" },
      { anchorId: "market", label: "the market", fare: 160, motif: "market" },
      { anchorId: "hospital", label: "the hospital", fare: 220, motif: "hospital" },
      { anchorId: "bridge_n", label: "the north bridge", fare: 200, motif: "bridge" },
      { anchorId: "fountain", label: "the central fountain", fare: 120, motif: "fountain" },
    ]
    return ride
      .filter((d) => city.getAnchor(d.anchorId)) // only real, present anchors
      .map((d) => ({
        anchorId: d.anchorId,
        label: vt(`vignette.taxi.dest.${d.anchorId}`) === `vignette.taxi.dest.${d.anchorId}`
          ? d.label
          : vt(`vignette.taxi.dest.${d.anchorId}`),
        fare: d.fare,
        motif: d.motif,
      }))
  }

  const vignetteHost = createVignetteHost({
    overlay,
    pauseWorld: () => {
      setWorldActive(false)
      npcRuntime.onBackground()
    },
    resumeWorld: () => setWorldActive(true),
    chrome: { set: chrome.set, current: chrome.current },
    services: {
      learnerPair,
      scene,
      iconRenderer,
      speak: (lang, text) => npcHost.speak(lang, text),
      openNpc: adaptOpenNpc,
      wallet: () => inventory(), // already has balance/debit/defaultCurrency
      grant: (r) => inventory().applyReward(r),
      runChallenge: (a) =>
        // `a.tool` is a plain string at the seam; the registry validates it (and
        // resolves a no-op for an unknown id), so the cast onto ChallengeToolId is safe.
        runChallenge(a.tool as ChallengeToolId, a.ctx, chHost, {
          container: a.container,
          npc: a.npc,
        }),
      t: (key, params) => vt(key, params),
    },
  })
  registerBuiltinVignettes(vignetteHost, { taxi: { destinations: taxiDestinations() } })

  // The `station` city anchor is the TAXI RANK: a portal that enters the taxi
  // vignette. The affordance mirrors the NPC Talk button (proximity prompt + a
  // ≥44px localized Enter button that swallows its own pointer events — the
  // joystick-steals-taps rule). On enter we run the vignette; a transit result
  // re-spawns the player at the destination anchor, exactly as if they had walked.
  const stationAnchor = city.getAnchor("station")
  const enterTaxi = async (anchorId: string): Promise<void> => {
    if (vignetteHost.isActive() || openDialogue) return
    // Suppress world focus + the portal itself while the vignette owns the screen
    // (the host already pauses the sim; this just stops re-triggering on exit).
    portal?.setEnabled(false)
    try {
      const result = await vignetteHost.enter(VIGNETTE_IDS.taxi, { anchorId })
      if (result?.travelTo) {
        const a = city.getAnchor(result.travelTo)
        if (a) player.respawnAt(a.x, a.z)
      }
      if (result?.questStep) questEngine.advance(result.questStep)
      // Rewards were already granted inside the vignette (HUD reveal fired there).
    } catch (e) {
      console.error("[world-plaza] taxi vignette failed:", e)
    } finally {
      portal?.setEnabled(true)
    }
  }
  const portal = stationAnchor
    ? createPortalAffordance(world, overlay, {
        anchorId: "station",
        pos: { x: stationAnchor.x, z: stationAnchor.z },
        // Localized "Take a taxi" — inline English fallback (no LOCALE table yet).
        label:
          vt("vignette.taxi.enter") === "vignette.taxi.enter"
            ? "Take a taxi"
            : vt("vignette.taxi.enter"),
        onEnter: (id) => void enterTaxi(id),
      })
    : null
  if (!stationAnchor)
    console.warn("[world-plaza] no `station` anchor — taxi rank portal disabled")

  // DEV-ONLY hook: lets the headless harness trigger the taxi without walking to
  // the rank (the proximity path is exercised by the portal button at runtime).
  const isDevBuild = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  if (typeof window !== "undefined" && isDevBuild) {
    ;(window as unknown as { __wpEnterTaxi?: () => void }).__wpEnterTaxi = () =>
      void enterTaxi("station")
  }

  // App shell: ESC → close dialogue / menu / "Leave the Plaza?" → exit to host.
  // M0: the shell mounts ALL its chrome (menu panel, menu button, exit confirm)
  // INSIDE `.wp-overlay` (the host's accepted render surface), so the menu/exit
  // can never be clipped invisible when embedded in the Corpán host.
  const shell = createShell({
    overlay,
    accent: scene.palette?.accent,
    sections: {
      badges: badges.section,
      map: createMapSection(mapOpts),
      // REAL Inventory + Quest sections (no more "coming soon"). Inventory = the
      // multi-currency wallet shown properly (named currencies + premium glyphs) +
      // owned items + a badges summary. Quest = the full objective/steps/progress.
      inventory: createInventorySection({
        store: inventory(),
        accent: scene.palette?.accent,
        locale: learnerPair.native,
        renderer: iconRenderer,
        masteredCount: () => badges.store.masteredCount(),
        openBadges: () => shell.openSection("badges"),
      }),
      quest: createQuestSection({
        engine: questEngine,
        inventory: inventory(),
        anchorName,
        accent: scene.palette?.accent,
      }),
    },
    isDialogueOpen: () => openDialogue !== null,
    closeDialogue: () => openDialogue?.close(),
    onPause: () => {
      setWorldActive(false)
      npcRuntime.onBackground()
      // Menu opened → the menu IS the surface; recede the top band + pack button.
      chrome.set("menu")
    },
    onResume: () => {
      setWorldActive(true)
      // Menu closed → chrome returns (or stays receded if a dialogue is still up).
      refreshChrome()
    },
    onStandaloneExit: () => teardown(),
  })

  // Minimap (corner) + the full-screen map it expands into (both in-overlay).
  const fullMapModal = openFullMap(overlay, { ...mapOpts, onClose: () => {} })
  const minimap = mountMinimap(overlay, { ...mapOpts, onExpand: () => fullMapModal.open() })

  // LEFT anchor — the Status Capsule (the evolved quest tracker): the keystone,
  // expandable chrome element. Collapsed = quest objective + "what next" hint;
  // expanded = full step progress + location/era LORE + the WEALTH glance + the
  // FOCUS-BADGE glance, each deep-linking into the pack. It absorbs the wallet +
  // focus-badge display (the retired `econHud` readout + `badges.chip`). In-overlay.
  const capsulePlace = () => ({
    place: activeScene.setting.place,
    era: activeScene.setting.era,
    lore: (activeScene as { narrativeBlurb?: string }).narrativeBlurb,
  })
  const tracker = mountQuestTracker(overlay, {
    engine: questEngine,
    inventory: inventory(),
    accent: scene.palette?.accent,
    anchorName,
    place: capsulePlace(),
    // The capsule deep-links by the contract's section ids; "wallet" lives inside
    // the Inventory section here, so route it there.
    openSection: (section) =>
      shell.openSection(section === "wallet" ? "inventory" : section),
    onOpenDetail: () => shell.openSection("quest"),
    glances: {
      walletGlance: econHud.glance(),
      focusBadge: () => badges.focusBadge(),
    },
  })

  // RIGHT anchor — the Place Tag: the DEMOTED scene name (was the centered
  // `.wp-title`), a quiet luggage-tag chip top-right + an online-presence pip
  // (hidden until the net client lands). In-overlay; recedes with the band.
  const placeTag = mountPlaceTag({
    overlay,
    setting: { place: scene.setting.place, era: scene.setting.era },
    accent: scene.palette?.accent,
    lang: learnerPair.native,
    presenceCount: () => mapView.getRemotePositions().length,
  })

  // Register the three chrome surfaces with the visibility state machine: the
  // capsule + place tag are the "band", the pack button (the shell's satchel,
  // queried out of the overlay) is the "pack" (dims on `focused`, hides on
  // dialogue/challenge/menu). Apply the current state immediately.
  chrome.register({ el: tracker.el, role: "band" })
  chrome.register({ el: placeTag.el, role: "band" })
  const packButton = overlay.querySelector<HTMLElement>(".wp-menu-button")
  if (packButton) chrome.register({ el: packButton, role: "pack" })
  else console.warn("[world-plaza] pack button (.wp-menu-button) not found — chrome won't govern it")

  // v1 is ONE world — Corpan City. The dev-only Antigua⇄Tokyo geometry flip is
  // retired here (the per-player Scene-divergence machinery stays in the contracts,
  // dormant, for v2). Atmosphere/vista are built once from the Corpan City scene.

  let perfOn = false
  const onKey = (e: KeyboardEvent) => {
    if (shell.handleKey(e)) return // ESC → dialogue-close / pause / exit
    if (openDialogue) return // overlay is modal — swallow world hotkeys
    if (e.key.toLowerCase() === "p") {
      perfOn = !perfOn
      world.setPerfHudVisible(perfOn)
    }
  }
  window.addEventListener("keydown", onKey)

  // Free the resident LLM when the app is backgrounded (iOS jetsam bait).
  const onVisibility = () => {
    if (document.hidden) npcRuntime.onBackground()
  }
  document.addEventListener("visibilitychange", onVisibility)

  const unFrame = world.onFrame((dt) => {
    player.update(dt)
    city.update(dt) // stream city chunks in/out by camera proximity
    const p = player.getPos()
    crowd.update(dt, p) // wander + greet-on-approach
    juice.update(dt)
    const tap = input.consumeTap()
    focus.update(dt, p, tap)
    // The taxi-rank portal: surface its Enter affordance by proximity to `station`.
    // While a dialogue OR a vignette owns the screen, keep it suppressed so nothing
    // re-triggers (the vignette host already paused the sim).
    if (portal) {
      portal.setEnabled(!openDialogue && !vignetteHost.isActive())
      portal.update(p, tap)
    }
    cameraFade.update(dt)
    minimap.tick()
  })

  function teardown() {
    window.removeEventListener("keydown", onKey)
    document.removeEventListener("visibilitychange", onVisibility)
    econHud.dispose()
    void badges.dispose()
    minimap.dispose()
    fullMapModal.dispose()
    unFrame()
    openDialogue?.close()
    portal?.dispose()
    vignetteHost.dispose() // force-exit any running vignette + release the model
    if (typeof window !== "undefined")
      delete (window as unknown as { __wpEnterTaxi?: () => void }).__wpEnterTaxi
    void npcRuntime.dispose()
    chrome.dispose()
    placeTag.dispose()
    tracker.dispose()
    shell.dispose()
    focus.dispose()
    crowd.dispose()
    cameraFade.dispose()
    player.dispose()
    city.dispose()
    vista?.dispose()
    input.dispose()
    juice.dispose()
    atmo.dispose()
    world.dispose()
    rootEl.remove()
  }

  world.start()
  return teardown
}

/** "city_gate" → "City Gate" — a readable fallback when no special-NPC name. */
function prettyAnchorId(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
