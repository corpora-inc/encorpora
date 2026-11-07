import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { actorPerson, can } from "./authz.js";
import { recordEvent } from "./events.js";
import {
  marksQuerySchema,
  saveMarksSchema,
  stackQuerySchema,
  stackWorkbookSchema,
} from "./classroom-contracts.js";
import {
  experienceView,
  setLeftOff,
  writeExperience,
} from "./classroom-settings.js";
import {
  makeStudentWorkbook,
  marksView,
  saveStudentMarks,
  stackView,
  studentWorkbookPdf,
} from "./classroom-workbooks.js";
import { SchoolError } from "./contracts.js";
import {
  resolveStudentToken,
  schoolPersonId,
  studentBearer,
} from "./principal.js";
import type { defineSchoolRoute, SchoolServices } from "./routes.js";
import { studentBoard, studentBoards } from "./standings.js";

const CLASS = "/api/v1/school/classes/:class";
const orgParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "org", orgId: params.org! }) as const;
const classParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const studentOf = (request: { params: unknown }) =>
  (request.params as { student: string }).student;
const isId = (value: string) => z.uuid().safeParse(value).success;
function learningFrom(services: SchoolServices) {
  if (!services.learning)
    throw new SchoolError(503, "school_service_unavailable");
  return services.learning;
}

/** Called once by `routes.ts`, which owns the table these join. */
export function defineClassroomRoutes(define: typeof defineSchoolRoute) {
  /* Student experience: one view at any scope, and each scope writes its own. */
  define({
    method: "GET",
    url: "/api/v1/school/orgs/:org/experience",
    action: "settings.read",
    target: orgParam,
    handler: ({ actor, target, pool }) => experienceView(pool, actor, target),
  });
  define({
    method: "POST",
    url: "/api/v1/school/orgs/:org/experience",
    action: "settings.write",
    target: orgParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      writeExperience(
        repository,
        actor,
        target,
        request.body,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "GET",
    url: `${CLASS}/experience`,
    action: "settings.read",
    target: classParam,
    handler: ({ actor, target, pool }) => experienceView(pool, actor, target),
  });
  define({
    method: "POST",
    url: `${CLASS}/experience`,
    action: "settings.write",
    target: classParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      writeExperience(
        repository,
        actor,
        target,
        request.body,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/standings`,
    action: "settings.write",
    target: classParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository }) =>
      setLeftOff(
        repository,
        actor,
        target,
        studentOf(request),
        request.body,
        actorPerson(actor, target),
      ),
  });

  /* The workbook stack. */
  define({
    method: "GET",
    url: `${CLASS}/workbooks`,
    action: "workbooks.read",
    target: classParam,
    handler: ({ request, actor, target, pool, services }) =>
      stackView(
        pool,
        target,
        can(actor, "workbooks.write", target) && !!services.learning,
        services.renderer,
        stackQuerySchema.parse(request.query).skill,
      ),
  });
  define({
    method: "GET",
    url: `${CLASS}/workbooks/marks`,
    action: "workbooks.read",
    target: classParam,
    handler: ({ request, actor, target, pool }) =>
      marksView(
        pool,
        target.classId,
        marksQuerySchema.parse(request.query),
        can(actor, "workbooks.write", target),
      ),
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/workbooks`,
    action: "workbooks.write",
    target: classParam,
    bodyLimit: 1024,
    handler: async ({ request, reply, target, pool, services }) => {
      const made = await makeStudentWorkbook(
        pool,
        learningFrom(services),
        target,
        studentOf(request),
        stackWorkbookSchema.parse(request.body),
      );
      return reply.code(made.status).send(made.body);
    },
  });
  define({
    method: "GET",
    url: `${CLASS}/students/:student/workbooks/:workbook/pdf`,
    action: "workbooks.read",
    target: classParam,
    handler: async ({ request, reply, target, pool, services }) => {
      const { workbook } = request.params as { workbook: string };
      if (!isId(workbook)) throw new SchoolError(404, "not_found");
      const { format } = z
        .strictObject({ format: z.enum(["Letter", "A4"]).optional() })
        .parse(request.query);
      const {
        pdf,
        record,
        format: used,
      } = await studentWorkbookPdf(
        pool,
        learningFrom(services),
        services.renderer,
        request.log,
        services.origin,
        target,
        studentOf(request),
        workbook,
        format,
      );
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="amp-workbook-${record.date}-${record.number}-${used}.pdf"`,
        )
        .send(pdf);
    },
  });
  define({
    method: "POST",
    url: `${CLASS}/students/:student/workbooks/:workbook/marks`,
    action: "workbooks.write",
    target: classParam,
    bodyLimit: 16 * 1024,
    handler: async ({ request, actor, target, pool, services }) => {
      const { workbook } = request.params as { workbook: string };
      if (!isId(workbook)) throw new SchoolError(404, "not_found");
      const { entries } = saveMarksSchema.parse(request.body);
      const student = studentOf(request);
      const saved = await saveStudentMarks(
        pool,
        learningFrom(services),
        target.classId,
        student,
        workbook,
        entries,
      );
      if (saved.recorded)
        await recordEvent(pool, {
          orgId: target.orgId,
          actorPersonId: actorPerson(actor, target),
          action: "workbook.marked",
          targetKind: "person",
          targetId: student,
          detail: { after: { workbookId: workbook, marks: saved.recorded } },
        });
      return saved;
    },
  });
}

/** A student's own boards: their token is the credential, and a staff or parent
 * sign-in is never a student's. */
export function registerStudentStandings(scope: FastifyInstance, pool: Pool) {
  const student = async (request: { headers: { authorization?: string } }) => {
    const token = studentBearer(request);
    const account = token && (await resolveStudentToken(pool, token));
    const personId = account && schoolPersonId(account);
    if (!personId) throw new SchoolError(401, "sign_in_required");
    return personId;
  };
  scope.get("/api/v1/school/student/standings", async (request) => ({
    boards: await studentBoards(pool, await student(request)),
  }));
  scope.get("/api/v1/school/student/standings/:class", async (request) => {
    const personId = await student(request);
    const { class: classId } = request.params as { class: string };
    if (!isId(classId)) throw new SchoolError(404, "not_found");
    return studentBoard(pool, personId, classId);
  });
}
