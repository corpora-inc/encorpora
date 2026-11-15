import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import styles from "./Sheet.module.css";
import { CloseControl, LayerTopRow, useLayerBack } from "./LayerControls";

/**
 * A modal sheet for detail beside the work: from the side on a wide screen,
 * from the bottom on a phone. Focus enters the sheet, stays there, and returns
 * to what opened it; Escape and the scrim close it; the page never moves.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  lead,
  children,
  returnFocus,
  tall = false,
  back,
  onEscapeKeyDown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Beside the title: an avatar, a mark. */
  lead?: ReactNode;
  children: ReactNode;
  /** Where focus goes when what opened the sheet is gone (a shared link). */
  returnFocus?: () => HTMLElement | null;
  /** Content that arrives after the sheet opens: on a phone the sheet is its
   * full height from the start, so nothing moves when it lands. */
  tall?: boolean;
  /** A layer under this one (nav/LayerHost): a row over the title steps
   * back to it ("‹ Kai Varga"); the cross beside it closes every layer. */
  back?: string;
  /** Let an active control consume Escape before it closes the sheet. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const stepBack = useLayerBack();
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          ref={content}
          className={`${styles.sheet} ${tall ? styles.tall : ""}`}
          data-dense
          aria-describedby={undefined}
          onEscapeKeyDown={onEscapeKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            opener.current = document.activeElement as HTMLElement | null;
            content.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current?.isConnected ? opener.current : null;
            (target && target !== document.body
              ? target
              : returnFocus?.()
            )?.focus({ preventScroll: true });
          }}
        >
          {back && (
            <LayerTopRow
              back={back}
              onBack={stepBack ?? (() => onOpenChange(false))}
            />
          )}
          <div className={`${styles.header} ${back ? styles.under : ""}`}>
            {lead}
            <div className={styles.heading}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {description !== undefined && (
                <div className={styles.description}>{description}</div>
              )}
            </div>
            {!back && <CloseControl />}
          </div>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
