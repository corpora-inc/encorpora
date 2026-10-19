import type { z } from "zod";
import { AppError } from "./AppError";
const messages: Record<string, string> = {
  consent_required: "Continue setup to review parent consent.",
  parental_consent_required: "Continue setup to review parent consent.",
  license_required: "Choose a plan for this learner before practicing.",
  sign_in_required: "Your session ended. Sign in again to continue.",
  invalid_family_request: "Check the learner details and try again.",
  family_service_unavailable: "Family details could not be loaded. Try again.",
};
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
    method?: string;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      signal: options.signal,
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    const error = new AppError(
      "network",
      "Check your connection and try again.",
      true,
    );
    error.log();
    throw error;
  }
  const requestId = response.headers.get("x-request-id");
  const data: unknown = await response.json().catch(() => null);
  options.signal?.throwIfAborted();
  if (!response.ok) {
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "";
    const kind =
      response.status === 401
        ? "authentication"
        : response.status === 403
          ? "permission"
          : response.status < 500
            ? "validation"
            : "unavailable";
    const error = new AppError(
      kind,
      messages[code] ??
        (response.status >= 500
          ? "This service is temporarily unavailable. Try again."
          : "This request could not be completed. Check the details and try again."),
      response.status >= 500,
      requestId,
    );
    error.log();
    throw error;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const error = new AppError(
      "contract",
      "The service returned incomplete information. Try again.",
      true,
      requestId,
    );
    error.log();
    throw error;
  }
  options.signal?.throwIfAborted();
  return parsed.data;
}
