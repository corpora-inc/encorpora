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
 * It is only an interval, so sign-up can continue straight to that plan. */
const planKey = "amp.trial.plan";
export function rememberPlanChoice(interval: "year" | "month") {
  try {
    localStorage.setItem(planKey, interval);
  } catch (error) {
    console.warn("Plan choice not saved on this device", error);
  }
}
export function chosenPlan(): "year" | "month" | null {
  try {
    const value = localStorage.getItem(planKey);
    return value === "year" || value === "month" ? value : null;
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
