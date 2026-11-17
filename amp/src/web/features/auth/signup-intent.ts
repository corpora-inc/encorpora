import { measureAuth } from "../../lib/auth-measurement";
import { requestFetch } from "../../lib/request-transport";
import type { SignupIntent } from "../../../parent-followup/contracts";

/*
 * The parent sign-up intent (`POST /api/v1/parent-followup/intent`): what a
 * new parent signed up for (the pitch's Try it free or Buy, a program, the
 * ad's campaign), recorded with the account it creates. It never stands in
 * the way of signing up:
 *
 * - Before a sign-up, it is asked for briefly (its cookie must exist before
 *   a provider's redirect). A failure or a slow answer is logged and the
 *   sign-up goes ahead.
 * - The intent that didn't land is kept for this tab and recorded once the
 *   account is signed in (`recordPendingIntent`): the intent again, then
 *   `/complete`, which attaches it to the signed-in account.
 */
const PENDING = "amp.signup-intent-pending";
/** How long a sign-up waits on the intent before it goes ahead. */
const WAIT_MS = 2500;

type Body = Omit<SignupIntent, "late">;

function post(path: string, body: unknown, timeout: number) {
  return requestFetch(path, {
    method: "POST",
    credentials: "same-origin",
    signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((response) => {
    if (!response.ok)
      throw new Error(`${path} answered ${response.status}`, {
        cause: response.status,
      });
  });
}

function keepPending(body: Body | null) {
  try {
    if (body) sessionStorage.setItem(PENDING, JSON.stringify(body));
    else sessionStorage.removeItem(PENDING);
  } catch (error) {
    console.warn("The sign-up intent's retry lasts for this page only", error);
    memory = body;
  }
}
let memory: Body | null = null;

function pending(): Body | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    return raw && raw.length < 4096 ? (JSON.parse(raw) as Body) : memory;
  } catch (error) {
    console.warn("The sign-up intent's retry couldn't be read", error);
    return memory;
  }
}

/** Before a sign-up: records the intent, waiting at most a moment. Never
 * throws; what didn't land is recorded after sign-in instead. */
export async function recordSignupIntent(
  body: Body,
  before: Promise<unknown> = Promise.resolve(),
) {
  keepPending(body);
  try {
    await measureAuth("prepare", async () => {
      await Promise.race([
        before,
        new Promise<void>((resolve) => setTimeout(resolve, 1800)),
      ]);
      await post("/api/v1/parent-followup/intent", body, WAIT_MS);
    });
    keepPending(null);
  } catch (error) {
    console.warn(
      "The sign-up intent didn't record first; it records after sign-in",
      error,
    );
  }
}

/** Signed in: records an intent that didn't land before the sign-up, once.
 * Never throws; a failure is logged and kept for the next try. */
export function recordPendingIntent(): Promise<void> {
  // Several screens may ask at once (a provider's return, the first run):
  // one recording.
  return (inflight ??= recordPending().finally(() => {
    inflight = null;
  }));
}
let inflight: Promise<void> | null = null;

async function recordPending() {
  const body = pending();
  if (!body) return;
  try {
    await post(
      "/api/v1/parent-followup/intent",
      { ...body, late: true },
      10_000,
    );
    await post("/api/v1/parent-followup/complete", {}, 10_000);
    keepPending(null);
  } catch (error) {
    console.error("The sign-up intent wasn't recorded after sign-in", error);
  }
}

/** Forgets the kept intent (tests). */
export function resetSignupIntentForTests() {
  memory = null;
  keepPending(null);
}
