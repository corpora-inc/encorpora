import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { MAX_BATCH_BYTES, eventBatchSchema } from "./events.js";
import { recordEventBatch } from "./repository.js";

/** Batches per minute per client address (two-second batching sends ~30). */
export const EVENT_RATE_LIMIT = 120;

/**
 * `POST /api/v1/events`: anonymous, first-party funnel collection. Accepts the
 * fixed vocabulary only (zod), at most 25 events and 8 KB per batch. A
 * failure never reaches the learner: the web helper fires and forgets.
 */
export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  options: { pool: Pool },
): Promise<void> {
  // Registered as a plugin so it loads after the app's rate limiter.
  await app.register(async (scope) => {
    scope.post(
      "/api/v1/events",
      {
        bodyLimit: MAX_BATCH_BYTES,
        config: {
          rateLimit: {
            max: EVENT_RATE_LIMIT,
            timeWindow: "1 minute",
            keyGenerator: (request) => `events:${request.ip}`,
          },
        },
      },
      async (request, reply) => {
        const parsed = eventBatchSchema.safeParse(request.body);
        if (!parsed.success)
          return reply.code(400).send({ error: "invalid_events" });
        const accepted = await recordEventBatch(options.pool, parsed.data);
        return reply.code(202).send({ accepted });
      },
    );
  });
}
