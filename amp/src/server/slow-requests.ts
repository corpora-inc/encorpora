import type { FastifyInstance } from "fastify";

/** A request slower than this is logged with its route, never its URL. */
export const SLOW_REQUEST_MS = 1000;

/** Logs what a slow first load is made of, so it can be measured and alerted on. */
export function logSlowRequests(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    if (reply.elapsedTime < SLOW_REQUEST_MS) return;
    request.log.warn(
      {
        route: request.routeOptions.url ?? "unmatched",
        method: request.method,
        statusCode: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      "slow request",
    );
  });
}
