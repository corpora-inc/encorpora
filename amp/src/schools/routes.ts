import { PERSON_NAME } from "./term-grades.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
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
import { classesQuerySchema, studentsQuerySchema } from "./org-contracts.js";
import { SchoolRepository } from "./repository.js";
import { defineSignInRoutes, registerJoinRoutes } from "./sign-in-routes.js";
import { defineTeacherRoutes } from "./teacher-routes.js";
import { defineOrgRoutes } from "./org-routes.js";
import { defineStandingRoutes } from "./standing-routes.js";
import { registerOidcRoutes, type OidcProviders } from "./oidc.js";
import { syncSsoCredentials } from "./sso-credentials.js";
import {
  defineShareRoutes,
  registerCurriculumRoutes,
  registerInquiryRoute,
  registerShareExchange,
} from "./share-routes.js";
import {
  defineClassroomRoutes,
  registerStudentStandings,
} from "./classroom-routes.js";
import type { Repository } from "../server/repository.js";
import type { WorkbookRenderer } from "../workbook/pdf.js";
import {
  canList,
  defineSetupRoutes,
  registerInvitePreview,
} from "./setup-routes.js";
import { activeToday, studentBearer } from "./principal.js";
import { registerDemoRoutes, defineDemoRoutes } from "./demo/routes.js";
import { touchDemo } from "./demo/remove.js";
import {
  classRoster,
  levels,
  levelsQuerySchema,
  perDay,
  perSkill,
  rangeSchema,
  HEARTBEAT_BODY_LIMIT,
  recordHeartbeat,
  studentRoster,
  totals,
} from "./evidence.js";

type TargetInput = { params: Record<string, string>; body: unknown };
/** Which thing a request is about, before it is looked up. */
type TargetRef =
  | { kind: "self" }
  | { kind: "org"; orgId: string }
  | { kind: "class"; orgId?: string; classId: string }
  | { kind: "student"; personId: string };
type Loaded<R extends TargetRef> = Extract<SchoolTarget, { kind: R["kind"] }>;
export type SchoolRouteContext<T extends SchoolTarget = SchoolTarget> = {
  request: FastifyRequest;
  reply: FastifyReply;
  actor: Actor;
  target: T;
  repository: SchoolRepository;
  pool: Pool;
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
  /** Student sign-in through an outside provider. Absent: cards and codes only. */
  oidc?: OidcProviders;
  /** The learning store and PDF renderer behind a teacher's workbook stack. */
  learning?: Repository;
  renderer?: WorkbookRenderer | null;
  /** The clock school reads count "today" and "this week" from. Absent: the
   * wall clock. A test or a local preview pins it (main.ts, never in
   * production), so a rule that depends on the weekday can be shown on any
   * day. */
  now?: () => Date;
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
  if (ref.kind === "student") return loadStudent(pool, ref.personId);
  if (ref.orgId !== undefined && !isId(ref.orgId)) return null;
  if (ref.kind === "org") {
    const org = (
      await pool.query("SELECT path,demo FROM amp_orgs WHERE id=$1", [
        ref.orgId!,
      ])
    ).rows[0];
    return org
      ? {
          kind: "org",
          orgId: ref.orgId!,
          path: org.path,
          ...(org.demo ? { demo: true } : {}),
        }
      : null;
  }
  if (!isId(ref.classId)) return null;
  const found = (
    await pool.query(
      `SELECT c.org_id,o.path,o.demo FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE c.id=$1 AND c.archived_at IS NULL AND ($2::uuid IS NULL OR o.path @> ARRAY[$2]::uuid[])`,
      [ref.classId, ref.orgId ?? null],
    )
  ).rows[0];
  return found
    ? {
        kind: "class",
        classId: ref.classId,
        orgId: found.org_id,
        path: found.path,
        ...(found.demo ? { demo: true } : {}),
      }
    : null;
}
/** A student's home org is the one they attend today; their classes are the
 * ones they're in today. A removed or unrostered student isn't found. */
async function loadStudent(
  pool: Pool,
  personId: string,
): Promise<SchoolTarget | null> {
  if (!isId(personId)) return null;
  const home = (
    await pool.query(
      `SELECT o.id,o.path,o.demo FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student'
       JOIN amp_orgs o ON o.id=r.org_id
       WHERE p.id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
       ORDER BY r.begin_on DESC,o.id LIMIT 1`,
      [personId],
    )
  ).rows[0];
  if (!home) return null;
  const classes = await pool.query(
    `SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
     JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}`,
    [personId],
  );
  return {
    kind: "student",
    personId,
    orgId: home.id,
    path: home.path,
    classIds: classes.rows.map((row) => row.class_id),
    ...(home.demo ? { demo: true } : {}),
  };
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
    registerJoinRoutes(scope, repository, services.oidc);
    registerOidcRoutes(scope, repository, services);
    registerInvitePreview(scope, repository);
    registerStudentStandings(scope, options.pool);
    registerShareExchange(scope, options.pool);
    registerCurriculumRoutes(scope, services);
    registerInquiryRoute(scope, services);
    registerDemoRoutes(scope, {
      pool: options.pool,
      authenticate: options.authenticate,
      learning: services.learning,
    });
    // Students only: a staff or parent credential is never a student's.
    scope.post(
      "/api/v1/school/student/activity",
      { bodyLimit: HEARTBEAT_BODY_LIMIT },
      async (request, reply) => {
        const token = studentBearer(request);
        if (
          !token ||
          !(await recordHeartbeat(options.pool, token, request.body))
        )
          throw new SchoolError(401, "sign_in_required");
        return reply.code(204).send();
      },
    );
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
          // An opened demo stays: idle ones go after 30 days.
          if ("demo" in target && target.demo)
            void touchDemo(options.pool, target.orgId).catch((error) =>
              request.log.error({ code: error?.code }, "Demo visit not kept"),
            );
          return route.handler({
            request,
            reply,
            actor,
            target,
            repository,
            services,
            pool: options.pool,
          });
        },
      });
  });
}

