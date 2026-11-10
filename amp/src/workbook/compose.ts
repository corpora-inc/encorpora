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

/** A workbook: about 30, 45 or 60 minutes of printed work chosen from
 * one learner's evidence. The spec names every problem by template and seed,
 * so the same spec always prints the same pages, and a new seed is a new
 * workbook. Selection is a scheduling heuristic like mixed practice: it aims
 * each section at a success level, it does not certify mastery. */
export const WORKBOOK_VERSION = 2;
export const WORKBOOK_MINUTES = [30, 45, 60] as const;
export type WorkbookMinutes = (typeof WORKBOOK_MINUTES)[number];
export const WORKBOOK_LEANS = ["easier", "level", "stretch"] as const;
/** Easier review: more review and practice a little below the frontier.
 * Stretch: practice and today's idea a little above it. */
export type WorkbookLean = (typeof WORKBOOK_LEANS)[number];
/** What the parent chose. Every choice changes the composition, and the
 * same choices with the same inputs always compose the same workbook. */
export interface WorkbookChoices {
  /** Strands to draw from, sorted; empty is mixed (recommended). */
  areas: string[];
  lean: WorkbookLean;
  /** False: problems only, without "Today's idea". */
  lesson: boolean;
}
export const defaultChoices: WorkbookChoices = {
  areas: [],
  lean: "level",
  lesson: true,
};
/** The choices a spec was made with. Version 1 specs had none: mixed, at
 * level, with a lesson. */
export const specChoices = (spec: WorkbookSpec): WorkbookChoices =>
  spec.choices ?? defaultChoices;
