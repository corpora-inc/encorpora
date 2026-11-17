import type { InAppPlatform } from "../../../analytics/browser-kind";
import { browserHandoffUrl } from "../../lib/funded-entry";

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
 * Invitations and approvals carried across sign-in on this device leave as
 * their own canonical link (`browserHandoffUrl`); browser storage doesn't
 * cross into the other browser.
 */
export function browserHandoffHref(
  href: string,
  platform: InAppPlatform,
): string | null {
  const url = new URL(browserHandoffUrl(href));
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (platform === "android")
    // Android's Intent.parseUri takes everything before the last `#Intent;`
    // as the address, so the address keeps its own fragment.
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;end`;
  if (platform === "ios") return `x-safari-${url.href}`;
  return null;
}

/** Where each app keeps "open in browser", for the hint shown when the jump
 * didn't happen: its menu button, at the top right of the app's browser. */
export function handoffHint(platform: InAppPlatform) {
  return platform === "ios"
    ? { menu: "⋯", text: "Open in Safari from" }
    : { menu: "⋮", text: "Open in your browser from" };
}
