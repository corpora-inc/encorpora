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
test("fixed creatives survive continuation while unknown creative text is discarded", () => {
  const known = { ...campaign, utm_content: "efa-facebook-feed-v1" };
  expect(campaignSearch(known)).toEqual(known);
  expect(fundedAttribution(known)).toEqual({
    campaign: "ar-efa-launch",
    source: "facebook",
    medium: "paid-social",
    creative: "efa-facebook-feed-v1",
  });
  expect(
    campaignSearch({ ...campaign, utm_content: "private@example.test" }),
  ).toEqual(campaign);
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  expect(campaignSearch(known)).toEqual({});
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

test("each funded program survives authentication, new consent tabs and privacy opt-out", () => {
  for (const slug of ["arkansas-efa", "new-hampshire-efa", "arizona-esa"]) {
    localStorage.clear();
    const search = { return: slug, ...campaign };
    expect(continuationUrl(search)).toContain(`/purchase/${slug}`);
    rememberFundedPurchase("parent-a", search);
    expect(pendingFundedPurchase("parent-a")).toContain(`/purchase/${slug}`);
    expect(pendingFundedPurchase("parent-b")).toBeNull();
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    expect(pendingFundedPurchase("parent-a")).toBe(`/purchase/${slug}`);
    vi.unstubAllGlobals();
  }
  localStorage.setItem(
    "amp.pending-funded-purchase.parent-a",
    JSON.stringify({
      expiresAt: Date.now() + 60000,
      labels: {},
      destination: "https://evil.example",
    }),
  );
  expect(pendingFundedPurchase("parent-a")).toBeNull();
});
test("Arizona campaign labels use the same bounded continuation", () => {
  expect(
    continuationUrl({
      ...campaign,
      utm_campaign: "az-esa-launch",
      return: "arizona-esa",
    }),
  ).toContain("/purchase/arizona-esa?utm_campaign=az-esa-launch");
});

test("funded attribution cannot label a different program's purchase", () => {
  expect(
    fundedAttribution(campaign, { programId: "nh-efa", jurisdiction: "NH" }),
  ).toBeUndefined();
  expect(
    fundedAttribution(campaign, { programId: "az-esa", jurisdiction: "AZ" }),
  ).toBeUndefined();
  expect(
    fundedAttribution(
      { ...campaign, utm_campaign: "az-esa-launch" },
      { programId: "az-esa", jurisdiction: "AZ" },
    )?.campaign,
  ).toBe("az-esa-launch");
});
