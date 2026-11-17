import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sessionOptions } from "../../../lib/query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PlanStep } from "../../onboarding/PlanStep";
import { enrollmentOptions, offerOptions } from "../api";
import { consentFixture } from "../../../../../tests/parent-consent.fixture";
const navigation = vi.hoisted(() => ({ go: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({ interval: "month" }),
  useLocation: () => ({
    pathname: "/start/plan",
    searchStr: "?interval=month",
  }),
  useNavigate: () => navigation.go,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../../lib/analytics", () => ({
  track: vi.fn(),
  flush: vi.fn(),
  analyticsVisitorHeaders: () => ({}),
}));
vi.mock("../../../ui/PageFrame", () => ({
  FrameBrand: () => null,
  frameCard: "card",
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function setup(
  props: Partial<React.ComponentProps<typeof PlanStep>> = {},
  phase?: "paid" | "processing" | "assigned" | "requires-review",
) {
  const session = { token: "synthetic", accountId: "synthetic" };
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(enrollmentOptions(session).queryKey, {
    available: true,
    notice: consentFixture.notice,
    noticeDigest: "a".repeat(64),
    purchase: phase
      ? {
          phase,
          id: "1dc64558-2238-45a4-bafb-3e9fc53d5517",
          interval: "month",
          learnerId: null,
          url: null,
        }
      : null,
  });
  client.setQueryData(sessionOptions.queryKey, session);
  client.setQueryData(offerOptions(session).queryKey, {
    available: true,
    offers: [
      {
        id: "a".repeat(64),
        mode: "test",
        currency: "USD",
        learnerCount: 1,
        interval: "year",
        formattedAmount: "$599.00",
        amountMinor: 59900,
      },
      {
        id: "b".repeat(64),
        mode: "test",
        currency: "USD",
        learnerCount: 1,
        interval: "month",
        formattedAmount: "$59.00",
        amountMinor: 5900,
      },
    ],
    extraOffers: [],
  });
  return render(
    <QueryClientProvider client={client}>
      <PlanStep {...props} />
    </QueryClientProvider>,
  );
}
test("the plan before any learner offers card only: an invoice needs its learner", () => {
  setup();
  expect(
    screen.queryByRole("radiogroup", { name: "Payment method" }),
  ).toBeNull();
  expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
});
test.each(["paid", "processing", "assigned", "requires-review"] as const)(
  "%s enrollment shows purchase recovery before new method choices",
  (phase) => {
    setup({}, phase);
    expect(
      screen.queryByRole("radiogroup", { name: "Payment method" }),
    ).toBeNull();
    // The purchase's progress shows in place (PurchaseStep), with no hop.
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Plan" })).toBeNull();
  },
);
