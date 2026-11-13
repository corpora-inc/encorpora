import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthSession } from "../../../auth";

/* The program page after sign-in, for an invoice made out before it: the
   account holder may connect it to her own learner, with or without one yet,
   and a child still needs the parent's consent first. */

type Child = { id: string; name: string };
const state = vi.hoisted(() => ({
  session: { token: "t", accountId: "adult" } as AuthSession,
  own: null as { id: string; name: string } | null,
  children: [] as Child[],
  consent: "none" as "none" | "active",
  posts: [] as { url: string; body: unknown }[],
}));
vi.mock("../../../auth", () => ({
  accessSession: vi.fn(async () => state.session),
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
  LegacyApp: () => <h1>Signed-in app</h1>,
}));
vi.mock("../../../FundingPurchaseCenter", () => ({
  FundingPurchaseCenter: (props: {
    learners: readonly Child[];
    ownLearnerId?: string;
  }) => (
    <h1>
      Purchase center: {props.learners.map((l) => l.name).join(", ")} /{" "}
      {props.ownLearnerId ?? "no own learner"}
    </h1>
  ),
}));

const me = () => ({
  signedIn: true,
  account: { id: "adult", email: "student@example.com", emailVerified: true },
  consent: { status: state.consent, method: null },
  learners: state.children.map((child) => ({
    ...child,
    birthYear: 2014,
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
    learner: state.own && { ...state.own, active: true },
  },
  next: state.own || state.children.length ? "practice" : "start",
});
let invoices: unknown[] = [];
function respond(url: string, init?: RequestInit) {
  const path = new URL(url, location.origin).pathname;
  if (init?.method === "POST") {
    state.posts.push({ url: path, body: JSON.parse(String(init.body)) });
    if (path === "/api/v1/me/practice") {
      state.own = { id: "own-new", name: "Me" };
      return Promise.resolve(
        Response.json({ learnerId: "own-new" }, { status: 201 }),
      );
    }
    if (path.endsWith("/claim")) {
      invoices = [];
      return Promise.resolve(Response.json({ id: "invoice" }));
    }
  }
  const json =
    path === "/api/v1/me"
      ? me()
      : path === "/api/v1/funding/offers"
        ? { offers: [{ programId: "az-esa", jurisdiction: "AZ" }] }
        : path === "/api/v1/funding/invoices"
          ? { invoices }
          : {};
  return Promise.resolve(Response.json(json, { status: 200 }));
}
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  state.own = null;
  state.children = [];
  state.consent = "none";
  state.posts = [];
  invoices = [
    {
      id: "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11",
      studentBillingName: "Fixture Student",
      state: "prepared",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      offer: { programId: "az-esa" },
    },
  ];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      respond(String(input instanceof Request ? input.url : input), init),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function open(url: string) {
  history.replaceState(null, "", url);
  const { router } = await import("../../../app/router");
  const { queryClient } = await import("../../../lib/query");
  queryClient.clear();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

test("an adult with no learner yet connects her invoice to herself: her learner starts, then the invoice is hers", async () => {
  const router = await open("/purchase/arizona-esa");
  expect(
    await screen.findByRole("heading", { name: "Connect your invoice" }),
  ).toBeTruthy();
  // No parental consent step, and no child to create.
  expect(router.state.location.pathname).toBe("/purchase/arizona-esa");
  const mine = screen.getByRole("radio", { name: "Me" });
  expect(mine.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Use this invoice" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(2));
  expect(state.posts[0]!.url).toBe("/api/v1/me/practice");
  expect(state.posts[1]).toEqual({
    url: "/api/v1/funding/invoices/8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11/claim",
    body: { learnerId: "own-new" },
  });
});

test("an adult with her own learner connects the invoice to it directly", async () => {
  state.own = { id: "own", name: "Student" };
  await open("/purchase/arizona-esa");
  const mine = await screen.findByRole("radio", { name: "Me" });
  expect(mine.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Use this invoice" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(1));
  expect(state.posts[0]).toMatchObject({ body: { learnerId: "own" } });
});

test("choosing a child without the parent's consent leads to consent, never to a claim that fails", async () => {
  state.own = { id: "own", name: "Parent" };
  state.children = [{ id: "child", name: "Robin" }];
  const router = await open("/purchase/arizona-esa");
  await screen.findByRole("heading", { name: "Connect your invoice" });
  expect(
    screen.getByRole("radio", { name: "Me" }).getAttribute("aria-checked"),
  ).toBe("false");
  fireEvent.click(screen.getByRole("radio", { name: "Robin" }));
  expect(screen.queryByRole("button", { name: "Use this invoice" })).toBeNull();
  fireEvent.click(
    screen.getByRole("link", { name: "Continue to parent consent" }),
  );
  await vi.waitFor(() =>
    expect(router.state.location.pathname).toBe("/start/consent"),
  );
  expect(state.posts).toEqual([]);
});

test("with no invoice waiting, an adult on her own buys for herself without a consent step", async () => {
  invoices = [];
  state.own = { id: "own", name: "Student" };
  await open("/purchase/arizona-esa");
  expect(
    await screen.findByRole("heading", {
      name: /Purchase center: Me \/ own/,
    }),
  ).toBeTruthy();
});

test("with no invoice and no learner yet, she chooses herself or a child; a child goes to consent", async () => {
  invoices = [];
  await open("/purchase/arizona-esa");
  expect(
    await screen.findByRole("heading", { name: "Who’s learning?" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "For my child" }).getAttribute("href"),
  ).toMatch(/^\/start\/consent\?/);
  fireEvent.click(screen.getByRole("button", { name: "For me" }));
  expect(
    await screen.findByRole("heading", {
      name: /Purchase center: Me \/ own-new/,
    }),
  ).toBeTruthy();
  expect(state.posts.map((post) => post.url)).toEqual(["/api/v1/me/practice"]);
});
