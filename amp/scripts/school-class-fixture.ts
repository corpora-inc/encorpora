/**
 * A class with a term of real work: students answer real problems through the
 * real batches and attempts API at varied ability, then the answers are dated
 * back across the year and the rollups, skill evidence and level days rebuilt
 * from those dates by the same rules the trigger and `/batches` use. Today, the
 * gradebook, standings and the class map then read real evidence. Shared by the
 * teacher verification, the launch journey and the school demo. Every name here
 * is made up.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { skills } from "../src/curriculum/catalog";
import { gradeNumber } from "../src/learning/frontier";
import { generateProblem, templates } from "../src/math/engine";
import type { SchoolRepository } from "../src/schools/repository";
import type { PostgresRepository } from "../src/server/repository";

/** What the seeding needs: the database, the learning store, and the API the
 * students answer through. */
export type ClassWorld = {
  db: Pool;
  learning: PostgresRepository;
  schools: SchoolRepository;
  /** `http://127.0.0.1:<api port>`, with no trailing slash. */
  api: string;
};
export type Student = {
  personId: string;
  learnerId: string;
  accountId: string;
};

export const DAY = 86_400_000;
export const dayIso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
/** An even deterministic stream from a label, so a run is repeatable. */
export const hash = (text: string) => {
  let seed = 2166136261;
  for (const char of text) {
    seed ^= char.codePointAt(0)!;
    seed = Math.imul(seed, 16777619);
  }
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
};

export type Persona = {
  name: [string, string];
  /** Where they work, on the grade axis, and how far that moves over the run. */
  ability: number;
  growth?: number;
  /** Problems answered through the API. */
  answers: number;
  /** Minutes on a day they work. */
  minutes: number;
  /** One day in this many they skip. */
  every: number;
  /** Days ago they last worked. */
  lastActive?: number;
  /** Days ago they joined; the whole year otherwise. */
  joined?: number;
  identifier?: string;
};
export const persona = (
  given: string,
  family: string,
  ability: number,
  patch: Partial<Persona> = {},
): Persona => ({
  name: [given, family],
  ability,
  answers: 300,
  minutes: 11,
  every: 2,
  growth: 0.4,
  ...patch,
});
const P = persona;
/** A fifth-grade class of 24 with one of everything Today talks about: a
 * shared gap, a student stuck on one idea, a quiet week, a student with
 * almost no work, a late joiner, fast growth from behind, and two ready for
 * more. */
export const GRADE_5_CLASS: Persona[] = [
  P("Priya", "Raman", 6.2, { answers: 340, minutes: 14, growth: 0.7 }),
  P("Sam", "Whitlock", 6.0, { answers: 340, minutes: 13, growth: 0.7 }),
  P("Mei", "Tran", 5.2, { minutes: 13 }),
  P("Felix", "Grant", 5.0, { minutes: 12 }),
  P("Amara", "Osei", 4.9, { minutes: 12 }),
  P("Ruth", "Adeyemi", 4.8),
  P("Kai", "Nakamura", 4.7),
  P("Zara", "Mensah", 4.6, { joined: 12, answers: 80, minutes: 13 }),
  P("Isaac", "Moreno", 4.5),
  P("Sofia", "Marin", 4.5, { minutes: 12 }),
  P("Imani", "Clarke", 4.4, { minutes: 11 }),
  P("Tomas", "Vega", 4.4, { minutes: 7, every: 3 }),
  P("Nadia", "Petrov", 4.3),
  P("Elias", "Frost", 4.3, {
    answers: 8,
    minutes: 3,
    every: 40,
    lastActive: 0,
  }),
  P("Eli", "Novak", 4.2, { minutes: 10 }),
  P("Lena", "Fischer", 4.1),
  P("Diego", "Salas", 4.0),
  P("Marcus", "Bell", 4.0, { lastActive: 9, minutes: 12 }),
  P("Hana", "Sato", 3.9),
  P("Owen", "Hartley", 3.8),
  P("Caleb", "Ortiz", 2.2, { growth: 1.3, answers: 340, minutes: 14 }),
  P("Jonah", "Reyes", 3.6),
  P("Noor", "Haddad", 3.5),
  P("Theo", "Lindqvist", 3.4, { minutes: 6, every: 3 }),
].map((person, index) => ({
  ...person,
  identifier: `S-${10210 + index * 37}`,
}));
/** Six students who keep missing fraction addition, and one stuck on long
 * division: what Today groups and names. */
