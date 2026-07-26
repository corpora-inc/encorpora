// Every user-visible string in the host, in one module.
//
// There is no i18n runtime yet — the gate and the five locale bundles land in
// PR-1.6. Collecting the strings here now means that PR is a mechanical
// substitution of one accessor rather than a hunt through JSX, and it makes the
// cost of a new string visible: each one is five translations.
//
// The host ships no content, so this file is the *whole* of its copy. Every
// entry is either the name of a place, the name of a control, or the text
// alternative for something drawn. There is no status copy, no encouragement,
// and no narration of what is or is not built yet.
//
// "Dynawalla" is a proper noun and is never translated. The store display name
// is still open (ADR-0016); the wordmark deliberately uses the short form,
// which is the part of the name that will not change.

export const strings = {
  appName: "Dynawalla",

  destinations: {
    packs: "Packs",
    progress: "Progress",
    profiles: "Profiles",
    settings: "Settings",
    parents: "Parents",
  },

  /** The two ends of every switch. Drawn as words, never as colour alone. */
  state: {
    on: "On",
    off: "Off",
  },

  packs: {
    installed: "Installed",
    space: "Space used",
    /** The control on a pack row. What the row does, in one word. */
    play: "Play",
    /** Leaves a running pack. The only host chrome drawn over a game. */
    leave: "Leave",
    /** The pack was launched and is no longer on this device. */
    missing: "This pack is not installed.",
    /** The frame refused, or the runtime could not name the entry document. */
    failed: "This pack could not be opened.",
  },

  progress: {
    answered: "Answered",
    correct: "Correct",
    /** The text alternative for the drawn screen. A count is the honest one:
        it is the only thing about the construction that is a number. */
    cut: "{{apertures}} apertures cut.",
  },

  profiles: {
    /** The name a new learner has before anyone types one. */
    learner: "Learner {{n}}",
    /** Screen-reader label for the name field. */
    name: "Name",
    /** Make this the learner the app is for right now. */
    use: "Use",
    add: "Add a learner",
    remove: "Remove",
  },

  settings: {
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
    sound: "Sound",
    haptics: "Haptics",
    motion: "Reduce motion",
    textSize: "Text size",
    normal: "Normal",
    large: "Large",
    largest: "Largest",
    quality: "Quality",
    full: "Full",
    plain: "Plain",
  },

  parents: {
    version: "Version",
    storage: "On this device",
    learners: "Learners",
    developer: "Developer mode",
    /** Erases every learner, everything they built, and every installed pack. */
    erase: "Erase everything",
    /** The same row, armed. One more press does it; leaving the screen disarms. */
    eraseConfirm: "Erase everything — press again",
  },
} as const

/**
 * Developer-mode copy. **Not translated, deliberately**: it is read by whoever
 * is building the app, it names things that have no name in any other language
 * (a Tauri command, a storage key), and translating it would cost five
 * translations a line for an audience of one.
 */
export const dev = {
  platform: "Platform",
  native: "Native (Tauri)",
  browser: "Browser",
  grant: "Grant",
  key: "Key",
} as const

/**
 * Substitute `{{slot}}` placeholders — the whole interpolation layer until
 * PR-1.6 brings the real one, in the syntax the locale bundles will use so the
 * call sites do not change. An unknown slot is left standing rather than
 * silently emptied: a visible `{{apertures}}` in a translation is a bug report.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, key: string) =>
    key in values ? String(values[key]) : slot,
  )
}
