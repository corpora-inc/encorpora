import { Link, useLoaderData, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  CLEVER_SIGN_IN_CAUSES,
  type CleverSignInCause,
} from "../../../../schools/clever-sign-in-causes";
import { buttonClass } from "../../../ui/Button";
import { ContactAddress } from "../../support/ContactAddress";
import { PublicFrame } from "../../schools/PublicFrame";
import { JoinFrame } from "../join/JoinFrame";
import join from "../join/Join.module.css";
import { Actions, Aside, Lead, PlainPage } from "../PlainPage";
import { CleverLogInButton } from "./CleverLogInButton";
import { DistrictRequest } from "./DistrictRequest";

/** The next step that can work after each stop, first one first:
 * - `clever`: Clever's button again, for a stop that a retry can get past;
 * - `code`: the student entry's class code, when Clever can't let a student
 *   in until their district acts, but their teacher's class can;
 * - `sign-in`: AMP's own sign-in, for an account that isn't a Clever one. */
type Step = "clever" | "code" | "sign-in";

/** Why a Clever sign-in stopped (school/clever-auth.ts sends each cause to
 * `/clever/<cause>`), in words the person can act on. `student` causes are
 * answered by a teacher; the rest also name the way to reach us. Every cause
 * the server sends has its words here: the type says so. */
export const cleverProblems: Record<
  CleverSignInCause,
  { title: string; detail?: string; student?: true; steps: Step[] }
> = {
  // Clever's unauthorized-user: true for whoever it was, whatever the
  // reason Clever didn't give. The two adult screens differ in their order.
  "not-added": {
    title: "AMP isn’t in your Clever account yet",
    detail: "Your class can start today. Your district can add AMP later.",
    steps: [],
  },
  "add-amp": {
    title: "AMP isn’t in your Clever account yet",
    detail:
      "A district admin adds AMP in Clever, then signs in again to connect.",
    steps: [],
  },
  "not-connected": {
    title: "Your school hasn’t set up AMP yet.",
    detail: "Ask your teacher.",
    student: true,
    steps: ["code"],
  },
  "not-on-roster": {
    title: "AMP can’t find your class yet.",
    detail: "Ask your teacher.",
    student: true,
    steps: ["clever"],
  },
  disconnected: {
    title: "Your school’s AMP is paused.",
    detail: "Ask your teacher.",
    student: true,
    steps: ["code"],
  },
  canceled: { title: "Clever sign-in was canceled.", steps: ["clever"] },
  // A parent or guardian: Clever can't let them in, their AMP account can.
  guardian: {
    title: "Clever sign-in is for students and school staff.",
    detail: "Families sign in with their AMP account.",
    steps: ["sign-in"],
  },
  busy: {
    title: "Clever sign-in is busy.",
    detail: "Try again in a moment.",
    steps: ["clever"],
  },
  failed: {
    title: "Clever sign-in didn’t finish.",
    detail: "Try again. If it keeps happening, write to us.",
    steps: ["clever", "sign-in"],
  },
};

const isCause = (reason: string | undefined): reason is CleverSignInCause =>
  (CLEVER_SIGN_IN_CAUSES as readonly string[]).includes(reason ?? "");

/** `/clever/<cause>`: a failed Clever sign-in, never the adult sign-in form. */
export function CleverProblemScreen() {
  const { reason } = useParams({ strict: false }) as { reason?: string };
  const cause = isCause(reason) ? reason : "failed";
  // Every failure is logged where it is seen, never in silence.
  useEffect(() => {
    console.warn("Clever sign-in stopped", cause);
  }, [cause]);
  if (cause === "not-added" || cause === "add-amp")
    return <NotInClever cause={cause} />;
  const problem = cleverProblems[cause];
  return (
    <JoinFrame>
      <div className={join.column} data-clever-problem={cause}>
        <h1 className={join.title}>{problem.title}</h1>
        {problem.detail && <p className={join.subtitle}>{problem.detail}</p>}
        {problem.steps.map((step, index) =>
          step === "clever" ? (
            <CleverLogInButton key={step} student={problem.student} />
          ) : (
            <Link
              key={step}
              to={step === "code" ? "/join" : "/sign-in"}
              className={buttonClass(index ? "quiet" : "primary")}
              data-primary={index ? undefined : ""}
            >
              {step === "code"
                ? "Type a class code"
                : index
                  ? "Sign in another way"
                  : "Sign in"}
            </Link>
          ),
        )}
        {!problem.student && <ContactAddress />}
      </div>
    </JoinFrame>
  );
}

/** Clever answered that AMP isn't in this adult's Clever account (or Clever
 * didn't say who it was). Nobody waits on the district: a teacher starts a
 * pilot now and forwards the request; a district admin, who most likely
 * started on `/school/connect` (`add-amp`), adds AMP in Clever first. */
function NotInClever({ cause }: { cause: "not-added" | "add-amp" }) {
  // What the route's loader read (router.tsx), and only that: it changes
  // only when the route reloads (a sign-in elsewhere, Try again), so a read
  // that failed or arrives later can't change the actions or the message
  // on its own after the first paint. Without
  // the deployment's Clever page (or its configuration), the request links
  // to `/schools`.
  const config = useLoaderData({ from: "/clever/$reason" });
  const signupUrl =
    config?.mode === "accounts" ? config.cleverDistrictSignupUrl : undefined;
  // With no Clever page to add AMP on, the admin's step is the request too.
  const admin = cause === "add-amp" && !!signupUrl;
  const problem = cleverProblems[admin ? "add-amp" : "not-added"];
  // The teacher's step, beside the admin's as a quiet second.
  const pilot = (
    <Link
      to="/school/start"
      className={buttonClass(admin ? "quiet" : "primary")}
      data-primary={admin ? undefined : ""}
    >
      {admin ? "Teacher? Start a free pilot" : "Start a free pilot"}
    </Link>
  );
  return (
    <PublicFrame>
      <PlainPage title={problem.title}>
        <Lead>{problem.detail}</Lead>
        <Actions>
          {admin ? (
            <>
              <a
                href={signupUrl}
                rel="noreferrer"
                className={buttonClass("primary")}
                data-primary
              >
                Add AMP in Clever
              </a>
              {pilot}
            </>
          ) : (
            pilot
          )}
        </Actions>
        {/* Written once from the first paint's configuration: the message
            and its link never change in place. */}
        <DistrictRequest
          step="add"
          signupUrl={signupUrl}
          heading={admin ? "Not a district admin? Send them this" : undefined}
          adminLink={!admin}
        />
        <Aside>
          <p>Student? Ask your teacher.</p>
        </Aside>
      </PlainPage>
    </PublicFrame>
  );
}
