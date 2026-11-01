import { createPortal } from "react-dom";
import { useCallback } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import styles from "./Toast.module.css";
/** A fixed message over the content: it never moves the page. Errors stay
 * until dismissed; a confirmation (`tone="status"`) closes by itself. */
export function Toast({
  message,
  onDismiss,
  tone = "alert",
  title,
  placement,
  takeFocus = false,
  className = "",
}: {
  message: string;
  onDismiss: () => void;
  tone?: "alert" | "status";
  title?: string;
  placement?: "top" | "bottom";
  /** Failed forms can bring feedback into view and dismiss the phone keyboard. */
  takeFocus?: boolean;
  className?: string;
}) {
  const description = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && message && takeFocus) node.focus({ preventScroll: true });
    },
    [message, takeFocus],
  );
  if (!message) return null;
  return createPortal(
    <RadixToast.Provider swipeDirection="right">
      <RadixToast.Root
        open={!!message}
        onOpenChange={(open) => {
          if (!open) onDismiss();
        }}
        duration={tone === "status" ? 4000 : Infinity}
        type={tone === "status" ? "background" : "foreground"}
        className={`${styles.toast} ${title ? styles.titled : ""} ${className}`}
      >
        {/* Radix announces a toast politely; an error is also an alert. */}
        <div className={styles.content}>
          {title && (
            <RadixToast.Title className={styles.title}>
              {title}
            </RadixToast.Title>
          )}
          <RadixToast.Description
            ref={description}
            tabIndex={takeFocus ? -1 : undefined}
            role={tone === "alert" ? "alert" : undefined}
          >
            {message}
          </RadixToast.Description>
        </div>
        <RadixToast.Close aria-label="Dismiss message">×</RadixToast.Close>
      </RadixToast.Root>
      {/* A confirmation shows at the top, clear of the actions at the bottom. */}
      <RadixToast.Viewport
        className={`${styles.viewport} ${(placement ?? (tone === "status" ? "top" : "bottom")) === "top" ? styles.top : ""}`}
      />
    </RadixToast.Provider>,
    document.body,
  );
}
