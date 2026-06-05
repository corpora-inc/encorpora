import { RoomTopology, Scene as WorldSceneSchema, NpcRole, type LearnerPair, type ChallengeContext, type ChallengeToolId, type Quest as QuestT } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/corpan-city.json"
import { generateCity, mountCity, cityMapGeometry } from "./city"
import rolesJson from "../content/npc/roles.json"
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
import { runChallenge, isCrossLanguageTool } from "./challenges/registry"
import {
  createChallengeHost,
  mockChallengeHost,
  type ChallengeRuntimeHost,
  type CorpanChallengeHostApi,
} from "./challenges/host"
import { inventory } from "./economy/inventory"
import { createQuestEngine, type QuestEngine, type QuestEvent } from "./quest/questState"
import { getQuest, entryQuestId, nextQuests, firstStep } from "./quest/questCatalog"
import { createQuestInterlude, type NextQuestOption } from "./vignettes/questInterlude"
import { resolveEntry, bindStackReactivity, samePair } from "./entry"
import { readStack } from "./entry/stackAdapter"
import { createImmersionResolver, immersionToggleApplies, type Immersion } from "./immersion/immersion"
import { immersionStore } from "./immersion/store"
import { mountImmersionToggle } from "./immersion/immersionToggle"
import {
  t as translate,
  bindT,
  applyDir,
  ALL_KEYS,
  makeMenuStrings,
  makeTrackerStrings,
  makeSectionStrings,
  makeInterludeStrings,
  type I18nKey,
} from "./i18n"
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
import { createRoadArrow } from "./wayfinding/roadArrow"
import { createObjectiveBeacon } from "./wayfinding/objectiveBeacon"
import { locateObjective } from "./quest/objectiveLocator"
import { createTraversalTrigger } from "./quest/traversalTrigger"
import { buildFountain } from "./world/fountain"
import { buildHarborWater } from "./world/harborWater"
import { buildRiverwalk } from "./world/riverwalk"
import { buildHarborBoats } from "./world/harborBoats"
import { buildDistantSkyline } from "./world/distantSkyline"
import { buildGateDressing } from "./world/gateDressing"
import { buildBridge } from "./world/bridge"
import { createPopulation } from "./city/population"
import { prefersReducedMotion } from "./world/reducedMotion"

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
  let stopReactivity: (() => void) | null = null
  // The pair the world is CURRENTLY bound to (read by the reactive subscription to
  // decide whether a stack flip actually changed the derived default pair).
  let currentPair: LearnerPair | null = null
  const npcHost = (host as NpcHostApi | undefined) ?? createMockHost()
  // Corpus/TTS/STT-backed host for challenges (real corpan host, else a mock
  // with a built-in EN↔ES corpus so challenges run standalone in the browser).
  const chHost: ChallengeRuntimeHost = host
    ? createChallengeHost(host as CorpanChallengeHostApi)
    : mockChallengeHost()

  // The learner's NATIVE language (stack `languages[0]`) — the language ALL UI
  // chrome renders in (R2-4) and the axis that decides RTL orientation (R2-5).
  // It's known up front (before onboarding / target choice); read it live so the
  // onboarding + welcome already speak the user's language. Defaults to "en"
  // (standalone dev / a host that predates `getStackConfig`).
  const nativeLocale = (): string => readStack(host)?.languages?.[0] ?? "en"

  // Build (or REBUILD) the world for a given pair. Tearing down + rebuilding is
  // safe because all per-Track state keys on the pair; this is the STACK-FLIP path.
  // The IMMERSION level is read fresh from the per-Track store at build time. NOTE:
  // flipping immersion no longer rebuilds — `buildWorld` re-localizes IN PLACE
  // (#20) so the player never moves; this path is only for an actual pair change.
  const buildFor = (identity: OnboardingResult, learnerPair: LearnerPair) => {
    if (disposed) return
    teardownWorld?.()
    currentPair = learnerPair
    const immersion = immersionStore.get(learnerPair)
    teardownWorld = buildWorld(container, npcHost, chHost, identity, learnerPair, immersion)
  }

  const begin = async (identity: OnboardingResult) => {
    if (disposed) return
    // Premium welcome + (multi-target) language CHOOSER; derives the pair from the
    // LIVE Corpán stack (replaces the hardcoded `quest.learnerPair`). `container`
    // is the host's accepted render surface; the surfaces mount a fullscreen root
    // into it (same lifecycle as onboarding).
    let learnerPair: LearnerPair
    try {
      const res = await resolveEntry({
        host,
        container,
        accent: "#e8b54a",
        playerName: identity.name.displayName,
        place: "Corpan City",
        native: nativeLocale(),
      })
      learnerPair = res.learnerPair
    } catch (err) {
      console.error("[world-plaza] entry resolve failed; using default pair:", err)
      learnerPair = { target: "es", native: "en" } as LearnerPair
    }
    if (disposed) return
    buildFor(identity, learnerPair)

    // REACTIVITY: exit → flip the stack in Corpán → return rebinds the world to the
    // new stack's first target. Stored unsub fires in `dispose`.
    stopReactivity?.()
    stopReactivity = bindStackReactivity(
      host,
      () => currentPair ?? learnerPair,
      (nextPair) => {
        if (currentPair && samePair(nextPair, currentPair)) return
        buildFor(identity, nextPair)
      },
    )
  }

  const saved = loadIdentity()
  if (saved) {
    void begin(saved)
  } else {
    runOnboarding(container, { playerId: "player-local", native: nativeLocale() })
      .then((res) => {
        saveIdentity(res)
        return begin(res)
      })
      .catch((err) => {
        console.error("[world-plaza] onboarding failed; using defaults:", err)
        return begin(defaultIdentity())
      })
  }

  return {
    dispose: () => {
      disposed = true
      stopReactivity?.()
      stopReactivity = null
      teardownWorld?.()
      teardownWorld = null
      container.replaceChildren()
    },
  }
}

