/**
 * The space rule (docs/architecture/spaces.md, "One set of widgets"): shared
 * widgets are space-neutral. They receive data, labels and actions from the
 * space screen that composes them, so a family never reads "student" and a
 * class never reads "your children" because a widget guessed.
 *
 * Inside the shared modules below this fails on:
 *   - a branch on an org's kind or a space (`kind === "family"`, `isFamily`,
 *     `space === …`, a `family` flag prop);
 *   - reading the account's places (`familyClass`, `secondParentOf`,
 *     `staffOf`) or the shell's place heuristics (`teachingHere`);
 *   - importing the composition layers: the space resolver, the shell's
 *     navigation, onboarding's place logic, the second-parent API.
 * Words come in as props, typed by `SpaceWords` (features/spaces/words.ts),
 * the one import from features/spaces a shared module may make.
 *
 * Everything else (the space screens, the shell, route adapters) composes
 * and may branch; the server still decides every permission.
 *
 *   npx tsx scripts/check-space-boundaries.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src/web/", import.meta.url).pathname;

/** The shared modules (code audit §5): the ui kit, and each widget that
 * Family, Classroom, School and Me compose. */
export const SHARED = [
  /^ui\//,
  /^PracticeWorkspace\.tsx$/,
  /^features\/school\/classes\/ClassMap\.tsx$/,
  /^features\/school\/classes\/ProgressRecord\.tsx$/,
  /^features\/school\/classes\/GradeCurve\.tsx$/,
  /^features\/school\/classes\/grade-parts\.tsx$/,
  /^features\/school\/classes\/EvidenceSheet\.tsx$/,
  /^features\/school\/classes\/today\/Feed\.tsx$/,
  /^features\/school\/classes\/today\/WeekFacts\.tsx$/,
  /^features\/school\/classes\/today\/SignInCode\.tsx$/,
  /^features\/school\/join\/JoinClass\.tsx$/,
  /^features\/school\/join\/CodeTiles\.tsx$/,
  /^features\/pathways\/Graph\.tsx$/,
  /^features\/workbooks\/WorkbookList\.tsx$/,
  /^features\/continue\/AllowancePause\.tsx$/,
];

export const BRANCHES: [RegExp, string][] = [
  [
    // An org's kind; `network` is also a failure's kind, which is not one.
    /(?<!(?:error|failure|problem)\.)\bkind\s*[!=]==?\s*["'](family|school|district)["']|["'](family|school|district)["']\s*[!=]==?\s*[\w.]*\bkind\b|\b(org|place|school|target)\w*\.kind\s*[!=]==?\s*["']network["']/,
    "branches on an org's kind",
  ],
  [/\bspace\s*[!=]==?\s*["']/, "branches on a space"],
  [/\bisFamily\b|\bfamilyOrg\b/, "branches on a family flag"],
  [
    /\bfamily\s*\??:\s*boolean|\bfamily=\{|\bfamily\s*[,)]\s*$/,
    "takes a family flag",
  ],
  [
    /\bfamilyClass\b|\bsecondParentOf\b|\bstaffOf\b/,
    "reads the account's places",
  ],
  [/\bteachingHere\b/, "infers the place on screen"],
];

export const IMPORTS: [RegExp, string][] = [
  [
    /features\/spaces\/(resolve|useSpace|places)|\.\.?\/(\.\.\/)*spaces\/(resolve|useSpace|places)/,
    "the space resolver",
  ],
  [
    /navigation\/(school-navigation|PlaceSwitcher|DrawerContents)/,
    "the shell's navigation",
  ],
  [/onboarding\/guard/, "onboarding's place logic"],
  [/second-parent\/api/, "the second-parent API"],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every finding in one shared module's source. */
export function findings(file: string, source: string): string[] {
  const found: string[] = [];
  let comment = false;
  source.split("\n").forEach((line, index) => {
    const text = line.trim();
    if (comment) {
      if (text.includes("*/")) comment = false;
      return;
    }
    if (text.startsWith("/*") && !text.includes("*/")) {
      comment = true;
      return;
    }
    if (/^(\/\/|\*|\/\*)/.test(text)) return;
    const code = line.replace(/\/\/.*$/, "");
    const rules = /^\s*(import|export)\b.*\bfrom\b|^\s*\}\s*from\b/.test(code)
      ? IMPORTS
      : BRANCHES;
    for (const [pattern, why] of rules)
      if (pattern.test(code))
        found.push(`${file}:${index + 1}: ${why}: ${text}`);
  });
  return found;
}

export function check(root = ROOT) {
  const all: string[] = [];
  let checked = 0;
  for (const path of files(root)) {
    const file = relative(root, path);
    if (!SHARED.some((pattern) => pattern.test(file))) continue;
    checked++;
    all.push(...findings(file, readFileSync(path, "utf8")));
  }
  return { checked, found: all };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { checked, found } = check();
  if (found.length) {
    console.error(
      "A shared widget takes its words, data and actions as props; the space " +
        "screen that composes it decides them (docs/architecture/spaces.md).",
    );
    for (const line of found) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`spaces: ${checked} shared module(s), no space branches.`);
}
