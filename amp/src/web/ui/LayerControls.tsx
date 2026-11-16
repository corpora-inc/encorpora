import * as RadixDialog from "@radix-ui/react-dialog";
import { createContext, useContext } from "react";
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

/** The cross at a layer's top right: this layer down, one step. */
export function CloseControl({ label = "Close" }: { label?: string }) {
  const stepBack = useLayerBack();
  const glyph = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
  // In a layer host: one layer down (its address loses its last entry).
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
