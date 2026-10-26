import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import { changeAdvertisingPermission } from "./permission.js";
import {
  AdvertisingPermissionError,
  advertisingOptOut,
} from "./permission-contracts.js";
export async function registerAdvertisingPermissionRoutes(
  app: FastifyInstance,
  options: { pool: Pool; authenticate: Authenticator },
) {
  app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("X-Request-Id", request.id)
        .header("X-Content-Type-Options", "nosniff");
    });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof AdvertisingPermissionError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply
          .code(400)
          .send({ error: "invalid_purchase_measurement_request" });
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 503;
      return reply.code(status === 401 ? 401 : 503).send({
        error:
          status === 401
            ? "sign_in_required"
            : "purchase_measurement_unavailable",
      });
    });
    for (const [provider, path] of [
      ["google", "/api/v1/family/purchase-measurement"],
      ["meta", "/api/v1/family/meta-purchase-measurement"],
      ["openai", "/api/v1/family/openai-purchase-measurement"],
    ] as const)
      scope.post(path, { bodyLimit: 1024 }, async (request) =>
        changeAdvertisingPermission(
          options.pool,
          await options.authenticate(request),
          request.body,
          advertisingOptOut(request.headers),
          provider,
        ),
      );
  });
}
