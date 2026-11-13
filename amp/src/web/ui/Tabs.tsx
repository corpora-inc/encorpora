import { Link, useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { Menu, MenuItem } from "./Menu";
import styles from "./Tabs.module.css";

/** How wide a strip's fading edge is, in px. */
const FADE = 28;
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
 * tab changes its fill and never its geometry. One row that never wraps and
 * never cuts a label: it tightens to fit, and a row that still cannot fit
 * shows the whole tabs that do, then More with the rest. The open tab is
 * always one of the tabs shown.
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
  const navigate = useNavigate();
  // The tabs More holds, in their order; empty while every tab fits.
  const [rest, setRest] = useState<readonly string[]>([]);
  // Every tab in view when the labels can fit: a row too wide for its strip
  // tightens its padding a step at a time (each target stays 44 px) before
  // it scrolls. Only a row that cannot fit even then scrolls, and it fades at
  // its trailing edge so the cut reads as "more". Measured before paint.
  useLayoutEffect(() => {
    const strip = list.current;
    if (!strip) return;
    const over = () => strip.scrollWidth > strip.clientWidth + 1;
    const measure = () => {
      const tabs = [...strip.querySelectorAll<HTMLElement>("[data-tab]")];
      strip.removeAttribute("data-fit");
      strip.removeAttribute("data-overflow");
      for (const tab of tabs) tab.removeAttribute("data-hidden");
      for (const step of FIT_STEPS) {
        if (!over()) break;
        strip.setAttribute("data-fit", step);
      }
      let hidden: string[] = [];
      if (over()) {
        // Still too wide at the tightest padding: whole tabs, then More. The
        // room is the strip's cell, which never changes with what it shows.
        // The tabs that stay get their room back: never the tightest
        // padding beside a More.
        strip.setAttribute("data-fit", FIT_STEPS[0]);
        strip.setAttribute("data-overflow", "");
        const room = strip.parentElement?.clientWidth ?? strip.clientWidth;
        const gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
        const width = (tab: HTMLElement) => tab.getBoundingClientRect().width;
        const more = strip.querySelector<HTMLElement>("[data-tabs-more]");
        const current = Math.max(
          0,
          tabs.findIndex((tab) => tab.getAttribute("aria-current") === "page"),
        );
        // The first `count` tabs, the open one taking the last slot when it
        // would otherwise be in More.
        const shown = (count: number) => {
          const first = tabs.slice(0, count);
          return current < count
            ? first
            : [...first.slice(0, count - 1), tabs[current]!];
        };
        // How many fit never depends on which tab is open, so every screen
        // of the group shows the same number: the last slot is sized for the
        // widest tab that could take it.
        const fits = (count: number) => {
          const used =
            tabs.slice(0, count - 1).reduce((sum, tab) => sum + width(tab), 0) +
            Math.max(...tabs.slice(count - 1).map(width)) +
            (more ? width(more) : 0) +
            gap * count;
          return used <= room;
        };
        let count = tabs.length - 1;
        while (count > 1 && !fits(count)) count--;
        const keep = new Set(shown(count));
        hidden = tabs
          .filter((tab) => !keep.has(tab))
          .map((tab) => {
            tab.setAttribute("data-hidden", "");
            return tab.dataset.tab!;
          });
      }
      setRest((was) => (was.join() === hidden.join() ? was : hidden));
      const scrolls = over();
      if (scrolls !== strip.hasAttribute("data-more"))
        strip.toggleAttribute("data-more", scrolls);
      // A row that fits starts at its start; one that scrolls brings the
      // open tab fully into view, clear of the fades, by the least it can.
      // Only the strip scrolls, never the page.
      if (!scrolls) strip.scrollLeft = 0;
      else {
        const tab = strip.querySelector<HTMLElement>(
          '[aria-current="page"]:not([data-hidden])',
        );
        if (tab) {
          const from = strip.getBoundingClientRect(),
            box = tab.getBoundingClientRect();
          if (box.left < from.left + FADE)
            strip.scrollLeft -= from.left + FADE - box.left;
          else if (box.right > from.right - FADE)
            strip.scrollLeft += box.right - (from.right - FADE);
        }
      }
      edges();
    };
    // Which ends have more past them: each fades only while it does.
    const edges = () => {
      const start = strip.scrollLeft > 1;
      const end = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
      strip.dataset.edges =
        start && end ? "both" : start ? "start" : end ? "end" : "none";
    };
    strip.addEventListener("scroll", edges, { passive: true });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip.parentElement ?? strip);
    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", edges);
    };
  }, [items, active]);
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
      <span className={styles.moreSlot} data-tabs-more>
        <Menu
          label="More"
          aria-label={`More ${label.toLowerCase()} tabs`}
          triggerClassName={`${styles.tab} ${styles.more}`}
        >
          {items
            .filter((item) => rest.includes(item.id))
            .map((item) => (
              <MenuItem
                key={item.id}
                onSelect={() =>
                  void navigate({
                    to: "/$",
                    params: { _splat: item.path },
                    search: item.search ?? {},
                  } as never)
                }
              >
                {item.label}
              </MenuItem>
            ))}
        </Menu>
      </span>
    </nav>
  );
}
