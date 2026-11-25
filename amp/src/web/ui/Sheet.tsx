import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type ReactNode } from "react";
import styles from "./Sheet.module.css";
import {
  CloseControl,
  LayerPanelReset,
  useLayerEscape,
  useLayerPanel,
} from "./LayerControls";

/**
 * A modal sheet for detail beside the work: from the side on a wide screen,
 * from the bottom on a phone. Focus enters the sheet, stays there, and returns
 * to what opened it; the cross and Escape put it down (one layer, over
 * another), the scrim the whole stack; the page never moves.
 */
export function Sheet(props: SheetProps) {
  // A layer inside a layer host's one overlay (ui/LayerFrame.tsx): its
  // panel there, never a second overlay and scrim.
  const panel = useLayerPanel();
  if (panel)
    return props.open ? (
      <SheetPanel
        title={props.title}
        description={props.description}
        lead={props.lead}
        tall={props.tall}
      >
        {props.children}
      </SheetPanel>
    ) : null;
  return <ModalSheet {...props} />;
}

/** A layer's panel in the layer frame: its title, the frame's ✕, its body.
 * What it holds is outside the frame again (a confirmation it opens is its
 * own modal). */
export function SheetPanel({
  title,
  description,
  lead,
  bodyClass = styles.body,
  tall,
  children,
}: {
  title: string;
  description?: ReactNode;
  lead?: ReactNode;
  /** The body's own look, when the layer is a reading dialog's (a lesson). */
  bodyClass?: string;
  /** The sheet is its full height from the start (`Sheet`'s `tall`): the
   * frame it is drawn in takes that height while this panel shows. */
  tall?: boolean;
  children: ReactNode;
}) {
  const panel = useLayerPanel();
  // The heading holds still; a hairline under it once the body scrolls
  // beneath (its border is there from the start, only its colour changes).
  const [scrolled, setScrolled] = useState(false);
  return (
    <>
      <div
        className={styles.header}
        data-layer-header=""
        data-scrolled={scrolled || undefined}
        data-sheet-tall={tall || undefined}
      >
        {lead}
        <div className={styles.heading}>
          {panel?.trail}
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description !== undefined && (
            <div className={styles.description}>{description}</div>
          )}
        </div>
        <CloseControl />
      </div>
      <div
        className={bodyClass}
        onScroll={(event) => {
          const now = event.currentTarget.scrollTop > 0;
          if (now !== scrolled) setScrolled(now);
        }}
      >
        <LayerPanelReset>{children}</LayerPanelReset>
      </div>
    </>
  );
}

type SheetProps = Parameters<typeof ModalSheet>[0];

function ModalSheet({
  open,
  onOpenChange,
  title,
  description,
  lead,
  children,
  returnFocus,
  tall = false,
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
  /** The layer under this one (nav/LayerHost). The cross puts this sheet
   * down to it; it is not drawn twice (Q-8). */
  back?: string;
  /** Let an active control consume Escape before it closes the sheet. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const escape = useLayerEscape(onEscapeKeyDown);
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-sheet-scrim="" />
        <Dialog.Content
          ref={content}
          className={`${styles.sheet} ${tall ? styles.tall : ""}`}
          data-dense
          aria-describedby={undefined}
          onEscapeKeyDown={escape}
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
          <div className={styles.header}>
            {lead}
            <div className={styles.heading}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {description !== undefined && (
                <div className={styles.description}>{description}</div>
              )}
            </div>
            <CloseControl />
          </div>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
