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
  expect(continuationUrl({ return: "security" })).toBe("/account/security");
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

test("gift invitations survive sign-in without sharing a recipient address or token", () => {
  expect(
    continuationSearch({
      return: "access",
      email: "private@example.test",
      token: "private",
    }),
  ).toEqual({ return: "access" });
  expect(continuationUrl({ return: "access" })).toBe("/access");
});

test("free account sign-in preserves a fixed practice destination and funding context", () => {
  expect(
    continuationUrl({
      return: "free-practice",
      program: "az-esa",
      ...campaign,
    }),
  ).toBe(
    "/start?utm_campaign=ar-efa-launch&utm_source=facebook&utm_medium=paid-social&program=az-esa&return=free-practice",
  );
  expect(
    continuationSearch({ return: "free-practice", program: "bad" }),
  ).toEqual({ return: "free-practice" });
});

test("a shared-state card retains its identity without inventing a funding program", () => {
  expect(
    continuationSearch({ return: "free-practice", entry: "openai-math-path" }),
  ).toEqual({
    return: "free-practice",
    entry: "openai-math-path",
  });
  expect(
    continuationUrl({ return: "free-practice", entry: "openai-math-plans" }),
  ).toBe("/start?entry=openai-math-plans&return=free-practice");
  expect(
    continuationSearch({
      return: "free-practice",
      entry: "private@example.test",
    }),
  ).toEqual({
    return: "free-practice",
  });
});

test("NH free practice retains its program and attribution through authentication", () => {
  const nh = {
    return: "free-practice",
    program: "nh-efa",
    utm_campaign: "nh-efa-launch",
    utm_source: "google",
    utm_medium: "cpc",
    utm_content: "nh-efa-adaptive-v1",
  };
  expect(continuationSearch(nh)).toEqual(nh);
  expect(continuationUrl(nh)).toBe(
    "/start?utm_campaign=nh-efa-launch&utm_source=google&utm_medium=cpc&utm_content=nh-efa-adaptive-v1&program=nh-efa&return=free-practice",
  );
  expect(
    fundedAttribution(nh, { programId: "nh-efa", jurisdiction: "NH" }),
  ).toEqual({
    campaign: "nh-efa-launch",
    source: "google",
    medium: "cpc",
    creative: "nh-efa-adaptive-v1",
  });
  expect(
    fundedAttribution(nh, { programId: "ar-efa", jurisdiction: "AR" }),
  ).toBeUndefined();
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  expect(continuationSearch(nh)).toEqual({
    return: "free-practice",
    program: "nh-efa",
  });
});

test("a sign-in comes back to any place, or a school's own setup step, by the one return contract", () => {
  const next = "/school/new?org=abc-1&step=calendar";
  expect(continuationSearch({ return: "school", next })).toEqual({
    return: "school",
    next,
  });
  expect(continuationUrl({ return: "school", next })).toBe(next);
  for (const hostile of [
    "https://example.com/school",
    "//example.com",
    "/school/../start",
    "/school\\example.com",
    "/join/ABC123",
    "/p",
    12,
  ])
    expect(continuationUrl({ return: "school", next: hostile })).toBe(
      "/school",
    );
  expect(continuationSearch({ next })).toEqual({});
  // A family's own screens: a signed-out parent signs in and comes back,
  // with its view keys and never a fragment.
  const family =
    "/family/00000000-0000-4000-8000-000000000001/kids/pip?sort=name%3Aascending";
  expect(continuationUrl({ return: "school", next: family })).toBe(family);
  expect(
    continuationUrl({ return: "school", next: `${family}#secret` }),
  ).toBe(family);
});

test("security sign-in only returns to the validated deletion page", () => {
  // Its own address, and the older one, which continues at the new one.
  for (const next of ["/account/security/delete", "/family/security/delete"])
    expect(continuationUrl({ return: "security", next })).toBe(
      "/account/security/delete",
    );
  for (const next of [
    "https://example.test",
    "//example.test",
    "/api/v1/account/delete",
    "/school/other",
    "/family/security/delete?unexpected=1",
  ]) {
    expect(continuationSearch({ return: "security", next })).toEqual({
      return: "security",
    });
    expect(continuationUrl({ return: "security", next })).toBe(
      "/account/security",
    );
  }
});
