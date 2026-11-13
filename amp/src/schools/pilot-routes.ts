import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { defineSchoolRoute } from "./routes.js";
import { planRoster, applyRoster } from "./reconcile.js";
import { actorPerson } from "./authz.js";
import { syncSsoCredentials } from "./sso-credentials.js";
import {
  startSchoolClass,
  activateClassPilot,
  acceptClassAuthorization,
  classPilotState,
  requestSchoolPurchase,
  buyerHandoff,
} from "./pilots.js";

export function definePilotRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "POST",
    url: "/api/v1/school/classes/:classId/roster/plan",
    action: "class.import",
    target: ({ params }) => ({ kind: "class", classId: params.classId! }),
    bodyLimit: 4 * 1024 * 1024,
    handler: async ({ repository, target, request }) => ({
      results: await planRoster(repository, target.orgId, request.body, {
        classId: target.classId,
      }),
    }),
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:classId/roster/apply",
    action: "class.import",
    target: ({ params }) => ({ kind: "class", classId: params.classId! }),
    bodyLimit: 4 * 1024 * 1024,
    handler: async ({ repository, target, request, services, actor }) => {
      const { results } = await applyRoster(
        repository,
        services,
        target.orgId,
        request.body,
        actorPerson(actor, target),
        { classId: target.classId },
      );
      await repository.transaction((client) =>
        syncSsoCredentials(client, target.path[0]!),
      );
      return { results, invited: 0 };
    },
  });
  define({
    method: "POST",
    url: "/api/v1/school/start",
    action: "school.start",
    target: () => ({ kind: "self" }),
    handler: ({ repository, actor, request }) =>
      startSchoolClass(repository, actor.accountId, request.body),
  });
  define({
    method: "GET",
    url: "/api/v1/school/classes/:classId/pilot",
    action: "pilot.read",
    target: ({ params }) => ({ kind: "class", classId: params.classId! }),
    handler: ({ pool, target, actor }) =>
      classPilotState(pool, target.classId, actor.accountId),
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:classId/pilot/activate",
    action: "pilot.manage",
    target: ({ params }) => ({ kind: "class", classId: params.classId! }),
    handler: ({ repository, actor, target }) =>
      activateClassPilot(repository, actor.accountId, target.classId),
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:classId/authorization",
    action: "class.authorize",
    target: ({ params }) => ({ kind: "class", classId: params.classId! }),
    handler: ({ repository, actor, target, request }) =>
      acceptClassAuthorization(
        repository,
        actor.accountId,
        target.classId,
        request.body,
      ),
  });
  define({
    method: "POST",
    url: "/api/v1/school/purchase-requests",
    action: "purchase.request",
    target: () => ({ kind: "self" }),
    handler: async ({ repository, actor, request, services }) => {
      const result = await requestSchoolPurchase(
        repository,
        actor.accountId,
        request.body,
      );
      return {
        id: result.id,
        url: `${services.origin}/schools/continue/${result.token}`,
      };
    },
  });
}

export function registerBuyerHandoff(app: FastifyInstance, pool: Pool) {
  app.get<{ Params: { token: string } }>(
    "/api/v1/school/buyer/:token",
    async (request, reply) => {
      reply.header("Referrer-Policy", "no-referrer");
      return buyerHandoff(pool, request.params.token);
    },
  );
}
