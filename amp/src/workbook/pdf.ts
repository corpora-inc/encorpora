import type { Page } from "playwright";

/** Wait for the workbook's page composition (`layout-script.ts`). Throws when
 * it reports an error or does not finish, so a printer never ships a
 * half-composed workbook. */
export async function waitForWorkbookLayout(
  page: Page,
  timeout = 20_000,
): Promise<void> {
  const state = await page
    .waitForFunction(
      () => {
        const value = document.documentElement.dataset.layout;
        return value === "ready" || value === "error" ? value : null;
      },
      undefined,
      { timeout },
    )
    .then((handle) => handle.jsonValue());
  if (state !== "ready")
    throw new Error("Workbook layout failed; see the page console");
}

/** Print a workbook's HTML (from `workbookHtml`) to PDF in an open browser
 * page. Page size and margins come from the document; footers are part of
 * each composed page, so no browser header or footer is drawn. */
export async function printWorkbookPdf(
  page: Page,
  html: string,
): Promise<Buffer> {
  const errors: string[] = [];
  const onError = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") errors.push(message.text());
  };
  page.on("console", onError);
  try {
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load" });
    await waitForWorkbookLayout(page).catch((error: Error) => {
      throw new Error(`${error.message}: ${errors.join(" | ")}`);
    });
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    page.off("console", onError);
  }
}
