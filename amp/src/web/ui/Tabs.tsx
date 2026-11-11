import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import styles from "./Tabs.module.css";

/** Tighter paddings to try, in order, when the labels do not fit. */
const FIT_STEPS = ["snug", "tight"] as const;

export type TabItem = {
  id: string;
  label: string;
  /** The tab's URL path, without the leading slash. */
  path: string;
  search?: Record<string, unknown>;
};

/**
 * The one tab style: the screens of one group, each a real URL. Router links
 * with `aria-current`; every label keeps one weight and size, so the active
 * tab changes its fill and never its geometry. One row that never wraps: on a
 * narrow screen the strip scrolls, and only the strip.
 */
export function Tabs({
  label,
  items,
  active,
  className = "",
}: {
  label: string;
  items: readonly TabItem[];
  active: string | null;
  className?: string;
}) {
  const list = useRef<HTMLElement>(null);
  // The current tab starts in view; only the strip scrolls, never the page.
  useLayoutEffect(() => {
    const strip = list.current;
    const tab = strip?.querySelector('[aria-current="page"]');
    if (!strip || !tab) return;
    const from = strip.getBoundingClientRect(),
      box = tab.getBoundingClientRect();
    if (box.left < from.left || box.right > from.right - 28)
      strip.scrollLeft += box.left - from.left;
  }, [active]);
  // Every tab in view when the labels can fit: a row too wide for its strip
  // tightens its padding a step at a time (each target stays 44 px) before
  // it scrolls. Only a row that cannot fit even then scrolls, and it fades at
  // its trailing edge so the cut reads as "more". Measured before paint.
  useLayoutEffect(() => {
    const strip = list.current;
    if (!strip) return;
    const over = () => strip.scrollWidth > strip.clientWidth + 1;
    const measure = () => {
      let fit: string | null = null;
      strip.removeAttribute("data-fit");
      for (const step of FIT_STEPS) {
        if (!over()) break;
        fit = step;
        strip.setAttribute("data-fit", step);
      }
      if (fit && over()) strip.removeAttribute("data-fit");
      const more = over();
      if (more !== strip.hasAttribute("data-more"))
        strip.toggleAttribute("data-more", more);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [items]);
  return (
    <nav
      ref={list}
      aria-label={label}
      className={`${styles.tabs} ${className}`}
      data-tabs
    >
      {items.map((item) => (
        <Link
          key={item.id}
          to="/$"
          params={{ _splat: item.path }}
          search={item.search ?? {}}
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={{}}
          aria-current={item.id === active ? "page" : undefined}
          className={styles.tab}
          data-tab={item.id}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
