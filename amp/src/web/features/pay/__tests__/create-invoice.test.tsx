import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { meKey, queryClient } from "../../../lib/query";
import { fundingRecordsKey } from "../../funding/records";
import { useCreateInvoice, useReportSubmitted } from "../api";

vi.mock("../../../lib/analytics", async (original) => ({
  ...(await original<typeof import("../../../lib/analytics")>()),
  analyticsVisitorHeaders: () => ({}),
}));

const session = { accountId: "parent-1", token: "fixture-session" };
const invoiceId = "6f1d1a54-6a7b-4e44-9d55-2a3c5a2f0e11";
const calls: { url: string; body: unknown; auth: string | null }[] = [];
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.length = 0;
  queryClient.clear();
  queryClient.setQueryData(meKey(session.accountId), { signedIn: true });
  queryClient.setQueryData(fundingRecordsKey(session.accountId), { requests: [] });
  queryClient.setQueryData(["account", session.accountId, "billing", "offer"], {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
        auth: headers.get("authorization"),
      });
      if (url.endsWith("/funding/invoices"))
        return Response.json({
          invoiceId,
          totalMinor: 59900,
          merchantName: "Corpora Inc",
          pdfBase64: "JVBERi0=",
          filename: `education-invoice-${invoiceId}.pdf`,
          destinationUrl: "https://app.classwallet.com/",
          instructions: "Download your invoice. Submit it.",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      if (url.includes(`/funding/invoices/${invoiceId}/claim`))
        return Response.json({
          id: invoiceId,
          accessStatus: "not-granted",
          fundedPending: {
            status: "funded-pending",
            endsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          },
        });
      if (url.includes(`/funding/requests/${invoiceId}/status`))
        return Response.json({ id: invoiceId, status: "parent-reported-submitted" });
      return Response.json({}, { status: 404 });
    }),
  );
});
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("Create invoice makes the invoice, then claims it for the learner, then refreshes the account", async () => {
  const { result } = renderHook(() => useCreateInvoice(session), { wrapper });
  let created: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
  await act(async () => {
    created = await result.current.mutateAsync({
      offer: { id: "az-esa-annual-invoice", revision: "r1" },
      studentBillingName: "August Example",
      parentEmail: "parent@example.test",
      learnerId: "august",
      idempotencyKey: "0b8f7f8e-4d0a-4d61-8d5c-8f1c3b6b1c11",
    });
  });
  expect(created).toMatchObject({ invoiceId, learnerId: "august" });
  expect(created!.claimed.fundedPending?.status).toBe("funded-pending");
  // The invoice first (its email is queued with it), then the claim, which
  // starts access, as the signed-in parent.
  expect(calls.map((call) => new URL(call.url, "http://x").pathname)).toEqual([
    "/api/v1/funding/invoices",
    `/api/v1/funding/invoices/${invoiceId}/claim`,
  ]);
  expect(calls[0]!.body).toMatchObject({
    offerId: "az-esa-annual-invoice",
    offerRevision: "r1",
    studentBillingName: "August Example",
    idempotencyKey: "0b8f7f8e-4d0a-4d61-8d5c-8f1c3b6b1c11",
  });
  expect(calls[1]!.body).toEqual({ learnerId: "august" });
  expect(calls[1]!.auth).toBe("Bearer fixture-session");
  // `/me` (access) and Billing (plans, invoices) are refreshed.
  await waitFor(() => {
    expect(queryClient.getQueryState(meKey(session.accountId))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(fundingRecordsKey(session.accountId))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(["account", session.accountId, "billing", "offer"])
        ?.isInvalidated,
    ).toBe(true);
  });
});

test("an adult with no learner yet starts it before the claim", async () => {
  const prepare = vi.fn(async () => "own-learner");
  const { result } = renderHook(() => useCreateInvoice(session), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      offer: { id: "az-esa-annual-invoice", revision: "r1" },
      studentBillingName: "Ada Example",
      parentEmail: "parent@example.test",
      learnerId: null,
      prepare,
      idempotencyKey: "0b8f7f8e-4d0a-4d61-8d5c-8f1c3b6b1c12",
    });
  });
  expect(prepare).toHaveBeenCalledOnce();
  expect(calls[1]!.body).toEqual({ learnerId: "own-learner" });
});

test("reporting submission refreshes the account and Billing", async () => {
  const { result } = renderHook(() => useReportSubmitted(session), { wrapper });
  await act(async () => {
    await result.current.mutateAsync(invoiceId);
  });
  expect(calls[0]!.body).toEqual({ status: "parent-reported-submitted" });
  await waitFor(() =>
    expect(
      queryClient.getQueryState(fundingRecordsKey(session.accountId))?.isInvalidated,
    ).toBe(true),
  );
});
