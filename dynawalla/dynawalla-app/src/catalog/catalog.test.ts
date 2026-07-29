// The catalogue's two silent failure modes, and the guards for both.
//
//   * **Artwork that is not deterministic.** A drawing seeded from anything
//     but the pack id looks fine in every screenshot and reshuffles between
//     launches on a device, so a child never learns which tile is which. There
//     is no DOM here, which is exactly why the art is specified as data in
//     `motifs.ts` and rendered separately — the property is testable.
//   * **A game that vanishes.** The subject filter is derived from skill ids
//     at runtime, so a skill this build has never seen must leave the game
//     listed and unfiled rather than dropping it off the front door.
//
// Run: npm test  (node --experimental-strip-types --test 'src/**/*.test.ts')

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { fill, strings } from "../app/strings.ts"
import { ART_HUES, DRAWN_PACKS, artOf, hashOf, hueClass, isMotifKey, rngFrom } from "./art.ts"
import { gradeLabel, minAgeLabel } from "./labels.ts"
import { MOTIF_KEYS, shapesOf, type Shape } from "./motifs.ts"
import { DOMAIN_IDS, chipsFor, domainOfSkill, domainsOf } from "./domains.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const gamesRoot = path.resolve(here, "../../../games")

/** The drawing for a pack id, flattened to a string. Two ids differ or not. */
function drawingOf(packId: string): string {
  const spec = artOf(packId)
  const shapes = shapesOf(spec.motif, rngFrom(spec.seed))
  return `${spec.hue}|${spec.motif}|${shapes.map(describe).join(";")}`
}

const describe = (shape: Shape): string =>
  shape.kind === "path"
    ? `p${shape.d}${shape.ink}${shape.alpha ?? ""}${shape.dash ?? ""}`
    : shape.kind === "circle"
      ? `c${shape.cx},${shape.cy},${shape.r},${shape.ink},${shape.alpha ?? ""}`
      : `r${shape.x},${shape.y},${shape.width},${shape.height},${shape.ink},${shape.alpha ?? ""}`

test("every game the repository ships has key art of its own", () => {
  // The table in `art.ts` is the one place a per-game decision is allowed, and
  // it is allowed only because the drawing has to be a picture of that game.
  // This is what stops it silently falling behind: the catalogue went from
  // eighteen games to twenty-seven in an afternoon.
  const shipped = fs
    .readdirSync(gamesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(gamesRoot, entry.name, "pack.json"))
    .filter((file) => fs.existsSync(file))
    .map((file) => (JSON.parse(fs.readFileSync(file, "utf8")) as { id: string }).id)

  assert.ok(shipped.length > 20, `expected the catalogue, found ${shipped.length} packs`)

  const drawn = new Set(DRAWN_PACKS)
  const undrawn = shipped.filter((id) => !drawn.has(id))
  assert.deepEqual(undrawn, [], "games with no motif of their own")

  const phantom = DRAWN_PACKS.filter((id) => !shipped.includes(id))
  assert.deepEqual(phantom, [], "motifs for games that do not exist")
})

test("the motif table names motifs that exist", () => {
  for (const id of DRAWN_PACKS) {
    assert.ok(isMotifKey(artOf(id).motif), `${id} names a motif nothing draws`)
  }
})

test("a game this build has never heard of still gets a real drawing", () => {
  // The whole point of the fallback: game #28 lands with no code change here,
  // and it must not be a grey box or an empty tile.
  for (const id of ["dynawalla.something-new", "dynawalla.zzz", "vendor.other.pack"]) {
    const spec = artOf(id)
    assert.equal(spec.motif, "sigil")
    const shapes = shapesOf(spec.motif, rngFrom(spec.seed))
    assert.ok(shapes.length > 8, `${id} drew ${shapes.length} shapes`)
  }

  // …and two unknown games must not get the SAME drawing, which is the failure
  // a single hardcoded placeholder would have.
  assert.notEqual(drawingOf("dynawalla.aaa"), drawingOf("dynawalla.bbb"))
})

test("key art is byte-identical every time it is drawn", () => {
  for (const id of [...DRAWN_PACKS, "dynawalla.unknown"]) {
    assert.equal(drawingOf(id), drawingOf(id), `${id} draws itself differently twice`)
  }
})

test("no two games are drawn the same", () => {
  const seen = new Map<string, string>()
  for (const id of DRAWN_PACKS) {
    const drawing = drawingOf(id)
    const clash = seen.get(drawing)
    assert.equal(clash, undefined, `${id} and ${clash} draw the same picture`)
    seen.set(drawing, id)
  }
})

