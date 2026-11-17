import type { AccountPanels } from "./panels";

/*
 * The account's older addresses (the IA v2 spec, §2.3), each one hop,
 * straight to its final place: an overlay over the account's settings hub
 * (`hub`, features/spaces/settings-hub.ts) or over `/account`. What an old
 * address named (a privacy panel, the receipts) is written into the panel
 * store on the way through, never carried in the new address. Pure, so
 * every row is a table test (features/account/__tests__/legacy.test.ts).
 * Privacy's older addresses are app/privacy-routes.tsx's; `/consent`, where
 * a consent email's link lands, stays.
 */

export type AccountHop = {
  /** The new address, with its leading slash. */
  href: string;
  /** The disclosure the overlay opens on. */
  panel?: { overlay: "billing"; id: NonNullable<AccountPanels["billing"]> };
};

/**
 * Where an older account address opens now, or null when it is no older
 * address. `hub` is the account's settings hub (`/family/<own>/settings` or
 * `/account`); `search` is the address's parsed query.
 */
export function accountHop(
  pathname: string,
  hub: string,
  search: Record<string, unknown> = {},
): AccountHop | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const [first, second, third, ...rest] = parts;
  // Deleting the account, at its older addresses.
  if (
    (first === "account" || first === "family") &&
    second === "security" &&
    third === "delete" &&
    rest.length === 0
  )
    return { href: `${hub}/delete-account` };
  // Sign-in & security stays an overlay over `/account`.
  if (first === "family" && second === "security")
    return { href: "/account/security" };
  // Billing and its older addresses; its receipts open folded out.
  if (
    (first === "family" && second === "access") ||
    (first === "account" && second === "billing" && third !== "pay" && third)
  ) {
    const receipts = third === "records";
    return {
      href: "/account/billing",
      ...(receipts
        ? { panel: { overlay: "billing" as const, id: "receipts" as const } }
        : {}),
    };
  }
  if (first === "account" && second === "billing" && third === "pay")
    return { href: `/account/pay/${rest.join("/")}` };
  if (
    first === "account" &&
    second === "billing" &&
    !third &&
    typeof search.receipt === "string"
  )
    return {
      href: "/account/billing",
      panel: { overlay: "billing", id: "receipts" },
    };
  return null;
}
