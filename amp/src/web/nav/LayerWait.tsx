import type { ReactNode } from "react";
import { Loading } from "../ui/Loading";
import styles from "./layers.module.css";

/** A layer's wait for its data: the wave centred in the layer's body, never
 * a small one in its corner; the content replaces it in the same space.
 * `part` holds a section's place inside a layer that has already painted. */
export function LayerWait({
  part = false,
  children,
}: {
  part?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={part ? styles.waitPart : styles.wait} data-layer-wait="">
      <Loading>{children}</Loading>
    </div>
  );
}
