import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import {
  can,
  loadActor,
  rosterScope,
  type Actor,
  type SchoolTarget,
} from "./authz.js";
import { activeToday } from "./principal.js";
import { pageSchema, SchoolError, type SchoolAction } from "./contracts.js";
import { SchoolRepository } from "./repository.js";
import {
  canList,
  defineSetupRoutes,
  registerInvitePreview,
} from "./setup-routes.js";

type TargetInput = { params: Record<string, string>; body: unknown };
/** Which thing a request is about, before it is looked up. */
type TargetRef =
  | { kind: "self" }
  | { kind: "org"; orgId: string }
  | { kind: "class"; orgId: string; classId: string }
  | { kind: "person"; orgId: string; personId: string };
type Loaded<R extends TargetRef> = Extract<SchoolTarget, { kind: R["kind"] }>;
export type SchoolRouteContext<T extends SchoolTarget = SchoolTarget> = {
  request: FastifyRequest;
  reply: FastifyReply;
  actor: Actor;
  target: T;
  repository: SchoolRepository;
  services: SchoolServices;
};
/** What school routes need from the server around them. */
export type SchoolServices = {
  /** Derives invitation links; never leaves the server. */
  secret: string;
  /** Where links in mail and on screen point. */
  origin: string;
  /** The account mail path. Absent: invitations rely on their copied link. */
  mail?: (
    to: string,
    subject: string,
    text: string,
    url: string,
  ) => Promise<void>;
  /** Public OAuth client IDs, for the IT handoff page. */
  signIn?: { google?: string; microsoft?: string };
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
  if (ref.kind === "person") {
    if (!isId(ref.personId)) return null;
    const found = (
      await pool.query(
        `SELECT r.org_id,o.path,
           ARRAY(SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs eo ON eo.id=c.org_id
             WHERE e.person_id=r.person_id AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "eo")}) AS class_ids
         FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         JOIN amp_people p ON p.id=r.person_id AND p.deleted_at IS NULL
         WHERE r.person_id=$1 AND r.role='student' AND o.path @> ARRAY[$2]::uuid[] AND ${activeToday("r", "o")}
         ORDER BY r.begin_on DESC LIMIT 1`,
        [ref.personId, ref.orgId],
      )
    ).rows[0];
    return found
      ? {
          kind: "person",
          personId: ref.personId,
          orgId: found.org_id,
          path: found.path,
          classIds: found.class_ids,
        }
      : null;
  }
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
/** Who to attribute a change to: the actor's person in this target's tenant. */
export function actorPerson(
  actor: Actor,
  target: { path: string[] },
): string | null {
  return (
    actor.roles.find((role) => target.path.includes(role.orgId))?.personId ??
    actor.classes.find((c) => target.path.includes(c.orgId))?.personId ??
    null
  );
}
const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 500;

export async function registerSchoolRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    services?: SchoolServices;
  },
): Promise<void> {
  const repository = new SchoolRepository(options.pool);
  const services: SchoolServices = options.services ?? {
    secret: randomBytes(32).toString("hex"),
    origin: "",
  };
  app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply.header("X-Request-Id", request.id);
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.setErrorHandler((error, request, reply) => {
      if (error instanceof SchoolError)
        return reply.code(error.statusCode).send({ error: error.code });
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
    registerInvitePreview(scope, repository);
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
          return route.handler({
            request,
            reply,
            actor,
            target,
            repository,
            services,
          });
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
  handler: async ({ actor, target, repository }) => {
    const org = await repository.orgFor(actor.accountId, target.orgId);
    return {
      org: org && {
        ...org,
        can: canList({ actor, target }),
        teaches: actor.classes
          .filter((c) => c.role === "teacher" && c.path.includes(target.orgId))
          .map((c) => c.classId),
      },
    };
  },
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
        // Someone who teaches here teaches the class they just made.
        actor.roles.find(
          (role) => role.role === "teacher" && target.path.includes(role.orgId),
        )?.personId,
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
    const rows = await repository.students(
      target.orgId,
      rosterScope(actor, target),
      page,
    );
    const total = rows[0]?.total ?? 0;
    const students = rows.map(({ total: _total, ...student }) => student);
    return { students, total, nextOffset: nextOffset(rows, page) };
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
defineSetupRoutes(defineSchoolRoute);
