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
