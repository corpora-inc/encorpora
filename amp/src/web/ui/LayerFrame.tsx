import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import sheet from "./Sheet.module.css";
import styles from "./LayerFrame.module.css";
import { LayerPanelProvider, type LayerPanelFrame } from "./LayerControls";

/** A step of the trail: a layer under the top one, or the top itself. */
export type Crumb = { key: string; title: ReactNode };

/**
 * The one overlay a layer host draws over its page (nav/LayerHost.tsx): ONE
 * scrim and ONE sheet, however deep the layers go. The top layer is the
 * sheet's panel; going deeper slides the next panel in, going up slides the
 * one below back, and the trail at the top names the way down (Linear
 * systems › Systems modeling › Geometric design), each step a way back up.
 *
 * - ✕ and the scrim put the whole overlay away, back to the page.
 * - Escape goes up one level, or closes at the first.
 * - Only a person's own open or close moves anything (`moving`): a stack
 *   restored (Back from practice, a refresh, a remount for another identity)
 *   is drawn settled, in its place, at once.
 */
export function LayerFrame({
  crumbs,
  onCrumb,
  onClose,
  onStepBack,
  moving,
  wide = false,
  above = false,
  children,
}: {
  /** Every layer in the frame, oldest first: the last is the panel shown. */
  crumbs: Crumb[];
  /** Back up to the layer at this depth (1 is the first). */
  onCrumb: (depth: number) => void;
  onClose: () => void;
  onStepBack: () => void;
  /** Whether a person just opened (1) or closed (-1) a layer, else 0. Read
   * once, when the frame or a panel is drawn. */
  moving: () => 1 | -1 | 0;
  /** A reading panel with figures (a lesson): wider on a desktop. */
  wide?: boolean;
  /** Over a full-screen layer (an answer's replay). */
  above?: boolean;
  children: ReactNode;
}) {
  const [enter] = useState(() => moving() === 1);
  // A panel drawn with the frame never slides: the frame itself came in.
  // (Its portal draws a moment after the frame, so the first panel marks
  // this, not the frame.)
  const shown = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  // The trail shows its end, where the reader is; earlier steps scroll in.
  const trail = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const at = trail.current;
    if (at) at.scrollLeft = at.scrollWidth;
  }, [crumbs.length]);
  const opener = useRef<HTMLElement | null>(null);
  const top = crumbs.at(-1)!;
  const frame: LayerPanelFrame = { close: onClose };
  const still = enter ? "" : styles.still;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={`${sheet.overlay} ${still} ${above ? styles.above : ""}`}
          data-layer-scrim=""
        />
        <Dialog.Content
          ref={content}
          className={`${sheet.sheet} ${sheet.tall} ${styles.frame} ${wide ? styles.wide : ""} ${still} ${above ? styles.above : ""}`}
          data-dense
          data-layer-frame=""
          data-depth={crumbs.length}
          data-motion={enter ? "enter" : "none"}
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onStepBack();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            opener.current = document.activeElement as HTMLElement | null;
            content.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current;
            if (target?.isConnected && target !== document.body)
              target.focus({ preventScroll: true });
          }}
        >
          {crumbs.length > 1 && (
            <nav
              ref={trail}
              className={styles.trail}
              aria-label="Path"
              data-layer-trail=""
            >
              <ol>
                {crumbs.map((crumb, index) => (
                  <li key={crumb.key}>
                    {index < crumbs.length - 1 ? (
                      <button
                        type="button"
                        data-layer-crumb={index + 1}
                        onClick={() => onCrumb(index + 1)}
                      >
                        {crumb.title}
                      </button>
                    ) : (
                      <span aria-current="location" data-layer-crumb="">
                        {crumb.title}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <LayerPanelProvider value={frame}>
            <Panel
              key={top.key}
              slide={() => (shown.current ? moving() : 0)}
              shown={shown}
              frame={content}
            >
              {children}
            </Panel>
          </LayerPanelProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The top layer's panel: it slides in only when a person went a level
 * deeper (from the right) or up (from the left). */
function Panel({
  slide,
  shown,
  frame,
  children,
}: {
  slide: () => 1 | -1 | 0;
  /** Whether the frame has drawn a panel before this one. */
  shown: RefObject<boolean>;
  frame: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [direction] = useState(slide);
  useEffect(() => {
    shown.current = true;
  }, [shown]);
  // A new level takes focus in the frame, as the frame took it on opening:
  // the link that opened it is gone with the panel it was in.
  useLayoutEffect(() => {
    if (direction) frame.current?.focus({ preventScroll: true });
  }, [direction, frame]);
  return (
    <div
      className={styles.panel}
      data-layer-panel=""
      data-motion={direction > 0 ? "in" : direction < 0 ? "out" : "none"}
    >
      {children}
    </div>
  );
}
