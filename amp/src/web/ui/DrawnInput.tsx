import type { InputHTMLAttributes, Ref } from "react";
import styles from "./DrawnInput.module.css";

/** A text field whose look is drawn by its parent (a class code's tiles,
 * features/school/join/CodeTiles.tsx): this is only the invisible keyboard
 * target laid over the drawing. The parent is a positioned `<label>` that
 * names it. */
export function DrawnInput({
  ref,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      className={`${styles.input} ${className}`}
    />
  );
}
