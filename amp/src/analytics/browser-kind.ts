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

/** Markers each app adds to its webview's user agent. Order matters: Instagram
 * and Messenger webviews also carry Facebook's markers on some versions. */
const markers: readonly (readonly [BrowserKind, RegExp])[] = [
  ["inapp-tiktok", /\bmusical_ly|\btrill_\d|BytedanceWebview|\bTikTok\b/i],
  ["inapp-instagram", /\bInstagram\b/i],
  ["inapp-snapchat", /\bSnapchat\b/i],
  [
    "inapp-facebook",
    /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\bMessenger\//i,
  ],
  [
    "inapp-other",
    // An Android WebView (`; wv)`), or another app's own marker.
    /;\s*wv\b|\bLine\/|\bLinkedIn(?:App)?\b|\bPinterest|\bTwitter|MicroMessenger|WhatsApp|\bReddit\/|\bGSA\/|\bBarcelona\b/i,
  ],
];

export function browserKind(userAgent: string): BrowserKind {
  const agent = userAgent.slice(0, 1024);
  for (const [kind, marker] of markers) if (marker.test(agent)) return kind;
  // An iOS webview reports no Safari version; Safari and the iOS browsers
  // built on it (Chrome, Firefox, Edge) all do.
  if (/\b(iPhone|iPad|iPod)\b/.test(agent) && !/\bSafari\//.test(agent))
    return "inapp-other";
  return "standard";
}

/** This page's browser kind; `standard` where there is no navigator. */
export function currentBrowserKind(): BrowserKind {
  try {
    return browserKind(
      typeof navigator === "undefined" ? "" : String(navigator.userAgent),
    );
  } catch {
    return "standard";
  }
}
