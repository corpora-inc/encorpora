// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CancelledError,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logAhead } from "../ahead";
import { request } from "../api";
import { preloadLearningView, skillCatalogOptions } from "../learning-view";
import { queryClient, sessionOptions } from "../query";

vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  request: vi.fn(),
}));

/** A read that stays on its way until it is aborted, as a slow network's. */
const onItsWay = (signal: AbortSignal) =>
  new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(signal.reason)),
  );

let error: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
  vi.mocked(request).mockReset();
});

describe("logAhead", () => {
  it("logs a read that failed, as a warning unless told it is an error", () => {
    const failure = new Error("503");
    logAhead("Standings didn’t load ahead", failure);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Standings didn’t load ahead",
      failure,
    );
    logAhead("The map did not preload", failure, "error");
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "The map did not preload",
      failure,
    );
  });

  it("names what it was loading before the failure", () => {
    const failure = new Error("chunk");
    logAhead("A screen did not preload", failure, "error", "/pathways");
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "A screen did not preload",
      "/pathways",
      failure,
    );
  });

  it("says nothing about a read that was only cancelled", () => {
    logAhead("Standings didn’t load ahead", new CancelledError());
    logAhead("The map did not preload", new CancelledError(), "error");
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("says nothing when the reader of a read on its way leaves", async () => {
    // TanStack Query's own cancellation, not one made by hand: the only
    // observer of a read that took the abort signal unmounts.
    const client = new QueryClient();
    const options = {
      queryKey: ["slow"],
      queryFn: ({ signal }: { signal: AbortSignal }) => onItsWay(signal),
    };
    const ahead = client
      .ensureQueryData(options)
      .catch((failure: unknown) => logAhead("It didn’t load ahead", failure));
    const cancelled = client.ensureQueryData(options).catch((e: unknown) => e);
    new QueryObserver(client, options).subscribe(() => {})();
    await ahead;
    expect(await cancelled).toBeInstanceOf(CancelledError);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("a learning screen's preload", () => {
  // Signed out is enough: the preload then waits for the curriculum alone.
  beforeEach(() => queryClient.setQueryData(sessionOptions.queryKey, null));

  it("says nothing when the person moves on before the curriculum arrives", async () => {
    vi.mocked(request).mockImplementation((_path, _schema, options) =>
      onItsWay(options!.signal!),
    );
    const preload = preloadLearningView();
    const curriculum = queryClient
      .ensureQueryData(skillCatalogOptions)
      .catch((e: unknown) => e);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    // The screen reads the curriculum too, and is left before it arrives:
    // its observer unmounts and the read is cancelled.
    const leave = new QueryObserver(queryClient, skillCatalogOptions).subscribe(
      () => {},
    );
    leave();
    await preload;
    expect(await curriculum).toBeInstanceOf(CancelledError);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a curriculum that failed to arrive", async () => {
    const failure = new Error("502");
    vi.mocked(request).mockRejectedValue(failure);
    await preloadLearningView();
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "The curriculum did not preload",
      failure,
    );
  });
});

describe("every read ahead", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? entry.name === "__tests__"
          ? []
          : sources(join(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [join(dir, entry.name)]
          : [],
    );

  it("logs through logAhead, so a cancelled one says nothing", () => {
    const direct =
      /console\.(?:warn|error)\(\s*(["'`])(?:(?!\1).)*(?:(?:load|arrive) ahead|preload)/i;
    const own = join("src", "web", "lib", "ahead.ts");
    // The pitch's own reads ahead still log for themselves.
    const pitch = join("src", "web", "features", "pitch");
    expect(
      sources(join("src", "web")).filter(
        (file) =>
          file !== own &&
          !file.startsWith(pitch) &&
          direct.test(readFileSync(file, "utf8")),
      ),
    ).toEqual([]);
  });
});
