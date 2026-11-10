/** A plan chosen on the pitch before the parent had an account. It is only an
 * interval and a time, so the plan opens with it once the learner exists.
 * After a day it no longer applies. */
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
