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
 * EXCLUSIONS. The camera-locked sky dome and the hero vista (the one landmark
 * meant to stand eternal on the far horizon) must NOT bend — `applyWorldCurvature`
 * disables the plugin on materials whose name matches `excludeMatch`.
 *
 * SPIKE STATUS. Minimal wire-in, new module. `curvature` is a single dial
 * exposed as `DEFAULT_CURVATURE` + a live setter. Frustum-culling robustness for
 * the far ring (gotcha #4 in REVEAL_RESEARCH.md) is intentionally deferred — the
 * spike proves the LOOK; the enable-radius tuning lands with the full build.
 */

const PLUGIN_NAME = "WorldCurve"

/**
 * Curvature strength (negative → distant geometry sinks). Tuned for our metric
 * world + low cruise cam: at ~150u out a building drops ~(150²·0.0016)≈36u, well
 * below the horizon, then crests smoothly as you close. Dial live via setCurvature.
 */
export const DEFAULT_CURVATURE = -0.0016

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
   * matching materials). Defaults exclude the sky dome + the hero vista, which
   * must stay put on the horizon.
   */
  excludeMatch?: string[]
}

/**
 * Register the global curvature plugin and feed it the live camera centre.
 * Mirrors `applyAtmosphere`'s shape: apply to a finished scene, return dispose().
 */
export function applyWorldCurvature(scene: Scene, opts: CurvatureOptions): WorldCurvature {
  state.curvature = opts.curvature ?? DEFAULT_CURVATURE
  const exclude = opts.excludeMatch ?? ["dome", "wp-vista", "wp-atmo"]

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

  return {
    setCurvature: (c: number) => {
      state.curvature = c
    },
    getCurvature: () => state.curvature,
    dispose: () => {
      scene.onBeforeRenderObservable.remove(frameObs)
      scene.onNewMaterialAddedObservable.remove(addObs)
      UnregisterMaterialPlugin(PLUGIN_NAME)
    },
  }
}
