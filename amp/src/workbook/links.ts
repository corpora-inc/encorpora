/** Where a printed workbook's results are entered: the QR code on its results
 * page opens this address. */
export function workbookResultsUrl(link: {
  baseUrl: string;
  learnerId: string;
  workbookId: string;
}): string {
  const base = new URL(link.baseUrl);
  if (base.protocol !== "https:" && base.hostname !== "localhost")
    throw new Error("Workbook links need an https base URL");
  const path = [
    "learners",
    encodeURIComponent(link.learnerId),
    "workbooks",
    encodeURIComponent(link.workbookId),
    "results",
  ].join("/");
  return new URL(`${base.pathname.replace(/\/+$/, "")}/${path}`, base.origin)
    .href;
}
