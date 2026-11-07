import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import styles from "./Tabs.module.css";

export type TabItem = {
  id: string;
  label: string;
  /** The tab's URL path, without the leading slash. */
  path: string;
  search?: Record<string, unknown>;
};

/** Screens of one place, each a real URL: links with `aria-current`, drawn so
 * the active tab changes color and rule but never geometry. */
export function Tabs({
  label,
  items,
  active,
}: {
  label: string;
  items: readonly TabItem[];
  active: string;
}) {
  const list = useRef<HTMLElement>(null);
  // On a narrow screen the strip scrolls; the current tab starts in view. Only
  // the strip moves, never the page.
  useLayoutEffect(() => {
    const strip = list.current;
    const tab = strip?.querySelector('[aria-current="page"]');
    if (!strip || !tab) return;
    const from = strip.getBoundingClientRect(),
      box = tab.getBoundingClientRect();
    if (box.right > from.right - 28) strip.scrollLeft += box.left - from.left;
  }, [active]);
  return (
    <nav ref={list} aria-label={label} className={styles.tabs}>
      {items.map((item) => (
        <Link
          key={item.id}
          to="/$"
          params={{ _splat: item.path }}
          search={item.search ?? {}}
          aria-current={item.id === active ? "page" : undefined}
          className={styles.tab}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
