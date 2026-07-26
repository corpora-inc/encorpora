// Every user-visible string in the shell, in one module.
//
// There is no i18n runtime yet — the gate and the five locale bundles land in
// PR-1.6. Collecting the strings here now means that PR is a mechanical
// substitution of one accessor rather than a hunt through JSX, and it makes
// the cost of a new string visible: each one is five translations.
//
// "Dynawalla" is a proper noun and is never translated. The store display name
// is still open (ADR-0016); the wordmark deliberately uses the short form,
// which is the part of the name that will not change.

export const strings = {
  appName: "Dynawalla",

  destinations: {
    practice: "Practice",
    world: "World",
    progress: "Progress",
    profiles: "Profiles",
    settings: "Settings",
  },

  theme: {
    label: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  // The practice loop. Seven strings, and each one is either an action the child
  // has to take or a label a screen reader has to read. There is no status copy,
  // no encouragement and no narration of what the app is doing: a right answer
  // is shown by the answer seating, a wrong one by the correct answer appearing
  // beneath it, and neither needs a sentence. `done` and `keepGoing` are the
  // equal-weight pair at a designed stopping point (P-10) — same plate, same
  // size, no emphasis between them.
  practice: {
    /** The commit action. Explicit: an answer is never submitted by a keystroke count. */
    check: "Check",
    next: "Next",
    done: "Done",
    keepGoing: "Keep going",
    /** Screen-reader label for the answer line. */
    answer: "Answer",
    /** Screen-reader label for the delete key. */
    delete: "Delete",
    /** The one line on the contrast card. It says what the two boards are doing. */
    rebuild: "Put it back together.",
  },
} as const
