import type { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clickEvidenceSchema } from "./click-identifiers.js";
import {
  retainAdClick,
  bindAdClicksToOrder,
  eraseAccountAdClicks,
  purgeAdClickEvidence,
  type AttributionTarget,
} from "./click-evidence.js";
import {
  campaignMatchesOffer,
  incrementFundedCampaign,
  fundedCampaignSchema,
} from "../analytics/funded-campaign.js";
import { advertisingOptOut } from "./permission-contracts.js";

export const ACQUISITION_COOKIE = "__Host-amp-acquisition";
/** Host-only HTTPS cookie. No identifier is returned to application JavaScript. */
export function acquisitionToken(headers: Record<string, unknown>) {
  if (advertisingOptOut(headers) || typeof headers.cookie !== "string")
    return undefined;
  const values = headers.cookie
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(`${ACQUISITION_COOKIE}=`))
    .map((x) => x.slice(ACQUISITION_COOKIE.length + 1));
  return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]!)
    ? values[0]
    : undefined;
}
const cookie = (token: string, seconds: number) =>
  `${ACQUISITION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(seconds))}`;
const captureSchema = z.strictObject({
  sourcePath: z
    .enum(["/", "/sign-up", "/amp/", "/esa/arkansas-efa/", "/esa/arizona-esa/"])
    .optional(),
  clicks: z
    .array(clickEvidenceSchema)
    .min(1)
    .max(3)
    .refine((v) => new Set(v.map((c) => c.provider)).size === v.length),
  labels: fundedCampaignSchema.optional(),
});

/** First-party collection on the parent-facing marketing origin only.
 * This endpoint cannot accept an account, order, purchase event or learner data. */
export async function registerAcquisitionRoutes(
  app: FastifyInstance,
  options: { pool: Pool; origin?: string },
) {
  if (!options.origin) return;
  if (options.origin !== "https://corpora.inc")
    throw new Error("Invalid acquisition origin");
  let inFlight = 0;
  await app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("Vary", "Origin")
        .header("X-Content-Type-Options", "nosniff");
      if (
        request.headers.origin !== options.origin &&
        request.headers.origin !== "https://amp.corpora.inc"
      )
        return reply.code(403).send({ error: "origin_not_allowed" });
      reply
        .header("Access-Control-Allow-Origin", request.headers.origin!)
        .header("Access-Control-Allow-Credentials", "true");
    });
    scope.setErrorHandler((_error, _request, reply) =>
      reply.code(400).send({ error: "invalid_acquisition_request" }),
    );
    scope.options("/api/v1/advertising/acquisition", async (_request, reply) =>
      reply
        .header("Access-Control-Allow-Methods", "POST")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Access-Control-Max-Age", "600")
        .code(204)
        .send(),
    );
    scope.post(
      "/api/v1/advertising/acquisition",
      {
        bodyLimit: 16384,
        config: {
          rateLimit: {
            max: 20,
            timeWindow: "1 minute",
            keyGenerator: (request) => `acquisition:${request.ip}`,
          },
        },
      },
      async (request, reply) => {
        if (
          advertisingOptOut(request.headers) ||
          z.strictObject({ optOut: z.literal(true) }).safeParse(request.body)
            .success
        )
          return reply.header("Set-Cookie", cookie("", 0)).code(204).send();
        const parsed = captureSchema.safeParse(request.body);
        if (!parsed.success)
          return reply.code(400).send({ error: "invalid_acquisition_request" });
        // The app accepts acquisition only at its public entrance. Other
        // routes and arbitrary source URLs cannot be recorded as landing pages.
        const appEntry = request.headers.origin === "https://amp.corpora.inc";
        if (
          appEntry !== ["/", "/sign-up"].includes(parsed.data.sourcePath ?? "")
        )
          return reply.code(400).send({ error: "invalid_acquisition_request" });
        if (inFlight >= 2)
          return reply.code(503).send({ error: "acquisition_busy" });
        inFlight++;
        const client = await options.pool.connect().catch(() => null);
        if (!client) {
          inFlight--;
          return reply.code(503).send({ error: "acquisition_unavailable" });
        }
        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL statement_timeout='5s'");
          await client.query("SET LOCAL lock_timeout='2s'");
          let token = acquisitionToken(request.headers);
          const predecessorToken = token;
          let expiresAt = "";
          for (const click of parsed.data.clicks) {
            const retained = await retainAdClick(
              client,
              click,
              token,
              parsed.data.labels,
              predecessorToken,
              new URL(
                parsed.data.sourcePath ?? "/esa/arkansas-efa/",
                request.headers.origin,
              ).href,
            );
            token = retained.token;
            expiresAt = retained.expiresAt;
          }
          await client.query("COMMIT");
          return reply
            .header(
              "Set-Cookie",
              cookie(token!, (Date.parse(expiresAt) - Date.now()) / 1000),
            )
            .code(204)
            .send();
        } catch {
          await client.query("ROLLBACK").catch(() => {});
          return reply.code(503).send({ error: "acquisition_unavailable" });
        } finally {
          client.release();
          inFlight--;
        }
      },
    );
  });
}

