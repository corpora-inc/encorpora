import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { csvRows, guessMapping } from "../src/schools/sources/csv.js";
import {
  readExcelRoster,
  MAX_ROSTER_FILE_BYTES,
} from "../src/schools/sources/excel.js";

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
function workbook(sheets: { name: string; rows: string[][] }[]) {
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
    ),
  };
  for (const [i, sheet] of sheets.entries())
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => (cell === "" ? "" : `<c r="${String.fromCharCode(65 + c)}${r + 1}" ${cell.startsWith("#number:") ? `t="n"><v>${cell.slice(8)}</v>` : `t="inlineStr"><is><t>${xml(cell)}</t></is>`}</c>`)).join("")}</row>`).join("")}</sheetData></worksheet>`,
    );
  return zipSync(files);
}

test("Excel sheets use the same mapping, retain row numbers and preserve student IDs", async () => {
  const sheets = await readExcelRoster(
    workbook([
      {
        name: "Grade 3",
        rows: [
          ["Student ID", "Name", "Grade", "Class"],
          ["0007", "Ana Ruiz", "#number:3", "Math"],
          [],
          ["#number:9007199254740993", "Noor Haddad", "#number:3", "Math"],
        ],
      },
      { name: "Support", rows: [["Name"], ["Cher"]] },
      { name: "Empty", rows: [] },
    ]),
  );
  assert.deepEqual(
    sheets.map(({ name }) => name),
    ["Grade 3", "Support"],
  );
  assert.deepEqual(sheets[0]!.table.lines, [2, 4]);
  const result = csvRows(sheets[0]!.table, guessMapping(sheets[0]!.table));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    result.rows.map(({ identifier, gradeLevel }) => [identifier, gradeLevel]),
    [
      ["0007", 3],
      ["9007199254740993", 3],
    ],
  );
  assert.deepEqual(
    result.rows[0]!.classes.map(({ name }) => name),
    ["Math"],
  );
});

test("Excel rejects wrong formats and oversized compressed archives", async () => {
  await assert.rejects(readExcelRoster(strToU8("Name\nAna")));
  await assert.rejects(
    readExcelRoster(zipSync({ "users.csv": strToU8("Name\nAna") })),
    /xlsx/,
  );
  await assert.rejects(
    readExcelRoster(new Uint8Array(MAX_ROSTER_FILE_BYTES + 1)),
    /10 MB/,
  );
  await assert.rejects(
    readExcelRoster(
      zipSync({ "xl/workbook.xml": new Uint8Array(65 * 1024 * 1024) }),
    ),
    /too large/,
  );
});

test("Excel rejects sparse addresses before expanding missing rows and cells", async () => {
  for (const address of ["A50001", "GS2"]) {
    const files = unzipSync(
      workbook([{ name: "Roster", rows: [["Name"], ["Ana"]] }]),
    );
    files["xl/worksheets/sheet1.xml"] = strToU8(
      strFromU8(files["xl/worksheets/sheet1.xml"]!).replace(
        'r="A2"',
        `r="${address}"`,
      ),
    );
    await assert.rejects(
      readExcelRoster(zipSync(files)),
      /50,000 rows and 200 columns/,
    );
  }
});
