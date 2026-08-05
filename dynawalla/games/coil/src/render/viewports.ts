// The screens this pack is asserted against, in one place.
//
// Shared by `chrome.test.ts` and `hintFit.test.ts` rather than exported from one
// of them: a test file that imports another test file runs it a second time, and
// a suite that reports a test twice is a suite nobody can count.

import { type Insets, NO_INSETS } from "../../../../packs/shared/game-chrome/index.ts"

const PORTRAIT_NOTCH: Insets = { top: 59, right: 0, bottom: 34, left: 0 }
const LANDSCAPE_NOTCH: Insets = { top: 0, right: 59, bottom: 21, left: 59 }
/** An Android phone with a status bar and a three-button navigation bar. */
export const PORTRAIT_ANDROID: Insets = { top: 24, right: 0, bottom: 48, left: 0 }
/** The same phone turned sideways: the nav bar moves to the trailing edge. */
const LANDSCAPE_ANDROID: Insets = { top: 0, right: 48, bottom: 0, left: 24 }

export const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  // The founder's own handset: 1080×2340 physical, which the browser reports as
  // 393×851 CSS px at devicePixelRatio 2.75. Both ways up.
  ["the founder's phone, portrait", 393, 851],
  ["the founder's phone, landscape", 851, 393],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

/** A flat profile always, and the chrome the device of that shape actually has. */
export function profiles(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NO_INSETS],
    w >= h ? ["landscape notch", LANDSCAPE_NOTCH] : ["portrait notch", PORTRAIT_NOTCH],
    w >= h
      ? ["android 3-button nav", LANDSCAPE_ANDROID]
      : ["android status + 3-button nav", PORTRAIT_ANDROID],
  ]
}
