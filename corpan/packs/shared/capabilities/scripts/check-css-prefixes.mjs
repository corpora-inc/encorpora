#!/usr/bin/env node
// CSS prefix lint (capability-modules.md §7.4): every selector in a
// capability's stylesheet must start with its owned prefix class (or a
// --<prefix> custom property); keyframe names must be prefixed too.
// Fails the build on any bare element selector, :root, or *.
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

const MODULES = [
  { file: "../pronounce/styles.css", prefix: "capPron" },
  { file: "../squeeze/styles.css", prefix: "capSqz" },
  { file: "../segment-player/styles.css", prefix: "capSeg" },
]

let failures = 0

for (const { file, prefix } of MODULES) {
  const css = readFileSync(path.resolve(here, file), "utf8")
    // strip comments
    .replace(/\/\*[\s\S]*?\*\//g, "")

  // Walk top-level statements: selectors before "{", at-rules.
  const selectorRe = /(^|[}])([^{}@]+)\{/g
  let m
  while ((m = selectorRe.exec(css)) !== null) {
    const group = m[2].trim()
    if (!group) continue
    for (const selRaw of group.split(",")) {
      const sel = selRaw.trim()
      if (!sel) continue
      // Keyframe step selectors (from/to/NN%) live inside prefixed keyframes.
      if (/^(from|to|\d+(\.\d+)?%)$/.test(sel)) continue
      if (!sel.startsWith(`.${prefix}-`)) {
        console.error(`[css-prefix] ${file}: selector does not start with .${prefix}-: "${sel}"`)
        failures++
      }
    }
  }

  // Keyframe names must carry the prefix.
  const kfRe = /@keyframes\s+([A-Za-z0-9_-]+)/g
  while ((m = kfRe.exec(css)) !== null) {
    if (!m[1].startsWith(`${prefix}-`)) {
      console.error(`[css-prefix] ${file}: keyframes not prefixed: "${m[1]}"`)
      failures++
    }
  }

  // Custom properties defined here must be namespaced --<prefix>-.
  const varDefRe = /(^|[\s;{])--([A-Za-z0-9-]+)\s*:/g
  while ((m = varDefRe.exec(css)) !== null) {
    if (!m[2].startsWith(`${prefix}-`)) {
      console.error(`[css-prefix] ${file}: custom property not namespaced: "--${m[2]}"`)
      failures++
    }
  }

  // Forbidden: viewport units, fixed positioning, safe-area env (§2.4.4).
  for (const [pattern, why] of [
    [/\b\d+(\.\d+)?(vh|vw|dvh|dvw|vmin|vmax)\b/, "viewport units"],
    [/position:\s*fixed/, "position: fixed"],
    [/env\(safe-area/, "safe-area env()"],
  ]) {
    if (pattern.test(css)) {
      console.error(`[css-prefix] ${file}: forbidden ${why} (capability CSS is container-relative)`)
      failures++
    }
  }
}

if (failures > 0) {
  console.error(`[css-prefix] FAILED: ${failures} violation(s)`)
  process.exit(1)
}
console.log("[css-prefix] OK — all capability selectors are prefix-scoped")
