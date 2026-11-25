import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Key.module.css";

export type KeyItem = {
  id: string;
  /** The mark as the screen draws it: a swatch, a small drawing. It is
   * decorative here; its word says it. */
  mark: ReactNode;
  term: string;
  /** What the term means, where the word alone doesn't say. */
  meaning?: string;
};

/**
 * The key to a screen's marks, always on screen beside them (never a
 * tooltip or a paragraph): each mark, its name and, where it needs one,
 * what it means. A list in one wrapping line; `stack` puts one to a line on
 * a phone, for keys whose meanings are long.
 */
export function Key({
  items,
  label = "Key",
  stack = false,
  dense = false,
  lead,
  className = "",
  ...rest
}: {
  items: readonly KeyItem[];
  /** Names the key for assistive technology. */
  label?: string;
  stack?: boolean;
  /** Words alone, no meanings: the marks sit closer together. */
  dense?: boolean;
  /** An item of the screen's own before the others (a mark with no
   * meaning beside it). */
  lead?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"ul">, "children">) {
  return (
    <ul
      className={`${styles.key} ${className}`}
      aria-label={label}
      data-key=""
      data-stack={stack || undefined}
      data-dense={dense || undefined}
      {...rest}
    >
      {lead}
      {items.map((item) => (
        <li key={item.id}>
          <span className={styles.mark} aria-hidden="true">
            {item.mark}
          </span>
          <span className={styles.term}>{item.term}</span>
          {item.meaning && (
            <span className={styles.meaning}>{item.meaning}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A key's own classes, for an item the screen draws itself (`lead`). */
export const keyStyles = { term: styles.term, meaning: styles.meaning };
