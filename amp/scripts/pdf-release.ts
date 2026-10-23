/** Shared build/runtime validation for the immutable PDF files shipped by the API. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { lessons } from "../src/content/lessons";
import { books } from "../src/books/catalog";
import { loadBookPdf } from "../src/books/publication";
const entry = z.object({
  lessonId: z.string(),
  kind: z.enum(["lesson", "workbook", "solutions"]),
  format: z.enum(["Letter", "A4"]),
  filename: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
});
export const expectedPublicationNames = (ids: readonly string[]) =>
  ids.flatMap((id) =>
    ["lesson", "workbook", "solutions"].flatMap((kind) =>
      ["Letter", "A4"].map((format) => `${id}-${kind}-${format}.pdf`),
    ),
  );
export async function verifyPublications(
  directory: string,
  ids: readonly string[] = lessons.map((l) => l.id),
) {
  const { publications } = z
    .object({ publications: z.array(entry) })
    .parse(
      JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")),
    );
  const expected = new Set(expectedPublicationNames(ids));
  assert.equal(
    publications.length,
    expected.size,
    "Publication inventory must match the current lesson catalog",
  );
  let bytes = 0;
  for (const item of publications) {
    assert.equal(
      item.filename,
      `${item.lessonId}-${item.kind}-${item.format}.pdf`,
      "Publication metadata and filename must agree",
    );
    assert.ok(
      expected.delete(item.filename),
      `Unexpected or duplicate publication: ${item.filename}`,
    );
    const pdf = await readFile(join(directory, item.filename));
    assert.equal(
      pdf.subarray(0, 5).toString(),
      "%PDF-",
      `Invalid PDF: ${item.filename}`,
    );
    assert.equal(pdf.length, item.bytes, `Incorrect size: ${item.filename}`);
    assert.equal(
      createHash("sha256").update(pdf).digest("hex"),
      item.sha256,
      `Incorrect hash: ${item.filename}`,
    );
    bytes += pdf.length;
  }
  assert.equal(expected.size, 0, "Missing publication");
  return { publications, bytes };
}
export async function verifyPdfRelease(directory: string) {
  const publication = await verifyPublications(join(directory, "publications"));
  assert.deepEqual(
    (await readdir(join(directory, "publications"))).sort(),
    [
      "manifest.json",
      ...publication.publications.map((p) => p.filename),
    ].sort(),
    "The runtime publication directory contains only delivery files",
  );
  assert.deepEqual(
    (await readdir(join(directory, "books"))).sort(),
    books.map((b) => b.content.id).sort(),
    "Book inventory must match the catalog",
  );
  let bookBytes = 0;
  for (const { content: book } of books) {
    assert.deepEqual(
      (await readdir(join(directory, "books", book.id))).sort(),
      [`${book.id}.pdf`, "validation.json"].sort(),
      "The runtime book directory contains only delivery files",
    );
    bookBytes += (await loadBookPdf(join(directory, "books"), book)).length;
  }
  return {
    publications: publication.publications.length,
    books: books.length,
    publicationBytes: publication.bytes,
    bookBytes,
    totalPdfBytes: publication.bytes + bookBytes,
  };
}
