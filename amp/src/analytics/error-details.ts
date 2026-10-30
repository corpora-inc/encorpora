import { z } from "zod";

const exception = z.enum([
  "Error",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
  "SecurityError",
  "QuotaExceededError",
  "NotAllowedError",
  "AbortError",
  "TimeoutError",
  "NetworkError",
  "ChunkLoadError",
  "unknown",
]);
export const errorDetailsSchema = z.strictObject({
  exception: exception.optional(),
  category: z
    .enum([
      "storage",
      "network",
      "chunk",
      "security",
      "cancelled",
      "timeout",
      "runtime",
      "unknown",
    ])
    .optional(),
  asset: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,80}-[A-Za-z0-9_-]{8,32}\.js$/)
    .optional(),
  source: z.enum(["app", "external", "inline", "unknown"]).optional(),
  line: z.number().int().min(0).max(10000000).optional(),
  column: z.number().int().min(0).max(10000000).optional(),
});

/** Closed categories and deployed bundle coordinates only. Never export error
 * messages, stacks, query strings, form values, or arbitrary property names. */
export function errorDetails(
  error: unknown,
  source?: { filename?: string; lineno?: number; colno?: number },
  origin?: string,
): z.infer<typeof errorDetailsSchema> {
  const result: z.infer<typeof errorDetailsSchema> = {};
  try {
    const name = exception.safeParse((error as Error)?.name);
    result.exception = name.success ? name.data : "unknown";
    const message =
      typeof (error as Error)?.message === "string"
        ? (error as Error).message
        : "";
    result.category =
      /Loading chunk|dynamically imported module|Importing a module script failed/i.test(
        message,
      )
        ? "chunk"
        : /QuotaExceededError/.test(result.exception)
          ? "storage"
          : result.exception === "SecurityError"
            ? "security"
            : ["AbortError", "NotAllowedError"].includes(result.exception)
              ? "cancelled"
              : result.exception === "TimeoutError"
                ? "timeout"
                : result.exception === "NetworkError" ||
                    /Failed to fetch|Load failed|NetworkError/i.test(message)
                  ? "network"
                  : result.exception === "unknown"
                    ? "unknown"
                    : "runtime";
    if (source) {
      result.source = source.filename ? "unknown" : "inline";
      if (source.filename && origin) {
        const url = new URL(source.filename);
        result.source = url.origin === origin ? "app" : "external";
        const asset = url.pathname.match(
          /^\/assets\/([A-Za-z0-9_-]{1,80}-[A-Za-z0-9_-]{8,32}\.js)$/,
        )?.[1];
        if (result.source === "app" && asset) {
          result.asset = asset;
          for (const [key, value] of [
            ["line", source.lineno],
            ["column", source.colno],
          ] as const)
            if (Number.isInteger(value) && value! >= 0 && value! <= 10000000)
              result[key] = value;
        }
      }
    }
  } catch {
    /* Host objects can throw on property access. */
  }
  return result;
}
