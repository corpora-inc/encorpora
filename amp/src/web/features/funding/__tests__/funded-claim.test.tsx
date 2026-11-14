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

/* The program page after sign-in, for an invoice made out before it: the
   account holder may connect it to her own learner, with or without one yet,
   and a child still needs the parent's consent first. */

type Child = { id: string; name: string };
const state = vi.hoisted(() => ({
  session: { token: "t", accountId: "adult" } as AuthSession,
  own: null as { id: string; name: string } | null,
  children: [] as Child[],
  consent: "none" as "none" | "pending" | "active" | "withdrawn",
  consentRequest: null as { id: string; phase: string } | null,
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

vi.mock("../../../ParentConsentCenter", () => ({
  ParentConsentCenter: () => <h1>Learning consent</h1>,
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
          : path === "/api/v1/consent"
            ? { request: state.consentRequest }
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
  state.consentRequest = null;
  state.session = { token: "t", accountId: "adult" };
  state.posts = [];
  invoices = [
    {
      id: "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11",
      studentBillingName: "Fixture Student",
      parentEmail: "student@example.com",
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
  state.session.name = "Fixture Student";
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

test.each(["active", "pending", "withdrawn"] as const)(
  "with %s parental consent and no learner, funded entry skips the question",
  async (consent) => {
    invoices = [];
    state.consent = consent;
    const router = await open("/purchase/arizona-esa?return=arizona-esa");
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(
        consent === "active" ? "/start/name" : "/start/consent",
      ),
    );
    expect(router.state.location.search).toMatchObject({
      return: "arizona-esa",
    });
    expect(screen.queryByRole("button", { name: "For me" })).toBeNull();
    expect(state.posts).toEqual([]);
  },
);

test.each(["awaiting-initial", "awaiting-confirmation", "expired"])(
  "a %s consent request permits choosing restricted parent-entry setup",
  async (phase) => {
    invoices = [];
    state.consentRequest = { id: "consent-request", phase };
    const router = await open("/purchase/arizona-esa");
    await screen.findByRole("heading", { name: "Who’s learning?" });
    expect(router.state.location.pathname).toBe("/purchase/arizona-esa");
    expect(state.posts).toEqual([]);
  },
);

test.each(["none", "active", "withdrawn"] as const)(
  "an existing child with %s consent skips the question without bypassing consent",
  async (consent) => {
    invoices = [];
    state.consent = consent;
    state.children = [{ id: "child", name: "Fixture Child" }];
    const router = await open("/purchase/arizona-esa");
    await screen.findByRole("heading", {
      name:
        consent === "active"
          ? /Purchase center: Fixture Child/
          : "Learning consent",
    });
    expect(router.state.location.pathname).toBe(
      consent === "active" ? "/purchase/arizona-esa" : "/start/consent",
    );
    expect(
      screen.queryByRole("heading", { name: "Who’s learning?" }),
    ).toBeNull();
    expect(state.posts).toEqual([]);
  },
);

test("a pending invoice matching the verified adult's full name skips the question", async () => {
  state.session.name = "  FIXTURE   Student ";
  await open("/purchase/arizona-esa");
  await screen.findByRole("heading", { name: "Connect your invoice" });
  expect(
    screen.getByRole("radio", { name: "Me" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.queryByRole("heading", { name: "Who’s learning?" })).toBeNull();
  expect(state.posts).toEqual([]);
});

test.each([
  ["only the email is known", undefined, "student@example.com"],
  ["the name differs", "Different Adult", "student@example.com"],
  ["the email differs", "Fixture Student", "other@example.test"],
])(
  "an invoice cannot decide who's learning when %s",
  async (_label, name, parentEmail) => {
    state.session.name = name;
    invoices = [{ ...(invoices[0] as object), parentEmail }];
    const router = await open("/purchase/arizona-esa");
    await screen.findByRole("heading", { name: "Who’s learning?" });
    expect(state.posts).toEqual([]);
    fireEvent.click(screen.getByRole("link", { name: "For my child" }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/start/consent"),
    );
    expect(state.posts).toEqual([]);
  },
);

test("a pending invoice uniquely naming a child selects that child instead of asking again", async () => {
  state.consent = "active";
  state.children = [
    { id: "child", name: "Fixture Student" },
    { id: "sibling", name: "Fixture Sibling" },
  ];
  await open("/purchase/arizona-esa");
  const child = await screen.findByRole("radio", { name: "Fixture Student" });
  expect(child.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Use this invoice" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(1));
  expect(state.posts[0]).toMatchObject({ body: { learnerId: "child" } });
});

test("matching a child's invoice never replaces verified parental consent", async () => {
  state.own = { id: "own", name: "Adult" };
  state.children = [{ id: "child", name: "Fixture Student" }];
  await open("/purchase/arizona-esa");
  await screen.findByRole("heading", { name: "Connect your invoice" });
  expect(
    screen
      .getByRole("radio", { name: "Fixture Student" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.queryByRole("button", { name: "Use this invoice" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Continue to parent consent" }),
  ).toBeTruthy();
  expect(state.posts).toEqual([]);
});

test("duplicate learner names leave the invoice choice open", async () => {
  state.consent = "active";
  state.own = { id: "own", name: "Fixture Student" };
  state.children = [{ id: "child", name: "Fixture Student" }];
  await open("/purchase/arizona-esa");
  await screen.findByRole("heading", { name: "Connect your invoice" });
  for (const radio of screen.getAllByRole("radio"))
    expect(radio.getAttribute("aria-checked")).toBe("false");
  expect(
    (
      screen.getByRole("button", {
        name: "Use this invoice",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("an ambiguous invoice can still be explicitly assigned to Me", async () => {
  await open("/purchase/arizona-esa");
  fireEvent.click(await screen.findByRole("button", { name: "For me" }));
  await screen.findByRole("heading", { name: "Connect your invoice" });
  fireEvent.click(screen.getByRole("button", { name: "Use this invoice" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(2));
  expect(state.posts[1]).toMatchObject({ body: { learnerId: "own-new" } });
});

test("invoices naming different recipients do not choose one for the account", async () => {
  state.session.name = "Fixture Student";
  invoices.push({
    ...(invoices[0] as object),
    id: "second-invoice",
    studentBillingName: "Another Student",
  });
  await open("/purchase/arizona-esa");
  await screen.findByRole("button", { name: "For me" });
  expect(state.posts).toEqual([]);
});

test.each([
  { state: "cancelled" },
  { state: "claimed" },
  { offer: { programId: "ar-efa" } },
  { expiresAt: "2000-01-01T00:00:00.000Z" },
])(
  "an unavailable or different-program invoice does not infer the recipient: %j",
  async (override) => {
    state.session.name = "Fixture Student";
    invoices = [{ ...(invoices[0] as object), ...override }];
    await open("/purchase/arizona-esa");
    await screen.findByRole("button", { name: "For me" });
    expect(state.posts).toEqual([]);
  },
);

test("the question waits for consent history instead of flashing before the parent path", async () => {
  invoices = [];
  let release!: (response: Response) => void;
  let requested = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (new URL(url, location.origin).pathname === "/api/v1/consent") {
        requested = true;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return respond(url, init);
    }),
  );
  await open("/purchase/arizona-esa");
  await vi.waitFor(() => expect(requested).toBe(true));
  expect(screen.queryByRole("button", { name: "For me" })).toBeNull();
  release(Response.json({ request: { id: "pending-consent" } }));
  await screen.findByRole("heading", { name: "Learning consent" });
});

test("refreshing consent history keeps the current question and its controls mounted", async () => {
  invoices = [];
  await open("/purchase/arizona-esa");
  const button = await screen.findByRole("button", { name: "For me" });
  let release!: (response: Response) => void;
  let requested = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (new URL(url, location.origin).pathname === "/api/v1/consent") {
        requested = true;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return respond(url, init);
    }),
  );
  const { queryClient } = await import("../../../lib/query");
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = queryClient.invalidateQueries({
      queryKey: ["account", "adult", "funded-consent-history"],
    });
    // Flush Query's scheduled observer notification while the request is held.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  try {
    await vi.waitFor(() => expect(requested).toBe(true));
    expect(screen.queryByRole("button", { name: "For me" })).toBe(button);
  } finally {
    release(Response.json({ request: null }));
    await refresh;
  }
});
