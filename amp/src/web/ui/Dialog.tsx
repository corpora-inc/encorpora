import * as RadixDialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";
import { CloseControl, useLayerEscape } from "./LayerControls";
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
  wide = false,
  initialFocus,
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
  /** A reading sheet with figures (a lesson): wider on a desktop, its prose
   * still at a reading measure. */
  wide?: boolean;
  /** The layer under this one (nav/LayerHost). The cross puts this sheet
   * down to it; it is not drawn twice (Q-8). */
  back?: string;
  /** A selector inside the sheet to focus, and bring into view, on open (a
   * picker's chosen tile) in place of the first control. */
  initialFocus?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const escape = useLayerEscape();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={`${styles.overlay} ${aboveNavigation ? styles.aboveNavigation : ""}`}
        />
        <RadixDialog.Content
          className={`${styles.content} ${aboveNavigation ? styles.aboveNavigation : ""} ${fullOnPhone ? styles.fullOnPhone : ""} ${tall ? styles.tall : ""} ${wide ? styles.wide : ""}`}
          aria-describedby={undefined}
          onEscapeKeyDown={escape}
          // Focus goes back to what opened it, as a sheet's does, also when
          // it closes by its address (a layer popped by Back).
          ref={content}
          onOpenAutoFocus={(event) => {
            opener.current = document.activeElement as HTMLElement | null;
            const target = initialFocus
              ? content.current?.querySelector<HTMLElement>(initialFocus)
              : null;
            if (!target) return;
            event.preventDefault();
            target.focus();
            target.scrollIntoView({ block: "nearest" });
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            const target = opener.current;
            if (target?.isConnected && target !== document.body)
              target.focus({ preventScroll: true });
          }}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>
              {title}
            </RadixDialog.Title>
            <CloseControl />
          </header>
          <div className={styles.body}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