/** Grades the lean moves practice and today's idea. */
const leanShift: Record<WorkbookLean, number> = {
  easier: -0.5,
  level: 0,
  stretch: 0.4,
};
/** Recent workbooks whose problems a new one avoids. */
export const WORKBOOK_HISTORY = 12;

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
  /** A skill this workbook leans on: a teacher's group sheet. */
  focusSkill?: string;
  /** 2 since parent choices; stored version 1 specs reprint unchanged. */
  version: 1 | typeof WORKBOOK_VERSION;
  /** Local calendar date the workbook is for, YYYY-MM-DD. */
  date: string;
  /** 1 for the day's first workbook; "another one" increments it. */
  number: number;
  minutes: WorkbookMinutes;
  /** Rounded working level, used only for print scale (larger type for
   * early grades). Never printed as a grade. */
  level: number;
  sections: WorkbookSection[];
  /** Version 2: what the parent chose (absent in version 1). */
  choices?: WorkbookChoices;
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
        : response.kind === "point-plot" ||
            response.kind === "counter-builder" ||
            response.kind === "shape-composer"
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
/** How far above the learner's level the Challenge sits, in grades. */
export const CHALLENGE_WINDOW = [0.5, 1.3] as const;
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
  /** The learner's recent workbooks, newest first: their lessons, skills
   * and templates go last, so every roll is new. */
  history?: readonly WorkbookSpec[];
  choices?: Partial<WorkbookChoices>;
  /** Today's idea teaches this skill when a lesson can, and it takes up to
   * half of practice. An unknown or unprintable skill changes nothing. */
  focusSkill?: string;
  date: string;
  number?: number;
  minutes?: WorkbookMinutes;
  /** Stable per learner; with date, number, choices and history it fixes
   * every choice. */
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
  const choices: WorkbookChoices = {
    areas: [...new Set(options.choices?.areas ?? [])].sort(),
    lean: options.choices?.lean ?? "level",
    lesson: options.choices?.lesson ?? true,
  };
  if (!WORKBOOK_LEANS.includes(choices.lean))
    throw new Error("Invalid workbook lean");
  const shift = leanShift[choices.lean];
  const budget = {
    ...budgets[minutes],
    // Easier review: half again as much spaced review.
    ...(choices.lean === "easier"
      ? { review: Math.ceil(budgets[minutes].review * 1.5) }
      : {}),
  };
  const focusable = options.focusSkill
    ? options.templates.filter(
        (t) => t.skillId === options.focusSkill && printable(t),
      )
    : [];
  const focusSkill = focusable.length ? options.focusSkill : undefined;
  const seed = `workbook:${options.learnerKey}:${options.date}:${number}:${choices.areas.join("+")}:${choices.lean}:${choices.lesson ? "lesson" : "problems"}${focusSkill ? `:${focusSkill}` : ""}`;
  const nodes = new Map(options.skills.map((s) => [s.id, s]));
  const strandOf = (t: TemplateMetadata) =>
    nodes.get(t.skillId)?.strand ?? t.skillId;
  const areas = new Set(choices.areas);
  const pool = options.templates.filter(
    (t) =>
      printable(t) &&
      nodes.has(t.skillId) &&
      (!areas.size || areas.has(strandOf(t))),
  );
  if (!pool.length) throw new Error("No printable templates");
  const focusTemplates = pool.filter((t) => t.skillId === focusSkill);
  // The newest workbook weighs most: a template it printed goes after one
  // printed longer ago, and a skill it practised after a fresh one.
  const history = (options.history ?? []).slice(0, WORKBOOK_HISTORY);
  const printedTemplate = new Map<string, number>();
  const printedSkill = new Map<string, number>();
  const printedLesson = new Map<string, number>();
  history.forEach((spec, index) => {
    const weight = history.length - index;
    for (const section of spec.sections) {
      if (section.lessonId && !printedLesson.has(section.lessonId))
        printedLesson.set(section.lessonId, weight);
      for (const i of section.items) {
        if (!printedTemplate.has(i.templateId))
          printedTemplate.set(i.templateId, weight);
        if (!printedSkill.has(i.skillId)) printedSkill.set(i.skillId, weight);
      }
    }
  });
  /** 0 for work no recent workbook printed; higher for more recent. */
  const staleness = (t: TemplateMetadata) =>
    2 * (printedTemplate.get(t.id) ?? 0) + (printedSkill.get(t.skillId) ?? 0);
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
      problem.public.response.kind !== "unit-square-marking" &&
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
  /** The minutes `item` would give this template next, without taking it. */
  const estimate = (t: TemplateMetadata, kind: SectionKind) =>
    minutesFor(
      generateProblem(t.id, `${seed}:${kind}:${serial.get(kind) ?? 0}`),
      gradeOf.get(t.id)!,
      kind,
    );
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
          staleness(a) - staleness(b) ||
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
  /** At most two problems from one strand, unless the parent chose a few
   * areas: then the section shares out among them. */
  const perStrand = (count: number) =>
    areas.size ? Math.max(2, Math.ceil(count / areas.size)) : 2;
  const strong = (skillId: string) => {
    const e = evidence.get(skillId);
    return !!e && e.recentIndependentCorrect >= 3;
  };

  // Today's idea: a frontier skill a lesson can move forward. The focus
  // rotates: a lesson no recent workbook taught comes first, then skills the
  // learner has started and not yet secured, then new skills at the
  // frontier, in this workbook's order. The lesson's own templates give the
  // guided problems. Problems only: no lesson.
  const lessonOf = new Map<string, Lesson>();
  for (const lesson of options.lessons)
    for (const id of lesson.templateIds)
      if (!lessonOf.has(id)) lessonOf.set(id, lesson);
  const lessonCandidates = (lo: number, hi: number) =>
    band(
      lo + shift,
      hi + shift,
      (t) => lessonOf.has(t.id) && !strong(t.skillId),
    ).sort((a, b) => {
      const taught = (t: TemplateMetadata) =>
        printedLesson.get(lessonOf.get(t.id)!.id) ?? 0;
      const started = (t: TemplateMetadata) =>
        (evidence.get(t.skillId)?.attempts ?? 0) > 0 ? 0 : 1;
      // Whole grades from the target: one bucket inside the first band, so
      // the focus rotates there; nearer first when the band widens.
      const distance = (t: TemplateMetadata) =>
        Math.floor(
          Math.abs(gradeOf.get(t.id)! - levelOf(strandOf(t)) - shift + 0.1),
        );
      return (
        distance(a) - distance(b) ||
        taught(a) - taught(b) ||
        started(a) - started(b) ||
        rank(a.id) - rank(b.id)
      );
    });
  const focus = !choices.lesson
    ? undefined
    : (focusTemplates
        .filter((t) => lessonOf.has(t.id))
        .sort((a, b) => rank(a.id) - rank(b.id))[0] ??
      lessonCandidates(-0.6, 0.4)[0] ??
      lessonCandidates(-1.5, 1)[0] ??
      lessonCandidates(-13, 13)[0]);
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
    items: spread(
      budget.warmUp,
      [[-1.5, 0.25]],
      perStrand(budget.warmUp),
      (t) => strong(t.skillId),
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
      perStrand(budget.warmUp),
    ).map((t) => item(t, "warm-up")),
  );

  // Bring it back: ideas whose spaced review is due, on a different
  // template than last time when the skill has one. Skills a recent workbook
  // reviewed wait; then the longest overdue (by week), in this workbook's
  // order, so each roll brings back different ideas.
  const due = [...options.evidence]
    .filter(
      (e) =>
        e.reviewDueAt !== null &&
        e.reviewDueAt <= now &&
        e.independentCorrect > 0 &&
        !usedSkills.has(e.skillId),
    )
    .sort(
      (a, b) =>
        (printedSkill.get(a.skillId) ?? 0) -
          (printedSkill.get(b.skillId) ?? 0) ||
        Math.floor((now - b.reviewDueAt!) / (7 * 86_400_000)) -
          Math.floor((now - a.reviewDueAt!) / (7 * 86_400_000)) ||
        rank(a.skillId) - rank(b.skillId),
    );
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
          staleness(a) - staleness(b) ||
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
      Number(confident.indexOf(strandOf(b)) >= 3) ||
    staleness(a) - staleness(b) ||
    rank(a.id) - rank(b.id);
  const inPool = (t: TemplateMetadata) => challengePool.has(t.id);
  // A long multi-step problem at 2.5x can run past 20 minutes; the
  // challenge keeps to a fifth of the workbook. The first candidate in order
  // that fits, else the quickest of them.
  const challengeCap = minutes / 5;
  const fitting = (ordered: TemplateMetadata[]) => {
    let quickest: { t: TemplateMetadata; m: number } | undefined;
    for (const t of ordered) {
      const m = estimate(t, "challenge");
      if (m <= challengeCap) return t;
      if (!quickest || m < quickest.m) quickest = { t, m };
    }
    return quickest?.t;
  };
  const challengePick = (() => {
    // The challenge sits 0.5 to 1.3 grades above the learner: above its
    // strand's level, and never more than 1.3 above the overall level (a
    // strand estimate can run ahead of a learner with little evidence).
    // Pool problems first, chosen among the three most practiced strands so
    // it changes from day to day; then any template in the window.
    const [lo, hi] = CHALLENGE_WINDOW;
    const capped = (t: TemplateMetadata) =>
      gradeOf.get(t.id)! <= options.frontier.overall.level + hi;
    const ordered: TemplateMetadata[] = [];
    for (const extra of [
      (t: TemplateMetadata) => inPool(t) && capped(t),
      capped,
      inPool,
      undefined,
    ])
      for (const t of band(lo, hi, extra).sort(byConfidence))
        if (!ordered.includes(t)) ordered.push(t);
    // Then (the ends of the catalog, or nothing in the window that fits the
    // time) the templates closest to it, from the pool when as close.
    const distance = (t: TemplateMetadata) => {
      const offset = gradeOf.get(t.id)! - levelOf(strandOf(t));
      return offset < lo ? lo - offset : offset > hi ? offset - hi : 0;
    };
    // Every candidate in order, so a challenge that fits the time is found
    // before a long one is accepted.
    for (const t of band(-13, 13).sort(
      (a, b) =>
        Math.round(distance(a) * 10) - Math.round(distance(b) * 10) ||
        Number(inPool(b)) - Number(inPool(a)) ||
        byConfidence(a, b),
    ))
      if (!ordered.includes(t)) ordered.push(t);
    return fitting(ordered);
  })();

  const challengeSection: WorkbookSection = {
    kind: "challenge",
    items: challengePick ? [item(challengePick, "challenge")] : [],
  };
  // The estimate never exceeds the chosen length. Long problems (high school
  // runs 1.3x) can fill the budget before practice: the warm-up gives way to
  // half, then the guided problems to two, then review to two (then each to
  // one), so practice keeps about a quarter of the time.
  const minutesOf = (list: readonly WorkbookItem[]) =>
    list.reduce((sum, i) => sum + i.minutes, 0);
  const fixedMinutes = () =>
    minutesOf(
      [warmUpSection, reviewSection, challengeSection, lessonSection].flatMap(
        (s) => s?.items ?? [],
      ),
    ) + (lessonSection ? LESSON_READING_MINUTES : 0);
  const giveWay: [WorkbookItem[], number][] = [
    [warmUpSection.items, Math.ceil(budget.warmUp / 2)],
    [lessonSection?.items ?? [], 2],
    [reviewSection.items, 2],
    [warmUpSection.items, 1],
    [lessonSection?.items ?? [], 1],
    [reviewSection.items, 1],
  ];
  for (const [list, floor] of giveWay)
    while (fixedMinutes() > minutes * 0.75 && list.length > floor) list.pop();

  // Practice at the frontier fills the remaining time across strands. A
  // problem longer than the time left is passed over for a shorter one.
  const practiceItems: WorkbookItem[] = [];
  let remaining = minutes - fixedMinutes();
  // Problems only: practice also takes the guided problems' share.
  const practiceMax =
    budget.practiceMax + (lessonSection ? 0 : budget.guided + 2);
  // A focus skill goes first. Each draw is a fresh problem from its templates.
  if (focusTemplates.length)
    for (let i = 0; i < Math.ceil(practiceMax / 2); i++) {
      const next = item(focusTemplates[i % focusTemplates.length]!, "practice");
      if (next.minutes > remaining) break;
      practiceItems.push(next);
      remaining -= next.minutes;
    }
  for (const t of spread(
    practiceMax - practiceItems.length,
    [
      [-0.8 + shift, 0.2 + shift],
      [-1.2 + shift, 0.5 + shift],
      [-2 + shift, 0.8 + shift],
      [-13, 13],
    ],
    perStrand(practiceMax),
  )) {
    if (remaining < 1) break;
    const next = item(t, "practice");
    if (next.minutes > remaining) continue;
    practiceItems.push(next);
    remaining -= next.minutes;
  }
  // Last resort (a catalog of only long problems): drop from the end of the
  // warm-up, practice, review and guided problems, keeping one of each.
  const lastResort = [
    warmUpSection.items,
    practiceItems,
    reviewSection.items,
    lessonSection?.items ?? [],
  ];
  for (const list of lastResort)
    while (
      fixedMinutes() + minutesOf(practiceItems) > minutes &&
      list.length > 1
    )
      list.pop();
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
    choices,
    ...(focusSkill ? { focusSkill } : {}),
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
    s.items.map((i) =>
      generateProblem(i.templateId, i.seed, i.templateVersion),
    ),
  );
}
