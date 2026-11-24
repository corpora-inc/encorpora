import { requestFetch } from "./lib/request-transport";
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { logAhead } from "./lib/ahead";

const basePath = "/api/auth";
const fetchOptions = {
  customFetchImpl: (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.origin,
    );
    // Sign-out must remain available even when /me cannot confirm renewal.
    return url.pathname === "/api/auth/sign-out"
      ? fetch(input, init)
      : requestFetch(input, init);
  },
};

/** Browser client for AMP's own parent accounts (same origin, /api/auth).
 * Passkeys are not in it: see `passkeyAccountClient`. */
export const accountClient = createAuthClient({
  basePath,
  fetchOptions,
  plugins: [twoFactorClient()],
});

let passkeys: Promise<PasskeyAccountClient> | undefined;
/** The same accounts with passkeys (sign in with one, add or rename one).
 * Its WebAuthn code downloads only when a passkey is used, never with the
 * app's first code (scripts/check-bundle-budget.ts). Every call is a plain
 * request, so a passkey sign-in is read back with `accessSession` as any
 * other sign-in is. */
export function passkeyAccountClient(): Promise<PasskeyAccountClient> {
  return (passkeys ??= createPasskeyClient().catch((error: unknown) => {
    // A failed download is retried the next time a passkey is used.
    passkeys = undefined;
    throw error;
  }));
}
/** Starts the passkey client's download where a passkey is offered (the
 * sign-in screen, the passkeys panel), so the ceremony a tap starts waits on
 * nothing but the server. A failure here is retried by the tap itself. */
export function preloadPasskeys() {
  passkeyAccountClient().catch((error: unknown) =>
    logAhead("The passkey client didn't load ahead", error),
  );
}
async function createPasskeyClient() {
  const { passkeyClient } = await import("@better-auth/passkey/client");
  return createAuthClient({
    basePath,
    fetchOptions,
    plugins: [twoFactorClient(), passkeyClient()],
  });
}
type PasskeyAccountClient = Awaited<ReturnType<typeof createPasskeyClient>>;
