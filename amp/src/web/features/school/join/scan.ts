import {
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
} from "../../../../schools/contracts";

export type ScannedSignIn =
  { kind: "card"; token: string } | { kind: "class"; code: string };

/** What a QR code means here: a student's card, or a class's board. Only ever
 * used as data for our own API; a scanned address is never opened. */
export function readScan(text: string): ScannedSignIn | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch (error) {
    // A code that isn't an address is simply not ours.
    console.warn("A scanned code isn’t an address", error);
    return null;
  }
  if (url.pathname === "/c" && url.hash.length > 1)
    return { kind: "card", token: url.hash.slice(1) };
  const code = /^\/join\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const normalized = code && normalizeJoinCode(code);
  return normalized && normalized.length === JOIN_CODE_LENGTH
    ? { kind: "class", code: normalized }
    : null;
}
