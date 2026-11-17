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
  claimedRequestId: null as string | null,
  emailStatus: "queued",
  expiresAt: "2099-01-01T00:00:00Z",
  offer,
});
let invoices: ReturnType<typeof prepared>[] = [];
const claimed = (learnerId: string, id = invoiceId) => ({
  id,
  learnerId,
  studentBillingName:
    invoices.find((i) => i.id === id)?.studentBillingName ?? "Casey",
  status: "prepared",
  orderId: null as string | null,
  paymentStatus: "unpaid",
  expired: false,
  offer,
  accessStatus: "funded-pending",
  fundedPending: { status: "funded-pending", endsAt: "2099-01-01T00:00:00Z" },
});
let records: ReturnType<typeof claimed>[] = [];
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
      const id = path.split("/").at(-2)!;
      invoices = invoices.map((i) =>
        i.id === id ? { ...i, state: "claimed", claimedRequestId: id } : i,
      );
      records = [
        ...records.filter((r) => r.id !== id),
        claimed(body.learnerId, id),
      ];
      return Response.json({
        id: invoiceId,
        accessStatus: "pending",
        fundedPending: {
          status: "funded-pending",
          endsAt: "2099-01-01T00:00:00Z",
        },
      });
    }
    if (path.endsWith("/status")) {
      const id = path.split("/").at(-2)!;
      records = records.map((r) =>
        r.id === id ? { ...r, status: body.status } : r,
      );
      return Response.json(records.find((r) => r.id === id));
    }
    if (path === "/api/v1/funding/invoices") {
      invoices = [
        ...invoices.filter((i) => i.id !== invoiceId),
        prepared(body.studentBillingName),
      ];
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
    return Response.json({ requests: records });
  if (path.startsWith("/api/v1/funding/requests/"))
    return Response.json(records.find((r) => path.endsWith(r.id)));
  if (path.endsWith("/pdf"))
    return new Response("PDF", {
      headers: { "content-type": "application/pdf" },
    });
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
  records = [];
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
  const { FundingInvoices } = await import("../FundingInvoices");
  const { queryClient } = await import("../../../lib/query");
  queryClient.clear();
  const root = createRootRoute({
    component: Outlet,
    validateSearch: (search) => search,
  });
  const routes = [
    createRoute({
      getParentRoute: () => root,
      path: "/account/billing",
      component: () => <FundingInvoices session={state.session!} />,
    }),
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

test("existing invoices are managed in Billing, outside a new invoice setup", async () => {
  invoices = [prepared()];
  await open();
  await screen.findByRole("heading", { name: "New invoice" });
  expect(
    screen.queryByRole("heading", { name: "Education-fund invoices" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Download invoice" })).toBeNull();
  // No in-page Back: Billing is the Account tab, and the browser's Back.
  expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
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
  await screen.findByRole("heading", { name: /Invoice for Casey/ });
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
  await screen.findByRole("heading", { name: /Invoice for Casey/ });
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
  await open("/account/billing");
  const robin = (await screen.findByRole("heading", { name: "Robin" })).closest(
    "article",
  )!;
  const picker = within(robin).getByRole("button", { name: "Learner" });
  expect(picker.getAttribute("data-value")).toBe("robin");
  fireEvent.click(picker);
  fireEvent.click(await screen.findByRole("option", { name: "Casey" }));
  expect(picker.getAttribute("data-value")).toBe("casey");
  fireEvent.click(picker);
  fireEvent.click(await screen.findByRole("option", { name: "Robin" }));
  expect(picker.getAttribute("data-value")).toBe("robin");
  fireEvent.click(
    within(robin).getByRole("button", { name: "Start learning" }),
  );
  await vi.waitFor(() =>
    expect(state.posts[0]!.body).toEqual({ learnerId: "robin" }),
  );
  await vi.waitFor(() => expect(state.handoffs).toEqual(["robin"]));
});

test("creating an invoice for one child stays separate from another child's existing invoice", async () => {
  state.children = [
    { id: "casey", name: "Casey" },
    { id: "robin", name: "Robin" },
  ];
  invoices = [prepared("Casey", "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b12")];
  await open("/purchase/funded?program=az-esa&learner=robin");
  const form = await screen.findByRole("form", {
    name: "New invoice for Robin",
  });
  expect(
    screen.queryByRole("region", { name: "Education-fund invoices" }),
  ).toBeNull();
  expect(within(form).getByLabelText("Student name on invoice")).toHaveProperty(
    "value",
    "Robin",
  );
  expect(
    within(form).queryByRole("button", { name: "Download invoice" }),
  ).toBeNull();
  expect(screen.queryByRole("heading", { name: "Casey" })).toBeNull();
  fireEvent.change(within(form).getByLabelText("Student name on invoice"), {
    target: { value: "Robin Example" },
  });
  fireEvent.click(
    within(form).getByRole("button", { name: "Get invoice & start learning" }),
  );
  await screen.findByRole("heading", { name: "Invoice for Robin Example" });
  expect(state.posts[0]!.body.studentBillingName).toBe("Robin Example");
  expect(state.posts[1]!.body).toEqual({ learnerId: "robin" });
});

test("an expired unpaid invoice keeps its download without a broken Start action", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  invoices = [{ ...prepared(), expiresAt: "2020-01-01T00:00:00Z" }];
  await open("/account/billing");
  await screen.findByText(/This invoice has expired/);
  expect(screen.queryByRole("button", { name: "Start learning" })).toBeNull();
  expect(screen.getByRole("button", { name: "Download invoice" })).toBeTruthy();
});

test("an invoice link restores its recorded child and submission state without creating another invoice", async () => {
  state.children = [
    { id: "casey", name: "Casey" },
    { id: "robin", name: "Robin" },
  ];
  invoices = [
    {
      ...prepared("Robin Example"),
      state: "claimed",
      claimedRequestId: invoiceId,
      emailStatus: "sent",
    },
  ];
  records = [{ ...claimed("robin"), status: "parent-reported-submitted" }];
  await open(`/purchase/funded?invoice=${invoiceId}&learner=casey`);
  await screen.findByRole("heading", { name: "Invoice for Robin Example" });
  expect(screen.queryByRole("form")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "I’ve submitted it" }),
  ).toBeNull();
  expect(await screen.findByText(/Invoice emailed to/)).toBeTruthy();
  expect(screen.getByText(/Submitted · awaiting payment/)).toBeTruthy();
  expect(state.posts).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Start learning" }));
  await vi.waitFor(() => expect(state.handoffs).toEqual(["robin"]));
});

test("an unauthorized invoice link cannot become a new invoice form", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  await open(`/purchase/funded?invoice=${invoiceId}`);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "This invoice isn’t available to this account. Open Billing to find your invoices.",
  );
  expect(screen.queryByRole("form")).toBeNull();
  expect(state.posts).toHaveLength(0);
});

test("an approved order awaiting settlement does not display payment received", async () => {
  state.children = [{ id: "casey", name: "Casey" }];
  invoices = [{ ...prepared(), state: "claimed", claimedRequestId: invoiceId }];
  records = [
    {
      ...claimed("casey"),
      status: "parent-reported-submitted",
      orderId: "pending-order",
      paymentStatus: "pending",
    },
  ];
  await open(`/purchase/funded?invoice=${invoiceId}`);
  await screen.findByRole("heading", { name: "Invoice for Casey" });
  expect(screen.getByText(/Submitted · awaiting payment/)).toBeTruthy();
  expect(screen.queryByText("Payment received")).toBeNull();
});
