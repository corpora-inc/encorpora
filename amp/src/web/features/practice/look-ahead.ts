/**
 * Colorful before the first paint. A learner's look comes from the server
 * (look.ts), and its code loads only for a learner who wears it; both arrive
 * after the screen. So this device remembers, per learner, that they wear
 * Colorful and the hue of their latest world, and a learner's screens put
 * that on `<html>` in the commit that first paints them. The answer from the
 * server then keeps it (celebration/dress.ts takes it over) or takes it off.
 * A learner new to this device has nothing remembered: they see Calm once.
 * Small on purpose: this is all of Colorful the app's first code carries.
 */
const KEY = "amp.look-ahead";
const LOOK = "data-look";
/** No turn while it goes on (ui/tokens.css): it arrives in its hue. */
const ARRIVING = "data-look-arriving";

function remembered(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch (error) {
    console.warn("The look this device remembers was not read", error);
    return {};
  }
}

/** Remember a learner's Colorful world, or (`null`) that they wear Calm. */
export function rememberLook(learner: string, hue: number | null) {
  try {
    const all = remembered();
    if (hue === null ? !(learner in all) : all[learner] === hue) return;
    if (hue === null) delete all[learner];
    else all[learner] = hue;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (error) {
    console.warn("The look was not remembered on this device", error);
  }
}

/** Whether this browser can draw Colorful: oklch() colors and registered
 * properties. Without them, Calm is shown (and recorded). Checked once. */
let supported: boolean | null = null;
export function canShowColorful() {
  if (supported !== null) return supported;
  try {
    supported =
      typeof CSS !== "undefined" &&
      "registerProperty" in CSS &&
      // tokens.css's own feature query: oklch() with calc() in its hue.
      getComputedStyle(document.documentElement)
        .getPropertyValue("--colorful-unsupported")
        .trim() === "";
  } catch (error) {
    console.warn("Colorful's support check failed; Calm shows", error);
    supported = false;
  }
  return supported;
}

/** Whether the dress on `<html>` is only this file's, not yet the server's. */
let ahead = false;
/** The screens that asked for it and are still mounted. */
let asking = 0;
/** Put on what this device remembers for the learner, before they paint.
 * Returns what the asking screen calls when it leaves: the last one to
 * leave before the server answers takes it off. */
export function dressAhead(learner: string) {
  asking++;
  const root = document.documentElement;
  const hue = remembered()[learner];
  if (
    root.getAttribute(LOOK) !== "bold" &&
    typeof hue === "number" &&
    canShowColorful()
  ) {
    root.style.setProperty("--look-hue", `${hue}deg`);
    root.setAttribute(ARRIVING, "");
    root.setAttribute(LOOK, "bold");
    ahead = true;
  }
  return () => {
    asking = Math.max(0, asking - 1);
    if (asking === 0) clearAhead();
  };
}
/** The server said Colorful: the dress is its own now (dress.ts). */
export function claimAhead() {
  ahead = false;
}
/** The server said Calm, or the learner left before it answered. */
export function clearAhead() {
  if (!ahead) return;
  ahead = false;
  const root = document.documentElement;
  root.removeAttribute(LOOK);
  root.removeAttribute(ARRIVING);
  root.style.removeProperty("--look-hue");
}
