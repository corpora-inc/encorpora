import type { GeneratedProblem, PublicProblem } from "../math/contracts.js";
/** Immutable offline grader v1. New grading rules require a new dispatch version. */
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
function rational(n: bigint, d: bigint = 1n): string {
  if (!d) throw new Error("Zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1n ? `${n}` : `${n}/${d}`;
}
/** Bounded exact literals only: no expressions, exponents, infinity or float tolerance. */
export function normalizeAnswer(input: string): string | null {
  if (typeof input !== "string" || input.length > 100) return null;
  const s = input
    .trim()
    .replaceAll("−", "-")
    .replace(/^([+-]?)\./, "$10.");
  const f = /^([+-]?\d{1,18})\s*\/\s*([+-]?\d{1,18})$/.exec(s);
  if (f)
    return BigInt(f[2]!) === 0n ? null : rational(BigInt(f[1]!), BigInt(f[2]!));
  const m = /^([+-]?)(\d{1,18})(?:\.(\d{1,18}))?$/.exec(s);
  if (!m) return null;
  const decimals = m[3] ?? "";
  return rational(
    BigInt(`${m[1] === "-" ? "-" : ""}${m[2]}${decimals}`),
    10n ** BigInt(decimals.length),
  );
}
export function isValidResponse(
  problem: PublicProblem,
  response: string,
): boolean {
  return problem.response.kind === "choice"
    ? problem.response.options.some((option) => option.id === response)
    : normalizeAnswer(response) !== null;
}
export function gradeOfflineV1(
  problem: GeneratedProblem,
  response: string,
): boolean {
  if (problem.public.response.kind === "choice")
    return (
      isValidResponse(problem.public, response) && response === problem.answer
    );
  const answer = normalizeAnswer(response);
  return answer !== null && answer === normalizeAnswer(problem.answer);
}
