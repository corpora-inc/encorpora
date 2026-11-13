import { strFromU8, unzipSync } from "fflate";
import readWorkbook from "read-excel-file/universal";
import { tableFromRows, type Table } from "./csv.js";

export type RosterSheet = { name: string; table: Table };
export const MAX_ROSTER_FILE_BYTES = 10 * 1024 * 1024;
const SHEET_LIMIT =
  "This sheet is too large. Keep up to 50,000 rows and 200 columns.";

/** Sparse cell addresses can allocate much more than the archive's size.
 * Check them before the reader fills gaps between rows and columns. */
function checkCellBounds(bytes: Uint8Array) {
  const files = unzipSync(bytes, {
    filter: (file) => /\.xml$/i.test(file.name),
  });
  for (const file of Object.values(files)) {
    let rows = 0;
    for (const [tag] of strFromU8(file).matchAll(
      /<(?:[^<>"']|"[^"]*"|'[^']*')*>/g,
    )) {
      const kind = /^<(?:[\w.-]+:)?(row|c)(?=[\s/>])/.exec(tag)?.[1];
      if (!kind) continue;
      if (kind === "row" && ++rows > 50_000) throw new Error(SHEET_LIMIT);
      const address = /\sr\s*=\s*(["'])(.*?)\1/.exec(tag)?.[2];
      if (!address) continue;
      if (kind === "row") {
        if (!/^\d+$/.test(address) || Number(address) > 50_000)
          throw new Error(SHEET_LIMIT);
      } else {
        const cell = /^([A-Z]+)(\d+)$/i.exec(address);
        const column = cell?.[1]
          ?.toUpperCase()
          .split("")
          .reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
        if (!cell || !column || column > 200 || Number(cell[2]) > 50_000)
          throw new Error(SHEET_LIMIT);
      }
    }
  }
}

/** Read locally: formulas are never evaluated and no links are fetched.
 * Preserve numeric cells as strings so long student IDs aren't rounded. */
export async function readExcelRoster(
  bytes: Uint8Array,
): Promise<RosterSheet[]> {
  if (bytes.byteLength > MAX_ROSTER_FILE_BYTES)
    throw new Error("Choose an Excel file smaller than 10 MB.");
  let expanded = 0;
  let entries = 0;
  let workbook = false;
  // Inspect directory sizes before the reader expands any entries.
  unzipSync(bytes, {
    filter: (file) => {
      expanded += file.originalSize;
      entries++;
      if (expanded > 64 * 1024 * 1024 || entries > 2000)
        throw new Error(
          "This workbook is too large. Save just the roster sheet in a new file.",
        );
      if (file.name === "xl/workbook.xml") workbook = true;
      return false;
    },
  });
  if (!workbook) throw new Error("Choose an Excel .xlsx workbook.");
  checkCellBounds(bytes);
  const sheets = await readWorkbook(bytes.slice().buffer as ArrayBuffer, {
    parseNumber: (value) => value,
  });
  return sheets.flatMap(({ sheet, data }) => {
    if (data.length > 50_000 || data.some((row) => row.length > 200))
      throw new Error(SHEET_LIMIT);
    const table = tableFromRows(
      data.map((row) =>
        row.map((cell) =>
          cell === null
            ? ""
            : cell instanceof Date
              ? cell.toISOString().slice(0, 10)
              : String(cell),
        ),
      ),
    );
    return table.rows.length ? [{ name: sheet, table }] : [];
  });
}
