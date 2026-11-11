import type { FastifyReply } from "fastify";
import { z } from "zod";
import { createProfile, studentLevels } from "../account/practice-profiles.js";
import { FamilyRepository } from "../family/repository.js";
import { profileLabelSchema } from "../learning/practice-profiles.js";
import type { Readable } from "node:stream";
import type { Pool } from "pg";
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
import { fileName, paperQuery, renderReportPdf } from "../reports/print.js";
import { progressReportHtml } from "../reports/progress-report.js";
import { reportCardsHtml } from "../reports/report-cards.js";
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

const reportCardsPdfQuery = paperQuery.extend({
  term: z.uuid(),
  student: z.uuid().optional(),
});
const classParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const CLASS = "/api/v1/school/classes/:class";
const download = (
  reply: FastifyReply,
  type: string,
  filename: string,
  body: Readable | Buffer,
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
        await classContext(pool, target.classId, services.now?.()),
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
    handler: async ({ actor, target, pool, services }) =>
      readMap(
        pool,
        await classContext(pool, target.classId, services.now?.()),
        actor.accountId,
      ),
  });
  define({
    method: "GET",
    url: `${CLASS}/gradebook`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, actor, target, pool, services }) => {
      const { term } = gradebookQuerySchema.parse(request.query);
      return readGradebook(
        pool,
        await classContext(pool, target.classId, services.now?.()),
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
    handler: async ({ request, actor, target, pool, repository, services }) => {
      const { term: termId } = closeTermSchema.parse(request.body);
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
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
    handler: async ({ request, actor, target, pool, repository, services }) => {
      const { minutes } = weeklyTargetSchema.parse(request.body);
      return setWeeklyTarget(
        repository,
        await classContext(pool, target.classId, services.now?.()),
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
    handler: async ({ request, actor, target, pool, repository, services }) => {
      const body = finalGradeSchema.parse(request.body);
      const { student } = request.params as { student: string };
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
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
    handler: async ({ request, actor, target, pool, services }) => {
      const { term, offset } = evidenceQuerySchema.parse(request.query);
      const { student } = request.params as { student: string };
      const evidence = await readEvidence(
        pool,
        await classContext(pool, target.classId, services.now?.()),
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
    handler: async ({ request, target, pool, services }) => {
      const { period } = timeQuerySchema.parse(request.query);
      return readTime(
        pool,
        await classContext(pool, target.classId, services.now?.()),
        period,
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/students/:student/time`,
    action: "students.read",
    target: classParam,
    handler: async ({ request, target, pool, services }) => {
      const { period } = timeQuerySchema.parse(request.query);
      const { student } = request.params as { student: string };
      const time = await readStudentTime(
        pool,
        await classContext(pool, target.classId, services.now?.()),
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
    handler: async ({ request, target, pool, services }) => {
      const { term } = oneRosterExportSchema.parse(request.query);
      return readReportCards(
        pool,
        await classContext(pool, target.classId, services.now?.()),
        term,
      );
    },
  });
  // The term's report cards as one PDF, a page each, or one student's.
  define({
    method: "GET",
    url: `${CLASS}/report-cards.pdf`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, reply, target, pool, services }) => {
      const query = reportCardsPdfQuery.parse(request.query);
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
      const data = await readReportCards(pool, context, query.term);
      const students = data.students.filter(
        (student) => !query.student || student.id === query.student,
      );
      if (!students.length) throw new SchoolError(404, "not_found");
      const { html, footer } = reportCardsHtml({
        paper: query.format,
        data,
        students,
        today: context.today,
      });
      const pdf = await renderReportPdf(
        services.renderer,
        { html, format: query.format, footer },
        request.log,
        "Report cards",
      );
      if (!pdf) throw new SchoolError(503, "report_unavailable", 30);
      return download(
        reply,
        "application/pdf",
        `${fileName(
          "amp-report-card",
          query.student ? students[0]!.name : context.name,
          data.term.name,
        )}.pdf`,
        pdf,
      );
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/exports/gradebook.csv`,
    action: "grades.read",
    target: classParam,
    handler: async ({ request, reply, target, pool, services }) => {
      const { term: termId, columns } = gradebookExportSchema.parse(
        request.query,
      );
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
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
    handler: async ({ request, reply, target, pool, services }) => {
      const { period } = timeQuerySchema.parse(request.query);
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
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
    handler: async ({ request, reply, target, pool, services }) => {
      const { term: termId } = oneRosterExportSchema.parse(request.query);
      const context = await classContext(
        pool,
        target.classId,
        services.now?.(),
      );
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
    handler: ({ actor, target, pool }) => studentRecord(pool, actor, target),
  });
  // The record as a printed progress report, rendered for this request and
  // never stored: it names the student.
  define({
    method: "GET",
    url: "/api/v1/school/students/:student/record.pdf",
    action: "students.read",
    target: ({ params }) =>
      ({ kind: "student", personId: params.student! }) as const,
    handler: async ({ request, reply, actor, target, pool, services }) => {
      const { format } = paperQuery.parse(request.query);
      const record = await studentRecord(pool, actor, target);
      const today = (
        await pool.query(
          "SELECT to_char(now() AT TIME ZONE COALESCE(timezone,'America/New_York'),'YYYY-MM-DD') AS today FROM amp_people WHERE id=$1",
          [target.personId],
        )
      ).rows[0]?.today as string;
      const { html, footer } = progressReportHtml({
        paper: format,
        name: record.student.name,
        first: record.student.first,
        subtitle: record.classes.map((entry) => entry.name).join(", "),
        facts: [
          ...(record.orgName
            ? [{ label: "School", value: record.orgName }]
            : []),
          ...(record.student.identifier
            ? [{ label: "Student ID", value: record.student.identifier }]
            : []),
        ],
        today,
        record,
        grades: record.grades,
      });
      const pdf = await renderReportPdf(
        services.renderer,
        { html, format, footer },
        request.log,
        "Progress report",
      );
      if (!pdf) throw new SchoolError(503, "report_unavailable", 30);
      return download(
        reply,
        "application/pdf",
        `${fileName("amp-progress", record.student.name, today)}.pdf`,
        pdf,
      );
    },
  });
  // "Try problems as this student" (docs/families.md): a practice profile of
  // the reader's own account, copied once from the student's levels now.
  // Whoever can read the record can copy it; the copy holds whole levels and
  // the reader's label, never the student's name, and practicing as it never
  // touches the student.
  define({
    method: "POST",
    url: "/api/v1/school/students/:student/practice-profile",
    action: "students.read",
    target: ({ params }) =>
      ({ kind: "student", personId: params.student! }) as const,
    bodyLimit: 1024,
    handler: async ({ actor, target, pool, request, reply }) => {
      const { label } = copyStudentSchema.parse(request.body ?? {});
      const levels = await studentLevels(pool, target.personId);
      if (!levels) throw new SchoolError(404, "not_found");
      const created = await createProfile(
        new FamilyRepository(pool),
        actor.accountId,
        { label, levels },
      );
      return reply.code(201).send({ ...created, levels });
    },
  });
}
const copyStudentSchema = z.strictObject({ label: profileLabelSchema });

/** One student's record, as far as this reader may see it. */
async function studentRecord(
  pool: Pool,
  actor: Actor,
  target: Extract<SchoolTarget, { kind: "student" }>,
) {
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
