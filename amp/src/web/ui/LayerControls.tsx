import * as RadixDialog from "@radix-ui/react-dialog";
import { createContext, useContext, type ReactNode } from "react";
import styles from "./LayerControls.module.css";

/**
 * The control at the top of a layer (a sheet or a dialog over a page,
 * nav/LayerHost): one cross that puts this layer down (Q-8). Over another
 * layer it reveals the one under it; on the last, the page. Escape does the
 * same; only the scrim puts the whole stack away.
 */

/** A layer host's step back one layer; without one, the cross closes. */
const LayerBack = createContext<(() => void) | null>(null);
export const LayerBackProvider = LayerBack.Provider;
export const useLayerBack = () => useContext(LayerBack);

/**
 * The one overlay a layer host draws (ui/LayerFrame.tsx). A layer's own
 * Sheet or Dialog inside it draws its panel there, never an overlay and a
 * scrim of its own; what that panel holds (a confirmation's own Sheet) is
 * outside the frame again (`LayerPanelReset`).
 */
export type LayerPanelFrame = {
  /** This layer down, one step (its ✕): to the layer behind it, or, at
   * the first level, the page. */
  close: () => void;
  /** The way back up (the layers under this one), the first line of the
   * panel's heading; none at the first level. */
  trail?: ReactNode;
};
const LayerPanel = createContext<LayerPanelFrame | null>(null);
export const LayerPanelProvider = LayerPanel.Provider;
export const useLayerPanel = () => useContext(LayerPanel);
/** Inside a layer's panel: its contents are no layer of the frame. */
export function LayerPanelReset({ children }: { children: ReactNode }) {
  return (
    <LayerPanel.Provider value={null}>
      <LayerBack.Provider value={null}>{children}</LayerBack.Provider>
    </LayerPanel.Provider>
  );
}

/** The cross at a layer's top right: this layer down, one step. */
export function CloseControl({ label = "Close" }: { label?: string }) {
  const stepBack = useLayerBack();
  const panel = useLayerPanel();
  const glyph = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
  // A layer's panel in the layer frame: this layer down, as Escape (its
  // trail steps further up; the scrim puts the whole overlay away).
  if (panel)
    return (
      <button
        type="button"
        className={styles.close}
        aria-label={label}
        data-layer-close=""
        onClick={panel.close}
      >
        {glyph}
      </button>
    );
  // In a layer host: one layer down.
  if (stepBack)
    return (
      <button
        type="button"
        className={styles.close}
        aria-label={label}
        data-layer-close=""
        onClick={stepBack}
      >
        {glyph}
      </button>
    );
  return (
    <RadixDialog.Close
      className={styles.close}
      aria-label={label}
      data-layer-close=""
    >
      {glyph}
    </RadixDialog.Close>
  );
}

/** Escape over a layer: the same one step as its cross. */
export function useLayerEscape(
  own?: (event: KeyboardEvent) => void,
): (event: KeyboardEvent) => void {
  const stepBack = useLayerBack();
  return (event) => {
    own?.(event);
    if (event.defaultPrevented || !stepBack) return;
    event.preventDefault();
    stepBack();
  };
}
