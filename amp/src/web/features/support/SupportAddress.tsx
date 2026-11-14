import { useRef, useState } from "react";
import { Button } from "../../ui/Button";
import styles from "./SupportHelp.module.css";

export const SUPPORT_EMAIL = "support@corpora.inc";

/** Copyable contact information for browsers without a configured mail app. */
export function SupportAddress() {
  const address = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState<"copied" | "manual" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setStatus("copied");
    } catch {
      setStatus("manual");
      if (address.current) {
        const range = document.createRange();
        range.selectNodeContents(address.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }
  return (
    <div className={styles.contact}>
      <div className={styles.addressRow}>
        <span ref={address} className={styles.address}>
          {SUPPORT_EMAIL}
        </span>
        <Button
          type="button"
          variant="quiet"
          aria-label="Copy support address"
          onClick={() => void copy()}
        >
          Copy
        </Button>
      </div>
      <p className={styles.copyStatus} role="status">
        {status === "copied"
          ? "Copied"
          : status === "manual"
            ? "Select the address to copy it."
            : ""}
      </p>
    </div>
  );
}
