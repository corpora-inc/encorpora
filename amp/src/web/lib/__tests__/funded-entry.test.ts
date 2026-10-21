import { afterEach, expect, test, vi } from "vitest";
import {
  campaignSearch,
  continuationSearch,
  continuationUrl,
  fundedAttribution,
  rememberFundedPurchase,
  pendingFundedPurchase,
  forgetFundedPurchase,
} from "../funded-entry";
const campaign = {
  utm_campaign: "ar-efa-launch",
  utm_source: "facebook",
  utm_medium: "paid-social",
};
afterEach(() => vi.unstubAllGlobals());
test("only complete, fixed labels survive; no arbitrary queries or identifiers", () => {
  expect(
    campaignSearch({
      ...campaign,
      email: "private@example.test",
      gclid: "click-id",
    }),
  ).toEqual(campaign);
  for (const value of [
    {},
    { ...campaign, utm_source: "private@example.test" },
    { ...campaign, utm_medium: ["cpc"] },
    { utm_campaign: "ar-efa-launch" },
  ])
    expect(campaignSearch(value)).toEqual({});
  expect(fundedAttribution(campaign)).toEqual({
    campaign: "ar-efa-launch",
    source: "facebook",
    medium: "paid-social",
  });
});
test("privacy signals remove measurement without losing the funded destination", () => {
  for (const privacy of [{ globalPrivacyControl: true }, { doNotTrack: "1" }]) {
    vi.stubGlobal("navigator", privacy);
    expect(continuationSearch({ ...campaign, return: "arkansas-efa" })).toEqual(
      { return: "arkansas-efa" },
    );
    expect(continuationUrl({ ...campaign, return: "arkansas-efa" })).toBe(
      "/purchase/arkansas-efa",
    );
    expect(fundedAttribution(campaign)).toBeUndefined();
  }
});
test("authentication returns only to fixed internal paths", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/family/private",
    "javascript:alert(1)",
  ])
    expect(continuationUrl({ return: value })).toBe("/start");
  expect(
    continuationUrl({
      ...campaign,
      return: "arkansas-efa",
      token: "secret",
      learner: "child",
    }),
  ).toBe(
    "/purchase/arkansas-efa?utm_campaign=ar-efa-launch&utm_source=facebook&utm_medium=paid-social",
  );
  expect(continuationUrl({ return: "security" })).toBe("/family/security");
});

test("purchase continuation belongs to one account, expires, and rechecks privacy", () => {
  localStorage.clear();
  rememberFundedPurchase("parent-a", campaign);
  expect(pendingFundedPurchase("parent-a")).toContain("utm_source=facebook");
  expect(pendingFundedPurchase("parent-b")).toBeNull();
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  expect(pendingFundedPurchase("parent-a")).toBe("/purchase/arkansas-efa");
  expect(
    localStorage.getItem("amp.pending-funded-purchase.parent-a"),
  ).not.toContain("facebook");
  forgetFundedPurchase("parent-a");
  expect(pendingFundedPurchase("parent-a")).toBeNull();
  localStorage.setItem(
    "amp.pending-funded-purchase.parent-a",
    JSON.stringify({ expiresAt: Date.now() - 1, labels: campaign }),
  );
  expect(pendingFundedPurchase("parent-a")).toBeNull();
  expect(
    localStorage.getItem("amp.pending-funded-purchase.parent-a"),
  ).toBeNull();
});
