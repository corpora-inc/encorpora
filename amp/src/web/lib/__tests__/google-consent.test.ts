import { afterEach, expect, test, vi } from "vitest";
import { createGoogleAnalytics } from "../../../analytics/google-analytics";

// Minimum compliance: consent-mode default-deny only where Google's EU user
// consent policy requires it; GPC is the only US opt-out signal we must honor.
type Command = unknown[];
const gaWindow = window as unknown as Record<string, unknown>;
function consentDefaults(): Record<string, unknown>[] {
  return ((gaWindow.dataLayer as IArguments[]) ?? [])
    .map((entry) => Array.from(entry) as Command)
    .filter((entry) => entry[0] === "consent" && entry[1] === "default")
    .map((entry) => entry[2] as Record<string, unknown>);
}
function start() {
  vi.stubGlobal("location", new URL("https://amp.corpora.inc/"));
  gaWindow.dataLayer = undefined;
  gaWindow["ga-disable-G-TGEK0ZGHMD"] = undefined;
  createGoogleAnalytics().navigate();
}
function privacy(name: "doNotTrack" | "globalPrivacyControl", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}
afterEach(() => {
  vi.unstubAllGlobals();
  privacy("doNotTrack", undefined);
  privacy("globalPrivacyControl", undefined);
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

test("US visitors grant ad storage and ad user data by default; EEA stays denied", () => {
  start();
  const [global, eea] = consentDefaults();
  expect(global).toMatchObject({
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "denied",
  });
  expect(eea).toMatchObject({
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  expect(eea.region).toEqual(expect.arrayContaining(["DE", "FR", "GB", "CH"]));
});

test("Do Not Track no longer disables measurement", () => {
  privacy("doNotTrack", "1");
  start();
  expect(gaWindow["ga-disable-G-TGEK0ZGHMD"]).toBe(false);
  expect(consentDefaults()[0]).toMatchObject({ ad_storage: "granted" });
});

test("Global Privacy Control denies ad consent but keeps first-party analytics", () => {
  privacy("globalPrivacyControl", true);
  start();
  expect(gaWindow["ga-disable-G-TGEK0ZGHMD"]).toBe(false);
  expect(consentDefaults()[0]).toMatchObject({
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
  });
});
