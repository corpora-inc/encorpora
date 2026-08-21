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
    /** The same control on a game that already reached its ending today. */
    tomorrow: "Tomorrow",
    /** Leaves a running pack. The only host chrome drawn over a game. */
    leave: "Leave",
    /** The pack was launched and is no longer on this device. */
    missing: "This pack is not installed.",
    /** The frame refused, or the runtime could not name the entry document. */
    failed: "This pack could not be opened.",
  },

  /**
   * The catalogue: the listing of installed games, and the two ways to narrow
   * it.
   *
   * Deliberately eight words and six subject names. A listing explains itself
   * by being a listing — there is no "browse our collection", no count of how
   * many games there are, and no empty-state paragraph apologising. `nothing`
   * is the one line of prose, and it exists because a search that matched
   * nothing and drew nothing would look like the app had broken.
   */
  catalog: {
    /** Accessible name for the search field, and its placeholder. */
    find: "Find a game",
    /** The chip that clears the subject filter. Always first, always present. */
    all: "All",
    /** Shown in place of the grid when a search matches no installed game. */
    nothing: "No game here matches that.",
    /* There is no grade string and no age string here, and there must not be
       one again. The card printed "Grades 1–4" and "7+" and both were removed
       by founder instruction: a band names a top, and this product does not
       have one. Every pack's mathematics adapts upward without bound and the
       audience deliberately runs past school age — adults and mathletes are the
       goal, not an edge case — so "Grades 1–4" on a card turned most of the
       audience away at the door. `catalog.test.ts` fails if either key returns,
       or if any string in this block says "grade" or templates a from–to range. */

    /**
     * The subjects, derived from skill ids at runtime (`catalog/domains.ts`).
     * A seventh subject appearing in a pack needs a seventh entry here; until
     * it has one the game is still listed, just not filed.
     */
    domains: {
      ns: "Number sense",
      add: "Addition & subtraction",
      mul: "Multiplication",
      div: "Division",
      frac: "Fractions",
      alg: "Equality & algebra",
    },
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
    /**
     * The generative soundscape switch. One word, and it is "Music" rather
     * than "Soundscape": a parent reading a settings row is deciding whether
     * the tablet plays tunes, and the word for that is not a term of art.
     */
    music: "Music",
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

  /**
   * The day pass. **Read this copy as a whole before changing a line of it.**
   *
   * Two audiences and two stages, and the split is the design: a child at a
   * natural stopping point sees the first four strings and no money, no price,
   * no offer and no reason to fetch a parent. Everything below `gate` is behind
   * the parental gate and is written for an adult.
   *
   * What is deliberately absent, and must stay absent: any countdown, any
   * quantity remaining, any "your friends", any "only today", any sentence
   * that makes stopping sound like a loss. The child-facing copy points at the
   * other games, because there are always other games and that is the honest
   * thing to say.
   */
  pass: {
    /** The whole child-facing message. Nothing is taken away; a thing ended. */
    restTitle: "That's {{pack}} for today.",
    restBody: "Every other game is still open.",
    /** The way out, and the biggest control on the sheet. */
    restLeave: "Choose another game",
    /** Small, quiet, and the only route to a price. Never the primary control. */
    forGrownUps: "Grown-ups",

    /** The parental gate. Reading load, never arithmetic. */
    gateTitle: "For a grown-up",
    gateYear: "Type the current year, all four digits.",
    gateWord: "Type this word:",
    gateEntry: "Answer",
    gateGo: "Continue",
    gateWrong: "That's not it. Try again.",

    offerTitle: "The Dynawalla Pass",
    offerBody: "Every game, as often as you like. No subscription, no ads.",
    lifetime: "Lifetime",
    lifetimeNote: "Pay once. Yours for good.",
    month: "One month",
    monthNote: "Thirty days.",
    day: "Day pass",
    dayNote: "Today.",
    restore: "Restore a pass",
    /** Closes the sheet and changes nothing. Always one tap, always visible. */
    notNow: "Not now",
    /** No store is wired into this build, or the device could not reach one. */
    storeUnavailable: "The store could not be reached.",
    /** A pass is held. Shown where a price would otherwise be. */
    held: "This device has a pass.",
  },

  parents: {
    version: "Version",
    storage: "On this device",
    learners: "Learners",
    /** Erases every learner, everything they built, and every installed pack. */
    erase: "Erase everything",
    /** The same row, armed. One more press does it; leaving the screen disarms. */
    eraseConfirm: "Erase everything — press again",
  },
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
