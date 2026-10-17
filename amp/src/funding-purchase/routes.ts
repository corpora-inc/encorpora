import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import {
  availableOffers,
  fundingOfferSchema,
  presentOffer,
  FundingPurchaseError,
  type FundingOffer,
} from "./contracts.js";
import { FundingPurchaseRepository } from "./repository.js";
import { renderFundingQuotePdf, validateQuoteFonts } from "./quote-pdf.js";
export async function registerFundingPurchaseRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    offers: readonly FundingOffer[];
    development?: boolean;
  },
) {
  const offers = options.offers.map((o) => fundingOfferSchema.parse(o));
  availableOffers(offers, new Date());
  await validateQuoteFonts(offers);
  const repository = new FundingPurchaseRepository(
    options.pool,
    offers,
    options.development,
  );
  const params = z.strictObject({ id: z.string().uuid() });
  app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof FundingPurchaseError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_funding_request" });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 503;
      return reply.code(status >= 400 && status < 500 ? status : 503).send({
        error:
          status === 401 ? "sign_in_required" : "funding_service_unavailable",
      });
    });
    scope.get("/api/v1/funding/offers", async (request) => {
      await options.authenticate(request);
      return { offers: availableOffers(offers, new Date()).map(presentOffer) };
    });
    scope.get("/api/v1/funding/requests", async (request) => ({
      requests: await repository.list(await options.authenticate(request)),
    }));
    scope.post("/api/v1/funding/requests", async (request) => {
      const account = await options.authenticate(request);
      return repository.present(
        account,
        await repository.create(account, request.body),
      );
    });
    scope.get("/api/v1/funding/requests/:id", async (request) => {
      const account = await options.authenticate(request);
      return repository.present(
        account,
        await repository.read(account, params.parse(request.params).id),
      );
    });
    scope.post("/api/v1/funding/requests/:id/status", async (request) => {
      const account = await options.authenticate(request);
      const { status } = z
        .strictObject({
          status: z.enum(["parent-reported-submitted", "cancelled"]),
        })
        .parse(request.body);
      return repository.present(
        account,
        await repository.update(
          account,
          params.parse(request.params).id,
          status,
        ),
      );
    });
    scope.get("/api/v1/funding/requests/:id/quote", async (request, reply) => {
      const record = await repository.read(
        await options.authenticate(request),
        params.parse(request.params).id,
      );
      if (
        record.orderId ||
        record.status === "cancelled" ||
        Date.parse(record.expiresAt) <= Date.now()
      )
        throw new FundingPurchaseError(409, "quote_unavailable");
      return reply
        .header(
          "Content-Security-Policy",
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        )
        .header(
          "Content-Disposition",
          `attachment; filename="education-quote-${record.id}.pdf"`,
        )
        .type("application/pdf")
        .send(Buffer.from(await renderFundingQuotePdf(record)));
    });
  });
  return repository;
}
