import { createPortal } from "react-dom";
import * as RadixToast from "@radix-ui/react-toast";
import styles from "./Toast.module.css";
/** A fixed message over the content: it never moves the page. Errors stay
 * until dismissed; a confirmation (`tone="status"`) closes by itself. */
export function Toast({
  message,
  onDismiss,
  tone = "alert",
}: {
  message: string;
  onDismiss: () => void;
  tone?: "alert" | "status";
}) {
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
        className={styles.toast}
      >
        {/* Radix announces a toast politely; an error is also an alert. */}
        <RadixToast.Description role={tone === "alert" ? "alert" : undefined}>
          {message}
        </RadixToast.Description>
        <RadixToast.Close aria-label="Dismiss message">×</RadixToast.Close>
      </RadixToast.Root>
      {/* A confirmation shows at the top, clear of the actions at the bottom. */}
      <RadixToast.Viewport
        className={`${styles.viewport} ${tone === "status" ? styles.top : ""}`}
      />
    </RadixToast.Provider>,
    document.body,
  );
}
