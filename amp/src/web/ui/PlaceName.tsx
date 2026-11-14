import { useLayoutEffect, useRef, useState } from "react";
import styles from "./AppBar.module.css";

/** Below this width the bar names only the shorter name. */
const PHONE = "(max-width: 767px)";

/**
 * The place named in the bar, never cut short (premium rule 8): the whole
 * name when it fits, else the shorter one, else nothing. A phone shows the
 * shorter one. Every name is laid out in one cell, so choosing between
 * them never moves anything; the choice is made before the first paint and
 * again whenever the bar's room changes.
 */
export function PlaceName({
  name,
  short,
}: {
  name: string;
  /** A shorter name ("Grade 4 Math" for "Grade 4 Math · Alder Grove"). */
  short?: string | null;
}) {
  const names = short && short !== name ? [name, short] : [name];
  const box = useRef<HTMLSpanElement>(null);
  // Which name shows: an index into `names`, -1 for none, null unmeasured.
  const [shown, setShown] = useState<number | null>(null);
  const key = names.join("\n");
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    // Where the browser can't say (an old engine, a test document), the
    // whole name fits a wide window and the short one a phone's.
    const phone =
      typeof window.matchMedia === "function" ? window.matchMedia(PHONE) : null;
    const fit = () => {
      const style = getComputedStyle(element);
      const room =
        element.clientWidth -
        parseFloat(style.paddingInlineStart || "0") -
        parseFloat(style.paddingInlineEnd || "0");
      const widths = [
        ...element.querySelectorAll<HTMLElement>("[data-name]"),
      ].map((node) => node.getBoundingClientRect().width);
      const pick = widths.findIndex(
        (width, index) =>
          width <= room + 0.5 &&
          !(phone?.matches && widths.length > 1 && index === 0),
      );
      setShown(pick);
    };
    fit();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(element);
    phone?.addEventListener("change", fit);
    void document.fonts?.ready.then(fit);
    return () => {
      observer?.disconnect();
      phone?.removeEventListener("change", fit);
    };
  }, [key]);
  const text = shown !== null && shown >= 0 ? names[shown]! : null;
  return (
    <span
      ref={box}
      className={styles.place}
      title={name}
      data-place-name={text ?? ""}
      data-fit={text === null ? "none" : undefined}
    >
      {names.map((value, index) => (
        <span
          key={value}
          className={styles.placeOption}
          data-name=""
          data-shown={index === shown || undefined}
          aria-hidden={index === shown ? undefined : true}
        >
          {value}
        </span>
      ))}
    </span>
  );
}
