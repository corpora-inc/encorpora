import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * A whole school shares one internet address, so a limit per address throttles
 * the school as if it were one client. A signed-in student is limited alone,
 * and the limits on an address are high enough for a building full of them.
 * All of these count per pod.
 */
/** Requests per minute per credential or session. */
export const GLOBAL_RATE_LIMIT = 600;
/** Requests per minute per address with no credential: pages being opened. */
export const ANONYMOUS_RATE_LIMIT = 3000;
/** Any request per minute per address, however many credentials it presents.
 * Credentials aren't checked before this, so this stops made-up ones from
 * escaping the limits above. About 5 requests per minute per student on a pod. */
export const ADDRESS_RATE_LIMIT = 20000;

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?amp\.session_token=([^;]+)/;
/** The header or cookie that identifies this client, if any. */
function credentialOf(request: FastifyRequest) {
  return (
    request.headers.authorization ??
    request.headers.cookie?.match(SESSION_COOKIE)?.[1]
  );
}
export function rateLimitKey(request: FastifyRequest) {
  const credential = credentialOf(request);
  return credential
    ? `credential:${createHash("sha256").update(credential).digest("hex")}`
    : `address:${request.ip}`;
}
export const isAnonymous = (key: string) => key.startsWith("address:");

/** Counts per key in fixed windows, in this process. */
export function fixedWindow(windowMs: number) {
  const windows = new Map<string, { count: number; ends: number }>();
  const current = (key: string, now: number) => {
    const window = windows.get(key);
    return window && window.ends > now ? window : null;
  };
  return {
    /** Counts one more, and says whether it is within `max`. */
    consume(key: string, max: number, now = Date.now()) {
      if (windows.size > 100_000)
        for (const [known, { ends }] of windows)
          if (ends <= now) windows.delete(known);
      const window = current(key, now);
      if (!window) {
        windows.set(key, { count: 1, ends: now + windowMs });
        return 1 <= max;
      }
      window.count += 1;
      return window.count <= max;
    },
    count: (key: string, now = Date.now()) => current(key, now)?.count ?? 0,
  };
}

export function limitEachAddress(
  app: FastifyInstance,
  max = ADDRESS_RATE_LIMIT,
) {
  const addresses = fixedWindow(60_000);
  app.addHook("onRequest", async (request, reply) => {
    if (addresses.consume(request.ip, max)) return;
    request.log.warn("address rate limit reached");
    return reply.code(429).send({
      error: "Too many requests from this network. Try again in a minute.",
    });
  });
}

/** Wrong passwords per 5 minutes for one account: from one address, then from
 * anywhere. Guessing is limited by the account it targets, not the address it
 * comes from, and signing in correctly never counts. The larger limit keeps a
 * guesser spread over many addresses slow, without letting one lock out a
 * person, who is only stopped by the attempts from their own address. */
const WRONG_PASSWORDS_PER_ADDRESS = 10;
const WRONG_PASSWORDS_PER_ACCOUNT = 100;
const wrongPasswords = fixedWindow(5 * 60_000);
function accountOf(body: Buffer | undefined) {
  try {
    const email: unknown = body?.length
      ? JSON.parse(body.toString("utf8"))?.email
      : undefined;
    return typeof email === "string"
      ? createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
      : null;
  } catch {
    return null; // Malformed: the sign-in handler rejects it.
  }
}
/** Whether this account has had too many wrong passwords for another try. */
export function passwordAttemptsExhausted(
  body: Buffer | undefined,
  address: string,
) {
  const account = accountOf(body);
  return (
    account !== null &&
    (wrongPasswords.count(`${account}|${address}`) >=
      WRONG_PASSWORDS_PER_ADDRESS ||
      wrongPasswords.count(account) >= WRONG_PASSWORDS_PER_ACCOUNT)
  );
}
export function recordWrongPassword(body: Buffer | undefined, address: string) {
  const account = accountOf(body);
  if (account === null) return;
  wrongPasswords.consume(`${account}|${address}`, Infinity);
  wrongPasswords.consume(account, Infinity);
}
