import { Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { buttonClass } from "../../../ui/Button";
import { ContactAddress } from "../../support/ContactAddress";
import { JoinFrame } from "../join/JoinFrame";
import join from "../join/Join.module.css";
import { CleverLogInButton } from "./CleverLogInButton";

/** Why a Clever sign-in stopped (school/clever-auth.ts sends each cause to
 * `/clever/<cause>`), in words a student can act on. `student` causes are
 * answered by a teacher; the rest also name the way to reach us. */
export const cleverProblems: Record<
  string,
  { title: string; detail?: string; student?: true }
> = {
  "not-connected": {
    title: "Your school isn’t on AMP yet.",
    detail: "Ask your teacher.",
    student: true,
  },
  "not-on-roster": {
    title: "AMP can’t find your class yet.",
    detail: "Ask your teacher.",
    student: true,
  },
  disconnected: {
    title: "Your school’s AMP is paused.",
    detail: "Ask your teacher.",
    student: true,
  },
  canceled: { title: "Clever sign-in was canceled." },
  guardian: {
    title: "Clever sign-in is for students and school staff.",
    detail: "Families sign in with their AMP account.",
  },
  busy: { title: "Clever sign-in is busy.", detail: "Try again in a moment." },
  failed: {
    title: "Clever sign-in didn’t finish.",
    detail: "Try again. If it keeps happening, write to us.",
  },
};

/** `/clever/<cause>`: a failed Clever sign-in, never the adult sign-in form.
 * Clever's own button tries again. */
export function CleverProblemScreen() {
  const { reason } = useParams({ strict: false }) as { reason?: string };
  const cause = cleverProblems[reason ?? ""] ? reason! : "failed";
  const problem = cleverProblems[cause]!;
  // Every failure is logged where it is seen, never in silence.
  useEffect(() => {
    console.warn("Clever sign-in stopped", cause);
  }, [cause]);
  return (
    <JoinFrame>
      <div className={join.column} data-clever-problem={cause}>
        <h1 className={join.title}>{problem.title}</h1>
        {problem.detail && <p className={join.subtitle}>{problem.detail}</p>}
        <CleverLogInButton />
        {!problem.student && (
          <>
            {cause === "guardian" || cause === "failed" ? (
              <Link to="/sign-in" className={buttonClass("quiet")}>
                Sign in another way
              </Link>
            ) : null}
            <ContactAddress />
          </>
        )}
      </div>
    </JoinFrame>
  );
}
