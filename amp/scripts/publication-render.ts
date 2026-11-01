/** How a publication PDF is printed. Part of the renderer fingerprint
 * (scripts/publication-cache.ts): any change here re-renders every PDF, so
 * keep orchestration elsewhere. */
import { chromium, type Browser } from "playwright";
import type { RenderPdfs } from "./publication-cache";

export function publicationRenderer(): {
  render: RenderPdfs;
  close: () => Promise<void>;
} {
  let browser: Promise<Browser> | null = null;
  return {
    async render(html, formats) {
      // One browser for every worker; each document gets its own page.
      browser ??= chromium.launch({ headless: true });
      const page = await (await browser).newPage();
      try {
        await page.setContent(html);
        const pdfs: Buffer[] = [];
        for (const format of formats)
          pdfs.push(
            await page.pdf({
              format: format as "Letter" | "A4",
              printBackground: true,
              tagged: true,
            }),
          );
        return pdfs;
      } finally {
        await page.close();
      }
    },
    async close() {
      await (await browser)?.close();
    },
  };
}
