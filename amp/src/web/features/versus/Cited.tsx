import { citedParts, sourceAnchor } from "../../../versus/citations";
import styles from "./Versus.module.css";

/** A comparison's prose with its citations: each `[3]` is the source's
 * number, raised, and a link to that source in the page's list. Two in a
 * row read "1,3", never "13". */
export function Cited({ text }: { text: string }) {
  return (
    <>
      {citedParts(text).map((part, index) =>
        "cite" in part ? (
          <sup key={index} className={styles.cite}>
            {part.after && <span aria-hidden="true">,</span>}
            <a
              href={`#${sourceAnchor(part.cite)}`}
              aria-label={`Source ${part.cite}`}
              data-cite={part.cite}
            >
              {part.cite}
            </a>
          </sup>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
