import { dropCapability } from "../../capability-entry";
import { carriedLink, carryLink, dropCarry } from "../../lib/link-carry";
import type { OrgResource } from "../../../schools/contracts";

/** Where each staff screen lives, without the leading slash. */
export const orgPath = (orgId: string, rest = "") =>
  `school/${orgId}${rest ? `/${rest}` : ""}`;
export const classPath = (orgId: string, classId: string) =>
  orgPath(orgId, `classes/${classId}`);

export const setupSteps = [
  "school",
  "calendar",
  "experience",
  "agreement",
  "students",
] as const;
export type SetupStep = (typeof setupSteps)[number];
/** A setup step's own address, without the leading slash:
 * `school/<org>/setup`, then `…/setup/<step>`; typing names is
 * `…/setup/students/names`. */
export const setupPath = (
  orgId: string,
  step: SetupStep = "school",
  method?: "names",
) =>
  orgPath(
    orgId,
    `setup${step === "school" ? "" : `/${step}`}${method ? `/${method}` : ""}`,
  );

/** A person's home in a school: setup until it's finished, then the school's own
 * address, which opens the overview or their classes as this person can see. */
export function orgHome(org: Pick<OrgResource, "id" | "setupPending">) {
  return org.setupPending
    ? { to: `/${setupPath(org.id)}` }
    : { to: `/school/${org.id}` };
}

const SIGNUP_COOKIE = "amp.school-signup";

/** Carried while its holder signs in, creates an account, confirms an address
 * or switches account from it (`lib/link-carry.ts`), with the proof for
 * account creation. Only the fragment and this carry ever hold the token, so
 * it stays out of every URL a server or report would see. */
export function rememberInvite(fragment: string, { switching = false } = {}) {
  carryLink("/school/invite", fragment, { switching });
  markSchoolSignup(fragment);
}
export const rememberedInvite = () => carriedLink("/school/invite");
export function forgetInvite() {
  dropCapability("/school/invite");
  dropCarry("/school/invite");
  markSchoolSignup(null);
}
/** Tells account creation this person is on their way into a school, for an
 * hour: their mail shouldn't call this a parent account, and a mailed invite
 * means no second confirmation. Sent only to the sign-in endpoints. */
export function markSchoolSignup(value: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = value
    ? `${SIGNUP_COOKIE}=${encodeURIComponent(value)}; Path=/api/auth; Max-Age=3600; SameSite=Lax${secure}`
    : `${SIGNUP_COOKIE}=; Path=/api/auth; Max-Age=0; SameSite=Lax${secure}`;
}

/** A district's adoption pages: the link a school opens to approve joining
 * (`/school/adopt/<district>`), and the district admin's page that hands it
 * out (`…/manage`). Without a leading slash, for a `/$` link. */
export const adoptPath = (district: string, manage = false) =>
  `school/adopt/${encodeURIComponent(district)}${manage ? "/manage" : ""}`;
