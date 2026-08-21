/**
 * Zero-dependency dev server for the audio foundation.
 *
 * Serves the demo and the measurement harness, transpiling `.ts` on the fly
 * with Node's built-in `module.stripTypeScriptTypes` — no vite, no esbuild, no
 * node_modules. The kit is plain ES modules with `.ts` specifiers, exactly the
 * form Node's `--experimental-strip-types` test runner wants, so the same
 * source runs in the browser and in `node --test` with no build step at all.
 *
 *     node tools/serve.mjs [--port 8788]
 */

import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"
import { stripTypeScriptTypes } from "node:module"

const ROOT = resolve(import.meta.dirname, "..")
const args = process.argv.slice(2)
const portArg = args.indexOf("--port")
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 8788

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

const server = createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url ?? "/").split("?")[0])
    if (url === "/") url = "/demo/index.html"
    const path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ""))
    if (!path.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden")
      return
    }
    const ext = extname(path)
    let body = await readFile(path)
    if (ext === ".ts") {
      // `transform` (not `strip`) so the output has no type-only leftovers and
      // real line numbers via the inline source map.
      body = stripTypeScriptTypes(body.toString("utf8"), {
        mode: "transform",
        sourceMap: true,
        sourceURL: url,
      })
    }
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
      // The demo needs no cross-origin isolation, but stating it makes the
      // WebView behaviour match the browser one.
      "cross-origin-opener-policy": "same-origin",
    })
    res.end(body)
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 500).end(String(e))
  }
})

server.listen(PORT, () => {
  console.log(`dynawalla audio foundation -> http://localhost:${PORT}/`)
  console.log(`  demo     http://localhost:${PORT}/demo/index.html`)
  console.log(`  measure  http://localhost:${PORT}/measure/index.html`)
})
