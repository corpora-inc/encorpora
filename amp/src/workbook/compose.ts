import { createHash } from "node:crypto";
import type { GradeBand } from "../curriculum/types";
import { strandEstimate, type Frontier } from "../learning/frontier";
import { templateRole } from "../learning/placement";
import type { GeneratedProblem, TemplateMetadata } from "../math/contracts";
import { generateProblem } from "../math/engine";
import type { Lesson } from "../content/lessons";
import type { SkillEvidence } from "../server/evidence";
import { templateGrade } from "../server/mixed-practice";
import { challengePool } from "./challenge-pool";
import { paperExclusions } from "./paper-exclusions";

/** A daily workbook: about 30, 45 or 60 minutes of printed work chosen from
 * one learner's evidence. The spec names every problem by template and seed,
 * so the same spec always prints the same pages, and a new seed is a new
 * workbook. Selection is a scheduling heuristic like mixed practice: it aims
 * each section at a success level, it does not certify mastery. */
export const WORKBOOK_VERSION = 1;
export const WORKBOOK_MINUTES = [30, 45, 60] as const;
export type WorkbookMinutes = (typeof WORKBOOK_MINUTES)[number];

export type SectionKind =
  "warm-up" | "lesson" | "practice" | "review" | "challenge";
/** Room to work: a short answer line, ruled space, or a large open area. */
export type WorkSpace = "answer" | "standard" | "roomy";

export interface WorkbookItem {
  templateId: string;
  templateVersion: number;
  seed: string;
  skillId: string;
  strand: string;
  /** Curriculum-grade coordinate of the template (frontier scale). */
  grade: number;
  minutes: number;
  space: WorkSpace;
}
export interface WorkbookSection {
  kind: SectionKind;
  items: WorkbookItem[];
  /** Lesson sections: the lesson taught before its guided items. */
  lessonId?: string;
}
export interface WorkbookSpec {
  version: typeof WORKBOOK_VERSION;
  /** Local calendar date the workbook is for, YYYY-MM-DD. */
  date: string;
  /** 1 for the day's first workbook; "another one" increments it. */
  number: number;
  minutes: WorkbookMinutes;
  /** Rounded working level, used only for print scale (larger type for
   * early grades). Never printed as a grade. */
  level: number;
  sections: WorkbookSection[];
}

type SkillNode = {
  id: string;
  title?: string;
  strand: string;
  gradeBand?: GradeBand;
};

/** Estimated minutes for one printed problem, by the work its response asks
 * for. Editorial estimates, to be calibrated against in-app response times. */
export function minutesFor(
  problem: GeneratedProblem,
  grade: number,
  kind: SectionKind,
): number {
  const response = problem.public.response;
  let base =
    response.kind === "structured-work"
      ? 2 + (response.open?.max ?? response.rows.length)
      : response.kind === "multi-part-choice"
        ? 1 + response.blanks.length
        : response.kind === "point-plot"
          ? 3
          : response.kind === "multi-select" ||
              response.kind === "figure-choice"
            ? 2.5
            : 1.5;
  if (problem.public.figure) base += 0.5;
  // Young children read and write slowly; high-school problems run longer.
  if (grade < 3) base *= 1.4;
  if (grade >= 9) base *= 1.3;
  if (kind === "warm-up") base *= 0.6;
  if (kind === "challenge") base *= 2.5;
  return Math.round(base * 2) / 2;
}

/** Templates that print legibly; the paper audit records any that do not. */
export function printable(template: TemplateMetadata): boolean {
  return !paperExclusions.has(template.id);
}

const budgets: Record<
  WorkbookMinutes,
  { warmUp: number; review: number; guided: number; practiceMax: number }
> = {
  30: { warmUp: 4, review: 2, guided: 2, practiceMax: 6 },
  45: { warmUp: 6, review: 3, guided: 2, practiceMax: 10 },
  60: { warmUp: 8, review: 4, guided: 3, practiceMax: 14 },
};
/** Reading a lesson card and its worked example. */
export const LESSON_READING_MINUTES = 5;

