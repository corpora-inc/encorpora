import type { ComponentPropsWithRef } from "react";
import styles from "./Page.module.css";

/** How wide a screen's column is (ui/tokens.css, `--page-*`). */
export type PageWidth = "narrow" | "standard" | "wide" | "full";

/**
 * A screen's `<main>` and its content column: the only component that sets
 * a screen's width, side gutters, top and foot (docs/design/ia.md, Layout).
 * `narrow` is for forms and sign-in cards, `standard` for every
 * single-column screen, `wide` for dashboards and tables, and `full` for an
 * edge-to-edge surface (practice, the 3D map) that lays itself out. The
 * column stacks its children with the page's section gap; `className`
 * styles the column (its gap, its type), never its width, which
 * tests/page-layout.test.ts enforces. Other attributes, and a ref, go on
 * the `<main>`.
 */
export function Page({
  width = "standard",
  className,
  children,
  ...main
}: Omit<ComponentPropsWithRef<"main">, "style"> & { width?: PageWidth }) {
  if (width === "full")
    return (
      <main {...main} className={className} data-page="full">
        {children}
      </main>
    );
  return (
    <main {...main} className={styles.page} data-page={width}>
      <div
        className={className ? `${styles.column} ${className}` : styles.column}
        data-page-column=""
      >
        {children}
      </div>
    </main>
  );
}
