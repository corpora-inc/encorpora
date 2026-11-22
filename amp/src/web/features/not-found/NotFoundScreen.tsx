import { RootLink } from "../../nav/root";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { brandTitle } from "../../../brand";
import { applyRouteHead } from "../../app/route-head";
import { buttonClass } from "../../ui/Button";
import styles from "./NotFoundScreen.module.css";

export function NotFoundScreen() {
  // The head says not found too, and stays out of search. A route's own
  // head follows this one (app/RouterView.tsx) for any address it titles;
  // an address whose screen writes its own (a comparison that doesn't
  // exist, `/versus/<slug>`) keeps this.
  useEffect(
    () =>
      applyRouteHead(document, {
        title: `Page not found | ${brandTitle}`,
        description:
          "Find AMP mathematics, free lessons and printable workbooks.",
        canonical: null,
        robots: "noindex, follow",
      }),
    [],
  );
  return <main className={styles.page}>
    <h1>Page not found</h1>
    <p>This address does not lead to a page. Choose a place to continue.</p>
    <nav className={styles.links} aria-label="Find a page">
      <RootLink className={buttonClass("primary")}>Open AMP</RootLink>
      <Link to="/pathways" className={buttonClass("secondary")}>Explore math skills</Link>
      <a href="https://corpora.inc/resources/" className={buttonClass("secondary")}>Free lessons and workbooks</a>
    </nav>
  </main>;
}
