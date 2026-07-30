// THE MANUAL — how to play, in words a seven-year-old already has.
//
// This game invents a whole vocabulary. A *fall*, a *pin*, a *kick out*, the
// *count*, being *waved off*, the *bar*, the *pedals*, the *belt*. The first
// version of this text used every one of those words and defined none of them,
// and the founder's report was exactly that:
//
//   "The instructions need to define the terms sometimes. I don't know what 'the
//    fall' is on the grapple foundry for example."
//
// Two rules follow from that, and they are the reason this text lives in its own
// module with a test on it:
//
//   1. **Every term the game invents is defined the first time it is used, right
//      where it is used.** Not in a glossary at the bottom — a child will not go
//      looking for one, and the word they did not know was three lines above.
//   2. **Every word the game puts on the screen in capitals is in here.** A child
//      who loses a fall reads THREE, or NO WAY OUT, or WAVED OFF, in letters half
//      a screen tall. If the manual has never said what those mean, the game has
//      told them off in a language they do not speak.
//
// Short sentences. Concrete nouns. No metaphor, and nothing about how well or
// badly they are doing.

import type { Section } from "../../../packs/shared/game-chrome/index.ts"

export const TITLE = "THE GRAPPLE FOUNDRY"

/**
 * The splash, before the first tap.
 *
 * The rule that decides every fall — that going over loses on the spot — is
 * stated here rather than in the manual, because this game shipped with it
 * discoverable only by losing to it.
 */
export const SUMMARY: readonly string[] = [
  "A wrestler is holding you flat on the mat. Being held down like this is called a pin.",
  "The board above the ring shows a sum. Work out the answer, then tap the two pedals until the bar across your chest holds exactly that number. Then you get free.",
  "Go one over the answer and you do not get free this time. Do not tap fast. Work it out first.",
]

export const SECTIONS: readonly Section[] = [
  {
    heading: "How to get free",
    lines: [
      "Look at the board. That is the sign hanging above the ring. It shows a sum, like 45 + 28.",
      "Work out the answer in your head. The game never shows it to you.",
      "The bar is the iron rod lying across your chest. The number on it is written in the middle of the screen, and it starts at 0.",
      "The two pedals are the big squares at the bottom of the screen. Each one has a number stamped on it. Tapping a pedal adds that number to the bar.",
      "Get the bar to exactly your answer and it tips off you and you are free. Getting free like that is called a kick out, and the game shows KICK OUT.",
    ],
  },
  {
    heading: "One try is called a fall",
    lines: [
      "Every time a wrestler pins you, you get one try at getting free. That one try is called a fall.",
      "You can win a fall or lose it. Either way, a moment later the next one starts. You never run out of tries.",
      "Win enough falls and that wrestler is beaten and a new one walks out.",
    ],
  },
  {
    heading: "Going over loses the fall at once",
    lines: [
      "One over the answer and the fall is lost. Not close. Over.",
      "So tapping fast never works. Work out the taps first, then tap.",
      "Say the answer is 25 and your pedals are 7 and 4. Three taps of 7 makes 21, then one tap of 4 makes 25. That is a kick out.",
      "If you do go over, the game shows TOO MUCH and tells you the number you needed.",
    ],
  },
  {
    heading: "When there is no way out",
    lines: [
      "Sometimes the number you have left cannot be made from your two pedals at all.",
      "If you need 3 more and the pedals are 4 and 7, nothing makes 3. The game shows NO WAY OUT and ends the fall there instead of making you wait.",
      "So think about what you will have left, not only about the next tap.",
    ],
  },
  {
    heading: "The referee slaps the mat three times",
    lines: [
      "The referee is the person kneeling beside you. They slap the mat three times, slowly. Those three slaps are called the count.",
      "The three short bars above the mat fill up, so you can see how much of the count is left.",
      "When the third slap lands the fall is over and you did not get free. The game shows THREE.",
      "A longer sum and a longer escape both give you more time.",
      "Winning lots of falls never takes time away. The clock is set by the sum, not by how well you are doing.",
    ],
  },
  {
    heading: "The finish the referee says no to",
    lines: [
      "Some totals are the answer you get if you do the sum a common wrong way.",
      "Land the bar on one of those and the crowd roars for a second, and then the referee waves his hands to say no. That is called being waved off, and the game shows WAVED OFF.",
      "It uses up a little of the count. It never costs you the fall. Keep going.",
    ],
  },
  {
    heading: "The strip along the top",
    lines: [
      "Every time you get free, one brass plate is added to the strip at the top of the screen. That strip is your belt.",
      "Nothing ever takes a plate off it. Losing a fall does not, and neither does going over.",
    ],
  },
  {
    heading: "Controls",
    lines: [
      "Tap anywhere on the left half of the screen for the LIGHT pedal, and anywhere on the right half for the HEAVY one.",
      "On a keyboard, A and D work, and so do the left and right arrows.",
      "Press M to turn the sound off.",
    ],
  },
]

/**
 * The words this game prints on the screen in capital letters, on a banner over
 * the ring, at a moment a child is trying to work out what just happened.
 *
 * Exported so `manual.test.ts` can assert that every one of them is explained
 * above. It is not a display list — `mount.ts` builds each banner from what
 * actually happened in the fall.
 */
export const BANNER_WORDS = ["KICK OUT", "WAVED OFF", "TOO MUCH", "NO WAY OUT", "THREE"] as const

/**
 * Every term this game invents, and nothing a child brings with them.
 *
 * `add`, `answer`, `number` and `tap` are not here. `fall`, `pin`, `count` and
 * `belt` are, because in this game they do not mean what they usually mean.
 */
export const INVENTED_TERMS = [
  "pin",
  "fall",
  "kick out",
  "bar",
  "pedal",
  "board",
  "count",
  "referee",
  "waved off",
  "belt",
] as const
