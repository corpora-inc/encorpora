const KEY = "amp.school-adoption";
const TOKEN = /^adopt_[A-Za-z0-9_-]{43}$/;
const MAX_AGE = 7 * 86_400_000;
/** Run before the staff route guard. OAuth/password sign-in can then return to
 * the route without putting the single-use approval in a URL or auth log. */
export function prepareSchoolAdoption() {
  if (typeof window === "undefined") return;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has("token")) return;
  const token = fragment.get("token") ?? "";
  try {
    if (TOKEN.test(token))
      sessionStorage.setItem(KEY, JSON.stringify({ token, saved: Date.now() }));
    else sessionStorage.removeItem(KEY);
  } catch (error) {
    // An unavailable session store is handled as a missing link.
    console.warn(
      "The district approval link couldn’t be kept in this tab",
      error,
    );
  }
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );
}
export function schoolAdoptionToken(): string | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (
      TOKEN.test(value?.token ?? "") &&
      Number.isFinite(value.saved) &&
      Date.now() - value.saved < MAX_AGE
    )
      return value.token;
  } catch (error) {
    // Invalid or unavailable storage holds no approval.
    console.warn("The kept district approval couldn’t be read", error);
  }
  clearSchoolAdoption();
  return null;
}
export function clearSchoolAdoption() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (error) {
    console.warn("The kept district approval couldn’t be cleared", error);
  }
}
