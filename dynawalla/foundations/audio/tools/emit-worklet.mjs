/**
 * Write the worklet processors out as a plain `.js` file.
 *
 * The kit normally loads them from a Blob URL, which needs no build step and no
 * asset to lose. A host with a strict CSP (`script-src 'self'`, which is Tauri's
 * default) will refuse a `blob:` script — for those, serve this file from your
 * own origin and pass its URL:
 *
 *     node tools/emit-worklet.mjs public/dw-audio-worklet.js
 *     createAudio({ workletUrl: "/dw-audio-worklet.js" })
 *
 * The output is byte-identical to the string the kit would have used, so the
 * two paths can never drift.
 */

import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { stripTypeScriptTypes } from "node:module"

const ROOT = resolve(import.meta.dirname, "..")
const out = resolve(process.cwd(), process.argv[2] ?? "dw-audio-worklet.js")

const src = await readFile(resolve(ROOT, "src/worklets/source.ts"), "utf8")
const js = stripTypeScriptTypes(src, { mode: "transform" })
const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`)

await writeFile(out, mod.WORKLET_SOURCE, "utf8")
console.log(`wrote ${out} (${mod.WORKLET_SOURCE.length} bytes)`)
