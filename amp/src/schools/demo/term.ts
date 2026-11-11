/**
 * A term of synthetic practice written straight to the rollups: demo places
 * and the school fixtures need weeks of realistic work for hundreds or
 * thousands of students, far past what the practice API should be asked to
 * make. Every name it touches is already made up.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { skills } from "../../curriculum/catalog.js";
import { gradeNumber } from "../../learning/frontier.js";
import { templates } from "../../math/engine.js";
import {
  DEFAULT_FRONTIER_POLICY,
  learnerNoise,
  levelDocuments,
  misspecifiedCorrect,
  type LevelAnswer,
} from "./engine-levels.js";
import { hash } from "./personas.js";

const DAY = 86_400_000;
export const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const mondayOf = (time: number) => {
  const date = new Date(time);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
  );
};

/** A year and two semesters that began 12 weeks before this Monday, so a term
 * chart has shape. */
export async function seedCalendar(
  client: Pick<PoolClient, "query">,
  orgId: string,
  now = Date.now(),
) {
  const start = mondayOf(now) - 12 * 7 * DAY;
  const year = randomUUID();
  const end = start + 300 * DAY;
  const middle = start + 150 * DAY;
  const insert = (
    id: string,
    parent: string | null,
    kind: string,
    name: string,
    from: number,
    to: number,
  ) =>
    client.query(
      `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, parent, kind, name, iso(from), iso(to)],
    );
  const first = new Date(start).getUTCFullYear();
  await insert(
    year,
    null,
    "year",
    `${first}–${String(first + 1).slice(2)}`,
    start,
    end,
  );
  await insert(randomUUID(), year, "semester", "Semester 1", start, middle);
  await insert(randomUUID(), year, "semester", "Semester 2", middle + DAY, end);
  return { year, start: iso(start), end: iso(end) };
}

/** The week-by-week shape of a term: a slow start, a strong middle, a dip for a
 * break, then the last two weeks. Index 0 is the term's first week. */
export const TERM_SHAPE = [
  0.55, 0.68, 0.8, 0.86, 0.92, 0.82, 0.96, 1.02, 0.58, 0.94, 1.04, 1.08, 1.1,
] as const;
/** The same, with a short last week (a long weekend) and this week back up. */
export const SHORT_LAST_WEEK = [
  0.55, 0.68, 0.8, 0.86, 0.92, 0.82, 0.96, 1.02, 0.58, 0.94, 1.04, 0.74, 1.08,
] as const;

/** Skills a student practices on screen, by grade, in catalog order: those
 * with a problem type every device can show. */
export const practicableSkills: ReadonlyMap<number, readonly string[]> =
  (() => {
    const usable = new Set(
      templates
        .filter(
          (template) =>
            !template.requiredResponseCapability &&
            !template.requiredFigureCapability,
        )
        .map((template) => template.skillId),
    );
    const byGrade = new Map<number, string[]>();
    for (const skill of skills)
      if (usable.has(skill.id)) {
        const grade = gradeNumber[skill.gradeBand];
        byGrade.set(grade, [...(byGrade.get(grade) ?? []), skill.id]);
      }
    return byGrade;
  })();
/** A grade's practicable skills, or the nearest grade's that has some. */
export function skillsNear(grade: number): readonly string[] {
  for (let step = 0; step <= 12; step++)
    for (const at of [grade - step, grade + step]) {
      const found = practicableSkills.get(Math.max(0, Math.min(12, at)));
      if (found?.length) return found;
    }
  return [];
}

/** Each learner's weeks, summed from their day rollups: what the week
 * triggers would have added row by row. A bulk writer turns those off for its
 * transaction (`amp.rollup_weeks`) and calls this once. `learners` is internal
 * SQL selecting learner ids, never request input. */
export async function sumWeeks(
  client: Pick<PoolClient, "query">,
  learners: string,
  params: unknown[] = [],
) {
  await client.query(
    `INSERT INTO amp_learner_weeks(learner_id,week,active_ms,attempts)
       SELECT learner_id,week,sum(active_ms)::bigint,sum(attempts)::int FROM (
         SELECT learner_id,date_trunc('week',day)::date AS week,active_ms,0 AS attempts FROM amp_active_days
           WHERE learner_id IN (${learners})
         UNION ALL
         SELECT learner_id,date_trunc('week',day)::date,0,attempts FROM amp_skill_days
           WHERE learner_id IN (${learners})
       ) facts GROUP BY learner_id,week
       ON CONFLICT(learner_id,week) DO UPDATE SET active_ms=EXCLUDED.active_ms,attempts=EXCLUDED.attempts`,
    params,
  );
}

/** A term of practice for the students in the `seed_student` temp table, inside
 * the caller's open transaction: active time and skill days on real skills
 * around each student's level, level days on real strands, and their weeks.
 * `seed_student` has `learner text, grade int, ability float8, diligence
 * float8, pace float8, index bigint`. The week triggers wait for the end of
 * it, and the weeks are summed once. */
export async function seedTermEvidence(
  client: Pick<PoolClient, "query">,
  options: {
    yearStart: string;
    skillsPerDay: number;
    /** Activity by week from the term's start; the last entry repeats. */
    weekShape?: readonly number[];
  },
) {
  const shape = options.weekShape ?? TERM_SHAPE;
  await client.query("SET LOCAL amp.rollup_weeks='deferred'");
  const byGrade = Object.fromEntries(
    Array.from({ length: 13 }, (_, grade) => [grade, skillsNear(grade)]),
  );
  await client.query(
    `CREATE TEMP TABLE seed_day ON COMMIT DROP AS
       SELECT d::date AS day,floor((d::date-$1::date)/7)::int AS week,
         ($2::float8[])[LEAST(1+floor((d::date-$1::date)/7)::int,array_length($2::float8[],1))] AS factor
       FROM generate_series($1::date,LEAST(now()::date,$1::date+90),interval '1 day') d
       WHERE extract(isodow FROM d)<6`,
    [options.yearStart, shape],
  );
  // Each class works through its grade's skills a few a week, so a class
  // shares its week's skills; a student's ability moves them up or down a grade.
  await client.query(
    `CREATE TEMP TABLE seed_pick ON COMMIT DROP AS
       SELECT DISTINCT ON (s.learner,d.day,skill) s.learner,d.day,s.diligence,d.factor,skill
       FROM seed_student s CROSS JOIN seed_day d CROSS JOIN generate_series(1,$1::int) k
       CROSS JOIN LATERAL (SELECT $2::jsonb->(LEAST(12,GREATEST(0,round(s.grade+s.ability*0.6)::int)))::text AS list) g
       CROSS JOIN LATERAL (SELECT g.list->>((d.week*2+k+(s.index%3)::int)%jsonb_array_length(g.list)) AS skill) p
       WHERE s.diligence>0 AND jsonb_array_length(g.list)>0 AND random()<0.82`,
    [options.skillsPerDay, JSON.stringify(byGrade)],
  );
  await client.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT learner,day,'practice',skill,floor((7+random()*9)*60000*diligence*factor/$1)::bigint
       FROM seed_pick ON CONFLICT DO NOTHING`,
    [Math.max(1, options.skillsPerDay - 1)],
  );
  await client.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
       SELECT learner,day,skill,n,floor(n*0.8),floor(n*0.7),floor(n*0.1),floor(n*0.2),floor(n*0.15)
       FROM seed_pick CROSS JOIN LATERAL (SELECT (2+floor(random()*7*LEAST(1.2,diligence*factor)))::int AS n) a
       ON CONFLICT DO NOTHING`,
  );
  await client.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT s.learner,d.day,jsonb_build_object(
           'overall',jsonb_build_object('level',round((s.grade+s.ability+(d.day-$1::date)/90.0*0.45*s.diligence*s.pace)::numeric,2),'sd',0.35,'answered',20+d.week*10,'independent',14+d.week*7),
           'strands',jsonb_build_object(
             'operations',jsonb_build_object('level',round((s.grade+s.ability)::numeric,2),'sd',0.4,'answered',30,'independent',22),
             'fractions',jsonb_build_object('level',round((s.grade+s.ability-0.2)::numeric,2),'sd',0.45,'answered',30,'independent',20),
             'number',jsonb_build_object('level',round((s.grade+s.ability+0.1)::numeric,2),'sd',0.4,'answered',30,'independent',24),
             'measurement',jsonb_build_object('level',round((s.grade+s.ability+0.2)::numeric,2),'sd',0.5,'answered',20,'independent',14),
             'geometry',jsonb_build_object('level',round((s.grade+s.ability-0.1)::numeric,2),'sd',0.5,'answered',10,'independent',8))),
         'fixture'
       FROM seed_student s CROSS JOIN seed_day d
       WHERE s.diligence>0 AND extract(isodow FROM d.day) IN (1,3,5)`,
    [options.yearStart],
  );
  await sumWeeks(client, "SELECT learner FROM seed_student");
  await client.query("RESET amp.rollup_weeks");
}

