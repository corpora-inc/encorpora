import { invoke } from "@tauri-apps/api/core";
import { nativeRuntime } from "./native-runtime";

type NativeRequest = {
  kind: string;
  learnerId?: string;
  bookId?: string;
  body?: unknown;
  capabilities?: string[];
};
function nativeRequest(path: string, body?: unknown): NativeRequest {
  if (path === "/family" && body === undefined) return { kind: "family" };
  if (path === "/learners" && body === undefined) return { kind: "learners" };
  const url = new URL(path, "https://native.invalid");
  const match =
    /^\/learners\/([0-9a-f-]{36})\/(progress|starting-point|batches|attempts|hints|lesson-support|books)(?:\/([a-z0-9-]+)\/open)?$/.exec(
      url.pathname,
    );
  if (!match)
    throw new Error("This action requires the configured web application.");
  const [, learnerId, action, bookId] = match;
  if (action === "books" && bookId && body !== undefined)
    return { kind: "open-book", learnerId, bookId, body };
  if (action === "books" && !bookId && body === undefined)
    return {
      kind: "books",
      learnerId,
      capabilities: (url.searchParams.get("readerCapabilities") ?? "")
        .split(",")
        .filter(Boolean),
    };
  if (action === "progress" && body === undefined)
    return { kind: "progress", learnerId };
  if (action === "starting-point")
    return body === undefined
      ? { kind: "starting-point", learnerId }
      : { kind: "set-starting-point", learnerId, body };
  const kinds: Record<string, string> = {
    batches: "batch",
    attempts: "attempt",
    hints: "hint",
    "lesson-support": "lesson-support",
  };
  if (kinds[action] && body !== undefined)
    return { kind: kinds[action], learnerId, body };
  throw new Error("This action is unavailable in the native app.");
}
export async function learningRequest(
  path: string,
  token: string | null,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  if (!nativeRuntime)
    return fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  if (!token) throw new Error("Please sign in to continue.");
  try {
    const response = await invoke<{ status: number; data: unknown }>(
      "native_learning_request",
      { handle: token, request: nativeRequest(path, body) },
    );
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.data,
    };
  } catch (error) {
    if (error === "sign-in-required")
      throw new Error(
        "Your native session has expired. Sign out and sign in again.",
      );
    if (error === "session-changed")
      throw new Error("Your account session changed.");
    throw new Error(
      "The learning service could not be reached. Please try again.",
    );
  }
}
export async function learningCatalog(): Promise<any> {
  if (nativeRuntime)
    return invoke("read_public_resource", { resource: "catalog" });
  const response = await fetch("/api/v1/catalog");
  if (!response.ok) throw new Error("The learning service is unavailable.");
  return response.json();
}
