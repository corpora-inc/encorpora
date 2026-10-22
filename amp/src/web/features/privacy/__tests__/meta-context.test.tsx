import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useMetaPurchaseContext } from "../useMetaPurchaseContext";
import {
  META_PURCHASE_MEASUREMENT_NOTICE as notice,
  type PurchaseMeasurement,
} from "../../../../advertising/permission-contracts";
const session = { accountId: "amp|synthetic", token: "synthetic-parent" };
const checkout = "da0f4784-ad11-4a6a-a9e8-453cfdcd939d";
const permission: PurchaseMeasurement = {
  available: true,
  eligible: true,
  status: "active",
  revision: "d77c8321-2fb9-4bba-a644-eae69c4e229b",
  noticeVersion: notice.version,
  grantedAt: "2026-10-20T00:00:00.000Z",
  expiresAt: "2027-10-20T00:00:00.000Z",
};
const fetcher = vi.fn();
beforeEach(() => {
  history.replaceState(null, "", "/start/purchase");
  fetcher
    .mockReset()
    .mockResolvedValue(new Response(JSON.stringify({ recorded: true })));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "globalPrivacyControl");
});
test("only a confirmed payment with matching return and current Meta permission submits local context", async () => {
  const view = renderHook(
    ({ phase, returned, returnedFrom, choice }) =>
      useMetaPurchaseContext(
        session,
        checkout,
        phase,
        choice,
        returnedFrom,
        returned,
      ),
    {
      initialProps: {
        phase: "processing",
        returned: "processing",
        returnedFrom: checkout,
        choice: permission,
      },
    },
  );
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender({
    phase: "paid",
    returned: "canceled",
    returnedFrom: checkout,
    choice: permission,
  });
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender({
    phase: "paid",
    returned: "processing",
    returnedFrom: "other",
    choice: permission,
  });
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender({
    phase: "paid",
    returned: "processing",
    returnedFrom: checkout,
    choice: { ...permission, status: "off" },
  });
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender({
    phase: "paid",
    returned: "processing",
    returnedFrom: checkout,
    choice: permission,
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/advertising/meta/purchase-context",
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    checkoutId: checkout,
  });
  expect(fetcher.mock.calls[0][1].headers).toEqual({
    Authorization: "Bearer synthetic-parent",
    "Content-Type": "application/json",
  });
  view.rerender({
    phase: "paid",
    returned: "processing",
    returnedFrom: checkout,
    choice: { ...permission },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("privacy signal, wrong notice and learner pages do not send context", () => {
  for (const mode of ["gpc", "notice", "learner"]) {
    if (mode === "gpc")
      Object.defineProperty(navigator, "globalPrivacyControl", {
        configurable: true,
        value: true,
      });
    if (mode === "learner") history.replaceState(null, "", "/practice");
    const view = renderHook(() =>
      useMetaPurchaseContext(
        session,
        checkout,
        "paid",
        mode === "notice"
          ? { ...permission, noticeVersion: "future-notice" }
          : permission,
        checkout,
        "processing",
      ),
    );
    expect(fetcher).not.toHaveBeenCalled();
    view.unmount();
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  }
});
test("navigation keeps the account-bound request alive but ignores obsolete responses", async () => {
  let rejectFirst: ((error: Error) => void) | undefined;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectFirst = reject;
      }),
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = renderHook(
    ({ identity }) =>
      useMetaPurchaseContext(
        identity,
        checkout,
        "paid",
        permission,
        checkout,
        "processing",
      ),
    { initialProps: { identity: session } },
  );
  const first = fetcher.mock.calls[0][1];
  expect(first.keepalive).toBe(true);
  expect(first.headers.Authorization).toBe("Bearer synthetic-parent");
  view.rerender({
    identity: { accountId: "amp|other", token: "synthetic-other" },
  });
  expect(first.headers.Authorization).toBe("Bearer synthetic-parent");
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer synthetic-other",
  );
  rejectFirst!(new Error("private-old-account-error"));
  view.unmount();
  await Promise.resolve();
  expect(log).not.toHaveBeenCalled();
  fetcher.mockRejectedValue(new Error("provider-private-text"));
  renderHook(() =>
    useMetaPurchaseContext(
      session,
      checkout,
      "paid",
      permission,
      checkout,
      "processing",
    ),
  );
  await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /provider-private-text|synthetic-parent|da0f4784/,
  );
});