export function composeWorkbook(options: {
  templates: readonly TemplateMetadata[];
  skills: readonly SkillNode[];
  lessons: readonly Lesson[];
  frontier: Frontier;
  evidence: readonly SkillEvidence[];
  /** Templates answered most recently in the app; not repeated on paper. */
  recentTemplateIds?: readonly string[];
  date: string;
  number?: number;
  minutes?: WorkbookMinutes;
  /** Stable per learner; with date and number it fixes every choice. */
  learnerKey: string;
  now?: number;
}): WorkbookSpec {
  const minutes = options.minutes ?? 45;
  const number = options.number ?? 1;
  if (!WORKBOOK_MINUTES.includes(minutes))
    throw new Error("Invalid workbook length");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date))
    throw new Error("Invalid workbook date");
  if (!Number.isInteger(number) || number < 1 || number > 999)
    throw new Error("Invalid workbook number");
  const now = options.now ?? Date.now();
  const budget = budgets[minutes];
  const seed = `workbook:${options.learnerKey}:${options.date}:${number}`;
  const nodes = new Map(options.skills.map((s) => [s.id, s]));
  const strandOf = (t: TemplateMetadata) =>
    nodes.get(t.skillId)?.strand ?? t.skillId;
  const pool = options.templates.filter(
    (t) => printable(t) && nodes.has(t.skillId),
  );
  if (!pool.length) throw new Error("No printable templates");
  const gradeOf = new Map(pool.map((t) => [t.id, templateGrade(t, nodes)]));
  const levelOf = (strand: string) =>
    strandEstimate(options.frontier, strand).level;
  const evidence = new Map(options.evidence.map((e) => [e.skillId, e]));
  const recent = new Set(options.recentTemplateIds ?? []);
  /** Deterministic tie-breaking order, different for every workbook. */
  const rank = (key: string) =>
    createHash("sha256").update(`${seed}:${key}`).digest().readUInt32BE(0);
  const usedTemplates = new Set<string>();
  const usedSkills = new Set<string>();
  // Seeds count within each section, so one more due review never changes
  // the practice or challenge problems.
  const serial = new Map<SectionKind, number>();
  const printed = new Set<string>();

  const item = (t: TemplateMetadata, kind: SectionKind): WorkbookItem => {
    const index = serial.get(kind) ?? 0;
    serial.set(kind, index + 1);
    // A template with few variants can repeat a problem; draw again.
    let itemSeed = `${seed}:${kind}:${index}`;
    let problem = generateProblem(t.id, itemSeed);
    for (let retry = 1; retry < 8; retry++) {
      const key = `${problem.public.prompt}\u0000${problem.answer}`;
      if (!printed.has(key)) break;
      itemSeed = `${seed}:${kind}:${index}:${retry}`;
      problem = generateProblem(t.id, itemSeed);
    }
    printed.add(`${problem.public.prompt}\u0000${problem.answer}`);
    const grade = gradeOf.get(t.id)!;
    usedTemplates.add(t.id);
    usedSkills.add(t.skillId);
    // Choosing or marking on the problem needs an answer line, not a page
    // of working; typed answers get room to work.
    const marked =
      problem.public.response.kind !== "number" &&
      problem.public.response.kind !== "fraction";
    return {
      templateId: t.id,
      templateVersion: t.version,
      seed: itemSeed,
      skillId: t.skillId,
      strand: strandOf(t),
      grade,
      minutes: minutesFor(problem, grade, kind),
      space:
        kind === "challenge"
          ? "roomy"
          : kind === "warm-up" || marked
            ? "answer"
            : "standard",
    };
  };
  /** Fresh assessment templates within [lo, hi] of their strand's level, in
   * this workbook's order. Recently answered templates go last. */
  const band = (
    lo: number,
    hi: number,
    extra?: (t: TemplateMetadata) => boolean,
  ) =>
    pool
      .filter((t) => {
        if (usedTemplates.has(t.id) || usedSkills.has(t.skillId)) return false;
        if (templateRole(t.id) !== "assessment") return false;
        const offset = gradeOf.get(t.id)! - levelOf(strandOf(t));
        return offset >= lo && offset <= hi && (extra?.(t) ?? true);
      })
      .sort(
        (a, b) =>
          Number(recent.has(a.id)) - Number(recent.has(b.id)) ||
          rank(a.id) - rank(b.id),
      );
  /** Pick up to `count`, at most `perStrand` from any strand, widening the
   * band step by step when the catalog runs out (top or bottom of a course). */
  const spread = (
    count: number,
    bands: [number, number][],
    perStrand: number,
    extra?: (t: TemplateMetadata) => boolean,
  ) => {
    const chosen: TemplateMetadata[] = [];
    const perStrandCount = new Map<string, number>();
    for (const [lo, hi] of bands) {
      // Round-robin across strands so one area cannot fill a section.
      const byStrand = new Map<string, TemplateMetadata[]>();
      for (const t of band(lo, hi, extra)) {
        const strand = strandOf(t);
        if (!byStrand.has(strand)) byStrand.set(strand, []);
        byStrand.get(strand)!.push(t);
      }
      const strands = [...byStrand.keys()].sort((a, b) => rank(a) - rank(b));
      let progressed = true;
      while (chosen.length < count && progressed) {
        progressed = false;
        for (const strand of strands) {
          if (chosen.length >= count) break;
          if ((perStrandCount.get(strand) ?? 0) >= perStrand) continue;
          const next = byStrand
            .get(strand)!
            .find(
              (t) =>
                !chosen.includes(t) &&
                !chosen.some((c) => c.skillId === t.skillId),
            );
          if (!next) continue;
          chosen.push(next);
          perStrandCount.set(strand, (perStrandCount.get(strand) ?? 0) + 1);
          progressed = true;
        }
      }
      if (chosen.length >= count) break;
    }
    return chosen;
  };
  const strong = (skillId: string) => {
    const e = evidence.get(skillId);
    return !!e && e.recentIndependentCorrect >= 3;
  };

  // Today's idea: the frontier skill a lesson can move forward. Skills the
  // learner has started and not yet secured come first; then new skills at
  // the frontier. The lesson's own templates give the guided problems.
  const lessonOf = new Map<string, Lesson>();
  for (const lesson of options.lessons)
    for (const id of lesson.templateIds)
      if (!lessonOf.has(id)) lessonOf.set(id, lesson);
  const lessonCandidates = (lo: number, hi: number) =>
    band(lo, hi, (t) => lessonOf.has(t.id) && !strong(t.skillId)).sort(
      (a, b) => {
        const started = (t: TemplateMetadata) =>
          (evidence.get(t.skillId)?.attempts ?? 0) > 0 ? 0 : 1;
        const distance = (t: TemplateMetadata) =>
          Math.abs(gradeOf.get(t.id)! - levelOf(strandOf(t)) + 0.1);
        return (
          started(a) - started(b) ||
          Math.round(distance(a) * 4) - Math.round(distance(b) * 4) ||
          rank(a.id) - rank(b.id)
        );
      },
    );
  const focus =
    lessonCandidates(-0.6, 0.4)[0] ??
    lessonCandidates(-1.5, 1)[0] ??
    lessonCandidates(-13, 13)[0];
  const lessonSection: WorkbookSection | null = focus
    ? (() => {
        const lesson = lessonOf.get(focus.id)!;
        const siblings = pool.filter(
          (t) =>
            lesson.templateIds.includes(t.id) &&
            t.skillId === focus.skillId &&
            t.id !== focus.id,
        );
        const guided = [
          focus,
          ...siblings.sort((a, b) => rank(a.id) - rank(b.id)),
        ];
        const items = Array.from({ length: budget.guided }, (_, i) =>
          item(guided[i % guided.length]!, "lesson"),
        );
        return { kind: "lesson", lessonId: lesson.id, items };
      })()
    : null;

  // Warm-up: quick work the learner is close to securing or has secured,
  // then material comfortably below the strand frontier.
  const warmUpSection: WorkbookSection = {
    kind: "warm-up",
    items: spread(budget.warmUp, [[-1.5, 0.25]], 2, (t) =>
      strong(t.skillId),
    ).map((t) => item(t, "warm-up")),
  };
  warmUpSection.items.push(
    ...spread(
      budget.warmUp - warmUpSection.items.length,
      [
        [-1.75, -0.75],
        [-3, -0.5],
        [-13, 0],
      ],
      2,
    ).map((t) => item(t, "warm-up")),
  );

  // Bring it back: ideas whose spaced review is due, oldest first, on a
  // different template than last time when the skill has one.
  const due = [...options.evidence]
    .filter(
      (e) =>
        e.reviewDueAt !== null &&
        e.reviewDueAt <= now &&
        e.independentCorrect > 0 &&
        !usedSkills.has(e.skillId),
    )
    .sort((a, b) => a.reviewDueAt! - b.reviewDueAt!);
  const review: TemplateMetadata[] = [];
  for (const e of due) {
    if (review.length >= budget.review) break;
    const last = e.latestIndependent?.templateId;
    const choices = pool
      .filter(
        (t) =>
          t.skillId === e.skillId &&
          !usedTemplates.has(t.id) &&
          templateRole(t.id) === "assessment",
      )
      .sort(
        (a, b) =>
          Number(a.id === last) - Number(b.id === last) ||
          rank(a.id) - rank(b.id),
      );
    if (choices[0]) review.push(choices[0]);
  }
  const reviewSection: WorkbookSection = {
    kind: "review",
    items: review.map((t) => item(t, "review")),
  };
  if (reviewSection.items.length < budget.review)
    reviewSection.items.push(
      ...spread(
        budget.review - reviewSection.items.length,
        [
          [-2, -0.75],
          [-13, 0],
        ],
        1,
      ).map((t) => item(t, "review")),
    );

  // Challenge: just beyond reach, from the curated pool of problems with
  // several steps or a figure to reason about, in the strand with the most
  // independent evidence. The band widens step by step at the ends of the
  // catalog; only if the pool has nothing near the learner does any
  // template serve.
  const confident = [...new Set(pool.map(strandOf))].sort(
    (a, b) =>
      strandEstimate(options.frontier, b).independent -
        strandEstimate(options.frontier, a).independent || rank(a) - rank(b),
  );
  // The three most practiced strands share the challenge, so it changes
  // from day to day instead of repeating one template.
  const byConfidence = (a: TemplateMetadata, b: TemplateMetadata) =>
    Number(confident.indexOf(strandOf(a)) >= 3) -
      Number(confident.indexOf(strandOf(b)) >= 3) || rank(a.id) - rank(b.id);
  const inPool = (t: TemplateMetadata) => challengePool.has(t.id);
  const challengePick = (() => {
    // Gather pool problems from the nearest bands until there are a few to
    // choose from, so the challenge varies from day to day.
    const near: TemplateMetadata[] = [];
    for (const [lo, hi] of [
      [0.5, 1.3],
      [0.2, 1.6],
      [0, 2],
      [-1.5, 2.5],
      [-2.5, 2.5],
    ] as const) {
      for (const t of band(lo, hi, inPool)) if (!near.includes(t)) near.push(t);
      if (near.length >= 4) break;
    }
    if (near.length) return near.sort(byConfidence)[0];
    for (const [lo, hi] of [
      [0.3, 2],
      [0, 13],
    ] as const) {
      const candidates = band(lo, hi);
      if (candidates.length) return candidates.sort(byConfidence)[0];
    }
    return band(-13, 13).sort(
      (a, b) => gradeOf.get(b.id)! - gradeOf.get(a.id)!,
    )[0];
  })();

  const challengeSection: WorkbookSection = {
    kind: "challenge",
    items: challengePick ? [item(challengePick, "challenge")] : [],
  };
  // Practice at the frontier fills the remaining time across strands.
  const fixed =
    [warmUpSection, reviewSection, challengeSection, lessonSection]
      .flatMap((s) => s?.items ?? [])
      .reduce((sum, i) => sum + i.minutes, 0) +
    (lessonSection ? LESSON_READING_MINUTES : 0);
  const practiceItems: WorkbookItem[] = [];
  let remaining = minutes - fixed;
  for (const t of spread(
    budget.practiceMax,
    [
      [-0.8, 0.2],
      [-1.2, 0.5],
      [-2, 0.8],
      [-13, 13],
    ],
    2,
  )) {
    if (practiceItems.length >= 3 && remaining <= 1) break;
    const next = item(t, "practice");
    practiceItems.push(next);
    remaining -= next.minutes;
  }
  const sections: WorkbookSection[] = [];
  sections.push(warmUpSection);
  if (lessonSection) sections.push(lessonSection);
  sections.push({ kind: "practice", items: practiceItems });
  sections.push(reviewSection);
  sections.push(challengeSection);
  return {
    version: WORKBOOK_VERSION,
    date: options.date,
    number,
    minutes,
    level: Math.round(options.frontier.overall.level),
    sections: sections.filter((s) => s.items.length),
  };
}

/** Estimated minutes for the whole workbook. */
export function workbookMinutes(spec: WorkbookSpec): number {
  return spec.sections.reduce(
    (sum, s) =>
      sum +
      s.items.reduce((m, i) => m + i.minutes, 0) +
      (s.kind === "lesson" ? LESSON_READING_MINUTES : 0),
    0,
  );
}

/** JSON with object keys sorted, so a spec read back from storage (JSONB
 * reorders keys) hashes the same as the one composed. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

/** A short code printed on the workbook so results can be entered against
 * exactly these problems later. */
export function workbookCode(spec: WorkbookSpec): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const digest = createHash("sha256").update(canonicalJson(spec)).digest();
  const chars = Array.from(
    digest.subarray(0, 8),
    (b) => alphabet[b % alphabet.length],
  );
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Regenerate a workbook's problems from its spec. */
export function workbookProblems(spec: WorkbookSpec): GeneratedProblem[] {
  return spec.sections.flatMap((s) =>
    s.items.map((i) => generateProblem(i.templateId, i.seed)),
  );
}
