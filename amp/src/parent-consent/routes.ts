import type { FastifyInstance } from "fastify";
import type { Authenticator } from "../server/auth.js";
import { ZodError } from "zod";
import { ConsentError } from "./contracts.js";
import { ConsentRepository } from "./repository.js";
export async function registerConsentRoutes(
  app: FastifyInstance,
  options: { repository: ConsentRepository; authenticate: Authenticator },
): Promise<void> {
  app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof ConsentError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof ZodError)
        return reply.code(400).send({ error: "invalid_consent_request" });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 503;
      return reply.code(status === 401 ? 401 : 503).send({
        error:
          status === 401 ? "sign_in_required" : "consent_service_unavailable",
      });
    });
    scope.get("/api/v1/consent", async (request) =>
      options.repository.view(await options.authenticate(request)),
    );
    scope.post(
      "/api/v1/consent/requests",
      {
        bodyLimit: 2048,
        config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
      },
      async (request) => {
        const account = await options.authenticate(request);
        await options.repository.begin(account, request.body);
        return options.repository.view(account);
      },
    );
    scope.post(
      "/api/v1/consent/acknowledge",
      {
        bodyLimit: 2048,
        config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
      },
      async (request) => {
        const account = await options.authenticate(request);
        await options.repository.acknowledge(account, request.body);
        return options.repository.view(account);
      },
    );
  });
}
