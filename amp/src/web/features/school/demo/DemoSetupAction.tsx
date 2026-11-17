import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import bar from "../../../ui/AppBar.module.css";
import { currentSession, orgOptions } from "../core-api";
import styles from "./Demo.module.css";

/* The demo's part of the app bar, in its own module: the shell (AppShell)
   carries this, never Practice as and the join API (DemoPlace.tsx). */

/** Whether this org is a demo, from the org the frame already loaded. */
export function useDemoOrg(orgId: string) {
  return useQuery(orgOptions(currentSession(), orgId)).data?.demo === true;
}

/** The bar's one action in a demo: the way to the real thing, never the demo
 * converted in place. A teacher sets up their real class; a school leader
 * sets up their real school, on their own. Its full label from 640 px, a
 * short one on a phone, always a 44 px target. */
export function DemoSetupAction({ school }: { school: boolean }) {
  const label = school ? "Set up your real school" : "Set up your real class";
  // A phone keeps a short word beside the arrow: an arrow alone says nothing.
  const short = school ? "Real school" : "Real class";
  const look = {
    className: `${bar.actionLink} ${styles.action}`,
    "aria-label": label,
    "data-demo-action": true,
  };
  const content = (
    <>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.long}>{label}</span>
      <span className={styles.short} aria-hidden="true">
        {short}
      </span>
    </>
  );
  return school ? (
    <Link to={"/school/start/school" as never} {...look}>
      {content}
    </Link>
  ) : (
    <Link to="/school/start" {...look}>
      {content}
    </Link>
  );
}
