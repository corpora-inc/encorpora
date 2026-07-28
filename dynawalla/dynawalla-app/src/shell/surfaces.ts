// What each destination renders, as data.
//
// Every screen in this host is a list of rows over real state, so the screens
// are *described* here and *drawn* in `Surface.tsx`. That is not indirection
// for its own sake — it is the only way the promise "no destination is ever
// empty" can be a test rather than a habit.
//
// The rule it makes testable: **a destination is a function from host state to
// rows, and no state of this app maps any destination to nothing.**
// `surfaces.test.ts` builds a cold, first-launch host — no learner has done
// anything, no pack is installed, nothing is on disk — and asserts that every
// destination still comes back with rows, and that every row carries either a
// real value or a working control. The previous shell had a shared `Destination`
// component that rendered an empty recess, and two of its five destinations
// rendered exactly that, forever, with a green suite.
//
// The view is a snapshot and the actions are separate: the model is then pure,
// so the test drives it with no DOM, no React and no router.

import { NATIVE_CALLS, callId, grantOf } from "../app/permissions.ts"
import type { Destination } from "../app/routes.ts"
import { strings, dev, fill } from "../app/strings.ts"
import { formatBytes, packBytes, type InstalledPack } from "../packs/registry.ts"
import type { Profile } from "../profiles/store.ts"
import type { LearnerRecord } from "../learner/record.ts"
import {
  TEXT_SIZES,
  QUALITIES,
  type Quality,
  type Settings,
  type TextSize,
} from "../settings/store.ts"
import { THEME_MODES, type ThemeMode } from "../app/theme.ts"

export interface ChoiceOption {
  readonly value: string
  readonly label: string
}

/** The figures this shell knows how to draw. A row may name no other. */
export const FIGURES = ["construction"] as const
export type Figure = (typeof FIGURES)[number]

export type Row =
  /** A fact about this device or this learner. Read-only, and never a guess. */
  | { readonly kind: "fact"; readonly key: string; readonly name: string; readonly value: string }
  /** One of two or more settings, all of them visible. Never a bare switch:
      an on/off state carried only by a highlight is state carried by colour. */
  | {
      readonly kind: "choice"
      readonly key: string
      readonly name: string
      readonly value: string
      readonly options: readonly ChoiceOption[]
      readonly choose: (value: string) => void
    }
  | {
      readonly kind: "action"
      readonly key: string
      readonly name: string
      readonly tone: "plain" | "danger"
      readonly run: () => void
    }
  /** A learner: their name, whether the app is currently theirs, and the two
      things a parent does with them. */
  | {
      readonly kind: "learner"
      readonly key: string
      readonly id: string
      /** What to draw when the field is empty. Never blank. */
      readonly name: string
      /** What is actually stored, which may be nothing at all. */
      readonly given: string
      readonly current: boolean
      readonly use: () => void
      readonly rename: (name: string) => void
      /** `null` for the last learner: there is no state of this app with none. */
      readonly remove: (() => void) | null
    }
  /** An installed pack, and the way into it. The front door's whole content. */
  | {
      readonly kind: "pack"
      readonly key: string
      readonly id: string
      readonly name: string
      readonly version: string
      /** What it occupies, already formatted. Never a bare byte count. */
      readonly size: string
      /** One line about the game. Empty for a record written before this. */
      readonly description: string
      /**
       * `covers.skills`, straight from the manifest.
       *
       * Handed over raw rather than pre-filed into a subject, because filing
       * is a *view* concern: the catalogue derives the subject chips from
       * these at render time (`catalog/domains.ts`), so a pack covering a
       * subject this build has never heard of is still described here in full
       * and is still listed. A surface that filtered would be a surface that
       * could hide an installed game.
       */
      readonly skills: readonly string[]
      /** Inclusive grade band, or `null` when the record predates it. */
      readonly grades: readonly [number, number] | null
      /** Launches it onto the stage. Never null: an unplayable pack is not a row. */
      readonly play: () => void
      /**
       * This game already reached its stopping point today.
       *
       * **Not a lock and never drawn as one.** No padlock, no "premium", no
       * dimming that makes it look broken, and the row still opens — what it
       * opens is the sheet that says so. A child scanning the grid is told
       * where they got to today, which is a fact about them, not a price.
       */
      readonly resting: boolean
    }
  /** Something drawn. `label` is its text alternative and is never empty. */
  | {
      readonly kind: "figure"
      readonly key: string
      readonly figure: Figure
      readonly value: number
      readonly label: string
    }

