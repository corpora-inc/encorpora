import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { plainName, timezone } from "../../../../schools/contracts";
import { AppError } from "../../../lib/AppError";

export type ConnectionCredential = {
  token: string;
  accountId: string;
  onboarding?: boolean;
};
export const connectionStatusSchema = z.object({
  enabled: z.boolean(),
  signInUrl: z.literal("/api/v1/school/sso/clever/start"),
  districtSignupUrl: z.url().nullable(),
  existingSchools: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .default([]),
  identity: z
    .object({
      districtId: z.string(),
      roles: z.array(z.string()),
      personId: z.string().nullable(),
    })
    .nullable(),
  connection: z
    .object({
      id: z.uuid(),
      orgId: z.uuid(),
      status: z.enum(["active", "disconnected"]),
      syncPaused: z.boolean().default(false),
      lastSyncAt: z.iso.datetime({ offset: true }).nullable(),
      launchDate: z.string().nullable(),
      lastError: z.string().nullable(),
      syncing: z.boolean(),
    })
    .nullable(),
  requests: z.array(
    z.object({
      id: z.uuid(),
      method: z.enum(["clever", "anyschool"]),
      status: z.enum(["requested", "invited", "connected", "closed"]),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
});
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export const connectInstitutionSchema = z.strictObject({
  signerName: plainName,
  signerTitle: plainName,
  agreementVersion: z.literal(AGREEMENT_VERSION),
  authorized: z.literal(true),
  timezone,
  importNow: z.boolean().optional(),
});
const messages: Record<string, string> = {
  clever_link_expired:
    "The sign-in used to link Clever expired. Sign in again, then retry linking from this page.",
  reauth_required:
    "Sign in again to confirm that Clever should link to this AMP account.",
  clever_identity_already_linked:
    "That Clever sign-in already belongs to another AMP account. Use that account, or contact support to review the connection. Your accounts have not been merged.",
  clever_sign_in_required:
    "Sign in with Clever to confirm your school connection.",
  sign_in_required: "Your connection session ended. Sign in with Clever again.",
  clever_district_admin_required:
    "A Clever district administrator must authorize this connection. You can start your own class while they do that.",
  clever_unconfigured:
    "Clever setup is being prepared. You can start your class directly or request a connection.",
  clever_http_403:
    "Clever has not granted AMP access to this roster. Ask your Clever administrator to check the app’s sharing settings, then retry.",
  district_not_authorized:
    "This district has not authorized AMP in Clever. Ask your Clever administrator to connect AMP, then sign in again.",
  clever_sync_already_running:
    "Your roster is already syncing. This page will update when it finishes.",
  clever_institution_agreement_required:
    "An authorized district administrator must accept the student data agreement before this roster can sync.",
  confirm_email:
    "Confirm your AMP email address before submitting a connection request.",
  request_origin_invalid: "Open AMP in a new tab and try again.",
};
export function connectionError(code: string | null | undefined) {
  return code
    ? (messages[code] ??
        "The roster did not finish syncing. Retry, or contact support@corpora.inc if it happens again.")
    : "";
}
/** An onboarding proof is deliberately isolated from ordinary app auth. A
 * rejected proof must never sign out or replace another account's session. */
async function connectionCall<T>(
  path: string,
  schema: z.ZodType<T>,
  credential: ConnectionCredential,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (
    credential.onboarding &&
    path !== "/clever/status" &&
    path !== "/clever/connect"
  )
    throw new AppError(
      "permission",
      "Sign in with Clever again to open your district and continue setup.",
      false,
    );
  let response: Response;
  try {
    response = await fetch(`/api/v1/school${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: credential.onboarding ? "omit" : "same-origin",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${credential.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AppError("network", "Check your connection and try again.", true);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "";
    throw new AppError(
      response.status === 401
        ? "authentication"
        : response.status === 403
          ? "permission"
          : response.status >= 500
            ? "unavailable"
            : "validation",
      messages[code] ??
        (response.status >= 500
          ? "The connection service is unavailable. Try again in a moment."
          : "The request did not go through. Check the details and try again."),
      response.status >= 500,
      response.headers.get("x-request-id"),
      code,
      response.status,
    );
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new AppError(
      "contract",
      "The service returned incomplete connection details. Try again.",
      true,
    );
  return parsed.data;
}
export const connectionOptions = (credential: ConnectionCredential) =>
  queryOptions({
    queryKey: [
      "school-connection",
      credential.accountId,
      credential.onboarding ? "onboarding" : "account",
    ],
    queryFn: ({ signal }) =>
      connectionCall(
        "/clever/status",
        connectionStatusSchema,
        credential,
        undefined,
        signal,
      ),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.connection?.syncing ||
      (query.state.data?.connection?.status === "active" &&
        !query.state.data.connection.lastSyncAt &&
        !query.state.data.connection.lastError &&
        !query.state.data.connection.syncPaused)
        ? 3000
        : false,
  });
export const connectionApi = {
  link: (credential: ConnectionCredential) =>
    connectionCall(
      "/sso/clever/link",
      z.object({
        url: z.url().refine((value) => {
          const url = new URL(value);
          return (
            url.origin === "https://clever.com" &&
            url.pathname === "/oauth/authorize"
          );
        }),
      }),
      credential,
      {},
    ),
  connect: (
    credential: ConnectionCredential,
    body: z.infer<typeof connectInstitutionSchema>,
  ) =>
    connectionCall(
      "/clever/connect",
      z.object({
        connectionId: z.uuid(),
        orgId: z.uuid(),
        status: z.enum(["syncing", "ready_to_import"]),
      }),
      credential,
      connectInstitutionSchema.parse(body),
    ),
  sync: (credential: ConnectionCredential) =>
    connectionCall(
      "/clever/sync",
      z.object({ status: z.literal("syncing") }),
      credential,
      {},
    ),
  request: (
    credential: ConnectionCredential,
    body: {
      institutionName: string;
      contactEmail: string;
      method: "clever" | "anyschool";
      orgId?: string;
    },
  ) =>
    connectionCall(
      "/connection-requests",
      z.object({
        id: z.uuid(),
        status: z.enum(["requested", "invited", "connected", "closed"]),
        next: z.literal("provider_invitation"),
        manualStartUrl: z.literal("/school/start"),
      }),
      credential,
      body,
    ),
};
