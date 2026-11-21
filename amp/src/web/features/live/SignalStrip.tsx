import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { LiveSignal } from "../../../schools/live/contracts";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { agoText, agoWords } from "./format";
import { observeWidth } from "./layout";
import { SIGNAL_WORDS, SignalGlyph } from "./SignalGlyph";
import styles from "./SignalStrip.module.css";

/** A request's width in the strip, and the room the label and the "+N"
 * button take. */
const CHIP = 264;
const GAP = 8;
const MORE = 64;
const LABEL = 120;
/** Below this width the label gives its room to the requests. */
const ROOMY = 560;

/**
 * How many requests show side by side, and how wide each is, in `width`
 * px: as many whole requests as fit, oldest first, and a "+N" button for
 * the rest. A phone shows one, as wide as the strip allows.
 */
export function stripFit(width: number, count: number) {
  const room = width - (width >= ROOMY ? LABEL : 0);
  const fits = (n: number) => n * CHIP + (n - 1) * GAP;
  if (count === 0) return { shown: 0, chip: CHIP };
  if (fits(count) <= room) return { shown: count, chip: CHIP };
  const shown = Math.max(1, Math.floor((room - MORE) / (CHIP + GAP)));
  const chip =
    shown === 1 ? Math.min(CHIP, Math.max(0, room - MORE - GAP)) : CHIP;
  return { shown: Math.min(shown, count), chip };
}

export type SignalActions = {
  /** A raised hand: the adult is coming. Absent: this adult can't answer
   * one, and a hand shows without its button. */
  onAcknowledge?: (signal: LiveSignal) => void;
  /** A forgotten picture: new pictures at the next sign-in. Absent: this
   * adult can't reset pictures (an aide), and the request shows without its
   * button, for the class's teacher. */
  onResetPictures?: (signal: LiveSignal) => void;
  /** Requests whose action is on its way (its button shows the wave). */
  pending?: ReadonlySet<string>;
};

function Request({
  signal,
  now,
  actions,
  width,
  inSheet = false,
}: {
  signal: LiveSignal;
  now: number;
  actions: SignalActions;
  width?: number;
  inSheet?: boolean;
}) {
  const words = SIGNAL_WORDS[signal.kind];
  const busy = actions.pending?.has(signal.id) ?? false;
  const act =
    signal.kind === "hand" ? actions.onAcknowledge : actions.onResetPictures;
  return (
    <li
      className={inSheet ? styles.sheetRow : styles.request}
      style={width ? ({ width } as CSSProperties) : undefined}
      data-signal={signal.id}
    >
      <SignalGlyph kind={signal.kind} />
      <span className={styles.who}>
        <span className={styles.name}>{signal.name}</span>
        <span className={styles.what}>
          {inSheet ? `${words.what} · ` : ""}
          <span aria-label={agoWords(signal.createdAt, now)}>
            {agoText(signal.createdAt, now)}
          </span>
        </span>
      </span>
      {act && (
        <Button
          variant="secondary"
          className={styles.action}
          aria-busy={busy || undefined}
          disabled={busy}
          aria-label={`${inSheet ? words.action : words.short}: ${signal.name}, ${words.what.toLowerCase()}`}
          onClick={() => act(signal)}
        >
          <span>{inSheet ? words.action : words.short}</span>
        </Button>
      )}
    </li>
  );
}

/**
 * The "Needs you" strip: open requests (a raised hand, a forgotten
 * picture), each with the student's name, how long ago, and its one-tap
 * action. It is always there at the same height while a session runs, so
 * nothing under it ever moves; with nothing open it says so quietly.
 *
 * Many requests don't scroll sideways, where a mouse can't reach them and
 * a teacher can't see how many wait: as many as fit show, oldest first,
 * and a "+N" button opens all of them in a sheet. The count is always in
 * view.
 */
export function SignalStrip({
  signals,
  now,
  label = "Needs you",
  ...actions
}: {
  /** Open requests, any order (shown oldest first). */
  signals: readonly LiveSignal[];
  now: number;
  label?: string;
} & SignalActions) {
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1120 : window.innerWidth - 32,
  );
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    };
    measure();
    return observeWidth(element, measure);
  }, []);
  const [open, setOpen] = useState(false);
  const ordered = [...signals].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const { shown, chip } = stripFit(width, ordered.length);
  const rest = ordered.length - shown;
  const roomy = width >= ROOMY;
  const count = ordered.length;
  return (
    <section
      ref={root}
      className={styles.strip}
      aria-label={label}
      data-live-strip=""
      data-roomy={roomy || undefined}
      data-empty={count === 0 || undefined}
    >
      <h2 className={styles.label}>
        {label}
        <span className={styles.count} aria-hidden={count === 0 || undefined}>
          {count > 0 ? count : ""}
        </span>
      </h2>
      <p className={styles.srOnly} aria-live="polite">
        {count === 0
          ? "No requests"
          : `${count} ${count === 1 ? "request" : "requests"}`}
      </p>
      {count === 0 ? (
        <p className={styles.quiet}>No requests</p>
      ) : (
        <ul className={styles.requests}>
          {ordered.slice(0, shown).map((signal) => (
            <Request
              key={signal.id}
              signal={signal}
              now={now}
              actions={actions}
              width={chip}
            />
          ))}
        </ul>
      )}
      {rest > 0 && (
        <Button
          variant="secondary"
          className={styles.more}
          aria-label={`${rest} more ${rest === 1 ? "request" : "requests"}: show all`}
          onClick={() => setOpen(true)}
        >
          +{rest}
        </Button>
      )}
      <Sheet
        open={open && count > 0}
        onOpenChange={setOpen}
        title={label}
        description={`${count} ${count === 1 ? "request" : "requests"}, oldest first`}
      >
        <ul className={styles.sheetList}>
          {ordered.map((signal) => (
            <Request
              key={signal.id}
              signal={signal}
              now={now}
              actions={actions}
              inSheet
            />
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
