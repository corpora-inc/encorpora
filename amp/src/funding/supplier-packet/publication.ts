import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { bookFor } from "../../books/catalog.js";
import { renderBook } from "../../publishing/book.js";
import { publicationSourceHashes } from "../../publishing/source-manifest.js";
import { sha256, type SupplierCatalog } from "./catalog.js";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  book: z.string(),
  version: z.string(),
  contentSha256: digest,
  pages: z.number().int().positive(),
  physicalPdfPages: z.number().int().positive(),
  pdfTagged: z.literal(true),
  pdfSha256: digest,
  htmlSha256: digest,
  sourceHashes: z.record(z.string(), digest),
  overflow: z.array(z.unknown()).length(0),
  diagramOverflow: z.array(z.unknown()).length(0),
});
/** CLI-local files only. Revalidates complete source sets, not only the entries a manifest supplies. */
export async function verifyPublication(
  root: string,
  directory: string,
  book: SupplierCatalog["books"][number],
) {
  for (const name of ["", "validation.json", `${book.id}.pdf`, "index.html"]) {
    if ((await lstat(join(directory, name))).isSymbolicLink())
      throw new Error(`Symlink publication rejected: ${name}`);
  }
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(directory, "validation.json"), "utf8")),
  );
  if (
    manifest.book !== book.id ||
    manifest.version !== book.version ||
    manifest.contentSha256 !== book.contentSha256 ||
    manifest.pages !== book.pages ||
    manifest.physicalPdfPages !== book.pages
  )
    throw new Error(`Publication edition mismatch: ${book.id}`);
  const current = await publicationSourceHashes(root, book.id);
  const stable = (v: Record<string, string>) =>
    JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
  if (stable(manifest.sourceHashes) !== stable(current))
    throw new Error(`Current-source publication required: ${book.id}`);
  const pdfStat = await lstat(join(directory, `${book.id}.pdf`));
  if (!pdfStat.isFile() || pdfStat.size > 50 * 1024 * 1024)
    throw new Error("Invalid publication file size");
  const pdf = await readFile(join(directory, `${book.id}.pdf`)),
    html = await readFile(join(directory, "index.html"));
  if (sha256(html) !== sha256(renderBook(bookFor(book.id)!.content)))
    throw new Error(
      `Publication HTML does not match registered source: ${book.id}`,
    );
  if (
    sha256(pdf) !== manifest.pdfSha256 ||
    sha256(html) !== manifest.htmlSha256
  )
    throw new Error(`Publication bytes mismatch: ${book.id}`);
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("Invalid PDF header");
  const { stdout: info } = await promisify(execFile)(
    "pdfinfo",
    [join(directory, `${book.id}.pdf`)],
    { timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  if (
    Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]) !== book.pages ||
    !/^Tagged:\s+yes/m.test(info)
  )
    throw new Error(`Actual PDF structure mismatch: ${book.id}`);
  return {
    manifest,
    html: html.toString("utf8"),
    pdfSha256: sha256(pdf),
    sourceHashes: current,
  };
}
