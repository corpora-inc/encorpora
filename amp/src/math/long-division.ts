/* Browser-safe: lesson illustrations draw the same steps the generator explains. */
/** The standard algorithm, one quotient digit per step, as written in a layout. */
export function longDivisionSteps(dividend: number, divisor: number) {
  const digits = String(dividend).split("").map(Number);
  let start = 0,
    partial = 0;
  while (partial < divisor && start < digits.length)
    partial = partial * 10 + digits[start++]!;
  const steps: {
    partial: number;
    digit: number;
    product: number;
    rest: number;
    broughtDown?: number;
  }[] = [];
  for (let i = start; ; i++) {
    const digit = Math.floor(partial / divisor),
      product = digit * divisor,
      rest = partial - product;
    steps.push({ partial, digit, product, rest });
    if (i >= digits.length) break;
    steps[steps.length - 1]!.broughtDown = digits[i]!;
    partial = rest * 10 + digits[i]!;
  }
  return steps;
}
