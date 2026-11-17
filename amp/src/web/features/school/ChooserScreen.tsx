import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Page } from "../../ui/Page";
import frame from "./SchoolFrame.module.css";
import { currentSession, orgsOptions } from "./api";
import { orgHome } from "./paths";
import { PageHead, roleNames } from "./parts";
import styles from "./School.module.css";

/** More than one school: choose. With none yet, the one next step: set up a
 * class. One school never reaches this screen. */
export function ChooserScreen() {
  const orgs = useQuery(orgsOptions(currentSession())).data ?? [];
  if (!orgs.length)
    return (
      <Page className={frame.content} data-dense>
        <EmptyState
          title="No school yet"
          action={
            <Link to="/school/start" className={buttonClass("primary")}>
              Set up your class
            </Link>
          }
        >
          Its free 30-day pilot starts as it is made.
        </EmptyState>
      </Page>
    );
  return (
    <Page className={frame.content} data-dense>
      <PageHead title="Your schools" />
      <ul className={styles.chooserList}>
        {orgs.map((org) => {
          const home = orgHome(org);
          return (
            <li key={org.id}>
              <Link to={home.to as never} className={styles.chooserRow}>
                <span className={styles.chooserName}>{org.name}</span>
                <span className={styles.chooserRole}>
                  {org.setupPending
                    ? "Finish setting up"
                    : org.roles.map((role) => roleNames[role]).join(", ")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
