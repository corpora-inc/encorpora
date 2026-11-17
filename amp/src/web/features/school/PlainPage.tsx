import type { ReactNode } from "react";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import styles from "./PlainPage.module.css";

/**
 * A school page outside any place (connecting Clever, joining a district, a
 * buyer's page): the shared Page and PageHeader, narrow for a form and
 * standard (`wide`) for a page with a list to review. There is no in-page
 * Back: the menu, the place switcher and the browser leave it.
 */
export function PlainPage({
  title,
  wide = false,
  children,
}: {
  title?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Page width={wide ? "standard" : "narrow"}>
      {title && <PageHeader title={title} />}
      {children}
    </Page>
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
