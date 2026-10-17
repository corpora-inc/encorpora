/** Mirrors the server's accepted answer forms (engine.normalizeAnswer) so a
 * malformed answer is caught at the input before any request is made. */
export function acceptedAnswer(input: string): boolean {
  const s = input
    .trim()
    .replaceAll("−", "-")
    .replace(/^([+-]?)\./, "$10.");
  const fraction = /^[+-]?\d{1,18}\s*\/\s*([+-]?\d{1,18})$/.exec(s);
  if (fraction) return BigInt(fraction[1]!) !== 0n;
  return /^[+-]?\d{1,18}(?:\.\d{1,18})?$/.test(s);
}
