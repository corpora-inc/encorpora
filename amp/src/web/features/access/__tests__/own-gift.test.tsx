import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthSession } from "../../../auth";

// Analytics has its own transport tests. Its delayed flush must not outlive
// a module reset and appear as a gift POST in the next test's fetch fixture.
vi.mock("../../../lib/analytics");

/* A gift of AMP for an adult on her own: she uses it for herself, with no
   parental consent and no child to set up. A child's gift is unchanged. */

const GIFT = "b24d441b-38d5-42ec-ae99-dbe186b1ffba";
const state = vi.hoisted(() => ({
  session: { token: "t", accountId: "adult" } as AuthSession,
  own: null as { id: string; name: string } | null,
  children: [] as { id: string; name: string }[],
  covers: "learner" as "learner" | "family",
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

const me = () => ({
  signedIn: true,
  account: { id: "adult", email: "student@example.com", emailVerified: true },
  consent: { status: "none", method: null },
  learners: state.children.map((child) => ({
    ...child,
    birthYear: 2014,
    entitlement: { active: false, plan: null, endsAt: null },
  })),
  family: {
    consent: {
      status: "not-recorded",
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
  availableAccessGrant: {
    id: GIFT,
    months: 1,
    claimBy: null,
    ...(state.covers === "family" ? { covers: "family" } : {}),
  },
  next: "accept-gift",
});
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
    if (path.endsWith("/activate"))
      return Promise.resolve(
        Response.json({
          id: GIFT,
          learnerId: (JSON.parse(String(init.body)) as { learnerId: string })
            .learnerId,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        }),
      );
  }
  return Promise.resolve(
    Response.json(path === "/api/v1/me" ? me() : {}, { status: 200 }),
  );
}
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  state.own = null;
  state.children = [];
  state.covers = "learner";
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
  queryClient.clear();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

test("an adult with no learner yet uses her gift for herself: her learner starts, then the gift is hers", async () => {
  await open("/access");
  fireEvent.click(await screen.findByRole("button", { name: "Use it for me" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(2));
  expect(state.posts[0]!.url).toBe("/api/v1/me/practice");
  expect(state.posts[1]).toEqual({
    url: `/api/v1/access-grants/${GIFT}/activate`,
    body: { learnerId: "own-new" },
  });
});

test("an adult on her own uses the gift on her learner, offered first", async () => {
  state.own = { id: "own", name: "Student" };
  await open("/access");
  const mine = await screen.findByRole("button", { name: "Use it for me" });
  // Setting it up for a child is still there, second.
  expect(
    screen.getByRole("link", { name: "Set it up for a child" }),
  ).toBeTruthy();
  fireEvent.click(mine);
  await vi.waitFor(() => expect(state.posts).toHaveLength(1));
  expect(state.posts[0]).toMatchObject({ body: { learnerId: "own" } });
});

test("a parent may still set the gift up for a child, through consent", async () => {
  state.children = [{ id: "child", name: "Robin" }];
  await open("/access");
  const child = await screen.findByRole("link", { name: "Continue setup →" });
  expect(child.getAttribute("href")).toMatch(/^\/start\/consent/);
  expect(screen.getByRole("button", { name: "Use it for me" })).toBeTruthy();
});

test("a family gift is never offered as one adult's own", async () => {
  state.covers = "family";
  state.own = { id: "own", name: "Student" };
  await open("/access");
  await screen.findByRole("heading", { name: /whole family/ });
  expect(screen.queryByRole("button", { name: "Use it for me" })).toBeNull();
});
