/** A class's time export joined with its host's people from other groups:
 * one file, a `Group` column saying where each line's time was spent. */

/** As the server writes a cell: a spreadsheet never runs it as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** A CSV's records, each as its own text, quotes kept whole. */
function records(text: string): string[] {
  const body = text.replace(/^﻿/, "");
  const out: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "\n") {
      const record = body.slice(start, index).replace(/\r$/, "");
      if (record) out.push(record);
      start = index + 1;
    }
  }
  const last = body.slice(start).replace(/\r$/, "");
  if (last) out.push(last);
  return out;
}

/** The class's lines gain its name as their group; each other file (already
 * carrying `Group`) adds its lines under the same header. */
export function mergeTimeCsv(
  classCsv: string,
  className: string,
  others: readonly string[],
): string {
  const [header, ...lines] = records(classCsv);
  if (!header) throw new Error("The class's time export has no header.");
  const group = csvCell(className);
  const out = [
    `${header},Group`,
    ...lines.map((line) => `${line},${group}`),
    ...others.flatMap((text) => records(text).slice(1)),
  ];
  return `${out.join("\r\n")}\r\n`;
}
