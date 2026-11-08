import { prepareTrialIntroduction } from "./introduction";
import { accessSession, authConfig } from "../../auth";
import { queryOptions } from "@tanstack/react-query";
import { problemHintSchema, withProblemHints } from "../../lib/problem-hints";
import { glossaryPayloadShape } from "../../lib/glossary-payload";
import { z } from "zod";
import {
  figureCapabilities,
  publicProblemSchema,
} from "../../../math/contracts";
import { annualOfferSchema } from "../../../billing/stripe/enrollment-contracts";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import {
  batchWithCapabilityFallback,
  clientResponseCapabilities,
} from "../../lib/batch-capability-fallback";
import { queryClient, sessionOptions } from "../../lib/query";
import {
  clearStoredTrial,
  storedTrial,
  trialKey,
} from "../../lib/pending-trial";
import { learningCatalog } from "../../learning-transport";
import { isStudentDevice } from "../../lib/student-device";
import { answerProgressSchema } from "../practice/answer-progress";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import type { TrialCatalog } from "./types";
import {
  ALREADY_REPORTED,
  type ProblemFlagInput,
} from "../../../feedback/problem-flags";
import type { ReportResult } from "../../ProblemFlag";
import {
  workbookPapers,
  workbookSummarySchema,
  type WorkbookPaper,
} from "../../../workbook/contracts";
import { downloadTrialWorkbook, workbookPath } from "../workbooks/api";
import { defaultWorkbookChoices, localDate } from "../workbooks/model";

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
  adaptive: estimate.optional(),
  strandPriorSd: z.number().finite().positive().optional(),
});
export type TrialFrontier = z.infer<typeof frontierSchema>;
/** The free workbooks: one immediately, then every 20 problems; those made (oldest
 * first), and whether downloads are PDFs (learning/trial-workbooks.ts). */
const trialWorkbooksSchema = z.object({
  total: z.number().int(),
  earned: z.number().int(),
  made: z.number().int(),
  available: z.number().int(),
  nextAt: z.number().int().nullable(),
  pdf: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      number: z.number().int(),
      paper: z.enum(workbookPapers),
    }),
  ),
});
export type TrialWorkbooks = z.infer<typeof trialWorkbooksSchema>;
export const progressSchema = z.object({
  phase: z.enum(["placement", "practice", "complete"]),
  free: z.number().int(),
  placement: z.number().int(),
  remaining: z.number().int(),
  totals: z.object({
    answered: z.number().int(),
    correct: z.number().int(),
    assisted: z.number().int(),
    skipped: z.number().int().optional(),
  }),
  mastered: z.array(z.string()),
  frontier: z.object({
    placement: frontierSchema.nullable(),
    current: frontierSchema,
  }),
  /** The overall estimate over the run (learning/level-check.ts). */
  trend: z
    .array(
      z.object({
        answered: z.number().int(),
        level: z.number(),
        sd: z.number(),
      }),
    )
    .default([]),
  workbooks: trialWorkbooksSchema.optional(),
});
export type TrialProgress = z.infer<typeof progressSchema>;
const batchSchema = z
  .object({
    problems: z.array(publicProblemSchema),
    trialRemaining: z.number().int().optional(),
    hints: z.record(z.string(), problemHintSchema).optional(),
  })
  .transform(withProblemHints);
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
  skipped: z.literal(true).optional(),
  parts: z.array(z.boolean()).max(6).optional(),
  ...glossaryPayloadShape,
});
export type TrialOutcome = z.infer<typeof outcomeSchema>;

