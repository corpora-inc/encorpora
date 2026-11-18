import { SUPPORT_EMAIL } from "./support-email";
import styles from "./Contact.module.css";

/** The support address as a standard email link: the address itself is the
 * link's text, so it reads, selects and copies like any text, and a tap
 * opens the visitor's mail app. A full 44 px target. */
export function ContactAddress({ className = "" }: { className?: string }) {
  return (
    <a
      className={`${styles.address} ${className}`}
      href={`mailto:${SUPPORT_EMAIL}`}
    >
      {SUPPORT_EMAIL}
    </a>
  );
}
