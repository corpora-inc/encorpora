import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  buyerHandoffSchema,
  pilotStateSchema,
  schoolPurchaseSchema,
  startSchoolClassSchema,
  type StartSchoolClass,
} from "../../../../schools/pilot-contracts";
import type { AuthSession } from "../../../auth";
import { call, keyFor, orgOptions, preload } from "../api";
import { absoluteBuyerUrl } from "./buyer-url";
const buyerUrlSchema = z.string().transform((value, context) => {
  try {
    return absoluteBuyerUrl(value, window.location.origin);
  } catch {
    context.addIssue({ code: "custom", message: "Invalid buyer link" });
    return z.NEVER;
  }
});

const classAuthorizationSchema = z.object({
  authorization: z
    .object({
      signerName: z.string(),
      signerTitle: z.string(),
      acceptedAt: z.string(),
      version: z.string(),
    })
    .nullable(),
});
export const classAuthorizationOptions = (
  session: AuthSession,
  orgId: string,
) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "class-authorization"),
    queryFn: ({ signal }) =>
      call(
        `/orgs/${orgId}/class-authorization`,
        classAuthorizationSchema,
        session,
        { signal },
      ),
  });
export const pilotOptions = (session: AuthSession, classId: string) =>
  queryOptions({
    queryKey: keyFor(session, "class", classId, "pilot"),
    queryFn: ({ signal }) =>
      call(`/classes/${classId}/pilot`, pilotStateSchema, session, { signal }),
  });
export async function preloadClassPilot(
  session: AuthSession,
  orgId: string,
  classId: string,
) {
  const org = (await preload(orgOptions(session, orgId))) as
    | { kind?: string; demo?: boolean; teaches?: string[]; can?: string[] }
    | undefined;
  // As `useClassAccess`: only for someone the server lets read it.
  if (
    org?.kind === "school" &&
    !org.demo &&
    (org.teaches?.includes(classId) || org.can?.includes("pilot.read"))
  )
    await preload(pilotOptions(session, classId));
}
const purchaseRequestSchema = z.object({
  request: z
    .object({
      id: z.uuid(),
      url: buyerUrlSchema,
      classIds: z.array(z.uuid()),
      seats: z.number().int(),
      note: z.string(),
      status: z.string(),
      createdAt: z.string(),
      expiresAt: z.string(),
      canEdit: z.boolean().default(false),
    })
    .nullable(),
});
/** The class's open buyer link, so it survives a refresh and is never
 * made twice. */
export const purchaseRequestOptions = (session: AuthSession, classId: string) =>
  queryOptions({
    queryKey: keyFor(session, "class", classId, "purchase-request"),
    queryFn: ({ signal }) =>
      call(
        `/classes/${classId}/purchase-request`,
        purchaseRequestSchema,
        session,
        { signal },
      ),
  });
export const buyerOptions = (token: string) =>
  queryOptions({
    queryKey: ["school-buyer", token],
    queryFn: ({ signal }) =>
      call("/buyer", buyerHandoffSchema, null, {
        signal,
        body: { token },
      }),
    retry: false,
  });
export const pilotApi = {
  start: (session: AuthSession, body: StartSchoolClass) =>
    call("/start", z.object({ orgId: z.uuid(), classId: z.uuid() }), session, {
      body: startSchoolClassSchema.parse(body),
    }),
  activate: (session: AuthSession, classId: string) =>
    call(`/classes/${classId}/pilot/activate`, pilotStateSchema, session, {
      body: {},
    }),
  authorize: (
    session: AuthSession,
    classId: string,
    body: {
      version: string;
      signerName: string;
      signerTitle: string;
      authorized: true;
    },
  ) =>
    call(
      `/classes/${classId}/authorization`,
      z.object({ classId: z.uuid() }),
      session,
      { body },
    ),
  purchase: (
    session: AuthSession,
    body: z.infer<typeof schoolPurchaseSchema>,
  ) =>
    call(
      "/purchase-requests",
      z.object({ id: z.uuid(), url: buyerUrlSchema }),
      session,
      { body: schoolPurchaseSchema.parse(body) },
    ),
};
