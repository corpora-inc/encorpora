// The seam, guarded at the source.
//
// `cadence.ts` and `reportsToCurriculum` are pure and heavily tested, and
// neither fact is worth anything if `mount.ts` stops calling them. This file
// reads the mount as text — a blunt instrument, used deliberately: the
// alternative is a DOM, a canvas and a rAF harness to assert two call sites.
// Every assertion below names the regression it exists to catch.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

/** Source with every comment stripped, so prose *about* a rule is not the rule. */
const strip = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//")
      return at === -1 ? line : line.slice(0, at)
    })
    .join("\n")

const MOUNT = strip(read("../mount.ts"))
const STATEMENT = strip(read("./statement.ts"))

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1

test("a window that closed on an untouched screen is never sent to the ladder", () => {
  // The regression: the guard is dropped and `slow` goes back across the wire as
  // a wrong answer, demoting a child who was merely deliberate.
  assert.equal(count(MOUNT, "host.report("), 1, "a new report call appeared in mount.ts")
  assert.ok(MOUNT.includes("reportsToCurriculum(event.outcome)"), "the report is unguarded again")
  const settled = MOUNT.slice(MOUNT.indexOf('case "settled"'))
  const guard = settled.indexOf("reportsToCurriculum(")
  const call = settled.indexOf("host.report(")
  assert.ok(guard !== -1 && guard < call, "the report is no longer behind the guard")
})

test("the window comes from the cadence table, with nothing clamping it", () => {
  // The regression: the ceiling comes back — 3600, or any other number — because
  // fourteen seconds "feels slow". It is the number the repo measured.
  assert.ok(STATEMENT.includes("comprehensionMsFor(text)"), "windowFor stopped asking cadence.ts")
  assert.ok(!/1300\s*\+\s*215/.test(STATEMENT), "the old linear window is back")
  assert.ok(!/Math\.min\(3600/.test(STATEMENT), "the old upper clamp is back")
  const fn = STATEMENT.slice(STATEMENT.indexOf("export function windowFor"))
  const body = fn.slice(0, fn.indexOf("\n}"))
  assert.ok(!body.includes("Math.min"), "something is capping the comprehension window again")
  assert.ok(!body.includes("Math.max"), "something is flooring the comprehension window again")
})