export interface Section {
  readonly key: string
  readonly rows: readonly Row[]
}

/** A snapshot of everything the host knows. No store, no clock, no DOM. */
export interface HostView {
  readonly profiles: readonly Profile[]
  readonly currentId: string
  readonly settings: Settings
  readonly theme: ThemeMode
  readonly packs: readonly InstalledPack[]
  /** The current learner's construction, in apertures. */
  readonly placed: number
  readonly record: LearnerRecord
  readonly storageBytes: number
  readonly storage: readonly { readonly key: string; readonly bytes: number }[]
  readonly version: string
  readonly native: boolean
  /** Has the parent already pressed "erase everything" once? */
  readonly armed: boolean
  /** The pass this device holds, described in one word. Never a price. */
  readonly pass: string
  /** Pack ids that reached their stopping point today. Usually empty. */
  readonly resting: readonly string[]
}

export interface HostActions {
  readonly setTheme: (mode: ThemeMode) => void
  readonly setSettings: (patch: Partial<Settings>) => void
  readonly addProfile: () => void
  readonly selectProfile: (id: string) => void
  readonly renameProfile: (id: string, name: string) => void
  readonly removeProfile: (id: string) => void
  readonly armErase: () => void
  readonly erase: () => void
  /** Put a pack on the stage. The one action the front door exists for. */
  readonly launchPack: (packId: string) => void
  /**
   * Developer mode only, and off on every child's tablet.
   *
   * Verifying "a purchase unlocks everything" and "midnight gives the day
   * back" needs a way to hold a pass and a way to give one back, and a
   * developer with no way to do that will invent a worse one — usually by
   * editing `localStorage` by hand and getting the shape subtly wrong.
   */
  readonly grantTestPass: (kind: "day" | "lifetime") => void
  readonly clearTestPass: () => void
  readonly clearRestLedger: () => void
}

// The option sets, written once. `satisfies` is what keeps a label and a value
// from drifting apart: a value that is not one of the union's members fails the
// build here rather than selecting nothing on a control at runtime.
const THEME_OPTIONS = [
  { value: "system", label: strings.settings.system },
  { value: "light", label: strings.settings.light },
  { value: "dark", label: strings.settings.dark },
] as const satisfies readonly { value: ThemeMode; label: string }[]

const TEXT_OPTIONS = [
  { value: "normal", label: strings.settings.normal },
  { value: "large", label: strings.settings.large },
  { value: "largest", label: strings.settings.largest },
] as const satisfies readonly { value: TextSize; label: string }[]

const QUALITY_OPTIONS = [
  { value: "full", label: strings.settings.full },
  { value: "plain", label: strings.settings.plain },
] as const satisfies readonly { value: Quality; label: string }[]

const yesNo = (on: boolean): string => (on ? "on" : "off")

/** A two-state setting, drawn as two words rather than as a coloured switch. */
function switchRow(
  key: string,
  name: string,
  on: boolean,
  set: (on: boolean) => void,
): Row {
  return {
    kind: "choice",
    key,
    name,
    value: yesNo(on),
    options: [
      { value: "off", label: strings.state.off },
      { value: "on", label: strings.state.on },
    ],
    choose: (value) => set(value === "on"),
  }
}

const fact = (key: string, name: string, value: string): Row => ({
  kind: "fact",
  key,
  name,
  value,
})

/** The name to draw for a learner who has not been given one. */
export function learnerName(profile: Profile, index: number): string {
  const trimmed = profile.name.trim()
  return trimmed.length > 0 ? trimmed : fill(strings.profiles.learner, { n: index + 1 })
}

