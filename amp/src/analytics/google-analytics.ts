import { browserIdentity } from "./browser-identity";
import { entryContext } from "./entry-context";
import { marketingPageTitles, publicAppPageTitles } from "./page-titles";

// Public website tag, not an API credential. Shared across both production sites.
export const GA_MEASUREMENT_ID = "G-TGEK0ZGHMD";
const disabledKey = `ga-disable-${GA_MEASUREMENT_ID}`;
const clickKeys = ["gclid", "gbraid", "wbraid"];
const publicMarketingPaths = new Set(Object.keys(marketingPageTitles));
const publicAppPaths = new Set(Object.keys(publicAppPageTitles));

/** A finite public route list. Private routes, fragments and arbitrary parameters
 * never become GA page locations. Learning activity stays in first-party reports.
 */
export function googlePage(input: string): string | undefined {
  const url = new URL(input);
  if (url.protocol !== "https:") return;
  const path = url.pathname.replace(/\/$/, "") || "/";
  let safePath: string | undefined;
  if (url.hostname === "corpora.inc" && publicMarketingPaths.has(path))
    safePath = path;
  if (url.hostname === "amp.corpora.inc") {
    if (publicAppPaths.has(path)) safePath = path;
  }
  if (!safePath) return;
  const safe = new URL(safePath, url.origin);
  const context = entryContext({
    search: url.search,
    hostname: url.hostname,
    referrer: "",
    width: 1000,
    coarse: false,
  });
  for (const [key, value] of Object.entries({
    utm_source: context.utmSource,
    utm_medium: context.utmMedium,
    utm_campaign: context.utmCampaign,
    utm_content: context.utmContent,
  }))
    if (value) safe.searchParams.set(key, value);
  for (const key of clickKeys) {
    const value = url.searchParams.get(key);
    if (value && /^[A-Za-z0-9_-]{8,512}$/.test(value))
      safe.searchParams.set(key, value);
  }
  return safe.href;
}

export function googlePageTitle(input: string): string | undefined {
  const page = googlePage(input);
  if (!page) return;
  const url = new URL(page);
  return (
    url.hostname === "corpora.inc" ? marketingPageTitles : publicAppPageTitles
  )[url.pathname];
}

/** Clearing captured click IDs from the address bar is not a new page visit. */
export function sameGoogleVisit(previous: string, page: string): boolean {
  if (!previous) return false;
  const before = new URL(previous);
  const after = new URL(page);
  for (const key of clickKeys)
    if (!after.searchParams.has(key)) before.searchParams.delete(key);
  return before.href === after.href;
}

const actions = new Set([
  "try_click",
  "plan_view",
  "plan_select",
  "checkout_start",
  "checkout_return",
  "invoice_open",
  "invoice_close",
  "assessment_click",
  "product_click",
  "support_click",
  "funding_provider_click",
  "navigation_click",
]);
type AnalyticsWindow = Window &
  typeof globalThis & {
    dataLayer?: unknown[];
    [disabledKey: `ga-disable-${string}`]: boolean | undefined;
  };

/** Parent-facing GA4 traffic measurement, independent of authoritative purchase
 * exports. No learning events, purchase claims, form values or user IDs enter GA.
 */
export function createGoogleAnalytics() {
  const w = window as AnalyticsWindow;
  let loaded = false;
  let retired = false;
  let previous = "";
  const identity = browserIdentity();
  const permitted = () =>
    navigator.doNotTrack !== "1" &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl &&
    !navigator.webdriver &&
    !identity.internal();
  function command(..._args: unknown[]) {
    (w.dataLayer ??= []).push(arguments);
  }
  function navigate() {
    try {
      const page = permitted() ? googlePage(location.href) : undefined;
      // ga-disable stops hits but does not reset Google's engagement clock.
      // Once learning starts, keep this document disabled so a later parent
      // screen cannot export time spent learning. A fresh document can resume.
      if (loaded && !page) retired = true;
      w[disabledKey] = retired || !page;
      if (retired) return;
      if (!page) {
        previous = "";
        return;
      }
      if (sameGoogleVisit(previous, page)) return;
      const referrer = previous || safeReferrer(document.referrer);
      const pageParams = {
        page_location: page,
        page_referrer: referrer,
        page_title: googlePageTitle(page),
      };
      if (!loaded) {
        loaded = true;
        command("consent", "default", {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
        command("consent", "default", {
          analytics_storage: "denied",
          region: [
            "AT",
            "BE",
            "BG",
            "HR",
            "CY",
            "CZ",
            "DK",
            "EE",
            "FI",
            "FR",
            "DE",
            "GR",
            "HU",
            "IS",
            "IE",
            "IT",
            "LI",
            "LV",
            "LT",
            "LU",
            "MT",
            "NL",
            "NO",
            "PL",
            "PT",
            "RO",
            "SK",
            "SI",
            "ES",
            "SE",
            "GB",
            "CH",
          ],
        });
        command("js", new Date());
        command("config", GA_MEASUREMENT_ID, {
          ...pageParams,
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          cookie_domain: "corpora.inc",
          cookie_expires: 90 * 86400,
          cookie_flags: "SameSite=Lax;Secure",
        });
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        script.referrerPolicy = "origin";
        document.head.append(script);
      } else {
        // Destination config outranks global `set` for automatic SDK events.
        command("config", GA_MEASUREMENT_ID, {
          ...pageParams,
          send_page_view: false,
          update: true,
        });
      }
      command("event", "page_view", {
        ...pageParams,
        send_to: GA_MEASUREMENT_ID,
      });
      previous = page;
    } catch {
      /* Analytics must never interrupt navigation or checkout. */
    }
  }
  function event(action: string) {
    try {
      if (!actions.has(action)) return;
      navigate();
      if (!loaded || w[disabledKey] || !previous) return;
      command(
        "event",
        action === "checkout_start" ? "begin_checkout" : action,
        {
          send_to: GA_MEASUREMENT_ID,
          page_location: previous,
          page_title: googlePageTitle(previous),
        },
      );
    } catch {
      /* Measurement is optional. */
    }
  }
  return { navigate, event };
}

function safeReferrer(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
