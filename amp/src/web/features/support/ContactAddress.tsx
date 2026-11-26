import { SUPPORT_EMAIL } from "./support-email";
import styles from "./Contact.module.css";

/** A Corpora address (support, unless another is named) as a standard email link: the address itself is the
 * link's text, so it reads, selects and copies like any text, and a tap
 * opens the visitor's mail app. A full 44 px target. */
export function ContactAddress({
  className = "",
  address = SUPPORT_EMAIL,
}: {
  className?: string;
  address?: string;
}) {
  return (
    <a className={`${styles.address} ${className}`} href={`mailto:${address}`}>
      {address}
    </a>
  );
}
