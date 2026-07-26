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

    /* ── The answer schemas beyond one field ──────────────────────────────
       Ten strings, and nine of them are text alternatives. A fraction drawn
       as a numerator over a rule reads as "3 4" without them; a column grid
       reads as a row of loose digits; a number line and a balance scale read
       as nothing at all. `Q-10` and CG-18 both say a representation carries
       its meaning in words as well as in pixels, and the counting board is
       the precedent for what it costs to add them afterwards.

       `nextField` is the only one a child sees: it labels the key that moves
       from a numerator to a denominator, or along the columns of a grid. */
    numerator: "Numerator",
    denominator: "Denominator",
    wholePart: "Whole number",
    /** The key that moves to the next part of the answer. */
    nextField: "Next part",
    /** The row above a column answer, where a regrouping is written. */
    regroup: "Regrouping",

    /** The number line, in words. `at` is written as a fraction or a whole. */
    lineAlt: "Number line from {{from}} to {{to}}, each unit split into {{parts}}. Marked at {{at}}.",
    /** The balance scale, in words. `state` is one of the three below. */
    balanceAlt: "Balance scale. Left pan {{left}}. Right pan {{right}}. {{state}}",
    balanceLevel: "The pans are level.",
    balanceLeft: "The left pan is lower.",
    balanceRight: "The right pan is lower.",

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

  // The world. One string: the drawn screen needs a text alternative (`Q-10`)
  // and a count is the honest one — it is the only thing about the construction
  // that is a number. Everything else the drawing says, it says by being drawn.
  world: {
    cut: "{{apertures}} apertures cut.",
  },

  // The Dynawalla.
  //
  // Twelve fragments over three observation types — PR-2.11's slice of the
  // grammar M6 grows to ~100 (`P-06`). He speaks at most four times in a
  // session and never repeats himself, so the whole of what a child hears in
  // one sitting is four of these.
  //
  // The register: ancient, precise, dryly amused, never saccharine. He notices
  // the specific true thing and stops. There is no "Great job!" here and there
  // is nowhere to put one — every line names something that actually happened
  // in the mathematics or in the stone.
  //
  // **Every fragment must be checkable against the model**, and that is a
  // stronger bar than the word-level screens in `voice.test.ts`. Two of the
  // first twelve passed every one of those screens and were still not true.
  // "That will hold weight. Not all of them do." — every rosette is the same
  // twenty cells of the same geometry from `rosetteCells`; there is no rosette
  // in this model that would not hold. And "You gave it up this time. Most do
  // not, at first." is a claim about other children that nothing in this
  // program measures, which is praise by social comparison and banned outright
  // by MISSION. A ten-year-old who notices the rosettes are all identical has
  // caught the character lying, and after that none of the other ten count.
  //
  // `repaired` is the one that carries the product's promise, so it is the one
  // to read hardest. It is said after the child gets right the item that
  // isolates the step that had just broken — the borrowed ten that was kept in
  // two places at once. It describes what the *number* did. It never names a
  // misconception, a mistake, or the child (`M-16`).
  dynawalla: {
    repaired: [
      "What you borrowed, you spent. It did not stay behind.",
      "The ten left the column it came from.",
      "A ten cannot sit in two places. You saw that.",
      "Nothing left over. That is the whole of it.",
    ],
    closed: [
      "{{apertures}} apertures. The light has somewhere to go now.",
      "It closes. Cut stone does, when the order is right.",
      "A shape, where there was a hole.",
      "Stone does not grow back. That one stays cut.",
    ],
    arrived: [
      "These have a hole in the middle. Watch where the ten goes.",
      "Zero is not nothing. It is a place with nothing in it.",
      "Now the empty column.",
      "Reach past the zero. It has nothing of its own to lend.",
    ],
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
