/**
 * A demo class's term, written in a few bulk statements: every school day of
 * the term for each student, from their persona. Older days go straight to the
 * rollups; the last two weeks are real problems and real answers, so the
 * database's own triggers build skill evidence and skill days from them, and
 * Today, the evidence sheet and practice read exactly what a real class leaves.
 * Deterministic for a given class and day. Every name is made up.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { skills } from "../../curriculum/catalog.js";
import { generateProblem, templates } from "../../math/engine.js";
import {
  chanceOfRight,
  DAY,
  hash,
  SHARED_GAP,
  STUCK,
  wrongResponse,
  type Persona,
} from "./personas.js";
import { skillsNear } from "./term.js";

export type DemoStudent = {
  personId: string;
  learnerId: string;
  persona: Persona;
};
type GeneratedProblem = ReturnType<typeof generateProblem>;

const skillById = new Map(skills.map((skill) => [skill.id, skill]));
const strandOf = (skillId: string) =>
  skillById.get(skillId)?.strand ?? "number";
// At most two problem types a skill: enough variety for a demo's last week.
const templatesFor = new Map<string, string[]>();
for (const template of templates)
  if (
    !template.requiredResponseCapability &&
    !template.requiredFigureCapability &&
    (templatesFor.get(template.skillId)?.length ?? 0) < 2
  )
    templatesFor.set(template.skillId, [
      ...(templatesFor.get(template.skillId) ?? []),
      template.id,
    ]);
const skillOfTemplate = new Map(
  templates.map((template) => [template.id, template.skillId]),
);

/** A few problems per problem type, made once per process: an answer stores
 * its own copy under a fresh id, so two students can share a prompt but never
 * an instance. */
const pool = new Map<string, GeneratedProblem[]>();
function problemFor(templateId: string, pick: number): GeneratedProblem {
  let found = pool.get(templateId);
  if (!found) {
    found = [];
    for (let seed = 0; seed < 2; seed++)
      try {
        found.push(generateProblem(templateId, `demo-${templateId}-${seed}`));
      } catch {
        // A problem type that can't make this seed: the others stand in.
      }
    pool.set(templateId, found);
  }
  if (!found.length) throw new Error(`No demo problem for ${templateId}`);
  return found[pick % found.length]!;
}
/** A stored copy of a problem, under its own id. */
function instance(problem: GeneratedProblem, review: boolean) {
  const copy = structuredClone(problem) as GeneratedProblem & {
    selection?: { reason: string };
  };
  copy.public.id = randomBytes(32).toString("hex");
  if (review) copy.selection = { reason: "review" };
  return copy;
}

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

type DayPlan = {
  day: string;
  ago: number;
  week: number;
  level: number;
  problems: number;
  minutes: number;
  skills: string[];
};
/** The days a persona worked, from the term's start through today, and what
 * each held. */
function planStudent(
  student: DemoStudent,
  options: {
    termStart: string;
    today: string;
    weekShape: readonly number[];
    gradeLevel: number;
    /** The school day has begun, so some have worked today already. */
    workToday: boolean;
  },
): DayPlan[] {
  const { persona } = student;
  const name = persona.name.join(" ");
  const todayTime = Date.parse(`${options.today}T12:00:00Z`);
  const startTime = Date.parse(`${options.termStart}T12:00:00Z`);
  const span = Math.round((todayTime - startTime) / DAY);
  const last = persona.lastActive ?? 0;
  const first = Math.min(span, persona.joined ?? span);
  const shortWeek = options.weekShape.length - 2;
  const days: Omit<DayPlan, "problems" | "skills">[] = [];
  for (let ago = first; ago >= last; ago--) {
    const time = todayTime - ago * DAY;
    const day = iso(time);
    const dow = weekday(day);
    if (dow === 0 || dow === 6) continue;
    const week = Math.floor((time - startTime) / (7 * DAY));
    // The long weekend: last week's Thursday and Friday off for everyone.
    if (week === shortWeek && dow >= 4) continue;
    const worked =
      persona.every >= 40
        ? ago === last || ago === last + 1
        : ago === last ||
          hash(`${persona.name[1]}${ago}`) > 1 / persona.every ||
          (persona.every <= 2 && ago % 2 === 0);
    // Some of the class has practiced already today.
    if (
      !worked ||
      (ago === 0 && (!options.workToday || hash(`${name} today`) > 0.62))
    )
      continue;
    const factor =
      options.weekShape[Math.min(week, options.weekShape.length - 1)]!;
    const progress = span ? (span - ago) / span : 1;
    days.push({
      day,
      ago,
      week,
      level: persona.ability + (persona.growth ?? 0) * progress,
      minutes:
        persona.minutes * factor * (0.75 + 0.5 * hash(`${name}${day}min`)),
    });
  }
  const weight = days.reduce((sum, day) => sum + day.minutes, 0) || 1;
  return days.map((day) => {
    const problems = Math.max(
      2,
      Math.round((persona.answers * day.minutes) / weight),
    );
    // A class works through its grade a few skills a week; a student's level
    // moves them a grade up or down.
    const grade = Math.max(
      0,
      Math.min(
        12,
        Math.round(day.level * 0.55 + options.gradeLevel * 0.45 - 0.3),
      ),
    );
    const list = skillsNear(grade);
    const count = Math.min(list.length, problems >= 8 ? 3 : 2);
    const picked = Array.from(
      { length: count },
      (_, k) =>
        list[
          (day.week * 2 + k + Math.floor(hash(`${name}${day.day}${k}`) * 2)) %
            list.length
        ]!,
    );
    return { ...day, problems, skills: [...new Set(picked)] };
  });
}

