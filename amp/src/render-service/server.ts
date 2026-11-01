/**
 * AMP render service: HTML in, PDF out, through headless Chromium. Internal
 * only: the API checks the parent's access, builds the document and calls
 * this with a shared secret. Every network request is blocked and the
 * context is offline, so a document can only use what it carries. Scripts
 * run only so a document can compose its own pages: one that marks
 * `<html data-compose>` (daily workbooks) is printed once it sets
 * `data-layout="ready"`, and fails on "error".
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
import type { Browser, BrowserContext } from "playwright-core";

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
    const tooLarge = () => {
      // Stop reading; the 413 is sent with Connection: close and the socket
      // closes after it, so the client sees the answer, not a reset.
      request.removeAllListeners("data");
      request.pause();
      reject(new HttpError(413, "Document too large"));
    };
    if (Number(request.headers["content-length"] ?? 0) > limit)
      return tooLarge();
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) return tooLarge();
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
  /** Runs when a slot is free. A request waits at most `timeoutMs` and
   * leaves the queue when its caller has gone. */
  async function slot<T>(run: () => Promise<T>, gone: () => boolean) {
    if (active >= concurrency) {
      if (waiting.length >= queueLimit)
        throw new HttpError(503, "Renderer busy");
      await new Promise<void>((resolve, reject) => {
        const wake = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(wake), 1);
          reject(new HttpError(503, "Renderer busy"));
        }, timeoutMs);
        waiting.push(wake);
      });
    }
    active++;
    try {
      if (gone()) throw new HttpError(499, "Client closed the request");
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
    let timer: NodeJS.Timeout | undefined;
    let context: BrowserContext | undefined;
    // The limit covers the whole render, including a browser start.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new HttpError(504, "Render timed out")),
        timeoutMs,
      );
    });
    const work = (async () => {
      const instance = await connected();
      context = await instance.newContext({ offline: true });
      const page = await context.newPage();
      // Data URLs never reach the network; anything else is refused.
      await page.route("**/*", (route) => route.abort());
      await page.emulateMedia({ media: "print" });
      await page.setContent(html, { waitUntil: "load", timeout: timeoutMs });
      const layout = await page
        .waitForFunction(
          () => {
            const root = document.documentElement;
            if (!root.hasAttribute("data-compose")) return "none";
            const value = root.dataset.layout;
            return value === "ready" || value === "error" ? value : null;
          },
          undefined,
          { timeout: timeoutMs },
        )
        .then((handle) => handle.jsonValue());
      if (layout === "error")
        throw new HttpError(422, "Document page composition failed");
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
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
      // A context opened after the timeout is closed when it resolves.
      void work
        .catch(() => undefined)
        .finally(() => context?.close().catch(() => undefined));
      await context?.close().catch(() => undefined);
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
    let gone = false;
    response.on("close", () => {
      if (!response.writableFinished) gone = true;
    });
    const send = (
      status: number,
      body: Buffer | string,
      type = "application/json",
      close = false,
    ) => {
      response.writeHead(status, {
        "Content-Type": type,
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(close ? { Connection: "close" } : {}),
      });
      response.end(body);
      if (close) response.on("finish", () => request.destroy());
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
      const pdf = await slot(
        () =>
          render(html, format as RenderFormat, footer as string | undefined),
        () => gone,
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
        send(
          status,
          JSON.stringify({ error: message }),
          undefined,
          status === 413,
        );
      else response.destroy();
    }
  });
  server.requestTimeout = timeoutMs + 10_000;
  server.headersTimeout = 15_000;
  // Longer than client and proxy idle timeouts, so a pooled connection is
  // never closed by this side just as a request is sent on it.
  server.keepAliveTimeout = 65_000;

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
