import { nativeRuntime } from "../native-runtime";
import { hasPurchaseReturn } from "../purchase-return";

export const reloadSlot = "amp.release-reload";
export const reloadTtlMs = 60_000;
export type ReloadBlock = "recent" | "storage" | "payment" | "input" | "native";

/** Claim before navigating. Refresh a blocked timestamp so repeated failures
 * cannot produce a reload loop. The replacement document stays guarded even
 * if its import takes longer than the TTL to fail. A later document opened
 * after a quiet minute can attempt recovery again. */
export function claimReload(
  storage: Pick<Storage, "getItem" | "setItem">,
  now = Date.now(),
  documentStartedAt = now,
): "recent" | "storage" | null {
  try {
    const raw = storage.getItem(reloadSlot);
    const previous = Number(raw);
    const recent =
      raw !== null &&
      Number.isFinite(previous) &&
      (previous > now ||
        now - previous < reloadTtlMs ||
        documentStartedAt - previous < reloadTtlMs);
    storage.setItem(reloadSlot, String(now));
    if (storage.getItem(reloadSlot) !== String(now)) return "storage";
    return recent ? "recent" : null;
  } catch {
    return "storage";
  }
}

let edited = false;
let payment = false;
let watching = false;
/** Conservative: an edit may live in a React draft after its control unmounts.
 * Do not infer that submit means save succeeded. No input values are retained. */
export function watchReloadSafety() {
  if (watching) return;
  watching = true;
  payment = paymentReturn();
  const changed = (event: Event) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'input, textarea, select, [contenteditable="true"], [role="checkbox"], [role="radio"], [role="combobox"], [role="slider"]',
      )
    )
      edited = true;
  };
  document.addEventListener("input", changed, true);
  document.addEventListener("change", changed, true);
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          '[role="checkbox"], [role="radio"], [role="option"]',
        )
      )
        edited = true;
    },
    true,
  );
}
function paymentReturn(
  target: Pick<Location, "search" | "pathname"> = location,
) {
  const query = new URLSearchParams(target.search);
  return (
    [
      "billing",
      "purchase",
      "payment_intent",
      "payment_intent_client_secret",
      "redirect_status",
      "session_id",
    ].some((key) => query.has(key)) ||
    /^\/(?:start\/purchase|purchase\/annual|checkout)(?:\/|$)/.test(
      target.pathname ?? "",
    ) ||
    hasPurchaseReturn(target.search)
  );
}
export function autoReloadBlock(
  destination?: Pick<Location, "search" | "pathname">,
): ReloadBlock | null {
  if (nativeRuntime) return "native";
  payment ||= paymentReturn() || (!!destination && paymentReturn(destination));
  if (payment) return "payment";
  // Also catch autofill and edits made before listeners were installed.
  const filled = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    ),
  ).some(
    (input) =>
      ![
        "hidden",
        "submit",
        "button",
        "reset",
        "checkbox",
        "radio",
        "range",
      ].includes(input.type) && !!input.value,
  );
  if (edited || filled) return "input";
  try {
    return claimReload(sessionStorage, Date.now(), performance.timeOrigin);
  } catch {
    return "storage";
  }
}
