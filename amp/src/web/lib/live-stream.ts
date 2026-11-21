import { requestFetch } from "./request-transport";
import { isRetired } from "./session-generation";

/**
 * A live stream from the server (#2465): server-sent events read with fetch,
 * because `EventSource` can't send our bearer token. The server ends each
 * stream after 85–95 s and this reconnects at once (with backoff after
 * errors); every message is state, so nothing is lost between two streams.
 *
 * Some school networks hold a stream until it ends. The server sends bytes
 * at least every 15 s; when none arrive for `watchdogMs`, this polls the
 * snapshot every `pollMs` instead and tries the stream again after
 * `retryStreamMs`. A hidden page holds no stream and polls nothing; showing
 * it again starts a fresh stream, whose first message is the whole state.
 */

export type LiveStreamTiming = {
  /** No bytes for this long: the network is holding the stream. */
  watchdogMs: number;
  /** How often the fallback polls the snapshot. */
  pollMs: number;
  /** While polling, try the stream again this often. */
  retryStreamMs: number;
  /** A stream that ended too soon or failed, the `n`th time in a row: wait
   * this long before the next. */
  backoffMs: (failures: number) => number;
  /** A stream this short-lived without a `bye` counts as a failure. */
  minLifeMs: number;
  /** After this many failures in a row, poll until the next retry. */
  failuresBeforePolling: number;
};
export const LIVE_STREAM_TIMING: LiveStreamTiming = {
  watchdogMs: 25_000,
  pollMs: 3_000,
  retryStreamMs: 120_000,
  backoffMs: (failures) => Math.min(30_000, 1_000 * 2 ** (failures - 1)),
  minLifeMs: 5_000,
  failuresBeforePolling: 3,
};

export type LiveStreamMode =
  "connecting" | "streaming" | "polling" | "paused" | "closed";

export type LiveStreamOptions = {
  /** The stream's API path, after `/api/v1`. */
  path: string;
  /** The bearer it is read with. A sign-in that ends closes the stream. */
  token: string;
  /** Each message, its JSON parsed. */
  onEvent: (event: string, data: unknown) => void;
  /** Reads the same state the plain way (the snapshot GET): the fallback.
   * Rejects on failure; it is logged by whoever reads. */
  poll: () => Promise<unknown>;
  /** The fallback polls this often (the student's state changes rarely). */
  timing?: Partial<LiveStreamTiming>;
  onMode?: (mode: LiveStreamMode) => void;
  /** Test seams. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  document?: Pick<
    Document,
    "visibilityState" | "addEventListener" | "removeEventListener"
  >;
};

export type LiveStream = { close(): void; readonly mode: LiveStreamMode };

/** Server-sent events, parsed from text that arrives in any pieces: a frame,
 * a line, a UTF-8 character or a CRLF may be split across chunks. */
export class EventStreamParser {
  private buffer = "";
  private event = "";
  private data: string[] = [];
  constructor(
    private readonly dispatch: (event: string, data: string) => void,
  ) {}

  push(text: string) {
    const buffer = this.buffer + text;
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      if (char !== "\n" && char !== "\r") continue;
      // A CR at the end may be half of a CRLF: wait for the next piece.
      if (char === "\r" && i === buffer.length - 1) break;
      const line = buffer.slice(start, i);
      if (char === "\r" && buffer[i + 1] === "\n") i++;
      start = i + 1;
      this.line(line);
    }
    this.buffer = buffer.slice(start);
  }

  private line(line: string) {
    if (line === "") {
      if (this.data.length)
        this.dispatch(this.event || "message", this.data.join("\n"));
      this.event = "";
      this.data = [];
      return;
    }
    // A comment (`: ping`): bytes that say the stream is alive, nothing more.
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
  }
}

