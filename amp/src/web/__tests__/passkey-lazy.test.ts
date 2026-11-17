import { afterEach, expect, test, vi } from "vitest";

/* Passkeys load when one is used (sign in with a passkey, add or rename
   one), never with the app's first code: the account client is built
   without the passkey plugin, whose WebAuthn library (@simplewebauthn/
   browser) would otherwise ride in the entry (scripts/check-bundle-budget.ts). */

const loaded = vi.hoisted(() => ({ plugin: false, webauthn: false }));
vi.mock("@better-auth/passkey/client", () => {
  loaded.plugin = true;
  return { passkeyClient: () => ({ id: "passkey" }) };
});
vi.mock("@simplewebauthn/browser", () => {
  loaded.webauthn = true;
  return {};
});
import { accountClient, passkeyAccountClient } from "../account-client";
import { authConfig, onSessionChanged } from "../auth";

afterEach(() => vi.unstubAllGlobals());

test("boot never evaluates the passkey client or @simplewebauthn/browser", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ mode: "accounts", passwords: true, providers: [] }),
    ),
  );
  expect((await authConfig()).mode).toBe("accounts");
  const stop = onSessionChanged(() => undefined);
  stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(accountClient).toBeDefined();
  expect(loaded).toEqual({ plugin: false, webauthn: false });
});

test("using a passkey loads its client once", async () => {
  const first = passkeyAccountClient();
  const second = passkeyAccountClient();
  expect(await first).toBe(await second);
  expect(loaded.plugin).toBe(true);
});
