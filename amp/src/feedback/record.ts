import { randomUUID } from "node:crypto";
import { ApiError, type LearnerTransaction } from "../server/repository";
import {
  ALREADY_REPORTED,
  noteAllowed,
  type FlagOutcome,
  type ProblemFlag,
  type ProblemFlagInput,
} from "./problem-flags";

/**
 * Saves a learner's report on a problem they resolved. Everything about the
 * problem and the answer is read from the server's own records; the client
 * supplies only reasons, an optional note and its build and viewport.
 * A retried request returns the report it already saved.
 */
export async function recordProblemFlag(
  tx: LearnerTransaction,
  input: ProblemFlagInput,
  context: { trial: boolean; apiCommit: string | null },
): Promise<{ id: string; recorded: true }> {
  const retry = await tx.flag({ requestId: input.requestId });
  if (retry) return { id: retry.id, recorded: true };
  const problem = await tx.problem(input.problemId);
  if (!problem) throw new ApiError(404, "Problem not found");
  if (await tx.flag({ problemId: input.problemId }))
    throw new ApiError(409, ALREADY_REPORTED);
  const attempt = await tx.attemptByProblem(input.problemId);
  // A report follows the result: an answer, or a skip (which has no attempt).
  if (!attempt && !input.skipped)
    throw new ApiError(409, "Answer or skip this problem before reporting it");
  const note = input.note?.trim() || null;
  if (
    note &&
    !noteAllowed({ trial: context.trial, birthYear: await tx.birthYear() })
  )
    throw new ApiError(400, "Notes are not available for this learner");
  const outcome: FlagOutcome = attempt
    ? attempt.correct
      ? "correct"
      : "incorrect"
    : "skipped";
  const flag: ProblemFlag = {
    id: randomUUID(),
    requestId: input.requestId,
    problemId: problem.public.id,
    templateId: problem.public.templateId,
    templateVersion: problem.public.templateVersion,
    seed: problem.public.seed,
    skillId: problem.public.skillId,
    prompt: problem.public.prompt,
    figureKind: problem.public.figure?.kind ?? null,
    responseKind: problem.public.response.kind,
    response: attempt?.response ?? null,
    outcome,
    assisted: attempt?.assisted ?? false,
    reasons: input.reasons,
    note,
    webCommit: input.webCommit ?? null,
    apiCommit: context.apiCommit,
    clientKind: input.client.kind,
    viewport: input.client.viewport,
  };
  await tx.saveFlag(flag);
  return { id: flag.id, recorded: true };
}
