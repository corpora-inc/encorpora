import assert from "node:assert/strict";

export const contrastPairs = [
  { id: "light:390", theme: "light", width: 390 },
  { id: "light:1280", theme: "light", width: 1280 },
  { id: "dark:390", theme: "dark", width: 390 },
  { id: "dark:1280", theme: "dark", width: 1280 },
] as const;

// Every pair must visit the complete route and interaction inventory.
export const contrastStates = [
  "home",
  "learner-select-open",
  "family-menu-open",
  "/lessons",
  "/progress",
  "practice-problem",
  "feedback-incorrect",
  "feedback-correct",
  "feedback-assisted",
  "choice-problem",
  "choice-feedback-incorrect",
  "choice-feedback-correct",
  "/start/plan",
  "/start",
  "/start/parent",
  "/start/school",
  "/family/learners",
  "/family/access",
  "/family/privacy",
  "/purchase",
  "/purchase/annual",
  "/purchase/funded",
  "dialog-birth-year",
  "toast-error",
] as const;

export function contrastPartition(args: readonly string[]) {
  const selectors = args.filter((arg) => arg.startsWith("--only="));
  assert.ok(
    args.every((arg) => arg === "--strict" || arg.startsWith("--only=")),
    "Expected --strict and/or --only=THEME:WIDTH",
  );
  assert.ok(selectors.length <= 1, "Only one contrast pair may be selected");
  if (!selectors.length) return [...contrastPairs];
  const pair = contrastPairs.find((pair) => pair.id === selectors[0]!.slice(7));
  assert.ok(pair, "Unknown or empty contrast pair");
  return [pair];
}

export function assertContrastCoverage(
  visited: readonly string[],
  pairs: ReturnType<typeof contrastPartition>,
) {
  assert.ok(pairs.length > 0, "Contrast partition is empty");
  const expected = pairs.flatMap(({ theme, width }) =>
    contrastStates.map((state) => `${theme} ${width} ${state}`),
  );
  assert.deepEqual(
    [...visited].sort(),
    expected.sort(),
    "Contrast sweep must complete every selected state exactly once",
  );
}
