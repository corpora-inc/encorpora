import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../../server/auth.js";
import { paymentHistory } from "./repository.js";
import { paymentPdf } from "./pdf.js";
import {
  receiptRequestSchema,
  type ReimbursementProgram,
} from "./reimbursement.js";
import { BillingError } from "../stripe/config.js";
/** Reads retained financial facts; no live Stripe credentials or learning consent required. */
export async function registerPaymentEvidenceRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    reimbursementPrograms?: ReimbursementProgram[];
  },
): Promise<void> {
  await app.register(async (scope) => {
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof BillingError)
        return reply.code(error.statusCode).send({ error: error.code });
      const unauthorized =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        error.statusCode === 401;
      return reply.code(unauthorized ? 401 : 503).send({
        error: unauthorized
          ? "sign_in_required"
          : "payment_records_unavailable",
      });
    });
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("X-Content-Type-Options", "nosniff");
    });
    scope.get("/api/v1/payments/reimbursement-programs", async (request) => {
      await options.authenticate(request);
      return { programs: options.reimbursementPrograms ?? [] };
    });
    scope.post<{ Params: { id: string } }>(
      "/api/v1/payments/:id/receipt.pdf",
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        const parsed = receiptRequestSchema.safeParse(request.body);
        if (!parsed.success)
          throw new BillingError("invalid_receipt_details", 400);
        if (!z.uuid().safeParse(request.params.id).success)
          throw new BillingError("payment_not_found", 404);
        const record = (
          await paymentHistory(options.pool, accountId, request.params.id)
        )[0];
        if (!record) throw new BillingError("payment_not_found", 404);
        const program = options.reimbursementPrograms?.find(
          (p) => p.id === parsed.data.programId,
        );
        if (parsed.data.programId && !program)
          throw new BillingError("reimbursement_program_unavailable", 400);
        if (
          program?.requiredFields.includes("learnerName") &&
          !parsed.data.learnerName
        )
          throw new BillingError("receipt_learner_name_required", 400);
        if (
          program?.requiredFields.includes("paymentMethod") &&
          !record.baseline?.paymentMethod
        )
          throw new BillingError("receipt_payment_method_unavailable", 409);
        const pdf = await paymentPdf(
          record,
          undefined,
          parsed.data.learnerName,
        );
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="payment-${request.params.id}.pdf"`,
          )
          .send(Buffer.from(pdf));
      },
    );
    scope.get<{ Querystring: { cursor?: string } }>(
      "/api/v1/payments",
      async (request) => {
        const accountId = await options.authenticate(request);
        let cursor: { createdAt: string; id: string } | undefined;
        if (request.query.cursor) {
          try {
            if (request.query.cursor.length > 300) throw new Error();
            cursor = z
              .object({ createdAt: z.string().datetime(), id: z.uuid() })
              .strict()
              .parse(
                JSON.parse(
                  Buffer.from(request.query.cursor, "base64url").toString(
                    "utf8",
                  ),
                ),
              );
          } catch {
            throw new BillingError("invalid_payment_cursor", 400);
          }
        }
        const rows = await paymentHistory(
          options.pool,
          accountId,
          undefined,
          cursor,
        );
        const records = rows.slice(0, 100),
          last = records.at(-1);
        const nextCursor =
          rows.length > 100 && last
            ? Buffer.from(
                JSON.stringify({ createdAt: last.createdAt, id: last.id }),
              ).toString("base64url")
            : null;
        return {
          records: records.map((item) => ({
            id: item.id,
            learnerReference: item.learnerReference,
            status: item.status,
            productTitle: item.baseline?.profile.product.title ?? null,
            paidAt: item.baseline?.paidAt ?? null,
            paidMinor: item.baseline?.paidMinor ?? null,
            netPaidMinor: item.netPaidMinor,
            observedAt: item.observedAt,
            testMode: item.baseline ? !item.baseline.profile.livemode : null,
            adjustments: item.observations
              .filter(
                (observation, index) =>
                  index > 0 || observation.refunds.length > 0,
              )
              .map((observation) => ({
                id: observation.id,
                observedAt: observation.observedAt,
              })),
          })),
          nextCursor,
        };
      },
    );
    async function download(
      request: { params: { id: string; adjustmentId?: string } },
      accountId: string,
    ) {
      if (
        !z.uuid().safeParse(request.params.id).success ||
        (request.params.adjustmentId &&
          !z.uuid().safeParse(request.params.adjustmentId).success)
      )
        throw new BillingError("payment_not_found", 404);
      const record = (
        await paymentHistory(options.pool, accountId, request.params.id)
      )[0];
      if (!record) throw new BillingError("payment_not_found", 404);
      return Buffer.from(await paymentPdf(record, request.params.adjustmentId));
    }
    scope.get<{ Params: { id: string } }>(
      "/api/v1/payments/:id/record.pdf",
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        const pdf = await download(request, accountId);
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="payment-${request.params.id}.pdf"`,
          )
          .send(pdf);
      },
    );
    scope.get<{ Params: { id: string; adjustmentId: string } }>(
      "/api/v1/payments/:id/adjustments/:adjustmentId.pdf",
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        const pdf = await download(request, accountId);
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="adjustment-${request.params.adjustmentId}.pdf"`,
          )
          .send(pdf);
      },
    );
  });
}
