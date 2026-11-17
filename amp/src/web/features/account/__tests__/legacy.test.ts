import { expect, test } from "vitest";
import { accountHop } from "../legacy";

const FAMILY = "/family/f1/settings";

test("every older account address is one hop to its final place", () => {
  const rows: [string, string, Record<string, unknown>, unknown][] = [
    // Deleting the account: the overlay over the account's hub.
    [
      "/account/security/delete",
      FAMILY,
      {},
      { href: `${FAMILY}/delete-account` },
    ],
    [
      "/family/security/delete",
      FAMILY,
      {},
      { href: `${FAMILY}/delete-account` },
    ],
    [
      "/account/security/delete",
      "/account",
      {},
      { href: "/account/delete-account" },
    ],
    // Sign-in & security stays an overlay over /account.
    ["/family/security", FAMILY, {}, { href: "/account/security" }],
    ["/family/security/passkeys", FAMILY, {}, { href: "/account/security" }],
    // Billing, and its receipts folded out.
    ["/family/access", FAMILY, {}, { href: "/account/billing" }],
    ["/account/billing/purchases", FAMILY, {}, { href: "/account/billing" }],
    [
      "/account/billing/records",
      FAMILY,
      {},
      {
        href: "/account/billing",
        panel: { overlay: "billing", id: "receipts" },
      },
    ],
    [
      "/family/access/records",
      FAMILY,
      {},
      {
        href: "/account/billing",
        panel: { overlay: "billing", id: "receipts" },
      },
    ],
    [
      "/account/billing",
      FAMILY,
      { receipt: "pay_1" },
      {
        href: "/account/billing",
        panel: { overlay: "billing", id: "receipts" },
      },
    ],
    // Pay over Billing is Pay over /account.
    ["/account/billing/pay/l1", FAMILY, {}, { href: "/account/pay/l1" }],
    [
      "/account/billing/pay/l1/done",
      FAMILY,
      {},
      { href: "/account/pay/l1/done" },
    ],
    [
      "/account/billing/pay/l1/invoice/i9",
      FAMILY,
      {},
      { href: "/account/pay/l1/invoice/i9" },
    ],
  ];
  for (const [path, hub, search, expected] of rows)
    expect(accountHop(path, hub, search), path).toEqual(expected);
});

test("the overlays themselves and other addresses are not older addresses", () => {
  for (const path of [
    "/account",
    "/account/billing",
    "/account/security",
    "/account/delete-account",
    "/account/pay/l1",
    "/account/deleted",
  ])
    expect(accountHop(path, FAMILY), path).toBeNull();
});