type SkillDayRow = [
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
];
type ActiveDayRow = [string, string, string, number];
type LevelDayRow = [string, string, string];
type AttemptRow = {
  learner: string;
  instance: string;
  content: string;
  outcome: string;
  at: string;
};

/** Writes a demo class's term for its students. Their roster rows exist
 * already, so the answer triggers build skill days in the school's zone. */
export async function seedClassHistory(
  client: Pick<PoolClient, "query">,
  options: {
    students: readonly DemoStudent[];
    timezone: string;
    termStart: string;
    /** Today in the school's zone. */
    today: string;
    gradeLevel: number;
    weekShape: readonly number[];
    /** The clock: today's answers were given in the last hour. */
    now: number;
    /** The school day has begun in the school's zone. */
    workToday: boolean;
    /** Days back whose work is real answers, not rollups. */
    recentDays?: number;
    sharedGap?: { people: readonly string[]; template: string } | null;
    stuck?: { person: string; template: string } | null;
  },
) {
  const recent = options.recentDays ?? 8;
  const gap = options.sharedGap === undefined ? SHARED_GAP : options.sharedGap;
  const stuck = options.stuck === undefined ? STUCK : options.stuck;
  const skillDays: SkillDayRow[] = [];
  const activeDays: ActiveDayRow[] = [];
  const levelDays: LevelDayRow[] = [];
  const attempts: AttemptRow[] = [];
  const todayTime = Date.parse(`${options.today}T12:00:00Z`);
  for (const student of options.students) {
    const { persona, learnerId } = student;
    const name = persona.name.join(" ");
    const plan = planStudent(student, options);
    const held = new Set<string>();
    const misses: { template: string; days: number[] }[] = [];
    if (gap?.people.includes(persona.name[0]))
      misses.push({ template: gap.template, days: [3, 2, 1] });
    if (stuck?.person === persona.name[0])
      misses.push({ template: stuck.template, days: [4, 2, 1] });
    for (const miss of misses) held.add(skillOfTemplate.get(miss.template)!);
    let answered = 0;
    let independent = 0;
    const byStrand = new Map<
      string,
      { answered: number; independent: number }
    >();
    const strandOffset = (strand: string) =>
      (hash(`${name}${strand}`) - 0.5) * 0.7 -
      (gap?.people.includes(persona.name[0]) && strand === "fractions"
        ? 0.5
        : 0);
    let serial = 0;
    // One slip a skill lately: only a persona's designed misses add up.
    const slips = new Map<string, number>();
    for (const [index, day] of plan.entries()) {
      const lastDay = index === plan.length - 1;
      const share = day.problems / day.skills.length;
      for (const [k, skill] of day.skills.entries()) {
        const n = Math.max(
          1,
          Math.round(share * (0.8 + 0.4 * hash(`${name}${day.day}${k}n`))),
        );
        const ms = Math.round((day.minutes * 60_000) / day.skills.length);
        activeDays.push([learnerId, day.day, skill, ms]);
        const p = chanceOfRight(day.level, skill);
        let right = 0;
        let alone = 0;
        let helped = 0;
        let review = 0;
        let reviewAlone = 0;
        if (day.ago < recent && !held.has(skill)) {
          const kinds = templatesFor.get(skill) ?? [];
          for (let item = 0; item < n && kinds.length; item++) {
            serial++;
            const template = kinds[(serial + item) % kinds.length]!;
            const problem = problemFor(template, serial);
            const isReview = serial % 8 === 7 && index > 3;
            // Spaced review is what sticks: it comes back right more often.
            // A skill's last answer each day is right and it slips once at
            // most, so only the misses a persona has (`misses`) read as stuck.
            const correct =
              item === n - 1 ||
              (slips.get(skill) ?? 0) >= 1 ||
              hash(`${name}${day.day}${skill}${item}`) <
                (isReview ? Math.min(0.97, p + 0.2) : p);
            if (!correct) slips.set(skill, (slips.get(skill) ?? 0) + 1);
            const assisted =
              correct && item < n - 1 && hash(`${name}${serial}hint`) < 0.08;
            const wrong = correct ? null : wrongResponse(problem as never);
            const start =
              day.ago === 0
                ? options.now - 50 * 60_000
                : Date.parse(`${day.day}T15:10:00Z`);
            const at = new Date(start + (k * n + item) * 75_000).toISOString();
            const copy = instance(problem, isReview);
            attempts.push({
              learner: learnerId,
              instance: copy.public.id,
              content: JSON.stringify(copy),
              at,
              outcome: JSON.stringify({
                id: randomUUID(),
                requestId: randomUUID(),
                problemId: copy.public.id,
                skillId: copy.public.skillId,
                templateId: template,
                response: correct ? problem.answer : wrong,
                correct,
                assisted,
                answer: problem.answer,
                explanation: problem.explanation,
                createdAt: at,
              }),
            });
            if (correct && !assisted) alone++;
          }
          answered += n;
          independent += alone;
        } else {
          right = Math.min(
            n,
            Math.round(n * p + (hash(`${name}${day.day}${skill}r`) - 0.5)),
          );
          helped = Math.round(n * 0.08);
          alone = Math.max(0, right - helped);
          review = index > 3 ? Math.round(n * 0.14) : 0;
          reviewAlone = Math.min(review, Math.round(review * p));
          skillDays.push([
            learnerId,
            day.day,
            skill,
            n,
            right,
            alone,
            helped,
            review,
            reviewAlone,
          ]);
          answered += n;
          independent += alone;
        }
        const strand = strandOf(skill);
        const entry = byStrand.get(strand) ?? { answered: 0, independent: 0 };
        entry.answered += n;
        entry.independent += alone;
        byStrand.set(strand, entry);
      }
      // The stored level: early in each week, and on their latest day.
      if (weekday(day.day) <= 2 || lastDay) {
        const sd = Math.max(0.28, 1.1 / Math.sqrt(1 + answered / 12));
        levelDays.push([
          learnerId,
          day.day,
          JSON.stringify({
            overall: {
              level: Math.round(day.level * 100) / 100,
              sd: Math.round(sd * 100) / 100,
              answered,
              independent,
            },
            strands: Object.fromEntries(
              [...byStrand].map(([strand, counts]) => [
                strand,
                {
                  level:
                    Math.round((day.level + strandOffset(strand)) * 100) / 100,
                  sd:
                    Math.round(
                      Math.max(0.32, 1.2 / Math.sqrt(1 + counts.answered / 8)) *
                        100,
                    ) / 100,
                  ...counts,
                },
              ]),
            ),
          }),
        ]);
      }
    }
    // What they keep missing lately, as their latest answers on that skill.
    for (const miss of misses)
      for (const [item, ago] of miss.days.entries()) {
        const problem = problemFor(miss.template, item);
        const day = iso(todayTime - ago * DAY);
        const at = new Date(
          Date.parse(`${day}T14:30:00Z`) + item * 60_000,
        ).toISOString();
        const copy = instance(problem, false);
        attempts.push({
          learner: learnerId,
          instance: copy.public.id,
          content: JSON.stringify(copy),
          at,
          outcome: JSON.stringify({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: copy.public.id,
            skillId: copy.public.skillId,
            templateId: miss.template,
            response: wrongResponse(problem as never),
            correct: false,
            assisted: false,
            answer: problem.answer,
            explanation: problem.explanation,
            createdAt: at,
          }),
        });
      }
  }
  const column = <T, K extends keyof T>(rows: readonly T[], key: K) =>
    rows.map((row) => row[key]);
  await client.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
     SELECT * FROM unnest($1::text[],$2::date[],$3::text[],$4::int[],$5::int[],$6::int[],$7::int[],$8::int[],$9::int[])
     ON CONFLICT DO NOTHING`,
    Array.from({ length: 9 }, (_, index) =>
      column(skillDays, index as keyof SkillDayRow),
    ),
  );
  await client.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
     SELECT l,d,'practice',s,m FROM unnest($1::text[],$2::date[],$3::text[],$4::bigint[]) AS t(l,d,s,m)
     ON CONFLICT DO NOTHING`,
    Array.from({ length: 4 }, (_, index) =>
      column(activeDays, index as keyof ActiveDayRow),
    ),
  );
  await client.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     SELECT l,d,f::jsonb,'demo' FROM unnest($1::text[],$2::date[],$3::text[]) AS t(l,d,f)
     ON CONFLICT DO NOTHING`,
    Array.from({ length: 3 }, (_, index) =>
      column(levelDays, index as keyof LevelDayRow),
    ),
  );
  // In the order they were given, so evidence order is answer order.
  attempts.sort((a, b) => a.at.localeCompare(b.at));
  await client.query(
    `INSERT INTO amp_instances(id,learner_id,content,created_at)
     SELECT i,l,c::jsonb,a::timestamptz-interval '40 seconds'
     FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) AS t(i,l,c,a)`,
    [
      column(attempts, "instance"),
      column(attempts, "learner"),
      column(attempts, "content"),
      column(attempts, "at"),
    ],
  );
  await client.query(
    `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at)
     SELECT o::jsonb->>'id',l,i,o::jsonb->>'requestId',o::jsonb,a::timestamptz
     FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) WITH ORDINALITY AS t(l,i,o,a,n)
     ORDER BY n`,
    [
      column(attempts, "learner"),
      column(attempts, "instance"),
      column(attempts, "outcome"),
      column(attempts, "at"),
    ],
  );
  return { answers: attempts.length, days: skillDays.length };
}
