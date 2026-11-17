import styles from "./Honeypot.module.css";

/** A form's trap for form fillers: a field no person sees or reaches. A form
 * that finds it filled thanks the sender and sends nothing. */
export function Honeypot({
  value,
  onChange,
  name = "website",
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <input
      className={styles.trap}
      name={name}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
