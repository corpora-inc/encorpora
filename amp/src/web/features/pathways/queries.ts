import { queryOptions } from "@tanstack/react-query";
import { request } from "../../lib/api";
import { progressSchema } from "./model";
import type { TrialSession } from "../trial/api";
export const trialEvidenceOptions = (session: TrialSession) =>
  queryOptions({
    queryKey: ["trial", session.learnerId, "atlas"],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(session.learnerId)}/progress`,
        progressSchema,
        { trial: session.token, signal },
      ),
    refetchInterval: 30_000,
  });