/**
 * The front door.
 *
 * Packs first, and packs as *plates you press* — the app is its packs, and the
 * first thing on the first screen has to be the way into one. The device counts
 * are underneath, where a parent looks for them and a child does not.
 *
 * **Every installed pack, always.** The catalogue above this has a search field
 * and a row of subject chips, and neither of them belongs here: this function
 * is a pure map from host state to rows and the test that says "no destination
 * is ever empty" is only worth something while it stays one. Narrowing happens
 * in the component, over the rows it was handed. A filter that reached back
 * into the model would make an empty front door a legitimate state.
 */
function packsSurface(view: HostView, act: HostActions): readonly Section[] {
  return [
    {
      key: "installed",
      rows: view.packs.map(
        (pack): Row => ({
          kind: "pack",
          key: pack.id,
          id: pack.id,
          name: pack.name,
          version: pack.version,
          size: formatBytes(pack.bytes),
          description: pack.description ?? "",
          skills: pack.skills ?? [],
          grades: pack.grades ?? null,
          play: () => act.launchPack(pack.id),
          resting: view.resting.includes(pack.id),
        }),
      ),
    },
    {
      key: "device",
      rows: [
        fact("count", strings.packs.installed, String(view.packs.length)),
        fact("bytes", strings.packs.space, formatBytes(packBytes(view.packs))),
      ],
    },
  ]
}

function progressSurface(view: HostView): readonly Section[] {
  return [
    {
      key: "construction",
      rows: [
        {
          kind: "figure",
          key: "screen",
          figure: "construction",
          value: view.placed,
          label: fill(strings.progress.cut, { apertures: view.placed }),
        },
      ],
    },
    {
      key: "record",
      rows: [
        fact("answered", strings.progress.answered, String(view.record.answered)),
        fact("correct", strings.progress.correct, String(view.record.correct)),
      ],
    },
  ]
}

function profilesSurface(view: HostView, act: HostActions): readonly Section[] {
  const removable = view.profiles.length > 1
  return [
    {
      key: "learners",
      rows: view.profiles.map((profile, index): Row => {
        const id = profile.id
        return {
          kind: "learner",
          key: id,
          id,
          name: learnerName(profile, index),
          given: profile.name,
          current: id === view.currentId,
          use: () => act.selectProfile(id),
          rename: (name) => act.renameProfile(id, name),
          remove: removable ? () => act.removeProfile(id) : null,
        }
      }),
    },
    {
      key: "add",
      rows: [
        {
          kind: "action",
          key: "add",
          name: strings.profiles.add,
          tone: "plain",
          run: act.addProfile,
        },
      ],
    },
  ]
}

function settingsSurface(view: HostView, act: HostActions): readonly Section[] {
  const { settings } = view
  return [
    {
      key: "look",
      rows: [
        {
          kind: "choice",
          key: "theme",
          name: strings.settings.theme,
          value: view.theme,
          options: THEME_OPTIONS,
          // Chosen from the known set rather than cast: the renderer hands back
          // whatever string was on the control, and a cast would let a typo in
          // an option write an unknown mode into storage, where it resolves to
          // no theme at all on the next launch.
          choose: (value) => {
            const picked = THEME_MODES.find((mode) => mode === value)
            if (picked) act.setTheme(picked)
          },
        },
        {
          kind: "choice",
          key: "text",
          name: strings.settings.textSize,
          value: settings.textSize,
          options: TEXT_OPTIONS,
          choose: (value) => {
            const picked = TEXT_SIZES.find((size) => size === value)
            if (picked) act.setSettings({ textSize: picked })
          },
        },
      ],
    },
    {
      key: "feel",
      rows: [
        switchRow("sound", strings.settings.sound, settings.sound, (on) =>
          act.setSettings({ sound: on }),
        ),
        switchRow("haptics", strings.settings.haptics, settings.haptics, (on) =>
          act.setSettings({ haptics: on }),
        ),
        switchRow("motion", strings.settings.motion, settings.reduceMotion, (on) =>
          act.setSettings({ reduceMotion: on }),
        ),
        {
          kind: "choice",
          key: "quality",
          name: strings.settings.quality,
          value: settings.quality,
          options: QUALITY_OPTIONS,
          choose: (value) => {
            const picked = QUALITIES.find((tier) => tier === value)
            if (picked) act.setSettings({ quality: picked })
          },
        },
      ],
    },
  ]
}

