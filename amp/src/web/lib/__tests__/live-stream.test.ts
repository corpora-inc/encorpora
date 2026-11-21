import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  EventStreamParser,
  LIVE_STREAM_TIMING,
  openLiveStream,
  type LiveStreamMode,
} from "../live-stream";

/** A stream the test writes to, as a server would. */
function serverStream(status = 200) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  let open = true;
  return {
    aborted: false,
    response: new Response(status === 200 ? body : "{}", { status }),
    write: (text: string) => controller.enqueue(encoder.encode(text)),
    bytes: (bytes: Uint8Array) => controller.enqueue(bytes),
    end: () => {
      if (open) controller.close();
      open = false;
    },
    fail: (error: unknown) => {
      if (open) controller.error(error);
      open = false;
    },
  };
}
type Server = ReturnType<typeof serverStream>;

let servers: Server[];
let responses: (() => Server | Error)[];
let fetchMock: ReturnType<typeof vi.fn>;
let poll: ReturnType<typeof vi.fn>;
let events: [string, unknown][];
let modes: LiveStreamMode[];
const doc = {
  visibilityState: "visible" as DocumentVisibilityState,
  listeners: new Set<() => void>(),
  addEventListener(_: string, listener: () => void) {
    this.listeners.add(listener);
  },
  removeEventListener(_: string, listener: () => void) {
    this.listeners.delete(listener);
  },
  show(state: DocumentVisibilityState) {
    this.visibilityState = state;
    for (const listener of this.listeners) listener();
  },
};
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  servers = [];
  responses = [];
  events = [];
  modes = [];
  doc.visibilityState = "visible";
  doc.listeners.clear();
  poll = vi.fn(() => Promise.resolve());
  fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const next = responses.shift()?.() ?? serverStream();
    if (next instanceof Error) return Promise.reject(next);
    servers.push(next);
    init.signal?.addEventListener("abort", () => {
      next.aborted = true;
      next.fail(new DOMException("aborted", "AbortError"));
    });
    return Promise.resolve(next.response);
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const open = (timing = {}) =>
  openLiveStream({
    path: "/school/classes/c/live/stream",
    token: "token-1",
    onEvent: (event, data) => events.push([event, data]),
    poll,
    timing,
    onMode: (mode) => modes.push(mode),
    fetch: fetchMock as never,
    document: doc,
  });

const FRAMES =
  ': open\r\n\r\nevent: snapshot\r\ndata: {"n":1}\r\n\r\n: ping\n\nevent: rows\ndata: {"a":\n' +
  'data: 2}\n\nevent: rows\rdata: {"é":"ü"}\r\r\n';
const PARSED = [
  ["snapshot", '{"n":1}'],
  ["rows", '{"a":\n2}'],
  ["rows", '{"é":"ü"}'],
];

test("frames parse the same at every chunk boundary", () => {
  for (let cut = 0; cut <= FRAMES.length; cut++)
    for (let second = cut; second <= FRAMES.length; second += 7) {
      const seen: string[][] = [];
      const parser = new EventStreamParser((event, data) =>
        seen.push([event, data]),
      );
      parser.push(FRAMES.slice(0, cut));
      parser.push(FRAMES.slice(cut, second));
      parser.push(FRAMES.slice(second));
      expect(seen, `cut at ${cut}/${second}`).toEqual(PARSED);
    }
  const seen: string[][] = [];
  const parser = new EventStreamParser((event, data) =>
    seen.push([event, data]),
  );
  for (const char of FRAMES) parser.push(char);
  expect(seen).toEqual(PARSED);
});

test("a character split across chunks arrives whole", async () => {
  const stream = open();
  await tick();
  const bytes = new TextEncoder().encode(
    'event: snapshot\ndata: {"name":"Zoë"}\n\n',
  );
  const at = bytes.indexOf(0xc3) + 1; // inside "ë"
  servers[0]!.bytes(bytes.slice(0, at));
  await tick();
  servers[0]!.bytes(bytes.slice(at));
  await tick();
  expect(events).toEqual([["snapshot", { name: "Zoë" }]]);
  stream.close();
});

test("the server ends a stream on purpose: reconnect at once", async () => {
  const stream = open();
  await tick();
  servers[0]!.write(": open\n\nevent: snapshot\ndata: {}\n\n");
  for (let i = 0; i < 6; i++) {
    await tick(15_000);
    servers[0]!.write(": ping\n\n");
  }
  servers[0]!.write('event: bye\ndata: {"reason":"rotate"}\n\n');
  servers[0]!.end();
  await tick();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(events.map(([event]) => event)).toEqual(["snapshot", "bye"]);
  servers[1]!.write(": open\n\n");
  await tick();
  expect(stream.mode).toBe("streaming");
  expect(poll).not.toHaveBeenCalled();
  stream.close();
});

