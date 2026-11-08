import type { FastifyReply } from "fastify";
import type { Readable } from "node:stream";
import { actorPerson, can, type Actor, type SchoolTarget } from "./authz.js";
import { perDay } from "./evidence.js";
import {
  fileSlug,
  gradebookCsv,
  oneRosterIds,
  oneRosterZip,
  timeCsv,
} from "./exports.js";
import { SchoolError } from "./contracts.js";
import type { defineSchoolRoute } from "./routes.js";
import {
  closeTerm,
  classContext,
  gradebookRows,
  setFinalGrade,
  setWeeklyTarget,
  termById,
  termRoster,
  termsFor,
  weeklyTargetFor,
} from "./term-grades.js";
import {
  closeTermSchema,
  evidenceQuerySchema,
  finalGradeSchema,
  gradebookExportSchema,
  gradebookQuerySchema,
  oneRosterExportSchema,
  timeQuerySchema,
  weeklyTargetSchema,
} from "./teacher-contracts.js";
import {
  periodRange,
  readEvidence,
  readGradebook,
  readMap,
  readReportCards,
  readStudentRecord,
  readStudentTime,
  readTime,
  readToday,
} from "./teacher-reads.js";

const classParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const CLASS = "/api/v1/school/classes/:class";
const download = (
  reply: FastifyReply,
  type: string,
  filename: string,
  body: Readable,
) =>
  reply
    .type(type)
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(body);

/** The teacher's screens: reads over rollups and level days for the class's own
 * roster, and the few writes a teacher makes. Registered beside every other
 * school route, so the cross-tenant walk covers them all. */
