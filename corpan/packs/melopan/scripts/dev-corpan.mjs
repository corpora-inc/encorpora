/**
 * Melopán dev:corpan — serve the pack to a corpan-app running on a device.
 *
 * All the real work (CORS static server, build:watch, LAN banner, manifest
 * cache-bust) lives in the shared harness. Don't re-add a bespoke server here.
 * See corpan/packs/shared/dev/README.md and PORT REGISTRY.
 */
import { startPackDevServer } from "../../shared/dev/serve-pack.mjs"

startPackDevServer({
  packDir: new URL("..", import.meta.url),
  port: Number(process.env.MELOPAN_DEV_PORT || 8992), // 8992 — see PORT REGISTRY
})
