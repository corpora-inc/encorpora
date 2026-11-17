/**
 * The navigation rule (docs/design/ia.md, "Navigation"): screens move with
 * EntityLink, useLayers, closeTo and typed routes. Outside the navigation
 * module, a screen never jumps to the account root or out of the app's
 * history: no `navigate({ to: "/" })`, `<Link to="/">`, `redirect({ to: "/" })`,
 * `window.location` assignment or `history.back()`. Each place that must
 * (sign-out, a payment provider, a full reload after an update) is listed
 * below with its reason and count; anything new fails the build. A screen's
 * rendered redirect is nav/Navigate.tsx, never the router's own.
 *
 *   npx tsx scripts/check-navigation.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src/web/", import.meta.url).pathname;
/** The navigation module itself: the route table, return targets, layers,
 * and the root (nav/root.tsx). */
const MODULE = [
  /^nav\//,
  /^lib\/return-to\.ts$/,
  /^app\/router\.tsx$/,
  /^app\/school-routes\.tsx$/,
  // The school route table's guards, loaded with a school address.
  /^app\/school-guards\.ts$/,
  /^app\/pay-routes\.tsx$/,
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
 * Only leaving the app's history belongs here: signing in or out, a payment
 * provider's page, development. Everything else moves with the navigation
 * module (EntityLink, useLayers, closeTo, nav/root.tsx for the root). */
const ALLOWED: Record<string, [count: number, reason: string]> = {
  "app/boot.tsx": [
    1,
    "sign-out: another account leaves a parent's purchase view",
  ],
  "home-entry.tsx": [
    1,
    "the light pitch's way on when the app can't load: a full load of it",
  ],
  "auth.ts": [3, "sign-in and sign-out hand off with a full load"],
  "lib/api.ts": [1, "an ended session reloads into sign-in"],
  "features/school/clever/link.ts": [
    1,
    "explicit account linking hands off to Clever OAuth",
  ],
  "features/account/BillingPage.tsx": [1, "Stripe subscription management"],
  "features/billing/api.ts": [1, "Stripe Checkout"],
  "features/pay/api.ts": [1, "Stripe Checkout"],
  "features/pay/CardPanel.tsx": [1, "resuming an open Stripe Checkout"],
  "features/onboarding/PlanStep.tsx": [1, "resuming an open Stripe Checkout"],
  "features/dev/PersonaSwitcher.tsx": [
    1,
    "development only: a fresh signed-in load as another persona",
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
// A rendered redirect is src/web/nav/Navigate.tsx, which navigates once per
// destination. The router's own re-navigates on every render with new
// props, and a screen that renders while its navigation is pending then
// never lets it commit (the tab hangs).
for (const path of files(ROOT)) {
  const file = relative(ROOT, path);
  if (file === "nav/Navigate.tsx") continue;
  if (
    /import\s*\{[^}]*\bNavigate\b[^}]*\}\s*from\s*"@tanstack\/react-router"/.test(
      readFileSync(path, "utf8"),
    )
  ) {
    failed++;
    console.error(
      `${file}: imports the router's Navigate. Use src/web/nav/Navigate.tsx.`,
    );
  }
}
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
