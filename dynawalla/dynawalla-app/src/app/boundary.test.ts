// The structural rules for the whole tree, in one place.
//
// Three of them are inherited and still worth their keep — the import graph is
// acyclic, no inline style survives the CSP, and no streak or loss surface has
// crept in. The fourth is new and is the point of this milestone: **the host
// ships no content.**
//
// That last one is a rule about a directory tree, so it is tested as one. The
// founder's ruling is that every game, exercise, world, asset and piece of
// curriculum lives in a pack and none of it ships in the app (ADR-0022), and
// the way that erodes is not a pull request titled "put the curriculum back" —
// it is one import, from one screen, of one generator, because it was easier
// than defining the boundary.
//
// It has exactly one exemption — the pack SDK's entry point, which is the
// contract both sides are built against rather than anything either side runs —
// and the exemption has a test of its own, because an exemption nobody measures
// is how the boundary erodes on the second try.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

/**
 * The one module outside `src/` the host may import: the pack SDK's public
 * entry point.
 *
 * This is not an exception to "the host ships no content" — it is what makes
 * the rule enforceable. `dynawalla/packs/sdk` is the *contract*: the capability
 * table, the manifest schema, the wire protocol and the version arithmetic that
 * the host and every pack have to agree on. Nothing in it generates a problem,
 * judges an answer, or knows what arithmetic is. Sharing one copy is
 * load-bearing rather than convenient — a change that would break an installed
 * pack fails to typecheck in the host too, which is precisely the failure a
 * second copy of the contract would hide.
 *
 * The exemption is one file, not a directory: a pack imports the entry point
 * and nothing else, and so does the host. Reaching past it — into
 * `packs/shared/curriculum`, or into an SDK module directly — is still an
 * offence, and the test below holds the entry point to re-exporting nothing but
 * its own siblings so that the exemption cannot become a tunnel.
 */
const SDK_ENTRY = path.resolve(src, "../../packs/sdk/src/index.ts")

/**
 * The second, and last, module outside `src/` the host may import: the
 * curriculum's public entry point.
 *
 * This is a **reversal of part of ADR-0022, recorded in ADR-0023**, and it is
 * worth stating why rather than quietly widening a guard.
 *
 * The pack contract this repository shipped makes the host the judge, and says
 * so in the protocol itself: `items.next` does not carry the answer, and
 * `items.answer` records the attempt *before* it returns the canonical value.
 * That is what makes "a mathematics game cannot be beaten by fiddling with the
 * game" a property rather than a hope. A host with no arithmetic cannot honour
 * it — it can only hand the whole item contract back to the pack, which is the
 * thing the contract exists to prevent.
 *
 * So the split is not "content in packs, nothing in the host". It is:
 *
 *   * **packs** own every game, world, asset, screen and sound. All of it.
 *   * **the host** owns the mathematics: which item, and whether it was right.
 *
 * `packs/shared/curriculum` is the second of those. It has no DOM, no assets,
 * no screens and no game in it — it is exact rational arithmetic, seeded
 * generators and executable mal-rules. `dynawalla/curriculum/` and
 * `dynawalla/engine/` remain out of bounds, and the scan below still says so.
 *
 * Like the SDK exemption this is one file, and the walk below holds it to
 * re-exporting nothing outside its own package, so it cannot become a tunnel.
 */
const CURRICULUM_ENTRY = path.resolve(src, "../../packs/shared/curriculum/src/index.ts")

/**
 * The only modules in the host that may know what an exercise is: the page that
 * names the curriculum, and the service built on it.
 *
 * The exemption is a *file*, not a rule about words, because that is what keeps
 * it reviewable: everything the host believes about arithmetic is on one page,
 * and a second page acquiring an opinion fails this suite.
 */
const ARITHMETIC_MODULES = ["packs/curriculum.ts", "packs/items.ts"]

