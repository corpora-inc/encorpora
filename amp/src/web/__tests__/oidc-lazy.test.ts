import { afterEach, expect, test, vi } from "vitest";

/* AMP's own accounts never download the external sign-in client: it loads
   only in OIDC mode (auth.ts `oidcManager`), so it stays out of the app's
   first code (scripts/check-bundle-budget.ts). */

const loaded = vi.hoisted(() => ({ oidc: false }));
vi.mock("oidc-client-ts", () => {
  loaded.oidc = true;
  return { UserManager: class {}, WebStorageStateStore: class {} };
});
vi.mock("../account-client", () => ({
  accountClient: {
    getSession: vi.fn(async () => ({ data: null, error: null })),
  },
}));
import { accessSession, authConfig, onSessionChanged } from "../auth";

afterEach(() => vi.unstubAllGlobals());

test("accounts-mode boot never loads oidc-client-ts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ mode: "accounts", passwords: true, providers: [] }),
    ),
  );
  expect((await authConfig()).mode).toBe("accounts");
  await expect(accessSession()).resolves.toBeNull();
  const stop = onSessionChanged(() => undefined);
  stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(loaded.oidc).toBe(false);
});
