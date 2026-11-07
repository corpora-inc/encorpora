import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SELF_SERVE_ORG_LIMIT } from "../../../schools/license";
import { Brand } from "./SchoolFrame";
import { buttonClass } from "../../ui/Button";
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
      {orgs.length < SELF_SERVE_ORG_LIMIT && (
        <Link
          to={"/school/new" as never}
          search={{ org: "new" } as never}
          className={buttonClass("secondary")}
        >
          Set up another school
        </Link>
      )}
    </main>
  );
}