test("a stream that ends at once, or fails, backs off; then polls", async () => {
  responses = [
    () => new TypeError("network"),
    () => new TypeError("network"),
    () => new TypeError("network"),
  ];
  const stream = open();
  await tick();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await tick(999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await tick(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await tick(2_000);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  // Three in a row: poll the snapshot, and try the stream again later.
  expect(stream.mode).toBe("polling");
  expect(poll).toHaveBeenCalledTimes(1);
  await tick(LIVE_STREAM_TIMING.pollMs);
  expect(poll).toHaveBeenCalledTimes(2);
  await tick(LIVE_STREAM_TIMING.retryStreamMs);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  servers.at(-1)!.write(": open\n\n");
  await tick();
  expect(stream.mode).toBe("streaming");
  const polled = poll.mock.calls.length;
  await tick(10_000);
  expect(poll).toHaveBeenCalledTimes(polled);
  stream.close();
});

test("an early end without a bye counts as a failure", async () => {
  const stream = open();
  await tick();
  servers[0]!.write(": open\n\n");
  servers[0]!.end();
  await tick();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await tick(1_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  stream.close();
});

test("pings keep the watchdog quiet", async () => {
  const stream = open();
  await tick();
  servers[0]!.write(": open\n\nevent: snapshot\ndata: {}\n\n");
  for (let i = 0; i < 6; i++) {
    await tick(15_000);
    servers[0]!.write(": ping\n\n");
  }
  await tick();
  expect(poll).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  stream.close();
});

test("a held stream (no bytes for 25 s) falls back to polling, then retries", async () => {
  const stream = open();
  await tick();
  await tick(LIVE_STREAM_TIMING.watchdogMs - 1);
  expect(poll).not.toHaveBeenCalled();
  await tick(1);
  expect(stream.mode).toBe("polling");
  expect(poll).toHaveBeenCalledTimes(1);
  // The held stream was let go.
  expect(servers[0]!.aborted).toBe(true);
  await tick(LIVE_STREAM_TIMING.pollMs * 3);
  expect(poll).toHaveBeenCalledTimes(4);
  await tick(LIVE_STREAM_TIMING.retryStreamMs - LIVE_STREAM_TIMING.pollMs * 3);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  // Still held: polling goes on, and the stream is tried again later.
  await tick(LIVE_STREAM_TIMING.watchdogMs);
  expect(stream.mode).toBe("polling");
  const polled = poll.mock.calls.length;
  await tick(LIVE_STREAM_TIMING.pollMs);
  expect(poll.mock.calls.length).toBe(polled + 1);
  await tick(LIVE_STREAM_TIMING.retryStreamMs);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  stream.close();
});

test("a refused stream polls at once", async () => {
  responses = [() => serverStream(503)];
  const stream = open();
  await tick();
  expect(stream.mode).toBe("polling");
  expect(poll).toHaveBeenCalledTimes(1);
  stream.close();
});

test("a failing poll slows down rather than hammering", async () => {
  responses = [() => serverStream(404)];
  poll.mockImplementation(() => Promise.reject(new Error("not_found")));
  const stream = open();
  await tick();
  expect(poll).toHaveBeenCalledTimes(1);
  await tick(LIVE_STREAM_TIMING.pollMs);
  expect(poll).toHaveBeenCalledTimes(1);
  await tick(LIVE_STREAM_TIMING.pollMs);
  expect(poll).toHaveBeenCalledTimes(2);
  stream.close();
});

test("a hidden page holds nothing; showing it starts a fresh stream", async () => {
  const stream = open();
  await tick();
  servers[0]!.write(": open\n\nevent: snapshot\ndata: {}\n\n");
  await tick();
  doc.show("hidden");
  await tick();
  expect(stream.mode).toBe("paused");
  await tick(10 * 60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(poll).not.toHaveBeenCalled();
  doc.show("visible");
  await tick();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  servers[1]!.write('event: snapshot\ndata: {"fresh":true}\n\n');
  await tick();
  expect(events.at(-1)).toEqual(["snapshot", { fresh: true }]);
  stream.close();
});

test("a page that was polling resumes polling when shown", async () => {
  responses = [() => serverStream(503)];
  const stream = open();
  await tick();
  expect(poll).toHaveBeenCalledTimes(1);
  doc.show("hidden");
  await tick(60_000);
  expect(poll).toHaveBeenCalledTimes(1);
  doc.show("visible");
  await tick();
  expect(poll).toHaveBeenCalledTimes(2);
  expect(stream.mode).toBe("polling");
  stream.close();
});

test("closing (unmount) aborts the stream and stops everything", async () => {
  const stream = open();
  await tick();
  servers[0]!.write(": open\n\n");
  await tick();
  stream.close();
  expect(stream.mode).toBe("closed");
  expect(servers[0]!.aborted).toBe(true);
  await tick(5 * 60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(poll).not.toHaveBeenCalled();
  expect(doc.listeners.size).toBe(0);
  expect(modes.at(-1)).toBe("closed");
});

test("the request carries the bearer and asks for an event stream", async () => {
  const stream = open();
  await tick();
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/v1/school/classes/c/live/stream");
  expect((init as RequestInit).headers).toMatchObject({
    Authorization: "Bearer token-1",
    Accept: "text/event-stream",
  });
  stream.close();
});
