import { monitorEventLoopDelay, PerformanceObserver } from "node:perf_hooks";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { generateProblem, templates } from "../math/engine.js";
import { workbookWorker } from "../workbook/off-thread.js";
import { hintSupport } from "./app.js";

/** A frozen event loop delays every request and can fail the readiness probe. */
export const STALL_MS = 500;
const LONG_GC_MS = 200;
const DATABASE_CHECK_TIMEOUT_MS = 3000;

/** Watches for the process itself freezing. Returns the function that stops it. */
export function watchRuntimeHealth(
  log: Pick<FastifyBaseLogger, "warn">,
  everyMs = 10_000,
) {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  const timer = setInterval(() => {
    const worst = delay.max / 1e6;
    delay.reset();
    if (worst < STALL_MS) return;
    const { heapUsed, rss } = process.memoryUsage();
    log.warn(
      {
        ms: Math.round(worst),
        heapUsedMb: Math.round(heapUsed / 1048576),
        rssMb: Math.round(rss / 1048576),
      },
      "event loop stalled",
    );
  }, everyMs);
  timer.unref();
  const collections = new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (entry.duration >= LONG_GC_MS)
        log.warn({ ms: Math.round(entry.duration) }, "long garbage collection");
  });
  collections.observe({ entryTypes: ["gc"] });
  return () => {
    clearInterval(timer);
    delay.disable();
    collections.disconnect();
  };
}

/** For uptime checks: can this process reach the database right now? It says
 * nothing more than yes or no. Readiness stays independent of the database, so a
 * database blip doesn't take every pod out of service at once. */
export function registerDatabaseHealth(
  app: FastifyInstance,
  pool: Pick<Pool, "query">,
) {
  app.get("/api/v1/health/database", async (request, reply) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("timed out")),
            DATABASE_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      return { ok: true };
    } catch (error) {
      request.log.error(
        { reason: error instanceof Error ? error.name : "unknown" },
        "database health check failed",
      );
      return reply.code(503).send({ ok: false });
    } finally {
      clearTimeout(timer);
    }
  });
}

/**
 * Does the work the first parent after a deploy would otherwise wait for, before
 * this process accepts traffic: the public catalog, the glossary lexicon behind
 * every hint, the problem generators, a database connection and the workbook
 * worker. A failure only
 * costs that speed, so it is logged and startup continues.
 */
export async function warmServer(
  app: FastifyInstance,
  pool: Pick<Pool, "query">,
) {
  const started = performance.now();
  try {
    await app.inject({ method: "GET", url: "/api/v1/catalog" });
    const step = Math.max(1, Math.ceil(templates.length / 24));
    for (let index = 0; index < templates.length; index += step)
      hintSupport(generateProblem(templates[index]!.id, `warm-up-${index}`));
    await pool.query("SELECT 1");
    await workbookWorker(app.log).warm();
    app.log.info(
      { ms: Math.round(performance.now() - started) },
      "server warmed",
    );
  } catch (error) {
    app.log.warn(
      { reason: error instanceof Error ? error.name : "unknown" },
      "warm-up did not finish; the first requests will be slower",
    );
  }
}