test("every drawing is on the field, in the family, and made of something", () => {
  const inks = new Set(["line", "thin", "bold", "glow", "fill", "veil", "warm", "pale"])
  for (const motif of MOTIF_KEYS) {
    const shapes = shapesOf(motif, rngFrom(hashOf(motif)))
    assert.ok(shapes.length >= 6, `${motif} draws ${shapes.length} shapes`)
    for (const shape of shapes) {
      assert.ok(inks.has(shape.ink), `${motif} uses an ink nothing paints: ${shape.ink}`)
      if (shape.alpha !== undefined) {
        assert.ok(shape.alpha > 0 && shape.alpha <= 1, `${motif} has an invisible shape`)
      }
      // Loosely on the 100 × 100 field. A motif that wandered off it would be
      // cropped to a blank corner by `preserveAspectRatio="slice"`.
      if (shape.kind === "circle") {
        assert.ok(shape.r > 0 && shape.cx > -20 && shape.cx < 120, `${motif} is off the field`)
      }
      if (shape.kind === "rect") {
        assert.ok(shape.width > 0 && shape.height > 0, `${motif} draws an empty rectangle`)
      }
      if (shape.kind === "path") {
        assert.ok(/^M/.test(shape.d), `${motif} has a path that starts nowhere`)
        assert.ok(!/NaN|undefined/.test(shape.d), `${motif} has a path with a hole in it`)
      }
    }
  }
})

test("the hue is spread across the arc rather than clumped on one colour", () => {
  const counts = new Map<number, number>()
  for (const id of DRAWN_PACKS) {
    const { hue } = artOf(id)
    assert.ok(hue >= 1 && hue <= ART_HUES, `${id} asks for hue ${hue}`)
    counts.set(hue, (counts.get(hue) ?? 0) + 1)
  }
  assert.ok(counts.size >= 8, `only ${counts.size} of ${ART_HUES} hues are used`)
  const worst = Math.max(...counts.values())
  assert.ok(worst <= 5, `${worst} games share one hue`)
})

test("the hue class is always one the stylesheet defines", () => {
  const css = fs.readFileSync(path.join(here, "catalog.css"), "utf8")
  for (let hue = 1; hue <= ART_HUES; hue++) {
    assert.match(css, new RegExp(`\\.dw-art-h${hue}\\s*\\{`), `no rule for hue ${hue}`)
  }
  // Out-of-range and nonsense are clamped rather than emitting a class that
  // sets no colour at all, which paints the art in nothing.
  assert.equal(hueClass(0), "dw-art-h1")
  assert.equal(hueClass(99), `dw-art-h${ART_HUES}`)
  assert.equal(hueClass(Number.NaN), "dw-art-h1")
})

test("every ink the motifs use is painted by the stylesheet", () => {
  const css = fs.readFileSync(path.join(here, "catalog.css"), "utf8")
  const used = new Set<string>()
  for (const motif of MOTIF_KEYS) {
    for (const shape of shapesOf(motif, rngFrom(hashOf(motif)))) used.add(shape.ink)
  }
  for (const ink of used) {
    assert.match(css, new RegExp(`\\.dw-art-${ink}\\b`), `nothing paints the "${ink}" ink`)
  }
})

test("a skill id is filed by its second segment, and nothing else", () => {
  assert.equal(domainOfSkill("dw.add.column.add-no-carry"), "add")
  assert.equal(domainOfSkill("dw.frac.compare.unlike-fractions"), "frac")
  assert.equal(domainOfSkill("dw.alg.equality.balance-meaning"), "alg")
  assert.equal(domainOfSkill("dw.ns.compare.whole-numbers"), "ns")
})

test("an unknown skill leaves the game listed and unfiled — never dropped", () => {
  // The failure being prevented: a subject this build has not heard of making
  // a game disappear from the front door of a child's tablet.
  assert.equal(domainOfSkill("dw.geom.area.rectangle"), null)
  assert.equal(domainOfSkill("dw"), null)
  assert.equal(domainOfSkill(""), null)
  assert.equal(domainOfSkill("something.else.entirely"), null)

  const mixed = domainsOf(["dw.geom.area.rectangle", "dw.add.column.add-no-carry"])
  assert.deepEqual(mixed, ["add"], "a known subject was lost beside an unknown one")

  assert.deepEqual(domainsOf(["dw.geom.area.rectangle"]), [], "an unfiled game is not a crash")
})

test("subjects come back in teaching order, never in the order they were found", () => {
  const found = domainsOf([
    "dw.alg.equality.balance-meaning",
    "dw.add.column.add-no-carry",
    "dw.ns.compare.whole-numbers",
  ])
  assert.deepEqual(found, ["ns", "add", "alg"])
  for (const domain of found) assert.ok((DOMAIN_IDS as readonly string[]).includes(domain))
})

