import { cleverStartUrl } from "../../../../schools/clever-sign-in-causes";
import styles from "./CleverLogInButton.module.css";
import artwork from "./log-in-with-clever.svg";

/** Clever's own "Log in with Clever" button, drawn from Clever's SSO assets
 * (dev.clever.com/docs/clever-sso-assets), unaltered. It starts AMP's
 * authorization with AMP's state, so it is the same sign-in a Portal launch
 * restarts into. Callers show it only while Clever is on (enabled.ts).
 * `student`: the student entry's button, so a district that hasn't added
 * AMP answers with the student's screen. */
export function CleverLogInButton({ student = false }: { student?: boolean }) {
  return (
    <a href={cleverStartUrl(student)} className={styles.button}>
      {/* The artwork's own size, so the button never moves as it loads. */}
      <img src={artwork} alt="Log in with Clever" width={267} height={50} />
    </a>
  );
}
