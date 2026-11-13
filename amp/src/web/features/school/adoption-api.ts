import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  adoptionAccepted,
  adoptionCleverPreview,
  adoptionDecisions,
  adoptionDistrictView,
  adoptionIssued,
  adoptionOptions,
  adoptionReview,
} from "../../../schools/adoption-contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { call, keyFor } from "./api";
const messages: Record<string, string> = {
  adoption_current_authority_required:
    "Clever could not confirm your current district administrator role. Sign in through Clever again or ask another district administrator to review this school.",
  adoption_source_authority_required:
    "Only this school’s administrator or the teacher who started all its active classes can approve the move.",
  adoption_source_authority_changed:
    "The school’s ownership changed. Ask its current administrator to create a new approval.",
  adoption_destination_authority_required:
    "Sign in with an administrator account for the receiving district.",
  adoption_needs_standalone_school:
    "This school already belongs to an institution. Open its school page to check where it belongs.",
  adoption_expired_or_revoked:
    "This approval expired or was withdrawn. Ask the school to create a new one.",
  adoption_already_used:
    "This approval was already used. Open your schools to see the result.",
  adoption_not_found:
    "This approval link is incomplete. Open the full link shared by the school.",
  adoption_conflicts_require_review:
    "Some records need a separate review. Nothing was moved. Contact support@corpora.inc with the school and district names.",
  adoption_staff_match_invalid:
    "These staff records cannot be combined. Refresh the review before continuing.",
  adoption_clever_already_imported:
    "This Clever connection already imported its roster. Keep the existing roster for this move, or contact support to review the records.",
  adoption_clever_school_already_bound:
    "Clever already created a different school record. Nothing was moved. Contact support to review the existing records.",
  adoption_clever_identity_already_bound:
    "One of these Clever records already belongs to another AMP record. Nothing was moved. Contact support for review.",
  adoption_clever_incomplete_match:
    "Match every listed person and class, or keep the existing roster for this move.",
  adoption_clever_roster_mismatch:
    "A class’s current students or teachers do not match the selected Clever section. Check Clever’s sharing settings and the selected records.",
  adoption_clever_role_mismatch:
    "A selected Clever user has a different role. Match students to students and staff to staff.",
  adoption_clever_duplicate_match:
    "Each Clever person and section can be selected only once.",
  adoption_clever_review_unavailable:
    "Clever roster review is unavailable. Keep the existing roster for this move, or try again after the connection is configured.",
  clever_institution_agreement_required:
    "The receiving district needs an active school data agreement before it can receive a school.",
  request_origin_invalid: "Refresh this AMP page before continuing.",
};
export function adoptionError(error: unknown) {
  return error instanceof AppError
    ? (messages[error.code ?? ""] ?? error.message)
    : "That did not save. Try again.";
}
const post = <T>(
  session: AuthSession,
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  signal?: AbortSignal,
) => call(`/adoptions/${path}`, schema, session, { body, signal });
export const adoptionOptionsQuery = (
  session: AuthSession,
  districtId?: string,
) =>
  queryOptions({
    queryKey: keyFor(session, "adoptions", districtId ?? ""),
    queryFn: ({ signal }) =>
      post(session, "options", adoptionOptions, { districtId }, signal),
  });
export const adoptionDistrictQuery = (
  session: AuthSession,
  districtId: string,
) =>
  queryOptions({
    queryKey: keyFor(session, "adoption-district", districtId),
    queryFn: ({ signal }) =>
      post(session, "district", adoptionDistrictView, { districtId }, signal),
  });
export const adoptionReviewQuery = (session: AuthSession, token: string) =>
  queryOptions({
    queryKey: keyFor(session, "adoption-review", token.slice(-8)),
    retry: false,
    queryFn: ({ signal }) =>
      post(session, "review", adoptionReview, { token }, signal),
  });
export const adoptionCleverQuery = (
  session: AuthSession,
  token: string,
  connectionId: string,
  schoolId?: string,
) =>
  queryOptions({
    queryKey: keyFor(
      session,
      "adoption-clever",
      token.slice(-8),
      connectionId,
      schoolId ?? "",
    ),
    enabled: !!connectionId,
    retry: false,
    queryFn: ({ signal }) =>
      post(
        session,
        "clever-preview",
        adoptionCleverPreview,
        { token, connectionId, schoolId },
        signal,
      ),
  });
export const issueAdoption = (
  session: AuthSession,
  schoolId: string,
  districtId: string,
) =>
  post(session, "issue", adoptionIssued, {
    schoolId,
    districtId,
    confirmed: true,
  });
export const acceptAdoption = (
  session: AuthSession,
  token: string,
  decisions: z.input<typeof adoptionDecisions>,
) =>
  post(session, "accept", adoptionAccepted, {
    token,
    ...decisions,
    confirmed: true,
  });
export const revokeAdoption = (session: AuthSession, id: string) =>
  post(session, "revoke", z.object({ revoked: z.literal(true) }), { id });
