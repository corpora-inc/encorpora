import type { Scene } from "@babylonjs/core/scene"
import type { Material } from "@babylonjs/core/Materials/material"
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer"
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase"
import {
  RegisterMaterialPlugin,
  UnregisterMaterialPlugin,
} from "@babylonjs/core/Materials/materialPluginManager"

/**
 * world/curvature.ts — the PREMIUM "over-the-horizon" reveal (SPIKE).
 *
 * THE ILLUSION. The ground curves away from you like the surface of a small
 * planet. Distant buildings sit BELOW the horizon line — you literally cannot
 * see them — and as you walk toward them they RISE up over the hill into view.
 * This is the Animal Crossing / The Witness "curved world" effect. It hides the
 * chunk-streaming boundary behind real-feeling topology: a chunk doesn't "pop
 * in", it CRESTS the horizon.
 *
 * THE MATH (Aitchison's canonical form, spherical roll-off). Every vertex's
 * WORLD-space Y is offset downward as a function of its squared horizontal
 * distance from the camera:
 *
 *     drop = (dx*dx + dz*dz) * curvature        // curvature < 0 → sinks
 *     worldPos.y += drop
 *
 * Quadratic, so it's nearly flat right around you (gameplay reads normal) and
 * accelerates with distance (the dramatic crest). Spherical (x²+z²) so it bends
 * in ALL directions — correct no matter which way the cruise cam faces (the
 * cheaper z²-only cylindrical variant would look wrong as you turn).
 *
 * HOW IT REACHES EVERY MESH (the reason this is cheap in our stack). Our world
 * shares ~6 PBR materials (buildings + ground) and StandardMaterials (the
 * yaw-billboard paper-people, props, contact shadows). `RegisterMaterialPlugin`
 * attaches this plugin to EVERY material as it's instantiated — PBR and
 * Standard alike — so ONE registration bends the entire world with zero
 * per-mesh wiring and no forked materials.
 *
 * THE HOOK. We inject at `CUSTOM_VERTEX_UPDATE_WORLDPOS`, which runs right after
 * Babylon computes `worldPos = finalWorld * vec4(positionUpdated, 1.0)` and
 * right before `gl_Position = viewProjection * worldPos`. So we bend the FINAL
 * world position (post-instancing, post-billboard-rotation) — exactly what we
 * want: a billboard NPC's grounded plane sinks WITH the terrain instead of
 * floating. We also nudge `vPositionW` (when present) so per-pixel lighting/fog
 * agree with the bent geometry.
 *
 * RENDER-ONLY. The bend lives entirely in the vertex shader. Collision
 * (StreamingCollision, pure XZ AABBs) and the minimap (top-down XZ projection)
 * never see vertex Y, so the world stays FLAT for all gameplay while the picture
 * curves. No gameplay system changes.
 *
 * EXCLUSIONS. Things that ride the camera / live on the horizon as backdrop must
 * NOT bend: the sky dome, the hero vista, the atmosphere meshes, AND the distant
 * skyline bands (`wp-skyline-*`, env-art's horizon city silhouette). They stay
 * pinned to the horizon; bending them would make them dip with the ground and
 * tear away from the sky. `applyWorldCurvature` disables the plugin on materials
 * whose name matches `excludeMatch`.
 *
 * TUNABLE BY FEEL (no rebuild). The owner dials curvature by eye, so the strength
 * is read from `localStorage["wp:curvature"]` at apply time (falling back to the
 * passed value / `DEFAULT_CURVATURE`), and a live setter is exposed on
 * `window.__wpCurvature` so the strength can be nudged from the console and seen
 * instantly. `setCurvature()` also persists to localStorage so the choice sticks.
 */

const PLUGIN_NAME = "WorldCurve"

/**
 * Curvature strength (negative → distant geometry sinks). Tuned for our metric
 * world + low cruise cam: at ~150u out a building drops ~(150²·0.0026)≈58u, well
 * below the horizon, then crests smoothly as you close. STRONG by default per the
 * owner ("try strong first"); dial live via setCurvature / `wp:curvature`.
 * Usable range ≈ -0.0008 (subtle) … -0.0026 (this, a bold tiny-planet crest);
 * past ~-0.004 a billboard BEYOND the crest can visibly float, so we clamp there.
 */
export const DEFAULT_CURVATURE = -0.0026

/** localStorage key the owner can set to dial curvature without a rebuild. */
const LS_KEY = "wp:curvature"

/** Clamp to the sane visual range so a stray dial can't break grounding. */
const clampCurvature = (c: number): number => Math.max(-0.004, Math.min(0, c))

/** Read the owner's localStorage override, if any (else the passed fallback). */
const readOverride = (fallback: number): number => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null
    if (raw == null || raw === "") return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? clampCurvature(n) : fallback
  } catch {
    return fallback
  }
}

// Shared live state read by every plugin instance's bind (one world, one curve).
const state = {
  curvature: DEFAULT_CURVATURE,
  // camera ground position (the roll-off centre); updated each frame.
  cx: 0,
  cz: 0,
}

class WorldCurvePlugin extends MaterialPluginBase {
  constructor(material: Material) {
    // priority 200 → runs after Babylon's built-in vertex plugins. enable=true.
    super(material, PLUGIN_NAME, 200, { WORLD_CURVE: true })
    this._enable(true)
  }

