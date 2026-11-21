import { clearHue, paintHue, useHueStore } from "./hue";
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
export function holdBold(learner: string) {
  const root = document.documentElement;
  holders++;
  // The learner's latest world, until practice moves it on.
  if (!root.style.getPropertyValue("--look-hue"))
    paintHue(useHueStore.getState().latest(learner));
  root.setAttribute("data-look", "bold");
  return () => {
    holders = Math.max(0, holders - 1);
    if (holders > 0) return;
    root.removeAttribute("data-look");
    clearHue();
  };
}
