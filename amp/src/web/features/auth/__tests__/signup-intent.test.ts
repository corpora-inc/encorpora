import { afterEach, beforeEach, expect, test, vi } from "vitest";

const posts: { url: string; body: unknown }[] = [];
let answer: (
  url: string,
  signal?: AbortSignal | null,
) => Response | Promise<Response> = () => new Response("{}", { status: 200 });
vi.mock("../../../lib/request-transport", () => ({
  requestFetch: async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init.body)) });
    return answer(url, init.signal);
  },
}));
vi.mock("../../../lib/auth-measurement", () => ({
  measureAuth: (_stage: string, work: () => Promise<unknown>) => work(),
}));

const { recordPendingIntent, recordSignupIntent, resetSignupIntentForTests } =
  await import("../signup-intent");

const body = {
  notice: "free-parent-account-v2" as const,
  newsletter: true,
  entry: "pitch-try" as const,
};

beforeEach(() => {
  posts.length = 0;
  answer = () => new Response("{}", { status: 200 });
  sessionStorage.clear();
  resetSignupIntentForTests();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test("a failed intent never stops sign-up: it resolves, and records after sign-in", async () => {
  answer = () => new Response('{"error":"origin_not_allowed"}', { status: 403 });
  await expect(recordSignupIntent(body)).resolves.toBeUndefined();
  expect(posts.map((post) => post.url)).toEqual([
    "/api/v1/parent-followup/intent",
  ]);
  // Signed in: the intent again, marked late, then attached to the account.
  answer = () => new Response("{}", { status: 200 });
  await recordPendingIntent();
  expect(posts.slice(1)).toEqual([
    {
      url: "/api/v1/parent-followup/intent",
      body: { ...body, late: true },
    },
    { url: "/api/v1/parent-followup/complete", body: {} },
  ]);
  // Once.
  await recordPendingIntent();
  expect(posts).toHaveLength(3);
});

test("a network failure is the same: sign-up goes ahead", async () => {
  answer = () => Promise.reject(new TypeError("Failed to fetch"));
  await expect(recordSignupIntent(body)).resolves.toBeUndefined();
});

test("an intent that landed leaves nothing to record after sign-in", async () => {
  await recordSignupIntent(body);
  await recordPendingIntent();
  expect(posts).toHaveLength(1);
});

test("a slow answer doesn't hold sign-up past its wait", async () => {
  // An answer that never comes, only its abort.
  answer = (_url, signal) =>
    new Promise<Response>((_resolve, reject) =>
      signal?.addEventListener("abort", () => reject(signal.reason)),
    );
  const started = Date.now();
  await expect(recordSignupIntent(body)).resolves.toBeUndefined();
  expect(Date.now() - started).toBeLessThan(4000);
});

test("two screens asking at once record it once", async () => {
  answer = () => new Response("{}", { status: 503 });
  await recordSignupIntent(body);
  answer = () => new Response("{}", { status: 200 });
  await Promise.all([recordPendingIntent(), recordPendingIntent()]);
  expect(posts.map((post) => post.url)).toEqual([
    "/api/v1/parent-followup/intent",
    "/api/v1/parent-followup/intent",
    "/api/v1/parent-followup/complete",
  ]);
});
