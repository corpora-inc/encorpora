import { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply } from "fastify";
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
    scope.post("/api/v1/family/export-ticket", async (request) => {
      const account = await options.authenticate(request);
      empty.parse(request.body);
      return { ticket: await repository.issueExportTicket(account) };
    });
    // Native form downloads stream without sharing authority through cookies or URLs.
    // Reject duplicate fields before converting to an object.
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string", bodyLimit: 1024 },
      (_request, body, done) => {
        const fields = [...new URLSearchParams(String(body))];
        if (fields.length !== 1 || fields[0]![0] !== "ticket")
          return done(new FamilyError(400, "invalid_family_request"));
        done(null, { ticket: fields[0]![1] });
      },
    );
    const ticketBody = z.strictObject({
      ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    });
    scope.post(
      "/api/v1/family/export",
      { bodyLimit: 1024 },
      async (request, reply) => {
        const { ticket } = ticketBody.parse(request.body);
        return streamExport(
          await repository.consumeExportTicket(ticket),
          reply,
        );
      },
    );
    scope.get("/api/v1/family/export", async (request, reply) =>
      streamExport(await options.authenticate(request), reply),
    );
    function streamExport(account: string, reply: FastifyReply) {
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
    }
  });
  return repository;
}
