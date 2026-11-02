import { useContext } from "react";
import type { TermId } from "../../glossary/types";
import { GlossaryContext } from "./glossary-context";

/** A glossary word in running text. The word itself is the control: it reads
 * as text with a dotted underline and a small raised "?", and opens the
 * term's card. Its 44 px hit area is a pseudo-element, so line height and
 * layout are exactly those of plain text (glossary.css). */
export function Term({ id, text }: { id: TermId; text: string }) {
  const glossary = useContext(GlossaryContext);
  if (!glossary) return <>{text}</>;
  return (
    <button
      type="button"
      className="glossary-term"
      data-term-id={id}
      aria-haspopup="dialog"
      aria-label={`${text}, what does this mean?`}
      onClick={(event) => {
        event.stopPropagation();
        glossary.open(id, event.currentTarget);
      }}
    >
      {text}
      <span className="glossary-term-mark" aria-hidden="true">
        ?
      </span>
    </button>
  );
}
