/** Navigation hints only. The authenticated API owns purchase/account authority. */
export interface PurchaseReturn {
  state: "processing" | "canceled" | "account";
  purchaseId?: string;
  expiresAt: number;
}
export const purchaseReturnSlot = "amp.purchase-return.v1";
const lifetime = 15 * 60 * 1000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parsePurchaseReturn(
  value: unknown,
  now = Date.now(),
): PurchaseReturn | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (
    Object.keys(entry).some(
      (key) => !["state", "purchaseId", "expiresAt"].includes(key),
    )
  )
    return null;
  if (
    typeof entry.state !== "string" ||
    !["processing", "canceled", "account"].includes(entry.state) ||
    typeof entry.expiresAt !== "number" ||
    !Number.isSafeInteger(entry.expiresAt) ||
    entry.expiresAt <= now ||
    entry.expiresAt > now + lifetime
  )
    return null;
  if (
    entry.state === "account"
      ? entry.purchaseId !== undefined
      : typeof entry.purchaseId !== "string" || !uuid.test(entry.purchaseId)
  )
    return null;
  return entry as unknown as PurchaseReturn;
}
export function clearPurchaseReturn() {
  try {
    sessionStorage.removeItem(purchaseReturnSlot);
  } catch {
    /* Storage may be disabled. */
  }
}
export function capturePurchaseReturn(now = Date.now()): PurchaseReturn | null {
  const url = new URL(location.href);
  if (url.searchParams.has("billing")) {
    const state = url.searchParams.get("billing");
    const entry = parsePurchaseReturn(
      {
        state,
        ...(state === "account"
          ? {}
          : { purchaseId: url.searchParams.get("purchase") }),
        expiresAt: now + lifetime,
      },
      now,
    );
    url.searchParams.delete("billing");
    url.searchParams.delete("purchase");
    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    clearPurchaseReturn();
    if (entry)
      try {
        sessionStorage.setItem(purchaseReturnSlot, JSON.stringify(entry));
      } catch {
        /* In-memory navigation remains available. */
      }
    return entry;
  }
  try {
    const raw = sessionStorage.getItem(purchaseReturnSlot);
    const entry =
      raw && raw.length <= 256
        ? parsePurchaseReturn(JSON.parse(raw), now)
        : null;
    if (!entry) clearPurchaseReturn();
    return entry;
  } catch {
    clearPurchaseReturn();
    return null;
  }
}
