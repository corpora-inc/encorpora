import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { router } from "../../../app/router";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { payState, usePayStore } from "../store";

/* Every older pay address reaches the one pay screen in one hop, seeding
   the pay store with what it carried; the new addresses carry nothing. */

const session = { accountId: "parent-1", token: "fixture-session" };
const FAMILY = "fam-1";
/** August's pay overlay over his own page. */
const OVER_AUGUST = `/family/${FAMILY}/kids/august/pay`;
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
  learners: learners
    .filter((entry) => !("simulation" in entry))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      birthYear: 2017,
      entitlement: { active: true, plan: null, endsAt: null },
    })),
  familyClass: { orgId: FAMILY, classId: "class-1", className: "Family", notice: false },
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

test("the pay overlays hang under their screens and carry no query", () => {
  for (const path of [
    "/family/$family/kids/$learner/pay",
    "/family/$family/kids/$learner/pay/done",
    "/family/$family/kids/$learner/pay/invoice/$invoiceId",
    "/family/$family/pay/$learner",
    "/family/$family/pay/$learner/done",
    "/family/$family/pay/$learner/invoice/$invoiceId",
    "/account/billing/pay/$learner",
    "/account/billing/pay/$learner/done",
    "/account/billing/pay/$learner/invoice/$invoiceId",
  ]) {
    const route = (router.routesByPath as Record<string, { options: { validateSearch?: unknown } }>)[path];
    expect(route, path).toBeTruthy();
    expect(route!.options.validateSearch, path).toBeUndefined();
  }
});

test("/continue/<learner>?interval= opens that learner's pay screen on the card tab, plan kept", async () => {
  expect(
    await hop("/continue/$learnerId", { interval: "month" }, { learnerId: "august" }),
  ).toMatchObject({ href: OVER_AUGUST, replace: true });
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
  ).toMatchObject({ href: OVER_AUGUST });
});

test("/purchase/funded?learner=&program=&interval= opens the education-funds tab with them", async () => {
  expect(
    await hop("/purchase/funded", { learner: "august", program: "az-esa", interval: "month" }),
  ).toMatchObject({ href: OVER_AUGUST });
  expect(payState(session.accountId).learners.august).toEqual({
    method: "esa",
    program: "az-esa",
    interval: "month",
  });
});

test("an old offer link names its program and plan", async () => {
  expect(
    await hop("/purchase/funded", { offer: "az-esa-monthly-invoice" }),
  ).toMatchObject({ href: OVER_AUGUST });
  expect(payState(session.accountId).learners.august).toEqual({
    method: "esa",
    program: "az-esa",
    interval: "month",
  });
});

test("a program's entry opens its tab for the account's one learner", async () => {
  expect(await hop("/purchase/arizona-esa")).toMatchObject({ href: OVER_AUGUST });
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
  ).toMatchObject({ href: `${OVER_AUGUST}/done` });
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
  ).toMatchObject({ href: OVER_AUGUST });
  expect(payState(session.accountId).learners.august).toEqual({ method: "card" });
});

test("an enrollment checkout returns to the overlay it was opened from, on its confirmation", async () => {
  usePayStore.getState().checkoutOpened(session.accountId, {
    learnerId: "august",
    kind: "enrollment",
    base: `/account/billing/pay/august`,
  });
  expect(
    await hop("/start/purchase", {
      billing: "processing",
      purchase: "1dc64558-2238-45a4-bafb-3e9fc53d5517",
    }),
  ).toMatchObject({ href: "/account/billing/pay/august/done" });
});

test("the pay address of a day ago opens the overlay over the learner's page", async () => {
  expect(await hop("/pay/$learnerId", {}, { learnerId: "august" })).toMatchObject({
    href: OVER_AUGUST,
  });
});

test("an overlay needs a signed-in adult: signed out, one hop to sign in", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  const route = (router.routesByPath as Record<string, { options: { beforeLoad: () => Promise<unknown> } }>)[
    "/family/$family/kids/$learner/pay"
  ]!;
  await expect(route.options.beforeLoad()).rejects.toMatchObject({
    options: { to: "/sign-in" },
  });
});
