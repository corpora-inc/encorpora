import type { ReactNode } from "react";
// The reset for the legacy global element rules, under `data-dense`.
import "../SchoolFrame.module.css";
import { WaveMark } from "../../../ui/NavigationSheet";
import styles from "./Join.module.css";

/** Every sign-in screen: the mark, whatever leads back, and the screen. */
export function JoinFrame({
  lead,
  children,
}: {
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.page} data-dense>
      <header className={styles.top}>
        {lead}
        <span className={styles.brand}>
          <WaveMark />
          <span>AMP</span>
        </span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
