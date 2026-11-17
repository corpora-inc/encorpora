import type { BrowserContext, Page } from "playwright";

/**
 * The device's current learner as browser checks set and read it: the
 * learner store's persisted shape (src/web/learner-store.ts, `amp.learner`,
 * version 2), one learner per account id. Every script goes through these,
 * so the next change to the store is one edit here
 * (src/web/lib/__tests__/learner-seed.test.ts holds them to the store).
 */
export const LEARNER_STORE = "amp.learner";

/** The persisted value naming each account's current learner. */
export function learnerStoreValue(learners: Record<string, string>): string {
  return JSON.stringify({ state: { learners }, version: 2 });
}

/** An init or evaluate script that makes `learnerId` the current learner of
 * `accountId` on this device (the account id the app's session carries:
 * `amp|<user>`, `development-household`, a stub's own). */
export function seedLearnerScript(accountId: string, learnerId: string) {
  return `localStorage.setItem(${JSON.stringify(LEARNER_STORE)}, ${JSON.stringify(
    learnerStoreValue({ [accountId]: learnerId }),
  )});`;
}

/** Before every document of `target` loads: `accountId`'s learner is
 * `learnerId`. */
export async function seedLearner(
  target: Page | BrowserContext,
  accountId: string,
  learnerId: string,
) {
  await target.addInitScript(seedLearnerScript(accountId, learnerId));
}

/** On the page as it is now (the next load reads it). */
export async function writeLearner(
  page: Page,
  accountId: string,
  learnerId: string,
) {
  await page.evaluate(seedLearnerScript(accountId, learnerId));
}

/** `accountId`'s current learner on this page's device, or null. */
export async function readLearner(
  page: Page,
  accountId: string,
): Promise<string | null> {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    LEARNER_STORE,
  );
  if (!raw) return null;
  const parsed = JSON.parse(raw) as {
    state?: { learners?: Record<string, string> };
  };
  return parsed.state?.learners?.[accountId] ?? null;
}
