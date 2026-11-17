import { NavigationDrawer } from "../features/navigation/NavigationDrawer";
import { RootLink } from "../nav/root";
import { SupportHelp } from "../features/support/SupportHelp";
import { type ReactNode } from "react";
import { brand } from "../../brand";
import { Page } from "./Page";
import styles from "./PageFrame.module.css";
/** The class every auth and first-run card uses, so cards share one position and size. */
export const frameCard = styles.card;
/**
 * The branded frame for sign-in, sign-up and the first-run cards: a narrow
 * Page with no app bar, its card in the middle of the safe area (or at its
 * top, with padding, when it is taller than the screen). The card carries
 * the brand itself (`FrameBrand`).
 */
export function PageFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.frame} ${className}`}>
      <Page width="narrow">{children}</Page>
      <SupportHelp feedback={false} />
    </div>
  );
}
/** The wordmark at the top of a centered card; it links home. */
export function FrameBrand({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className={styles.cardBrandRow}>
      <NavigationDrawer />
      <RootLink
        className={`${styles.brand} ${styles.cardBrand}`}
        // The name holds the words shown (WCAG 2.5.3): the expansion too,
        // when it shows.
        aria-label={
          expanded
            ? `${brand.name} ${brand.expansion}, home`
            : `${brand.name} home`
        }
      >
        <span className={styles.wordmark}>{brand.name}</span>
        {expanded && (
          <>
            <span className={styles.brandDivider} aria-hidden="true">
              ·
            </span>
            <span className={styles.brandExpansion}>{brand.expansion}</span>
          </>
        )}
      </RootLink>
    </div>
  );
}
