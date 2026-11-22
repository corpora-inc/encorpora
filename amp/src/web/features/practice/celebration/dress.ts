import { claimAhead, rememberLook } from "../look-ahead";
import { arriving, clearHue, paintHue, useHueStore } from "./hue";
// Colorful's dress goes wherever the look can be held: practice, and a
// student's other screens (the app frame holds it there). Only a learner in
// Colorful ever loads this file, its stylesheet and the hue code (look.ts).
import "./skin.css";

/** Every host that asks for Colorful right now (practice, a student's own
 * screens). The attribute stays while any one does, so a host leaving (a
 * child going from practice to their standings) never takes it from the
 * next one, and goes with the last. */
let holders = 0;
/** Puts the dress on and returns what takes it off. */
export function holdBold(learner: string, kept: number | null = null) {
  const root = document.documentElement;
  // The dress going on is not a turn: it arrives in its hue (hue.ts). What
  // this device put on ahead of the server's answer (look-ahead.ts) is the
  // same arrival, still under way.
  if (holders === 0) arriving();
  claimAhead();
  holders++;
  // The learner's latest world, until practice moves it on.
  // The color they keep, or their latest world until practice moves it on.
  const latest = kept ?? useHueStore.getState().latest(learner);
  if (kept !== null || !root.style.getPropertyValue("--look-hue"))
    paintHue(latest);
  rememberLook(learner, latest);
  root.setAttribute("data-look", "bold");
  return () => {
    holders = Math.max(0, holders - 1);
    if (holders > 0) return;
    root.removeAttribute("data-look");
    clearHue();
  };
}

/** The learner keeps this color from now on: it is on the page at once, and
 * this device remembers it for their next first paint. */
export function keepHue(learner: string, hue: number) {
  paintHue(hue);
  rememberLook(learner, hue);
}
