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
    { kind?: string; demo?: boolean } | undefined;
  if (org?.kind === "school" && !org.demo)
    await preload(pilotOptions(session, classId));
}
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
      z.object({ id: z.uuid(), url: z.url() }),
      session,
      { body: schoolPurchaseSchema.parse(body) },
    ),
};
