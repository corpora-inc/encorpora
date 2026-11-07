import {
  gaSignupContextSchema,
  type GaSignupContext,
} from "./ga-signup-context";
import { browserIdentity } from "./browser-identity";
import { entryContext } from "./entry-context";
import {
  marketingPageTitles,
  pitchProgramId,
  publicAppPageTitle,
  publicAppPageTitles,
  type HomeScreen,
  type PitchProgramId,
} from "./page-titles";

// Public website tag, not an API credential. Shared across both production sites.
export const GA_MEASUREMENT_ID = "G-TGEK0ZGHMD";
const disabledKey = `ga-disable-${GA_MEASUREMENT_ID}`;
const clickKeys = ["gclid", "gbraid", "wbraid"];
const publicMarketingPaths = new Set(Object.keys(marketingPageTitles));
const publicAppPaths = new Set(Object.keys(publicAppPageTitles));

/** A finite public route list. Private routes, fragments and arbitrary parameters
 * never become GA page locations. Learning activity stays in first-party reports.
 * `/` is public only while it shows the signed-out pitch; the signed-in home
 * is a learning screen.
 */
export function googlePage(
  input: string,
  home: HomeScreen = "pitch",
): string | undefined {
  const url = new URL(input);
  if (url.protocol !== "https:") return;
  const path = url.pathname.replace(/\/$/, "") || "/";
  let safePath: string | undefined;
  if (url.hostname === "corpora.inc" && publicMarketingPaths.has(path))
    safePath = path;
  if (url.hostname === "amp.corpora.inc") {
    if (publicAppPaths.has(path) && (path !== "/" || home === "pitch"))
      safePath = path;
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

/** The page title GA receives: the same fixed table the app's document title
 * uses, so GA groups the pitch, its funded-program variants and each sign-up
 * intent separately. Never a document title, form value or account label. */
export function googlePageTitle(
  input: string,
  home: HomeScreen = "pitch",
): string | undefined {
  const page = googlePage(input, home);
  if (!page) return;
  if (new URL(page).hostname === "corpora.inc")
    return marketingPageTitles[new URL(page).pathname];
  const url = new URL(input);
  return publicAppPageTitle(url.pathname + url.search, home);
}

/** The funded program a public AMP URL names, validated against the fixed list. */
export function googleProgram(input: string): PitchProgramId | undefined {
  try {
    const url = new URL(input);
    if (url.hostname !== "amp.corpora.inc") return;
    return pitchProgramId(url.searchParams.get("program"));
  } catch {
    return;
  }
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

export type GoogleEvent = {
  name: string;
  params: Readonly<Record<string, string | number>>;
};
type Forward = (
  props: Readonly<Record<string, unknown>>,
  program: PitchProgramId | undefined,
) => GoogleEvent | undefined;
const same =
  (name: string): Forward =>
  () => ({ name, params: {} });
/** The fixed set of first-party actions GA receives, and the only parameters
 * each may carry. Anything else in the first-party props is dropped. A click
 * is never a purchase: Buy is `buy_click`, never `purchase` or `begin_checkout`.
 * Video names follow GA4's recommended `video_*` events. */
const buyPlaces = {
  pitch: "pitch",
  chrome: "trial-toolbar",
  invite: "trial-invite",
} as const;
const forwarded: Readonly<Record<string, Forward>> = {
  try_click: same("try_click"),
  workbook_click: same("workbook_click"),
  buy_click: ({ path, from }, program) => {
    // Where Buy was pressed: the pitch, or the free trial's toolbar or an
    // invitation. Still a click, never a checkout or a purchase.
    const place: Record<string, string> =
      typeof from === "string" && Object.hasOwn(buyPlaces, from)
        ? { from: buyPlaces[from as keyof typeof buyPlaces] }
        : {};
    return path === "card"
      ? { name: "buy_click", params: { payment_route: "card", ...place } }
      : path === "funded"
        ? {
            name: "buy_click",
            params: { payment_route: program ?? "funded", ...place },
          }
        : undefined;
  },
  invite_view: ({ at }) =>
    at === "map" || at === "workbook"
      ? { name: "invite_view", params: { invite_at: at } }
      : undefined,
  video_play: same("video_start"),
  video_progress: ({ percent }) =>
    percent === 100
      ? { name: "video_complete", params: { video_percent: 100 } }
      : percent === 25 || percent === 50 || percent === 75
        ? { name: "video_progress", params: { video_percent: percent } }
        : undefined,
  plan_view: same("plan_view"),
  plan_select: same("plan_select"),
  checkout_start: same("begin_checkout"),
  checkout_return: same("checkout_return"),
  invoice_open: same("invoice_open"),
  invoice_close: same("invoice_close"),
  assessment_click: same("assessment_click"),
  product_click: same("product_click"),
  support_click: same("support_click"),
  funding_provider_click: same("funding_provider_click"),
  navigation_click: same("navigation_click"),
};

/** The GA event for a first-party action on the page `input`, or undefined if
 * the action is not forwarded or its props are outside the allowed values. A
 * validated `program` from the page URL is added to every forwarded event. */
export function googleEvent(
  action: string,
  props: unknown,
  input: string,
): GoogleEvent | undefined {
  if (!Object.hasOwn(forwarded, action)) return;
  const program = googleProgram(input);
  const mapped = forwarded[action](
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : {},
    program,
  );
  if (!mapped) return;
  return {
    name: mapped.name,
    params: { ...mapped.params, ...(program ? { program } : {}) },
  };
}
type AnalyticsWindow = Window &
  typeof globalThis & {
    dataLayer?: unknown[];
    [disabledKey: `ga-disable-${string}`]: boolean | undefined;
  };

/** Parent-facing GA4 traffic measurement, independent of authoritative purchase
 * exports. No learning events, purchase claims, form values or user IDs enter GA.
 * `home` reports what `/` shows now; without it `/` counts as the pitch.
 */
export function createGoogleAnalytics(
  options: {
    home?: () => HomeScreen;
    /** A school student's device: nothing is collected, and a document that
     * started as a parent's stays disabled afterwards. */
    blocked?: () => boolean;
  } = {},
) {
  const w = window as AnalyticsWindow;
  let loaded = false;
  let retired = false;
  let previous = "";
  let previousTitle: string | undefined;
  let signup: GaSignupContext | undefined;
  const identity = browserIdentity();
  const permitted = () =>
    !options.blocked?.() &&
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
      const home = options.home?.() ?? "pitch";
      const page = permitted() ? googlePage(location.href, home) : undefined;
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
      const title = googlePageTitle(location.href, home);
      if (sameGoogleVisit(previous, page) && title === previousTitle) return;
      const referrer = previous || safeReferrer(document.referrer);
      const pageParams = {
        page_location: page,
        page_referrer: referrer,
        page_title: title,
      };
      const program = googleProgram(location.href);
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
        ...(program ? { program } : {}),
        send_to: GA_MEASUREMENT_ID,
      });
      previous = page;
      previousTitle = title;
      // Non-blocking reads from the existing tag. Missing/blocked SDK means no
      // context; signup never waits on analytics or invents a client ID.
      command("get", GA_MEASUREMENT_ID, "client_id", (clientId: unknown) => {
        command(
          "get",
          GA_MEASUREMENT_ID,
          "session_id",
          (sessionId: unknown) => {
            const parsed = gaSignupContextSchema.safeParse({
              clientId,
              sessionId: Number(sessionId),
            });
            if (parsed.success) signup = parsed.data;
          },
        );
      });
    } catch {
      /* Analytics must never interrupt navigation or checkout. */
    }
  }
  /** Forward one first-party action with its validated props. */
  function event(action: string, props?: unknown) {
    try {
      if (!Object.hasOwn(forwarded, action)) return;
      navigate();
      if (!loaded || w[disabledKey] || !previous) return;
      const mapped = googleEvent(action, props, location.href);
      if (!mapped) return;
      command("event", mapped.name, {
        ...mapped.params,
        send_to: GA_MEASUREMENT_ID,
        page_location: previous,
        page_title: previousTitle,
      });
    } catch {
      /* Measurement is optional. */
    }
  }
  function signupContext(): GaSignupContext | undefined {
    try {
      if (
        !signup ||
        !loaded ||
        retired ||
        !permitted() ||
        !googlePage(location.href, options.home?.() ?? "pitch")
      )
        return;
      // Cookieless consent-mode pings cannot become server-side signup events.
      const cookie = document.cookie
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("_ga="));
      if (
        cookie?.slice(4).match(/^GA\d+\.\d+\.(\d+\.\d+)$/)?.[1] !==
        signup.clientId
      )
        return;
      return { ...signup };
    } catch {
      return;
    }
  }
  return { navigate, event, signupContext };
}

function safeReferrer(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
