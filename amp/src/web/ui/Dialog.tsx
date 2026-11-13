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
  fullOnPhone = false,
  tall = false,
  back,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  aboveNavigation?: boolean;
  /** At 390 px and below the sheet fills the screen, with its own close. */
  fullOnPhone?: boolean;
  /** Content that arrives after it opens and is longer than the screen (a
   * lesson): the sheet is its full height from the start, so nothing moves
   * when it lands. */
  tall?: boolean;
  /** A layer under this one (nav/LayerHost): X returns to it, and says so
   * quietly in place of the cross ("‹ Adding fractions"). */
  back?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={`${styles.overlay} ${aboveNavigation ? styles.aboveNavigation : ""}`}
        />
        <RadixDialog.Content
          className={`${styles.content} ${aboveNavigation ? styles.aboveNavigation : ""} ${fullOnPhone ? styles.fullOnPhone : ""} ${tall ? styles.tall : ""}`}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>
              {title}
            </RadixDialog.Title>
            {back ? (
              <RadixDialog.Close
                className={`${styles.close} ${styles.back}`}
                aria-label={`Close, back to ${back}`}
                data-layer-back={back}
              >
                <span aria-hidden="true">‹</span>
                <span>{back}</span>
              </RadixDialog.Close>
            ) : (
              <RadixDialog.Close className={styles.close} aria-label="Close">
                ×
              </RadixDialog.Close>
            )}
          </header>
          <div className={styles.body}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
