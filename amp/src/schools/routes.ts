import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import {
  actorPerson,
  can,
  loadActor,
  rosterScope,
  type Actor,
  type SchoolTarget,
} from "./authz.js";
import { pageSchema, SchoolError, type SchoolAction } from "./contracts.js";
import { SchoolRepository } from "./repository.js";
import { defineSignInRoutes, registerJoinRoutes } from "./sign-in-routes.js";

type TargetInput = { params: Record<string, string>; body: unknown };
/** Which thing a request is about, before it is looked up. */
type TargetRef =
  | { kind: "self" }
  | { kind: "org"; orgId: string }
  | { kind: "class"; orgId: string; classId: string };
type Loaded<R extends TargetRef> = Extract<SchoolTarget, { kind: R["kind"] }>;
export type SchoolRouteContext<T extends SchoolTarget = SchoolTarget> = {
  request: FastifyRequest;
  reply: FastifyReply;
  actor: Actor;
  target: T;
  repository: SchoolRepository;
};
export type SchoolRoute = {
  method: "GET" | "POST";
  url: string;
  action: SchoolAction;
  target: (input: TargetInput) => TargetRef;
  handler: (context: SchoolRouteContext) => Promise<unknown>;
  bodyLimit?: number;
};
/** Every school route, so a test can walk them all against a cross-tenant
 * matrix. `registerSchoolRoutes` binds exactly this table. */
export const schoolRoutes: SchoolRoute[] = [];

/** The only way to add a school route. The request authenticates with the
 * parent authenticator, then `can` decides; anything else answers 404, so a
 * caller can't learn what exists in another school. */
export function defineSchoolRoute<R extends TargetRef>(route: {
  method: SchoolRoute["method"];
  url: string;
  action: SchoolAction;
  target: (input: TargetInput) => R;
  handler: (context: SchoolRouteContext<Loaded<R>>) => Promise<unknown>;
  bodyLimit?: number;
}): void {
  schoolRoutes.push(route as unknown as SchoolRoute);
}

const isId = (value: string) => z.uuid().safeParse(value).success;
async function loadTarget(
  pool: Pool,
  ref: TargetRef,
): Promise<SchoolTarget | null> {
  if (ref.kind === "self") return ref;
  if (!isId(ref.orgId)) return null;
  if (ref.kind === "org") {
    const org = (
      await pool.query("SELECT path FROM amp_orgs WHERE id=$1", [ref.orgId])
    ).rows[0];
    return org ? { kind: "org", orgId: ref.orgId, path: org.path } : null;
  }
  if (!isId(ref.classId)) return null;
  const found = (
    await pool.query(
      `SELECT c.org_id,o.path FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE c.id=$1 AND c.archived_at IS NULL AND o.path @> ARRAY[$2]::uuid[]`,
      [ref.classId, ref.orgId],
    )
  ).rows[0];
  return found
    ? {
        kind: "class",
        classId: ref.classId,
        orgId: found.org_id,
        path: found.path,
      }
    : null;
}
const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 500;

export async function registerSchoolRoutes(
  app: FastifyInstance,
  options: { pool: Pool; authenticate: Authenticator },
): Promise<void> {
  const repository = new SchoolRepository(options.pool);
  app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply.header("X-Request-Id", request.id);
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.setErrorHandler((error, request, reply) => {
      if (error instanceof SchoolError) {
        if (error.retryAfter) reply.header("Retry-After", error.retryAfter);
        return reply.code(error.statusCode).send({
          error: error.code,
          ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
        });
      }
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_school_request" });
      const status = statusOf(error);
      if (status === 401)
        return reply.code(401).send({ error: "sign_in_required" });
      if (status === 429)
        return reply.code(429).send({ error: "too_many_requests" });
      if (status >= 400 && status < 500)
        return reply.code(status).send({ error: "invalid_school_request" });
      // The code and constraint only: a database error's detail can quote a
      // whole row, and a row here holds a child's name.
      const failure = error as {
        code?: unknown;
        constraint?: unknown;
        message?: unknown;
      };
      request.log.error(
        {
          route: request.routeOptions.url,
          code: failure.code,
          constraint: failure.constraint,
        },
        String(failure.message ?? "School request failed"),
      );
      return reply.code(503).send({ error: "school_service_unavailable" });
    });
    registerJoinRoutes(scope, repository);
    for (const route of schoolRoutes)
      scope.route({
        method: route.method,
        url: route.url,
        ...(route.bodyLimit ? { bodyLimit: route.bodyLimit } : {}),
        handler: async (request, reply) => {
          const accountId = await options.authenticate(request);
          const actor = await loadActor(options.pool, accountId);
          const target = await loadTarget(
            options.pool,
            route.target({
              params: request.params as Record<string, string>,
              body: request.body,
            }),
          );
          if (!target || !can(actor, route.action, target))
            throw new SchoolError(404, "not_found");
          return route.handler({ request, reply, actor, target, repository });
        },
      });
  });
}

const orgParam = ({ params }: TargetInput) =>
  ({ kind: "org", orgId: params.org! }) as const;
const nextOffset = (
  rows: unknown[],
  page: { limit: number; offset: number },
) => (rows.length === page.limit ? page.offset + page.limit : null);

defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/orgs",
  action: "orgs.list",
  target: () => ({ kind: "self" }) as const,
  handler: async ({ actor, repository }) => ({
    orgs: await repository.myOrgs(actor.accountId),
  }),
});
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/orgs/:org",
  action: "org.read",
  target: orgParam,
  handler: async ({ actor, target, repository }) => ({
    org: await repository.orgFor(actor.accountId, target.orgId),
  }),
});
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/orgs/:org/classes",
  action: "classes.read",
  target: orgParam,
  handler: async ({ request, actor, target, repository }) => {
    const page = pageSchema.parse(request.query);
    const classes = await repository.classes(
      target.orgId,
      rosterScope(actor, target),
      page,
    );
    return { classes, nextOffset: nextOffset(classes, page) };
  },
});
defineSchoolRoute({
  method: "POST",
  url: "/api/v1/school/orgs/:org/classes",
  action: "classes.create",
  target: orgParam,
  bodyLimit: 4096,
  handler: async ({ request, reply, actor, target, repository }) =>
    reply.code(201).send({
      class: await repository.createClass(
        target.orgId,
        request.body,
        actorPerson(actor, target),
      ),
    }),
});
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/orgs/:org/students",
  action: "students.read",
  target: orgParam,
  handler: async ({ request, actor, target, repository }) => {
    const page = pageSchema.parse(request.query);
    const students = await repository.students(
      target.orgId,
      rosterScope(actor, target),
      page,
    );
    return { students, nextOffset: nextOffset(students, page) };
  },
});
defineSchoolRoute({
  method: "POST",
  url: "/api/v1/school/orgs/:org/students",
  action: "students.add",
  // A teacher adds to a class they teach; a whole-school add needs an admin.
  target: ({ params, body }) => {
    const classId = (body as { classId?: unknown } | null)?.classId;
    return typeof classId === "string"
      ? ({ kind: "class", orgId: params.org!, classId } as const)
      : ({ kind: "org", orgId: params.org! } as const);
  },
  bodyLimit: 4096,
  handler: async ({ request, reply, actor, target, repository }) =>
    reply.code(201).send({
      student: await repository.provisionStudent(
        target.orgId,
        request.body,
        actorPerson(actor, target),
      ),
    }),
});
defineSignInRoutes(defineSchoolRoute);
