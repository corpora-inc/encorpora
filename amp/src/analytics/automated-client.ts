/**
 * Browsers that aren't people, recognized by the collector from the request
 * itself, so funnel counts stay counts of people. The address and user agent
 * are read here and never stored; the visitor is marked `automated`.
 *
 * - Meta's ad review loads each ad's landing page and presses its buttons, from
 *   Meta's own address space (57.141.0.0/16, "FB-BLOCK, Meta Route"). Seen in
 *   production on 2026-11-06, 11-09, 11-14 and 11-17: 30 to 50 events each,
 *   Try clicks and sign-up attempts, no session.
 * - Headless and driven browsers, and crawlers that run pages, say so in their
 *   user agent.
 */
const AUTOMATED_AGENT =
  /HeadlessChrome|\bHeadless\b|PhantomJS|Selenium|WebDriver|Puppeteer|Playwright|Lighthouse|facebookexternalhit|meta-external|Facebot|AdsBot-Google|Googlebot|Google-InspectionTool|bingbot|Bytespider|GPTBot|ClaudeBot/i;

/** An IPv4 address, plain or IPv6-mapped (`::ffff:57.141.0.1`). */
function ipv4(address: string): number[] | null {
  const parts = address.replace(/^::ffff:/i, "").split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : NaN,
  );
  return octets.every((octet) => octet <= 255) ? octets : null;
}

export function automatedClient(
  address: string | undefined,
  userAgent: string | undefined,
): boolean {
  const octets = address ? ipv4(address) : null;
  if (octets && octets[0] === 57 && octets[1] === 141) return true;
  return !!userAgent && AUTOMATED_AGENT.test(userAgent.slice(0, 1024));
}
