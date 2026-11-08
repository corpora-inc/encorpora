import { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import { SUPPORT_EMAIL } from "./SupportHelp";
import styles from "./Contact.module.css";

/** The support address, shown whole so it can be read and selected, with a
 * button that copies it. Nothing opens a mail app. "Copied" takes the same
 * space as "Copy", so nothing moves. */
export function ContactAddress({ className = "" }: { className?: string }) {
  const address = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const reset = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(reset);
  }, [copied]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
    } catch (error) {
      // No clipboard here: select the address so the system copy works.
      console.warn("The address couldn’t be copied", error);
      if (address.current) getSelection()?.selectAllChildren(address.current);
    }
  }
  return (
    <span className={`${styles.contact} ${className}`}>
      <span ref={address} className={styles.address}>
        {SUPPORT_EMAIL}
      </span>
      <Button
        type="button"
        variant="secondary"
        className={styles.copy}
        onClick={() => void copy()}
        aria-label={`Copy ${SUPPORT_EMAIL}`}
      >
        <span data-hidden={copied || undefined}>Copy</span>
        <span data-hidden={!copied || undefined} aria-hidden="true">
          Copied
        </span>
      </Button>
      <span className={styles.srOnly} aria-live="polite">
        {copied ? "Address copied" : ""}
      </span>
    </span>
  );
}
