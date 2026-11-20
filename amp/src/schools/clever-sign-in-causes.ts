/** Why a Clever sign-in stopped. The callback (clever-auth.ts) sends each to
 * `/clever/<cause>` and the screen (CleverProblemScreen.tsx) answers each, so
 * both read this one list: the server can't send a cause the page doesn't
 * name. */
export const CLEVER_SIGN_IN_CAUSES = [
  // An adult (or someone whose role Clever didn't say) whose district hasn't
  // added AMP in Clever, or hasn't shared them with it: Clever's
  // `error=unauthorized-user`.
  "not-added",
  // A student whose district never connected AMP, or hasn't added it.
  "not-connected",
  // A student whose district disconnected AMP.
  "disconnected",
  // A student in a connected district with no learner in AMP.
  "not-on-roster",
  "canceled",
  "guardian",
  "busy",
  "failed",
] as const;
export type CleverSignInCause = (typeof CLEVER_SIGN_IN_CAUSES)[number];

export const cleverProblemPath = (cause: CleverSignInCause) =>
  `/clever/${cause}`;

/** Clever sign-in starts here. The student entry (`/join`) adds
 * `?as=student`: Clever's unauthorized-user error says nothing about who it
 * was, so this picks the student's screen over the teacher's. It authorizes
 * nothing. */
export const cleverStartUrl = (student = false) =>
  `/api/v1/school/sso/clever/start${student ? "?as=student" : ""}`;
