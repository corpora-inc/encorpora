import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthSession } from "../../../auth";
import { presentOffer } from "../../../../funding-purchase/contracts";
import { testFundingOffer } from "../../../../../tests/funding-purchase.fixture";

vi.mock("../../../lib/analytics");
const state = vi.hoisted(() => ({
  session: { token: "synthetic", accountId: "adult" } as AuthSession | null,
  children: [] as { id: string; name: string }[],
  own: null as { id: string; name: string } | null,
  consent: "none",
  confirmationRequired: false,
  posts: [] as { url: string; body: Record<string, unknown> }[],
  claimFails: false,
  handoffs: [] as string[],
}));
vi.mock("../../school/classes/today/use-hand-over", () => ({
  useHandOver: () => ({
    starting: null,
    error: "",
    handOver: async (learnerId: string) => {
      state.handoffs.push(learnerId);
    },
  }),
}));
vi.mock("../../../auth", () => ({
  accessSession: async () => state.session,
  authConfig: async () => ({
    mode: "accounts",
    passwords: true,
    providers: [],
  }),
  onSessionChanged: () => () => {},
  signIn: async () => {},
  signOut: async () => {},
  notifyAccountSessionChanged: () => {},
}));
vi.mock("../../../app/LegacyApp", () => ({
  LegacyApp: () => <h1>Practice</h1>,
}));
const offer = {
  ...presentOffer(testFundingOffer),
  documentPolicy: "named-student-invoice",
};
const invoiceId = "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11";
const prepared = (name = "Casey", id = invoiceId) => ({
  id,
  studentBillingName: name,
  state: "prepared",
  expiresAt: "2099-01-01T00:00:00Z",
  offer,
});
let invoices: ReturnType<typeof prepared>[] = [];
const me = () => ({
  signedIn: true,
  account: {
    id: "adult",
    email: "parent@example.test",
    emailVerified: !state.confirmationRequired,
    confirmationRequired: state.confirmationRequired,
  },
  consent: { status: state.consent, method: null },
  learners: state.children.map((child) => ({
    ...child,
    birthYear: 2016,
    entitlement: { active: false, plan: null, endsAt: null },
  })),
  family: {
    consent: {
      status: state.consent === "active" ? "active" : "not-recorded",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: {
      identity: "",
      financial: "",
      backups: "",
      privacyAuditDays: 30,
    },
  },
  adultPractice: {
    eligible: false,
    learner: state.own && { ...state.own, active: false },
  },
  next: state.children.length || state.own ? "practice" : "start",
});
function respond(url: string, init?: RequestInit) {
  const path = new URL(url, location.origin).pathname;
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    state.posts.push({ url: path, body });
    if (path.endsWith("/claim")) {
      if (state.claimFails)
        return Response.json({ error: "service_unavailable" }, { status: 503 });
      invoices = invoices.filter((i) => !path.includes(i.id));
      return Response.json({
        id: invoiceId,
        accessStatus: "pending",
        fundedPending: {
          status: "funded-pending",
          endsAt: "2099-01-01T00:00:00Z",
        },
      });
    }
    if (path === "/api/v1/funding/invoices") {
      invoices = [prepared(body.studentBillingName)];
      return Response.json({
        invoiceId,
        totalMinor: 12300,
        merchantName: "Fixture",
        pdfBase64: "UERG",
        filename: "invoice.pdf",
        destinationUrl: offer.destinationUrl,
        instructions: offer.instructions,
        expiresAt: "2099-01-01T00:00:00Z",
      });
    }
  }
  if (path === "/api/v1/me") return Response.json(me());
  if (path === "/api/v1/funding/invoice-offers")
    return Response.json({
      offers: [
        offer,
        { ...offer, id: "monthly", termMonths: 1, totalMinor: 1900 },
      ],
    });
  if (path === "/api/v1/funding/requests")
    return Response.json({ requests: [] });
  if (path === "/api/v1/funding/invoices") return Response.json({ invoices });
  return Response.json({});
}
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  state.session = { token: "synthetic", accountId: "adult" };
  state.children = [];
  state.own = null;
  state.consent = "none";
  state.confirmationRequired = false;
  state.claimFails = false;
  state.handoffs = [];
  state.posts = [];
  invoices = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      respond(String(input instanceof Request ? input.url : input), init),
    ),
  );
  URL.createObjectURL = vi.fn(() => "blob:invoice");
  URL.revokeObjectURL = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function open(url = "/purchase/funded?program=az-esa") {
  history.replaceState(null, "", url);
  const { FundedPurchasePage } = await import("../FundedPurchasePage");
  const { FundedEntry } = await import("../FundedEntry");
  const { queryClient } = await import("../../../lib/query");
  queryClient.clear();
  const root = createRootRoute({
    component: Outlet,
    validateSearch: (search) => search,
  });
  const routes = [
    createRoute({
      getParentRoute: () => root,
      path: "/purchase/funded",
      component: FundedPurchasePage,
    }),
    ...["arkansas-efa", "new-hampshire-efa", "arizona-esa"].map((slug) =>
      createRoute({
        getParentRoute: () => root,
        path: `/purchase/${slug}`,
        component: FundedEntry,
      }),
    ),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

test.each(["arkansas-efa", "new-hampshire-efa", "arizona-esa"])(
  "old %s links open the unified invoice page for guests",
  async (slug) => {
    state.session = null;
    const router = await open(`/purchase/${slug}`);
    await screen.findByRole("heading", { name: "Pay with education funds" });
    expect(router.state.location.pathname).toBe("/purchase/funded");
    expect(router.state.location.search).toMatchObject({
      program:
        slug === "arkansas-efa"
          ? "ar-efa"
          : slug === "new-hampshire-efa"
            ? "nh-efa"
            : "az-esa",
    });
    expect(screen.queryByText("Review parent consent")).toBeNull();
  },
);

test("a guest downloads an invoice before sign-up and keeps its program through account creation", async () => {
  state.session = null;
  await open();
  fireEvent.change(await screen.findByLabelText("Student name on invoice"), {
    target: { value: "Casey" },
  });
  fireEvent.change(screen.getByLabelText("Your email"), {
    target: { value: "parent@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Get invoice" }));
  await screen.findByRole("link", { name: "Download invoice PDF" });
  const signup = screen.getByRole("link", {
    name: "Create account & start learning",
  });
  expect(signup.getAttribute("href")).toContain("/sign-up?return=arizona-esa");
  expect(state.posts).toHaveLength(1);
});

test("an unconfirmed account can create the invoice and has an actionable email recovery", async () => {
  state.confirmationRequired = true;
  state.children = [{ id: "casey", name: "Casey" }];
  await open();
  fireEvent.click(await screen.findByRole("button", { name: "Get invoice" }));
  expect(
    (
      await screen.findByRole("link", {
        name: "Confirm email & start learning",
      })
    ).getAttribute("href"),
  ).toContain("/start/verify-email?return=arizona-esa");
  expect(state.posts).toHaveLength(1);
});

test("a new family recovers its prepared invoice above the composer with a program-preserving setup link", async () => {
  invoices = [prepared()];
  await open();
  const setup = await screen.findByRole("link", { name: "Set up learner" });
  expect(setup.getAttribute("href")).toContain(
    "/start/name?return=arizona-esa",
  );
  expect(
    screen
      .getByRole("heading", { name: "Education-fund invoices" })
      .compareDocumentPosition(screen.getByLabelText("Funding program")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("returning parents with incomplete consent can type and claim an invoice without a consent dead end", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  await open();
  const name = await screen.findByLabelText("Student name on invoice");
  fireEvent.change(name, { target: { value: "Casey Example" } });
  fireEvent.click(screen.getByRole("radio", { name: /Monthly/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Get invoice & start learning" }),
  );
  await screen.findByRole("heading", { name: "You’re ready to start" });
  expect(state.posts[0]!.body).toMatchObject({
    offerId: "monthly",
    studentBillingName: "Casey Example",
  });
  expect(state.posts[1]!.body).toEqual({ learnerId: "casey" });
});

test("a saved invoice retries access without creating or charging a second invoice", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  state.claimFails = true;
  await open();
  fireEvent.click(
    await screen.findByRole("button", { name: "Get invoice & start learning" }),
  );
  const retry = await screen.findByRole("button", { name: "Try again" });
  state.claimFails = false;
  fireEvent.click(retry);
  await screen.findByRole("heading", { name: "You’re ready to start" });
  expect(
    state.posts.filter((p) => p.url === "/api/v1/funding/invoices"),
  ).toHaveLength(1);
  expect(state.posts.filter((p) => p.url.endsWith("/claim"))).toHaveLength(2);
});

test("prepared invoices select their own matching child rather than sharing one selection", async () => {
  state.children = [
    { id: "casey", name: "Casey" },
    { id: "robin", name: "Robin" },
  ];
  invoices = [
    prepared(),
    prepared("Robin", "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b12"),
  ];
  await open();
  const robin = (await screen.findByRole("heading", { name: "Robin" })).closest(
    "article",
  )!;
  expect(
    (within(robin).getByLabelText("Learner") as HTMLSelectElement).value,
  ).toBe("robin");
  fireEvent.click(
    within(robin).getByRole("button", { name: "Start learning" }),
  );
  await vi.waitFor(() =>
    expect(state.posts[0]!.body).toEqual({ learnerId: "robin" }),
  );
  await vi.waitFor(() => expect(state.handoffs).toEqual(["robin"]));
});

test("an expired unpaid invoice keeps its download without a broken Start action", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  invoices = [{ ...prepared(), expiresAt: "2020-01-01T00:00:00Z" }];
  await open();
  await screen.findByText(/This invoice has expired/);
  expect(screen.queryByRole("button", { name: "Start learning" })).toBeNull();
  expect(screen.getByRole("button", { name: "Download invoice" })).toBeTruthy();
});
