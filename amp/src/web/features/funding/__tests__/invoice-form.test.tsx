import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  posts: [] as { url: string; body: Record<string, unknown> }[],
  monthly: true,
}));
vi.mock("../../../auth", () => ({
  accessSession: vi.fn(async () => null),
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

const offer = (id: string, termMonths: 1 | 12, totalMinor: number) => ({
  id,
  revision: "r1",
  programName: "Arizona ESA",
  productTitle:
    termMonths === 1
      ? "AMP Mathematics - monthly learner license"
      : "AMP Mathematics - annual learner license",
  totalMinor,
  currency: "USD",
  instructions: "Attach the invoice.",
  termMonths,
  refundPolicy: "purchase-to-account",
  refundSummary: "Refund terms.",
});
function respond(url: string, init?: RequestInit) {
  const path = new URL(url, location.origin).pathname;
  if (init?.method === "POST") {
    state.posts.push({ url: path, body: JSON.parse(String(init.body)) });
    return Promise.resolve(
      Response.json({ message: "stop here" }, { status: 503 }),
    );
  }
  const json =
    path === "/api/v1/funding/invoice-offers"
      ? {
          offers: [
            offer("az-annual", 12, 59900),
            ...(state.monthly ? [offer("az-monthly", 1, 5900)] : []),
          ],
        }
      : path === "/api/v1/me"
        ? { signedIn: false }
        : {};
  return Promise.resolve(Response.json(json, { status: 200 }));
}
beforeEach(() => {
  vi.resetModules();
  state.posts = [];
  state.monthly = true;
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
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test("the invoice offers the year or a month as a designed choice, and invoices the one chosen", async () => {
  await open("/invoice/arizona-esa");
  const term = await screen.findByRole("radiogroup", { name: "Pay for" });
  expect(term.tagName).not.toBe("SELECT");
  const year = screen.getByRole("radio", { name: /Yearly/ });
  const month = screen.getByRole("radio", { name: /Monthly/ });
  expect(year.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("$599.00")).toBeTruthy();
  expect(screen.getByText("One learner · one year")).toBeTruthy();
  fireEvent.click(month);
  expect(month.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("$59.00")).toBeTruthy();
  expect(screen.getByText("One learner · one month")).toBeTruthy();
  // One email field that reads right for a parent or an adult student.
  fireEvent.change(
    screen.getByLabelText(
      "Email for the AMP account (parent, or the student if 18+)",
    ),
    { target: { value: "student@example.com" } },
  );
  fireEvent.change(screen.getByLabelText("Student name for the invoice"), {
    target: { value: "Fixture Student" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create invoice PDF" }));
  await vi.waitFor(() => expect(state.posts).toHaveLength(1));
  expect(state.posts[0]!.body).toMatchObject({
    offerId: "az-monthly",
    parentEmail: "student@example.com",
  });
});

test("a program that sells only the year shows no choice", async () => {
  state.monthly = false;
  await open("/invoice/arizona-esa");
  expect(await screen.findByText("One learner · one year")).toBeTruthy();
  expect(screen.queryByRole("radiogroup", { name: "Pay for" })).toBeNull();
});
