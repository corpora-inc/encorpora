/** Why a Clever sign-in stopped. The callback (clever-auth.ts) sends each to
 * `/clever/<cause>` and the screen (CleverProblemScreen.tsx) answers each, so
 * both read this one list: the server can't send a cause the page doesn't
 * name. */
export const CLEVER_SIGN_IN_CAUSES = [
  // Clever's `error=unauthorized-user`: AMP isn't in this person's Clever
  // (their district hasn't added it, or hasn't given them it). Clever says
  // neither who nor why, so where they started picks the screen: here, an
  // adult or anyone unknown, the teacher's way in first.
  "not-added",
  // The same answer to a sign-in started on `/school/connect`, where a
  // district admin connects: adding AMP in Clever first.
  "add-amp",
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

/** Where a Clever sign-in started, when it matters: the student entry
 * (`/join`) or district setup (`/school/connect`). */
export const CLEVER_STARTS = ["student", "admin"] as const;
export type CleverStart = (typeof CLEVER_STARTS)[number];

/** Clever sign-in starts here. Clever's unauthorized-user error says nothing
 * about who it was, so `?as=` names where the sign-in began and picks the
 * screen that answers it: the student's, the district admin's, or (with
 * none) the teacher's. It authorizes nothing. */
export const cleverStartUrl = (as?: CleverStart) =>
  `/api/v1/school/sso/clever/start${as ? `?as=${as}` : ""}`;
