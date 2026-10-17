import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { FractionBook } from "../../books/fraction-field-guide/schema.js";
import { ApiError } from "../server/repository.js";
const manifestSchema = z.object({
  book: z.string(),
  version: z.string(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pdfSha256: z.string().regex(/^[a-f0-9]{64}$/),
  physicalPdfPages: z.number().int().positive(),
});
export const contentHash = (book: FractionBook) =>
  createHash("sha256").update(JSON.stringify(book)).digest("hex");
/** Only catalog-owned book IDs reach this adapter; publication bytes must match
 * the current semantic content and release manifest, including the page count. */
export async function loadBookPdf(
  directory: string,
  book: FractionBook,
): Promise<Buffer> {
  try {
    const manifest = manifestSchema.parse(
      JSON.parse(
        await readFile(join(directory, book.id, "validation.json"), "utf8"),
      ),
    );
    if (
      manifest.book !== book.id ||
      manifest.version !== book.version ||
      manifest.contentSha256 !== contentHash(book) ||
      manifest.physicalPdfPages !== book.pages.length
    )
      throw new Error("Publication content mismatch");
    const file = await open(join(directory, book.id, `${book.id}.pdf`), "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size < 5 || stat.size > 25 * 1024 * 1024)
        throw new Error("Invalid publication size");
      const data = await file.readFile();
      if (
        !data.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
        createHash("sha256").update(data).digest("hex") !== manifest.pdfSha256
      )
        throw new Error("Publication integrity failure");
      return data;
    } finally {
      await file.close();
    }
  } catch {
    throw new ApiError(
      503,
      "This book’s download is being prepared. The reading edition is available.",
    );
  }
}