function parentsSurface(view: HostView, act: HostActions): readonly Section[] {
  const sections: Section[] = [
    {
      key: "device",
      rows: [
        fact("version", strings.parents.version, view.version),
        fact("storage", strings.parents.storage, formatBytes(view.storageBytes)),
        fact("learners", strings.parents.learners, String(view.profiles.length)),
      ],
    },
    {
      key: "controls",
      rows: [
        switchRow("developer", strings.parents.developer, view.settings.developer, (on) =>
          act.setSettings({ developer: on }),
        ),
        {
          kind: "action",
          key: "erase",
          // Armed, the row says what the next press does. It replaces the label
          // in place — nothing above or below it moves — because a confirmation
          // that reflows the screen is the jolt this design forbids, and a
          // modal for a two-press action is a modal for nothing.
          name: view.armed ? strings.parents.eraseConfirm : strings.parents.erase,
          tone: "danger",
          run: view.armed ? act.erase : act.armErase,
        },
      ],
    },
  ]

  if (view.settings.developer) {
    sections.push({
      key: "diagnostics",
      rows: [
        fact("platform", dev.platform, view.native ? dev.native : dev.browser),
        // The capability grants, read from the same table `capabilities.test.ts`
        // holds against `src-tauri/capabilities/default.json`. What the app may
        // ask the operating system for is a thing a parent is entitled to see,
        // and a thing a developer needs on a device where it is failing.
        // Named by `grantOf`, not by `permission`: a command this app registers
        // itself has no ACL permission to show — it has a command — and reading
        // the field directly drew a row called `null` with a `null` key.
        ...NATIVE_CALLS.map(
          (call): Row => fact(callId(call), grantOf(call), `${call.module}.${call.fn}`),
        ),
        ...view.storage.map((entry): Row => fact(entry.key, entry.key, formatBytes(entry.bytes))),
      ],
    })

    // The day pass, and the four levers that make a full day simulable in one
    // sitting. No price is shown and no store is called: `grantingBilling`
    // writes the same record a confirmed purchase would, so what is being
    // exercised is the entitlement, not a payment.
    sections.push({
      key: "pass",
      rows: [
        fact("pass", dev.pass, view.pass),
        fact("resting", dev.resting, view.resting.length === 0 ? "—" : view.resting.join(", ")),
        {
          kind: "action",
          key: "grant-day",
          name: dev.grantDayPass,
          tone: "plain",
          run: () => act.grantTestPass("day"),
        },
        {
          kind: "action",
          key: "grant-lifetime",
          name: dev.grantLifetime,
          tone: "plain",
          run: () => act.grantTestPass("lifetime"),
        },
        {
          kind: "action",
          key: "clear-pass",
          name: dev.clearPass,
          tone: "plain",
          run: act.clearTestPass,
        },
        {
          kind: "action",
          key: "clear-ledger",
          name: dev.clearLedger,
          tone: "plain",
          run: act.clearRestLedger,
        },
      ],
    })
  }

  return sections
}

/**
 * The rows a destination draws, given the state of the host.
 *
 * Total over `Destination` by construction: adding a route with no surface is
 * a type error here, not a blank screen on a tablet.
 */
export function surfaceOf(
  destination: Destination,
  view: HostView,
  act: HostActions,
): readonly Section[] {
  return sectionsOf(destination, view, act).filter((section) => section.rows.length > 0)
}

/**
 * A section with no rows in it draws a rule and a gap — a visible seam around
 * nothing, which is what "no packs installed" would look like if the empty list
 * survived to the renderer. Dropped here, once, rather than guarded in five
 * screens and forgotten in the sixth.
 */
function sectionsOf(
  destination: Destination,
  view: HostView,
  act: HostActions,
): readonly Section[] {
  switch (destination) {
    case "packs":
      return packsSurface(view, act)
    case "progress":
      return progressSurface(view)
    case "profiles":
      return profilesSurface(view, act)
    case "settings":
      return settingsSurface(view, act)
    case "parents":
      return parentsSurface(view, act)
  }
}
