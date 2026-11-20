import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Page } from "../../ui/Page";
import frame from "./SchoolFrame.module.css";
import { meOptions } from "../../lib/query";
import { currentSession, orgsOptions } from "./api";
import { orgHome } from "./paths";
import { PageHead, roleNames } from "./parts";
import styles from "./School.module.css";

/** More than one school: choose. With none yet, the one next step: set up a
 * class. Staff signed in through Clever with no school in AMP are told who
 * decides, never offered a second, parallel school. One school never
 * reaches this screen. */
export function ChooserScreen() {
  const session = currentSession();
  const orgs = useQuery(orgsOptions(session)).data ?? [];
  const me = useQuery(meOptions(session)).data;
  const account = me?.signedIn ? me.account : null;
  if (!orgs.length && account?.kind === "provider")
    return (
      <Page className={frame.content} data-dense>
        <EmptyState title="No school in AMP yet">
          {account.districtName ?? "Your district"} shares schools with AMP
          through Clever. Your district admin can add yours.
        </EmptyState>
      </Page>
    );
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
          A class starts your free 30-day pilot.
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
