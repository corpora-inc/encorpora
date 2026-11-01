import { useContext, useId, useLayoutEffect, useRef, useState } from "react";
import type { TermId } from "../../glossary/types";
import { MathText, spokenMath } from "../MathText";
import { GlossaryContext } from "./glossary-context";

/** At most this many key words show; the rest are one tap away. */
const CAP = 6;
/** The strip never takes more than two rows. */
const ROWS = 2;

/** The lesson's key words (most important first, from the server), each
 * opening its card. At most six show, in at most two rows; "+N more" opens
 * the full list as a card, so the page never moves. */
export function KeyWords({ ids }: { ids: readonly TermId[] }) {
  const glossary = useContext(GlossaryContext);
  const headingId = useId();
  const list = useRef<HTMLUListElement>(null);
  const words = glossary ? ids.filter((id) => glossary.cards.has(id)) : [];
  const [shown, setShown] = useState(Math.min(CAP, words.length));
  const [width, setWidth] = useState(0);

  // Fit before the first paint: drop words from the end until the strip,
  // with its "+N more" chip, fits in two rows.
  useLayoutEffect(() => {
    const items = [...(list.current?.children ?? [])] as HTMLElement[];
    const rows = new Set(items.map((item) => item.offsetTop)).size;
    if (rows > ROWS && shown > 1) setShown(shown - 1);
  }, [shown, width, words.length]);
  // A new width starts again from the cap.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let last = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === last) return;
      last = element.clientWidth;
      setShown(Math.min(CAP, words.length));
      setWidth(last);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [words.length]);

  if (!glossary || !words.length) return null;
  const more = words.length - shown;
  return (
    <section className="key-words" aria-labelledby={headingId}>
      <h3 id={headingId}>Key words</h3>
      <ul ref={list}>
        {words.slice(0, shown).map((id) => {
          const term = glossary.cards.get(id)!.term;
          return (
            <li key={id}>
              <button
                type="button"
                className="key-word"
                data-term-id={id}
                aria-haspopup="dialog"
                aria-label={`${spokenMath(term)}, what does this mean?`}
                onClick={(event) => glossary.open(id, event.currentTarget)}
              >
                <MathText text={term} />
                <span className="glossary-term-mark" aria-hidden="true">
                  ?
                </span>
              </button>
            </li>
          );
        })}
        {more > 0 && (
          <li>
            <button
              type="button"
              className="key-word key-word-more"
              aria-haspopup="dialog"
              aria-label={`${more} more key words`}
              onClick={(event) => glossary.openList(words, event.currentTarget)}
            >
              +{more} more
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
