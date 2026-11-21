import { useLayoutEffect, useState, type RefObject } from "react";

/** The roster's three forms, by the width it is given (not the window's):
 * rows of 64 px under 600 px, rows of 56 px under 960 px, then the grid. */
export type LiveLayout = "phone" | "tablet" | "desktop";

export const TABLET_FROM = 600;
export const DESKTOP_FROM = 960;

export const layoutFor = (width: number): LiveLayout =>
  width >= DESKTOP_FROM ? "desktop" : width >= TABLET_FROM ? "tablet" : "phone";

/** The window less a phone's or a desktop's gutters: a first guess before
 * the element can be measured. */
const guess = () =>
  typeof window === "undefined"
    ? DESKTOP_FROM
    : window.innerWidth - (window.innerWidth >= 768 ? 48 : 32);

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
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return layout;
}
