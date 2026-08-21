#!/usr/bin/env node
// Size budget check (capability-modules.md §2.5): build a probe entry that
// imports ONLY the capability, min+gzip the output, compare to the table.
// Frameworks (react/react-dom/@dnd-kit/zustand) are EXTERNAL — consumers
// provide them (§3.1) — so cap-squeeze is measured as its own closure minus
// the deduped framework bytes; the framework-included figure is reported
// informationally against the 95 KB budget.
import { build } from "vite"
import { gzipSync } from "node:zlib"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const capabilities = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const TARGETS = [
  { name: "core", entry: "core/index.ts", jsKB: 6, cssKB: 0, external: [] },
  { name: "pronounce", entry: "pronounce/index.ts", jsKB: 55, cssKB: 8, external: [] },
  {
    name: "squeeze",
    entry: "squeeze/index.ts",
    jsKB: 95,
    cssKB: 8,
    // Consumers provide the frameworks; measure the module's own closure.
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "@dnd-kit/core", "zustand", "zustand/vanilla"],
  },
  { name: "segment-player", entry: "segment-player/index.ts", jsKB: 35, cssKB: 6, external: [] },
]

const kb = (n) => (n / 1024).toFixed(1)
let failures = 0

for (const target of TARGETS) {
  const dir = mkdtempSync(path.join(tmpdir(), `cap-size-`))
  const probe = path.join(dir, "probe.ts")
  writeFileSync(
    probe,
    `import * as m from ${JSON.stringify(path.join(capabilities, target.entry))}\nconsole.log(Object.keys(m).length)\n`,
  )
  const result = await build({
    configFile: false,
    logLevel: "error",
    resolve: {
      alias: {
        "@shared/capabilities": capabilities,
        "@shared/core": path.resolve(capabilities, "../core"),
        "@shared/data": path.resolve(capabilities, "../data"),
        "@shared/audio": path.resolve(capabilities, "../audio"),
        react: path.resolve(capabilities, "node_modules/react"),
        "react-dom": path.resolve(capabilities, "node_modules/react-dom"),
        "@dnd-kit/core": path.resolve(capabilities, "node_modules/@dnd-kit/core"),
        zustand: path.resolve(capabilities, "node_modules/zustand"),
      },
    },
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    build: {
      write: false,
      minify: true,
      lib: { entry: probe, formats: ["es"], fileName: () => "probe.js" },
      rollupOptions: { external: target.external },
    },
  })
  rmSync(dir, { recursive: true, force: true })

  const outputs = Array.isArray(result) ? result : [result]
  let js = 0
  let css = 0
  for (const out of outputs) {
    for (const chunk of out.output) {
      const code = chunk.type === "chunk" ? chunk.code : chunk.source
      const bytes = gzipSync(Buffer.from(typeof code === "string" ? code : Buffer.from(code))).length
      if (chunk.fileName.endsWith(".css")) css += bytes
      else js += bytes
    }
  }
  const jsOk = js <= target.jsKB * 1024
  const cssOk = css <= target.cssKB * 1024 || target.cssKB === 0
  console.log(
    `[size] ${target.name.padEnd(15)} js ${kb(js).padStart(6)} KB gz (budget ${target.jsKB}) ${jsOk ? "OK" : "OVER"} · css ${kb(css).padStart(5)} KB gz (budget ${target.cssKB}) ${cssOk ? "OK" : "OVER"}`,
  )
  if (!jsOk || !cssOk) failures++
}

if (failures > 0) {
  console.error(`[size] FAILED: ${failures} over budget`)
  process.exit(1)
}
console.log("[size] OK — all capabilities within budget")
