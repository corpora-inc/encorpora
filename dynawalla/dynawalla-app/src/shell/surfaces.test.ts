// **No destination is ever empty.**
//
// This is the test the strip exists for. The shell it replaced had five
// destinations, of which `/progress` and `/profiles` rendered a shared
// `Destination` component containing an empty recess — a cut plate with nothing
// mounted in it, forever, on a route in the primary navigation. Every test in
// the suite was green, because nothing in the suite ever asked what a screen
// rendered.
//
// So this asks, for every destination, in the state a family's tablet is in
// thirty seconds after it is unboxed: no learner has answered anything, no pack
// is installed, and there is nothing on disk. That is the worst case and the
// only one guaranteed to happen, and it is where an empty screen hides.
//
// It goes further than "not zero rows": a row has to carry something. A fact
// with no value, a choice with one option, a figure with no text alternative
// and a control with nothing behind it all render as furniture, and a screen
// full of furniture is the empty recess with more markup.
//
// What it does NOT cover: the drawing. `Surface.tsx` is `.tsx`, Node's type
// stripper does not read JSX, and there is no DOM in this runner — so the last
// link, "every row kind has a renderer", is held by the exhaustive `switch` in
// `RowView` (a missing case is a type error) and by the source scan in
// `app/routes.test.ts` that fails if any route stops rendering `Surface`.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DESTINATIONS, type Destination } from "../app/routes.ts"
import { DEFAULT_PROFILE_ID, deviceKey, storageKey } from "../app/profile.ts"
import { EMPTY_RECORD } from "../learner/record.ts"
import { DEFAULT_SETTINGS } from "../settings/store.ts"
import { FIGURES, surfaceOf, learnerName, type HostActions, type HostView, type Row } from "./surfaces.ts"

/** The state of a device nobody has used yet. Nothing invented, nothing seeded. */
const coldHost: HostView = {
  profiles: [{ id: DEFAULT_PROFILE_ID, name: "" }],
  currentId: DEFAULT_PROFILE_ID,
  settings: DEFAULT_SETTINGS,
  theme: "system",
  packs: [],
  placed: 0,
  record: EMPTY_RECORD,
  storageBytes: 0,
  storage: [],
  // `platform.ts` reads a constant Vite defines at build time and Node does
  // not, so the version arrives as a value rather than as an import here.
  version: "0.1.0",
  native: false,
  armed: false,
  // Nothing has been bought and nothing has been played, which is the state
  // that matters most: on a cold device **every game is open**.
  pass: "none",
  resting: [],
}

/** Counts what a caller asked for; asserts nothing on its own. */
function recorder() {
  const calls: string[] = []
  const actions: HostActions = {
    setTheme: () => calls.push("setTheme"),
    setSettings: () => calls.push("setSettings"),
    addProfile: () => calls.push("addProfile"),
    selectProfile: () => calls.push("selectProfile"),
    renameProfile: () => calls.push("renameProfile"),
    removeProfile: () => calls.push("removeProfile"),
    armErase: () => calls.push("armErase"),
    erase: () => calls.push("erase"),
    launchPack: () => calls.push("launchPack"),
    grantTestPass: () => calls.push("grantTestPass"),
    clearTestPass: () => calls.push("clearTestPass"),
    clearRestLedger: () => calls.push("clearRestLedger"),
  }
  return { calls, actions }
}

const rowsOf = (destination: Destination, view: HostView): Row[] =>
  surfaceOf(destination, view, recorder().actions).flatMap((section) => [...section.rows])

