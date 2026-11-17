import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { router } from "../../../app/router";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { payState, usePayStore } from "../store";

/* Every older pay address reaches the one pay screen in one hop, seeding
   the pay store with what it carried; the new addresses carry nothing. */

const session = { accountId: "parent-1", token: "fixture-session" };
const child = (id: string, name: string, extra = {}) => ({
  id,
  name,
  deletedAt: null,
  access: [],
  stripeLinked: false,
  hasAccess: false,
  ...extra,
});
const family = (learners: ReturnType<typeof child>[]): SignedInMe => ({
  signedIn: true,
  account: { id: session.accountId, email: "parent@example.test", emailVerified: true },
  consent: { status: "none", method: null },
  learners: [],
  family: {
    consent: { status: "not-recorded", policyVersion: null, recordedAt: null, withdrawnAt: null },
    learners,
    retained: { identity: "", financial: "", backups: "", privacyAuditDays: 30 },
  },
  next: "practice",
});
const offers = {
  offers: [
    {
      id: "az-esa-annual-invoice",
      revision: "r1",
      programId: "az-esa",
      programName: "Arizona Empowerment Scholarship Account",
      jurisdiction: "AZ",
      productTitle: "AMP Mathematics",
      productDescription: "AMP Mathematics, one learner",
      totalMinor: 59900,
      taxMinor: 0,
      currency: "USD",
      instructions: "Download your invoice. Submit it.",
      destinationUrl: "https://app.classwallet.com/",
      termMonths: 12,
      merchant: { supportEmail: "support@example.test" },
    },
    {
      id: "az-esa-monthly-invoice",
      revision: "r1",
      programId: "az-esa",
      programName: "Arizona Empowerment Scholarship Account",
      jurisdiction: "AZ",
      productTitle: "AMP Mathematics",
      productDescription: "AMP Mathematics, one learner",
      totalMinor: 5900,
      taxMinor: 0,
      currency: "USD",
      instructions: "Download your invoice. Submit it.",
      destinationUrl: "https://app.classwallet.com/",
      termMonths: 1,
      merchant: { supportEmail: "support@example.test" },
    },
  ],
};

let me = family([child("august", "August")]);
const hop = async (
  path: string,
  search: Record<string, unknown> = {},
  params: Record<string, string> = {},
) => {
  const route = router.routesById[path as keyof typeof router.routesById] as {
    options: { beforeLoad: (input: unknown) => Promise<unknown> };
  };
  const searchStr = new URLSearchParams(search as Record<string, string>).toString();
  try {
    await route.options.beforeLoad({
      params,
      location: { pathname: path, search, searchStr: searchStr ? `?${searchStr}` : "" },
    });
  } catch (thrown) {
    return (thrown as { options: { href?: string; to?: string } }).options;
  }
  return null;
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  queryClient.clear();
  usePayStore.setState({ accounts: {} });
  me = family([child("august", "August")]);
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, me);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/funding/invoice-offers")) return Response.json(offers);
      if (url.includes("/billing/purchase/")) return Response.json({ learnerId: "august" });
      return Response.json(me);
    }),
  );
});
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("the new pay addresses carry no query and validate none", () => {
  for (const id of [
    "/pay/$learnerId",
    "/pay/$learnerId/card/done",
    "/pay/$learnerId/invoice/$invoiceId",
  ]) {
    const route = router.routesById[id as keyof typeof router.routesById] as {
      options: { validateSearch?: unknown };
    };
    expect(route, id).toBeTruthy();
    expect(route.options.validateSearch, id).toBeUndefined();
  }
});

test("/continue/<learner>?interval= opens that learner's pay screen on the card tab, plan kept", async () => {
  expect(
    await hop("/continue/$learnerId", { interval: "month" }, { learnerId: "august" }),
  ).toMatchObject({ href: "/pay/august", replace: true });
  expect(payState(session.accountId).learners.august).toEqual({
    method: "card",
    interval: "month",
  });
});

