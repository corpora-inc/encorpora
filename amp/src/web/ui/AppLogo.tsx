import type { ComponentProps } from "react";
import { WaveMark } from "./WaveMark";
import styles from "./AppBar.module.css";

/**
 * The wave and "AMP": the logo at the top left of every app screen. It is
 * always the button that opens and closes the drawer, so its accessible name
 * says which (`Open AMP menu` / `Close AMP menu`).
 */
export function AppLogo(props: ComponentProps<"button">) {
  return (
    <button type="button" className={styles.logo} data-app-logo {...props}>
      <WaveMark />
      <span aria-hidden="true">AMP</span>
    </button>
  );
}
