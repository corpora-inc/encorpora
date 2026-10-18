import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  reimbursementProgramsSchema,
  receiptRequestSchema,
  receiptFields,
} from "../src/billing/evidence/reimbursement.js";
import { paymentPdf } from "../src/billing/evidence/pdf.js";
import { syntheticPaymentRecord } from "./payment-evidence-fixtures.js";

test("program configuration permits only supported receipt fields and safe instruction links", () => {
  const entry = {
    id: "fixture-program",
    state: "AZ",
    programName: "Synthetic program",
    officialUrl: "https://example.test/rules",
    requiredFields: Object.keys(receiptFields),
  };
  assert.equal(reimbursementProgramsSchema.parse([entry]).length, 1);
  for (const change of [
    { officialUrl: "javascript:alert(1)" },
    { officialUrl: "https://user:pass@example.test" },
    { requiredFields: ["bankAccount"] },
    { state: "Arizona" },
  ])
    assert.equal(
      reimbursementProgramsSchema.safeParse([{ ...entry, ...change }]).success,
      false,
    );
  assert.equal(
    reimbursementProgramsSchema.safeParse([entry, entry]).success,
    false,
  );
});
test("receipt name is explicit, bounded and supported by the PDF font", () => {
  for (const learnerName of ["Jo Example", "Élodie Muñoz", "", undefined])
    assert.ok(receiptRequestSchema.safeParse({ learnerName }).success);
  for (const learnerName of ["测试", "name\nforged field", "a".repeat(121)])
    assert.equal(
      receiptRequestSchema.safeParse({ learnerName }).success,
      false,
    );
});
test("receipts deterministically include the parent name and every supported required field without changing facts", async () => {
  const record = structuredClone(syntheticPaymentRecord);
  const before = JSON.stringify(record);
  const first = await paymentPdf(record, undefined, "Élodie Muñoz");
  assert.deepEqual(first, await paymentPdf(record, undefined, "Élodie Muñoz"));
  assert.equal(JSON.stringify(record), before);
  const directory = await mkdtemp(join(tmpdir(), "amp-reimbursement-"));
  try {
    const path = join(directory, "receipt.pdf");
    await writeFile(path, first);
    const text = execFileSync("pdftotext", ["-layout", path, "-"], {
      encoding: "utf8",
    });
    for (const expected of [
      "Synthetic Éducation Company",
      "100 Example Street",
      "Jan 1, 2026",
      "Jan 1, 2027",
      "Quantity: 1",
      "$120.00",
      "card",
      "Élodie Muñoz",
      "entered by parent",
    ])
      assert.ok(text.includes(expected), expected);
    await writeFile(path, await paymentPdf(record));
    assert.equal(
      execFileSync("pdftotext", [path, "-"], { encoding: "utf8" }).includes(
        "Élodie",
      ),
      false,
    );
    delete record.baseline!.paymentMethod;
    await writeFile(path, await paymentPdf(record));
    assert.ok(
      execFileSync("pdftotext", [path, "-"], { encoding: "utf8" }).includes(
        "Not recorded",
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
