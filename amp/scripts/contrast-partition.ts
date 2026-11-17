import assert from "node:assert/strict";

export const contrastPairs = [
  { id: "light:390", theme: "light", width: 390 },
  { id: "light:1280", theme: "light", width: 1280 },
  { id: "dark:390", theme: "dark", width: 390 },
  { id: "dark:1280", theme: "dark", width: 1280 },
] as const;

// Every pair must visit the complete route and interaction inventory: the
// parent's family and account screens, the start and purchase routes, the
// Add-a-child sheet, and a child's own practice session on this device.
export const contrastStates = [
  "family-today",
  "family-drawer-open",
  "child-page",
  "child-pathways",
  "family-map",
  "family-workbooks",
  "family-time",
  "family-reports",
  "family-people",
  "family-settings",
  "/account/security",
  "/account/billing",
  "/account/privacy",
  "/start/plan",
  "/start",
  "/start/parent",
  "/start/school",
  "/purchase",
  "/purchase/annual",
  "/purchase/funded",
  "add-child-sheet",
  "dialog-birth-year",
  "add-child-error",
  "practice-problem",
  "feedback-incorrect",
  "feedback-correct",
  "feedback-assisted",
  "choice-problem",
  "choice-feedback-incorrect",
  "choice-feedback-correct",
  "child-drawer-open",
  "pathways-lesson",
  "/overview",
  "/progress",
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
