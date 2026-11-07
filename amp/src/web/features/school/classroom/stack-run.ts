import { create } from "zustand";
import {
  stackWorkbookResource,
  type StackWorkbookInput,
} from "../../../../schools/classroom-contracts";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";
import { signedOut } from "../../../lib/app-recovery";
import { say } from "./api";
import type { MergeRequest, MergeResponse } from "./merge-worker";

/** One click prints a different workbook for each student. The browser does the
 * work: two students at a time, each workbook made with a fixed number so a retry
 * finds the same one, then one merged file in a worker. Nothing is stored on the
 * server, so a run lives here and survives moving between screens. */
export const STACK_CONCURRENCY = 2;
/** A file a school printer and a browser tab can both handle. */
export const STACK_FILE_SIZE = 40;
const MAX_TRIES = 5;

export type TileState =
  "waiting" | "making" | "retrying" | "ready" | "failed" | "seat";
export type Tile = { state: TileState; problems?: number; message?: string };
export type StackFile = {
  url: string;
  name: string;
  /** Position among the students, 1-based, for a stack in several files. */
  first: number;
  last: number;
  pages: number;
};
export type RunStatus = "running" | "merging" | "paused" | "done";
export type StackRun = {
  key: string;
  classId: string;
  /** In print order. */
  students: string[];
  input: StackWorkbookInput;
  status: RunStatus;
  tiles: Record<string, Tile>;
  files: StackFile[];
  /** Why it paused: a stop, or what went wrong. */
  note: string | null;
  stopped: boolean;
};
type Store = {
  runs: Record<string, StackRun>;
  patch: (classId: string, change: Partial<StackRun>) => void;
  tile: (classId: string, student: string, tile: Tile) => void;
};
const useRuns = create<Store>((set) => ({
  runs: {},
  patch: (classId, change) =>
    set((store) =>
      store.runs[classId]
        ? {
            runs: {
              ...store.runs,
              [classId]: { ...store.runs[classId]!, ...change },
            },
          }
        : store,
    ),
  tile: (classId, student, tile) =>
    set((store) => {
      const run = store.runs[classId];
      if (!run) return store;
      return {
        runs: {
          ...store.runs,
          [classId]: { ...run, tiles: { ...run.tiles, [student]: tile } },
        },
      };
    }),
}));
export const useStackRun = (classId: string) =>
  useRuns((store) => store.runs[classId]);
const current = (classId: string) => useRuns.getState().runs[classId];

/** The finished workbooks, held here until they're merged. */
const buffers = new Map<string, Map<string, ArrayBuffer>>();
const aborts = new Map<string, AbortController>();

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
const retryable = (error: unknown) =>
  error instanceof AppError &&
  (error.kind === "network" || error.status === 503 || error.status === 429);
/** A busy print service gets time to catch up, and the grid stays calm. */
async function withRetry<T>(
  signal: AbortSignal,
  onRetry: () => void,
  attempt: () => Promise<T>,
): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (signal.aborted || tries >= MAX_TRIES || !retryable(error))
        throw error;
      console.warn("Workbook stack: trying again", {
        status: error instanceof AppError ? error.status : null,
        tries,
      });
      onRetry();
      const after = (error as { retryAfter?: number }).retryAfter ?? 0;
      await wait(Math.max(after * 1000, 1000 * 2 ** (tries - 1)), signal);
    }
  }
}

async function fetchPdf(
  session: AuthSession,
  path: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal,
    });
  } catch {
    throw new AppError("network", "Check your connection and try again.", true);
  }
  if (response.status === 401 && signedOut())
    return new Promise<never>(() => {});
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const code =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : null;
    const retryAfter = Number(response.headers.get("retry-after"));
    throw Object.assign(
      new AppError(
        response.status >= 500 ? "unavailable" : "validation",
        "This workbook didn’t print. Try again in a moment.",
        response.status >= 500,
        response.headers.get("x-request-id"),
        code,
        response.status,
      ),
      { retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0 },
    );
  }
  return response.arrayBuffer();
}

async function makeOne(
  run: StackRun,
  session: AuthSession,
  student: string,
  signal: AbortSignal,
) {
  const { classId, input } = run;
  const store = useRuns.getState();
  const made = buffers.get(run.key)?.get(student);
  if (made) return;
  const retrying = () => store.tile(classId, student, { state: "retrying" });
  store.tile(classId, student, { state: "making" });
  try {
    const workbook = await withRetry(signal, retrying, () =>
      request(
        `/school/classes/${classId}/students/${student}/workbooks`,
        stackWorkbookResource,
        { token: session.token, body: input, signal },
      ),
    );
    const format = input.paper === "a4" ? "A4" : "Letter";
    const pdf = await withRetry(signal, retrying, () =>
      fetchPdf(
        session,
        `/school/classes/${classId}/students/${student}/workbooks/${workbook.id}/pdf?format=${format}`,
        signal,
      ),
    );
    let files = buffers.get(run.key);
    if (!files) buffers.set(run.key, (files = new Map()));
    files.set(student, pdf);
    store.tile(classId, student, {
      state: "ready",
      problems: workbook.problems,
    });
  } catch (error) {
    if (signal.aborted) {
      store.tile(classId, student, { state: "waiting" });
      return;
    }
    if (error instanceof AppError) error.log();
    else console.error("Workbook stack failed", error);
    if (error instanceof AppError && error.code === "needs_seat")
      store.tile(classId, student, { state: "seat" });
    else
      store.tile(classId, student, {
        state: "failed",
        message: say(error, "A workbook didn’t print."),
      });
  }
}

