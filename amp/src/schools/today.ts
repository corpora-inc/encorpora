import {
  DEFAULT_GRADE_POLICY,
  skillsShownWords,
  type CourseBand,
  type GradePolicy,
  type StudentLevel,
} from "./grade-policy.js";
import type { TodayTodo } from "./teacher-contracts.js";

/** One answer as `amp_skill_evidence` keeps its last five. */
export type RecentOutcome = {
  /** The attempt's id; absent on evidence folded before it was kept. */
  id?: string;
  correct: boolean;
  assisted: boolean;
  createdAt: string;
  templateId?: string;
  evidenceWeight?: number;
};
export type TodayStudent = {
  id: string;
  name: string;
  first: string;
  gradeLevel: number | null;
  level: StudentLevel | null;
  weekMinutes: number;
  weekProblems: number;
  /** Work today, so a good day can say so. */
  workedToday: boolean;
  todayMinutes: number;
  /** A typical week before this one, among weeks with any work. */
  usualWeeklyMinutes: number | null;
  /** The latest day with any activity, ever. */
  lastActive: string | null;
  /** Spaced review over the last few weeks. */
  review: number;
  reviewIndependent: number;
  objectivesThisWeek: number;
};
export type TodayInput = {
  today: string;
  /** A family's class: its children, and each child's own row on Today is
   * how they start, so there's no class to start. */
  family?: boolean;
  students: readonly TodayStudent[];
  skills: readonly {
    studentId: string;
    skillId: string;
    recent: readonly RecentOutcome[];
  }[];
  course: (CourseBand & { label: string }) | null;
  weeklyTargetMinutes: number | null;
  /** What a teacher calls a skill. */
  skillTitle: (skillId: string) => string;
  /** The lesson to open: the problem type they keep missing, if it has one. */
  lessonFor: (skillId: string, templateIds: readonly string[]) => string | null;
};

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Monday is 0. */
export const dayOfWeek = (iso: string) =>
  (new Date(dayOf(iso)).getUTCDay() + 6) % 7;
export const weekStart = (iso: string) =>
  new Date(dayOf(iso) - dayOfWeek(iso) * DAY).toISOString().slice(0, 10);

/** "Noor, Diego and Lena"; past six, "and 3 more", so a line stays a line. */
export function joinNames(names: readonly string[], limit = 6): string {
  const shown = names.slice(0, limit);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  if (shown.length < 2) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}
const possessive = (name: string) => `${name}’s`;
/** A catalog title inside a sentence: "fraction addition". */
export function inSentence(title: string): string {
  const first = title.split(" ")[0]!;
  if (first === first.toUpperCase() || /^Pythagorean/.test(first)) return title;
  return title[0]!.toLowerCase() + title.slice(1);
}
const people = (students: readonly TodayStudent[]) =>
  students.map(({ id, name }) => ({ id, name }));

/** Students who keep missing a skill on their own, right now. A miss counts
 * only unassisted and at full weight; a right answer since clears it. */
function stuckOn(
  recent: readonly RecentOutcome[],
  today: string,
  policy: GradePolicy,
): number {
  const horizon = dayOf(today) - policy.today.recentDays * DAY;
  const fresh = recent.filter(
    (outcome) => Date.parse(outcome.createdAt) >= horizon,
  );
  const last = fresh.at(-1);
  const independentRight = (outcome: RecentOutcome) =>
    outcome.correct && !outcome.assisted && (outcome.evidenceWeight ?? 1) >= 1;
  if (!last || independentRight(last)) return 0;
  return fresh.filter(
    (outcome) =>
      !outcome.correct &&
      !outcome.assisted &&
      (outcome.evidenceWeight ?? 1) >= 1,
  ).length;
}

