import { useId, type SelectHTMLAttributes } from "react";
import styles from "./Controls.module.css";

/** The platform picker, including native keyboard search and mobile controls. */
export function NativeSelect({
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <select {...props} id={id} className={styles.input} />
    </label>
  );
}
