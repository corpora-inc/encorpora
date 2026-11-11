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
    `INSERT INTO amp_learner_weeks(learner_id,week,active_ms,attempts,assisted,
         lessons,hints,videos,examples,prints,lesson_ms,hint_ms,video_ms,example_ms,
         with_hint,with_lesson,with_video,with_example,with_person)
       SELECT learner_id,week,sum(active_ms)::bigint,sum(attempts)::int,sum(assisted)::int,
         sum(lessons)::int,sum(hints)::int,sum(videos)::int,sum(examples)::int,sum(prints)::int,
         sum(lesson_ms)::bigint,sum(hint_ms)::bigint,sum(video_ms)::bigint,sum(example_ms)::bigint,
         sum(with_hint)::int,sum(with_lesson)::int,sum(with_video)::int,sum(with_example)::int,sum(with_person)::int
       FROM (
         SELECT learner_id,date_trunc('week',day)::date AS week,active_ms,0 AS attempts,0 AS assisted,
           0 AS lessons,0 AS hints,0 AS videos,0 AS examples,0 AS prints,
           CASE WHEN surface='lesson' THEN active_ms ELSE 0 END AS lesson_ms,
           CASE WHEN surface='hint' THEN active_ms ELSE 0 END AS hint_ms,
           CASE WHEN surface='video' THEN active_ms ELSE 0 END AS video_ms,
           CASE WHEN surface='example' THEN active_ms ELSE 0 END AS example_ms,
           0 AS with_hint,0 AS with_lesson,0 AS with_video,0 AS with_example,0 AS with_person
         FROM amp_active_days WHERE learner_id IN (${learners})
         UNION ALL
         SELECT learner_id,date_trunc('week',day)::date,0,attempts,assisted,0,0,0,0,0,0,0,0,0,
           with_hint,with_lesson,with_video,with_example,with_person
         FROM amp_skill_days WHERE learner_id IN (${learners})
         UNION ALL
         SELECT learner_id,date_trunc('week',day)::date,0,0,0,
           CASE WHEN kind='lesson' THEN opened ELSE 0 END,CASE WHEN kind='hint' THEN opened ELSE 0 END,
           CASE WHEN kind='video' THEN opened ELSE 0 END,CASE WHEN kind='example' THEN opened ELSE 0 END,
           CASE WHEN kind='print' THEN opened ELSE 0 END,0,0,0,0,0,0,0,0,0
         FROM amp_help_days WHERE learner_id IN (${learners})
       ) facts GROUP BY learner_id,week
       ON CONFLICT(learner_id,week) DO UPDATE SET active_ms=EXCLUDED.active_ms,attempts=EXCLUDED.attempts,assisted=EXCLUDED.assisted,
         lessons=EXCLUDED.lessons,hints=EXCLUDED.hints,videos=EXCLUDED.videos,examples=EXCLUDED.examples,prints=EXCLUDED.prints,
         lesson_ms=EXCLUDED.lesson_ms,hint_ms=EXCLUDED.hint_ms,video_ms=EXCLUDED.video_ms,example_ms=EXCLUDED.example_ms,
         with_hint=EXCLUDED.with_hint,with_lesson=EXCLUDED.with_lesson,with_video=EXCLUDED.with_video,
         with_example=EXCLUDED.with_example,with_person=EXCLUDED.with_person`,
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
  // A student who seldom practices also comes on fewer days.
  await client.query(
    `CREATE TEMP TABLE seed_pick ON COMMIT DROP AS
       SELECT DISTINCT ON (learner,day,skill) learner,day,diligence,factor,skill FROM (
         SELECT s.learner,d.day,s.diligence,d.factor,p.skill,random() AS draw
         FROM seed_student s CROSS JOIN seed_day d CROSS JOIN generate_series(1,$1::int) k
         CROSS JOIN LATERAL (SELECT $2::jsonb->(LEAST(12,GREATEST(0,round(s.grade+s.ability*0.6)::int)))::text AS list) g
         CROSS JOIN LATERAL (SELECT g.list->>((d.week*2+k+(s.index%3)::int)%jsonb_array_length(g.list)) AS skill) p
         WHERE s.diligence>0 AND jsonb_array_length(g.list)>0
       ) picks
       -- A draw per student, day and pick: a filter on the student alone would
       -- be decided once for all their days.
       WHERE draw<0.82*LEAST(1,diligence/0.5)`,
    [options.skillsPerDay, JSON.stringify(byGrade)],
  );
  // Minutes first, then problems that fit in them: about a minute or two
  // each, never more than the time allows.
  await client.query(
    `ALTER TABLE seed_pick ADD COLUMN ms bigint;
     UPDATE seed_pick SET ms=floor((7+random()*9)*60000*diligence*factor/${Math.max(1, options.skillsPerDay - 1)})::bigint`,
  );
  await client.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT learner,day,'practice',skill,ms FROM seed_pick ON CONFLICT DO NOTHING`,
  );
  // Each problem is drawn on its own: about one in five comes back as spaced
  // review, and it's right without help at the student's own rate; one missed
  // alone may have had a hint. Memoize would reuse one draw for every row with
  // the same count, so it's off for this statement's transaction.
  await client.query("SET LOCAL enable_memoize=off");
  await client.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
       SELECT learner,day,skill,a.n,c.independent+c.right_helped,c.independent,c.helped,c.review,c.review_right
       FROM seed_pick
       CROSS JOIN LATERAL (SELECT LEAST((2+floor(random()*7*LEAST(1.2,diligence*factor)))::int,
         GREATEST(1,floor(ms/(60000*(0.8+random()*0.8)))::int)) AS n) a
       CROSS JOIN LATERAL (
         SELECT count(*) FILTER (WHERE review)::int AS review,
           count(*) FILTER (WHERE review AND alone)::int AS review_right,
           count(*) FILTER (WHERE alone)::int AS independent,
           count(*) FILTER (WHERE NOT alone AND helped)::int AS helped,
           count(*) FILTER (WHERE NOT alone AND helped AND fixed)::int AS right_helped
         FROM (
           SELECT p.review,random()<LEAST(0.92,0.6+0.2*seed_pick.diligence)-CASE WHEN p.review THEN 0 ELSE 0.05 END AS alone,
             random()<0.35 AS helped,random()<0.6 AS fixed
           FROM generate_series(1,a.n) k CROSS JOIN LATERAL (SELECT k>0 AND random()<0.2 AS review) p
         ) draws
       ) c
       ON CONFLICT DO NOTHING`,
  );
  await client.query("RESET enable_memoize");
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
