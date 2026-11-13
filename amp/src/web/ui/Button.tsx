import type { ButtonHTMLAttributes } from "react";
import styles from "./Controls.module.css";
export type ButtonVariant = "primary" | "secondary" | "quiet";
/**
 * `start` (quiet buttons only) lines a quiet action's label up with the column it sits in: the
 * button keeps its inline padding, so its hover fill never touches the
 * words, and a matching negative margin moves the fill out into the gutter.
 */
export type ButtonAlign = "center" | "start";
/** Class names for a control that looks like a button (also used on links). */
export function buttonClass(
  variant: ButtonVariant = "primary",
  extra = "",
  align: ButtonAlign = "center",
) {
  return `${styles.button} ${styles[variant]} ${align === "start" ? styles.alignStart : ""} ${extra}`
    .replace(/\s+/g, " ")
    .trim();
}
/** Every button says what it is: the one primary action, a secondary one,
 * or a quiet one. There is no unstyled button. */
export function Button({
  className = "",
  variant,
  align = "center",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ButtonVariant;
  align?: ButtonAlign;
}) {
  return (
    <button {...props} className={buttonClass(variant, className, align)} />
  );
}
