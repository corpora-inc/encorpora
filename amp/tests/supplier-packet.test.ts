import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditPacketEvidence,
  requirementIds,
  proposalSha256,
} from "../src/funding/supplier-packet/evidence.js";
import {
  supplierCatalog,
  sha256,
  catalogCsv,
} from "../src/funding/supplier-packet/catalog.js";
import { renderSupplierPacket } from "../src/funding/supplier-packet/render.js";
import { verifyPublication } from "../src/funding/supplier-packet/publication.js";
const catalog = supplierCatalog(),
  hash = sha256(JSON.stringify(catalog, null, 2));
const evidence = () => {
  const input = {
    program: "fl-pep",
    candidate: "AMP-PRACTICE-STUDENT",
    catalogSha256: hash,
    records: requirementIds.map((requirement) => ({
      requirement,
      reference: "restricted-record",
      reviewerReference: "reviewer-record",
      reviewedOn: "2026-10-17",
      expiresOn: "2026-12-01",
      catalogSha256: hash,
      proposalSha256: hash,
      decision: "accepted",
    })),
    publicUrls: {
      product: "https://example.com/product",
      demo: "https://example.com/demo",
      privacy: "https://example.com/privacy",
      terms: "https://example.com/terms",
      support: "https://example.com/support",
    },
    commercial: {
      currency: "USD",
      priceMinor: 10000,
      termMonths: 12,
      automaticRenewal: false,
    },
  };
  const digest = proposalSha256(input as Parameters<typeof proposalSha256>[0]);
  input.records.forEach((r) => (r.proposalSha256 = digest));
  return input;
};
test("absent evidence cannot become preparation-ready, and complete index never enables an offer", () => {
  const absent = auditPacketEvidence(
    {
      program: "fl-pep",
      candidate: "AMP-PRACTICE-STUDENT",
      catalogSha256: hash,
      records: [],
    },
    hash,
    "2026-10-17",
  );
  assert.equal(absent.preparationEvidenceComplete, false);
  assert.ok(
    absent.gaps.includes("annual-term: exactly one accepted record required"),
  );
  const complete = auditPacketEvidence(evidence(), hash, "2026-10-17");
  assert.equal(complete.preparationEvidenceComplete, true);
  assert.equal(complete.listingEvidenceComplete, true);
  assert.equal(complete.offerEnabled, false);
  assert.equal(complete.submissionStatus, "unsent");
});
test("scope, duplicate, future and stale records fail closed", () => {
  for (const mutate of [
    (e: ReturnType<typeof evidence>) => {
      e.catalogSha256 = "0".repeat(64);
    },
    (e: ReturnType<typeof evidence>) => {
      e.records[0].catalogSha256 = "0".repeat(64);
    },
    (e: ReturnType<typeof evidence>) => {
      e.records[0].reviewedOn = "2026-10-18";
    },
    (e: ReturnType<typeof evidence>) => {
      e.records[0].expiresOn = "2026-10-16";
    },
    (e: ReturnType<typeof evidence>) => {
      e.records[0].reviewedOn = "2026-01-01";
    },
    (e: ReturnType<typeof evidence>) => {
      e.records.push(e.records[0]);
    },
  ]) {
    const e = evidence();
    mutate(e);
    assert.equal(
      auditPacketEvidence(e, hash, "2026-10-17").preparationEvidenceComplete,
      false,
    );
  }
  assert.equal(
    auditPacketEvidence(
      { ...evidence(), program: "fl-fes-ua" },
      hash,
      "2026-10-17",
    ).listingEvidenceComplete,
    false,
  );
});
test("transport URLs and unreviewed prices cannot pass, private identifiers never appear in audit output", () => {
  for (const url of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/?token=private",
  ]) {
    const e = evidence();
    e.publicUrls.demo = url;
    assert.equal(
      auditPacketEvidence(e, hash, "2026-10-17").preparationEvidenceComplete,
      false,
    );
  }
  const e = evidence();
  e.commercial.priceMinor = 0;
  assert.equal(
    auditPacketEvidence(e, hash, "2026-10-17").preparationEvidenceComplete,
    false,
  );
  assert.ok(
    !JSON.stringify(
      auditPacketEvidence(evidence(), hash, "2026-10-17"),
    ).includes("restricted-record"),
  );
});
test("registered catalog is unpriced and neutral CSV protects spreadsheet cells", () => {
  assert.ok(catalog.books.length > 0);
  assert.equal(
    new Set(catalog.products.map((p) => p.id)).size,
    catalog.products.length,
  );
  assert.ok(
    catalog.products.every(
      (p) => p.priceMinor === null && p.categoryDecision === "unresolved",
    ),
  );
  const modified = structuredClone(catalog);
  modified.products[0].title = '=HYPERLINK("evil")';
  assert.match(catalogCsv(modified), /"'=HYPERLINK\(""evil""\)"/);
  const html = renderSupplierPacket(modified, [], "2026-10-17");
  assert.ok(!html.includes("restricted-record"));
  assert.match(html, /not a complete K–12/);
});
test("publication evidence cannot omit current source entries or substitute edition", async () => {
  const dir = await mkdtemp(join(tmpdir(), "amp-packet-"));
  const book = catalog.books[0];
  try {
    const manifest = {
      book: book.id,
      version: book.version,
      contentSha256: book.contentSha256,
      pages: book.pages,
      physicalPdfPages: book.pages,
      pdfTagged: true,
      pdfSha256: hash,
      htmlSha256: hash,
      sourceHashes: {},
      overflow: [],
      diagramOverflow: [],
    };
    await writeFile(join(dir, book.id + ".pdf"), "fixture");
    await writeFile(join(dir, "index.html"), "fixture");
    await writeFile(join(dir, "validation.json"), JSON.stringify(manifest));
    const root = fileURLToPath(new URL("..", import.meta.url));
    await assert.rejects(verifyPublication(root, dir, book), /Current-source/);
    await writeFile(
      join(dir, "validation.json"),
      JSON.stringify({ ...manifest, version: "wrong" }),
    );
    await assert.rejects(
      verifyPublication(root, dir, book),
      /edition mismatch/,
    );
    await rm(join(dir, "index.html"));
    await symlink(join(dir, book.id + ".pdf"), join(dir, "index.html"));
    await assert.rejects(verifyPublication(root, dir, book), /Symlink/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("accepted records are invalidated by price or public URL changes", () => {
  for (const alter of [
    (e: ReturnType<typeof evidence>) => {
      e.commercial.priceMinor += 1;
    },
    (e: ReturnType<typeof evidence>) => {
      e.publicUrls.demo = "https://example.com/other";
    },
  ]) {
    const e = evidence();
    alter(e);
    assert.equal(
      auditPacketEvidence(e, hash, "2026-10-17").listingEvidenceComplete,
      false,
    );
  }
  assert.equal(
    auditPacketEvidence(evidence(), hash, "2026-10-17").submissionReady,
    false,
  );
});

test("actual PDF metadata overrides a self-consistent but false manifest", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const { renderBook } = await import("../src/publishing/book.js");
  const { bookFor } = await import("../src/books/catalog.js");
  const { publicationSourceHashes } =
    await import("../src/publishing/source-manifest.js");
  const dir = await mkdtemp(join(tmpdir(), "amp-packet-pdf-"));
  const book = catalog.books[0],
    root = fileURLToPath(new URL("..", import.meta.url));
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save()),
      html = renderBook(bookFor(book.id)!.content);
    const manifest = {
      book: book.id,
      version: book.version,
      contentSha256: book.contentSha256,
      pages: book.pages,
      physicalPdfPages: book.pages,
      pdfTagged: true,
      pdfSha256: sha256(bytes),
      htmlSha256: sha256(html),
      sourceHashes: await publicationSourceHashes(root, book.id),
      overflow: [],
      diagramOverflow: [],
    };
    await writeFile(join(dir, book.id + ".pdf"), bytes);
    await writeFile(join(dir, "index.html"), html);
    await writeFile(join(dir, "validation.json"), JSON.stringify(manifest));
    await assert.rejects(
      verifyPublication(root, dir, book),
      /Actual PDF structure mismatch/,
    );
    await writeFile(
      join(dir, book.id + ".pdf"),
      Buffer.concat([bytes, Buffer.from("tamper")]),
    );
    await assert.rejects(verifyPublication(root, dir, book), /bytes mismatch/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("transaction templates contain no issued invoice or paid-status evidence", async () => {
  const { transactionDocumentTemplates } =
    await import("../src/funding/supplier-packet/documents.js");
  for (const d of transactionDocumentTemplates()) {
    assert.equal(d.status, "template-not-issued");
    assert.equal(d.totalMinor, null);
    assert.equal(d.settledAmountMinor, null);
    assert.equal(d.documentId, null);
    assert.equal(d.requiredStudentIdentifier, null);
  }
});
