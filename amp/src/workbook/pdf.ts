import type { Browser } from "playwright-core";
// playwright-core is a development dependency: the API image never loads it.
// The local renderer imports it only when used, in development.

/** Turns a printable HTML document into a PDF. Hosted: the internal render
 * service (src/render-service/server.ts). Development: local Playwright. */
export interface WorkbookRenderer {
  render(input: {
    html: string;
    format: "Letter" | "A4";
    footer?: string;
  }): Promise<Buffer>;
}

/** The renderer could not produce a PDF right now; the caller answers 503. */
export class RendererUnavailable extends Error {}

export function remoteRenderer(options: {
  url: string;
  token: string;
  timeoutMs?: number;
}): WorkbookRenderer {
  const endpoint = new URL("/render", options.url).href;
  return {
    async render(input) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        });
      } catch (error) {
        throw new RendererUnavailable(
          `Render service unreachable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new RendererUnavailable(
          `Render service answered ${response.status}: ${detail.slice(0, 200)}`,
        );
      }
      const pdf = Buffer.from(await response.arrayBuffer());
      if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new RendererUnavailable("Render service returned a non-PDF body");
      return pdf;
    },
  };
}

/** Development only: Chromium in this process, launched on first use. */
export function localRenderer(): WorkbookRenderer & { close(): Promise<void> } {
  let browser: Promise<Browser> | null = null;
  const launch = () =>
    (browser ??= import("playwright-core")
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((error) => {
        browser = null;
        throw new RendererUnavailable(
          `Local Chromium unavailable (npx playwright install chromium): ${error instanceof Error ? error.message : String(error)}`,
        );
      }));
  return {
    async render({ html, format, footer }) {
      const instance = await launch();
      const context = await instance.newContext({
        javaScriptEnabled: false,
        offline: true,
      });
      try {
        const page = await context.newPage();
        await page.route("**/*", (route) => route.abort());
        await page.setContent(html, { waitUntil: "load" });
        await page.emulateMedia({ media: "print" });
        return await page.pdf({
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
      } finally {
        await context.close().catch(() => undefined);
      }
    },
    async close() {
      const open = await browser?.catch(() => null);
      await open?.close();
    },
  };
}

/** Hosted: `AMP_RENDER_URL` and `AMP_RENDER_TOKEN` name the render service.
 * Development without them renders in this process. Otherwise none: PDF
 * requests answer 503 and log why. */
export function workbookRendererFromEnv(
  env: NodeJS.ProcessEnv,
  development: boolean,
): WorkbookRenderer | null {
  const url = env.AMP_RENDER_URL?.trim();
  const token = env.AMP_RENDER_TOKEN?.trim();
  if (url || token) {
    if (!url || !token)
      throw new Error("Set both AMP_RENDER_URL and AMP_RENDER_TOKEN");
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      throw new Error("AMP_RENDER_URL must be an http(s) URL");
    if (token.length < 32)
      throw new Error("AMP_RENDER_TOKEN must be at least 32 characters");
    return remoteRenderer({ url, token });
  }
  return development ? localRenderer() : null;
}
