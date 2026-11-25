import { useId, useLayoutEffect, useRef, useState } from "react";
import { fitWords, leadingWords } from "./fit-words";
import { usePopover } from "./popover-owner";
import styles from "./FitText.module.css";

type Fit = { key: string; count: number };

/**
 * A name in a box of one or two lines that never grows: every whole word
 * that fits, and when some don't, an ellipsis after the last whole word and
 * the rest a tap away (the text becomes a button that shows all of it over
 * the page, moving nothing). Never cut inside a word (unless the first
 * word alone is wider than the box), and never a hover title, which a
 * tablet can't open.
 *
 * `after` are short facts that follow the words on the same line ("Gr 3",
 * "45s"), each behind a middle dot. The first `reserve` of them always
 * show: the words give them room. The others show when the words leave
 * room and drop whole when they don't.
 *
 * The box measures itself before paint and whenever its width changes; a
 * document that lays nothing out (a test's) shows the whole text.
 */
export function FitText({
  text,
  lines = 1,
  after = [],
  reserve = 0,
  label,
  className = "",
}: {
  text: string;
  lines?: 1 | 2;
  after?: readonly string[];
  reserve?: number;
  /** Names what opens, for assistive technology: "Skill". */
  label: string;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const probeWords = useRef<HTMLSpanElement>(null);
  const probeFacts = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const reserved = after.slice(0, reserve).join("\u0000");
  const key = `${lines}\u0000${text}\u0000${reserved}`;
  const total = text.split(" ").length;
  const [fit, setFit] = useState<Fit | null>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const words = probeWords.current;
      const facts = probeFacts.current;
      const line = probe.current;
      if (!words || !facts || !line) return;
      const width = element.clientWidth;
      const max = parseFloat(getComputedStyle(element).maxHeight);
      // Not laid out (a test's document): the whole text.
      if (!(width > 0) || !(max > 0)) return;
      // The facts that must show take their room in the measured line.
      facts.replaceChildren(
        ...(reserved ? reserved.split("\u0000") : []).map((fact) => {
          const element = document.createElement("span");
          element.className = styles.fact ?? "";
          element.textContent = fact;
          return element;
        }),
      );
      const count = fitWords(text, (candidate) => {
        words.textContent = candidate;
        return (
          line.getBoundingClientRect().height <= max + 0.5 &&
          line.scrollWidth <= width + 0.5
        );
      });
      // The probe keeps no words: nothing reads the name twice.
      words.textContent = "";
      facts.replaceChildren();
      setFit((held) =>
        held?.key === key && held.count === count ? held : { key, count },
      );
    };
    measure();
    let frame = 0;
    // On the next frame: a fit that changes inside the observer's own
    // delivery is a page error ("ResizeObserver loop").
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    observer?.observe(element);
    // A web font that arrives later changes every width.
    let here = true;
    void document.fonts?.ready.then(() => {
      if (here) again();
    });
    return () => {
      here = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [key, text, reserved]);

  const count = fit?.key === key ? fit.count : total;
  const cut = count < total;
  const shown = cut && open;
  usePopover(shown, {
    contains: (node) => !!root.current?.contains(node),
    anchor: () => root.current,
    close: () => setOpen(false),
  });
  // Placed before paint, under the words or over them, wherever it fits.
  useLayoutEffect(() => {
    const element = panel.current;
    const button = trigger.current;
    if (!shown || !element || !button) return setPlace(null);
    const gap = 6;
    const edge = 8;
    const from = button.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const x = Math.max(edge, Math.min(from.left, innerWidth - edge - width));
    const below = from.bottom + gap;
    const above = from.top - gap - height;
    setPlace({
      x,
      y:
        below + height <= innerHeight - edge
          ? below
          : above >= edge
            ? above
            : Math.max(edge, innerHeight - edge - height),
    });
  }, [shown]);

  return (
    <span
      ref={root}
      className={`${styles.root} ${className}`}
      data-fit-text={text}
      data-fit-words={count}
      data-cut={cut || undefined}
    >
      <span className={styles.probeBox} aria-hidden="true">
        <span ref={probe} className={styles.probe}>
          <span ref={probeWords} />
          <span ref={probeFacts} />
        </span>
      </span>
      <span
        ref={box}
        className={styles.box}
        style={{ ["--fit-lines" as string]: lines }}
      >
        {cut ? (
          <button
            ref={trigger}
            type="button"
            // Not even the first word fits with its ellipsis: it shows as
            // far as it goes, the one cut inside a word there is no way
            // round. The button's own clip ends it, on an ellipsis.
            className={`${styles.more} ${count === 0 ? styles.clipped : ""}`}
            aria-label={text}
            aria-expanded={shown}
            aria-controls={shown ? id : undefined}
            onClick={(event) => {
              // Inside a row that opens something else: only this opens.
              event.stopPropagation();
              setOpen((was) => !was);
            }}
          >
            {leadingWords(text, Math.max(1, count))}
          </button>
        ) : (
          <span>{text}</span>
        )}
        {after.map((fact, index) => (
          <span key={index} className={styles.fact}>
            {/* A new word is a new node, never one sliding over. */}
            <span key={fact}>{fact}</span>
          </span>
        ))}
      </span>
      {shown && (
        <span
          ref={panel}
          id={id}
          role="note"
          aria-label={label}
          className={styles.panel}
          data-fit-open=""
          style={{
            left: place?.x ?? 0,
            top: place?.y ?? 0,
            visibility: place ? undefined : "hidden",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