/** Everything a row must carry to be worth the space it takes. */
function assertCarries(row: Row, where: string): void {
  // Typed `string`, so a missing key arrives as `null` at runtime rather than
  // as a type error — and reading `.length` off it threw here instead of
  // reporting which row was malformed. Checked as a value first.
  assert.equal(typeof row.key, "string", `${where}: a row keyed by ${String(row.key)}`)
  assert.ok(row.key.length > 0, `${where}: a row with no key`)
  switch (row.kind) {
    case "fact":
      assert.ok(row.name.trim().length > 0, `${where}: a fact with no name`)
      assert.ok(row.value.trim().length > 0, `${where}: ${row.name} has no value`)
      break
    case "choice":
      assert.ok(row.name.trim().length > 0, `${where}: a choice with no name`)
      assert.ok(row.options.length >= 2, `${where}: ${row.name} is not a choice`)
      assert.ok(
        row.options.some((option) => option.value === row.value),
        `${where}: ${row.name} is set to something it does not offer`,
      )
      for (const option of row.options) {
        assert.ok(option.label.trim().length > 0, `${where}: ${row.name} has an unlabelled option`)
      }
      break
    case "action":
      assert.ok(row.name.trim().length > 0, `${where}: an action with no name`)
      break
    case "learner":
      // The stored name may be empty — that is the state of a new learner —
      // but what is *drawn* never is.
      assert.ok(row.name.trim().length > 0, `${where}: a learner with nothing to call them`)
      break
    case "pack":
      assert.ok(row.name.trim().length > 0, `${where}: a pack with no name`)
      assert.ok(row.version.trim().length > 0, `${where}: ${row.name} has no version`)
      assert.ok(row.size.trim().length > 0, `${where}: ${row.name} has no size`)
      assert.equal(typeof row.play, "function", `${where}: ${row.name} cannot be played`)
      break
    case "figure":
      assert.ok(
        (FIGURES as readonly string[]).includes(row.figure),
        `${where}: no renderer draws "${row.figure}"`,
      )
      assert.ok(row.label.trim().length > 0, `${where}: ${row.figure} has no text alternative`)
      assert.ok(row.value >= 0, `${where}: ${row.figure} cannot draw ${String(row.value)}`)
      break
  }
}

test("no destination is empty on a device nobody has used yet", () => {
  for (const destination of DESTINATIONS) {
    const sections = surfaceOf(destination, coldHost, recorder().actions)
    assert.ok(sections.length > 0, `${destination} renders nothing at all`)
    for (const section of sections) {
      assert.ok(section.rows.length > 0, `${destination}/${section.key} is an empty section`)
    }
    for (const row of sections.flatMap((section) => section.rows)) {
      assertCarries(row, destination)
    }
  }
})

/**
 * A device a family has used: two learners, a pack installed, work behind them,
 * and developer mode on.
 *
 * The cold device is the case that hides an empty screen; a used one is the case
 * that hides a row built from something that is only sometimes there — which is
 * exactly what `developer: true` exposes, since the diagnostics section is the
 * only one built by mapping over a table the host does not own.
 */
const usedHost: HostView = {
  ...coldHost,
  profiles: [
    { id: "p1", name: "Aster" },
    { id: "p2", name: "" },
  ],
  currentId: "p2",
  packs: [
    {
      id: "inc.corpora.pack.example",
      name: "Example",
      version: "1.0.0",
      bytes: 4_194_304,
      sha256: "0".repeat(64),
      installedAt: 0,
    },
  ],
  placed: 37,
  record: { answered: 120, correct: 91 },
  storageBytes: 8_192,
  storage: [{ key: storageKey("p1", "record"), bytes: 64 }],
  settings: { ...DEFAULT_SETTINGS, developer: true },
  armed: true,
  native: true,
}

test("every destination is still whole with a family's worth of state on it", () => {
  for (const destination of DESTINATIONS) {
    const rows = rowsOf(destination, usedHost)
    assert.ok(rows.length > 0, `${destination} renders nothing`)
    for (const row of rows) assertCarries(row, destination)
  }
})

test("no section draws two rows under the same key", () => {
  // `Surface.tsx` keys each `<li>` by `row.key` inside its section's `<ul>`, so
  // a section holding the key twice is a row React may drop — a screen missing a
  // line, with rows.length still right and every other assertion here green.
  // The diagnostics section is where it bites: `invoke` and `Channel` both reach
  // `packs_install`, so keying those rows by the command alone collides.
  for (const view of [coldHost, usedHost]) {
    for (const destination of DESTINATIONS) {
      for (const section of surfaceOf(destination, view, recorder().actions)) {
        const keys = section.rows.map((row) => row.key)
        assert.equal(
          new Set(keys).size,
          keys.length,
          `${destination}/${section.key} repeats a row key: ${keys.join(", ")}`,
        )
      }
    }
  }
})

