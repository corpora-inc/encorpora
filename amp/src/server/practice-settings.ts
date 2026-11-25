import { isDeepStrictEqual } from "node:util";
import { skills } from "../curriculum/catalog";
import { historicalTemplates } from "../math/historical-templates";
import { templates } from "../math/engine";
import { allowsColorful } from "../learning/practice-settings";
import type {
  PracticeChange,
  PracticeSettings,
  PracticeState,
} from "../learning/practice-settings";
import { resolveLook, startingLook } from "../learning/look";
import { completedGrade } from "../learning/starting-point";
import { pointsOf } from "../learning/points";
import { strandEstimate, targetGrade } from "../learning/frontier";
import {
  ApiError,
  type LearnerTransaction,
  type PracticeChangeSource,
} from "./repository";
import { templateGrade } from "./mixed-practice";

/** The look that applies now, whether it is locked and by whom. */
async function lookOf(tx: LearnerTransaction, settings: PracticeSettings) {
  // Their grade by age, as everywhere (K is 0); an adult has none.
  const birthYear = (await tx.isAdult()) ? null : await tx.birthYear();
  return resolveLook({
    own: settings.look,
    ownOff: !allowsColorful(settings),
    classes: await tx.classLooks(),
    starting: startingLook(
      birthYear === null ? null : Math.max(0, completedGrade(birthYear) + 1),
    ),
  });
}

/** The settings with the look that applies now, whether a class locked it,
 * and the learner's points. */
export async function practiceState(
  tx: LearnerTransaction,
  settings: PracticeSettings,
): Promise<PracticeState> {
  // One transaction, one connection: one query after the other.
  const { look, locked, lockedBy } = await lookOf(tx, settings);
  const evidence = await tx.skillEvidence();
  return {
    ...settings,
    effectiveLook: look,
    lookLocked: locked,
    lookLockedBy: lockedBy,
    points: pointsOf(evidence),
  };
}

const nodes = new Map(skills.map((s) => [s.id, s]));

/** Called inside the learner's locked transaction. Receipts make retries safe;
 * a revision prevents a second tab from silently replacing a newer choice. */
export async function changePractice(
  tx: LearnerTransaction,
  change: PracticeChange,
  /** Whose sign-in made it (`PracticeChangeSource`). */
  madeIn?: PracticeChangeSource,
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
    // An adult starts again from where they chose to begin.
    if ((await tx.birthYear()) === null && !(await tx.isAdult()))
      throw new ApiError(409, "Choose the learner’s birth year first.");
    next.epoch++;
    // A practice profile starts again at its own levels; anyone else from
    // where they began.
    if (!(await tx.isSimulation())) next.strandStarts = {};
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
    const template = [...templates, ...historicalTemplates].find(
      (t) => t.id === problem.public.templateId,
    );
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
  } else if (change.kind === "gradeLevel") {
    // Display only: practice, levels and evidence are unchanged.
    next.gradeLevelShown = change.shown;
  } else if (change.kind === "lookHue") {
    // Display only. The color a learner keeps in Colorful, or (null) lets
    // move on with every problem: theirs, whoever holds the look itself.
    next.lookHue = change.hue;
  } else if (change.kind === "look") {
    // Display only, like the grade level, and the learner's own: Calm or
    // Colorful, or (null) where their age starts. Colorful can't be chosen
    // while an adult has it off, by a class above or for this child; the
    // choice they had is kept for when it is allowed again.
    if (change.look === "bold") {
      const { lockedBy } = await lookOf(tx, previous);
      if (lockedBy === "class")
        throw new ApiError(409, "Your class turned Colorful off.");
      if (lockedBy === "adult")
        throw new ApiError(409, "A parent turned Colorful off.");
    }
    next.look = change.look;
  } else if (change.kind === "allowColorful") {
    // A grown-up's switch for the child (the route refuses a student's
    // session). A class above that has it off holds it for everyone.
    const now = await lookOf(tx, previous);
    if (now.lockedBy === "class")
      throw new ApiError(409, "The class turned Colorful off.");
    next.colorfulAllowed = change.allowed;
    // The lock that came before the switch is spent: the switch is the
    // one record from here on.
    next.lookAdultLock = false;
  } else {
    if (change.skillId && !templates.some((t) => t.skillId === change.skillId))
      throw new ApiError(400, "This skill has no practice problems.");
    next.focusSkillId = change.skillId;
  }
  await tx.savePracticeChange(change, next, madeIn);
  // A reset's level is today's at once (answered 0, from the starting
  // point), so the child's page and every record read it now, not after the
  // next batch is planned (`levels` reads from the last reset on).
  if (change.kind === "reset") await tx.saveLevelDay(await tx.frontier());
  return next;
}
