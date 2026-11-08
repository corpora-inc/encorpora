import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, Ref } from "react";
import { WaveMark } from "./WaveMark";
import styles from "./NavigationSheet.module.css";

export { WaveMark };

/**
 * A modal navigation drawer from the left, with focus trapping, Escape and
 * focus restoration.
 *
 * With `header`, the app frame draws its own trigger (the logo in its bar)
 * and the drawer opens with that same logo in the same spot, as its close
 * control: the sheet's header has the bar's exact geometry. Without it, the
 * drawer brings its own wave-mark trigger (frames outside the app frame).
 */
export function NavigationSheet({
  open,
  onOpenChange,
  children,
  triggerRef,
  header,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
  /** The bar's own header: the logo as the close control. */
  header?: ReactNode;
  /** Pinned to the foot of the sheet, outside the scrolling body. */
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {!header && (
        <Dialog.Trigger
          ref={triggerRef}
          className={styles.trigger}
          aria-label="Open AMP menu"
          title="AMP menu"
          data-navigation-trigger
        >
          <WaveMark />
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${styles.sheet} ${header ? styles.framed : ""}`}
          aria-describedby={undefined}
          data-navigation-sheet
        >
          {header ? (
            <>
              <Dialog.Title className={styles.srOnly}>
                Adaptive Math Pathways
              </Dialog.Title>
              {header}
            </>
          ) : (
            <header className={styles.header}>
              <Dialog.Title className={styles.title}>
                <WaveMark />
                <span>
                  Adaptive Math<strong>Pathways</strong>
                </span>
              </Dialog.Title>
              <Dialog.Close
                className={styles.close}
                aria-label="Close AMP menu"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </Dialog.Close>
            </header>
          )}
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The close control for a framed sheet: wraps the bar's logo button. */
export const SheetClose = Dialog.Close;
