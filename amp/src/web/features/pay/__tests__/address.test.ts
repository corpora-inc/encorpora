import { expect, test } from "vitest";
import { isPayHost, payAddress, payOver } from "../address";

/* A pay overlay's address names the screen behind it (its origin, where
   closing goes) and the learner; nothing else. */

test("over a child's page, the page names the learner", () => {
  expect(payAddress("/family/f1/kids/august/pay")).toEqual({
    origin: "/family/f1/kids/august",
    base: "/family/f1/kids/august/pay",
    learnerId: "august",
    view: { kind: "choose" },
  });
  expect(payAddress("/family/f1/kids/august/pay/done")?.view).toEqual({
    kind: "done",
  });
  expect(payAddress("/family/f1/kids/august/pay/invoice/inv-1")).toMatchObject({
    origin: "/family/f1/kids/august",
    view: { kind: "invoice", invoiceId: "inv-1" },
  });
});

test("over Today and Billing, the overlay names the learner", () => {
  expect(payAddress("/family/f1/pay/wren")).toEqual({
    origin: "/family/f1",
    base: "/family/f1/pay/wren",
    learnerId: "wren",
    view: { kind: "choose" },
  });
  expect(payAddress("/account/billing/pay/wren/invoice/inv-2")).toEqual({
    origin: "/account/billing",
    base: "/account/billing/pay/wren",
    learnerId: "wren",
    view: { kind: "invoice", invoiceId: "inv-2" },
  });
  expect(payAddress("/account/billing")).toBeNull();
});

test("opening from a screen puts the overlay over that same screen", () => {
  expect(payOver("/family/f1/kids/august", "august")).toBe(
    "/family/f1/kids/august/pay",
  );
  expect(payOver("/family/f1", "august")).toBe("/family/f1/pay/august");
  expect(payOver("/family/f1/settings", "a")).toBe("/family/f1/settings/pay/a");
  expect(payOver("/account", "a")).toBe("/account/pay/a");
  for (const host of [
    "/family/f1",
    "/family/f1/kids/a",
    "/family/f1/settings",
    "/account",
  ])
    expect(isPayHost(host), host).toBe(true);
  for (const other of [
    "/practice",
    "/family/f1/people",
    "/account/billing",
    "/account/pay/a",
  ])
    expect(isPayHost(other), other).toBe(false);
});
