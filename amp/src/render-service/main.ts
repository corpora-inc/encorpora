/** Entry point of the render image (Dockerfile target `render`). See
 * server.ts for the configuration. */
import { createRenderService, jsonLog } from "./server.js";

function integer(name: string, fallback: number, min: number, max: number) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
}

const token = process.env.AMP_RENDER_TOKEN;
if (!token) throw new Error("AMP_RENDER_TOKEN is required");
const service = createRenderService({
  token,
  concurrency: integer("AMP_RENDER_CONCURRENCY", 2, 1, 16),
  queue: integer("AMP_RENDER_QUEUE", 16, 0, 1000),
  timeoutMs: integer("AMP_RENDER_TIMEOUT_MS", 20_000, 1000, 120_000),
  maxBytes: integer(
    "AMP_RENDER_MAX_BYTES",
    8 * 1024 * 1024,
    1024,
    64 * 1024 * 1024,
  ),
});
const host = process.env.AMP_RENDER_HOST ?? "127.0.0.1";
const port = integer("AMP_RENDER_PORT", 8080, 1, 65535);
await service.ready();
service.server.listen(port, host, () =>
  jsonLog({ level: "info", msg: "render service listening", host, port }),
);
const stop = (signal: string) => {
  jsonLog({ level: "info", msg: "shutting down", signal });
  void service.close().finally(() => process.exit(0));
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
process.on("uncaughtException", (error) => {
  jsonLog({ level: "error", msg: "uncaught", error: error.message });
  process.exit(1);
});