test("/continue for a practice profile opens the paused child's", async () => {
  me = family([
    child("august", "August"),
    child("profile", "Practice profile", { simulation: true }),
  ]);
  queryClient.setQueryData(meOptions(session).queryKey, me);
  expect(
    await hop("/continue/$learnerId", {}, { learnerId: "profile" }),
  ).toMatchObject({ href: "/pay/august" });
});

test("/purchase/funded?learner=&program=&interval= opens the education-funds tab with them", async () => {
  expect(
    await hop("/purchase/funded", { learner: "august", program: "az-esa", interval: "month" }),
  ).toMatchObject({ href: "/pay/august" });
  expect(payState(session.accountId).learners.august).toEqual({
    method: "esa",
    program: "az-esa",
    interval: "month",
  });
});

test("an old offer link names its program and plan", async () => {
  expect(
    await hop("/purchase/funded", { offer: "az-esa-monthly-invoice" }),
  ).toMatchObject({ href: "/pay/august" });
  expect(payState(session.accountId).learners.august).toEqual({
    method: "esa",
    program: "az-esa",
    interval: "month",
  });
});

test("a program's entry opens its tab for the account's one learner", async () => {
  expect(await hop("/purchase/arizona-esa")).toMatchObject({ href: "/pay/august" });
  expect(payState(session.accountId).learners.august).toMatchObject({
    method: "esa",
    program: "az-esa",
  });
});

test("signed out, a program's entry is its public invoice form, campaign labels kept", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  expect(
    await hop("/purchase/arizona-esa", { utm_source: "google", learner: "x" }),
  ).toMatchObject({ href: "/invoice/arizona-esa?utm_source=google" });
});

test("with several children and none named, the flow starts from Billing", async () => {
  me = family([child("august", "August"), child("wren", "Wren")]);
  queryClient.setQueryData(meOptions(session).queryKey, me);
  expect(await hop("/purchase/annual")).toMatchObject({ href: "/account/billing" });
  expect(await hop("/purchase/choose")).toMatchObject({ href: "/account/billing" });
  expect(await hop("/purchase/funded")).toMatchObject({ href: "/account/billing" });
});

test("an old invoice link goes to Billing, where its record is", async () => {
  expect(await hop("/purchase/funded", { invoice: "a-saved-invoice" })).toMatchObject({
    href: "/account/billing",
  });
});

test("Stripe's learner-checkout return resolves its learner once and lands on a clean confirmation", async () => {
  const purchase = "1dc64558-2238-45a4-bafb-3e9fc53d5517";
  expect(
    await hop("/purchase/annual", { billing: "processing", purchase }),
  ).toMatchObject({ href: "/pay/august/card/done" });
  expect(payState(session.accountId).returned).toMatchObject({
    learnerId: "august",
    kind: "learner",
    checkoutId: purchase,
  });
});

test("leaving Stripe returns to the plan on the card tab", async () => {
  const purchase = "1dc64558-2238-45a4-bafb-3e9fc53d5517";
  expect(
    await hop("/purchase/annual", { billing: "canceled", purchase }),
  ).toMatchObject({ href: "/pay/august" });
  expect(payState(session.accountId).learners.august).toEqual({ method: "card" });
});

test("an enrollment checkout from the pay screen returns to that learner's confirmation", async () => {
  usePayStore
    .getState()
    .checkoutOpened(session.accountId, { learnerId: "august", kind: "enrollment" });
  expect(
    await hop("/start/purchase", {
      billing: "processing",
      purchase: "1dc64558-2238-45a4-bafb-3e9fc53d5517",
    }),
  ).toMatchObject({ href: "/pay/august/card/done" });
});

test("pay screens need a signed-in adult: signed out, one hop to sign in", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  expect(await hop("/pay/$learnerId", {}, { learnerId: "august" })).toMatchObject({
    to: "/sign-in",
  });
});
