import { queryOptions } from "@tanstack/react-query";
import {
  classStandingResponse,
  orgStandingResponse,
} from "../../../../schools/standing-contracts";
import type { AuthSession } from "../../../auth";
import { call, keyFor } from "../api";

/** A school's or district's curves, shared by the overview's section and the
 * drill, so opening the drill paints from what the overview already read. */
export const orgStandingOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "standing"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/standing`, orgStandingResponse, session, {
        signal,
      }),
  });
export const classStandingOptions = (session: AuthSession, classId: string) =>
  queryOptions({
    queryKey: keyFor(session, "class", classId, "standing"),
    queryFn: ({ signal }) =>
      call(`/classes/${classId}/standing`, classStandingResponse, session, {
        signal,
      }),
  });
