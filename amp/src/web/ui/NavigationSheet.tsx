import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, Ref } from "react";
import styles from "./NavigationSheet.module.css";

export function WaveMark() {
  return (
    <svg viewBox="0 0 44 28" fill="none" aria-hidden="true">
      <path d="M1 14C5 0 9 0 13 14S21 28 25 14S33 0 37 14S41 28 43 14" />
    </svg>
  );
}

/** A modal navigation drawer with focus trapping, Escape and focus restoration. */
export function NavigationSheet({
  open,
  onOpenChange,
  children,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        ref={triggerRef}
        className={styles.trigger}
        aria-label="Open AMP menu"
        title="AMP menu"
        data-navigation-trigger
      >
        <WaveMark />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>
              <WaveMark />
              <span>
                Adaptive Math<strong>Pathways</strong>
              </span>
            </Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close AMP menu">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </Dialog.Close>
          </header>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