export function defineTeacherRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: `${CLASS}/today`,
    action: "students.read",
    target: classParam,
    handler: async ({ actor, target, pool, services }) => ({
      ...(await readToday(
        pool,
        await classContext(pool, target.classId),
        actorPerson(actor, target),
      )),
      canPrint: can(actor, "workbooks.write", target) && !!services.learning,
    }),
  });
  define({
    method: "GET",
    url: `${CLASS}/map`,
    action: "students.read",
    target: classParam,
    handler: async ({ actor, target, pool }) =>
      readMap(pool, await classContext(pool, target.classId), actor.accountId),
  });
  define({
    method: "GET",
    url: `${CLASS}/gradebook`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, actor, target, pool }) => {
      const { term } = gradebookQuerySchema.parse(request.query);
      return readGradebook(
        pool,
        await classContext(pool, target.classId),
        term,
        can(actor, "grades.write", target),
      );
    },
  });
  define({
    method: "POST",
    url: `${CLASS}/gradebook/close`,
    action: "grades.write",
    target: classParam,
    bodyLimit: 1024,
    handler: async ({ request, actor, target, pool, repository }) => {
      const { term: termId } = closeTermSchema.parse(request.body);
      const context = await classContext(pool, target.classId);
      const term = termById(await termsFor(pool, context), termId);
      return closeTerm(repository, context, term, actorPerson(actor, target));
    },
  });
  define({
    method: "POST",
    url: `${CLASS}/target`,
    action: "grades.write",
    target: classParam,
    bodyLimit: 1024,
    handler: async ({ request, actor, target, pool, repository }) => {
      const { minutes } = weeklyTargetSchema.parse(request.body);
      return setWeeklyTarget(
        repository,
        await classContext(pool, target.classId),
        minutes,
        actorPerson(actor, target),
      );
    },
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/final`,
    action: "grades.write",
    target: classParam,
    bodyLimit: 1024,
    handler: async ({ request, actor, target, pool, repository }) => {
      const body = finalGradeSchema.parse(request.body);
      const { student } = request.params as { student: string };
      const context = await classContext(pool, target.classId);
      const term = termById(await termsFor(pool, context), body.term);
      return setFinalGrade(
        repository,
        context,
        term,
        student,
        body.value,
        actorPerson(actor, target),
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/students/:student/evidence`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, actor, target, pool }) => {
      const { term, offset } = evidenceQuerySchema.parse(request.query);
      const { student } = request.params as { student: string };
      const evidence = await readEvidence(
        pool,
        await classContext(pool, target.classId),
        term,
        student,
        offset,
        can(actor, "grades.write", target),
      );
      if (!evidence) throw new SchoolError(404, "not_found");
      return evidence;
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/time`,
    action: "students.read",
    target: classParam,
    handler: async ({ request, target, pool }) => {
      const { period } = timeQuerySchema.parse(request.query);
      return readTime(pool, await classContext(pool, target.classId), period);
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/students/:student/time`,
    action: "students.read",
    target: classParam,
    handler: async ({ request, target, pool }) => {
      const { period } = timeQuerySchema.parse(request.query);
      const { student } = request.params as { student: string };
      const time = await readStudentTime(
        pool,
        await classContext(pool, target.classId),
        period,
        student,
      );
      if (!time) throw new SchoolError(404, "not_found");
      return time;
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/report-cards`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, target, pool }) => {
      const { term } = oneRosterExportSchema.parse(request.query);
      return readReportCards(
        pool,
        await classContext(pool, target.classId),
        term,
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/exports/gradebook.csv`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, reply, target, pool }) => {
      const { term: termId, columns } = gradebookExportSchema.parse(
        request.query,
      );
      const context = await classContext(pool, target.classId);
      const term = termById(await termsFor(pool, context), termId);
      const rows = await gradebookRows(
        pool,
        context,
        term,
        await weeklyTargetFor(pool, context),
      );
      return download(
        reply,
        "text/csv; charset=utf-8",
        `${fileSlug(context.name, term.name)}.csv`,
        gradebookCsv(rows, columns),
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/exports/time.csv`,
    action: "students.read",
    target: classParam,
    handler: async ({ request, reply, target, pool }) => {
      const { period } = timeQuerySchema.parse(request.query);
      const context = await classContext(pool, target.classId);
      const range = await periodRange(pool, context, period);
      const students = await termRoster(pool, context.id, range);
      const days = await perDay(
        pool,
        students.map(({ id, learnerId }) => ({ personId: id, learnerId })),
        range,
      );
      const byId = new Map(students.map((student) => [student.id, student]));
      const rows = days.flatMap((row) => {
        const student = byId.get(row.personId)!;
        return row.day >= student.from && row.day <= student.to
          ? [
              {
                identifier: student.identifier,
                name: student.name,
                day: row.day,
                minutes: row.activeMinutes,
                problems: row.problems,
              },
            ]
          : [];
      });
      return download(
        reply,
        "text/csv; charset=utf-8",
        `${fileSlug(context.name, "time", range.from, "to", range.to)}.csv`,
        timeCsv(rows),
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/exports/oneroster.zip`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, reply, target, pool }) => {
      const { term: termId } = oneRosterExportSchema.parse(request.query);
      const context = await classContext(pool, target.classId);
      const term = termById(await termsFor(pool, context), termId);
      const rows = await gradebookRows(
        pool,
        context,
        term,
        await weeklyTargetFor(pool, context),
      );
      return download(
        reply,
        "application/zip",
        `${fileSlug(context.name, term.name, "oneroster")}.zip`,
        oneRosterZip(
          term,
          context.name,
          rows,
          await oneRosterIds(pool, context, term.id, rows),
          new Date(),
        ),
      );
    },
  });
  define({
    method: "GET",
    url: "/api/v1/school/students/:student/record",
    action: "students.read",
    target: ({ params }) =>
      ({ kind: "student", personId: params.student! }) as const,
    handler: async ({ actor, target, pool }) => {
      const classes = await visibleClasses(pool, actor, target);
      const record = await readStudentRecord(
        pool,
        target.personId,
        classes,
        (classId) =>
          can(actor, "grades.read", {
            kind: "class",
            classId,
            orgId: classes.find((entry) => entry.id === classId)!.orgId,
            path: classes.find((entry) => entry.id === classId)!.path,
          }),
      );
      if (!record) throw new SchoolError(404, "not_found");
      return record;
    },
  });
}

/** Of the classes a student is in today, the ones this person can open. */
async function visibleClasses(
  pool: Parameters<typeof classContext>[0],
  actor: Actor,
  target: Extract<SchoolTarget, { kind: "student" }>,
) {
  if (!target.classIds.length) return [];
  const { rows } = await pool.query(
    `SELECT c.id,c.org_id AS "orgId",o.path FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     WHERE c.id=ANY($1::uuid[]) ORDER BY c.name,c.id`,
    [target.classIds],
  );
  return (rows as { id: string; orgId: string; path: string[] }[]).filter(
    (row) =>
      can(actor, "students.read", {
        kind: "class",
        classId: row.id,
        orgId: row.orgId,
        path: row.path,
      }),
  );
}
