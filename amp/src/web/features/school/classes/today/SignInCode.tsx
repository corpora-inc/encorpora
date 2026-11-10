import { Link } from "@tanstack/react-router";
import { CopyButton } from "../../parts";
import styles from "./Today.module.css";

/** How children get in on a device of their own: the class code, its link
 * to copy, one line on signing in, and (when the bar doesn't offer it) the
 * code full screen. A family's reads for a family, a class's for a class. */
export function SignInCode({
  code,
  place,
  family,
  board,
}: {
  code: string;
  place: { org: string; class: string };
  family: boolean;
  /** Offer the full-screen code here: the bar doesn't. */
  board: boolean;
}) {
  return (
    <section className={styles.signIn} aria-labelledby="today-sign-in">
      <div className={styles.codeLine}>
        <h2 id="today-sign-in" className={styles.codeLabel}>
          Class code
        </h2>
        <strong className={styles.code} data-class-code={code}>
          {code.slice(0, 3)}
          <span aria-hidden="true">-</span>
          {code.slice(3)}
        </strong>
        <CopyButton
          text={`${location.origin}/join/${code}`}
          label="Copy link"
          copied="Link copied"
          className={styles.copy}
        />
      </div>
      <p className={styles.note}>
        {family
          ? "Children sign in with this code and their three pictures."
          : "Students sign in with this code and their three pictures."}
        {board && (
          <>
            {" "}
            <Link
              to="/school/$org/classes/$class/start"
              params={place}
              className={styles.inlineLink}
            >
              {family ? "Full screen" : "Start class"}
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
