import * as RadixToast from "@radix-ui/react-toast";
import styles from "./Toast.module.css";
export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <RadixToast.Provider swipeDirection="right">
      <RadixToast.Root
        role="alert"
        open={!!message}
        onOpenChange={(open) => {
          if (!open) onDismiss();
        }}
        duration={Infinity}
        className={styles.toast}
      >
        <RadixToast.Description>{message}</RadixToast.Description>
        <RadixToast.Close aria-label="Dismiss message">×</RadixToast.Close>
      </RadixToast.Root>
      <RadixToast.Viewport className={styles.viewport} />
    </RadixToast.Provider>
  );
}
