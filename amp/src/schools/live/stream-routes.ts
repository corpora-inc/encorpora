import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { can } from "../authz.js";
import { SchoolError } from "../contracts.js";
import { resolveStudentSession, studentBearer } from "../principal.js";
import type { defineSchoolRoute } from "../routes.js";
import type { LiveHub } from "./hub.js";
import { openSession } from "./sessions.js";
import type { StudentLive } from "./stream-contracts.js";
import { readStudentSignals } from "./signals.js";
import { studentClassIds, toStudentSession } from "./student.js";

/* The live streams (#2465, work package L2). Each connect is authorized
   afresh, the same way as the read beside it, and then holds no database
   connection: the hub writes to it. A stream ends by itself within 85–95 s,
   so a reader whose access ended is refused at the next connect. */

/** Over the hub's cap, or while the server stops: try again shortly (the
 * client polls the snapshot meanwhile). */
const busy = () => new SchoolError(503, "live_busy", 5);

/** `GET /api/v1/school/classes/:class/live/stream`: the staff stream, read
 * like the snapshot (`session.read`). Never a `snapshot` route: that would
 * hold a connection for the life of the stream. */
export function defineLiveStreamRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/live/stream",
    action: "session.read",
    target: ({ params }) =>
      ({ kind: "class", classId: params.class! }) as const,
    handler: async ({ request, reply, actor, target, live }) => {
      if (
        !live.attachStaff(request, reply, {
          classId: target.classId,
          manage: can(actor, "session.manage", target),
        })
      )
        throw busy();
      return reply;
    },
  });
}

/** The signed-in student this request carries, or 401. Students only: a
 * staff or parent credential is never a student's. */
async function student(pool: Pool, request: FastifyRequest) {
  const token = studentBearer(request);
  const session = token ? await resolveStudentSession(pool, token) : null;
  if (!session) {
    request.log.warn(
      { student: !!token, route: request.routeOptions.url },
      "Student live refused: no live student session",
    );
    throw new SchoolError(401, "sign_in_required");
  }
  return session;
}

/** What the student stream's `snapshot` says, read on its own: the poll a
 * client falls back to when a filter holds the stream. */
export async function readStudentLive(
  pool: Pool,
  personId: string,
  classIds: readonly string[],
): Promise<StudentLive> {
  const sessions = [];
  for (const classId of classIds) {
    const session = await openSession(pool, classId);
    if (session) sessions.push(toStudentSession(session));
  }
  const signals = await readStudentSignals(pool, personId);
  return { serverNow: new Date().toISOString(), sessions, signals };
}

/** `GET /api/v1/school/student/live` and `…/live/stream`: what a student
 * may see live of themselves. A child practicing on a parent's device has no
 * student token and no stream (v1). */
export function registerStudentLiveRoutes(
  scope: FastifyInstance,
  options: { pool: Pool; live: LiveHub },
) {
  scope.get("/api/v1/school/student/live", async (request) => {
    const { personId } = await student(options.pool, request);
    return readStudentLive(
      options.pool,
      personId,
      await studentClassIds(options.pool, personId),
    );
  });
  scope.get("/api/v1/school/student/live/stream", async (request, reply) => {
    const { personId } = await student(options.pool, request);
    const classIds = await studentClassIds(options.pool, personId);
    if (!options.live.attachStudent(request, reply, { personId, classIds }))
      throw busy();
    return reply;
  });
}