/** The latest miss without help, to replay from a "keeps missing" item. */
function latestMiss(
  studentId: string,
  skillId: string,
  recent: readonly RecentOutcome[],
) {
  const miss = [...recent]
    .reverse()
    .find(
      (outcome) =>
        !outcome.correct &&
        !outcome.assisted &&
        (outcome.evidenceWeight ?? 1) >= 1 &&
        typeof outcome.id === "string",
    );
  return miss ? [{ personId: studentId, attempt: miss.id!, skillId }] : [];
}

const reference = (student: TodayStudent, input: TodayInput) =>
  input.course ??
  (student.gradeLevel === null
    ? null
    : {
        from: student.gradeLevel - 0.5,
        to: student.gradeLevel + 0.5,
        label: `their grade`,
      });

function readyForMore(
  student: TodayStudent,
  input: TodayInput,
  policy: GradePolicy,
): boolean {
  const band = reference(student, input);
  if (!band || !student.level) return false;
  const { readyMargin, readyMinimumReviews, readyReviewShare } = policy.today;
  const strands = Object.values(student.level.strands);
  const past = (level: number) => level > band.to + readyMargin;
  return (
    past(student.level.overall.level) &&
    strands.length > 0 &&
    strands.every((estimate) => past(estimate.level)) &&
    student.review >= readyMinimumReviews &&
    student.reviewIndependent / student.review >= readyReviewShare
  );
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
/** A family's day, as a parent reads it: everyone worked, or each child who
 * did, by name. */
function familyDay(
  students: readonly TodayStudent[],
  worked: readonly TodayStudent[],
  minutesToday: number,
  objectives: number,
): TodayTodo[] {
  if (worked.length >= 2 && worked.length === students.length)
    return [
      {
        id: "good-day",
        kind: "good-day",
        title:
          worked.length === 2
            ? "Both children worked today"
            : `All ${worked.length} children worked today`,
        detail: `${plural(minutesToday, "active minute")} so far${objectives ? `; ${skillsShownWords(objectives)} this week` : ""}.`,
        students: people(worked),
        action: { kind: "tab", tab: "time", label: "See the time report" },
      },
    ];
  return worked.map((student) => {
    const minutes = Math.round(student.todayMinutes);
    return {
      id: `worked:${student.id}`,
      kind: "good-day",
      title:
        minutes > 0
          ? `${student.first} practiced ${plural(minutes, "minute")} today`
          : `${student.first} practiced today`,
      detail: student.objectivesThisWeek
        ? `${skillsShownWords(student.objectivesThisWeek)} this week.`
        : `${plural(Math.round(student.weekMinutes), "minute")} so far this week.`,
      students: people([student]),
      action: {
        kind: "student",
        personId: student.id,
        label: `See ${possessive(student.first)} work`,
      },
    };
  });
}

/**
 * What needs the teacher today, most useful first, each with one action. Pure.
 * A list of deficits isn't a day anyone wants to open: what's going well keeps
 * its place even when there's plenty to fix.
 */
export function todayTodos(
  input: TodayInput,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): TodayTodo[] {
  const { students } = input;
  const rules = policy.today;
  /** Who is in the class, as its teacher says it. */
  const plural = input.family ? "children" : "students";
  if (input.family && students.every((student) => !student.lastActive))
    return [];
  if (students.length === 0)
    return [
      {
        id: "add-students",
        kind: "start",
        title: "Add your students",
        detail:
          "Everything here fills in once they start: who needs you, who’s ready for more, and each student’s grade range.",
        students: [],
        action: { kind: "tab", tab: "settings", label: "Add students" },
      },
    ];
  const started = students.filter((student) => student.lastActive !== null);
  if (started.length === 0)
    return [
      {
        id: "start-class",
        kind: "start",
        title: "Start class",
        detail:
          "Put the class code on the board. Each student signs in with a code and three pictures, then starts on real problems at their own level.",
        students: people(students),
        action: { kind: "tab", tab: "start", label: "Start class" },
      },
    ];
  const byId = new Map(students.map((student) => [student.id, student]));
  const covered = new Set<string>();

  // Shared gaps: the same skill, enough students, repeatedly on their own.
  const missing = new Map<
    string,
    {
      students: Set<string>;
      templates: string[];
      misses: ReturnType<typeof latestMiss>;
    }
  >();
  for (const row of input.skills) {
    if (!byId.has(row.studentId)) continue;
    if (stuckOn(row.recent, input.today, policy) < rules.sharedGapMisses)
      continue;
    const entry = missing.get(row.skillId) ?? {
      students: new Set<string>(),
      templates: [],
      misses: [],
    };
    entry.students.add(row.studentId);
    entry.misses.push(...latestMiss(row.studentId, row.skillId, row.recent));
    for (const outcome of row.recent)
      if (!outcome.correct && outcome.templateId)
        entry.templates.push(outcome.templateId);
    missing.set(row.skillId, entry);
  }
  const gaps = [...missing.entries()]
    .filter(([, entry]) => entry.students.size >= rules.sharedGapStudents)
    .sort(
      ([a, left], [b, right]) =>
        right.students.size - left.students.size || a.localeCompare(b),
    )
    .slice(0, rules.maximumSharedGaps)
    .map(([skillId, entry]): TodayTodo => {
      const group = [...entry.students].map((id) => byId.get(id)!);
      for (const student of group) covered.add(`${student.id}:${skillId}`);
      const skill = inSentence(input.skillTitle(skillId));
      const lesson = input.lessonFor(skillId, entry.templates);
      return {
        id: `gap:${skillId}`,
        kind: "shared-gap",
        title: `${group.length} ${plural} keep missing ${skill}`,
        detail: `${joinNames(group.map((student) => student.first))}: each has ${rules.sharedGapMisses} or more misses without help in the last ${rules.recentDays} days, and no right answer since.`,
        students: people(group),
        action: lesson
          ? {
              kind: "lesson",
              templateId: lesson,
              skillId,
              label: "Open the lesson",
            }
          : { kind: "skill", skillId, label: "Open this skill" },
        groupSheet: { skillId, label: "Print a group sheet" },
        ...(entry.misses.length ? { misses: entry.misses } : {}),
      };
    });

  // One student stuck, and not already in a group above.
  const stuck = input.skills
    .filter(
      (row) =>
        byId.has(row.studentId) &&
        !covered.has(`${row.studentId}:${row.skillId}`) &&
        stuckOn(row.recent, input.today, policy) >= rules.stuckMisses,
    )
    .sort(
      (a, b) =>
        stuckOn(b.recent, input.today, policy) -
          stuckOn(a.recent, input.today, policy) ||
        a.studentId.localeCompare(b.studentId) ||
        a.skillId.localeCompare(b.skillId),
    )
    .slice(0, rules.maximumStuck)
    .map((row): TodayTodo => {
      const student = byId.get(row.studentId)!;
      const misses = stuckOn(row.recent, input.today, policy);
      const title = `${student.first} keeps missing ${inSentence(input.skillTitle(row.skillId))}`;
      const latest = latestMiss(row.studentId, row.skillId, row.recent);
      const replay = latest.length ? { misses: latest } : {};
      const detail = `${misses} misses without help in the last ${rules.recentDays} days, and no right answer since.`;
      // A parent's: the lesson, and a sheet on paper.
      if (input.family) {
        const lesson = input.lessonFor(
          row.skillId,
          row.recent.flatMap((outcome) =>
            !outcome.correct && outcome.templateId ? [outcome.templateId] : [],
          ),
        );
        return {
          id: `stuck:${row.studentId}:${row.skillId}`,
          kind: "stuck",
          title,
          detail,
          students: people([student]),
          action: lesson
            ? {
                kind: "lesson",
                templateId: lesson,
                skillId: row.skillId,
                label: "Open the lesson",
              }
            : {
                kind: "student",
                personId: student.id,
                label: `See ${possessive(student.first)} work`,
              },
          groupSheet: { skillId: row.skillId, label: "Print a sheet" },
          ...replay,
        };
      }
      return {
        id: `stuck:${row.studentId}:${row.skillId}`,
        kind: "stuck",
        title,
        detail,
        students: people([student]),
        action: {
          kind: "student",
          personId: student.id,
          label: latest.length
            ? `See ${possessive(student.first)} misses`
            : `See ${possessive(student.first)} work`,
        },
        ...replay,
      };
    });

  // On the roster, but they've never signed in.
  const waiting = students.filter((student) => student.lastActive === null);
  const notStarted: TodayTodo[] =
    waiting.length === 0 || input.family
      ? []
      : [
          {
            id: "not-started",
            kind: "start",
            title:
              waiting.length === 1
                ? `${waiting[0]!.first} hasn’t started yet`
                : `${waiting.length} students haven’t started yet`,
            detail: `${joinNames(waiting.map((student) => student.first))} can sign in with the class code and three pictures.`,
            students: people(waiting),
            action: { kind: "tab", tab: "start", label: "Start class" },
          },
        ];

  // What's going well.
  const ready = students.filter((student) =>
    readyForMore(student, input, policy),
  );
  const readyTodo: TodayTodo[] =
    ready.length === 0
      ? []
      : [
          {
            id: "ready",
            kind: "ready",
            title: `${joinNames(ready.map((student) => student.first))}: above ${input.course?.label ?? "their own grade"} in every strand`,
            detail: `Spaced review right without help in ${Math.round(rules.readyReviewShare * 100)}% or more of at least ${rules.readyMinimumReviews} reviews.`,
            students: people(ready),
            action:
              ready.length === 1
                ? {
                    kind: "student",
                    personId: ready[0]!.id,
                    label: `See ${possessive(ready[0]!.first)} work`,
                  }
                : { kind: "tab", tab: "map", label: "See the class map" },
          },
        ];
  const worked = students.filter((student) => student.workedToday);
  const minutesToday = Math.round(
    worked.reduce((sum, student) => sum + student.todayMinutes, 0),
  );
  const gained = students
    .filter((student) => student.objectivesThisWeek > 0)
    .sort((a, b) => b.objectivesThisWeek - a.objectivesThisWeek);
  const objectives = gained.reduce(
    (sum, student) => sum + student.objectivesThisWeek,
    0,
  );
  const goodDay =
    worked.length >= rules.goodDayStudents &&
    worked.length / students.length >= rules.goodDayShare;
  const going: TodayTodo[] = input.family
    ? familyDay(students, worked, minutesToday, objectives)
    : goodDay
      ? [
          {
            id: "good-day",
            kind: "good-day",
            title: `${worked.length} of ${students.length} ${plural} practiced today`,
            detail: `${minutesToday.toLocaleString("en-US")} active minutes so far${objectives ? `; ${skillsShownWords(objectives)} this week` : ""}.`,
            students: people(worked),
            action: { kind: "tab", tab: "time", label: "See the time report" },
          },
        ]
      : objectives > 0
        ? [
            {
              id: "going-well",
              kind: "good-day",
              title: `${skillsShownWords(objectives)} this week`,
              detail: `${joinNames(
                gained.map(
                  (student) => `${student.first} ${student.objectivesThisWeek}`,
                ),
                4,
              )}.`,
              students: people(gained.slice(0, 6)),
              action: { kind: "tab", tab: "map", label: "See the class map" },
            },
          ]
        : [];

  const positives = [...readyTodo, ...going];
  // One of each kind before a second of any: a teacher can act on a shared gap
  // and a quiet week today, and a second gap can wait for the next list.
  const deficits = [
    ...gaps.slice(0, 1),
    ...stuck,
    ...notStarted,
    ...gaps.slice(1),
  ];
  return [
    ...deficits.slice(0, Math.max(0, rules.maximumTodos - positives.length)),
    ...positives,
  ].slice(0, rules.maximumTodos);
}
