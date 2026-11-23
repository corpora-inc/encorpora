import { useLayoutEffect, useState, type RefObject } from "react";

/** The roster's three forms, by the width it is given (not the window's):
 * rows of 64 px under 680 px, rows of 56 px under 960 px, then the grid.
 *
 * A tablet's row ends in 328 px of figures (percent over the last five,
 * the four help counts, last active). Under 680 px that leaves the name
 * and the skill too little to read (a family's list is two thirds of a
 * 1024 px window: 619 px), so a narrower roster takes a phone's row, whose
 * figures are 84 px and whose skill has the rest. */
export type LiveLayout = "phone" | "tablet" | "desktop";

export const TABLET_FROM = 680;
export const DESKTOP_FROM = 960;

export const layoutFor = (width: number): LiveLayout =>
  width >= DESKTOP_FROM ? "desktop" : width >= TABLET_FROM ? "tablet" : "phone";

/** The window less a phone's or a desktop's gutters: a first guess before
 * the element can be measured. */
const guess = () =>
  typeof window === "undefined"
    ? DESKTOP_FROM
    : window.innerWidth - (window.innerWidth >= 768 ? 48 : 32);

/** Calls `measure` when the element's size changes, on the next frame: a
 * form that changes inside the observer's own delivery can change the
 * element's size again, which the browser reports as a page error
 * ("ResizeObserver loop completed with undelivered notifications"). */
export function observeWidth(element: Element, measure: () => void) {
  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  });
  observer.observe(element);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

/** This element's form, measured before paint and on every resize. */
export function useLiveLayout(ref: RefObject<HTMLElement | null>): LiveLayout {
  const [layout, setLayout] = useState<LiveLayout>(() => layoutFor(guess()));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // An element not laid out yet (a test's document) keeps the guess.
      if (element.clientWidth > 0) setLayout(layoutFor(element.clientWidth));
    };
    measure();
    return observeWidth(element, measure);
  }, [ref]);
  return layout;
}
