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
    "Clever couldn’t confirm you’re a district admin. Sign in with Clever again.",
  adoption_source_authority_required:
    "Only the school’s admin can approve this.",
  adoption_source_authority_changed:
    "The school’s admin changed. Ask them for a new approval.",
  adoption_destination_authority_required:
    "Sign in as an admin of the district.",
  adoption_needs_standalone_school:
    "This school already belongs to a district.",
  adoption_expired_or_revoked:
    "This approval expired or was withdrawn. Ask the school for a new one.",
  adoption_already_used: "This approval was already used.",
  adoption_not_found: "This link is incomplete. Open the full link.",
  adoption_conflicts_require_review:
    "Some records need a review. Nothing moved. Contact support@corpora.inc.",
  adoption_staff_match_invalid:
    "These staff records can’t be combined. Refresh and review again.",
  adoption_clever_already_imported:
    "This Clever roster is already imported. Keep the existing roster.",
  adoption_clever_school_already_bound:
    "Clever already has a different school record. Nothing moved. Contact support@corpora.inc.",
  adoption_clever_identity_already_bound:
    "A Clever record already belongs to someone else in AMP. Nothing moved. Contact support@corpora.inc.",
  adoption_clever_incomplete_match:
    "Match every person and class, or keep the existing roster.",
  adoption_clever_roster_mismatch:
    "A class doesn’t match its Clever section. Check the section you chose.",
  adoption_clever_role_mismatch:
    "Match students to students and staff to staff.",
  adoption_clever_duplicate_match:
    "Each Clever person and section can be chosen once.",
  adoption_clever_review_unavailable:
    "Clever matching is unavailable. Keep the existing roster, or try again later.",
  clever_institution_agreement_required:
    "The district accepts the student data agreement first.",
  request_origin_invalid: "Refresh this page and try again.",
};
export function adoptionError(error: unknown) {
  return error instanceof AppError
    ? (messages[error.code ?? ""] ?? error.message)
    : "That didn’t save. Try again.";
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
