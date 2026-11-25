import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { fitItems } from "./fit-words";
import box from "./FitText.module.css";
import styles from "./FitList.module.css";

type Fit = { key: string; count: number };

/**
 * A list of names in a box of one or two lines that never grows: the first
 * names that fit, each whole, then how many more there are ("+7 more").
 * Never part of a name, never a hover title. It is not a control: what it
 * sits in (a row that opens the whole list) is.
 *
 * When not even the first name fits beside the count, the count alone
 * shows, in the caller's words (`all`: "20 skills").
 *
 * The box measures itself before paint and whenever its width changes; a
 * document that lays nothing out (a test's) shows every name.
 */
export function FitList({
  items,
  lines = 1,
  more = (hidden) => `+${hidden} more`,
  all,
  className = "",
  ...rest
}: {
  items: readonly string[];
  lines?: 1 | 2;
  /** The names left out, in words. */
  more?: (hidden: number) => string;
  /** Every name left out: the whole count, in words. */
  all: (total: number) => string;
} & Omit<ComponentPropsWithoutRef<"span">, "children">) {
  const frame = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const probeNames = useRef<HTMLSpanElement>(null);
  const probeMore = useRef<HTMLSpanElement>(null);
  const total = items.length;
  const joined = items.join("\u0000");
  const key = `${lines}\u0000${joined}`;
  const [fit, setFit] = useState<Fit | null>(null);
  // Read by the measurement, which outlives the render that started it.
  const words = useRef({ more, all });
  words.current = { more, all };

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const names = joined ? joined.split("\u0000") : [];
    const measure = () => {
      const line = probe.current;
      const shown = probeNames.current;
      const rest = probeMore.current;
      if (!line || !shown || !rest) return;
      const width = element.clientWidth;
      const max = parseFloat(getComputedStyle(element).maxHeight);
      // Not laid out (a test's document): every name.
      if (!(width > 0) || !(max > 0)) return;
      const count = fitItems(names.length, (candidate) => {
        const hidden = names.length - candidate;
        shown.textContent = names.slice(0, candidate).join(", ");
        rest.textContent =
          hidden === 0
            ? ""
            : candidate === 0
              ? words.current.all(hidden)
              : words.current.more(hidden);
        return (
          line.getBoundingClientRect().height <= max + 0.5 &&
          line.scrollWidth <= width + 0.5
        );
      });
      // The probe keeps no words: nothing reads the names twice.
      shown.textContent = "";
      rest.textContent = "";
      setFit((held) =>
        held?.key === key && held.count === count ? held : { key, count },
      );
    };
    measure();
    let next = 0;
    // On the next frame: a fit that changes inside the observer's own
    // delivery is a page error ("ResizeObserver loop").
    const again = () => {
      cancelAnimationFrame(next);
      next = requestAnimationFrame(measure);
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    observer?.observe(element);
    let here = true;
    void document.fonts?.ready.then(() => {
      if (here) again();
    });
    return () => {
      here = false;
      cancelAnimationFrame(next);
      observer?.disconnect();
    };
  }, [key, joined]);

  const count = fit?.key === key ? fit.count : total;
  const hidden = total - count;
  return (
    <span
      className={`${box.root} ${className}`}
      data-fit-list=""
      data-fit-total={total}
      data-fit-shown={count}
      {...rest}
    >
      <span className={box.probeBox} aria-hidden="true">
        <span ref={probe} className={box.probe}>
          <span ref={probeNames} />{" "}
          <span ref={probeMore} className={styles.more} />
        </span>
      </span>
      <span
        ref={frame}
        className={box.box}
        style={{ ["--fit-lines" as string]: lines }}
      >
        {items.slice(0, count).map((item, index) => (
          <Fragment key={index}>
            {index > 0 && ", "}
            <span data-fit-item="">{item}</span>
          </Fragment>
        ))}
        {hidden > 0 && (
          <>
            {count > 0 && " "}
            <span className={styles.more} data-fit-more="">
              {count === 0 ? all(hidden) : more(hidden)}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
