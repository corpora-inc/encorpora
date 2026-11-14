import * as RadixDialog from "@radix-ui/react-dialog";
import { createContext, useContext } from "react";
import styles from "./LayerControls.module.css";

/**
 * The controls at the top of a layer (a sheet or a dialog over a page,
 * nav/LayerHost): the way back one layer, named for where it goes, and the
 * close that puts the whole stack away. Every layer draws these two, the
 * same way.
 */

/** A layer host's step back one layer; without one, back closes. */
const LayerBack = createContext<(() => void) | null>(null);
export const LayerBackProvider = LayerBack.Provider;
export const useLayerBack = () => useContext(LayerBack);

/** "‹ Naming shapes": back one layer. Its chevron sits on the middle of the
 * first line's lowercase letters, however the name wraps; the name wraps
 * under itself, never under the chevron. */
export function BackControl({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.back}
      aria-label={`Back to ${label}`}
      data-layer-back={label}
      onClick={onBack}
    >
      <span className={styles.backLabel}>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
        {label}
      </span>
    </button>
  );
}

/** The cross at a layer's top right: closes it, and with it every layer
 * under it (Escape and the scrim do the same). */
export function CloseControl({ label = "Close" }: { label?: string }) {
  return (
    <RadixDialog.Close
      className={styles.close}
      aria-label={label}
      data-layer-close=""
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </RadixDialog.Close>
  );
}

/** The row over a layer's title when it stands on another: back at the
 * start, close at the end. */
export function LayerTopRow({
  back,
  onBack,
}: {
  back: string;
  onBack: () => void;
}) {
  return (
    <div className={styles.row}>
      <BackControl label={back} onBack={onBack} />
      <CloseControl />
    </div>
  );
}
