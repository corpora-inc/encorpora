import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import styles from "./Dialog.module.css";
/** A modal reading sheet: fixed overlay, scrollable body, never moves the page. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  onCloseAutoFocus,
  aboveNavigation = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  aboveNavigation?: boolean;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={`${styles.overlay} ${aboveNavigation ? styles.aboveNavigation : ""}`}
        />
        <RadixDialog.Content
          className={`${styles.content} ${aboveNavigation ? styles.aboveNavigation : ""}`}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close className={styles.close} aria-label="Close">
              ×
            </RadixDialog.Close>
          </header>
          <div className={styles.body}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
