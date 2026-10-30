const storageKey = "amp.trial-introduction";
const pending = new Set<string>();

export function prepareTrialIntroduction(learnerId: string) {
  pending.add(learnerId);
  try {
    localStorage.setItem(storageKey, learnerId);
  } catch {
    /* Optional storage. */
  }
}

export function trialIntroductionPending(learnerId: string): boolean {
  if (pending.has(learnerId)) return true;
  try {
    return localStorage.getItem(storageKey) === learnerId;
  } catch {
    return false;
  }
}

export function dismissTrialIntroduction(learnerId: string) {
  pending.delete(learnerId);
  try {
    if (localStorage.getItem(storageKey) === learnerId)
      localStorage.removeItem(storageKey);
  } catch {
    /* Practice never depends on browser storage. */
  }
}