test("a chip is only offered when some installed game answers it", () => {
  // A filter that can only ever return nothing is a control that lies about
  // what this device holds.
  assert.deepEqual(chipsFor([]), [])
  assert.deepEqual(
    chipsFor([{ skills: ["dw.frac.arith.add-like"] }, { skills: ["dw.add.column.add-no-carry"] }]),
    ["add", "frac"],
  )
  assert.deepEqual(chipsFor([{ skills: ["dw.geom.area.rectangle"] }]), [])
})

test("the generator is seeded, spread and engine-independent", () => {
  // FNV-1a and mulberry32 are both specified arithmetic on 32-bit integers. A
  // hash that differed between two JavaScript engines would give a phone and a
  // tablet two different pictures of the same game.
  assert.equal(hashOf("dynawalla.forge"), hashOf("dynawalla.forge"))
  assert.notEqual(hashOf("dynawalla.forge"), hashOf("dynawalla.foundry"))

  const rng = rngFrom(hashOf("dynawalla.forge"))
  const draws = Array.from({ length: 400 }, () => rng())
  for (const value of draws) assert.ok(value >= 0 && value < 1)
  const mean = draws.reduce((total, value) => total + value, 0) / draws.length
  assert.ok(Math.abs(mean - 0.5) < 0.06, `the generator is biased: mean ${mean}`)
})

/* ── The card's small print ───────────────────────────────────────────────── */

test("a minimum age is drawn as a floor and never as a range", () => {
  // The founder's instruction was an "and up" scheme and explicitly NOT a
  // range: every game's mathematics adapts upward without bound, so a `6–10`
  // on a card would promise a ceiling the product does not have.
  assert.equal(minAgeLabel(5), "5+")
  assert.equal(minAgeLabel(8), "8+")
  for (const age of [5, 6, 7, 8, 9]) {
    const label = minAgeLabel(age)
    assert.ok(label, `no label for ${age}`)
    assert.ok(!/[–—-]/.test(label), `${label} reads as a range`)
    assert.ok(label.includes(String(age)), `${label} does not name the age`)
  }
})

test("the age template keeps its slot, so a translation cannot empty the label", () => {
  // `fill` leaves an unknown slot in place rather than blanking it, so a
  // translation that drops `{{age}}` prints a literal `{{age}}` — visible, and
  // a bug report. A translation that drops the NUMBER, though, would render a
  // bare `+` and look like a rendering fault instead. This is what catches it.
  assert.match(strings.catalog.minAge, /\{\{age\}\}/, "the age slot is gone")
  assert.equal(fill(strings.catalog.minAge, { age: 42 }).includes("42"), true)
})

test("an unstated age is drawn as nothing, never as a guess or a placeholder", () => {
  // A pack record written before this field existed is on a device today, and
  // `minAge` is optional in the schema for exactly that reason.
  assert.equal(minAgeLabel(null), null)
  for (const nonsense of [0, -3, 7.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(minAgeLabel(nonsense), null, `${nonsense} reached a card`)
  }
})

test("a grade band with a hole in it is drawn as nothing rather than as Grades ?–?", () => {
  assert.equal(gradeLabel([1, 4]), "Grades 1–4")
  assert.equal(gradeLabel(null), null)
  assert.equal(gradeLabel([Number.NaN, 4]), null)
  assert.equal(gradeLabel([1, Number.POSITIVE_INFINITY]), null)
})

test("every shipped game states a minimum age, and the catalogue can label it", () => {
  // The fleet rule itself is enforced in `packs/sdk/src/fleet.test.ts`, which
  // is the suite the `dynawalla/games/**` CI filter actually runs. This is the
  // other half: that what the packs declare is something this catalogue can
  // draw. A number the schema accepts but `minAgeLabel` rejects would ship a
  // fleet of cards with a silent hole where the age should be.
  const ages = fs
    .readdirSync(gamesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(gamesRoot, entry.name, "pack.json"))
    .filter((file) => fs.existsSync(file))
    .map((file) => JSON.parse(fs.readFileSync(file, "utf8")) as { id: string; minAge?: number })

  assert.ok(ages.length > 20, `expected the catalogue, found ${ages.length} packs`)
  const undrawable = ages.filter((pack) => minAgeLabel(pack.minAge ?? null) === null)
  assert.deepEqual(
    undrawable.map((pack) => pack.id),
    [],
    "games whose minAge the catalogue cannot draw",
  )
})
