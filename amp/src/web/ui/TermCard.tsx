import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { GlossaryCard, TermId } from "../../glossary/types";
import { MathText, spokenMath } from "../MathText";
import { SceneFigure } from "../scene/SceneFigure";
import {
  blockValue,
  GlossaryBlockContext,
  GlossaryContext,
  type GlossaryValue,
} from "./glossary-context";

/** A card wider than a phone sits beside its term; a phone gets a sheet. */
const ANCHORED = "(min-width: 768px)";
const GAP = 10;
const MARGIN = 16;
/** How far a sheet is dragged down before letting go closes it. */
const DISMISS_DRAG = 80;

type Motion = "open" | "forward" | "back";

/** A term's mini-lesson: its plain definition, an example and a small
 * figure. A native modal dialog, so it stacks in the top layer above any
 * open panel. Terms inside the definition drill down; Back returns. Escape,
 * Close, the scrim or a drag on the sheet's grab area close it, and focus
 * returns to the word that opened it. */
export function TermCard({
  cards,
  start,
  origin,
  close,
}: {
  cards: ReadonlyMap<TermId, GlossaryCard>;
  start: TermId;
  origin: HTMLElement;
  close: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [trail, setTrail] = useState<TermId[]>([start]);
  const [motion, setMotion] = useState<Motion>("open");
  // The term a learner drilled from, refocused when they come back.
  const returnTo = useRef<TermId | null>(null);
  const closing = useRef(false);
  const pressedScrim = useRef(false);
  const side = useRef<"below" | "above" | null>(null);
  const current = cards.get(trail.at(-1)!)!;
  const previous = trail.length > 1 ? cards.get(trail.at(-2)!) : undefined;

  const finish = () => {
    if (closing.current) return;
    closing.current = true;
    close();
  };

  useLayoutEffect(() => {
    const element = dialog.current!;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      if (origin.isConnected) origin.focus({ preventScroll: true });
    };
  }, [origin]);

  // Every step (open, drill, back) mounts a fresh panel: place it beside its
  // term before the first paint, then focus it.
  useLayoutEffect(() => {
    const place = () => {
      const card = panel.current;
      if (!card) return;
      if (!window.matchMedia?.(ANCHORED).matches) {
        card.style.removeProperty("left");
        card.style.removeProperty("top");
        return;
      }
      const term = origin.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = innerHeight;
      const { offsetWidth: w, offsetHeight: h } = card;
      const left = Math.min(
        Math.max(term.left + term.width / 2 - w / 2, MARGIN),
        Math.max(MARGIN, width - w - MARGIN),
      );
      // The first card picks a side of its word; later steps keep that side
      // so the card grows away from the word instead of jumping across it.
      side.current ??=
        term.bottom + GAP + h <= height - MARGIN || term.top - GAP - h < MARGIN
          ? "below"
          : "above";
      const top =
        side.current === "below"
          ? Math.max(MARGIN, Math.min(term.bottom + GAP, height - MARGIN - h))
          : Math.max(MARGIN, term.top - GAP - h);
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top)}px`;
    };
    place();
    const target =
      motion === "back" && returnTo.current
        ? [
            ...(panel.current?.querySelectorAll<HTMLElement>(
              "[data-term-id]",
            ) ?? []),
          ].find((el) => el.dataset.termId === returnTo.current)
        : undefined;
    (target ?? heading.current)?.focus({ preventScroll: true });
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [trail, origin, motion]);

  const inner = useMemo<GlossaryValue>(
    () => ({
      cards,
      lexicon: current.lexicon ?? {},
      open: (id) => {
        if (!cards.has(id)) return;
        returnTo.current = id;
        setMotion("forward");
        setTrail((t) => [...t, id]);
      },
    }),
    [cards, current],
  );
  const texts = useMemo(
    () => [current.plain, ...(current.example ? [current.example] : [])],
    [current],
  );
  const block = useMemo(() => blockValue(texts, inner), [texts, inner]);

  const back = () => {
    returnTo.current = trail.at(-1)!;
    setMotion("back");
    setTrail((t) => t.slice(0, -1));
  };

  // Dragging the grab area moves the sheet with a transform (never layout);
  // far enough closes it, otherwise it settles back.
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const grab = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { y: event.clientY, dy: 0 };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!drag.current || !panel.current) return;
      drag.current.dy = Math.max(0, event.clientY - drag.current.y);
      panel.current.style.transform = `translateY(${drag.current.dy}px)`;
    },
    onPointerUp: () => {
      const dy = drag.current?.dy ?? 0;
      drag.current = null;
      if (dy > DISMISS_DRAG) finish();
      else panel.current?.style.removeProperty("transform");
    },
    onPointerCancel: () => {
      drag.current = null;
      panel.current?.style.removeProperty("transform");
    },
  };

  return (
    <dialog
      ref={dialog}
      className="term-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape closes this card only, never a panel beneath it.
        event.preventDefault();
        event.stopPropagation();
        finish();
      }}
      onClose={(event) => {
        event.stopPropagation();
        finish();
      }}
      // The scrim closes the card only when a press starts and ends on it, so
      // selecting text and releasing outside the card never closes it.
      onPointerDown={(event) => {
        pressedScrim.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && pressedScrim.current)
          finish();
        pressedScrim.current = false;
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        key={trail.join("\u0000")}
        ref={panel}
        className="term-card"
        data-motion={motion}
      >
        <div className="term-card-grab" aria-hidden="true" {...grab}>
          <span />
        </div>
        <div className="term-card-header">
          {previous ? (
            <button
              type="button"
              className="term-card-back"
              onClick={back}
              aria-label={`Back to ${spokenMath(previous.term)}`}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </button>
          ) : null}
          <div className="term-card-titles">
            {trail.length > 1 && (
              <p className="term-card-trail">
                {trail.slice(0, -1).map((id) => (
                  <span key={id}>
                    <MathText text={cards.get(id)!.term} />
                    <span aria-hidden="true"> › </span>
                  </span>
                ))}
              </p>
            )}
            <h2 id={titleId} ref={heading} tabIndex={-1}>
              <MathText text={current.term} />
            </h2>
          </div>
          <button
            type="button"
            className="term-card-close"
            onClick={finish}
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5l9 9m0-9-9 9" />
            </svg>
          </button>
        </div>
        <div className="term-card-body">
          <GlossaryContext.Provider value={inner}>
            <GlossaryBlockContext.Provider value={block}>
              <p className="term-card-plain">
                <MathText text={current.plain} />
              </p>
              {current.example && (
                <p className="term-card-example">
                  <span className="term-card-label">Example</span>
                  <MathText text={current.example} />
                </p>
              )}
            </GlossaryBlockContext.Provider>
          </GlossaryContext.Provider>
          {current.figure && (
            <div className="term-card-figure">
              <SceneFigure scene={current.figure} maxHeight={170} />
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
