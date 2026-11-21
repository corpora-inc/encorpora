import type { FastifyInstance } from "fastify";

/** A request slower than this is logged with its route, never its URL. */
export const SLOW_REQUEST_MS = 1000;

/** A response that is meant to stay open (the live streams, src/schools/live):
 * its length is its design, not slowness. `onResponse` does fire for one,
 * when it ends (Fastify listens for the raw response's `finish`, streamed or
 * hijacked alike). */
export const isEventStream = (contentType: unknown) =>
  String(contentType ?? "").startsWith("text/event-stream");

/** Logs what a slow first load is made of, so it can be measured and alerted on. */
export function logSlowRequests(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    if (reply.elapsedTime < SLOW_REQUEST_MS) return;
    if (isEventStream(reply.getHeader("content-type"))) return;
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
