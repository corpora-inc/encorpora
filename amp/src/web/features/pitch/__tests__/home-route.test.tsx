import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthSession } from "../../../auth";

const state = vi.hoisted(() => ({
  session: null as AuthSession | null,
  posts: [] as { url: string; body: unknown }[],
  refundPolicy: undefined as string | undefined,
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
vi.mock("../../auth/SignInScreen", () => ({
  SignInScreen: () => <h1>Sign-up screen</h1>,
}));

const offer = (interval: "year" | "month", amountMinor: number) => ({
  id: interval.repeat(64).slice(0, 64),
  mode: "test",
  currency: "USD",
  amountMinor,
  formattedAmount: `$${amountMinor / 100}.00`,
  interval,
  learnerCount: 1,
});
function respond(url: string, init?: RequestInit) {
  const path = new URL(url, location.origin).pathname;
  if (init?.method === "POST")
    state.posts.push({ url: path, body: JSON.parse(String(init.body)) });
  const json =
    path === "/api/v1/billing/prices"
      ? {
          available: true,
          offers: [offer("year", 59900), offer("month", 5900)],
        }
      : path === "/api/v1/funding/invoice-offers"
        ? {
            offers: [
              {
                id: "ar-offer",
                revision: "r1",
                programName: "Arkansas EFA",
                productTitle: "AMP",
                ...(state.refundPolicy
                  ? {
                      refundPolicy: state.refundPolicy,
                      refundSummary: "Refund terms.",
                    }
                  : {}),
                totalMinor: 59900,
                currency: "USD",
                instructions: "Attach the invoice.",
                termMonths: 12,
              },
            ],
          }
        : path === "/api/v1/me"
          ? { signedIn: false }
          : {};
  return Promise.resolve(Response.json(json, { status: 200 }));
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  state.session = null;
  state.posts = [];
  state.refundPolicy = undefined;
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
  const analytics = await import("../../../lib/analytics");
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, analytics };
}

test("a signed-out visitor at / sees the pitch, with ad context kept", async () => {
  const { router, analytics } = await open(
    "/?utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&program=ar-efa",
  );
  expect(
    await screen.findByRole("heading", {
      name: "See how far your child can go in math.",
    }),
  ).toBeTruthy();
  expect(analytics.screenOf("/")).toBe("pitch");
  const [buy] = screen.getAllByRole("link", {
    name: "Buy with Arkansas EFA funds",
  });
  expect(buy!.getAttribute("href")).toBe(
    "/invoice/arkansas-efa?utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&program=ar-efa",
  );
  // An offer that has not stated its refund policy: the price only.
  expect(
    screen.getByText("$599 for the year, paid from your EFA balance."),
  ).toBeTruthy();
  // No status line is configured for this offer, so none is claimed.
  expect(screen.queryByText(/approved/i)).toBeNull();
  expect(document.querySelector("[data-funding-status]")).toBeNull();
  expect(screen.queryByText(/\.00/)).toBeNull();
  // The guarantee and its one footnote, on every page.
  expect(
    screen.getByRole("heading", { name: "Give it 30 days." }),
  ).toBeTruthy();
  expect(screen.getByText(/^\*Refunds go back the way you paid/)).toBeTruthy();
  // Try it free goes through the free-parent sign-up with its intent.
  await act(async () =>
    fireEvent.click(screen.getAllByRole("button", { name: "Try it free" })[0]!),
  );
  await screen.findByRole("heading", { name: "Sign-up screen" });
  expect(router.state.location.pathname).toBe("/sign-up");
  expect(router.state.location.search).toMatchObject({
    return: "free-practice",
    entry: "pitch-try",
    program: "ar-efa",
    utm_campaign: "ar-efa-launch",
  });
  analytics.flush(true);
  const events = state.posts
    .filter((post) => post.url === "/api/v1/events")
    .flatMap((post) => (post.body as { events: { event: string }[] }).events)
    .map((event) => event.event);
  expect(events).toEqual(
    expect.arrayContaining(["landing_view", "pitch_view", "try_click"]),
  );
});

test("a refunding program's Buy carries the guarantee; the block names the amount", async () => {
  state.refundPolicy = "full-to-account";
  await open("/?program=ar-efa");
  await screen.findAllByRole("link", { name: "Buy with Arkansas EFA funds" });
  const terms = document.querySelector("[data-buy-terms]")!;
  expect(terms.textContent).toBe(
    "$599 for the year, paid from your EFA balance.Risk\u2011free: 30\u2011day money\u2011back guarantee*",
  );
  expect(screen.getByText(/we’ll refund every cent/)).toBeTruthy();
});

test("a program refunding the purchase as received is promised your purchase", async () => {
  state.refundPolicy = "purchase-to-account";
  await open("/?program=az-esa");
  await screen.findAllByRole("link", { name: "Buy with Arizona ESA funds" });
  expect(screen.getByText(/we’ll refund your purchase/)).toBeTruthy();
  expect(screen.queryByText(/every cent|full refund/)).toBeNull();
});

test("a program that allows no refunds shows its price only beside Buy", async () => {
  state.refundPolicy = "none";
  await open("/?program=nh-efa");
  await screen.findAllByRole("link", {
    name: "Buy with New Hampshire EFA funds",
  });
  expect(
    screen.getByText("$599 for the year, paid from your EFA balance."),
  ).toBeTruthy();
});

test("without a program, Buy is the card plan and continues to checkout after sign-up", async () => {
  const { router } = await open("/");
  const [buy] = await screen.findAllByRole("button", { name: "Buy AMP" });
  fireEvent.click(screen.getByRole("radio", { name: /Monthly/ }));
  await act(async () => fireEvent.click(buy!));
  await screen.findByRole("heading", { name: "Sign-up screen" });
  expect(router.state.location.search).toMatchObject({ entry: "pitch-buy" });
  expect(router.state.location.search).not.toHaveProperty("return");
  const { chosenPlan } = await import("../../../lib/pending-trial");
  expect(chosenPlan()).toBe("month");
});

test("a signed-in parent at / keeps the app", async () => {
  state.session = { token: "t", accountId: "parent" } as AuthSession;
  const { analytics } = await open("/");
  expect(
    await screen.findByRole("heading", { name: "Signed-in app" }),
  ).toBeTruthy();
  expect(
    screen.queryByText("See how far your child can go in math."),
  ).toBeNull();
  expect(analytics.screenOf("/")).toBe("home");
});

test("Arizona ESA's Buy never promises a full refund", async () => {
  await open("/?program=az-esa");
  await screen.findAllByRole("link", { name: "Buy with Arizona ESA funds" });
  expect(
    screen.getByText("$599 for the year, paid from your ESA balance."),
  ).toBeTruthy();
  expect(screen.queryByText(/full refund/)).toBeNull();
});
