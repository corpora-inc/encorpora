import type { ButtonHTMLAttributes } from "react";
import styles from "./Controls.module.css";
export type ButtonVariant = "primary" | "secondary" | "quiet";
/** Class names for a control that looks like a button (also used on links). */
export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${styles.button} ${styles[variant]} ${extra}`.trim();
}
export function Button({
  className = "",
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={
        variant
          ? buttonClass(variant, className)
          : `${styles.button} ${className}`
      }
    />
  );
}
