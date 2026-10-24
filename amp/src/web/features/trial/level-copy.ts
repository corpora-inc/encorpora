/**
 * The level check's words. Whole sentences with named slots, never pieced
 * together from fragments, so each one translates as a unit. Plain and warm:
 * an honest best guess, its range, and that more answers sharpen it. Age
 * appears only when known and is never compared with the level.
 */
export const levelCopy = {
  eyebrow: (answered: number) => `Level check · ${answered} answered`,
  title: "Here’s where we think you are",
  bestGuessLabel: "Best guess",
  bestGuess: (level: string) => `Our current best guess is ${level}.`,
  range: (p: { answered: number; from: string; to: string; age?: number }) =>
    p.from === p.to
      ? p.age === undefined
        ? `After ${p.answered} problems, our current estimate is near ${p.from}.`
        : `You’re about ${p.age} and have answered ${p.answered} problems, so our current estimate is near ${p.from}.`
      : p.age === undefined
        ? `After ${p.answered} problems, we think you’re somewhere between ${p.from} and ${p.to}.`
        : `You’re about ${p.age} and have answered ${p.answered} problems, so we think you’re somewhere between ${p.from} and ${p.to}.`,
  sharpen: "Keep answering and we’ll sharpen this.",
  trendTitle: "Your level so far",
  trendLabel: (p: { answered: number; from: string; to: string }) =>
    `Best guess over ${p.answered} problems: from ${p.from} to ${p.to}. The range shows uncertainty and can widen as well as narrow.`,
  areas: "By area",
  areaLabel: (p: { area: string; level: string; from: string; to: string }) =>
    `${p.area}: ${p.level}, likely ${p.from} to ${p.to}`,
  continue: "Continue",
  fullMap: "See your full map",
};

/** "About 10": a whole age from the birth year, or nothing when unknown. */
export function approximateAge(
  birthYear: number | null | undefined,
  now = new Date(),
): number | undefined {
  if (birthYear == null) return undefined;
  const age = now.getUTCFullYear() - birthYear;
  return age >= 3 && age <= 99 ? age : undefined;
}
