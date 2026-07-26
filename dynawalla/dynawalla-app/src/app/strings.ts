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

  // The practice loop. Every string is either an action the child has to take or
  // the text alternative for something drawn (`Q-10`). No status copy, no
  // encouragement, no narration.
  //
  // Seven are text alternatives, added because the first cut had none: the verdict
  // well's accessible text was the empty string on a correct answer, the operators
  // were `aria-hidden` so an item read as "95 19", and every counter and socket on
  // the board was `aria-hidden` with nothing in its place — "which board closes"
  // was carried by colour. Five translations each is cheap against that.
  //
  // `done` and `keepGoing` are the equal-weight pair at a designed stopping point
  // (P-10) — same plate, same size, no emphasis between them.
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

    /** The operators, read aloud. The glyphs themselves are decorative. */
    minus: "minus",
    plus: "plus",
    /** The seated verdict, read aloud. The mark is decorative and colour is not a
        text alternative, so without this the well announced nothing at all. */
    correct: "Correct.",

    /** One plate's check, read aloud: the visible `407 + 199 = 606`. */
    boardSum: "{{addend}} plus {{subtrahend}} makes {{sum}}.",
    /** One place column: sockets carved, counters sitting in them. */
    boardPlace: "{{place}}: {{seated}} of {{sockets}}.",
    /** …and the counters that could not sit. This is the contradiction, in words. */
    boardSpare: "{{place}}: {{spare}} with nowhere to sit.",
    /** Said of the plate that closes. Never its opposite — the plate that does not
        close is described by what is left over, not by a verdict on the child. */
    boardCloses: "Every counter has a place.",
  },
} as const

/**
 * Substitute `{{slot}}` placeholders — the whole interpolation layer until PR-1.6
 * brings the real one, in the syntax the locale bundles will use so the call
 * sites do not change. An unknown slot is left standing rather than silently
 * emptied: a visible `{{sum}}` in a translation is a bug report.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, key: string) =>
    key in values ? String(values[key]) : slot,
  )
}