function merge(
  files: ArrayBuffer[],
): Promise<{ bytes: Uint8Array; pages: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./merge-worker.ts", import.meta.url), {
      type: "module",
    });
    const done = () => worker.terminate();
    worker.addEventListener("message", (event: MessageEvent<MergeResponse>) => {
      done();
      if (event.data.ok)
        resolve({ bytes: event.data.bytes, pages: event.data.pages });
      else reject(new Error(event.data.message));
    });
    worker.addEventListener("error", (event) => {
      done();
      reject(new Error(event.message || "The merge worker didn't start"));
    });
    worker.postMessage({ files } satisfies MergeRequest);
  });
}

const fileName = (run: StackRun, part: number, parts: number) =>
  `amp-workbooks-${run.input.date}-${run.input.number}${parts > 1 ? `-part-${part}` : ""}.pdf`;

/** Joins what's ready, in class order, into files a printer can take. */
async function mergeRun(classId: string) {
  const run = current(classId);
  const ready = buffers.get(run?.key ?? "");
  if (!run || !ready) return;
  const store = useRuns.getState();
  store.patch(classId, { status: "merging" });
  try {
    const order = run.students.filter((id) => ready.has(id));
    const parts = Math.ceil(order.length / STACK_FILE_SIZE);
    const files: StackFile[] = [];
    for (let part = 0; part < parts; part++) {
      const slice = order.slice(
        part * STACK_FILE_SIZE,
        (part + 1) * STACK_FILE_SIZE,
      );
      const { bytes, pages } = await merge(slice.map((id) => ready.get(id)!));
      files.push({
        url: URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: "application/pdf" }),
        ),
        name: fileName(run, part + 1, parts),
        first: part * STACK_FILE_SIZE + 1,
        last: part * STACK_FILE_SIZE + slice.length,
        pages,
      });
    }
    buffers.delete(run.key);
    store.patch(classId, { status: "done", files, note: null });
    // Within the click's own moment a tab can open by itself. Later, the button
    // that says "Open" does it, rather than a browser's popup warning.
    const active = (
      navigator as Navigator & { userActivation?: { isActive: boolean } }
    ).userActivation?.isActive;
    if (active && files.length === 1) window.open(files[0]!.url, "_blank");
  } catch (error) {
    console.error("Workbook stack didn't merge", error);
    store.patch(classId, {
      status: "paused",
      note: "The finished workbooks didn’t join into one file. Try again.",
    });
  }
}

async function pump(classId: string, session: AuthSession) {
  const run = current(classId)!;
  const abort = new AbortController();
  aborts.set(classId, abort);
  const queue = run.students.filter((id) => {
    const state = run.tiles[id]?.state;
    return state !== "ready" && state !== "seat";
  });
  const worker = async () => {
    for (;;) {
      const next = queue.shift();
      if (!next || abort.signal.aborted) return;
      await makeOne(current(classId)!, session, next, abort.signal);
    }
  };
  await Promise.all(Array.from({ length: STACK_CONCURRENCY }, () => worker()));
  aborts.delete(classId);
  const after = current(classId)!;
  if (after.stopped) {
    useRuns.getState().patch(classId, { status: "paused", note: null });
    return;
  }
  const failed = Object.values(after.tiles).filter(
    (tile) => tile.state === "failed",
  );
  if (failed.length) {
    useRuns.getState().patch(classId, {
      status: "paused",
      note: failed[0]!.message ?? "Some workbooks didn’t finish.",
    });
    return;
  }
  await mergeRun(classId);
}

/** Starts this print, or picks up the same one where it stopped. */
export function startStack(
  session: AuthSession,
  classId: string,
  key: string,
  students: string[],
  input: StackWorkbookInput,
) {
  const previous = current(classId);
  if (previous && previous.key !== key) buffers.delete(previous.key);
  for (const file of previous?.files ?? []) URL.revokeObjectURL(file.url);
  const keep = previous?.key === key ? previous.tiles : {};
  const tiles: Record<string, Tile> = {};
  for (const id of students) {
    const kept = keep[id];
    tiles[id] =
      kept?.state === "ready" && buffers.get(key)?.has(id)
        ? kept
        : { state: "waiting" };
  }
  useRuns.setState((store) => ({
    runs: {
      ...store.runs,
      [classId]: {
        key,
        classId,
        students,
        input,
        status: "running",
        tiles,
        files: [],
        note: null,
        stopped: false,
      },
    },
  }));
  void pump(classId, session);
}

/** Finishes what's left of a paused print. */
export function resumeStack(session: AuthSession, classId: string) {
  const run = current(classId);
  if (!run) return;
  const ready = buffers.get(run.key);
  const tiles = { ...run.tiles };
  for (const id of run.students)
    if (tiles[id]?.state !== "seat" && !ready?.has(id))
      tiles[id] = { state: "waiting" };
  useRuns.getState().patch(classId, {
    status: "running",
    note: null,
    stopped: false,
    tiles,
  });
  void pump(classId, session);
}

export function stopStack(classId: string) {
  useRuns.getState().patch(classId, { stopped: true });
  aborts.get(classId)?.abort();
}

/** Lets go of a finished or abandoned print. */
export function clearStack(classId: string) {
  const run = current(classId);
  if (!run || run.status === "running" || run.status === "merging") return;
  for (const file of run.files) URL.revokeObjectURL(file.url);
  buffers.delete(run.key);
  useRuns.setState((store) => {
    const { [classId]: _gone, ...rest } = store.runs;
    return { runs: rest };
  });
}
