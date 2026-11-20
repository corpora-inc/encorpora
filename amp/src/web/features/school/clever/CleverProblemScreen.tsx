import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  CLEVER_SIGN_IN_CAUSES,
  type CleverSignInCause,
} from "../../../../schools/clever-sign-in-causes";
import { authConfigOptions } from "../../../lib/query";
import { buttonClass } from "../../../ui/Button";
import { ContactAddress } from "../../support/ContactAddress";
import { PublicFrame } from "../../schools/PublicFrame";
import { JoinFrame } from "../join/JoinFrame";
import join from "../join/Join.module.css";
import { Actions, Aside, Lead, PlainPage } from "../PlainPage";
import { CleverLogInButton } from "./CleverLogInButton";
import { DistrictRequest } from "./DistrictRequest";

/** Why a Clever sign-in stopped (school/clever-auth.ts sends each cause to
 * `/clever/<cause>`), in words the person can act on. `student` causes are
 * answered by a teacher; the rest also name the way to reach us. Every cause
 * the server sends has its words here: the type says so. */
export const cleverProblems: Record<
  CleverSignInCause,
  { title: string; detail?: string; student?: true }
> = {
  "not-added": {
    title: "Your district hasn’t added AMP yet",
    detail: "No approval needed.",
  },
  "not-connected": {
    title: "Your school hasn’t set up AMP yet.",
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

const isCause = (reason: string | undefined): reason is CleverSignInCause =>
  (CLEVER_SIGN_IN_CAUSES as readonly string[]).includes(reason ?? "");

/** `/clever/<cause>`: a failed Clever sign-in, never the adult sign-in form.
 * Clever's own button tries again. */
export function CleverProblemScreen() {
  const { reason } = useParams({ strict: false }) as { reason?: string };
  const cause = isCause(reason) ? reason : "failed";
  // Every failure is logged where it is seen, never in silence.
  useEffect(() => {
    console.warn("Clever sign-in stopped", cause);
  }, [cause]);
  if (cause === "not-added") return <DistrictNotAdded />;
  const problem = cleverProblems[cause];
  return (
    <JoinFrame>
      <div className={join.column} data-clever-problem={cause}>
        <h1 className={join.title}>{problem.title}</h1>
        {problem.detail && <p className={join.subtitle}>{problem.detail}</p>}
        <CleverLogInButton student={problem.student} />
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

/** A teacher or school leader whose district hasn't added AMP in Clever (or
 * hasn't shared them with it). Clever doesn't say who, so this is the
 * teacher's way in: the pilot now, and the district's step to forward. */
function DistrictNotAdded() {
  const problem = cleverProblems["not-added"];
  const config = useQuery(authConfigOptions);
  const signupUrl =
    config.data?.mode === "accounts"
      ? config.data.cleverDistrictSignupUrl
      : undefined;
  return (
    <PublicFrame>
      <PlainPage title={problem.title}>
        <Lead>{problem.detail}</Lead>
        <Actions>
          <Link
            to="/school/start"
            className={buttonClass("primary")}
            data-primary
          >
            Start a free pilot
          </Link>
        </Actions>
        {/* The message carries the district's link: written once the
            deployment's configuration is in, so it never changes in place. */}
        {!config.isPending && (
          <DistrictRequest step="add" signupUrl={signupUrl} />
        )}
        <Aside>
          <p>Student? Ask your teacher.</p>
        </Aside>
      </PlainPage>
    </PublicFrame>
  );
}
