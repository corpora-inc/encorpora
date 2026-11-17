import * as Dialog from "@radix-ui/react-dialog";
import {
  Outlet,
  useChildMatches,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { closeTo } from "../lib/return-to";
import { LayerPanelProvider } from "../ui/LayerControls";
import sheet from "../ui/Sheet.module.css";
import styles from "./RouteSheet.module.css";

/**
 * The one sheet a screen's overlay routes draw in (a settings hub's Billing,
 * Privacy, Sign-in and Pay; the Pay overlay over Today or a child's page).
 * Rendered by the screen's host route in place of its `<Outlet/>`, so it
 * belongs to the screen behind, not to whichever overlay is open: going from
 * one overlay to another over the same screen (Billing's "Continue with AMP"
 * to Pay) keeps the very same scrim and sheet, and only the panel inside
 * changes, with a short cross-fade. Each overlay's own `Sheet` draws its
 * panel here (ui/Sheet.tsx, `useLayerPanel`), never a second scrim.
 *
 * ✕, Escape and the scrim close it to exactly the screen behind (Back when
 * the overlay was opened in the app, else a replace): the host's own
 * address, which is also what every overlay's own close leads to.
 */
export function RouteSheetOutlet() {
  const host = useMatch({
    strict: false,
    select: (match) => match.pathname.replace(/(.)\/+$/, "$1"),
  });
  // The open overlay: the host's child route, unless it is the index (the
  // screen alone), which draws nothing.
  const overlay = useChildMatches({
    select: (matches) => {
      const child = matches[0];
      return child && !child.routeId.endsWith("/") ? child.pathname : null;
    },
  });
  return overlay ? (
    <RouteSheetFrame host={host} panel={overlay}>
      <Outlet />
    </RouteSheetFrame>
  ) : (
    <Outlet />
  );
}

function RouteSheetFrame({
  host,
  panel,
  children,
}: {
  /** The screen behind, where closing goes. */
  host: string;
  /** The overlay shown: a new one cross-fades in, in the same sheet. */
  panel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = () => closeTo(router, host, host);
  // Whether the sheet has shown a panel yet: the first comes in with it.
  const shown = useRef(false);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={sheet.overlay} data-route-scrim="" />
        <Dialog.Content
          ref={content}
          className={`${sheet.sheet} ${styles.frame}`}
          data-dense
          data-route-sheet=""
          data-overlay={panel}
          aria-describedby={undefined}
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
          <LayerPanelProvider value={{ close }}>
            <Panel key={panel} shown={shown} frame={content}>
              {children}
            </Panel>
          </LayerPanelProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One overlay's panel in the sheet. The first arrives with the sheet;
 * one that replaces it fades in where it was, and takes focus: the control
 * that moved on is gone with the panel it was in. */
function Panel({
  shown,
  frame,
  children,
}: {
  shown: RefObject<boolean>;
  frame: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [swap] = useState(() => shown.current);
  useEffect(() => {
    shown.current = true;
  }, [shown]);
  useLayoutEffect(() => {
    if (swap) frame.current?.focus({ preventScroll: true });
  }, [swap, frame]);
  return (
    <div
      className={styles.panel}
      data-route-panel=""
      data-motion={swap ? "swap" : "none"}
    >
      {children}
    </div>
  );
}
