/* "Continue with AMP" for one learner leaves for Stripe and comes back. This
   tab remembers who it was for and the screen it was opened from, so the
   existing checkout returns (`/start/purchase` and `/purchase/annual`) can
   put the person back where they were, with the learner's access active,
   and then offer to add a name. Nothing here is sent anywhere. */

const STORAGE_NAME = "amp.continue.v1";
/** Long enough for a slow checkout; short enough that an old one is gone. */
const LIFETIME_MS = 3 * 60 * 60 * 1000;

export type Continuation = {
  accountId: string;
  learnerId: string;
  /** The app path (with search) the pause was on. */
  returnTo: string;
  /** `paying` until access is active; then `naming` until it is offered. */
  stage: "paying" | "naming";
  savedAt: number;
};

/** Only an app path on this origin: never a full URL or a protocol-relative one. */
export function safeReturnPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  if (/^\/(start|continue|sign-in|sign-up)(\/|$|\?)/.test(path)) return "/";
  return path.slice(0, 500);
}

export function rememberContinuation(
  value: Omit<Continuation, "savedAt" | "stage"> & {
    stage?: Continuation["stage"];
  },
) {
  try {
    sessionStorage.setItem(
      STORAGE_NAME,
      JSON.stringify({
        ...value,
        stage: value.stage ?? "paying",
        returnTo: safeReturnPath(value.returnTo),
        savedAt: Date.now(),
      } satisfies Continuation),
    );
  } catch (error) {
    console.warn("Where to return after checkout wasn’t saved", error);
  }
}

export function readContinuation(accountId: string): Continuation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_NAME);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Continuation>;
    if (
      value.accountId !== accountId ||
      typeof value.learnerId !== "string" ||
      typeof value.returnTo !== "string" ||
      (value.stage !== "paying" && value.stage !== "naming") ||
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > LIFETIME_MS
    )
      return null;
    return {
      ...(value as Continuation),
      returnTo: safeReturnPath(value.returnTo),
    };
  } catch {
    return null;
  }
}

/** Access is active: what remains is the optional name. */
export function continuationPaid(accountId: string) {
  const current = readContinuation(accountId);
  if (current) rememberContinuation({ ...current, stage: "naming" });
  return current;
}

export function forgetContinuation() {
  try {
    sessionStorage.removeItem(STORAGE_NAME);
  } catch {
    // Nothing to forget.
  }
}
