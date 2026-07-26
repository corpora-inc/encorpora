// The app's half of gate CG-8, closed in both directions.
//
// `curriculum/src/render/registry.ts` *declares* which renderers exist and
// cannot check itself, because it may not import the app — so CG-8 trusts a
// boolean. This is the test that makes the boolean true or red, both ways:
//
//   declared implemented → the bundle can draw it
//   the bundle can draw it → declared
//
// Without the first, a curriculum row goes `active` behind a blank space on a
// child's screen, which is the exact failure the gate was written for. Without
// the second, a renderer nobody declared is dead weight no skill can reach.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { answerRendererId, rendererRegistry, repRendererId } from "./curriculum.ts"
import type { AnswerSchemaKind, RepId } from "./curriculum.ts"
import { DRAWABLE_SCHEMA_KINDS } from "./entry.ts"
import { RENDERED_REPRESENTATIONS } from "./representations.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
// `testRef` paths are written from `dynawalla/`, which is three levels up
// from `dynawalla-app/src/work`.
const dynawalla = path.resolve(here, "../../..")

const implemented = rendererRegistry.filter((entry) => entry.implemented)

test("every renderer the curriculum declares implemented, this bundle can draw", () => {
  for (const entry of implemented) {
    if (entry.kind === "answerSchema") {
      const kind = entry.id.slice("answer:".length) as AnswerSchemaKind
      assert.ok(
        DRAWABLE_SCHEMA_KINDS.includes(kind),
        `${entry.id} is declared implemented (${entry.owner}) and no entry model owns it`,
      )
    } else {
      const rep = entry.id.slice("rep:".length) as RepId
      assert.ok(
        RENDERED_REPRESENTATIONS.includes(rep),
        `${entry.id} is declared implemented (${entry.owner}) and nothing in the bundle draws it`,
      )
    }
  }
})

test("everything this bundle can draw is declared, so a skill can reach it", () => {
  const declared = new Set(implemented.map((entry) => entry.id))
  for (const kind of DRAWABLE_SCHEMA_KINDS) {
    assert.ok(
      declared.has(answerRendererId(kind)),
      `the app draws "${kind}" and the curriculum does not declare it implemented`,
    )
  }
  for (const rep of RENDERED_REPRESENTATIONS) {
    assert.ok(
      declared.has(repRendererId(rep)),
      `the app draws "${rep}" and the curriculum does not declare it implemented`,
    )
  }
})

test("a renderer declared implemented names a test that exists", () => {
  // CG-8 requires a `testRef` on anything implemented. It cannot check the path
  // resolves — `curriculum/` has no idea where the app is — so this does. A
  // `testRef` pointing at a file nobody ever wrote is the same as no test.
  for (const entry of implemented) {
    assert.ok(entry.testRef !== undefined && entry.testRef.trim() !== "", `${entry.id} has no testRef`)
    const file = path.join(dynawalla, entry.testRef)
    assert.ok(fs.existsSync(file), `${entry.id} names a test that does not exist: ${entry.testRef}`)
  }
})

test("a renderer that is not implemented claims no test, and names an owner", () => {
  for (const entry of rendererRegistry) {
    assert.ok(entry.owner.trim() !== "", `${entry.id} has no owner`)
    if (entry.implemented) continue
    assert.equal(
      entry.testRef,
      undefined,
      `${entry.id} is not implemented and names a test, which is how a stub passes for a renderer`,
    )
  }
})

test("the gear train is declared and unbuilt, and that is the honest state", () => {
  // It is one of the four V1 representations and it carries multiples, factors
  // and LCM (CURRICULUM.md). None of that content exists, so a renderer for it
  // could not be checked against a single real item — and `--strict-renderers`,
  // which the release checklist runs, is what keeps a skill from going `active`
  // behind it in the meantime.
  const gears = rendererRegistry.find((entry) => entry.id === "rep:gear-train")
  assert.ok(gears !== undefined, "the gear train is not declared at all, so nothing tracks it")
  assert.equal(gears.implemented, false)
  assert.ok(!RENDERED_REPRESENTATIONS.includes("gear-train"))
})
