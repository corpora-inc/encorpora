import { closesBack, closeTo, type ClosingRouter } from "./return-to";
import { handedHome } from "./student-device";

/** The screen a handed device goes home to, by its path: what was open
 * over it (a layer) is the layer store's (nav/layer-store.ts), never
 * carried in an address. */
export const handedHomePath = () =>
  new URL(handedHome(), "https://amp.invalid").pathname;

/** Whether the way home is Back: the device was handed over from that very
 * screen a moment ago (the entry before this one). */
export const handedHomeIsBack = (router: ClosingRouter) => {
  const home = handedHomePath();
  return closesBack(router.history.location, home, home);
};

/**
 * A handed device's way home, the one way for every control that offers it
 * (the bar's family mark, the menu's "Back to family"). Handed over from
 * that screen a moment ago, it goes Back to it, as the browser's Back does:
 * the parent is where they were on it, at the same scroll position, with
 * what was open there, never at its top (QA 2026-11-23). From anywhere else
 * it opens the screen by its address. Either way the device is handed back
 * to the parent on the way (lib/family-practice-history.ts), with no reload.
 */
export function goHandedHome(router: ClosingRouter) {
  const home = handedHomePath();
  // Back where it was handed over (lib/return-to.ts `closeTo`).
  if (handedHomeIsBack(router)) closeTo(router, home, home);
  else void router.navigate({ href: home, replace: false });
}
