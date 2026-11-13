/**
 * The navigation rule (docs/design/ia.md, "Navigation"): screens move with
 * EntityLink, useLayers, closeTo and typed routes. Outside the navigation
 * module, a screen never jumps to the account root or out of the app's
 * history: no `navigate({ to: "/" })`, `<Link to="/">`, `redirect({ to: "/" })`,
 * `window.location` assignment or `history.back()`. Each place that must
 * (sign-out, a payment provider, a full reload after an update) is listed
 * below with its reason and count; anything new fails the build.
 *
 *   npx tsx scripts/check-navigation.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src/web/", import.meta.url).pathname;
/** The navigation module itself: the route table, return targets, layers. */
const MODULE = [
  /^nav\//,
  /^lib\/return-to\.ts$/,
  /^app\/router\.tsx$/,
  /^app\/school-routes\.tsx$/,
];
const BANNED = [
  /navigate\(\{\s*to:\s*"\/"/,
  /\bto="\/"/,
  /redirect\(\{\s*to:\s*"\/"/,
  /\bwindow\.location\.(?:assign|replace)\(|\bwindow\.location\.href\s*=[^=]/,
  /(?:^|[^.\w])location\.(?:assign|replace)\(|(?:^|[^.\w])location\.href\s*=[^=]/,
  /\bhistory\.back\(/,
];

/** Each allowed use: file, how many, and why it isn't a screen's navigation.
 * Phase 2 (docs/design/ia.md) moves the ones marked "Phase 2" to the module. */
const ALLOWED: Record<string, [count: number, reason: string]> = {
  "main.tsx": [1, "boot: a stale native build reopens the root once"],
  "auth.ts": [3, "sign-in and sign-out hand off with a full load"],
  "lib/api.ts": [1, "an ended session reloads into sign-in"],
  "AnnualPurchase.tsx": [2, "Stripe Checkout and the billing portal"],
  "FundingPurchaseCenter.tsx": [1, "a funded program's payment page"],
  "FamilyCenter.tsx": [1, "Stripe's billing portal"],
  "ParentConsentCenter.tsx": [1, "a funded purchase's checked return URL"],
  "features/billing/api.ts": [1, "Stripe Checkout"],
  "features/continue/ContinueScreen.tsx": [
    2,
    "Stripe Checkout; Phase 2: its Back becomes closeTo",
  ],
  "features/onboarding/PlanStep.tsx": [1, "a funded purchase's resume URL"],
  "features/school/InviteScreen.tsx": [1, "sign-in with the invite's return"],
  "features/dev/PersonaSwitcher.tsx": [1, "development: a fresh signed-in load"],
  "ui/PageFrame.tsx": [2, "signed-out public pages: the logo is the site's home"],
  "features/pitch/PitchScreen.tsx": [1, "the signed-out pitch's own logo"],
  "features/pitch/BuyOptions.tsx": [1, "the signed-out pitch's start"],
  "features/onboarding/VerifyEmailStep.tsx": [1, "first run, before any place"],
  "features/access/AccessScreen.tsx": [1, "a gift, before any place"],
  "features/profiles/practice-mode.ts": [
    1,
    "root resolution: a place's account leaves a practice screen for its place",
  ],
  "features/profiles/api.ts": [
    1,
    "a profile started outside a place returns to the root; Phase 2",
  ],
  "app/LegacyApp.tsx": [1, "Phase 2: the learner app's unknown screen"],
  "features/pathways/PathwaysScreen.tsx": [1, "Phase 2: the learner's logo"],
  "features/funding/InvoiceClaim.tsx": [1, "Phase 2: a funded claim's done"],
  "features/school/classroom/StandingsScreen.tsx": [
    1,
    "a student's logo: their practice is their only place",
  ],
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" || name === "design" ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const found = new Map<string, string[]>();
for (const path of files(ROOT)) {
  const file = relative(ROOT, path);
  if (MODULE.some((pattern) => pattern.test(file))) continue;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (BANNED.some((pattern) => pattern.test(line)))
        found.set(file, [
          ...(found.get(file) ?? []),
          `${file}:${index + 1}: ${line.trim()}`,
        ]);
    });
}
let failed = 0;
for (const [file, lines] of found) {
  const [allowed = 0] = ALLOWED[file] ?? [];
  if (lines.length > allowed) {
    failed++;
    console.error(
      `${file}: ${lines.length} root or document navigation(s), ${allowed} allowed. ` +
        "Use EntityLink, useLayers or closeTo (src/web/nav), or list it in " +
        "scripts/check-navigation.ts with its reason.",
    );
    for (const line of lines) console.error(`  ${line}`);
  }
}
for (const [file, [count]] of Object.entries(ALLOWED))
  if ((found.get(file)?.length ?? 0) < count)
    console.warn(`${file}: fewer than its ${count} allowed; lower the count.`);
if (failed) process.exit(1);
console.log(
  `navigation: ${[...found.values()].flat().length} allowed use(s) in ${found.size} file(s); nothing new.`,
);
