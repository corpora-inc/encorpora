// The design tokens are a three-layer contract (palette -> semantic ->
// utilities) and every failure mode is silent in a browser: a semantic token
// with no dark counterpart renders the *light* value on a dark ground, a typo
// in a var() name resolves to nothing at all and paints transparent, and a
// hardcoded hex in a component is invisible until someone reviews the dark
// screenshots. None of that throws. These tests are the only thing that reads
// the layering.
//
// Run: npm test  (node --experimental-strip-types --test 'src/**/*.test.ts')

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(here, "..")
const tokensPath = path.join(here, "tokens.css")
const css = fs.readFileSync(tokensPath, "utf8")

/** Extract one brace-balanced block body, given the text that opens it. */
function block(source: string, opener: string): string {
  const start = source.indexOf(opener)
  assert.ok(start !== -1, `tokens.css has no \`${opener}\` block`)
  let depth = 0
  for (let i = start + opener.length - 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return source.slice(start + opener.length, i)
    }
  }
  throw new Error(`unbalanced braces in \`${opener}\``)
}

/** Custom-property declarations in a block body: name -> value. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.trim())
  }
  return out
}

const references = (value: string): string[] =>
  [...value.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!)

const palette = declarations(block(css, "@theme {"))
const utilities = declarations(block(css, "@theme inline {"))
const light = declarations(block(css, ":root {"))
const dark = declarations(block(css, ".dw-dark {"))

/** A semantic token is "material" when it resolves to a palette colour. */
const materialTokens = (decls: Map<string, string>): string[] =>
  [...decls]
    .filter(([, value]) => references(value).some((r) => r.startsWith("--color-")))
    .map(([name]) => name)

test("the semantic layer only names materials the palette defines", () => {
  const defined = new Set([...palette.keys()])
  for (const [name, value] of [...light, ...dark]) {
    for (const ref of references(value)) {
      if (!ref.startsWith("--color-")) continue
      assert.ok(defined.has(ref), `${name} references undefined material ${ref}`)
    }
  }
})

test("every material-derived semantic token is re-cut in dark", () => {
  const lightMaterials = materialTokens(light)
  assert.ok(lightMaterials.length > 10, "expected a real semantic layer")

  const missing = lightMaterials.filter((t) => !dark.has(t))
  assert.deepEqual(missing, [], "semantic tokens with no dark value")
})

test("dark overrides nothing that light has not already defined", () => {
  const orphans = [...dark.keys()].filter((t) => !light.has(t))
  assert.deepEqual(orphans, [], "dark-only tokens have no light default")
})

test("non-material tokens are theme-independent", () => {
  // Motion, radii, safe-area insets and the z ladder carry no colour, so
  // re-declaring them under .dw-dark would mean two sources of truth for a
  // value that cannot differ by theme.
  const material = new Set(materialTokens(light))
  const leaked = [...dark.keys()].filter((t) => !material.has(t))
  assert.deepEqual(leaked, [], "colourless tokens must not be re-declared in dark")
})

test("the utility layer republishes only defined semantic tokens", () => {
  assert.ok(utilities.size > 10, "expected the semantic layer to be exposed to Tailwind")
  for (const [name, value] of utilities) {
    const refs = references(value)
    assert.equal(refs.length, 1, `${name} should map to exactly one semantic token`)
    assert.ok(light.has(refs[0]!), `${name} maps to undefined semantic token ${refs[0]}`)
  }
})

test("reduced motion collapses every motion duration", () => {
  // Adding a fourth duration token and forgetting this block is how a child
  // who asked for no motion gets motion anyway.
  const reduced = declarations(block(css, "@media (prefers-reduced-motion: reduce) {"))
  const durations = [...light.keys()].filter((t) => t.startsWith("--dw-motion-"))
  assert.ok(durations.length >= 3, "expected the motion scale to exist")
  for (const t of durations) {
    assert.equal(reduced.get(t), "0ms", `${t} is not collapsed under reduced motion`)
  }
})

test("components name roles, not materials", () => {
  // `@theme` publishes the palette as Tailwind utilities too, so
  // `bg-parchment-50` compiles, passes the lint, contains no hex for the test
  // below to find — and does not re-cut under `.dw-dark`. That is precisely
  // the silent light-on-dark failure the semantic layer exists to prevent, and
  // it is the most convenient way to bypass it. Tailwind's own built-in
  // palette is the same hazard by a different name.
  const families = new Set<string>()
  for (const name of palette.keys()) {
    const m = /^--color-([a-z]+)-\d+$/.exec(name)
    if (m) families.add(m[1]!)
  }
  for (const builtin of [
    "slate", "gray", "zinc", "neutral", "red", "orange", "amber", "yellow",
    "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
    "violet", "purple", "fuchsia", "pink", "rose", "white", "black",
  ]) {
    families.add(builtin)
  }

  const utility = new RegExp(
    String.raw`\b(?:bg|text|border|fill|stroke|outline|ring|divide|accent|caret|decoration|shadow|placeholder|from|via|to)` +
      String.raw`-(?:${[...families].join("|")})\b`,
    "g",
  )

  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (entry.name.endsWith(".test.ts")) continue
      for (const m of fs.readFileSync(full, "utf8").matchAll(utility)) {
        offenders.push(`${path.relative(srcRoot, full)}: ${m[0]}`)
      }
    }
  }
  walk(srcRoot)

  assert.deepEqual(offenders, [], "material colour utilities in components")
})

test("no colour literal exists outside the palette", () => {
  // The palette block is the only place a hex may appear. Anywhere else it is
  // a colour that cannot follow the theme and cannot be re-cut for dark.
  const paletteBody = block(css, "@theme {")
  const hex = /#[0-9a-fA-F]{3,8}\b/

  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(css|ts|tsx)$/.test(entry.name)) continue
      const text = fs.readFileSync(full, "utf8")
      text.split("\n").forEach((line, i) => {
        if (!hex.test(line)) return
        if (full === tokensPath && paletteBody.includes(line)) return
        if (full === path.join(here, "tokens.test.ts")) return
        offenders.push(`${path.relative(srcRoot, full)}:${i + 1} ${line.trim()}`)
      })
    }
  }
  walk(srcRoot)

  assert.deepEqual(offenders, [], "colour literals outside the palette")
})
