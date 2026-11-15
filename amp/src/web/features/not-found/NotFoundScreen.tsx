import { RootLink } from "../../nav/root";
import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import styles from "./NotFoundScreen.module.css";

export function NotFoundScreen() {
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