const ACTIVE_QUEST_KEY = "wp:activeQuest:v1"

function buildWorld(
  container: HTMLElement,
  npcHost: NpcHostApi,
  chHost: ChallengeRuntimeHost,
  identity: OnboardingResult,
  learnerPair: LearnerPair,
  immersionLevel: Immersion,
): () => void {
  // The immersion resolver for this Track (IMMERSION_TOGGLE §3): it decides which
  // locale every UI surface renders in — `uiLocale()` is the learner's NATIVE by
  // default, and the TARGET when immersion hides native ("immersion ON = target
  // EVERYWHERE"). A single-language Track is forced "on". Every `learnerPair.native`
  // that drives UI COPY or the RTL `dir` now reads `uiLocale` instead; the corpus
  // native gloss reads `resolver.challengeNativeLanguage()`.
  // `let` (not const): toggling immersion IN PLACE (no world rebuild) recomputes
  // the resolver + uiLocale and re-localizes the live surfaces (see `relocalize`
  // below). `currentUiLocale()` lets modal factories (section/interlude/inventory)
  // read the LIVE locale so they render correctly on their next open after a flip.
  let resolver = createImmersionResolver({ level: immersionLevel, learnerPair })
  let uiLocale = resolver.uiLocale()
  const currentUiLocale = (): string => uiLocale
  // The toggle CONTROL itself ALWAYS renders in the learner's NATIVE language
  // (#20b) — so they can always read it to turn immersion back OFF, even while the
  // rest of the UI is in the target. This is the one surface immune to immersion.
  const nativeLocale = learnerPair.native

  // Validate the data-driven content against the frozen contracts (fail loud).
  // The topology is no longer a hand-authored plaza JSON — it's SYNTHESIZED from
  // the procedurally generated Corpan City below (one big streaming map).
  const scene = WorldSceneSchema.parse(sceneJson)
  const roles = NpcRole.array().parse(rolesJson)

  // ── ACTIVE QUEST model (A2) ────────────────────────────────────────────────
  // The world is no longer pinned to ONE hardcoded quest JSON. The quest catalog
  // owns the graph; the orchestrator owns which quest is ACTIVE and persists that
  // choice (`wp:activeQuest:v1`). A brand-new player auto-starts `entryQuestId`
  // (the dead-simple 1-step beginner quest). These are `let` because the
  // completion interlude's next-quest pick RE-POINTS the active quest mid-session.
  const loadActiveQuestId = (): string => {
    try {
      const raw = localStorage.getItem(ACTIVE_QUEST_KEY)
      if (raw && getQuest(raw)) return raw
    } catch (err) {
      console.warn("[world-plaza] could not read active quest:", err)
    }
    return entryQuestId
  }
  const saveActiveQuestId = (id: string) => {
    try {
      localStorage.setItem(ACTIVE_QUEST_KEY, id)
    } catch (err) {
      console.warn("[world-plaza] could not persist active quest:", err)
    }
  }
  let quest: QuestT = getQuest(loadActiveQuestId()) ?? getQuest(entryQuestId)!
  if (!quest) throw new Error("[world-plaza] no quests in catalog")
  saveActiveQuestId(quest.id)

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

  // R2-5 RTL: orient the WHOLE pack root for a right-to-left NATIVE (Arabic,
  // Hebrew, Farsi, Urdu). The chrome's logical CSS properties (margin-inline,
  // inset-inline, text-align:start) mirror off this single `dir`. The 3D world is
  // direction-neutral; only the DOM chrome flips.
  applyDir(rootEl, uiLocale)
  // The host's `.wp-overlay` may sit above our root in some embeddings — orient it
  // too so a fullscreen surface mounted straight into it inherits the direction.
  applyDir(overlay, uiLocale)

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
  // Station the active quest's special NPCs at their anchors…
  const specialEntries = specialNpc.forQuest(quest.id).map((s) => ({
    anchorId: s.anchorId,
    name: s.name,
    role: s.role,
  }))
  // …PLUS a generic OBJECTIVE NPC at every step anchor the active quest points at
  // that has no authored special (e.g. the entry quest `es-cafe-travel` → `plaza`).
  // This guarantees the deterministic Begin chip is always reachable: an NPC stands
  // where the objective marker points, and the forced-offer path keys off the step
  // anchor matching the engaged anchor. (The crowd is built once for the world's
  // INITIAL active quest; the interlude's later quest pick re-points the markers +
  // capsule, and shares the spawn-`plaza` objective NPC across the beginner arc.)
  const specialAnchors = new Set(specialEntries.map((s) => s.anchorId))
  const objectiveStations = quest.steps
    .map((st) => st.anchorId)
    .filter((id): id is string => !!id && !specialAnchors.has(id))
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((anchorId) => ({ anchorId, name: "a local", role: "townsperson" }))
  const questSpecials = [...specialEntries, ...objectiveStations]
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

  // ── World detail (C): real fountain centrepiece + harbor water + ambient
  // population. Each is an ADDITIVE, bounded layer (its own create + per-frame
  // update + dispose) that does NOT touch the city streaming spine. All honour
  // prefers-reduced-motion (still water / planted figures).
  const reducedMotion = prefersReducedMotion()
  // The plaza fountain at the `fountain` anchor (0,0). The collision field already
  // restores a matching circle collider for the `fountain` anchor (city/collision),
  // so this just adds the visible HD-2D volume the collider stands for.
  const fountainAnchor = city.getAnchor("fountain")
  const fountain = buildFountain(world.scene, {
    palette: scene.palette,
    reducedMotion,
  })
  fountain.root.position.set(fountainAnchor?.x ?? 0, 0, fountainAnchor?.z ?? 0)
  // ── Riverwalk waterfront dressing (env-art, task #31): the premium stone
  // BALUSTRADE + harbor LAMP POSTS + mooring BOLLARDS + a richer rippled WATER
  // sheet (depth gradient + shoreline foam) along the +Z water edge, with a clean
  // gap at the bridge. Reads the canonical water edge from `layout.water`
  // (CityWater: waterZ/bankZ/bridgeX/bridgeHalfW) with a bridge_n-anchor fallback.
  // Its water sheet SUPERSEDES the old flat harborWater sheen, so harborWater is
  // only built when the riverwalk has no edge to key off (older layouts).
  const harborAnchor = city.getAnchor("harbor")
  const bridgeAnchor = city.getAnchor("bridge_n")
  const cityWater = (layout as unknown as {
    water?: {
      waterZ: number
      bankZ: number
      // OPTIONAL during the #32/#34 transition (legacy water-to-edge layouts omit
      // the river-band far edge); the bridge falls back to the world edge.
      farBankZ?: number
      farPromZ?: number
      bridgeX: number
      bridgeHalfW: number
    }
  }).water
  const waterEdgeZ = cityWater?.waterZ ?? bridgeAnchor?.z ?? null
  const riverwalk =
    waterEdgeZ != null
      ? buildRiverwalk(world.scene, {
          edgeZ: waterEdgeZ,
          bounds: layout.bounds,
          gap: {
            x: cityWater?.bridgeX ?? bridgeAnchor?.x ?? 0,
            halfWidth: cityWater?.bridgeHalfW ?? 6,
          },
          palette: scene.palette,
          reducedMotion,
        })
      : null
  if (!riverwalk) console.warn("[world-plaza] no water edge (layout.water / bridge_n) — riverwalk disabled")
  // Legacy flat harbour sheen — only when the riverwalk (which owns the water
  // sheet) is absent, so we never stack two water planes on the waterfront.
  const harborWater =
    !riverwalk && harborAnchor
      ? buildHarborWater(world.scene, {
          harbor: { x: harborAnchor.x, z: harborAnchor.z },
          bounds: layout.bounds,
          palette: scene.palette,
          reducedMotion,
        })
      : null
  // ── Docked HARBOUR BOATS (env-art, #32 crafted edge): low-poly HD-2D fishing
  // boats moored along the near + far quays so the river reads as a living
  // waterfront, not an empty blue band. Needs the river BAND (farBankZ) to know
  // where the far quay is; skipped on legacy water-to-edge layouts. Bounded +
  // additive (its own update/dispose), thin-instanced + frozen.
  const harborBoats =
    cityWater && cityWater.farBankZ != null
      ? buildHarborBoats(world.scene, {
          waterZ: cityWater.waterZ,
          farBankZ: cityWater.farBankZ,
          bounds: layout.bounds,
          bridge: { x: cityWater.bridgeX, halfWidth: cityWater.bridgeHalfW },
          palette: scene.palette,
          reducedMotion,
        })
      : null
  // ── DISTANT CITY SKYLINE (env-art, #32 crafted edge): a layered silhouette of a
  // far metropolis ringing the horizon (camera-followed, no edge, frozen texture)
  // so reaching the world edge lands the eye on "the world continues", not a bare
  // sky. Built only when the crafted boundary exists (a river band is present);
  // pure backdrop, no collision, disposed with the world. (Reads stronger in
  // clearer air; the atmosphere fog softens it into haze by design.)
  const skyline =
    cityWater && cityWater.farBankZ != null
      ? buildDistantSkyline(world.scene, { palette: scene.palette, seed: layout.bounds.maxX | 0 })
      : null
  // ── GATE-TOWER DRESSING (env-art, #32 crafted edge): banners + braziers at each
  // land-gate jamb so the rampart's gateways read as handsome thresholds you pass
  // through, not bare gaps. Reads `layout.boundary` (the SAME data places' city
  // wall uses to place the piers) so the dressing lands on the piers. Additive +
  // frozen; the brazier flame flicker is the only per-frame cost (RM-gated).
  const cityBoundary = (layout as unknown as {
    boundary?: import("./city/layout").CityBoundary
  }).boundary
  const gateDressing = cityBoundary
    ? buildGateDressing(world.scene, {
        boundary: cityBoundary,
        bounds: layout.bounds,
        palette: scene.palette,
        reducedMotion,
      })
    : null
  // The real 3D stone ARCH bridge (#29) — raised deck + parapets + arches on piers
  // in the river, water passing UNDERNEATH. Spans bankZ→farPromZ at the bridge gap;
  // purely visual (places' collider already opens the corridor, quest-flow's traverse
  // keys off bridge_n), so it's a static mesh built once + disposed with the world.
  const bridge = cityWater
    ? buildBridge(world.scene, {
        x: cityWater.bridgeX,
        nearZ: cityWater.bankZ,
        // far end of the deck: the far promenade if present (river-band model,
        // #32/#34), else the world edge for a legacy water-to-edge layout.
        farZ: cityWater.farPromZ ?? layout.bounds.maxZ,
        halfWidth: cityWater.bridgeHalfW,
        waterY: 0.07,
        palette: scene.palette,
      })
    : null
  // Proximity-streamed ambient strollers + stall-keepers (density follows you).
  const population = createPopulation(world.scene, {
    layout,
    obstacles,
    palette: scene.palette,
    reducedMotion,
    // The active content Scene flavours each stroller's lazily-built persona so an
    // engaged ambient figure talks in-world (absent → neutral, still talkable).
    scene: activeScene,
    // Forward vector of the follow-camera so strollers never WAKE inside the
    // view cone (world-fix §5 anti-pop-in; combined with the wake fade-in).
    getForward: () => {
      const d = world.camera.getForwardRay().direction
      return { x: d.x, z: d.z }
    },
  })

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
    locale: uiLocale,
    suppressReadout: true,
  })
  // XP fills per-target-language BADGES. The Badge Case is a real menu section;
  // the focus-badge glance rides in the capsule's detail card (the standalone
  // `badges.chip` is RETIRED — not appended to the overlay). `openCase` is
  // late-bound to `shell` (below).
  const badges = createBadgesRuntime({
    trackKey: `${learnerPair.native}:${learnerPair.target}`,
    lang: uiLocale,
    trackLabel: learnerPair.target,
    accent: scene.palette?.accent,
    openCase: () => shell.openSection("badges"),
    renderer: iconRenderer,
  })

  // Quest engine — the deterministic state machine that makes the quest PRESENT.
  // It reads inventory + authored item rules to know each step's state (needs-item
  // / ready-to-deliver / done), GATES advancement (the model can't fake progress),
  // and drives both the tracker HUD and the challenge's content selection.
  // The LIVE inner engine for the active quest (`let` — re-created by
  // `setActiveQuest` when the completion interlude picks the next quest).
  let activeEngine: QuestEngine = createQuestEngine({
    quest,
    inventory: inventory(),
    playerId: identity.name.playerId,
  })
  // A stable DELEGATING proxy every consumer (tracker, quest section, mapView,
  // the focus/challenge path) holds. On `setActiveQuest` we swap `activeEngine`
  // and re-subscribe the proxy's listeners to it, then emit `change` so they
  // re-render against the new quest — so the capsule/section/markers re-point
  // WITHOUT re-mounting any UI (they captured the proxy, not the inner engine).
  const proxyListeners = new Set<(e: QuestEvent) => void>()
  let unsubActive: (() => void) | null = activeEngine.subscribe((e) => {
    for (const fn of proxyListeners) {
      try {
        fn(e)
      } catch (err) {
        console.error("[world-plaza] quest proxy subscriber threw:", err)
      }
    }
  })
  const questEngine: QuestEngine = {
    state: () => activeEngine.state(),
    quest: () => activeEngine.quest(),
    currentStep: () => activeEngine.currentStep(),
    stepState: (id) => activeEngine.stepState(id),
    currentStepState: () => activeEngine.currentStepState(),
    isStepSatisfied: (id) => activeEngine.isStepSatisfied(id),
    markStepBeaten: (id) => activeEngine.markStepBeaten(id),
    isStepBeaten: (id) => activeEngine.isStepBeaten(id),
    advance: (id) => activeEngine.advance(id),
    getQuestMarkers: () => activeEngine.getQuestMarkers(),
    subscribe: (fn) => {
      proxyListeners.add(fn)
      return () => proxyListeners.delete(fn)
    },
    reset: () => activeEngine.reset(),
  }

  // Swap the world's ACTIVE quest (the completion-interlude pick). Rebuilds the
  // inner engine, re-points `quest` (so `anchorName`/markers/content follow it),
  // persists the choice, re-subscribes the proxy, and fires `change` so the
  // capsule + quest section + map markers re-render against the new objective.
  const setActiveQuest = (next: QuestT) => {
    saveActiveQuestId(next.id)
    quest = next
    unsubActive?.()
    activeEngine = createQuestEngine({
      quest: next,
      inventory: inventory(),
      playerId: identity.name.playerId,
    })
    unsubActive = activeEngine.subscribe((e) => {
      for (const fn of proxyListeners) {
        try {
          fn(e)
        } catch (err) {
          console.error("[world-plaza] quest proxy subscriber threw:", err)
        }
      }
    })
    // Re-arm the completion listener on the NEW engine + nudge consumers.
    armCompletionListener()
    for (const fn of proxyListeners) {
      try {
        fn({ type: "change" })
      } catch (err) {
        console.error("[world-plaza] quest proxy subscriber threw:", err)
      }
    }
  }

  // Map: a pure consumer of the MapView bundle — topology + live player position +
  // remote players (empty until the net client lands) + quest markers from the
  // engine. Feeds the corner minimap + the full-screen map + the menu Map tab.
  const mapView: MapView = {
    topology,
    getPlayerPos: () => ({ ...player.getPos(), facing: player.getFacing() }),
    getRemotePositions: () => [],
    getQuestMarkers: () => questEngine.getQuestMarkers(),
    // #35: water + building footprints for the map, derived from the SAME CityLayout
    // collision/placement reads, so the map can never drift from the world.
    getMapGeometry: () => cityMapGeometry(layout),
  }
  const mapOpts = { view: mapView, accent: scene.palette?.accent, lang: uiLocale }

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
  const refreshChrome = () => {
    const next = deriveChromeState()
    // When a blocking surface takes over (dialogue/challenge/menu), collapse the
    // expanded Status Capsule so it doesn't linger over the receded chrome (G).
    if (next !== "world" && next !== "focused") tracker?.collapse?.()
    chrome.set(next)
  }

  // A friendly NPC/anchor name for the capsule + quest section hints ("the
  // boatman" at `docks`), resolved through the special-NPC content when present.
  const anchorName = (anchorId: string): string =>
    specialNpc.anchorName(anchorId, quest.id, undefined, learnerPair.target) ?? prettyAnchorId(anchorId)

  // Focus locks onto the nearest figure (live position each frame) — the wandering
  // crowd AND the now-talkable ambient strollers/stall-keepers (lazy-promoted: a
  // persona is built only on engage, so an un-talked-to extra costs ~nothing). No
  // visible person is un-interactive (world-fix Route 1 / the no-ghost ruling).
  const focus = createNpcFocus(world, overlay, [...crowd.focusables, ...population.focusables], (it) => {
    if (openDialogue) return // hard guard: never stack a second conversation
    const role = (it as CrowdFocusHandle).role
    if (!role) return // every wanderer has a persona now; defensive only
    juice.ring(it.billboard.root.position.x, it.billboard.root.position.z, activeScene.palette?.accent)
    // Lock this NPC for the whole conversation (survives the focus-disable that
    // setWorldActive(false) triggers — the onFocusChange handler ignores churn
    // while engagedId is set).
    engagedId = it.anchorId
    crowd.setHeld(engagedId)
    population.setHeld(engagedId) // freeze an engaged stroller too (no-op for crowd ids)
    setWorldActive(false)
    // If this is a SPECIAL quest NPC (boatman/gatekeeper/clue-giver stationed at a
    // quest anchor), pass the quest engine + `isSpecial` so npcRuntime activates the
    // authored clue/questFacts dialogue (M1) + the deterministic hand-over chain.
    // Generic wanderers get none of this → their dialogue is byte-identical to before.
    const special = specialNpc.forAnchor(it.anchorId, quest.id)
    // DETERMINISTIC objective offer (A2): when the engaged NPC stands AT the active
    // step's anchor, force a "Begin" chip for that step's challenge — so EVERY
    // objective NPC offers its step's challenge, not just the authored special.json
    // ones. (`repeat-after` is the safe default tool for steps without a `toolId`.)
    const curStep = questEngine.currentStep()
    const isObjectiveNpc = !!curStep?.anchorId && it.anchorId === curStep.anchorId
    const forcedOffer = isObjectiveNpc
      ? {
          tool: (curStep?.toolId ?? "repeat-after") as ChallengeToolId,
          chipLabel: vt("quest.begin") === "quest.begin" ? "Begin" : vt("quest.begin"),
        }
      : undefined
    openDialogue = npcRuntime.open({
      npcRole: role,
      scene,
      quest,
      learnerPair,
      container: overlay,
      npcName: special ? specialNpc.displayName(special, undefined, learnerPair.target) : undefined,
      ...(forcedOffer ? { forcedOffer } : {}),
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
        // CROSS-LANGUAGE games (translate / tap-the-meaning / match-pairs) are
        // INHERENTLY two-language: they must ALWAYS keep the native side, even
        // under immersion — collapsing both halves makes a tautology with no
        // answer (#27: "where is the Arabic I'm matching TO?"). Immersion still
        // collapses the native gloss for MONOLINGUAL drills. (A single-language
        // Track — native === target — has no second language, so even these fall
        // back to the resolver; the tool whitelist shouldn't offer them there.)
        const crossLang =
          isCrossLanguageTool(intent.tool) && learnerPair.native !== learnerPair.target
        const ctx: ChallengeContext = {
          language: learnerPair.target,
          nativeLanguage: crossLang ? learnerPair.native : resolver.challengeNativeLanguage(),
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
            // Bailing (X/ESC/backdrop) is NOT a win: skip reward reveal, badges,
            // AND markStepBeaten/advance. Only a real completion celebrates.
            if (res.outcome === "aborted") return
            const granted = inventory().applyReward(res.rewards)
            // The smorgasbord reveal (stacks of bills/coins/ingots) replaces the
            // old "+🪙" toast; route the win's XP into the per-language badges.
            econHud.revealReward(res.rewards, granted)
            badges.depositChallenge({
              result: { toolId: intent.tool, score: res.score, rewards: res.rewards },
              context: ctx,
            })
            // Advance the quest IF the engaged NPC is the CURRENT step's objective
            // NPC and this challenge satisfies that step. A challenge-gated step now
            // REQUIRES the beaten flag before `advance` is honored, so we mark it
            // beaten THEN advance (the deterministic referee — never the model).
            const step = questEngine.currentStep()
            const atObjective = !!step?.anchorId && engagedId === step.anchorId
            if (step && atObjective && challengeSatisfiesStep(step, intent.tool, res.score)) {
              questEngine.markStepBeaten(step.id)
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
    population.setHeld(target ? target.anchorId : null) // mirror for strollers
    // Talk button shown/hidden → the pack dims (`focused`) or restores (`world`).
    refreshChrome()
  })

  // ── Vignettes: enterable sub-experiences (the taxi back-seat) ──────────────
  // The host owns the full enter/exit lifecycle (pause world + free the LLM,
  // recede chrome, build a fullscreen root INSIDE `.wp-overlay`, run, restore).
  // We inject the REAL game services as thin adapters (VIGNETTES.md §5) so a
  // vignette reuses every shipped system (Qwen3 NPCs, challenges, the wallet,
  // TTS, the icon renderer) without importing the orchestrator or a sibling slice.

  // The UI locale is the immersion resolver's `uiLocale()` (computed at the top of
  // buildWorld): NATIVE by default, TARGET under immersion. The chrome i18n catalog
  // (`src/i18n`) backs this seam: for a key the catalog knows, `vt` resolves it into
  // `uiLocale`; for an UNKNOWN key (the taxi/vignette dynamic keys not in the chrome
  // catalog) it returns the key UNCHANGED, preserving the long-standing "key
  // unchanged ⇒ caller applies its inline English fallback" contract the
  // vignette/taxi callers below rely on (their `=== key` checks).
  const KNOWN_KEYS = new Set<string>(ALL_KEYS)
  const vt = (key: string, params?: Record<string, string | number>): string =>
    KNOWN_KEYS.has(key) ? translate(key as I18nKey, uiLocale, params) : key
  // The `Translate` (3-arg) shape some surfaces want (placeTag): resolve known
  // catalog keys into the requested `lang`, else return the key for the inline
  // English fallback. Same key-unchanged contract as `vt`.
  const chromeT = (key: string, lang: string, params?: Record<string, string | number>): string =>
    KNOWN_KEYS.has(key) ? translate(key as I18nKey, lang, params) : key

  // ── Quest completion interlude (A2) ─────────────────────────────────────────
  // On the engine's `complete` event we PAUSE the world and run the standalone
  // celebration → 2–3-way next-quest picker. Picking a card RE-POINTS the active
  // quest (engine + markers + capsule). The interlude is its own `await …show()`
  // (NOT a host vignette). `armCompletionListener` re-subscribes onto the current
  // inner engine each time `setActiveQuest` swaps it.
  let unsubComplete: (() => void) | null = null
  let interludeOpen = false
  const buildNextOptions = (questId: string): NextQuestOption[] =>
    nextQuests(questId).map((q) => {
      const fs = firstStep(q)
      return {
        id: q.id,
        title: q.title,
        whereToGo: fs?.anchorId ? anchorName(fs.anchorId) : q.title,
        whatToDo: fs?.label ?? q.narrative,
        motif: fs?.anchorId,
      }
    })
  const onComplete = async (completed: QuestT) => {
    if (interludeOpen) return
    interludeOpen = true
    // Pause the world while the interlude owns the screen (the menu chrome state
    // recedes the band/pack the same way the menu does).
    setWorldActive(false)
    chrome.set("menu")
    try {
      const interlude = createQuestInterlude({
        overlay,
        completedQuestTitle: completed.title,
        reward: {
          xp: completed.rewards.xp,
          coins: completed.rewards.coins,
          items: completed.rewards.grant,
        },
        newItems: completed.rewards.grant,
        options: buildNextOptions(completed.id),
        accent: scene.palette?.accent,
        iconRenderer,
        locale: uiLocale,
        t: (key, params) => vt(key, params),
        strings: makeInterludeStrings(uiLocale),
      })
      const picked = await interlude.show()
      if (picked) {
        const next = getQuest(picked.chosenQuestId)
        if (next) setActiveQuest(next)
        else console.warn("[world-plaza] picked unknown next quest:", picked.chosenQuestId)
      }
    } catch (e) {
      console.error("[world-plaza] quest interlude failed:", e)
    } finally {
      interludeOpen = false
      setWorldActive(true)
      refreshChrome()
    }
  }
  function armCompletionListener(): void {
    unsubComplete?.()
    unsubComplete = activeEngine.subscribe((e) => {
      if (e.type === "complete") void onComplete(activeEngine.quest())
    })
  }
  armCompletionListener()

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
      // default to the TARGET language if a vignette didn't specify one (R2-2):
      // never let a stale scene voiceHint pick the voice.
      voiceCode: args.voiceCode ?? learnerPair.target,
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
    // Menu chrome (title, Resume, Leave, tabs, "coming soon") in the NATIVE language.
    strings: { menu: makeMenuStrings(uiLocale) },
    sections: {
      badges: badges.section,
      map: createMapSection(mapOpts),
      // REAL Inventory + Quest sections (no more "coming soon"). Inventory = the
      // multi-currency wallet shown properly (named currencies + premium glyphs) +
      // owned items + a badges summary. Quest = the full objective/steps/progress.
      inventory: createInventorySection({
        store: inventory(),
        accent: scene.palette?.accent,
        locale: uiLocale,
        renderer: iconRenderer,
        masteredCount: () => badges.store.masteredCount(),
        openBadges: () => shell.openSection("badges"),
      }),
      quest: createQuestSection({
        engine: questEngine,
        inventory: inventory(),
        anchorName,
        accent: scene.palette?.accent,
        // Lazy locale: the section's `MenuSectionView` runs on each open, so reading
        // the LIVE locale here means re-opening after an immersion flip shows the new
        // language without a world rebuild.
        strings: () => makeSectionStrings(currentUiLocale()),
        // The immersion toggle lives at the top of the Quest section (§8). Hidden
        // for a single-language Track (no native to hide). Flipping it persists the
        // per-Track level and re-localizes IN PLACE (no world rebuild → the player
        // stays exactly put). The toggle's OWN label stays NATIVE (#20b).
        controls: immersionToggleApplies(learnerPair)
          ? (host) => {
              const tog = mountImmersionToggle(host, {
                level: resolver.level(),
                accent: scene.palette?.accent,
                t: bindT(nativeLocale), // #20b: always the learner's native language
                onChange: (next) => {
                  immersionStore.set(learnerPair, next)
                  relocalize(next)
                  tog.setLevel(next)
                },
              })
            }
          : undefined,
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
    // Status-capsule copy (quest label, hints, progress, immersion line, deep-link
    // labels) in the UI locale (native, or target under immersion).
    strings: makeTrackerStrings(uiLocale),
    lang: uiLocale,
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
    lang: uiLocale,
    t: chromeT,
    presenceCount: () => mapView.getRemotePositions().length,
  })

  // Register the three chrome surfaces with the visibility state machine: the
  // capsule + place tag are the "band", the pack button (the shell's satchel,
  // queried out of the overlay) is the "pack" (dims on `focused`, hides on
  // dialogue/challenge/menu). Apply the current state immediately.
  chrome.register({ el: tracker.el, role: "band" })
  chrome.register({ el: placeTag.el, role: "band" })
  // The corner minimap is a "map" surface — it RECEDES during a blocking surface
  // (challenge/dialogue/menu) the same way the band does, so the map doesn't sit
  // over an NPC chat or a centered challenge (G — chrome coherence).
  chrome.register({ el: minimap.el, role: "map" })
  const packButton = overlay.querySelector<HTMLElement>(".wp-menu-button")
  if (packButton) chrome.register({ el: packButton, role: "pack" })
  else console.warn("[world-plaza] pack button (.wp-menu-button) not found — chrome won't govern it")

  // ── Immersion APPLIES IN PLACE (#20) ────────────────────────────────────────
  // Flipping the immersion toggle must NOT rebuild the world or move the player —
  // only the chrome TEXT + RTL `dir` flip. We recompute the resolver + uiLocale,
  // re-orient `dir`, and re-localize the live chrome surfaces in place. The world
  // (Babylon scene, player position, camera, NPCs, quest engine, inventory) is
  // untouched. Modal surfaces (quest section, interlude, inventory) read the LIVE
  // `currentUiLocale()` on their next open, so they pick up the flip for free.
  function relocalize(next: Immersion): void {
    resolver = createImmersionResolver({ level: next, learnerPair })
    uiLocale = resolver.uiLocale()
    // RTL: a target like Arabic flips the whole chrome; a Latin target flips back.
    applyDir(rootEl, uiLocale)
    applyDir(overlay, uiLocale)
    try {
      tracker.relocalize(makeTrackerStrings(uiLocale))
      placeTag.relocalize(uiLocale)
      shell.relocalizeMenu(makeMenuStrings(uiLocale))
    } catch (err) {
      console.error("[world-plaza] immersion relocalize failed:", err)
    }
  }

  // ── Objective wayfinding (G + quest-flow) ───────────────────────────────────
  // ONE source of truth for WHERE the current objective is: the stationed helper
  // NPC's LIVE position if present, else the static city anchor. The road arrow,
  // the over-rooftop beacon, and the map star all resolve through this so they
  // can never disagree (the "I stood on the star and nothing was there" bug was a
  // landmark/anchor mismatch — objective at `plaza`, player drawn to the fountain).
  const objectivePoint = (): { x: number; z: number } | null => {
    const obj = questEngine.getQuestMarkers().find((m) => m.kind === "objective")
    return locateObjective(obj?.anchorId, crowd.focusables, (id) => {
      const a = city.getAnchor(id)
      return a ? { x: a.x, z: a.z } : null
    })
  }

  // A subtle floor marker a few steps ahead of the player pointing at the objective.
  const roadArrow = createRoadArrow(world.scene, {
    getPlayer: () => ({ ...player.getPos(), facing: player.getFacing() }),
    getTarget: objectivePoint,
    accent: scene.palette?.accent,
  })

  // The UNMISSABLE beacon over the objective helper ("talk to THIS one"): a light
  // shaft visible over rooftops + a bobbing chevron + a ground halo, drawn through
  // the world. Suppressed while a conversation / challenge / vignette owns the
  // screen so it never shouts over a modal surface.
  const objectiveBeacon = createObjectiveBeacon(world.scene, {
    getTarget: objectivePoint,
    isSuppressed: () => !!openDialogue || challengeDepth > 0 || vignetteHost.isActive(),
    accent: scene.palette?.accent,
  })

  // TRAVERSE / FIND steps (#26): "Cross the river bridge" had no completable
  // action, so the player walked to the bridge, talked, and NOTHING happened.
  // This watches the active step: when it's a traverse/find step and the player
  // reaches its anchor (the beacon/arrow already point there), it deterministically
  // marks the step beaten + advances — reaching the spot IS the action. Talk steps
  // are ignored (they advance on a won challenge).
  const traversalTrigger = createTraversalTrigger({
    getPlayer: () => player.getPos(),
    currentStep: () => questEngine.currentStep(),
    anchorPoint: (id) => {
      const a = city.getAnchor(id)
      return a ? { x: a.x, z: a.z } : null
    },
    onReach: (stepId) => {
      const step = questEngine.currentStep()
      if (!step || step.id !== stepId) return
      questEngine.markStepBeaten(stepId)
      if (questEngine.advance(stepId)) toast(`✓ ${step.label}`)
    },
  })

  // Dev/QA quest hook (standalone only): lets a Playwright walkthrough drive the
  // REAL game deterministically — read the active step, teleport the player to the
  // current objective's anchor (so a traverse step's proximity trigger fires), and
  // mark the active talk step beaten + advance (emulating a won challenge). This is
  // how #26 is PROVEN in the real flow, not just unit tests. No-op in the host.
  if (typeof window !== "undefined") {
    ;(window as unknown as { __wpQuest?: unknown }).__wpQuest = {
      state: () => {
        const s = questEngine.currentStep()
        return {
          questId: questEngine.quest().id,
          complete: questEngine.state().complete,
          step: s ? { id: s.id, kind: s.kind ?? "talk", anchorId: s.anchorId, label: s.label } : null,
          stepState: questEngine.currentStepState(),
        }
      },
      /** Teleport the player to the current step's anchor (drives traverse steps). */
      gotoObjective: () => {
        const s = questEngine.currentStep()
        const a = s?.anchorId ? city.getAnchor(s.anchorId) : null
        if (a) player.respawnAt(a.x, a.z)
        return !!a
      },
      /** Emulate winning the active talk step's challenge (beaten → advance). */
      winCurrent: () => {
        const s = questEngine.currentStep()
        if (!s) return false
        questEngine.markStepBeaten(s.id)
        return questEngine.advance(s.id)
      },
    }
  }

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
    // World detail (C) + wayfinding (G) per-frame ticks (all cheap, RM-gated).
    fountain.update(dt)
    harborWater?.update(dt)
    riverwalk?.update(dt)
    harborBoats?.update(dt)
    gateDressing?.update(dt)
    population.update(dt, p)
    roadArrow.update(dt)
    objectiveBeacon.update(dt)
    traversalTrigger.update(dt) // walk-to-complete for traverse/find steps (#26)
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
    // Quest completion listener + active engine subscription.
    unsubComplete?.()
    unsubActive?.()
    chrome.dispose()
    placeTag.dispose()
    tracker.dispose()
    shell.dispose()
    focus.dispose()
    crowd.dispose()
    // World detail (C) + wayfinding (G) layers.
    roadArrow.dispose()
    objectiveBeacon.dispose()
    population.dispose()
    harborWater?.dispose()
    riverwalk?.dispose()
    harborBoats?.dispose()
    skyline?.dispose()
    gateDressing?.dispose()
    bridge?.dispose()
    fountain.dispose()
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
