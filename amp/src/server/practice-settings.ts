import { isDeepStrictEqual } from "node:util";
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import type { PracticeChange } from "../learning/practice-settings";
import { strandEstimate, targetGrade } from "../learning/frontier";
import { ApiError, type LearnerTransaction } from "./repository";
import { templateGrade } from "./mixed-practice";

const nodes = new Map(skills.map((s) => [s.id, s]));

/** Called inside the learner's locked transaction. Receipts make retries safe;
 * a revision prevents a second tab from silently replacing a newer choice. */
export async function changePractice(
  tx: LearnerTransaction,
  change: PracticeChange,
) {
  const receipt = await tx.practiceChange(change.requestId);
  if (receipt) {
    if (!isDeepStrictEqual(receipt.change, change))
      throw new ApiError(
        409,
        "This request was already used for another change.",
      );
    return tx.practiceSettings();
  }
  const previous = await tx.practiceSettings();
  if (change.revision !== previous.revision)
    throw new ApiError(
      409,
      "Practice changed on another device. Reopen the menu and try again.",
    );
  const next = { ...previous, revision: previous.revision + 1 };
  if (change.kind === "reset") {
    if ((await tx.birthYear()) === null)
      throw new ApiError(409, "Choose the learner’s birth year first.");
    next.epoch++;
    next.strandStarts = {};
    next.focusSkillId = null;
  } else if (change.kind === "easier") {
    const problem = await tx.problem(change.problemId);
    if (!problem?.skipped)
      throw new ApiError(
        409,
        "Skip this problem before choosing easier practice.",
      );
    if ((problem.practiceEpoch ?? 0) !== previous.epoch)
      throw new ApiError(
        409,
        "The practice level has already changed. Continue with a new problem.",
      );
    const template = templates.find((t) => t.id === problem.public.templateId);
    const frontier = await tx.frontier();
    const strand = nodes.get(problem.public.skillId)?.strand ?? "math";
    if (
      (problem.practiceRevision ?? 0) <
      (previous.strandStarts[strand]?.revision ?? 0)
    )
      throw new ApiError(
        409,
        "This area already has a fresh starting point. Continue with a new problem.",
      );
    const target = targetGrade(strandEstimate(frontier, strand));
    const working = Math.min(
      target,
      frontier.confirmation?.[strand]?.level ??
        frontier.unconfirmedCeiling ??
        target,
    );
    const level = Math.max(
      0,
      Math.min(
        12,
        working - 1,
        template ? templateGrade(template, nodes) - 1 : working - 1,
      ),
    );
    next.strandStarts = {
      ...previous.strandStarts,
      [strand]: { level, revision: next.revision },
    };
    next.focusSkillId = null;
  } else if (change.kind === "together") {
    next.workingTogether = change.enabled;
    if (change.problemId) {
      const problem = await tx.problem(change.problemId);
      if (!problem) throw new ApiError(404, "Problem not found");
      // Turning assistance off cannot turn a helped open problem into an
      // independent success. This flag never enters the public problem payload.
      if (previous.workingTogether || change.enabled) {
        problem.workingTogether = true;
        await tx.saveProblem(problem);
      }
    }
  } else {
    if (change.skillId && !templates.some((t) => t.skillId === change.skillId))
      throw new ApiError(400, "This skill has no practice problems.");
    next.focusSkillId = change.skillId;
  }
  await tx.savePracticeChange(change, next);
  return next;
}