export const SHARED_GAP = {
  people: ["Noor", "Diego", "Lena", "Jonah", "Owen", "Hana"],
  template: "add-fractions",
};
export const STUCK = { person: "Kai", template: "divide-by-two-digit" };

export async function studentApi(
  world: ClassWorld,
  path: string,
  token: string,
  body: object,
) {
  const response = await fetch(`${world.api}/api/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response.json();
}
const skillOf = new Map(skills.map((skill) => [skill.id, skill]));
export function chanceOfRight(ability: number, skillId: string) {
  const skill = skillOf.get(skillId);
  const grade = skill ? gradeNumber[skill.gradeBand] : ability;
  return 0.12 + 0.82 / (1 + Math.exp(-1.7 * (ability - grade + 0.35)));
}
/** A wrong answer a student might give: a choice not taken, a number one off,
 * a fraction a step away; anything else, plainly wrong. */
export const wrongResponse = (problem: {
  answer: string;
  public: { response: { kind: string; options?: { id: string }[] } };
}) => {
  const { answer } = problem;
  if (problem.public.response.kind === "choice")
    return problem.public.response.options!.find((o) => o.id !== answer)!.id;
  const number = /^-?\d+(\.(\d+))?$/.exec(answer);
  if (number) {
    const places = number[2]?.length ?? 0;
    return (Number(answer) + 10 ** -places).toFixed(places);
  }
  const fraction = /^(-?\d+)\/(\d+)$/.exec(answer);
  if (fraction) return `${Number(fraction[1]) + 1}/${fraction[2]}`;
  return answer === "99999" ? "99998" : "99999";
};

/** Real answers through the real API, then dated back across the year: the
 * rollups, the skill evidence and the level days are rebuilt from those dates by
 * the same rules the trigger and `/batches` use. */
export async function seedStudent(
  world: ClassWorld,
  person: Persona,
  student: Student,
  start: number,
) {
  const { db, schools } = world;
  const { token } = await schools.issueStudentSession({
    personId: student.personId,
    mode: "shared",
  });
  let answered = 0,
    guard = 0;
  while (answered < person.answers && guard++ < person.answers) {
    const batch = (await studentApi(
      world,
      `/learners/${student.learnerId}/batches`,
      token,
      { count: Math.min(5, person.answers - answered) },
    )) as { problems: { id: string; skillId: string }[] };
    for (const problem of batch.problems) {
      const stored = (
        await db.query("SELECT content FROM amp_instances WHERE id=$1", [
          problem.id,
        ])
      ).rows[0].content;
      const progress = answered / person.answers;
      const ability = person.ability + (person.growth ?? 0) * progress;
      const right =
        hash(`${person.name[0]}${answered}`) <
        chanceOfRight(ability, problem.skillId);
      await studentApi(
        world,
        `/learners/${student.learnerId}/attempts`,
        token,
        {
          problemId: problem.id,
          requestId: randomUUID(),
          response: right ? stored.answer : wrongResponse(stored),
        },
      );
      answered++;
    }
    if (!batch.problems.length) break;
  }
  // The days they worked, oldest first.
  const last = person.lastActive ?? 0;
  const first = person.joined ?? start;
  const days: number[] = [];
  for (let ago = first; ago >= last; ago--)
    if (
      ago === last ||
      hash(`${person.name[1]}${ago}`) > 1 / person.every ||
      (person.every <= 2 && ago % 2 === 0)
    )
      days.push(ago);
  const worked = person.every >= 40 ? [last, last + 1] : days;
  const { rows: attempts } = await db.query(
    `SELECT id,problem_id,outcome->>'skillId' AS skill FROM amp_attempts WHERE learner_id=$1 ORDER BY evidence_sequence`,
    [student.learnerId],
  );
  const dayOf = (index: number) =>
    worked[
      Math.min(
        worked.length - 1,
        Math.floor((index / attempts.length) * worked.length),
      )
    ]!;
  for (const [index, attempt] of attempts.entries()) {
    const ago = dayOf(index);
    const at = new Date(
      Date.parse(`${dayIso(ago)}T15:00:00Z`) + index * 45_000,
    ).toISOString();
    await db.query(
      `UPDATE amp_attempts SET created_at=$2::timestamptz,outcome=jsonb_set(outcome,'{createdAt}',to_jsonb($3::text)) WHERE id=$1`,
      [attempt.id, at, at],
    );
    // About one in eight comes back as spaced review.
    if (index % 8 === 7 && ago !== start)
      await db.query(
        `UPDATE amp_instances SET content=content||jsonb_build_object('selection',COALESCE(content->'selection','{}'::jsonb)||'{"reason":"review"}'::jsonb) WHERE id=$1`,
        [attempt.problem_id],
      );
  }
}

/** A few extra answers on one skill, as the app stores them, for the group a
 * class's Today is about. */
export async function seedMisses(
  world: ClassWorld,
  student: Student,
  template: string,
  days: number[],
) {
  await world.learning.transaction(
    student.accountId,
    student.learnerId,
    async (tx) => {
      for (const ago of days) {
        const problem = generateProblem(template, randomUUID());
        await tx.saveProblem(problem);
        await tx.saveAttempt({
          id: randomUUID(),
          requestId: randomUUID(),
          problemId: problem.public.id,
          skillId: problem.public.skillId,
          templateId: template,
          response: wrongResponse(problem as never),
          correct: false,
          assisted: false,
          answer: problem.answer,
          explanation: problem.explanation,
          createdAt: new Date(
            Date.parse(`${dayIso(ago)}T16:00:00Z`),
          ).toISOString(),
        });
      }
    },
  );
}

/** New ground lately: a few skills around where they work, each right
 * twice without help. A student at this level does this in the weeks before a
 * report card; answers spread evenly over a year wouldn't show it. */
export async function seedGains(
  world: ClassWorld,
  person: Persona,
  student: Student,
  count: number,
) {
  const { rows } = await world.db.query(
    `SELECT outcome->>'skillId' AS skill FROM amp_attempts
     WHERE learner_id=$1 AND (outcome->>'correct')::boolean AND NOT (outcome->>'assisted')::boolean
     GROUP BY 1 HAVING count(*)>=2`,
    [student.learnerId],
  );
  const shown = new Set(rows.map((row) => row.skill as string));
  const level = person.ability + (person.growth ?? 0);
  const fresh = skills
    .filter(
      (skill) =>
        !shown.has(skill.id) &&
        gradeNumber[skill.gradeBand] >= Math.floor(level) - 1 &&
        gradeNumber[skill.gradeBand] <= Math.floor(level),
    )
    .flatMap((skill) => {
      const template = templates.find(
        (entry) =>
          entry.skillId === skill.id &&
          !entry.requiredResponseCapability &&
          !entry.requiredFigureCapability,
      );
      return template ? [template.id] : [];
    })
    .sort(
      (a, b) => hash(`${person.name[0]}${a}`) - hash(`${person.name[0]}${b}`),
    )
    .slice(0, count);
  await world.learning.transaction(
    student.accountId,
    student.learnerId,
    async (tx) => {
      for (const [index, template] of fresh.entries())
        for (const ago of [2 + index * 2, 1 + index * 2].map(
          (days) => days + (person.lastActive ?? 0),
        )) {
          const problem = generateProblem(template, randomUUID());
          await tx.saveProblem(problem);
          await tx.saveAttempt({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: problem.public.id,
            skillId: problem.public.skillId,
            templateId: template,
            response: problem.answer,
            correct: true,
            assisted: false,
            answer: problem.answer,
            explanation: problem.explanation,
            createdAt: new Date(
              Date.parse(`${dayIso(ago)}T16:30:00Z`),
            ).toISOString(),
          });
        }
    },
  );
}

/** The rollups, skill evidence and level days, from the dates now on the answers. */
export async function rebuild(
  world: ClassWorld,
  person: Persona,
  student: Student,
  timezone: string,
) {
  const { db, learning } = world;
  const { learnerId } = student;
  // Evidence order is the order the answers were given in.
  await db.query(
    `WITH top AS (SELECT max(evidence_sequence) AS at FROM amp_attempts)
     UPDATE amp_attempts a SET evidence_sequence=top.at+ranked.position
     FROM top,(
       SELECT id,row_number() OVER (ORDER BY (outcome->>'createdAt')::timestamptz,id) AS position
       FROM amp_attempts WHERE learner_id=$1
     ) ranked WHERE a.id=ranked.id`,
    [learnerId],
  );
  await db.query(
    `SELECT setval('amp_attempt_evidence_sequence',(SELECT max(evidence_sequence) FROM amp_attempts)+1,false)`,
  );
  await db.query("DELETE FROM amp_skill_days WHERE learner_id=$1", [learnerId]);
  await db.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
     SELECT a.learner_id,((a.outcome->>'createdAt')::timestamptz AT TIME ZONE $2)::date,a.outcome->>'skillId',
       count(*),count(*) FILTER (WHERE (a.outcome->>'correct')::boolean),
       count(*) FILTER (WHERE (a.outcome->>'correct')::boolean AND NOT COALESCE((a.outcome->>'assisted')::boolean,false)),
       count(*) FILTER (WHERE COALESCE((a.outcome->>'assisted')::boolean,false)),
       count(*) FILTER (WHERE i.content->'selection'->>'reason'='review'),
       count(*) FILTER (WHERE i.content->'selection'->>'reason'='review' AND (a.outcome->>'correct')::boolean AND NOT COALESCE((a.outcome->>'assisted')::boolean,false))
     FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
     WHERE a.learner_id=$1 GROUP BY 1,2,3`,
    [learnerId, timezone],
  );
  await db.query(
    `UPDATE amp_skill_evidence e SET state=jsonb_set(state,'{recentOutcomes}',(
       SELECT jsonb_agg(jsonb_set(o,'{createdAt}',a.outcome->'createdAt') ORDER BY ord)
       FROM jsonb_array_elements(state->'recentOutcomes') WITH ORDINALITY x(o,ord)
       JOIN amp_attempts a ON a.id=o->>'id'))
     WHERE learner_id=$1`,
    [learnerId],
  );
  // Time on task: each worked day's minutes across that day's skills.
  await db.query("DELETE FROM amp_active_days WHERE learner_id=$1", [
    learnerId,
  ]);
  await db.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
     SELECT learner_id,day,'practice',skill_id,
       (($2::numeric*(0.55+0.9*abs(hashtext(day::text||learner_id))/2147483647.0))*60000*attempts/sum(attempts) OVER (PARTITION BY day))::bigint
     FROM amp_skill_days WHERE learner_id=$1`,
    [learnerId, person.minutes],
  );
  // The stored level on each Monday the student had worked, and on the last day.
  const { rows: counted } = await db.query(
    `SELECT ((outcome->>'createdAt')::timestamptz AT TIME ZONE $2)::date::text AS day,count(*)::int AS answers
     FROM amp_attempts WHERE learner_id=$1 GROUP BY 1 ORDER BY 1`,
    [learnerId, timezone],
  );
  await db.query("DELETE FROM amp_level_days WHERE learner_id=$1", [learnerId]);
  let total = 0;
  const lastDay = counted.at(-1)?.day;
  for (const { day, answers } of counted) {
    total += answers;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday > 2 && day !== lastDay) continue;
    const frontier = await learning.transaction(
      student.accountId,
      student.learnerId,
      (tx) => tx.frontierAfter(total),
    );
    await db.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')
       ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
      [
        learnerId,
        day,
        {
          overall: frontier.overall,
          strands: frontier.strands,
        },
      ],
    );
  }
}

/** A whole class's term: everyone answers through the API, a few at a time;
 * the shared gap and the stuck student miss their idea lately; most gain new
 * ground in the last weeks; then every rollup is rebuilt from the dates. */
export async function seedClass(
  world: ClassWorld,
  options: {
    personas: readonly Persona[];
    /** By given name. */
    students: ReadonlyMap<string, Student>;
    /** Days ago the year began. */
    start: number;
    timezone: string;
    sharedGap?: { people: readonly string[]; template: string } | null;
    stuck?: { person: string; template: string } | null;
    /** Students answering at once. */
    concurrency?: number;
  },
) {
  const { personas, students, start, timezone } = options;
  const student = (name: string) => {
    const found = students.get(name);
    assert.ok(found, `No student named ${name}`);
    return found;
  };
  const queue = [...personas];
  await Promise.all(
    Array.from({ length: options.concurrency ?? 6 }, async () => {
      for (let person = queue.shift(); person; person = queue.shift())
        await seedStudent(world, person, student(person.name[0]), start);
    }),
  );
  const gap = options.sharedGap === undefined ? SHARED_GAP : options.sharedGap;
  if (gap)
    for (const name of gap.people)
      await seedMisses(world, student(name), gap.template, [3, 2, 1]);
  const stuck = options.stuck === undefined ? STUCK : options.stuck;
  if (stuck)
    await seedMisses(world, student(stuck.person), stuck.template, [4, 2, 1]);
  for (const person of personas)
    if (person.every < 40)
      await seedGains(
        world,
        person,
        student(person.name[0]),
        Math.max(1, Math.round(person.ability - 2.4)),
      );
  for (const person of personas)
    await rebuild(world, person, student(person.name[0]), timezone);
}