/** Runs before returning the invoice/checkout to the parent. Never calls an ad
 * provider and never permits a tracking failure to prevent a purchase. */
export async function linkPurchaseAcquisition(
  pool: Pool,
  account: string,
  source: string | { invoiceId: string } | undefined,
  target: AttributionTarget,
) {
  if (
    source &&
    (typeof source === "string"
      ? !/^[a-f0-9]{64}$/.test(source)
      : !z.strictObject({ invoiceId: z.uuid() }).safeParse(source).success)
  )
    return false;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='2s'");
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
    // Default-off export permission does not forbid first-party attribution.
    // An explicit withdrawal does: it must not be undone by another checkout.
    const preferences = await client.query(
      "SELECT provider,true AS withdrawn_at FROM amp_ad_collection_withdrawals WHERE account_id=$1",
      [account],
    );
    const providers = (["google", "meta", "openai"] as const).filter(
      (provider) =>
        !preferences.rows.some(
          (row) => row.provider === provider && row.withdrawn_at,
        ),
    );
    const retained =
      source && typeof source !== "string" && target.kind === "funding-request"
        ? (
            await client.query(
              "SELECT acquisition_journey_id FROM amp_funding_invoice_intents WHERE id=$1 AND claimed_account_id=$2 AND claimed_request_id=$3",
              [source.invoiceId, account, target.id],
            )
          ).rows[0]?.acquisition_journey_id
        : null;
    const signupJourney = !retained
      ? (
          await client.query(
            "SELECT acquisition_journey_id FROM amp_parent_followups WHERE 'amp|'||user_id=$1",
            [account],
          )
        ).rows[0]?.acquisition_journey_id
      : null;
    const lookup =
      typeof source === "string"
        ? source
        : (retained ?? signupJourney)
          ? { retainedJourneyId: retained ?? signupJourney }
          : null;
    const result = lookup
      ? await bindAdClicksToOrder(client, account, lookup, target, providers)
      : { bound: 0 };
    if (
      !result.bound &&
      signupJourney &&
      !(
        typeof lookup === "object" &&
        lookup?.retainedJourneyId === signupJourney
      )
    )
      result.bound += (
        await bindAdClicksToOrder(
          client,
          account,
          { retainedJourneyId: signupJourney },
          target,
          providers,
        )
      ).bound;
    if (target.kind === "funding-request" && providers.length) {
      const saved = (
        await client.query(
          `SELECT p.campaign,r.offer_snapshot FROM amp_parent_followups p
        JOIN amp_funding_requests r ON r.account_id='amp|'||p.user_id
        WHERE r.id=$1 AND r.account_id=$2 AND r.campaign_attribution IS NULL`,
          [target.id, account],
        )
      ).rows[0];
      const labels = fundedCampaignSchema.safeParse(saved?.campaign);
      if (
        labels.success &&
        campaignMatchesOffer(labels.data, saved.offer_snapshot)
      ) {
        const restored = await client.query(
          "UPDATE amp_funding_requests SET campaign_attribution=$3 WHERE id=$1 AND account_id=$2 AND campaign_attribution IS NULL RETURNING created_at",
          [target.id, account, labels.data],
        );
        if (restored.rowCount)
          await incrementFundedCampaign(
            client,
            labels.data,
            "request_prepared",
            restored.rows[0].created_at.toISOString(),
          );
      }
    }
    for (const provider of ["google", "meta", "openai"] as const)
      if (!providers.includes(provider))
        await eraseAccountAdClicks(client, account, provider);
    await client.query("COMMIT");
    return result.bound > 0;
  } catch {
    await client?.query("ROLLBACK").catch(() => {});
    console.warn("Advertising acquisition binding unavailable");
    return false;
  } finally {
    client?.release();
  }
}

export async function purgeAcquisition(pool: Pool) {
  let total = 0;
  // Commit bounded batches; a successful run must leave no expired backlog.
  for (let batch = 0; batch < 1000; batch++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout='10s'");
      total += await purgeAdClickEvidence(client);
      await client.query("COMMIT");
      const remaining = await client.query(
        "SELECT 1 FROM amp_ad_click_journeys WHERE expires_at<=clock_timestamp() LIMIT 1",
      );
      if (!remaining.rowCount) return total;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  throw new Error("Acquisition retention incomplete: expired backlog remains");
}
