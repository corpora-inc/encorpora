import { createHash } from "node:crypto";
import { books } from "../../books/catalog.js";
import { templates } from "../../math/engine.js";
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function supplierCatalog() {
  return {
    format: "corpora-review-catalog-v1",
    program: "fl-pep",
    status: "candidate-not-approved",
    products: [
      {
        id: "AMP-PRACTICE-STUDENT",
        title: "AMP mathematics practice",
        format: "single-student software",
        description:
          "Self-paced practice of selected mathematics skills with explanations and related original reading.",
        proposedTerm:
          "12 months; start date and award-year treatment require a program decision",
        priceMinor: null,
        currency: "USD",
        automaticRenewal: false,
        categoryDecision: "unresolved",
      },
      ...books.map(({ content }) => ({
        id: `AMP-PDF-${content.id.toUpperCase()}`,
        title: content.title,
        format: "downloadable PDF; no physical shipment",
        description: content.description,
        proposedTerm:
          "Download, personal-print rights and retention require separate decisions",
        priceMinor: null,
        currency: "USD",
        automaticRenewal: false,
        categoryDecision: "unresolved",
      })),
    ],
    practice: templates.map((t) => ({
      id: t.id,
      version: t.version,
      skillId: t.skillId,
    })),
    books: books.map(({ content, alignments, bindings }) => ({
      id: content.id,
      version: content.version,
      title: content.title,
      audience: content.audience,
      pages: content.pages.length,
      contentSha256: sha256(JSON.stringify(content)),
      skillIds: [
        ...new Set([
          ...alignments.map((a) => a.skillId),
          ...bindings.map((b) => b.skillId),
        ]),
      ].sort(),
    })),
  };
}
export type SupplierCatalog = ReturnType<typeof supplierCatalog>;
/** Spreadsheet-safe neutral export, not an administrator upload schema. */
export function catalogCsv(catalog: SupplierCatalog): string {
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return (
    [
      [
        "candidate_id",
        "title",
        "format",
        "proposed_term",
        "price_minor",
        "currency",
        "category_decision",
      ],
      ...catalog.products.map((p) => [
        p.id,
        p.title,
        p.format,
        p.proposedTerm,
        p.priceMinor,
        p.currency,
        p.categoryDecision,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