test("every control on every destination is wired to the host", () => {
  // A row that renders is not a row that works. Pressing every control on
  // every screen must reach an action — the failure this catches is a surface
  // built from a snapshot with the handlers left as no-ops, which looks
  // perfect and does nothing.
  for (const destination of DESTINATIONS) {
    const { calls, actions } = recorder()
    const rows = surfaceOf(destination, coldHost, actions).flatMap((section) => [...section.rows])
    for (const row of rows) {
      if (row.kind === "choice") {
        for (const option of row.options) row.choose(option.value)
      }
      if (row.kind === "action") row.run()
      if (row.kind === "learner") {
        row.use()
        row.rename("x")
        row.remove?.()
      }
    }
    const controls = rows.filter((row) => row.kind !== "fact" && row.kind !== "figure").length
    if (controls > 0) {
      assert.ok(calls.length > 0, `${destination}: nothing a child can press does anything`)
    }
  }
})

test("the packs surface shows every installed pack, and says so when there are none", () => {
  const cold = rowsOf("packs", coldHost)
  assert.ok(
    cold.some((row) => row.kind === "fact" && row.value === "0"),
    "an empty registry has to say it is empty, not render nothing",
  )

  const one = rowsOf("packs", {
    ...coldHost,
    packs: [
      {
        id: "inc.corpora.pack.example",
        name: "Example",
        version: "2.1.0",
        bytes: 1024,
        sha256: "",
        installedAt: 0,
      },
    ],
  })
  // An installed pack is not a line of small print about a pack: it is the way
  // into the pack, and pressing it is what the whole app is for.
  const pack = one.find((row) => row.kind === "pack")
  assert.ok(pack, "an installed pack must be launchable from the front door")
  assert.equal(pack.kind === "pack" ? pack.name : "", "Example")
  assert.equal(pack.kind === "pack" ? pack.version : "", "2.1.0")

  const { calls, actions } = recorder()
  const rows = surfaceOf("packs", { ...coldHost, packs: [
    { id: "inc.corpora.pack.example", name: "Example", version: "2.1.0", bytes: 1024, sha256: "", installedAt: 0 },
  ] }, actions).flatMap((section) => [...section.rows])
  const launch = rows.find((row) => row.kind === "pack")
  if (launch?.kind === "pack") launch.play()
  assert.deepEqual(calls, ["launchPack"], "the pack row does not launch the pack")
})

test("the last learner cannot be removed", () => {
  // There is no state of this app with nobody in it. Erasing everything is the
  // parent's control for that, and it lives on the parent surface behind two
  // presses — not on a row a child can reach.
  const [only] = rowsOf("profiles", coldHost)
  assert.equal(only?.kind, "learner")
  assert.equal(only?.kind === "learner" ? only.remove : undefined, null)

  const two = rowsOf("profiles", {
    ...coldHost,
    profiles: [
      { id: "p1", name: "" },
      { id: "p2", name: "" },
    ],
  }).filter((row) => row.kind === "learner")
  assert.equal(two.length, 2)
  for (const row of two) assert.notEqual(row.kind === "learner" ? row.remove : null, null)
})

test("a learner with no name still has one to draw", () => {
  assert.equal(learnerName({ id: "p1", name: "" }, 0), "Learner 1")
  assert.equal(learnerName({ id: "p2", name: "   " }, 1), "Learner 2")
  assert.equal(learnerName({ id: "p3", name: " Aster " }, 2), "Aster")
})

test("erasing everything takes two presses, and the row says which one it is on", () => {
  const disarmed = recorder()
  const armRow = surfaceOf("parents", coldHost, disarmed.actions)
    .flatMap((section) => section.rows)
    .find((row) => row.kind === "action")
  assert.ok(armRow?.kind === "action")
  armRow.run()
  assert.deepEqual(disarmed.calls, ["armErase"], "the first press must not erase anything")

  const armed = recorder()
  const eraseRow = surfaceOf("parents", { ...coldHost, armed: true }, armed.actions)
    .flatMap((section) => section.rows)
    .find((row) => row.kind === "action")
  assert.ok(eraseRow?.kind === "action")
  assert.notEqual(eraseRow.name, armRow.name, "an armed control that looks identical is a trap")
  eraseRow.run()
  assert.deepEqual(armed.calls, ["erase"])
})

test("diagnostics are off until a parent turns them on", () => {
  const off = rowsOf("parents", coldHost)
  const on = rowsOf("parents", {
    ...coldHost,
    settings: { ...DEFAULT_SETTINGS, developer: true },
    storage: [{ key: deviceKey("theme"), bytes: 42 }],
  })
  assert.ok(on.length > off.length, "developer mode adds nothing")
  assert.ok(
    on.some((row) => row.kind === "fact" && row.name === deviceKey("theme")),
    "the storage breakdown is the point of the mode",
  )
})
