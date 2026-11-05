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
          offers: [offer("year", 49900), offer("month", 4900)],
        }
      : path === "/api/v1/funding/invoice-offers"
        ? {
            offers: [
              {
                id: "ar-offer",
                revision: "r1",
                programName: "Arkansas EFA",
                productTitle: "AMP",
                totalMinor: 49900,
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
      name: "Math that adapts to every answer.",
    }),
  ).toBeTruthy();
  expect(analytics.screenOf("/")).toBe("pitch");
  const buy = screen.getByRole("link", { name: "Buy with Arkansas EFA funds" });
  expect(buy.getAttribute("href")).toBe(
    "/invoice/arkansas-efa?utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&program=ar-efa",
  );
  expect(
    screen.getByText("$499 for 12 months · 30-day full refund"),
  ).toBeTruthy();
  // No status line is configured for this offer, so none is claimed.
  expect(screen.queryByText(/approved/i)).toBeNull();
  expect(document.querySelector("[data-funding-status]")).toBeNull();
  expect(screen.queryByText(/\.00/)).toBeNull();
  // The free workbook goes through the free-parent sign-up with its intent.
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Get a free workbook" }),
    ),
  );
  await screen.findByRole("heading", { name: "Sign-up screen" });
  expect(router.state.location.pathname).toBe("/sign-up");
  expect(router.state.location.search).toMatchObject({
    return: "free-practice",
    entry: "pitch-workbook",
    program: "ar-efa",
    utm_campaign: "ar-efa-launch",
  });
  analytics.flush(true);
  const events = state.posts
    .filter((post) => post.url === "/api/v1/events")
    .flatMap((post) => (post.body as { events: { event: string }[] }).events)
    .map((event) => event.event);
  expect(events).toEqual(
    expect.arrayContaining(["landing_view", "pitch_view", "workbook_click"]),
  );
});

test("without a program, Buy is the card plan and continues to checkout after sign-up", async () => {
  const { router } = await open("/");
  const buy = await screen.findByRole("button", { name: "Buy AMP" });
  fireEvent.click(screen.getByRole("radio", { name: /Monthly/ }));
  await act(async () => fireEvent.click(buy));
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
  expect(screen.queryByText("Math that adapts to every answer.")).toBeNull();
  expect(analytics.screenOf("/")).toBe("home");
});

test("Arizona ESA's Buy never promises a full refund", async () => {
  await open("/?program=az-esa");
  await screen.findByRole("link", { name: "Buy with Arizona ESA funds" });
  expect(
    screen.getByText("$499 for 12 months · 30-day refund to your child’s ESA"),
  ).toBeTruthy();
  expect(screen.queryByText(/full refund/)).toBeNull();
});
