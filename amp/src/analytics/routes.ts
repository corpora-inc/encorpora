import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { MAX_BATCH_BYTES, eventBatchSchema } from "./events.js";
import { recordEventBatch } from "./repository.js";
import { MARKETING_SCREENS } from "./site-actions.js";

/** Batches per minute per client address (two-second batching sends ~30). */
export const EVENT_RATE_LIMIT = 120;
/** Database connections the anonymous endpoint may hold at once, so a flood
 * from many addresses cannot starve billing or learning of the shared pool. */
export const EVENT_MAX_IN_FLIGHT = 4;

/**
 * `POST /api/v1/events`: anonymous, first-party funnel collection. Accepts the
 * fixed vocabulary only (zod), at most 25 events and 8 KB per batch. A
 * failure never reaches the learner: the web helper fires and forgets.
 */
export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  options: { pool: Pool; origin?: string },
): Promise<void> {
  let inFlight = 0;
  const collect = async (
    request: FastifyRequest,
    reply: FastifyReply,
    siteOnly = false,
  ) => {
    if (request.headers["sec-gpc"] === "1" || request.headers.dnt === "1")
      return reply.code(204).send();
    const parsed = eventBatchSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_events" });
    if (
      siteOnly &&
      (parsed.data.trial !== undefined ||
        parsed.data.events.some(
          (e) =>
            e.event !== "site_action" &&
            (e.event !== "page_engagement" ||
              !MARKETING_SCREENS.includes(
                (e.props as { screen: (typeof MARKETING_SCREENS)[number] })
                  .screen,
              )),
        ))
    )
      return reply.code(400).send({ error: "invalid_site_events" });
    if (inFlight >= EVENT_MAX_IN_FLIGHT)
      return reply.code(503).send({ error: "events_busy" });
    inFlight++;
    try {
      const accepted = await recordEventBatch(options.pool, parsed.data);
      return reply.code(202).send({ accepted });
    } finally {
      inFlight--;
    }
  };
  const config = {
    bodyLimit: MAX_BATCH_BYTES,
    config: {
      rateLimit: {
        max: EVENT_RATE_LIMIT,
        timeWindow: "1 minute",
        keyGenerator: (request: FastifyRequest) => `events:${request.ip}`,
      },
    },
  };
  // Both collectors share the same pool and database concurrency budget.
  await app.register(async (scope) => {
    scope.post("/api/v1/events", config, (request, reply) =>
      collect(request, reply),
    );
    if (options.origin)
      await scope.register(async (site) => {
        site.addHook("onRequest", async (request, reply) => {
          reply.header("Vary", "Origin");
          if (request.headers.origin !== options.origin)
            return reply.code(403).send({ error: "origin_not_allowed" });
          reply.header("Access-Control-Allow-Origin", options.origin!);
        });
        site.options("/api/v1/site-events", async (_request, reply) => {
          reply.header("Access-Control-Allow-Methods", "POST");
          reply.header("Access-Control-Allow-Headers", "Content-Type");
          reply.header("Access-Control-Max-Age", "600");
          return reply.code(204).send();
        });
        site.post("/api/v1/site-events", config, (request, reply) =>
          collect(request, reply, true),
        );
      });
  });
}