const orgParam = ({ params }: TargetInput) =>
  ({ kind: "org", orgId: params.org! }) as const;
/** The orgs above this one that this person can open, for a breadcrumb. */
async function openableAncestors(
  repository: SchoolRepository,
  actor: Actor,
  target: Extract<SchoolTarget, { kind: "org" }>,
) {
  const above = target.path.filter(
    (id, index) =>
      id !== target.orgId &&
      can(actor, "org.read", {
        kind: "org",
        orgId: id,
        path: target.path.slice(0, index + 1),
      }),
  );
  if (!above.length) return [];
  const { rows } = await repository.pool.query(
    "SELECT id,name FROM amp_orgs WHERE id=ANY($1::uuid[])",
    [above],
  );
  return above.flatMap((id) => rows.filter((row) => row.id === id));
}
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
  handler: async ({ actor, target, repository, pool }) => {
    const org = await repository.orgFor(actor.accountId, target.orgId);
    const person = actorPerson(actor, target);
    return {
      org: org && {
        ...org,
        // The caller's own name here, so a list of teachers can say "You".
        personName: person
          ? (((
              await pool.query(
                `SELECT ${PERSON_NAME} AS name FROM amp_people p WHERE p.id=$1`,
                [person],
              )
            ).rows[0]?.name as string | undefined) ?? null)
          : null,
        can: canList({ actor, target }),
        teaches: actor.classes
          .filter((c) => c.role === "teacher" && c.path.includes(target.orgId))
          .map((c) => c.classId),
        ancestors: await openableAncestors(repository, actor, target),
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
    const { year } = classesQuerySchema.parse(request.query);
    const classes = await repository.classes(
      target.orgId,
      rosterScope(actor, target),
      page,
      year ?? null,
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
    const { status } = studentsQuerySchema.parse(request.query);
    const rows = await repository.students(
      target.orgId,
      rosterScope(actor, target),
      page,
      status ?? null,
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
  handler: async ({ request, reply, actor, target, repository }) => {
    const student = await repository.provisionStudent(
      target.orgId,
      request.body,
      actorPerson(actor, target),
    );
    // An address on a new student reaches any outside sign-in that's on.
    if ((request.body as { email?: unknown }).email)
      await repository.transaction((client) =>
        syncSsoCredentials(client, target.path[0]!),
      );
    return reply.code(201).send({ student });
  },
});

const classParam = ({ params }: TargetInput) =>
  ({ kind: "class", classId: params.class! }) as const;
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/classes/:class/activity",
  action: "students.read",
  target: classParam,
  handler: async ({ request, target, pool }) => {
    const range = rangeSchema.parse(request.query);
    const roster = await classRoster(pool, target.classId);
    return { range, students: await totals(pool, roster, range) };
  },
});
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/classes/:class/levels",
  action: "students.read",
  target: classParam,
  handler: async ({ request, target, pool }) => {
    const { on } = levelsQuerySchema.parse(request.query);
    const roster = await classRoster(pool, target.classId);
    return { on: on ?? null, students: await levels(pool, roster, on) };
  },
});
defineSchoolRoute({
  method: "GET",
  url: "/api/v1/school/students/:student/activity",
  action: "students.read",
  target: ({ params }) =>
    ({ kind: "student", personId: params.student! }) as const,
  handler: async ({ request, target, pool }) => {
    const range = rangeSchema.parse(request.query);
    const roster = await studentRoster(pool, target.personId);
    return {
      range,
      totals: (await totals(pool, roster, range))[0] ?? null,
      days: await perDay(pool, roster, range),
      skills: await perSkill(pool, roster, range),
    };
  },
});
defineSignInRoutes(defineSchoolRoute);

defineSetupRoutes(defineSchoolRoute);
defineTeacherRoutes(defineSchoolRoute);
defineOrgRoutes(defineSchoolRoute);
defineStandingRoutes(defineSchoolRoute);
defineClassroomRoutes(defineSchoolRoute);
defineShareRoutes(defineSchoolRoute);
defineDemoRoutes(defineSchoolRoute);
