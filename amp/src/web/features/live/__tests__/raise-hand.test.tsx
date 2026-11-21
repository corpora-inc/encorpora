import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StudentSignal } from "../../../../schools/live/contracts";
import type { StudentLive } from "../../../../schools/live/stream-contracts";
import type { AuthSession } from "../../../auth";
import { sessionOptions } from "../../../lib/query";
import { studentLiveKey } from "../api";

vi.mock("../../../lib/live-stream", () => ({
  openLiveStream: () => ({ close: vi.fn(), mode: "connecting" }),
}));
const { RaiseHand, SAW_IT_MS } = await import("../RaiseHand");

const CLASS = "22222222-2222-4222-8222-222222222222";
const PERSON = "00000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-20T15:00:00.000Z");
const signal = (extra: Partial<StudentSignal> = {}): StudentSignal => ({
  id: "44444444-4444-4444-8444-444444444444",
  classId: CLASS,
  personId: PERSON,
  kind: "hand",
  createdAt: new Date(NOW - 20_000).toISOString(),
  resolvedAt: null,
  resolution: null,
  ...extra,
});
const live = (signals: StudentSignal[]): StudentLive => ({
  serverNow: new Date(NOW).toISOString(),
  sessions: [],
  signals,
});

let client: QueryClient;
const posts: { url: string; body: unknown }[] = [];
let answer: StudentSignal[] = [];
beforeEach(() => {
  posts.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      posts.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const body = url.includes("/student/live")
        ? live(answer)
        : { signals: answer };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(token: string | null, held?: StudentLive) {
  const held_session: AuthSession | null = token
    ? { accountId: "acct", token }
    : null;
  client.setQueryData<AuthSession | null>(
    sessionOptions.queryKey as never,
    held_session,
  );
  if (held && token)
    client.setQueryData(studentLiveKey({ accountId: "acct", token }), held);
  return render(
    <QueryClientProvider client={client}>
      <RaiseHand />
    </QueryClientProvider>,
  );
}
const button = () => screen.queryByRole("button", { name: "Raise hand" });

test("hidden without a student session", () => {
  mount("tok_parent");
  expect(button()).toBeNull();
  cleanup();
  mount(null);
  expect(button()).toBeNull();
});

test("down: raises on tap, the button is pressed at once, then reconciled", async () => {
  answer = [signal()];
  mount("st_abc", live([]));
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(button()!);
  await waitFor(() =>
    expect(button()?.getAttribute("aria-pressed")).toBe("true"),
  );
  await waitFor(() =>
    expect(
      posts.some(
        (p) =>
          p.url.endsWith("/student/signals") &&
          (p.body as { kind: string }).kind === "hand",
      ),
    ).toBe(true),
  );
});

test("up: shown from the stream, tap lowers", async () => {
  answer = [];
  mount("st_abc", live([signal()]));
  expect(button()?.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(button()!);
  await waitFor(() =>
    expect(button()?.getAttribute("aria-pressed")).toBe("false"),
  );
  await waitFor(() =>
    expect(posts.some((p) => p.url.endsWith("/student/signals/withdraw"))).toBe(
      true,
    ),
  );
});

test("acknowledged: the press clears and a note shows, then goes by itself", async () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 1_000).toISOString(),
    resolution: "acknowledged",
  });
  answer = [acked];
  mount("st_abc", live([acked]));
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("status").textContent).toBe("Your teacher saw it.");
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), {
    timeout: SAW_IT_MS + 1_000,
  });
}, 10_000);

test("an old acknowledgement shows no note", () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 30_000).toISOString(),
    resolution: "acknowledged",
  });
  mount("st_abc", live([acked]));
  expect(screen.queryByRole("status")).toBeNull();
});

test("withdrawn shows no note", () => {
  mount(
    "st_abc",
    live([
      signal({
        resolvedAt: new Date(NOW).toISOString(),
        resolution: "withdrawn",
      }),
    ]),
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
});
