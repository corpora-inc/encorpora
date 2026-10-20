import { Link } from "@tanstack/react-router";
import { useLayoutEffect, type ReactNode } from "react";
import { brand } from "../../brand";
import styles from "./PageFrame.module.css";
/** The class every auth and first-run card uses, so cards share one position and size. */
export const frameCard = styles.card;
/**
 * The branded frame for sign-in, sign-up and first-run steps.
 *
 * First-run cards are top-anchored at one offset under the brand bar, so
 * moving between steps never moves the card. `centered` (the sign-in screens)
 * drops the bar: the card carries the brand itself (`FrameBrand`) and sits in
 * the middle of the safe area, or at its top with padding when it is taller
 * than the screen.
 */
export function PageFrame({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  // index.html hides the first-paint bar on these screens; leaving them
  // restores it before the next screen paints.
  useLayoutEffect(() => {
    if (!centered) return;
    document.documentElement.dataset.frame = "card";
    return () => {
      delete document.documentElement.dataset.frame;
    };
  }, [centered]);
  if (centered)
    return (
      <div className={`${styles.frame} ${styles.centered}`}>
        <main className={styles.main}>{children}</main>
      </div>
    );
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
/** The wordmark at the top of a centered card; it links home. */
export function FrameBrand() {
  return (
    <Link
      to="/"
      className={`${styles.brand} ${styles.cardBrand}`}
      aria-label={`${brand.name} home`}
    >
      {brand.name}
    </Link>
  );
}
