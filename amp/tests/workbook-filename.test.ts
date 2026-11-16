import assert from "node:assert/strict";
import test from "node:test";
import {
  workbookFilename,
  workbookStackFilename,
  workbookDisposition,
  attachmentFilename,
} from "../src/workbook/filename";
const workbook = {
  id: "11111111-2222-4333-8444-555555555555",
  date: "2026-11-16",
  number: 2,
  code: "ABCD-1234",
};
test("workbook names retain learner, date, sequence and immutable identity across file types", () => {
  assert.equal(
    workbookFilename(workbook, "Maya Smith", "html"),
    "amp-workbook-maya-smith-2026-11-16-2-abcd-1234.html",
  );
  assert.equal(
    workbookFilename(workbook, "Maya Smith", "pdf", "A4"),
    "amp-workbook-maya-smith-2026-11-16-2-abcd-1234-A4.pdf",
  );
  assert.notEqual(
    workbookFilename(workbook, "Maya", "pdf"),
    workbookFilename({ ...workbook, code: "EFGH-5678" }, "Maya", "pdf"),
  );
  assert.notEqual(
    workbookFilename(workbook, "Maya", "pdf"),
    workbookFilename(workbook, "Casey", "pdf"),
  );
  assert.match(
    workbookFilename({ ...workbook, code: undefined }, undefined, "html"),
    /learner-2026-11-16-2-11111111-2222-4333-8444-555555555555/,
  );
});
test("names are safe across scripts, headers and blob downloads", () => {
  const name = workbookFilename(
    workbook,
    '../Zoë 王 / "\r\nX: \\🙃',
    "pdf",
    "Letter",
  );
  assert.match(name, /zoë-王-x/);
  assert.doesNotMatch(name, /[\r\n"/\\]/);
  const header = workbookDisposition(name);
  assert.doesNotMatch(header, /[\r\n]/);
  assert.equal(attachmentFilename(header, "fallback.pdf"), name);
  assert.equal(
    attachmentFilename('attachment; filename="old.pdf"', "fallback.pdf"),
    "old.pdf",
  );
  for (const header of [
    null,
    "filename*=UTF-8''%ZZ",
    'filename="../bad.pdf"',
    "filename*=UTF-8''bad%0d%0aname.pdf",
  ])
    assert.equal(attachmentFilename(header, "fallback.pdf"), "fallback.pdf");
  assert(
    Buffer.byteLength(
      workbookFilename(workbook, "𠀀".repeat(200), "pdf", "Letter"),
    ) < 255,
  );
});
test("combined workbooks name their children and actual issued set without collisions across subsets or parts", async () => {
  const input = {
    date: workbook.date,
    number: 2,
    workbooks: [
      { id: "one", name: "Maya" },
      { id: "two", name: "Casey" },
    ],
    paper: "A4" as const,
    part: 1,
    parts: 1,
  };
  const name = await workbookStackFilename(input);
  assert.match(
    name,
    /^amp-workbooks-maya-casey-2026-11-16-2-[a-f0-9]{16}-A4.pdf$/,
  );
  assert.equal(
    await workbookStackFilename(input),
    name,
    "Reprints keep the same filename",
  );
  assert.notEqual(
    await workbookStackFilename({
      ...input,
      workbooks: [
        { id: "one", name: "Maya" },
        { id: "three", name: "Casey" },
      ],
    }),
    name,
  );
  assert.notEqual(
    await workbookStackFilename({
      ...input,
      workbooks: [...input.workbooks].reverse(),
    }),
    name,
  );
  assert.match(
    await workbookStackFilename({ ...input, part: 2, parts: 3 }),
    /-part-2-of-3.pdf$/,
  );
  assert.match(
    await workbookStackFilename({
      ...input,
      part: 2,
      parts: 2,
      workbooks: [input.workbooks[0]!],
    }),
    /-part-2-of-2.pdf$/,
  );
  assert.match(
    await workbookStackFilename({
      ...input,
      workbooks: [...input.workbooks, { id: "three", name: "Avery" }],
    }),
    /maya-casey-and-1-more/,
  );
  assert.equal(
    await workbookStackFilename({
      ...input,
      workbooks: [{ id: workbook.id, name: "Maya" }],
    }),
    workbookFilename({ ...workbook, code: undefined }, "Maya", "pdf", "A4"),
  );
});