/**
 * A module's source with its comments removed.
 *
 * Every scan in this file is a regular expression over source text, and a
 * comment is the one place where a sentence is free to look exactly like code.
 * The prose in `packs/sdk/src/capabilities.ts` ends "…a different thing from
 * "not gated yet"", which the import pattern reads as an import of a module
 * called `not gated yet`. A structural guard that fires on prose gets relaxed
 * the first time it is wrong, so it must not be wrong.
 *
 * The `[^:]` before `//` is what keeps `https://` in a comment from truncating
 * the line it is on.
 */
function code(file: string): string {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

/** Every import specifier in a module, relative and bare alike. */
function specifiers(file: string): string[] {
  return [...code(file).matchAll(/from\s+"([^"]+)"/g)].map(([, specifier]) => specifier ?? "")
}

/** Relative-import edges, resolved to `src`-relative module paths. */
function edges(file: string): string[] {
  return specifiers(file)
    .filter((specifier) => specifier.startsWith("."))
    .map((specifier) => path.relative(src, path.resolve(path.dirname(file), specifier)))
}

test("the host imports no curriculum and no content of any kind", () => {
  // The two neighbours are the tell. `dynawalla/curriculum/` is the exercise
  // generators and `dynawalla/engine/` is the learner model: the first is
  // content and belongs to packs; the second is the host's, and is waiting for
  // a pack to declare a skill catalog it can model (ADR-0022). Either one
  // reached from `src/` today means content came back into the app.
  const offenders: string[] = []
  for (const file of modules) {
    for (const specifier of specifiers(file)) {
      const resolved = specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null
      // The contract, and only the contract. Every other path out of `src/` is
      // still an offence, including another file in the same SDK directory.
      if (resolved === SDK_ENTRY) continue
      if (resolved === CURRICULUM_ENTRY) {
        // `packs/curriculum.ts` is the single module that names it. Every other
        // module in the host reaches the curriculum through that one page, so
        // "what does the host use out of it" is a file you can read.
        if (path.relative(src, file) === "packs/curriculum.ts") continue
        offenders.push(`${path.relative(src, file)} -> ${specifier}`)
        continue
      }
      const outside = resolved === null ? specifier : path.relative(src, resolved)
      if (/(^|\/)(curriculum|engine)(\/|$)/.test(outside) || outside.startsWith("..")) {
        offenders.push(`${path.relative(src, file)} -> ${specifier}`)
      }
    }
  }
  assert.deepEqual(offenders, [], "the host reached outside itself for content")
})

test("the imports that leave src/ are the contract and the curriculum, and nothing else", () => {
  // The exemption above is safe only while it names a real file that re-exports
  // nothing but the SDK's own modules. One `export * from "../shared/curriculum"`
  // in the entry point would put every generator back inside the host through a
  // door the offender scan waves past, with the whole suite still green — so the
  // door is measured here rather than assumed.
  assert.ok(fs.existsSync(SDK_ENTRY), "the exempted contract does not exist")

  const sdk = path.dirname(SDK_ENTRY)
  const escapes: string[] = []
  const seen = new Set<string>()

  const walk = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    for (const specifier of specifiers(file)) {
      const target = specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null
      if (target === null || path.relative(sdk, target).startsWith("..")) {
        escapes.push(`${path.relative(sdk, file)} -> ${specifier}`)
        continue
      }
      walk(target)
    }
  }
  walk(SDK_ENTRY)

  assert.deepEqual(escapes, [], "the pack contract reaches outside itself")
})

