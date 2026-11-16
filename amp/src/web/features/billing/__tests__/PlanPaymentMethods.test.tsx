import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PlanStep } from "../../onboarding/PlanStep";
import { enrollmentOptions, offerOptions } from "../api";
import { consentFixture } from "../../../../../tests/parent-consent.fixture";
import { PaymentMethodChoice } from "../PaymentMethodChoice";
const navigation = vi.hoisted(() => ({ go: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({ interval: "month" }),
  useLocation: () => ({
    pathname: "/start/plan",
    searchStr: "?interval=month",
  }),
  useNavigate: () => navigation.go,
  Navigate: ({ to }: { to: string }) => <a href={to}>Recover purchase</a>,
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
  phase?: string,
) {
  const session = { token: "synthetic", accountId: "synthetic" };
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(enrollmentOptions(session).queryKey, {
    available: true,
    notice: consentFixture.notice,
    noticeDigest: "a".repeat(64),
    purchase: phase ? { phase } : null,
  });
  client.setQueryData(offerOptions(session).queryKey, {
    available: true,
    offers: [
      {
        id: "annual",
        interval: "year",
        formattedAmount: "$599.00",
        amountMinor: 59900,
      },
      {
        id: "monthly",
        interval: "month",
        formattedAmount: "$59.00",
        amountMinor: 5900,
      },
    ],
    extraOffers: [],
  });
  return render(
    <QueryClientProvider client={client}>
      <PlanStep session={session} {...props} />
    </QueryClientProvider>,
  );
}
test("standalone plan offers education funds with the current monthly choice", () => {
  setup();
  fireEvent.click(screen.getByRole("radio", { name: "Education funds (ESA)" }));
  expect(navigation.go).toHaveBeenCalledWith({
    href: "/purchase/funded?interval=month",
  });
});
test("embedded plan does not add a second method selector", () => {
  setup({ embedded: true });
  expect(
    screen.queryByRole("radiogroup", { name: "Payment method" }),
  ).toBeNull();
});
test("Continue supplies exactly one learner-aware method selector", () => {
  setup({
    embedded: true,
    paymentMethods: () => (
      <PaymentMethodChoice value="card" onChange={() => {}} />
    ),
  });
  expect(
    screen.getAllByRole("radiogroup", { name: "Payment method" }),
  ).toHaveLength(1);
});
test.each(["paid", "processing", "assigned", "requires-review"])(
  "%s enrollment goes to purchase recovery before new method choices",
  (phase) => {
    setup({}, phase);
    expect(
      screen.queryByRole("radiogroup", { name: "Payment method" }),
    ).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/start/purchase",
    );
  },
);
