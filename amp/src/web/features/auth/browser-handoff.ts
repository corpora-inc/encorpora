import type { InAppPlatform } from "../../../analytics/browser-kind";
import { browserHandoffUrl } from "../../lib/funded-entry";
import { arrivalLabels, arrivalTitleLabels } from "../../lib/program-choice";
import { chosenPlan } from "../../lib/pending-trial";

/**
 * The one-tap way out of an in-app browser into the phone's real browser,
 * where Google sign-in works (Google refuses embedded webviews with
 * `disallowed_useragent`; the user agent is never disguised).
 *
 * - Android: an `intent://` link that opens the same address in Chrome. It
 *   names no `S.browser_fallback_url`: a host app loads that fallback inside
 *   its own webview, where Google is still refused, so a failed jump would
 *   loop. A failed jump leaves this page on view instead, and the screen
 *   shows where the app's own "open in browser" item is.
 * - iOS 17 and later: `x-safari-https://`, which opens Safari.
 *
 * Browser storage doesn't cross into the other browser, so what this tab
 * keeps leaves on the address: invitations and approvals carried across
 * sign-in as their own canonical link (`browserHandoffUrl`), and the tab's
 * arrival (its program, campaign and why it signs up, `arrivalQuery`) as the
 * query an ad's link would carry. The other browser reads that once and
 * cleans its address (app/third-party-returns.ts `signInReturn`).
 */
export function browserHandoffHref(
  href: string,
  platform: InAppPlatform,
): string | null {
  const url = new URL(withArrival(browserHandoffUrl(href)));
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (platform === "android")
    // Android's Intent.parseUri takes everything before the last `#Intent;`
    // as the address, so the address keeps its own fragment.
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;end`;
  if (platform === "ios") return `x-safari-${url.href}`;
  return null;
}

/**
 * The tab's arrival (lib/program-choice.ts) as an address's query, for the
 * one place it must cross into another browser: this handoff, whose other
 * browser's storage starts empty. That browser reads it once on arrival
 * (`keepArrival`) and cleans the address. Here, not in the store: only a
 * handoff needs it, and the store loads with every first screen.
 */
export function arrivalQuery(): Record<string, string> {
  const labels = arrivalTitleLabels();
  // A Buy's plan (lib/pending-trial.ts) opens for the learner once they
  // exist, in whichever browser finishes signing up.
  const plan = labels.entry === "pitch-buy" ? chosenPlan() : null;
  return { ...arrivalLabels(), ...labels, ...(plan ? { plan } : {}) };
}

/** An address with the tab's arrival on it, for another browser. */
export function withArrival(href: string) {
  const url = new URL(href);
  for (const [key, value] of Object.entries(arrivalQuery()))
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  return url.href;
}

/** Where each app keeps "open in browser", for the hint shown when the jump
 * didn't happen: its menu button, at the top right of the app's browser. */
export function handoffHint(platform: InAppPlatform) {
  return platform === "ios"
    ? { menu: "⋯", text: "Open in Safari from" }
    : { menu: "⋮", text: "Open in your browser from" };
}
