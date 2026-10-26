/**
 * SAT student-produced-response (SPR) decimal entry, opt-in per generated
 * problem through `entryPolicy: "sat-spr"`. College Board directions (Bluebook
 * test directions, https://satsuite.collegeboard.org/media/pdf/english-sat-test-directions-bb.pdf):
 * up to 5 characters for a positive answer and 6 (including the minus sign) for
 * a negative one; a decimal that does not fit is entered by truncating or
 * rounding; the official examples accept .6666, 0.666 and 0.667 for 2/3 and
 * reject .66, 0.66, .67, 0.67 and -.33 for -1/3, so the decimal must fill the
 * space. Exact equivalent forms (3.50, 7/2) stay accepted by the exact grader.
 */
export const SAT_SPR_POLICY = "sat-spr" as const;

const MAX_POSITIVE_CHARS = 5;
const MAX_NEGATIVE_CHARS = 6;

function parseExact(answer: string): { n: bigint; d: bigint } | null {
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(answer);
  if (!m) return null;
  const d = m[2] === undefined ? 1n : BigInt(m[2]);
  return d === 0n ? null : { n: BigInt(m[1]!), d };
}

/** Length of the shortest exact decimal entry (no leading zero), or null if
 * the value does not terminate. */
function exactDecimalLength(n: bigint, d: bigint): number | null {
  const abs = n < 0n ? -n : n;
  // Reduce first so only the reduced denominator decides termination.
  const g = gcdBig(abs, d);
  let den = d / g;
  let twos = 0;
  let fives = 0;
  while (den % 2n === 0n) {
    den /= 2n;
    twos++;
  }
  while (den % 5n === 0n) {
    den /= 5n;
    fives++;
  }
  if (den !== 1n) return null;
  const digits = Math.max(twos, fives);
  const scaled = ((abs / g) * 10n ** BigInt(digits)) / (d / g);
  const whole = digits === 0 ? scaled : scaled / 10n ** BigInt(digits);
  const intText = whole === 0n ? "" : whole.toString();
  return (n < 0n ? 1 : 0) + intText.length + (digits ? 1 + digits : 0);
}
function gcdBig(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** True when `response` is a decimal that fills the SAT entry space and equals
 * the exact answer truncated or rounded at that many places. Never accepts a
 * shorter decimal, a plus sign, a fraction or a mixed number. */
export function satSprDecimalAccepted(
  exactAnswer: string,
  response: string,
): boolean {
  const exact = parseExact(exactAnswer);
  if (!exact || typeof response !== "string" || response.length > 100)
    return false;
  const negative = exact.n < 0n;
  const limit = negative ? MAX_NEGATIVE_CHARS : MAX_POSITIVE_CHARS;
  const fits = exactDecimalLength(exact.n, exact.d);
  if (fits !== null && fits <= limit) return false;
  const s = response.trim().replaceAll("−", "-");
  const m = /^(-?)(\d*)\.(\d+)$/.exec(s);
  if (!m) return false;
  if ((m[1] === "-") !== negative) return false;
  const whole = m[2]!;
  const frac = m[3]!;
  if (whole.length > 1 && whole.startsWith("0")) return false;
  if (s.length !== limit) return false;
  const k = BigInt(frac.length);
  const abs = negative ? -exact.n : exact.n;
  const scaled = abs * 10n ** k;
  const floor = scaled / exact.d;
  const rest = scaled % exact.d;
  const entered = BigInt(`${whole || "0"}${frac}`);
  const rounded = floor + (2n * rest >= exact.d ? 1n : 0n);
  return entered === floor || entered === rounded;
}
