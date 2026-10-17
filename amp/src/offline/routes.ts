import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import { ApiError } from "../server/repository.js";
import { OfflineRepository } from "./repository.js";
import type { PackSigner } from "./signing.js";
import { issueSchema, reconcileSchema } from "./contracts.js";
export async function registerOfflineRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    signer: PackSigner | null;
  },
) {
  const repository = options.signer
    ? new OfflineRepository(options.pool, options.signer)
    : null;
  const learnerParams = z.strictObject({ learnerId: z.string().uuid() });
  const packParams = learnerParams.extend({ packId: z.string().uuid() });
  await app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof ApiError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_offline_request" });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 503;
      const expected: Record<number, string> = {
        400: "invalid_offline_request",
        401: "sign_in_required",
        413: "request_too_large",
        429: "rate_limited",
      };
      return reply
        .code(expected[status] ? status : 503)
        .send({ error: expected[status] ?? "offline_service_unavailable" });
    });
    scope.addHook("onRequest", async (_req, reply) => {
      reply.header("Cache-Control", "no-store");
    });
    function ready() {
      if (!repository) throw new ApiError(503, "offline_packs_unavailable");
      return repository;
    }
    scope.post("/api/v1/learners/:learnerId/offline-packs", async (req) => {
      const account = await options.authenticate(req);
      return ready().issue(
        account,
        learnerParams.parse(req.params).learnerId,
        issueSchema.parse(req.body),
      );
    });
    scope.post(
      "/api/v1/learners/:learnerId/offline-packs/:packId/preflight",
      async (req) => {
        const account = await options.authenticate(req);
        const p = packParams.parse(req.params);
        z.strictObject({}).parse(req.body);
        return ready().preflight(account, p.learnerId, p.packId);
      },
    );
    scope.post(
      "/api/v1/learners/:learnerId/offline-packs/:packId/attempts",
      async (req) => {
        const account = await options.authenticate(req);
        const p = packParams.parse(req.params);
        return ready().reconcile(
          account,
          p.learnerId,
          p.packId,
          reconcileSchema.parse(req.body),
        );
      },
    );
  });
}
