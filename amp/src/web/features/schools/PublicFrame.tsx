import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WaveMark } from "../../ui/NavigationSheet";
import { buttonClass } from "../../ui/Button";
import { SUPPORT_EMAIL } from "../support/SupportHelp";
import styles from "./PublicFrame.module.css";

/** The school pages' header and footer. Every page offers the same few places:
 * the curriculum, student data, and signing in. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page} data-schools-public="">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Link
            to="/schools"
            className={styles.brand}
            aria-label="AMP for Schools, home"
          >
            <WaveMark />
            <span className={styles.wordmark}>AMP</span>
            <span className={styles.forSchools}>for Schools</span>
          </Link>
          <div className={styles.headerLinks}>
            <Link
              to="/schools/scope-and-sequence"
              className={buttonClass("quiet", styles.wideOnly)}
            >
              Scope and sequence
            </Link>
            <Link
              to="/schools/trust"
              className={buttonClass("quiet", styles.wideOnly)}
            >
              Student data
            </Link>
            <Link
              to="/sign-in"
              search={{ return: "school", next: "/school" } as never}
              className={buttonClass("quiet", styles.signIn)}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <Link to="/schools/scope-and-sequence">Scope and sequence</Link>
        <Link to="/schools/trust">Student data</Link>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </footer>
    </div>
  );
}
