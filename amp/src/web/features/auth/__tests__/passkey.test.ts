import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock("../../../native-runtime");
});
async function available(native: boolean, hostname = "localhost") {
  vi.doMock("../../../native-runtime", () => ({ nativeRuntime: native }));
  vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("location", { ...location, hostname });
  const { passkeysAvailable } = await import("../passkey");
  return passkeysAvailable();
}

test("passkeys are offered in a secure browser on a domain", async () => {
  expect(await available(false)).toBe(true);
});
test("never in the native app, whose webview cannot reach AMP's relying party", async () => {
  expect(await available(true)).toBe(false);
});
test("never on an IP-address origin, which WebAuthn rejects", async () => {
  expect(await available(false, "127.0.0.1")).toBe(false);
  expect(await available(false, "[::1]")).toBe(false);
});
