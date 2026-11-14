import { Link, useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { Menu, MenuItem } from "./Menu";
import styles from "./Tabs.module.css";

/** How wide a strip's fading edge is, in px. */
const FADE = 28;
/** A phone shows at most this many tabs; the rest are under More. */
export const PHONE_TABS = 4;
const PHONE = "(max-width: 599px)";
/** Tighter paddings to try, in order, when the labels do not fit; `small`
 * (a 320 px phone with a long open tab under More) also takes the type down
 * a step. */
const FIT_STEPS = ["snug", "tight", "small"] as const;

export type TabItem = {
  id: string;
  label: string;
  /** The tab's URL path, without the leading slash. */
  path: string;
  search?: Record<string, unknown>;
  /** One of the tabs a phone shows; the first four when none says. */
  phone?: boolean;
};

/** The tabs a phone shows, in their order. */
export function phoneTabs(items: readonly TabItem[]): readonly TabItem[] {
  const chosen = items.filter((item) => item.phone);
  return (chosen.length ? chosen : items).slice(0, PHONE_TABS);
}

/**
 * The one tab style: the screens of one group, each a real URL. Router links
 * with `aria-current`; every label keeps one weight and size, so the active
 * tab changes its colour and underline and never its geometry. One row that
 * never wraps and never cuts a label. A phone shows the group's four phone
 * tabs and More with the rest (More wears the open tab's name when it holds
 * it); a wider row tightens to fit, and one that still cannot fit shows the
 * whole tabs that do, then More, with the open tab always shown.
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
      strip.removeAttribute("data-phone");
      strip.removeAttribute("data-more-narrow");
      for (const tab of tabs) tab.removeAttribute("data-hidden");
      for (const step of FIT_STEPS) {
        if (!over()) break;
        strip.setAttribute("data-fit", step);
      }
      let hidden: string[] = [];
      // A phone: the same few tabs everywhere, in every group, and More with
      // the rest, so a family's and a teacher's rows read alike. The open
      // tab may be under More; More then wears its name.
      if (window.matchMedia(PHONE).matches && tabs.length > PHONE_TABS) {
        // Never a strip that scrolls or fades on a phone: whole tabs that
        // fit, and More. In order, the first that fits: every tab when More
        // would hold only one; the four phone tabs and a More wide enough for
        // any name it takes; the same with More saying only "More" (marked
        // when it holds the open tab); then three and More. Each tries the
        // type steps before giving up.
        strip.removeAttribute("data-fit");
        strip.setAttribute("data-phone", "");
        const phone = phoneTabs(items).map((item) => item.id);
        const current = items.find((item) => item.id === active)?.id;
        const show = (
          ids: readonly string[],
          more: "wide" | "narrow" | null,
        ) => {
          strip.removeAttribute("data-fit");
          strip.toggleAttribute("data-overflow", more !== null);
          strip.toggleAttribute("data-more-narrow", more === "narrow");
          const keep = new Set(ids);
          hidden = [];
          for (const tab of tabs) {
            const out = !keep.has(tab.dataset.tab!);
            tab.toggleAttribute("data-hidden", out);
            if (out) hidden.push(tab.dataset.tab!);
          }
          for (const step of [null, ...FIT_STEPS]) {
            if (step) strip.setAttribute("data-fit", step);
            if (!over()) return true;
          }
          return false;
        };
        // Three and More keeps the open tab among the three when it can.
        const three =
          current && phone.slice(0, 3).includes(current)
            ? phone.slice(0, 3)
            : current && phone.includes(current)
              ? [...phone.slice(0, 2), current]
              : phone.slice(0, 3);
        const fitted =
          (tabs.length === PHONE_TABS + 1 &&
            show(
              tabs.map((tab) => tab.dataset.tab!),
              null,
            )) ||
          show(phone, "wide") ||
          show(phone, "narrow") ||
          show(three, "narrow");
        if (!fitted) console.warn("The tab row is wider than a phone", label);
        strip.scrollLeft = 0;
      } else if (over()) {
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
        const fits = (count: number) => {
          const row = shown(count);
          const used =
            row.reduce((sum, tab) => sum + width(tab), 0) +
            (more ? width(more) : 0) +
            gap * row.length;
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
      // A phone's row never scrolls or fades (it fits by construction).
      const scrolls = !strip.hasAttribute("data-phone") && over();
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
    const phone = window.matchMedia(PHONE);
    phone.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      phone.removeEventListener("change", measure);
      strip.removeEventListener("scroll", edges);
    };
    // More's label is the open tab's when it holds it: measure again then.
  }, [items, active, rest]);
  // The open tab, when it is under More: More shows its name, marked open.
  const hiddenActive = items.find(
    (item) => item.id === active && rest.includes(item.id),
  );
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
          // As wide as its widest name on every screen of the group, so no
          // tab beside it moves when it takes the open tab's name.
          label={
            <span className={styles.moreLabel}>
              {[
                "More",
                ...items
                  .filter((item) => rest.includes(item.id))
                  .map((item) => item.label),
              ].map((name) => (
                <span
                  key={name}
                  data-more={name === "More" || undefined}
                  data-shown={
                    name === (hiddenActive?.label ?? "More") || undefined
                  }
                >
                  {name}
                </span>
              ))}
            </span>
          }
          aria-label={
            hiddenActive
              ? `${hiddenActive.label}, more ${label.toLowerCase()} tabs`
              : `More ${label.toLowerCase()} tabs`
          }
          triggerClassName={`${styles.tab} ${styles.more} ${hiddenActive ? styles.moreActive : ""}`}
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
