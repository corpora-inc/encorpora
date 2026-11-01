import { useContext, useId, useMemo } from "react";
import type { TermId } from "../../glossary/types";
import { MathText, spokenMath } from "../MathText";
import { GlossaryContext, termIdsIn } from "./glossary-context";

/** The lesson's words, in the order the lesson first uses them, each opening
 * its card. `named` adds the method's own terms that the text never says. */
export function KeyWords({
  texts,
  named = [],
}: {
  texts: readonly string[];
  named?: readonly string[];
}) {
  const glossary = useContext(GlossaryContext);
  const headingId = useId();
  const ids = useMemo(() => {
    if (!glossary) return [];
    const out: TermId[] = [];
    const add = (id: TermId) => {
      if (!out.includes(id)) out.push(id);
    };
    for (const text of texts) termIdsIn(text, glossary).forEach(add);
    for (const term of named)
      for (const card of glossary.cards.values())
        if (card.term === term) add(card.id);
    return out;
  }, [glossary, texts, named]);
  if (!glossary || !ids.length) return null;
  return (
    <section className="key-words" aria-labelledby={headingId}>
      <h3 id={headingId}>Key words</h3>
      <ul>
        {ids.map((id) => {
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
      </ul>
    </section>
  );
}
