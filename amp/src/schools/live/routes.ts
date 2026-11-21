import { z } from "zod";
import { actorPerson, can } from "../authz.js";
import { pageSchema, SchoolError } from "../contracts.js";
import type { defineSchoolRoute } from "../routes.js";
import { startSessionBody } from "./contracts.js";
import {
  listSessions,
  readLiveSnapshot,
  readReport,
  startSession,
  stopSession,
} from "./sessions.js";

const classTarget = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "class", classId: params.class! }) as const;
const sessionId = (params: Record<string, string>) => {
  const parsed = z.uuid().safeParse(params.session);
  if (!parsed.success) throw new SchoolError(404, "not_found");
  return parsed.data;
};

/** Live class sessions (#2465): the snapshot and the session routes. A
 * family's class is a class, so its parents reach the same routes; `can`
 * decides (`session.read`, `session.manage`). The staff stream (L2) and the
 * signal routes (L4) register beside these. None is a `snapshot` route: the
 * reads close a session that is due, which writes. */
export function defineLiveRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/live",
    action: "session.read",
    target: classTarget,
    handler: ({ actor, target, pool }) =>
      readLiveSnapshot(
        pool,
        target.classId,
        can(actor, "session.manage", target),
      ),
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:class/sessions",
    action: "session.manage",
    target: classTarget,
    bodyLimit: 1024,
    handler: async ({ request, reply, actor, target, pool }) => {
      const { minutes } = startSessionBody.parse(request.body);
      const { session, created } = await startSession(pool, {
        classId: target.classId,
        startedBy: actorPerson(actor, target),
        ...(minutes ? { minutes } : {}),
      });
      return reply.code(created ? 201 : 200).send({ session });
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:class/sessions/:session/stop",
    action: "session.manage",
    target: classTarget,
    bodyLimit: 1024,
    handler: ({ request, actor, target, pool }) =>
      stopSession(pool, {
        classId: target.classId,
        sessionId: sessionId(request.params as Record<string, string>),
        endedBy: actorPerson(actor, target),
      }),
  });
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/sessions",
    action: "session.read",
    target: classTarget,
    handler: ({ request, target, pool }) => {
      const { limit, offset } = pageSchema.parse(request.query);
      return listSessions(pool, target.classId, {
        limit: Math.min(limit, 100),
        offset,
      });
    },
  });
  define({
    method: "GET",
    url: "/api/v1/school/classes/:class/sessions/:session",
    action: "session.read",
    target: classTarget,
    handler: async ({ request, target, pool }) => {
      const report = await readReport(
        pool,
        target.classId,
        sessionId(request.params as Record<string, string>),
      );
      if (!report) throw new SchoolError(404, "not_found");
      return report;
    },
  });
}
