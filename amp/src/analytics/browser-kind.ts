/**
 * The kind of browser a page runs in, as a closed category: the in-app
 * webviews paid ads open in, or a standard browser. Derived from a few
 * user-agent markers; the user agent itself is never stored or sent.
 */
export const BROWSER_KINDS = [
  "standard",
  "inapp-tiktok",
  "inapp-instagram",
  "inapp-facebook",
  "inapp-snapchat",
  "inapp-other",
] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

/** The app whose in-app browser a page runs in. `webview` is an embedded
 * browser that names no app. */
export type InAppApp =
  | "tiktok"
  | "instagram"
  | "snapchat"
  | "facebook"
  | "linkedin"
  | "x"
  | "line"
  | "wechat"
  | "pinterest"
  | "whatsapp"
  | "reddit"
  | "google"
  | "threads"
  | "webview";
/** The phone system an in-app browser runs on; it decides how a page can
 * leave the webview for the real browser. */
export type InAppPlatform = "ios" | "android" | "other";
export type InAppBrowser = { app: InAppApp; platform: InAppPlatform };

/** Markers each app adds to its webview's user agent. Order matters: Instagram
 * and Messenger webviews also carry Facebook's markers on some versions. */
const markers: readonly (readonly [InAppApp, RegExp])[] = [
  ["tiktok", /\bmusical_ly|\btrill_\d|BytedanceWebview|\bTikTok\b/i],
  ["instagram", /\bInstagram\b/i],
  ["snapchat", /\bSnapchat\b/i],
  [
    "facebook",
    /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\bMessenger\//i,
  ],
  ["threads", /\bBarcelona\b/i],
  ["linkedin", /\bLinkedIn(?:App)?\b/i],
  ["x", /\bTwitter/i],
  ["line", /\bLine\//],
  ["wechat", /MicroMessenger/i],
  ["pinterest", /\bPinterest/i],
  ["whatsapp", /WhatsApp/i],
  ["reddit", /\bReddit\//i],
  ["google", /\bGSA\//],
  // An Android WebView (`; wv)`) that names no app.
  ["webview", /;\s*wv\b/],
];

const analyticsKind: Partial<Record<InAppApp, BrowserKind>> = {
  tiktok: "inapp-tiktok",
  instagram: "inapp-instagram",
  facebook: "inapp-facebook",
  snapchat: "inapp-snapchat",
};

function platformOf(agent: string): InAppPlatform {
  if (/\bAndroid\b/i.test(agent)) return "android";
  if (/\b(iPhone|iPad|iPod)\b/.test(agent)) return "ios";
  return "other";
}

/** The in-app browser this user agent belongs to, or null for a standard
 * browser (Safari, Chrome, Firefox, Edge, Samsung Internet). */
export function inAppBrowser(userAgent: string): InAppBrowser | null {
  const agent = userAgent.slice(0, 1024);
  for (const [app, marker] of markers)
    if (marker.test(agent)) return { app, platform: platformOf(agent) };
  // An iOS webview reports no Safari version; Safari and the iOS browsers
  // built on it (Chrome, Firefox, Edge) all do.
  if (/\b(iPhone|iPad|iPod)\b/.test(agent) && !/\bSafari\//.test(agent))
    return { app: "webview", platform: "ios" };
  return null;
}

export function browserKind(userAgent: string): BrowserKind {
  const inApp = inAppBrowser(userAgent);
  return inApp ? (analyticsKind[inApp.app] ?? "inapp-other") : "standard";
}

function currentUserAgent() {
  return typeof navigator === "undefined" ? "" : String(navigator.userAgent);
}

/** This page's browser kind; `standard` where there is no navigator. */
export function currentBrowserKind(): BrowserKind {
  try {
    return browserKind(currentUserAgent());
  } catch (error) {
    console.warn("Browser kind unavailable; treating it as standard", error);
    return "standard";
  }
}

/** This page's in-app browser, or null in a standard browser. */
export function currentInAppBrowser(): InAppBrowser | null {
  try {
    return inAppBrowser(currentUserAgent());
  } catch (error) {
    console.warn("In-app browser unavailable; treating it as standard", error);
    return null;
  }
}
