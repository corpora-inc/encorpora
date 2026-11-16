import { useId, type ComponentProps } from "react";
import { Select } from "./Select";
import styles from "./Controls.module.css";

/** A visible field label for the shared accessible picker. */
export function SelectField({
  label,
  id,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId}>{label}</label>
      <Select {...props} id={fieldId} aria-label={label} />
    </div>
  );
}
