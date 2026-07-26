// `Q-05`, as one test over the whole tree, plus the two structural rules that
// keep it from being satisfiable by accident.
//
// The acceptance item is a sentence about the source: *a boundary test fails
// the build if anything under `src/reactions/` or `src/world/` imports from
// `src/work/` or the engine.* Both of those directories have their own local
// copy of the check, because a directory should carry its own rule; this one is
// the app-wide statement, and it also catches the two failure modes a
// per-directory check cannot see:
//
//   * an import **cycle** anywhere in `src/`, which is how "the world does not
//     depend on the work surface" quietly becomes untrue through a third file;
//   * an anchor class that has acquired a style, which would make removing it
//     from an element change the picture as well as the reaction.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ANCHORS } from "../design/anchors.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(here, "..")

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full)
  }
  return out
}

const modules = files(src)

/** Relative-import edges, resolved to repo-relative module paths. */
function edges(file: string): string[] {
  const text = fs.readFileSync(file, "utf8")
  const out: string[] = []
  for (const [, specifier] of text.matchAll(/from\s+"(\.[^"]+)"/g)) {
    if (specifier === undefined) continue
    out.push(path.relative(src, path.resolve(path.dirname(file), specifier)))
  }
  return out
}

test("Q-05: nothing under reactions/ or world/ imports the work surface or the engine", () => {
  const offenders: string[] = []
  for (const file of modules) {
    const from = path.relative(src, file)
    if (!from.startsWith("reactions/") && !from.startsWith("world/")) continue
    const text = fs.readFileSync(file, "utf8")
    for (const [, specifier] of text.matchAll(/from\s+"([^"]+)"/g)) {
      const target = specifier ?? ""
      const resolved = target.startsWith(".")
        ? path.relative(src, path.resolve(path.dirname(file), target))
        : target
      if (/^work\//.test(resolved) || /engine|curriculum/.test(resolved)) {
        offenders.push(`${from} -> ${target}`)
      }
    }
  }
  assert.deepEqual(offenders, [], "the work surface leaked into the world")
})

test("the arrow only points one way — there is no import cycle in src/", () => {
  const graph = new Map(modules.map((file) => [path.relative(src, file), edges(file)]))
  const state = new Map<string, "open" | "done">()
  const cycles: string[] = []

  const walk = (node: string, trail: string[]): void => {
    if (state.get(node) === "done") return
    if (state.get(node) === "open") {
      cycles.push([...trail.slice(trail.indexOf(node)), node].join(" -> "))
      return
    }
    state.set(node, "open")
    for (const target of graph.get(node) ?? []) {
      if (graph.has(target)) walk(target, [...trail, node])
    }
    state.set(node, "done")
  }
  for (const node of graph.keys()) walk(node, [])

  assert.deepEqual(cycles, [])
})

test("the anchor classes style nothing", () => {
  // They are a one-way DOM contract between what draws and what lights. The
  // moment one carries a rule, deleting it from an element silently changes the
  // picture too, and the coupling stops being one-way.
  const styled: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".css")) {
        const text = fs.readFileSync(full, "utf8")
        for (const anchor of ANCHORS) {
          if (text.includes(`.${anchor}`)) styled.push(`${path.relative(src, full)}: ${anchor}`)
        }
      }
    }
  }
  walk(src)
  assert.deepEqual(styled, [])
})

test("no inline style anywhere — the CSP forbids it outright", () => {
  // `style-src 'self'` means a `style` prop throws the element's styling away
  // silently in the shipped app while working perfectly in `vite dev`.
  const offenders: string[] = []
  for (const file of modules) {
    const text = fs.readFileSync(file, "utf8")
    if (/\sstyle=\{/.test(text)) offenders.push(path.relative(src, file))
  }
  assert.deepEqual(offenders, [])
})

test("P-09: no streak, timer, countdown or loss surface exists in the app", () => {
  // `P-09` is graded at M10 over the shipped bundle. This is the same sweep run
  // continuously, so the surface never acquires one between now and then.
  const banned = /\b(streak|countdown|timeLeft|secondsLeft|lives|hearts|gameOver|combo)\b/i
  const offenders: string[] = []
  for (const file of modules) {
    const text = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
    if (banned.test(text)) offenders.push(path.relative(src, file))
  }
  assert.deepEqual(offenders, [])
})
