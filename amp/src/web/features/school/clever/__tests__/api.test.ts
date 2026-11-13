import { afterEach, expect, test, vi } from "vitest";
import { connectionApi, connectionOptions } from "../api";
const credential = {
  token: "po_fixture",
  accountId: "amp|fixture",
  onboarding: true,
};
afterEach(() => vi.unstubAllGlobals());
test("onboarding proof stays a bearer on the connection endpoint", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          enabled: true,
          signInUrl: "/api/v1/school/sso/clever/start",
          districtSignupUrl: null,
          identity: null,
          connection: null,
          requests: [],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const options = connectionOptions(credential);
  const state = await options.queryFn!({
    signal: new AbortController().signal,
  } as never);
  expect(state.enabled).toBe(true);
  const [url, init] = fetcher.mock.calls[0]! as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("/api/v1/school/clever/status");
  expect(url).not.toContain(credential.token);
  expect(init.headers).toEqual({ Authorization: "Bearer po_fixture" });
});
test("expired proof gives a local recovery without changing account auth", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "sign_in_required" }), {
          status: 401,
        }),
    ),
  );
  await expect(
    connectionOptions(credential).queryFn!({
      signal: new AbortController().signal,
    } as never),
  ).rejects.toMatchObject({
    status: 401,
    message: "Your connection session ended. Sign in with Clever again.",
  });
});
test("a provider invitation is reported as pending, never as roster-ready", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "4e21104a-d73c-4cf6-8ea1-64b3891c8a4f",
            status: "requested",
            next: "provider_invitation",
            manualStartUrl: "/school/start",
          }),
          { status: 202 },
        ),
    ),
  );
  await expect(
    connectionApi.request(
      { ...credential, onboarding: false },
      {
        institutionName: "Fixture school",
        contactEmail: "admin@example.test",
        method: "anyschool",
      },
    ),
  ).resolves.toMatchObject({
    status: "requested",
    next: "provider_invitation",
  });
});

test("setup proof cannot invoke roster sync or an invitation request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(connectionApi.sync(credential)).rejects.toMatchObject({
    kind: "permission",
  });
  expect(fetcher).not.toHaveBeenCalled();
});