export function openLiveStream(options: LiveStreamOptions): LiveStream {
  const timing = { ...LIVE_STREAM_TIMING, ...options.timing };
  const doc = options.document ?? document;
  const send = options.fetch ?? requestFetch;
  let mode: LiveStreamMode = "connecting";
  let controller: AbortController | null = null;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Polling instead of streaming, until a retried stream delivers bytes. */
  let polling = false;
  let pollFailures = 0;
  let failures = 0;
  const setMode = (next: LiveStreamMode) => {
    if (mode === next) return;
    mode = next;
    options.onMode?.(next);
  };
  const hidden = () => doc.visibilityState === "hidden";

  function stopStream() {
    controller?.abort();
    controller = null;
    clearTimeout(watchdog);
    clearTimeout(reconnect);
  }
  function stopPolling() {
    polling = false;
    clearTimeout(pollTimer);
    clearTimeout(retry);
  }

  function pollNow() {
    if (!polling || mode === "closed" || hidden()) return;
    options.poll().then(
      () => {
        pollFailures = 0;
        if (polling) pollTimer = setTimeout(pollNow, timing.pollMs);
      },
      (error: unknown) => {
        // The read logs its own failure; this says why polling slows.
        pollFailures++;
        console.warn("AMP: the live view couldn’t refresh; trying again", {
          path: options.path,
          error,
        });
        if (polling)
          pollTimer = setTimeout(
            pollNow,
            Math.min(60_000, timing.pollMs * 2 ** pollFailures),
          );
      },
    );
  }
  /** Poll from now, and try the stream again after `retryStreamMs`. */
  function startPolling() {
    clearTimeout(retry);
    retry = setTimeout(() => void connect(), timing.retryStreamMs);
    if (polling) return;
    polling = true;
    pollFailures = 0;
    setMode("polling");
    pollNow();
  }

  function armWatchdog(stream: AbortController) {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (stream !== controller) return;
      console.warn(
        "AMP: no bytes on the live stream for a while; polling instead",
        { path: options.path, ms: timing.watchdogMs },
      );
      stopStream();
      startPolling();
    }, timing.watchdogMs);
  }

  function failed(reason: unknown) {
    failures++;
    if (failures >= timing.failuresBeforePolling) {
      console.warn("AMP: the live stream keeps failing; polling instead", {
        path: options.path,
        failures,
        reason,
      });
      startPolling();
      return;
    }
    reconnect = setTimeout(() => void connect(), timing.backoffMs(failures));
  }

  async function connect() {
    if (mode === "closed" || hidden()) return;
    stopStream();
    const stream = new AbortController();
    controller = stream;
    if (!polling) setMode("connecting");
    armWatchdog(stream);
    const opened = Date.now();
    let bye: string | null = null;
    try {
      const response = await send(`/api/v1${options.path}`, {
        signal: stream.signal,
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${options.token}`,
        },
      });
      if (stream !== controller) return;
      if (!response.ok || !response.body) {
        // Refused (signed out, no access, the server full or stopping):
        // the plain read says why, in the screen's own way.
        console.warn("AMP: the live stream was refused; polling instead", {
          path: options.path,
          status: response.status,
        });
        await response.body?.cancel();
        clearTimeout(watchdog);
        controller = null;
        startPolling();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new EventStreamParser((event, data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error("AMP: a live message wasn’t readable", {
            path: options.path,
            event,
            error,
          });
          return;
        }
        if (event === "bye")
          bye = String((parsed as { reason?: unknown })?.reason ?? "");
        options.onEvent(event, parsed);
      });
      let first = true;
      for (;;) {
        const { value, done } = await reader.read();
        if (stream !== controller) return;
        if (isRetired(options.token)) {
          close();
          return;
        }
        if (done) break;
        if (first) {
          first = false;
          // A stream that delivers ends the fallback.
          stopPolling();
          clearTimeout(retry);
          setMode("streaming");
        }
        armWatchdog(stream);
        parser.push(decoder.decode(value, { stream: true }));
      }
      // The server ended it: normally on purpose (`bye`), so reconnect now.
      clearTimeout(watchdog);
      controller = null;
      if (bye === null && Date.now() - opened < timing.minLifeMs) {
        failed("ended early");
        return;
      }
      failures = 0;
      // A stopping server's clients spread out over a second.
      reconnect = setTimeout(
        () => void connect(),
        bye === "shutdown" ? Math.floor(Math.random() * 1_000) : 0,
      );
    } catch (error) {
      if (stream.signal.aborted || mode === "closed") return;
      clearTimeout(watchdog);
      controller = null;
      if (isRetired(options.token)) {
        close();
        return;
      }
      console.warn("AMP: the live stream broke; reconnecting", {
        path: options.path,
        error,
      });
      failed(error);
    }
  }

  function onVisibility() {
    if (mode === "closed") return;
    if (hidden()) {
      const wasPolling = polling;
      stopStream();
      stopPolling();
      polling = wasPolling;
      setMode("paused");
      return;
    }
    failures = 0;
    if (polling) {
      polling = false;
      startPolling();
    } else void connect();
  }

  function close() {
    if (mode === "closed") return;
    stopStream();
    stopPolling();
    setMode("closed");
    doc.removeEventListener("visibilitychange", onVisibility);
  }

  doc.addEventListener("visibilitychange", onVisibility);
  if (hidden()) setMode("paused");
  else void connect();
  return {
    close,
    get mode() {
      return mode;
    },
  };
}
