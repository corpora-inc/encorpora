import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { brand } from "../../brand";
import styles from "./PageFrame.module.css";
/** The class every auth and first-run card uses, so cards share one position and size. */
export const frameCard = styles.card;
/**
 * The branded frame for sign-in, sign-up and first-run steps. Cards are
 * top-anchored at one offset, so moving between steps never moves the card.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label={`${brand.name} home`}>
          {brand.name}
        </Link>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
