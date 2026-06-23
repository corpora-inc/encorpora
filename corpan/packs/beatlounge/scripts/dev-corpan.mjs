/**
 * beatlounge dev:corpan — serve the pack to a corpan-app on a device.
 * All real work lives in the shared harness; see shared/dev/README.md.
 */
import { startPackDevServer } from "../../shared/dev/serve-pack.mjs"

startPackDevServer({
  packDir: new URL("..", import.meta.url),
  port: Number(process.env.BEATLOUNGE_DEV_PORT || 8993), // 8993 — see PORT REGISTRY
})
