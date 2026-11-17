/**
 * Open a headed browser with a persistent AMP video profile and wait for a
 * person to sign in to production by OAuth. Nothing is typed or bypassed by
 * this script, and no cookie or session value is printed.
 *
 *   npx tsx scripts/product-grabs/sign-in-once.ts family|teacher [expected-email]
 *
 * It closes on its own once https://amp.corpora.inc reports a signed-in
 * account (normally at "What brings you to AMP?"; choose nothing there).
 */
import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { chromePath } from "../../browser-security.mjs";

const ORIGIN = "https://amp.corpora.inc";
const role = process.argv[2] ?? "";
if (role !== "family" && role !== "teacher") {
  console.error("Usage: sign-in-once.ts family|teacher [expected-email]");
  process.exit(2);
}
// The address to check against stays out of this public repository.
const expectedEmail = (process.argv[3] ?? process.env.AMP_VIDEO_EXPECTED_EMAIL ?? "").toLowerCase();
const base = join(homedir(), ".config", "corpora", "amp-video");
const profile = join(base, "profiles", role);
await mkdir(profile, { recursive: true, mode: 0o700 });
for (const dir of [base, join(base, "profiles"), profile]) await chmod(dir, 0o700);

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath: chromePath(),
  viewport: null,
  args: ["--window-size=1100,900"],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${ORIGIN}/sign-up`);
console.log(
  `Sign in${expectedEmail ? ` as ${expectedEmail}` : ""} with the provider of your choice (Google, Microsoft, Apple or GitHub).\n` +
    `Stop at "What brings you to AMP?". This window closes by itself once you are signed in.`,
);
let closed = false;
context.on("close", () => (closed = true));
for (;;) {
  if (closed) {
    console.error("The window was closed before sign-in finished.");
    process.exit(1);
  }
  try {
    const response = await context.request.get(`${ORIGIN}/api/v1/me`);
    if (response.ok()) {
      const me = (await response.json()) as {
        signedIn?: boolean;
        account?: { email?: string | null };
      };
      const email = me.signedIn === true ? me.account?.email : null;
      if (email) {
        const match = !expectedEmail || email.toLowerCase() === expectedEmail;
        console.log(
          match
            ? `Signed in${expectedEmail ? " as the expected address" : ""}. Profile saved.`
            : `Signed in, but NOT as ${expectedEmail}. Tell the coordinator; the profile is kept as is.`,
        );
        await new Promise((r) => setTimeout(r, 1500));
        await context.close();
        process.exit(match ? 0 : 3);
      }
    }
  } catch {
    // The browser may be mid-navigation on a provider page; keep waiting.
  }
  await new Promise((r) => setTimeout(r, 2000));
}
