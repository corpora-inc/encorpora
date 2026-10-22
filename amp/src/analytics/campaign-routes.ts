import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { campaignEventSchema } from "./campaign.js";
import { incrementCreativeCampaign } from "./creative-campaign.js";

/** Explicit deployment opt-in; no wildcard or credentialed CORS. */
export function campaignOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("AMP_CAMPAIGN_SITE_ORIGIN must be an HTTPS origin");
  return url.origin;
}

export async function registerCampaignRoutes(
  app: FastifyInstance,
  options: { pool: Pool; origin?: string },
): Promise<void> {
  if (!options.origin) return;
  let inFlight = 0;
  await app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply.header("Vary", "Origin");
      if (request.headers.origin !== options.origin)
        return reply.code(403).send({ error: "origin_not_allowed" });
      reply.header("Access-Control-Allow-Origin", options.origin!);
    });
    scope.options("/api/v1/campaign-events", async (_request, reply) => {
      reply.header("Access-Control-Allow-Methods", "POST");
      reply.header("Access-Control-Allow-Headers", "Content-Type");
      reply.header("Access-Control-Max-Age", "600");
      return reply.code(204).send();
    });
    scope.post(
      "/api/v1/campaign-events",
      {
        bodyLimit: 512,
        config: {
          rateLimit: {
            max: 30,
            timeWindow: "1 minute",
            keyGenerator: (request) => `campaign:${request.ip}`,
          },
        },
      },
      async (request, reply) => {
        if (request.headers["sec-gpc"] === "1" || request.headers.dnt === "1")
          return reply.code(204).send();
        const parsed = campaignEventSchema.safeParse(request.body);
        if (!parsed.success)
          return reply.code(400).send({ error: "invalid_campaign_event" });
        if (inFlight >= 2)
          return reply.code(503).send({ error: "campaign_busy" });
        inFlight++;
        try {
          const e = parsed.data;
          const client = await options.pool.connect();
          try {
            await client.query("BEGIN");
            await client.query("SET LOCAL statement_timeout='5s'");
            await client.query({
              text: `INSERT INTO amp_campaign_daily(day,state,program,campaign,source,medium,action,count)
            VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,$1,$2,$3,$4,$5,$6,1)
            ON CONFLICT(day,state,program,campaign,source,medium,action)
            DO UPDATE SET count=amp_campaign_daily.count+1`,
              values: [
                e.state,
                e.program,
                e.campaign,
                e.source,
                e.medium,
                e.action,
              ],
            });
            await incrementCreativeCampaign(client, e, e.action);
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
          } finally {
            client.release();
          }
          return reply.code(202).send({ accepted: 1 });
        } finally {
          inFlight--;
        }
      },
    );
  });
}
