import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { publicProblemSchema } from "../../../math/contracts";
import { annualOfferSchema } from "../../../billing/stripe/enrollment-contracts";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { queryClient } from "../../lib/query";
import {
  clearStoredTrial,
  storedTrial,
  trialKey,
} from "../../lib/pending-trial";
import { learningCatalog } from "../../learning-transport";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import type { TrialCatalog } from "./types";

/** The free trial is anonymous: a random device token, a nameless learner
 * and a birth year. Nothing here identifies a child or links an account. */
const estimate = z.object({
  level: z.number(),
  sd: z.number(),
  answered: z.number(),
  independent: z.number(),
});
const frontierSchema = z.object({
  expected: z.number(),
  overall: estimate,
  strands: z.record(z.string(), estimate),
});
export type TrialFrontier = z.infer<typeof frontierSchema>;
export const progressSchema = z.object({
  phase: z.enum(["placement", "practice", "complete"]),
  free: z.number().int(),
  placement: z.number().int(),
  remaining: z.number().int(),
  totals: z.object({
    answered: z.number().int(),
    correct: z.number().int(),
    assisted: z.number().int(),
  }),
  mastered: z.array(z.string()),
  frontier: z.object({
    placement: frontierSchema.nullable(),
    current: frontierSchema,
  }),
});
export type TrialProgress = z.infer<typeof progressSchema>;
const batchSchema = z.object({
  problems: z.array(publicProblemSchema),
  trialRemaining: z.number().int().optional(),
});
export const outcomeSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  requestId: z.string(),
  skillId: z.string(),
  templateId: z.string(),
  correct: z.boolean(),
  assisted: z.boolean(),
  response: z.string(),
  explanation: z.array(z.string()),
  answer: z.string(),
  createdAt: z.string(),
  mastered: z.object({ skillId: z.string(), title: z.string() }).optional(),
});
export type TrialOutcome = z.infer<typeof outcomeSchema>;

/** The device's trial: its token and nameless learner, or null. */
export type TrialSession = { token: string; learnerId: string };
export const trialSessionOptions = queryOptions({
  queryKey: ["trial", "session"],
  queryFn: async ({ signal }): Promise<TrialSession | null> => {
    const token = storedTrial();
    if (!token) return null;
    try {
      const { learners } = await request(
        "/learners",
        z.object({ learners: z.array(z.object({ id: z.string() })) }),
        { trial: token, signal },
      );
      return learners[0] ? { token, learnerId: learners[0].id } : null;
    } catch (error) {
      // An expired or saved trial no longer authenticates: start fresh.
      if (error instanceof AppError && error.kind === "authentication") {
        clearStoredTrial();
        return null;
      }
      throw error;
    }
  },
  staleTime: Infinity,
  // Without a stored token there is nothing to look up: the start screen
  // paints on the first frame instead of a skeleton.
  initialData: () => (storedTrial() ? undefined : null),
});
export const progressOptions = (session: TrialSession) =>
  queryOptions({
    queryKey: ["trial", session.learnerId, "progress"],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(session.learnerId)}/trial-progress`,
        progressSchema,
        { trial: session.token, signal },
      ),
  });
export const catalogOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: async (): Promise<TrialCatalog> => {
    try {
      return await learningCatalog();
    } catch (cause) {
      const error = new AppError(
        "unavailable",
        "Practice could not be loaded. Check your connection and try again.",
        true,
      );
      error.log();
      throw error;
    }
  },
  staleTime: Infinity,
});
/** Configured prices for the paywall; no account is needed to read them. */
export const pricesOptions = queryOptions({
  queryKey: ["billing", "prices"],
  queryFn: ({ signal }) =>
    request(
      "/billing/prices",
      z.object({
        available: z.boolean(),
        offers: z.array(annualOfferSchema),
      }),
      { signal },
    ),
  staleTime: 5 * 60_000,
});

export async function startTrial(birthYear: number): Promise<TrialSession> {
  const created = await request(
    "/trials",
    z.object({ token: z.string(), learnerId: z.string() }),
    { body: { birthYear } },
  );
  try {
    localStorage.setItem(trialKey, created.token);
  } catch (failure) {
    console.warn("Free practice token not saved on this device", failure);
  }
  const session = { token: created.token, learnerId: created.learnerId };
  queryClient.setQueryData(trialSessionOptions.queryKey, session);
  return session;
}
/** The next adaptive problem, or "complete" when the allowance is used. */
export async function nextProblem(session: TrialSession) {
  try {
    return await request(
      `/learners/${encodeURIComponent(session.learnerId)}/batches`,
      batchSchema,
      {
        trial: session.token,
        body: {
          count: 1,
          responseCapabilities: ["single-choice-v1"],
          figureCapabilities: ["measurement-models-v1", "data-displays-v1"],
        },
      },
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "trial-complete")
      return "complete" as const;
    throw error;
  }
}
export function answer(
  session: TrialSession,
  input: { problemId: string; requestId: string; response: string },
) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/attempts`,
    outcomeSchema,
    { trial: session.token, body: input },
  );
}
export function hint(session: TrialSession, problemId: string) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/hints`,
    z.object({ hint: z.string() }),
    { trial: session.token, body: { problemId } },
  );
}
export function lessonSupport(session: TrialSession, problemId: string) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/lesson-support`,
    z.object({ lesson: z.custom<ProblemLessonView>((value) => !!value) }),
    { trial: session.token, body: { problemId } },
  );
}
export function recordPaywall(session: TrialSession) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/trial-paywall`,
    z.object({ recorded: z.literal(true) }),
    { trial: session.token, body: {} },
  );
}
/** Answers change the meter, the map and the paywall summary. */
export function invalidateProgress(session: TrialSession) {
  return queryClient.invalidateQueries({
    queryKey: ["trial", session.learnerId],
  });
}
/** The trial ended on the server (expired or saved): forget it here. */
export function forgetTrial() {
  clearStoredTrial();
  queryClient.removeQueries({ queryKey: ["trial"] });
  queryClient.setQueryData(trialSessionOptions.queryKey, null);
}
