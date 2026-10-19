import type { ButtonHTMLAttributes } from "react";
import styles from "./Controls.module.css";
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${styles.button} ${className}`} />;
}
