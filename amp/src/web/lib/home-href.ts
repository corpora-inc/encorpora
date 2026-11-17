/**
 * The signed-in account's home address as this device last stored it
 * (lib/home-place.ts persists it under `amp.home`), read without the store:
 * the signed-out pitch's light entry may use it, and must carry neither the
 * store nor the router. Null when none is known.
 */
export function storedHome(): string | null {
  try {
    const raw = localStorage.getItem("amp.home");
    if (!raw) return null;
    const state = (JSON.parse(raw) as { state?: unknown }).state as
      { homes?: Record<string, unknown>; account?: unknown } | undefined;
    const account = typeof state?.account === "string" ? state.account : null;
    const home = account ? state?.homes?.[account] : undefined;
    return typeof home === "string" && /^\/(?![/\\])\S+$/.test(home)
      ? home
      : null;
  } catch (error) {
    console.warn("Your home place couldn’t be read on this device", error);
    return null;
  }
}
