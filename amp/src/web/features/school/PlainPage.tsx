import type { MouseEvent, ReactNode } from "react";
import { useCloseClick } from "../../nav/links";
import styles from "./PlainPage.module.css";

/**
 * A school page outside any place (setting up a class, connecting Clever,
 * joining a district, a buyer's page): one centred column, the serif title,
 * and a quiet way Back to where it was opened (docs/design/ia.md, "Pages of
 * their own go Back"). `wide` is for a page with a list to review.
 */
export function PlainPage({
  title,
  back,
  wide = false,
  children,
}: {
  title?: string;
  /** Where Back goes when there is no history to return to. */
  back?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={styles.page} data-wide={wide || undefined}>
      {back ? <BackLink to={back} /> : <span className={styles.backSlot} />}
      {title && <h1 className={styles.title}>{title}</h1>}
      {children}
    </main>
  );
}

function BackLink({ to }: { to: string }) {
  const close = useCloseClick(to);
  return (
    <a
      href={to}
      className={styles.back}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => close(event)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      Back
    </a>
  );
}

/** One sentence under the title. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className={styles.lead}>{children}</p>;
}

/** The page's actions: the one primary first, then quieter ones. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/** Rare ways elsewhere, under the actions: quiet links, one per line. */
export function Aside({ children }: { children: ReactNode }) {
  return <div className={styles.aside}>{children}</div>;
}

export const plainStyles = styles;
