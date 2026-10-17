import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import { FamilyError } from "./contracts.js";
import { FamilyRepository } from "./repository.js";
export interface FamilyRouteOptions {
  pool: Pool;
  authenticate: Authenticator;
  development?: boolean;
}
export async function registerFamilyRoutes(
  app: FastifyInstance,
  options: FamilyRouteOptions,
): Promise<FamilyRepository> {
  const repository = new FamilyRepository(options.pool, options.development);
  const empty = z.strictObject({});
  const learnerParams = z.strictObject({
    learnerId: z.string().min(1).max(200),
  });
  app.register(async (scope) => {
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof FamilyError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_family_request" });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 500;
      return reply.code(status >= 400 && status < 500 ? status : 503).send({
        error:
          status === 401 ? "sign_in_required" : "family_service_unavailable",
      });
    });
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.get("/api/v1/family", async (request) =>
      repository.summary(await options.authenticate(request)),
    );
    scope.post("/api/v1/family/consent/withdraw", async (request) => {
      const account = await options.authenticate(request);
      empty.parse(request.body);
      await repository.withdraw(account);
      return { withdrawn: true };
    });
    scope.post("/api/v1/family/learners/:learnerId/rename", async (request) => {
      const account = await options.authenticate(request);
      const { learnerId } = learnerParams.parse(request.params);
      const { name } = z
        .strictObject({
          name: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
        })
        .parse(request.body);
      await repository.rename(account, learnerId, name);
      return { renamed: true };
    });
    scope.post(
      "/api/v1/family/learners/:learnerId/delete-learning-data",
      async (request) => {
        const account = await options.authenticate(request);
        const { learnerId } = learnerParams.parse(request.params);
        z.strictObject({
          confirmation: z.literal("delete-learning-data"),
        }).parse(request.body);
        return repository.deleteLearning(account, learnerId);
      },
    );
    scope.post("/api/v1/family/delete-learning-data", async (request) => {
      const account = await options.authenticate(request);
      z.strictObject({ confirmation: z.literal("delete-learning-data") }).parse(
        request.body,
      );
      return repository.deleteLearning(account);
    });
    const cookie = (value: string, age: number) =>
      `amp-export-ticket=${value}; Path=/api/v1/family/export; HttpOnly; SameSite=Strict; Max-Age=${age}${options.development ? "" : "; Secure"}`;
    scope.post("/api/v1/family/export-ticket", async (request, reply) => {
      const account = await options.authenticate(request);
      empty.parse(request.body);
      const ticket = await repository.issueExportTicket(account);
      reply.header("Set-Cookie", cookie(ticket, 60));
      return { ready: true };
    });
    scope.get("/api/v1/family/export", async (request, reply) => {
      let account: string;
      if (request.headers.authorization)
        account = await options.authenticate(request);
      else {
        const ticket = request.headers.cookie
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("amp-export-ticket="))
          ?.slice("amp-export-ticket=".length);
        if (!ticket) throw new FamilyError(401, "sign_in_required");
        account = await repository.consumeExportTicket(ticket);
        reply.header("Set-Cookie", cookie("", 0));
      }
      const abort = new AbortController();
      const stream = Readable.from(repository.export(account, abort.signal));
      const timeout = setTimeout(() => {
        abort.abort();
        stream.destroy(new Error("Export time limit exceeded"));
      }, 120_000);
      timeout.unref();
      reply.raw.once("close", () => {
        abort.abort();
        stream.destroy();
        clearTimeout(timeout);
      });
      stream.once("close", () => clearTimeout(timeout));
      return reply
        .type("application/x-ndjson; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="amp-family-export-${new Date().toISOString().slice(0, 10)}.ndjson"`,
        )
        .send(stream);
    });
  });
  return repository;
}
