import { PassThrough } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";
import { STREAM_EVENTS } from "./stream-contracts.js";

/* One server-sent-events response (#2465, L2): plain `text/event-stream`
   frames over a streamed reply, never a hijacked socket, so the app's
   headers and hooks still apply. A stream holds no database connection; it
   only writes what the hub hands it. It ends itself before the load
   balancer's 120 s cut, says why (`bye`), and pings so a client can tell a
   quiet class from a buffering filter. */

export type StreamEndReason = "rotate" | "shutdown" | "slow";

/** What the hub writes to. */
export interface EventSink {
  readonly open: boolean;
  send(event: string, data: unknown): void;
  /** Ends the stream on purpose, telling the client why. */
  end(reason: StreamEndReason): void;
}

export type StreamTiming = {
  /** A `: ping` comment this often, so a client's watchdog sees bytes. */
  pingMs: number;
  /** How long this stream lives: 85–95 s by default (`streamLifetimeMs`). */
  lifetimeMs: () => number;
  /** A client this far behind isn't reading (a filter holding the stream):
   * end it rather than buffer more. */
  maxBufferedBytes: number;
};

/** 85–95 s, jittered so a class's streams don't all reconnect at once, and
 * under the load balancer's 120 s cut. */
export const streamLifetimeMs = (random: () => number = Math.random) =>
  85_000 + Math.floor(random() * 10_001);

export const DEFAULT_STREAM_TIMING: StreamTiming = {
  pingMs: 15_000,
  lifetimeMs: () => streamLifetimeMs(),
  maxBufferedBytes: 1 << 20,
};

/** One frame. JSON never holds a raw newline, so the data is one line. */
export const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Starts the event stream on `reply` and returns its sink. `onClose` runs
 * once, however the stream ends: the server ended it, or the client left. */
export function openEventStream(
  request: FastifyRequest,
  reply: FastifyReply,
  timing: StreamTiming,
  onClose: () => void,
): EventSink {
  const body = new PassThrough();
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    clearInterval(ping);
    clearTimeout(lifetime);
    onClose();
  };
  const write = (text: string) => {
    if (!open) return;
    if (body.writableLength > timing.maxBufferedBytes) {
      request.log.warn(
        { buffered: body.writableLength, route: request.routeOptions.url },
        "live stream ended: the client isn't reading",
      );
      sink.end("slow");
      return;
    }
    body.write(text);
  };
  const sink: EventSink = {
    get open() {
      return open;
    },
    send: (event, data) => write(frame(event, data)),
    end(reason) {
      if (!open) return;
      body.write(frame(STREAM_EVENTS.bye, { reason }));
      body.end();
      close();
    },
  };
  const ping = setInterval(() => write(": ping\n\n"), timing.pingMs);
  const lifetime = setTimeout(() => sink.end("rotate"), timing.lifetimeMs());
  ping.unref();
  lifetime.unref();
  // The client left (a closed tab, a dropped network): nothing to say.
  reply.raw.on("close", close);
  body.on("error", (error) => {
    request.log.warn(
      { code: (error as { code?: unknown }).code },
      "live stream broke",
    );
    close();
  });
  reply
    .code(200)
    .header("Content-Type", "text/event-stream; charset=utf-8")
    // Tells any proxy that honours it (nginx) to pass frames as they come.
    .header("X-Accel-Buffering", "no")
    .send(body);
  // Bytes at once: the client's watchdog starts from here.
  body.write(": open\n\n");
  return sink;
}
