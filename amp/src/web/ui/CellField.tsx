import type { InputHTMLAttributes } from "react";
import styles from "./CellField.module.css";

/** A short text field inside a table cell (a final grade): the field style
 * at a row's height, named by its `aria-label`, since a cell has no room for
 * a label or a message line (TextField is the field everywhere else). */
export function CellField({
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  "aria-label": string;
}) {
  return (
    <input {...rest} type="text" className={`${styles.field} ${className}`} />
  );
}