  // keep our #define on whenever the plugin is enabled.
  override prepareDefines(defines: Record<string, unknown>): void {
    defines.WORLD_CURVE = true
  }

  override getClassName(): string {
    return "WorldCurvePlugin"
  }

  // Declare the uniforms (added to the material UBO + injected into the vertex
  // shader source so the GLSL below can read them).
  override getUniforms() {
    return {
      ubo: [
        { name: "wcCurvature", size: 1, type: "float" },
        { name: "wcCenter", size: 3, type: "vec3" },
      ],
      vertex: `#ifdef WORLD_CURVE
uniform float wcCurvature;
uniform vec3 wcCenter;
#endif`,
    }
  }

  // Push the live curvature + camera centre every submesh bind (cheap scalar set).
  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("wcCurvature", state.curvature)
    uniformBuffer.updateFloat3("wcCenter", state.cx, 0, state.cz)
  }

  // Inject the bend at UPDATE_WORLDPOS: `worldPos` is final world space here.
  override getCustomCode(shaderType: string): { [point: string]: string } | null {
    if (shaderType !== "vertex") return null
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
      #ifdef WORLD_CURVE
        {
          vec3 wcRel = worldPos.xyz - wcCenter;
          float wcDrop = (wcRel.x * wcRel.x + wcRel.z * wcRel.z) * wcCurvature;
          worldPos.y += wcDrop;
          #ifdef NORMAL
            vPositionW.y += wcDrop; // keep lit/fogged shading consistent with the bend
          #endif
        }
      #endif
      `,
    }
  }
}

export interface WorldCurvature {
  /** live dial — raise magnitude for a more dramatic crest. */
  setCurvature: (c: number) => void
  getCurvature: () => number
  dispose: () => void
}

export interface CurvatureOptions {
  /** the camera/player ground position each frame (the roll-off centre). */
  getCameraGroundPos: () => { x: number; z: number }
  /** initial curvature; defaults to DEFAULT_CURVATURE. */
  curvature?: number
  /**
   * Material-name substrings to EXCLUDE from bending (the plugin is disabled on
   * matching materials). Defaults exclude the sky dome, the atmosphere meshes, the
   * hero vista, and the distant skyline bands — every horizon/backdrop layer that
   * must stay pinned to the horizon rather than dip with the ground.
   */
  excludeMatch?: string[]
}

/** Every horizon/backdrop layer that must NOT bend (rides the camera or lives on
 *  the horizon line as a flat). Match is by material-name substring. */
const DEFAULT_EXCLUDES = ["dome", "wp-vista", "wp-atmo", "wp-skyline"]

/**
 * Register the global curvature plugin and feed it the live camera centre.
 * Mirrors `applyAtmosphere`'s shape: apply to a finished scene, return dispose().
 */
export function applyWorldCurvature(scene: Scene, opts: CurvatureOptions): WorldCurvature {
  // localStorage override (owner's by-feel dial) wins over the passed default.
  state.curvature = readOverride(opts.curvature ?? DEFAULT_CURVATURE)
  const exclude = opts.excludeMatch ?? DEFAULT_EXCLUDES

  // ONE registration → attaches to every PBR + Standard material on creation.
  RegisterMaterialPlugin(PLUGIN_NAME, (material) => new WorldCurvePlugin(material))

  // Disable the plugin on excluded materials (sky dome, hero vista). The factory
  // already ran for materials created BEFORE this call, so sweep existing ones
  // too, then watch for new ones.
  const isExcluded = (name: string) => exclude.some((m) => name.includes(m))
  const disableOn = (material: Material) => {
    if (!isExcluded(material.name)) return
    const plugin = (
      material as unknown as { pluginManager?: { getPlugin(n: string): MaterialPluginBase | null } }
    ).pluginManager?.getPlugin(PLUGIN_NAME)
    // _enable(false) drops the #define so the material renders un-bent.
    ;(plugin as unknown as { _enable?: (b: boolean) => void } | null)?._enable?.(false)
  }
  for (const m of scene.materials) disableOn(m)
  const addObs = scene.onNewMaterialAddedObservable.add(disableOn)

  // Feed the live camera centre each frame (cheap; before render so the bind
  // this frame uses the current centre).
  const frameObs = scene.onBeforeRenderObservable.add(() => {
    const p = opts.getCameraGroundPos()
    state.cx = p.x
    state.cz = p.z
  })

  const setCurvature = (c: number) => {
    state.curvature = clampCurvature(c)
    // persist so the by-feel choice survives a reload (and the pack rebuild).
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, String(state.curvature))
    } catch {
      /* private mode / no storage — in-memory dial still works this session */
    }
  }

  // Live console dial: `__wpCurvature.set(-0.0018)` to nudge by feel and see it
  // instantly; `.get()` to read the current value. (Exposed for the owner; a thin
  // debug hook, not a gameplay surface.)
  const win = globalThis as unknown as {
    __wpCurvature?: { set: (c: number) => void; get: () => number }
  }
  win.__wpCurvature = { set: setCurvature, get: () => state.curvature }

  return {
    setCurvature,
    getCurvature: () => state.curvature,
    dispose: () => {
      scene.onBeforeRenderObservable.remove(frameObs)
      scene.onNewMaterialAddedObservable.remove(addObs)
      UnregisterMaterialPlugin(PLUGIN_NAME)
      if (win.__wpCurvature) delete win.__wpCurvature
    },
  }
}