export function answerProgress(session: TrialSession, skillId: string) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/progress?skill=${encodeURIComponent(skillId)}`,
    answerProgressSchema,
    { trial: session.token },
  );
}

/** The device's trial: its token and nameless learner, or null. The birth
 * year stays in memory, for the level check's "about 10". */
export type TrialSession = {
  token: string;
  learnerId: string;
  birthYear?: number | null;
  expiresAt?: string;
};
export const trialSessionOptions = queryOptions({
  queryKey: ["trial", "session"],
  queryFn: async ({ signal }): Promise<TrialSession | null> => {
    // This runs at the root; a student has no trial and can't ask about one.
    if (isStudentDevice()) return null;
    const token = storedTrial();
    if ((await authConfig()).mode !== "development") {
      // The session the app already holds; asking the server again would
      // fetch the same session twice on every screen.
      const parent = await queryClient.ensureQueryData(sessionOptions);
      signal.throwIfAborted();
      if (!parent) return null;
      const result = await request(
        "/trials/current",
        z.object({
          trial: z
            .object({
              token: z.string(),
              learnerId: z.string(),
              birthYear: z.number().nullable(),
              expiresAt: z.string(),
            })
            .nullable(),
        }),
        { token: parent.token, body: { ...(token ? { token } : {}) }, signal },
      );
      signal.throwIfAborted();
      try {
        if (result.trial) localStorage.setItem(trialKey, result.trial.token);
        else clearStoredTrial();
      } catch {
        /* Account resume does not depend on browser storage. */
      }
      return result.trial;
    }
    if (!token) return null;
    try {
      const { learners } = await request(
        "/learners",
        z.object({
          learners: z.array(
            z.object({
              id: z.string(),
              birthYear: z.number().int().nullable().optional(),
            }),
          ),
        }),
        { trial: token, signal },
      );
      return learners[0]
        ? {
            token,
            learnerId: learners[0].id,
            birthYear: learners[0].birthYear ?? null,
          }
        : null;
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
        extraOffers: z.array(annualOfferSchema).optional(),
      }),
      { signal },
    ),
  staleTime: 5 * 60_000,
});

export async function startTrial(birthYear: number): Promise<TrialSession> {
  const owner = await accessSession();
  const created = await request(
    "/trials",
    z.object({
      token: z.string(),
      learnerId: z.string(),
      birthYear: z.number().optional(),
      expiresAt: z.string().optional(),
    }),
    { token: owner?.token, body: { birthYear } },
  );
  if ((await accessSession())?.accountId !== owner?.accountId) {
    throw new AppError(
      "authentication",
      "Your account changed. Open free practice again.",
      true,
    );
  }
  try {
    localStorage.setItem(trialKey, created.token);
  } catch (failure) {
    console.warn("Free practice token not saved on this device", failure);
  }
  const session = {
    token: created.token,
    learnerId: created.learnerId,
    birthYear: created.birthYear ?? birthYear,
    expiresAt: created.expiresAt,
  };
  prepareTrialIntroduction(session.learnerId);
  queryClient.setQueryData(trialSessionOptions.queryKey, session);
  return session;
}
/** The next adaptive problem, or "complete" when the allowance is used. */
export async function nextProblem(
  session: TrialSession,
  templateId?: string,
  recoveryStrand?: string,
) {
  try {
    const storedToken = storedTrial();
    return await batchWithCapabilityFallback(
      {
        count: 1,
        ...(templateId ? { templateId } : {}),
        ...(recoveryStrand ? { recoveryStrand } : {}),
        responseCapabilities: [...clientResponseCapabilities],
        figureCapabilities: [...figureCapabilities],
      },
      (body) =>
        request(
          `/learners/${encodeURIComponent(session.learnerId)}/batches`,
          batchSchema,
          { trial: session.token, body },
        ),
      () =>
        (storedToken === null || storedToken === session.token) &&
        storedTrial() === storedToken,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "trial-complete")
      return "complete" as const;
    throw error;
  }
}
export function answer(
  session: TrialSession,
  input: {
    problemId: string;
    requestId: string;
    response: string;
    hintViewed?: boolean;
  },
) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/attempts`,
    outcomeSchema,
    { trial: session.token, body: input },
  );
}
/** Skip: the worked answer, as a neutral reveal (learning/skip.ts). */
export function skip(session: TrialSession, problemId: string) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/skips`,
    outcomeSchema,
    { trial: session.token, body: { problemId } },
  );
}
export function hint(session: TrialSession, problemId: string) {
  return request(
    `/learners/${encodeURIComponent(session.learnerId)}/hints`,
    problemHintSchema,
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
/** "Report a problem". A trial reports with reasons only (no note). */
export async function reportProblem(
  session: TrialSession,
  body: ProblemFlagInput,
): Promise<ReportResult> {
  try {
    await request(
      `/learners/${encodeURIComponent(session.learnerId)}/problem-flags`,
      z.object({ id: z.string(), recorded: z.literal(true) }),
      { trial: session.token, body },
    );
    return "sent";
  } catch (error) {
    if (error instanceof AppError && error.code === ALREADY_REPORTED)
      return "already";
    throw error;
  }
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

/** The next workbook being made, kept until the server answers, so a retry
 * after a lost response asks for the same date and number and gets the
 * stored workbook back instead of using another free one. */
const making = new Map<string, { date: string; number: number }>();

/** Makes the next free workbook the trial has earned (mixed areas, at
 * level, with today's idea, 30 minutes). The screens offer this only while
 * one is available; the server refuses anything beyond it. */
export async function makeTrialWorkbook(
  session: TrialSession,
  paper: WorkbookPaper,
) {
  let target = making.get(session.learnerId);
  if (!target) {
    const { workbooks } = await queryClient.fetchQuery({
      ...progressOptions(session),
      staleTime: 0,
    });
    const date = localDate();
    const today = (workbooks?.items ?? []).filter((w) => w.date === date);
    target = {
      date,
      number: Math.max(0, ...today.map((w) => w.number)) + 1,
    };
    making.set(session.learnerId, target);
  }
  try {
    const made = await request(
      workbookPath(session.learnerId),
      workbookSummarySchema,
      {
        trial: session.token,
        body: {
          ...target,
          minutes: 30,
          paper,
          choices: defaultWorkbookChoices,
        },
      },
    );
    making.delete(session.learnerId);
    return made;
  } catch (error) {
    // Only a lost or failed delivery retries the same workbook.
    if (
      !(error instanceof AppError) ||
      !["network", "unavailable"].includes(error.kind)
    )
      making.delete(session.learnerId);
    throw error;
  } finally {
    // Only the free run's totals change; the open feedback keeps its data.
    void queryClient.invalidateQueries({
      queryKey: progressOptions(session).queryKey,
    });
  }
}

/** Downloads one of the trial's own workbooks: the PDF when the server
 * renders them, otherwise the printable document. */
export async function downloadAssessmentWorkbook(
  session: TrialSession,
  workbook: { id: string; date: string; number: number },
  paper: WorkbookPaper,
) {
  const cached = queryClient.getQueryData(
    progressOptions(session).queryKey,
  )?.workbooks;
  const pdf =
    cached?.pdf ??
    (
      await queryClient.fetchQuery({
        ...progressOptions(session),
        staleTime: 0,
      })
    ).workbooks?.pdf ??
    false;
  await downloadTrialWorkbook(
    session.token,
    session.learnerId,
    workbook,
    paper,
    pdf,
  );
}
