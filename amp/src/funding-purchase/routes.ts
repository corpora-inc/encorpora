import { funnelVisitor } from "../analytics/visitor-header.js";
import {
  FundingInvoiceRepository,
  invoiceDocument,
} from "./invoice-intents.js";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { advertisingOptOut } from "../advertising/permission-contracts.js";
import type { Authenticator } from "../server/auth.js";
import {
  availableOffers,
  fundingOfferSchema,
  presentOffer,
  FundingPurchaseError,
  createFundingRequestSchema,
  type FundingOffer,
} from "./contracts.js";
import { FundingPurchaseRepository } from "./repository.js";
import { renderFundingQuotePdf, validateQuoteFonts } from "./quote-pdf.js";
import {
  acquisitionToken,
  linkPurchaseAcquisition,
} from "../advertising/acquisition.js";
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
  const invoices = new FundingInvoiceRepository(repository);
  const params = z.strictObject({ id: z.string().uuid() });
  app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
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
    scope.get("/api/v1/funding/invoice-offers", async (request) => {
      const { program } = z
        .strictObject({ program: z.string().regex(/^[a-z0-9-]{1,80}$/) })
        .parse(request.query);
      return {
        offers: invoices
          .offers()
          .filter((o) => o.programId === program)
          .map(presentOffer),
      };
    });
    scope.post(
      "/api/v1/funding/invoices",
      {
        bodyLimit: 4096,
        config: {
          rateLimit: {
            max: 10,
            timeWindow: "1 hour",
            keyGenerator: (request: { ip: string }) => request.ip,
          },
        },
      },
      async (request) => {
        const intent = await invoices.create(
          request.body,
          new Date(),
          acquisitionToken(request.headers),
          advertisingOptOut(request.headers)
            ? undefined
            : funnelVisitor(request.headers),
        );
        return {
          invoiceId: intent.id,
          totalMinor: intent.offer.subtotalMinor + intent.offer.taxMinor,
          merchantName: intent.offer.merchant.legalName,
          pdfBase64: Buffer.from(
            await renderFundingQuotePdf(invoiceDocument(intent)),
          ).toString("base64"),
          filename: `education-invoice-${intent.id}.pdf`,
          destinationUrl: intent.offer.destinationUrl,
          instructions: intent.offer.instructions,
          expiresAt: intent.expiresAt,
        };
      },
    );
    scope.get("/api/v1/funding/invoices", async (request) => ({
      invoices: (await invoices.list(await options.authenticate(request))).map(
        ({ parentEmail: _email, idempotencyKey: _key, ...intent }) => ({
          ...intent,
          offer: presentOffer(intent.offer),
        }),
      ),
    }));
    scope.post("/api/v1/funding/invoices/:id/discard", async (request) => {
      z.strictObject({ notSubmitted: z.literal(true) }).parse(request.body);
      await invoices.discard(
        await options.authenticate(request),
        params.parse(request.params).id,
      );
      return { discarded: true };
    });
    scope.post("/api/v1/funding/invoices/:id/claim", async (request) => {
      const account = await options.authenticate(request);
      const { learnerId } = z
        .strictObject({ learnerId: z.string().min(1).max(500) })
        .parse(request.body);
      const invoiceId = params.parse(request.params).id;
      const claimed = await invoices.claim(
        account,
        invoiceId,
        learnerId,
        new Date(),
        !advertisingOptOut(request.headers),
      );
      if (!advertisingOptOut(request.headers))
        await linkPurchaseAcquisition(
          options.pool,
          account,
          { invoiceId },
          { kind: "funding-request", id: claimed.id },
        );
      return repository.present(account, claimed);
    });
    scope.get("/api/v1/funding/invoices/:id/pdf", async (request, reply) => {
      const id = params.parse(request.params).id;
      const intent = (
        await invoices.list(await options.authenticate(request))
      ).find((i) => i.id === id);
      if (!intent) throw new FundingPurchaseError(404, "invoice_not_found");
      return reply
        .header(
          "Content-Disposition",
          `attachment; filename="education-invoice-${id}.pdf"`,
        )
        .type("application/pdf")
        .send(
          Buffer.from(await renderFundingQuotePdf(invoiceDocument(intent))),
        );
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
      let body = request.body;
      if (
        (request.headers["sec-gpc"] === "1" || request.headers.dnt === "1") &&
        body !== null &&
        typeof body === "object" &&
        !Array.isArray(body)
      ) {
        const { campaignAttribution: _ignored, ...purchase } = body as Record<
          string,
          unknown
        >;
        body = purchase;
      }
      const input = createFundingRequestSchema.parse(body);
      const fundingRequest = await repository.create(
        account,
        input,
        new Date(),
        advertisingOptOut(request.headers)
          ? undefined
          : funnelVisitor(request.headers),
      );
      await linkPurchaseAcquisition(
        options.pool,
        account,
        acquisitionToken(request.headers),
        { kind: "funding-request", id: fundingRequest.id },
      );
      return repository.present(account, fundingRequest);
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
    scope.get(
      "/api/v1/funding/requests/:id/:document",
      async (request, reply) => {
        const documentParams = z
          .strictObject({
            id: z.string().uuid(),
            document: z.enum(["quote", "invoice"]),
          })
          .parse(request.params);
        const record = await repository.read(
          await options.authenticate(request),
          documentParams.id,
        );
        const invoice = record.offer.documentPolicy === "named-student-invoice";
        if (documentParams.document !== (invoice ? "invoice" : "quote"))
          throw new FundingPurchaseError(404, "request_not_found");
        // Retain the original invoice for a verified order even after offer expiry.
        if (
          !(invoice && record.orderId) &&
          (!repository.offerAvailable(record) ||
            record.orderId ||
            record.status === "cancelled" ||
            Date.parse(record.expiresAt) <= Date.now())
        )
          throw new FundingPurchaseError(409, "quote_unavailable");
        return reply
          .header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          )
          .header(
            "Content-Disposition",
            `attachment; filename="education-${invoice ? "invoice" : "quote"}-${record.id}.pdf"`,
          )
          .type("application/pdf")
          .send(Buffer.from(await renderFundingQuotePdf(record)));
      },
    );
  });
  return repository;
}
