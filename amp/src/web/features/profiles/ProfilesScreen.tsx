import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { levelsRange } from "../../../learning/practice-profiles";
import { meOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { currentSession } from "../school/api";
import { choosePracticeProfile, recentProfiles } from "./api";
import { setLevelDraft } from "./level-draft";
import { practiceAs } from "./practice-mode";
import styles from "./Profiles.module.css";

/**
 * `/me/profiles`, Practice at a level's hub (the drawer's one entry for it,
 * Q-3): "Choose a level" (nothing saved), "New profile" (saved under a
 * name), then every saved profile, the ones this device used last first.
 * The account's one level profile is the level step's own, never listed.
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
  const profiles = (account?.practiceProfiles ?? [])
    .filter((profile) => !profile.level)
    .sort((a, b) => rank(a.id) - rank(b.id));
  return (
    <main className={styles.page}>
      <div className={styles.list}>
        <header className={styles.listHead}>
          <div>
            <h1>Practice at a level</h1>
            <p>Your own levels don’t change.</p>
          </div>
          <div className={styles.listActions}>
            <Link
              to="/$"
              params={{ _splat: "me/level" }}
              className={buttonClass("primary")}
            >
              Choose a level
            </Link>
            <Link
              to="/$"
              params={{ _splat: "me/profiles/new" }}
              // A new profile starts afresh (level-draft.ts).
              onClick={() => setLevelDraft(session.accountId, "new", {})}
              className={buttonClass("secondary")}
            >
              New profile
            </Link>
          </div>
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
                    void navigate(practiceAs(profile.id));
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
        ) : // None saved yet: the line above already says what goes here.
        null}
      </div>
    </main>
  );
}
