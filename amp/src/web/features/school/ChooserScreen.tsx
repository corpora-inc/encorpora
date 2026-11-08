import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Brand } from "./SchoolFrame";
import { currentSession, orgsOptions } from "./api";
import { orgHome } from "./paths";
import { roleNames } from "./parts";
import styles from "./School.module.css";

/** More than one school: choose. One or none never reaches this screen. */
export function ChooserScreen() {
  const orgs = useQuery(orgsOptions(currentSession())).data ?? [];
  return (
    <main className={styles.chooser} data-dense>
      <Brand />
      <h1>Your schools</h1>
      <ul className={styles.chooserList}>
        {orgs.map((org) => {
          const home = orgHome(org);
          return (
            <li key={org.id}>
              <Link
                to={home.to as never}
                search={("search" in home ? home.search : {}) as never}
                className={styles.chooserRow}
              >
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
    </main>
  );
}
