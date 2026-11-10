import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { levelsRange } from "../../../learning/practice-profiles";
import { meOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { currentSession } from "../school/api";
import { choosePracticeProfile, recentProfiles } from "./api";
import styles from "./Profiles.module.css";

/**
 * `/me/profiles`, "Practice as someone else": every saved profile, the ones
 * this device used last first, and "Try a level…". Reached from /me; never
 * from the place switcher, which holds places only (docs/design/ia.md).
 */
export function ProfilesScreen() {
  const session = currentSession();
  const navigate = useNavigate();
  const me = useQuery(meOptions(session));
  const account = me.data?.signedIn ? me.data : null;
  const recent = recentProfiles();
  const rank = (id: string) => {
    const at = recent.indexOf(id);
    return at < 0 ? recent.length : at;
  };
  const profiles = [...(account?.practiceProfiles ?? [])].sort(
    (a, b) => rank(a.id) - rank(b.id),
  );
  return (
    <main className={styles.page}>
      <div className={styles.list}>
        <header className={styles.listHead}>
          <div>
            <h1>Practice as someone else</h1>
            <p>
              Practice at any grade and pace. Your own record never changes.
            </p>
          </div>
          <Link
            to="/$"
            params={{ _splat: "me/profiles/new" }}
            className={buttonClass("primary")}
          >
            Try a level
          </Link>
        </header>
        {me.isPending ? (
          <Loading />
        ) : profiles.length ? (
          <ul className={styles.profileRows}>
            {profiles.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={styles.profileRow}
                  onClick={() => {
                    choosePracticeProfile(profile.id);
                    void navigate({ to: "/practice" as never });
                  }}
                >
                  <span>
                    <strong>{profile.label}</strong>
                    <span>{levelsRange(profile.levels)}</span>
                  </span>
                  <span className={styles.rowAction}>Practice</span>
                </button>
                <Link
                  to="/$"
                  params={{ _splat: `me/profiles/${profile.id}` }}
                  className={buttonClass("quiet")}
                  aria-label={`Edit ${profile.label}`}
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.listEmpty}>
            Saved levels appear here, so you can come back to them.
          </p>
        )}
      </div>
    </main>
  );
}
