import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import { AccessGiftError } from "./contracts.js";
import { AccessGiftRepository } from "./repository.js";

export async function registerAccessGiftRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    development?: boolean;
  },
) {
  const repository = new AccessGiftRepository(
    options.pool,
    options.development,
  );
  app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("X-Request-Id", request.id);
    });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof AccessGiftError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_gift_request" });
      const unauthorized =
        !!error &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 401;
      return reply.code(unauthorized ? 401 : 503).send({
        error: unauthorized ? "sign_in_required" : "gift_service_unavailable",
      });
    });
    scope.post("/api/v1/access-grants/:id/activate", async (request) => {
      const account = await options.authenticate(request);
      const { id } = z.strictObject({ id: z.uuid() }).parse(request.params);
      const { learnerId } = z
        .strictObject({ learnerId: z.string().min(1).max(200) })
        .parse(request.body);
      return repository.activate(account, id, learnerId);
    });
  });
}
