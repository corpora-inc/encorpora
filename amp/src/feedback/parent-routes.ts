import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { parentFeedbackSchema } from "./parent-feedback.js";
export async function registerParentFeedbackRoutes(
  app: FastifyInstance,
  { pool }: { pool: Pool },
) {
  let inFlight = 0;
  await app.register(async (scope) => {
    scope.post(
      "/api/v1/parent-feedback",
      {
        bodyLimit: 12000,
        config: {
          rateLimit: {
            max: 10,
            timeWindow: "1 hour",
            keyGenerator: (r) => `parent-feedback:${r.ip}`,
          },
        },
      },
      async (request, reply) => {
        const input = parentFeedbackSchema.safeParse(request.body);
        if (!input.success)
          return reply.code(400).send({ error: "invalid_feedback" });
        if (inFlight >= 2)
          return reply.code(503).send({ error: "feedback_busy" });
        inFlight++;
        try {
          const { requestId, context, program, message } = input.data;
          await pool.query(
            `INSERT INTO amp_parent_feedback(request_id,context,program,message)
          VALUES ($1,$2,$3,$4) ON CONFLICT(request_id) DO NOTHING`,
            [requestId, context, program ?? null, message],
          );
          // Identical response for a retry: no disclosure of an existing message.
          return reply.code(202).send({ accepted: true });
        } catch {
          // Driver errors can contain submitted text. Keep messages out of logs.
          request.log.error("Parent feedback could not be stored");
          return reply.code(503).send({ error: "feedback_unavailable" });
        } finally {
          inFlight--;
        }
      },
    );
  });
}
