// The one thing about a pack that no builder can measure: how hard it is on a
// pair of five-year-old hands.
//
// `minAge` is OPTIONAL in the schema, and has to be — a manifest written before
// the field existed is on a device today, and refusing it there would uninstall
// working games. That optionality is the hazard this file closes: the schema
// will happily accept a new pack that says nothing, and a card with no age on
// it is indistinguishable from a card whose author forgot.
//
// So the rule is split in two:
//
//   * the SCHEMA says "an integer in 3–18, or nothing" — `manifest.test.ts`,
//   * this repository's FLEET says "every game states one" — here.
//
// **Why this file is in the SDK and not in the app.** The app's catalogue test
// already globs this same directory, but the app's CI filter is
// `^dynawalla/(dynawalla-app|curriculum|engine)/`, so adding `games/twentyeight/`
// does not run it. `dynawalla_packs` is `^dynawalla/(games|packs)/`, and the
// SDK's `npm test` is the first thing that job runs. A guard that does not run
// on the change it guards against is not a guard.
//
// Discovery is a glob, matching `packs/build.mjs`: adding the thousandth pack
// is adding a directory, and there is no register to forget to edit.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { MIN_AGE_CEILING, MIN_AGE_FLOOR, parseManifest } from "./manifest.ts"
// @ts-expect-error — a plain .mjs pipeline module with no type declarations.
import { manifestFrom } from "../../authoring.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const gamesRoot = path.resolve(here, "../../../games")

type PackSource = {
  readonly id?: unknown
  readonly minAge?: unknown
  readonly covers?: Record<string, unknown>
}

/** Every `games/<name>/pack.json`, as `[directory, parsed]`. */
function fleet(): readonly (readonly [string, PackSource])[] {
  const out: (readonly [string, PackSource])[] = []
  for (const entry of fs.readdirSync(gamesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(gamesRoot, entry.name, "pack.json")
    if (!fs.existsSync(file)) continue
    out.push([entry.name, JSON.parse(fs.readFileSync(file, "utf8")) as PackSource])
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

test("the glob still finds the fleet", () => {
  // Without this, every assertion below passes on an empty list the day the
  // games move, and the file goes on reporting green forever.
  assert.ok(fleet().length > 20, `expected the fleet, found ${fleet().length} pack.json files`)
})

test("every shipped game states the youngest age its hands are written for", () => {
  // A new game arrives as a new directory. It must not be able to arrive
  // without an answer to "can a five-year-old work this?", because the schema
  // will accept the silence and the card will simply print nothing.
  const silent = fleet()
    .filter(([, source]) => source.minAge === undefined)
    .map(([name]) => name)
  assert.deepEqual(
    silent,
    [],
    'games with no "minAge" in pack.json — add one, justified by motor and attention demand, never by the arithmetic (the maths adapts down to single digits in every pack)',
  )
})

test("every stated minimum age is an integer inside the schema's bounds", () => {
  for (const [name, source] of fleet()) {
    const age = source.minAge
    assert.equal(typeof age, "number", `${name}: minAge is ${JSON.stringify(age)}, not a number`)
    assert.ok(Number.isInteger(age), `${name}: minAge ${String(age)} is not a whole year`)
    assert.ok(
      typeof age === "number" && age >= MIN_AGE_FLOOR && age <= MIN_AGE_CEILING,
      `${name}: minAge ${String(age)} is outside ${MIN_AGE_FLOOR}–${MIN_AGE_CEILING}`,
    )
  }
})

test("no game declares an age ceiling — the label is a floor and says so", () => {
  // The founder's instruction was an "and up" scheme and explicitly NOT a
  // range. Every game's mathematics adapts upward without bound, so a `6–10`
  // on a card would be a promise the product does not make. The schema refuses
  // these fields; this is what stops one being introduced under another name.
  for (const [name, source] of fleet()) {
    for (const field of ["maxAge", "ageRange", "ages", "ageBand"]) {
      assert.equal(
        (source as Record<string, unknown>)[field],
        undefined,
        `${name} declares "${field}" — there is no ceiling in this schema`,
      )
    }
  }
})

test("no game declares a grade band — a band names a top, and there is no top", () => {
  // `covers.grades` was removed from the schema, but removal alone does not
  // stop it coming back: the parser deliberately *tolerates* a legacy band
  // rather than rejecting it, because manifests published against the old
  // schema are installed on devices today and failing them would uninstall
  // working games. That tolerance is the hole this test covers for our own
  // fleet, and it is the suite the `dynawalla/games/**` CI filter runs.
  //
  // The reason it is banned rather than merely unused: "Grades 1–4" on a card
  // told a mathlete, an adult and an accelerated nine-year-old that the game
  // was not for them, when every pack's mathematics adapts upward without
  // bound. `covers.skills` says what a game teaches without saying who is too
  // old for it, and it is the only claim a pack gets to make.
  for (const [name, source] of fleet()) {
    for (const field of ["grades", "gradeBand", "gradeRange", "maxGrade"]) {
      assert.equal(
        source.covers === undefined ? undefined : source.covers[field],
        undefined,
        `${name} declares "covers.${field}" — this product does not name a top grade`,
      )
    }
  }
})

test("the fleet spreads across the ladder rather than labelling everything the same", () => {
  // A label every game shares carries no information, and a parent choosing
  // between twenty-seven cards that all read "5+" has been told nothing. This
  // is the guard against a future bulk edit that flattens the judgement.
  const ages = new Set(fleet().map(([, source]) => source.minAge))
  assert.ok(ages.size >= 3, `every game claims one of ${ages.size} ages — that is not guidance`)
})

/* ── The builder's projection ─────────────────────────────────────────────── */

test("the builder carries a stated minimum age onto the manifest a device reads", () => {
  // The one place a field is dropped without anything going red: `build.mjs`
  // would still produce twenty-seven schema-valid manifests, and the only
  // symptom would be a catalogue whose small print is blank. Every other
  // assertion in this file is about `pack.json`, which is the wrong end.
  const assets = { files: 4, bytes: 32768 }
  const download = { bytes: 8192, sha256: "a".repeat(64) }

  for (const [name, source] of fleet()) {
    const manifest = manifestFrom(source, assets, download)
    assert.equal(manifest["minAge"], source.minAge, `${name}: the builder lost its minAge`)
    // …and the result is something the schema will actually take, so a fleet
    // value the parser rejects fails here rather than at the build's gate.
    const parsed = parseManifest(manifest)
    assert.equal(parsed.ok, true, parsed.ok ? "" : `${name}: ${parsed.problems.join("; ")}`)
  }
})

test("the builder omits an unstated age rather than writing it as null", () => {
  // `null` and `7.5` both reach a card as garbage, and `undefined` survives
  // `JSON.stringify` as an absent key only by accident of the serialiser. The
  // schema distinguishes "unstated" from "stated as nothing" and so must this.
  const [, sample] = fleet()[0] ?? []
  assert.ok(sample, "no pack to build a fixture from")
  const { minAge: _dropped, ...silent } = sample as Record<string, unknown>
  const manifest = manifestFrom(silent, { files: 4, bytes: 32768 }, { bytes: 8192, sha256: "a".repeat(64) })
  assert.equal("minAge" in manifest, false, "an unstated age was written into the manifest")
  assert.equal(parseManifest(manifest).ok, true)
})
