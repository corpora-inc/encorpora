import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { FundingPurchaseCenter } from "../../FundingPurchaseCenter";
import { queryClient, meKey } from "../../lib/query";
import { useFamilyCache } from "../../lib/family-cache";
import { presentOffer } from "../../../funding-purchase/contracts";
import { testFundingOffer } from "../../../../tests/funding-purchase.fixture";
vi.mock("../../auth", () => ({ accessSession: vi.fn(), authConfig: vi.fn() }));
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});
it("refreshes canonical access when only the disabled legacy Family observer is mounted", async () => {
  const identity = "parent";
  const me = {
    signedIn: true,
    next: "practice",
    account: {
      id: identity,
      email: "parent@example.test",
      emailVerified: true,
    },
    consent: { status: "active", method: "verified" },
    learners: [],
    family: {
      consent: {
        status: "active",
        policyVersion: "fixture",
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [
        {
          id: "learner",
          name: "Fixture",
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: true,
        },
      ],
      retained: {
        identity: "",
        financial: "",
        backups: "",
        privacyAuditDays: 30,
      },
    },
  };
  const stale = structuredClone(me);
  stale.family.learners[0]!.canPractice = false;
  queryClient.setQueryData(meKey(identity), stale);
  function FamilyObserver() {
    const family = useFamilyCache(identity);
    return (
      <p>
        {family?.learners[0]?.canPractice
          ? "Ready to practice"
          : "Waiting for access"}
      </p>
    );
  }
  const requests = [
    {
      id: "request",
      orderId: "order",
      status: "prepared",
      accessStatus: "active",
      paymentStatus: "settled",
      offer: presentOffer(testFundingOffer),
    },
  ];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/v1/me") return Response.json(me);
    if (path.endsWith("/classwallet/capabilities"))
      return Response.json({ offerIds: [] });
    if (path.endsWith("/offers")) return Response.json({ offers: [] });
    if (path.endsWith("/requests")) return Response.json({ requests });
    throw new Error(`Unexpected request ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <QueryClientProvider client={queryClient}>
      <FamilyObserver />
      <FundingPurchaseCenter
        identity={identity}
        token="synthetic"
        learners={[]}
        consentActive
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("Ready to practice")).toBeTruthy(),
  );
  expect(fetcher.mock.calls.some(([path]) => path === "/api/v1/me")).toBe(true);
});
