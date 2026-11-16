/** Download names identify the learner and the immutable workbook, not just its day. */
type WorkbookIdentity = {
  id: string;
  date: string;
  number: number;
  code?: string;
};
const part = (value: string, limit: number, fallback: string) =>
  Array.from(
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, ""),
  )
    .slice(0, limit)
    .join("")
    .replace(/-+$/g, "") || fallback;

export function workbookFilename(
  workbook: WorkbookIdentity,
  learnerName: string | undefined,
  kind: "html" | "pdf",
  paper?: "Letter" | "A4",
) {
  return `amp-workbook-${part(learnerName ?? "", 32, "learner")}-${part(workbook.date, 10, "date")}-${workbook.number}-${part(workbook.code || workbook.id, 48, "workbook")}${paper ? `-${paper}` : ""}.${kind}`;
}

/** A stack's identity comes from the actual issued workbooks, in print order. */
export async function workbookStackFilename(input: {
  date: string;
  number: number;
  workbooks: { id: string; name: string }[];
  paper: "Letter" | "A4";
  part: number;
  parts: number;
}) {
  if (input.workbooks.length === 1 && input.parts === 1) {
    const workbook = input.workbooks[0]!;
    return workbookFilename(
      { ...input, id: workbook.id },
      workbook.name,
      "pdf",
      input.paper,
    );
  }
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify(input.workbooks.map((workbook) => workbook.id)),
      ),
    ),
  );
  const code = Array.from(digest.slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const names = input.workbooks
    .slice(0, 2)
    .map((workbook) => part(workbook.name, 16, "learner"))
    .join("-");
  const more =
    input.workbooks.length > 2 ? `-and-${input.workbooks.length - 2}-more` : "";
  return `amp-workbooks-${names}${more}-${part(input.date, 10, "date")}-${input.number}-${code}-${input.paper}${input.parts > 1 ? `-part-${input.part}-of-${input.parts}` : ""}.pdf`;
}

/** ASCII fallback plus RFC 5987 for names in every script, without header injection. */
export function workbookDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "-").replace(/["\\]/g, "-");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** The server knows the learner's current name; preserve it for blob downloads. */
export function attachmentFilename(header: string | null, fallback: string) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header ?? "")?.[1];
  let name: string | undefined;
  try {
    name = encoded
      ? decodeURIComponent(encoded.trim())
      : /filename="([^"]+)"/i.exec(header ?? "")?.[1];
  } catch {
    return fallback;
  }
  return name &&
    name !== "." &&
    name !== ".." &&
    !/[\x00-\x1f\x7f/\\]/.test(name)
    ? name
    : fallback;
}
