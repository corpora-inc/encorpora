/** A learner's typed whole number or decimal with correctly placed thousands
 * separators ("29,674", "1,234,567", "-1,234.5") without them. Anything else
 * comes back unchanged, so a malformed grouping ("29,67", "2,9674",
 * "1,23,456", ",500") stays unparseable and a comma that means something
 * else (a pair, a list, a set) is never reinterpreted. The comma is never a
 * decimal comma, and fractions are left alone. Only learner entries pass
 * through here: stored answer keys and problem seeds are not rewritten. */
export function ungroupThousands(input: string): string {
  const s = input.trim().replaceAll("−", "-");
  return /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)
    ? s.replaceAll(",", "")
    : input;
}
