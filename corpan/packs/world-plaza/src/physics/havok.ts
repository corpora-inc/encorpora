/**
 * physics/havok.ts — best-in-class physics foundation for World Plaza.
 *
 * Havok is the AAA physics engine (Halo, Assassin's Creed, Destiny) shipped as a
 * Babylon plugin + WASM core — it runs in our exact stack (web pack in a WebView)
 * with NO re-platform. This module owns the one-time async init of the Havok WASM
 * and enabling it on a scene. Everything physics-backed (the capsule character
 * controller, static world colliders) builds on `enableHavok`.
 *
 * The init is ASYNC (the WASM must download + instantiate). Callers await it once
 * before building the physics-backed controller; gravity is the city's down.
 */
import HavokPhysics from "@babylonjs/havok"
// Bundle the WASM as a Vite asset so it's served with the correct
// `application/wasm` MIME (a bare HavokPhysics() fetch hits the SPA fallback HTML
// → "module doesn't start with '\0asm'"). `?url` gives the hashed asset path we
// hand to Havok via `locateFile`.
// Relative path (not the package specifier) bypasses Havok's `exports` map, which
// only exposes "." — Vite then resolves the file directly + emits it as a hashed
// asset served with the right MIME.
import havokWasmUrl from "../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm?url"
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Scene } from "@babylonjs/core/scene"

let havokInstance: Awaited<ReturnType<typeof HavokPhysics>> | null = null
let initPromise: Promise<Awaited<ReturnType<typeof HavokPhysics>>> | null = null

/** Load + cache the Havok WASM instance once (idempotent across worlds/reloads). */
export async function loadHavok(): Promise<Awaited<ReturnType<typeof HavokPhysics>>> {
  if (havokInstance) return havokInstance
  if (!initPromise) {
    initPromise = HavokPhysics({ locateFile: () => havokWasmUrl }).then((hk) => {
      havokInstance = hk
      return hk
    })
  }
  return initPromise
}

/**
 * Enable Havok physics on a scene (gravity = Earth down). Returns the live
 * HavokPlugin so the caller can drive the character controller against it.
 * Idempotent-safe per scene: enabling twice is a no-op Babylon guards.
 */
export async function enableHavok(scene: Scene): Promise<HavokPlugin> {
  const hk = await loadHavok()
  const plugin = new HavokPlugin(true /* useDeltaForWorldStep */, hk)
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin)
  return plugin
}

/** Whether the Havok WASM has finished loading (for a UI gate / feature flag). */
export function havokReady(): boolean {
  return havokInstance !== null
}
