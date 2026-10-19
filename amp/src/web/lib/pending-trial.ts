/** The trial token lives on this device only; it holds no personal data. */
export const trialKey = "amp.trial";
export function storedTrial(): string | null {
  try {
    return localStorage.getItem(trialKey);
  } catch {
    return null;
  }
}
export function clearStoredTrial() {
  try {
    localStorage.removeItem(trialKey);
  } catch (error) {
    console.warn("Trial token not cleared", error);
  }
}

/** A plan chosen on the free-trial paywall before the parent had an account.
 * It is only an interval and a time, so sign-up can continue straight to that
 * plan. After a day it no longer redirects anyone. */
const planKey = "amp.trial.plan";
const planDays = 1;
export function rememberPlanChoice(interval: "year" | "month") {
  try {
    localStorage.setItem(planKey, JSON.stringify({ interval, at: Date.now() }));
  } catch (error) {
    console.warn("Plan choice not saved on this device", error);
  }
}
export function chosenPlan(now = Date.now()): "year" | "month" | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(planKey) ?? "null");
    if (!value || typeof value !== "object") return null;
    const { interval, at } = value as { interval?: unknown; at?: unknown };
    if (interval !== "year" && interval !== "month") return null;
    if (typeof at !== "number" || now - at > planDays * 86_400_000 || at > now)
      return null;
    return interval;
  } catch {
    return null;
  }
}
export function forgetPlanChoice() {
  try {
    localStorage.removeItem(planKey);
  } catch (error) {
    console.warn("Plan choice not cleared", error);
  }
}