test("the curriculum the host imports is arithmetic, and only arithmetic", () => {
  // The same measurement applied to the second exemption. A curriculum entry
  // that re-exported a renderer, an asset loader or anything with a DOM in it
  // would put content back in the host through a door the offender scan waves
  // past, with the whole suite still green.
  assert.ok(fs.existsSync(CURRICULUM_ENTRY), "the exempted curriculum does not exist")

  const pkg = path.resolve(path.dirname(CURRICULUM_ENTRY), "..")
  const escapes: string[] = []
  const dom: string[] = []
  const seen = new Set<string>()

  const walk = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    // No DOM and no Node builtin: the curriculum runs identically in the host,
    // in a Node test and (one day) in a worker, and anything that reaches for a
    // document is a renderer wearing a generator's name.
    if (/\b(document|window|localStorage|HTMLElement)\b/.test(code(file))) {
      dom.push(path.relative(pkg, file))
    }
    for (const specifier of specifiers(file)) {
      const target = specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null
      if (target === null || path.relative(pkg, target).startsWith("..")) {
        escapes.push(`${path.relative(pkg, file)} -> ${specifier}`)
        continue
      }
      walk(target)
    }
  }
  walk(CURRICULUM_ENTRY)

  assert.deepEqual(escapes, [], "the curriculum reaches outside itself")
  assert.deepEqual(dom, [], "the curriculum touches the DOM")
})

test("exactly one module in the host knows what an exercise is", () => {
  // Named for what they were when they shipped in the app: a keypad, a judge,
  // a mal-rule diagnosis, a deck of problems. The host serves and judges items
  // again (ADR-0023) — but through `packs/items.ts` and nowhere else, so this
  // is now an exact list rather than an empty one. A screen, a store or a
  // component acquiring an opinion about arithmetic fails here.
  //
  // `keypad` stays banned outright: a work surface is a pack's, always. The
  // host deleted `src/work/` and is not getting it back through a component
  // that happens to draw ten buttons.
  const banned = /\b(exercise|malRule|misconception|numerator|denominator|regroup|minuend|subtrahend)\b/i
  const offenders: string[] = []
  const keypads: string[] = []
  for (const file of modules) {
    const source = code(file)
    if (/\bkeypad\b/i.test(source)) keypads.push(path.relative(src, file))
    if (banned.test(source)) offenders.push(path.relative(src, file))
  }
  assert.deepEqual(keypads, [], "a work surface belongs to a pack")
  assert.deepEqual(offenders.sort(), ARITHMETIC_MODULES, "arithmetic outside the item service")
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

test("the world draws a number and knows nothing else", () => {
  // `src/world/` is the progress figure: pure geometry over one integer, with
  // its text alternative handed in. It must not reach into a store, a setting
  // or the app's copy — that is what keeps it a drawing rather than a screen,
  // and it is why it survived a milestone that deleted everything around it.
  const offenders: string[] = []
  for (const file of modules) {
    const from = path.relative(src, file)
    if (!from.startsWith("world/")) continue
    for (const specifier of specifiers(file)) {
      const resolved = specifier.startsWith(".")
        ? path.relative(src, path.resolve(path.dirname(file), specifier))
        : specifier
      const allowed =
        resolved.startsWith("world/") || resolved === "app/persist.ts" || resolved === "zustand"
      if (!allowed && !resolved.startsWith("zustand/")) offenders.push(`${from} -> ${specifier}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test("no inline style anywhere — the CSP forbids it outright", () => {
  // `style-src 'self'` means a `style` prop throws the element's styling away
  // silently in the shipped app while working perfectly in `vite dev`.
  const offenders: string[] = []
  for (const file of modules) {
    if (/\sstyle=\{/.test(fs.readFileSync(file, "utf8"))) offenders.push(path.relative(src, file))
  }
  assert.deepEqual(offenders, [])
})

test("P-09: no streak, timer, countdown or loss surface exists in the app", () => {
  // `P-09` is graded at M10 over the shipped bundle. This is the same sweep run
  // continuously, so the surface never acquires one between now and then.
  const banned = /\b(streak|countdown|timeLeft|secondsLeft|lives|hearts|gameOver|combo)\b/i
  const offenders: string[] = []
  for (const file of modules) {
    if (banned.test(code(file))) offenders.push(path.relative(src, file))
  }
  assert.deepEqual(offenders, [])
})