const templateOfSkill = new Map<string, string>();
for (const template of templates)
  if (
    !template.requiredResponseCapability &&
    !template.requiredFigureCapability &&
    !templateOfSkill.has(template.skillId)
  )
    templateOfSkill.set(template.skillId, template.id);

/** The other classes of a demo school: the same term shape as the rollup
 * writer, but every level day is the production estimator's posterior after
 * answers that were actually inserted. The 10,000-student load fixture keeps
 * `seedTermEvidence`, which does not replay the estimator. */
export async function seedEngineTerm(
  client: Pick<PoolClient, "query">,
  options: {
    yearStart: string;
    skillsPerDay: number;
    weekShape?: readonly number[];
    now?: number;
  },
) {
  const shape = options.weekShape ?? TERM_SHAPE;
  const now = options.now ?? Date.now();
  const start = Date.parse(`${options.yearStart}T12:00:00Z`);
  const end = Math.min(now, start + 90 * DAY);
  const students = (
    await client.query<{
      learner: string;
      grade: number;
      ability: number;
      diligence: number;
      pace: number;
    }>(
      `SELECT learner, grade::int, ability::float8, diligence::float8, pace::float8
       FROM seed_student WHERE diligence > 0`,
    )
  ).rows;
  const attempts: {
    learner: string;
    instance: string;
    content: string;
    outcome: string;
    at: string;
  }[] = [];
  const active: [string, string, string, number][] = [];
  const levels: [string, string, string][] = [];
  for (const student of students) {
    const name = student.learner;
    const noise = learnerNoise(name);
    const answers: LevelAnswer[] = [];
    const levelDays: string[] = [];
    for (let time = start; time <= end; time += DAY) {
      const day = iso(time);
      const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const week = Math.floor((time - start) / (7 * DAY));
      const factor = shape[Math.min(week, shape.length - 1)]!;
      if (hash(`${name}${day} show`) > 0.82) continue;
      const progress = (time - start) / (90 * DAY);
      const theta =
        student.grade +
        student.ability +
        progress * 0.45 * student.diligence * student.pace;
      const grade = Math.max(
        0,
        Math.min(12, Math.round(student.grade + student.ability * 0.6)),
      );
      const list = skillsNear(grade);
      if (!list.length) continue;
      const picked = Array.from({ length: options.skillsPerDay }, (_, k) => {
        const skill =
          list[
            (week * 2 + k + Math.floor(hash(`${name}${day}${k}`) * 3)) %
              list.length
          ]!;
        return skill;
      });
      const skillsToday = [...new Set(picked)];
      for (const [k, skill] of skillsToday.entries()) {
        const templateId = templateOfSkill.get(skill);
        if (!templateId) continue;
        const n = Math.max(
          2,
          Math.round(2 + 2 * Math.min(1, student.diligence * factor)),
        );
        active.push([
          student.learner,
          day,
          skill,
          Math.round((8 + 6 * hash(`${name}${day}min`)) * 60_000 * factor),
        ]);
        for (let item = 0; item < n; item++) {
          const correct = misspecifiedCorrect({
            key: `${name}${day}${skill}${item}`,
            theta,
            templateId,
            slip: noise.slip,
            guess: noise.guess,
          });
          const at = new Date(
            Date.parse(`${day}T15:00:00Z`) + (k * n + item) * 60_000,
          ).toISOString();
          const id = `${student.learner}:${day}:${skill}:${item}`.replace(
            /[^a-zA-Z0-9:_-]/g,
            "",
          );
          const problemId = `${id}:p`;
          attempts.push({
            learner: student.learner,
            instance: problemId,
            at,
            content: JSON.stringify({
              public: {
                id: problemId,
                skillId: skill,
                templateId,
                prompt: "",
                response: { kind: "number" },
              },
              answer: "1",
              explanation: [],
            }),
            outcome: JSON.stringify({
              id: `${id}:a`,
              requestId: `${id}:r`,
              problemId,
              skillId: skill,
              templateId,
              response: correct ? "1" : "0",
              correct,
              assisted: false,
              answer: "1",
              explanation: [],
              createdAt: at,
            }),
          });
          answers.push({
            templateId,
            correct,
            assisted: false,
            at,
            day,
          });
        }
      }
      if (dow === 1 || dow === 3 || dow === 5) levelDays.push(day);
    }
    for (const row of levelDocuments({
      start: student.grade,
      answers,
      days: levelDays,
    }))
      levels.push([student.learner, row.day, row.frontier]);
  }
  const column = <T>(rows: readonly T[], key: keyof T) =>
    rows.map((row) => row[key]);
  await client.query("SET LOCAL amp.rollup_weeks='deferred'");
  if (active.length)
    await client.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT l,d,'practice',s,m FROM unnest($1::text[],$2::date[],$3::text[],$4::bigint[]) AS t(l,d,s,m)
       ON CONFLICT DO NOTHING`,
      [
        column(active, 0),
        column(active, 1),
        column(active, 2),
        column(active, 3),
      ],
    );
  if (levels.length)
    await client.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT l,d,f::jsonb,$4 FROM unnest($1::text[],$2::date[],$3::text[]) AS t(l,d,f)
       ON CONFLICT DO NOTHING`,
      [
        column(levels, 0),
        column(levels, 1),
        column(levels, 2),
        DEFAULT_FRONTIER_POLICY.version,
      ],
    );
  if (attempts.length) {
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
  }
  await sumWeeks(client, "SELECT learner FROM seed_student");
  await client.query("RESET amp.rollup_weeks");
}

