import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../../server/auth.js";
import type { Repository } from "../../server/repository.js";
import { SchoolError } from "../contracts.js";
import { isSchoolAccount, studentBearer } from "../principal.js";
import type { defineSchoolRoute } from "../routes.js";
import { createDemo, demoKinds } from "./build.js";
import { removeDemos } from "./remove.js";

const timezone = z
  .string()
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  });
export const createDemoSchema = z.strictObject({
  kind: z.enum(demoKinds),
  /** The device's own zone, so the demo's today is the viewer's. */
  timezone: timezone.optional(),
});
const removeDemoSchema = z.strictObject({ kind: z.enum(demoKinds).optional() });

/** Any signed-in adult account; never a student's session. */
async function ownerOf(
  request: Parameters<Authenticator>[0],
  authenticate: Authenticator,
) {
  if (studentBearer(request)) throw new SchoolError(401, "sign_in_required");
  const accountId = await authenticate(request);
  if (isSchoolAccount(accountId)) throw new SchoolError(404, "not_found");
  return accountId;
}

/** `POST /api/v1/school/demo` makes (or reopens) the caller's demo class or
 * school; `DELETE` removes theirs with all its data. */
export function registerDemoRoutes(
  scope: FastifyInstance,
  options: { pool: Pool; authenticate: Authenticator; learning?: Repository },
) {
  scope.post(
    "/api/v1/school/demo",
    { bodyLimit: 1024 },
    async (request, reply) => {
      const accountId = await ownerOf(request, options.authenticate);
      const input = createDemoSchema.parse(request.body ?? {});
      const place = await createDemo(
        options.pool,
        { accountId, ...input },
        options.learning,
      );
      return reply.code(place.created ? 201 : 200).send({
        demo: {
          kind: input.kind,
          orgId: place.orgId,
          classId: place.classId,
          path: `school/${place.orgId}/classes/${place.classId}/today`,
        },
      });
    },
  );
  scope.delete("/api/v1/school/demo", async (request) => {
    const accountId = await ownerOf(request, options.authenticate);
    const { kind } = removeDemoSchema.parse(request.query ?? {});
    return { removed: await removeDemos(options.pool, accountId, kind) };
  });
}

/** "Practice as": the owner of a demo opens practice as one of its made-up
 * students, with the same session a picture sign-in issues. Only a student of
 * a demo this account owns: a real student is never found here. */
export function defineDemoRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "POST",
    url: "/api/v1/school/demo/students/:student/session",
    action: "signin.manage",
    target: ({ params }) =>
      ({ kind: "student", personId: params.student! }) as const,
    bodyLimit: 256,
    handler: async ({ actor, target, repository, reply }) => {
      if (!target.demo) throw new SchoolError(404, "not_found");
      const owned = await repository.pool.query(
        "SELECT 1 FROM amp_orgs WHERE id=$1 AND demo AND created_by=$2",
        [target.path[0], actor.accountId],
      );
      if (!owned.rowCount) throw new SchoolError(404, "not_found");
      return reply.code(201).send(
        await repository.issueStudentSession({
          personId: target.personId,
          mode: "shared",
        }),
      );
    },
  });
}
