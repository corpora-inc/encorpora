import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useReturnNotices } from "../../../app/third-party-returns";
import { queryClient, sessionOptions } from "../../../lib/query";
import { PurchaseReturnNotice } from "../PurchaseReturnNotice";

/* A Stripe return the server couldn't match opens Billing, which says so
   once, inline, with what to do: the notice is spent as it shows, and
   Dismiss hides it. */

const SESSION = { accountId: "amp|parent", token: "t" };

beforeEach(() => {
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  useReturnNotices.setState({ accounts: {} });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});

const show = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PurchaseReturnNotice />
    </QueryClientProvider>,
  );

test("an unmatched return says what happened and what to do, once", () => {
  useReturnNotices.getState().set(SESSION.accountId, "purchase-unmatched");
  show();
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain(
    "We couldn’t match that payment to this account.",
  );
  expect(alert.textContent).toContain("support@corpora.inc");
  // Logged, and spent: opening Billing again says nothing.
  expect(console.warn).toHaveBeenCalled();
  expect(useReturnNotices.getState().accounts[SESSION.accountId]).toBe(
    undefined,
  );
  cleanup();
  show();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("Dismiss hides it", () => {
  useReturnNotices.getState().set(SESSION.accountId, "purchase-unmatched");
  show();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("nothing without a notice, nor for another account's", () => {
  useReturnNotices.getState().set("amp|someone-else", "purchase-unmatched");
  show();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(useReturnNotices.getState().accounts["amp|someone-else"]).toBe(
    "purchase-unmatched",
  );
});