/** A week of what staff really do, for the activity log: grades set, cards
 * printed, pictures reset, a code rotated. From the `seed_class` (`id, org,
 * teacher`) and `seed_student` (`person, class, grade, index`) temp tables. */
export async function seedStaffEvents(
  client: Pick<PoolClient, "query">,
  timezone: string,
) {
  await client.query(
    `INSERT INTO amp_school_events(id,org_id,actor_person_id,action,target_kind,target_id,detail,"at")
       SELECT gen_random_uuid(),c.org,c.teacher,e.action,e.kind,
         CASE e.kind WHEN 'person' THEN s.person::text ELSE c.id::text END,
         CASE e.action
           WHEN 'grade.final-set' THEN jsonb_build_object('after',jsonb_build_object('value',(ARRAY['A','A-','B+','B','B-','C+','Pass'])[1+floor(random()*7)::int],'classId',c.id))
           WHEN 'student.updated' THEN jsonb_build_object('after',jsonb_build_object('gradeLevel',s.grade))
           ELSE '{}'::jsonb END,
         ((now() AT TIME ZONE $1)::date-1-(g/6)+interval '8 hours 20 minutes'+(g%6)*interval '71 minutes') AT TIME ZONE $1
       FROM generate_series(1,40) g
       CROSS JOIN LATERAL (SELECT * FROM seed_class c WHERE c.teacher IS NOT NULL ORDER BY c.id OFFSET (g*7)%(SELECT count(*) FROM seed_class WHERE teacher IS NOT NULL) LIMIT 1) c
       CROSS JOIN LATERAL (SELECT * FROM seed_student s WHERE s.class=c.id ORDER BY s.index OFFSET g%5 LIMIT 1) s
       CROSS JOIN LATERAL (SELECT * FROM (VALUES
           ('grade.final-set','person'),('grade.final-set','person'),('student.card-issued','person'),
           ('student.pictures-reset','person'),('class.code-rotated','class'),('student.updated','person')
         ) AS v(action,kind) OFFSET g%6 LIMIT 1) e`,
    [timezone],
  );
}
