import { Link } from "@tanstack/react-router";
import bar from "../../ui/AppBar.module.css";
import { usePracticingProfile } from "./api";
import styles from "./ProfileBar.module.css";

const arrow = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M13 8H4M7.5 4.5 4 8l3.5 3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Who the adult is practicing as, beside the logo: a quiet label, never a
 * banner. With room it names the profile; on a phone the drawer does. */
export function ProfileMark() {
  const { profile } = usePracticingProfile();
  if (!profile) return null;
  return (
    <span className={styles.mark} data-profile-mark={profile.id}>
      <span className={styles.markKicker}>Practicing as</span>
      <span className={styles.markName}>{profile.label}</span>
    </span>
  );
}

/** The practice bar's one action while practicing as a profile: back to the
 * adult's own practice (or their home), always one tap away. */
export function ProfileBackAction() {
  const { profile, back, leave } = usePracticingProfile();
  if (!profile) return null;
  return (
    <button
      type="button"
      className={`${bar.actionLink} ${styles.back}`}
      aria-label={back.label}
      data-profile-back
      onClick={leave}
    >
      {arrow}
      <span className={styles.long}>{back.label}</span>
      <span className={styles.short} aria-hidden="true">
        {back.short}
      </span>
    </button>
  );
}

/** The drawer's "where you are" while practicing as a profile: its name,
 * adjusting it, and the way back. */
export function ProfilePlace({ onNavigate }: { onNavigate: () => void }) {
  const { profile, back, leave } = usePracticingProfile();
  if (!profile) return null;
  return (
    <div className={styles.place} data-learner={profile.id}>
      <span className={styles.kicker}>Practicing as</span>
      <strong className={styles.name}>{profile.label}</strong>
      <div className={styles.placeActions}>
        {/* Practice at a level is changed where it was chosen; a saved
            profile is adjusted in its editor. */}
        <Link
          to="/$"
          params={{
            _splat: profile.level ? "me/level" : `me/profiles/${profile.id}`,
          }}
          search={
            (profile.level
              ? { grade: profile.level.grade, pace: profile.level.pace }
              : {}) as never
          }
          className={styles.placeLink}
          onClick={onNavigate}
        >
          {profile.level ? "Change level" : "Adjust levels"}
        </Link>
        <button
          type="button"
          className={styles.placeLink}
          data-profile-leave
          onClick={() => {
            onNavigate();
            leave();
          }}
        >
          {back.label}
        </button>
      </div>
    </div>
  );
}
