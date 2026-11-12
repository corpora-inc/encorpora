import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MathText } from "./MathText";

/** Text that wraps once fills well under two full lines (math breaks only
 * at its relations). */
const TWO_LINES = 1.6;

/** A choice's legend and its options, sized to show every option whenever
 * the dock has room. When they truly cannot fit, the list scrolls inside the
 * dock and says so: the edge with more options past it fades, a shadow falls
 * under the list, and the legend's line counts the options ("6 options").
 * The count's place is reserved, so nothing moves when it appears. */
export function ChoiceList({
  legend,
  count,
  children,
}: {
  legend: string;
  count: number;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    // Two across when every option reads in at most two lines at half the
    // width (short measurements, numbers, names); else one statement a row.
    const columns = () => {
      el.setAttribute("data-measure", "");
      const style = getComputedStyle(el);
      const inner =
        el.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0);
      const half = (inner - (parseFloat(style.columnGap) || 0)) / 2;
      const fits = [...el.children].every((option) => {
        const whole = option.getBoundingClientRect().width;
        const text =
          option.querySelector(".choice-content")?.getBoundingClientRect()
            .width ?? whole;
        const room = half - (whole - text);
        return room > 0 && text <= TWO_LINES * room;
      });
      el.removeAttribute("data-measure");
      const next = fits ? "2" : "1";
      if (el.dataset.columns !== next) el.dataset.columns = next;
    };
    // The edges with more options past them, as the list scrolls.
    const scrolled = () => {
      const more = el.scrollHeight - el.clientHeight > 1;
      el.toggleAttribute("data-more-above", more && el.scrollTop > 1);
      el.toggleAttribute(
        "data-more-below",
        more && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      );
      return more;
    };
    const update = () => {
      columns();
      setOverflow(scrolled());
    };
    update();
    el.addEventListener("scroll", scrolled, { passive: true });
    if (typeof ResizeObserver === "undefined")
      return () => el.removeEventListener("scroll", scrolled);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const option of el.children) observer.observe(option);
    return () => {
      el.removeEventListener("scroll", scrolled);
      observer.disconnect();
    };
  }, []);
  return (
    <>
      <legend className="choice-legend">
        <span className="choice-legend-text">
          <MathText text={legend} />
        </span>
        <span
          className="choice-total"
          aria-hidden="true"
          data-shown={overflow ? "" : undefined}
        >
          {count} options
        </span>
      </legend>
      <div ref={list} className="choice-options">
        {children}
      </div>
    </>
  );
}
