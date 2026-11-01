/**
 * AMP render service: HTML in, PDF out, through headless Chromium. Internal
 * only: the API checks the parent's access, builds the document and calls
 * this with a shared secret. Pages render with JavaScript off and every
 * network request blocked, so a document can only use what it carries.
 *
 *   AMP_RENDER_TOKEN        shared secret, at least 32 characters (required)
 *   AMP_RENDER_HOST         listen address (default 127.0.0.1; 0.0.0.0 in the image)
 *   AMP_RENDER_PORT         listen port (default 8080)
 *   AMP_RENDER_CONCURRENCY  documents rendered at once (default 2)
 *   AMP_RENDER_QUEUE        requests waiting beyond that before 503 (default 16)
 *   AMP_RENDER_TIMEOUT_MS   per-document limit (default 20000)
 *   AMP_RENDER_MAX_BYTES    largest accepted request body (default 8 MiB)
 *
 * GET /healthz answers 200 when the browser is connected, 503 otherwise.
 * POST /render {html, format: "Letter" | "A4", footer?} returns the PDF.
 * Logs are one JSON object per line and never contain document content.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Browser } from "playwright-core";

export interface RenderServiceOptions {
  token: string;
  concurrency?: number;
  queue?: number;
  timeoutMs?: number;
  maxBytes?: number;
  /** Launches the browser; tests pass their own. */
  launch?: () => Promise<Browser>;
  log?: (entry: Record<string, unknown>) => void;
}

export const RENDER_FORMATS = ["Letter", "A4"] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const jsonLog = (entry: Record<string, unknown>) =>
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), ...entry }) + "\n",
  );

async function defaultLaunch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  return chromium.launch({
    headless: true,
    // The image runs as an unprivileged user with a read-only root; Chromium
    // writes only to /tmp. Shared memory in containers is small.
    args: ["--disable-dev-shm-usage", "--disable-gpu"],
  });
}

function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers["content-length"] ?? 0);
    if (declared > limit) {
      reject(new HttpError(413, "Document too large"));
      request.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "Document too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export function createRenderService(options: RenderServiceOptions): {
  server: Server;
  close: () => Promise<void>;
  ready: () => Promise<void>;
} {
  if (options.token.length < 32)
    throw new Error("AMP_RENDER_TOKEN must be at least 32 characters");
  const concurrency = options.concurrency ?? 2;
  const queueLimit = options.queue ?? 16;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const log = options.log ?? jsonLog;
  const launch = options.launch ?? defaultLaunch;
  const expected = createHash("sha256").update(options.token).digest();

  let browser: Promise<Browser> | null = null;
  let closing = false;
  function connected(): Promise<Browser> {
    browser ??= launch().then(
      (b) => {
        b.on("disconnected", () => {
          browser = null;
          if (!closing) log({ level: "error", msg: "browser disconnected" });
        });
        log({ level: "info", msg: "browser ready", version: b.version() });
        return b;
      },
      (error) => {
        browser = null;
        throw error;
      },
    );
    return browser;
  }

  let active = 0;
  const waiting: (() => void)[] = [];
  async function slot<T>(run: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      if (waiting.length >= queueLimit)
        throw new HttpError(503, "Renderer busy");
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await run();
    } finally {
      active--;
      waiting.shift()?.();
    }
  }

  async function render(
    html: string,
    format: RenderFormat,
    footer: string | undefined,
  ): Promise<Buffer> {
    const instance = await connected();
    const context = await instance.newContext({
      javaScriptEnabled: false,
      offline: true,
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      const work = (async () => {
        const page = await context.newPage();
        // Data URLs never reach the network; anything else is refused.
        await page.route("**/*", (route) => route.abort());
        await page.setContent(html, { waitUntil: "load", timeout: timeoutMs });
        await page.emulateMedia({ media: "print" });
        return page.pdf({
          format,
          printBackground: true,
          preferCSSPageSize: true,
          ...(footer
            ? {
                displayHeaderFooter: true,
                headerTemplate: "<span></span>",
                footerTemplate: footer,
              }
            : {}),
        });
      })();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new HttpError(504, "Render timed out")),
          timeoutMs,
        );
      });
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
      await context.close().catch(() => undefined);
    }
  }

  function authorized(request: IncomingMessage): boolean {
    const header = request.headers.authorization ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    return timingSafeEqual(
      createHash("sha256").update(presented).digest(),
      expected,
    );
  }

  const server = createServer(async (request, response) => {
    const started = Date.now();
    const send = (
      status: number,
      body: Buffer | string,
      type = "application/json",
    ) => {
      response.writeHead(status, {
        "Content-Type": type,
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(body);
    };
    const path = (request.url ?? "/").split("?")[0];
    try {
      if (request.method === "GET" && path === "/healthz") {
        const ready = await Promise.race([
          connected().then((b) => b.isConnected()),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 5000),
          ),
        ]).catch(() => false);
        return send(
          ready ? 200 : 503,
          JSON.stringify({ ok: ready, active, waiting: waiting.length }),
        );
      }
      if (path !== "/render") throw new HttpError(404, "Not found");
      if (request.method !== "POST")
        throw new HttpError(405, "Method not allowed");
      if (!authorized(request)) throw new HttpError(401, "Unauthorized");
      const raw = await readBody(request, maxBytes);
      let input: unknown;
      try {
        input = JSON.parse(raw.toString("utf8"));
      } catch {
        throw new HttpError(400, "Body must be JSON");
      }
      const { html, format, footer } = (input ?? {}) as Record<string, unknown>;
      if (typeof html !== "string" || !html.trim())
        throw new HttpError(400, "html is required");
      if (!RENDER_FORMATS.includes(format as RenderFormat))
        throw new HttpError(400, "format must be Letter or A4");
      if (footer !== undefined && typeof footer !== "string")
        throw new HttpError(400, "footer must be a string");
      const pdf = await slot(() =>
        render(html, format as RenderFormat, footer as string | undefined),
      );
      send(200, pdf, "application/pdf");
      log({
        level: "info",
        msg: "rendered",
        format,
        bytes: pdf.length,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message =
        error instanceof HttpError ? error.message : "Render failed";
      log({
        level: status >= 500 ? "error" : "warn",
        msg: "render request failed",
        status,
        method: request.method,
        path,
        error:
          error instanceof Error
            ? error.message.split("\n")[0]!.slice(0, 300)
            : String(error),
        durationMs: Date.now() - started,
      });
      if (!response.headersSent)
        send(status, JSON.stringify({ error: message }));
      else response.destroy();
    }
  });
  server.requestTimeout = timeoutMs + 10_000;
  server.headersTimeout = 15_000;

  return {
    server,
    ready: async () => {
      await connected();
    },
    close: async () => {
      closing = true;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const open = await browser?.catch(() => null);
      await open?.close().catch(() => undefined);
    },
  };
}
