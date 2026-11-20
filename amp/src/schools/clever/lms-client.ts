import { z } from "zod";
import { cleverId } from "./model.js";
import {
  assignmentSchema,
  LmsError,
  lmsDistrictSchema,
  lmsErrorCode,
  lmsSectionSchema,
  submissionSchema,
  type CleverAssignment,
  type CleverSubmission,
  type LmsDistrict,
  type LmsSection,
} from "./lms-model.js";
import type { AssignmentBody, SubmissionBody } from "./lms-payloads.js";

/** LMS Connect exists only on API v3.1, whatever the roster version is. */
export const LMS_API = "/v3.1";
const ORIGIN = "https://api.clever.com";
/** Clever: grade-passback links are valid for two hours. Restart well before. */
const PAGE_LINK_LIFETIME_MS = 110 * 60_000;
/** Clever allows 1,200 requests a minute per bearer token. One pass of one
 * district stays well under it, and the next pass picks up the rest. */
export const DEFAULT_REQUEST_BUDGET = 600;
const assignmentId = z.string().regex(/^[A-Za-z0-9-]{1,100}$/);

type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type LmsClientOptions = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Clever recommends 15 to 60 seconds; writes can be slow. */
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
  budget?: number;
};

/**
 * The district-app token's LMS Connect calls. Make one instance per pass: its
 * request budget does not refill. Server-side only; tokens never
 * reach errors, logs or storage.
 *
 * Retries: a 429 is always retried after the reset Clever names (the request
 * was not processed). Reads, PATCH and DELETE are idempotent and retry network
 * failures and 5xx with 1, 2 and 4 second waits, except a PATCH that moves a
 * submission's state: Classroom refuses a repeated transition, so an outage
 * there is reported and the next pass rereads the submission. A POST that fails without an
 * answer may still have created the assignment, and Clever has no list
 * endpoint or idempotency key to check, so it is never retried here: the
 * caller records `lms_create_outcome_unknown` and a person decides.
 */
export class LmsClient {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private remaining: number;
  constructor(private readonly options: LmsClientOptions = {}) {
    this.fetcher = options.fetch ?? fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.remaining = options.budget ?? DEFAULT_REQUEST_BUDGET;
  }
  /** Requests left in this pass's budget. */
  get budget() {
    return this.remaining;
  }

  private async request(
    method: Method,
    path: string,
    token: string,
    body?: unknown,
    /** Safe to repeat after an outage. A POST never is; a PATCH that moves a
     * submission's state isn't either (Classroom refuses submitted→submitted). */
    repeatable = method !== "POST",
  ): Promise<unknown> {
    const url = new URL(path, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      !url.pathname.startsWith(`${LMS_API}/`) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new LmsError("lms_invalid_response");
    const create = method === "POST";
    for (let attempt = 0; ; attempt++) {
      if (this.remaining <= 0) throw new LmsError("lms_budget_exhausted");
      this.remaining--;
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/json",
            ...(body === undefined
              ? {}
              : { "content-type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: "error",
          signal: AbortSignal.timeout(
            method === "GET"
              ? (this.options.readTimeoutMs ?? 30_000)
              : (this.options.writeTimeoutMs ?? 60_000),
          ),
        });
      } catch {
        if (create) throw new LmsError("lms_create_outcome_unknown");
        if (!repeatable || attempt >= 3)
          throw new LmsError("lms_network_failed");
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }
      if (response.ok) {
        // A 2xx to a create means it exists, readable answer or not.
        const unreadable = create
          ? "lms_create_outcome_unknown"
          : "lms_invalid_response";
        let text: string;
        try {
          text = await response.text();
        } catch {
          throw new LmsError(unreadable, response.status);
        }
        if (!text.trim()) return null;
        try {
          return JSON.parse(text);
        } catch {
          throw new LmsError(unreadable, response.status);
        }
      }
      const message = await safeMessage(response);
      const code = lmsErrorCode(response.status, message);
      if (response.status === 429 && attempt < 3) {
        await this.sleep(this.resetDelay(response, attempt));
        continue;
      }
      // Any 5xx to a create may have created it, whatever the body says.
      if (create && response.status >= 500)
        throw new LmsError("lms_create_outcome_unknown", response.status);
      if (response.status >= 500 && code === "lms_unavailable") {
        if (repeatable && attempt < 3) {
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }
      }
      throw new LmsError(code, response.status);
    }
  }
  private resetDelay(response: Response, attempt: number) {
    const header = (name: string) => {
      const value = response.headers.get(name);
      return value === null || !value.trim() ? NaN : Number(value);
    };
    const retry = header("retry-after");
    if (Number.isFinite(retry) && retry >= 0)
      return Math.min(60_000, retry * 1000);
    // Clever documents X-RateLimit-Reset, a Unix time in seconds.
    const reset = header("x-ratelimit-reset");
    if (Number.isFinite(reset) && reset > 0)
      return Math.min(60_000, Math.max(0, reset * 1000 - this.now()));
    return 1000 * 2 ** attempt;
  }
  private async data<T>(
    method: Method,
    path: string,
    token: string,
    schema: z.ZodType<T>,
    body?: unknown,
    repeatable?: boolean,
  ): Promise<T> {
    const parsed = z
      .object({ data: schema })
      .safeParse(await this.request(method, path, token, body, repeatable));
    if (!parsed.success)
      throw new LmsError(
        method === "POST"
          ? "lms_create_outcome_unknown"
          : "lms_invalid_response",
      );
    return parsed.data.data;
  }
  private assignmentPath(section: string, assignment?: string) {
    cleverId.parse(section);
    const base = `${LMS_API}/sections/${section}/assignments`;
    return assignment === undefined
      ? base
      : `${base}/${assignmentId.parse(assignment)}`;
  }

  /** `lms_state` and `lms_type`. A district without these fields enabled for
   * the app reads as null: "unknown", never "connected". */
  district(token: string, id: string): Promise<LmsDistrict> {
    return this.data(
      "GET",
      `${LMS_API}/districts/${cleverId.parse(id)}`,
      token,
      lmsDistrictSchema,
    );
  }
  section(token: string, id: string): Promise<LmsSection> {
    return this.data(
      "GET",
      `${LMS_API}/sections/${cleverId.parse(id)}`,
      token,
      lmsSectionSchema,
    );
  }
  /** Every shared section with its LMS sync status (for the probe). */
  async sections(token: string): Promise<LmsSection[]> {
    const rows: LmsSection[] = [];
    const seen = new Set<string>();
    let next: string | undefined = `${LMS_API}/sections?limit=1000`;
    while (next) {
      if (seen.has(next) || seen.size >= 10_000)
        throw new LmsError("lms_invalid_response");
      seen.add(next);
      const page = z
        .object({
          data: z.array(z.object({ data: lmsSectionSchema })),
          links: z
            .array(z.object({ rel: z.string(), uri: z.string() }))
            .optional(),
        })
        .safeParse(await this.request("GET", next, token));
      if (!page.success) throw new LmsError("lms_invalid_response");
      rows.push(...page.data.data.map((row) => row.data));
      next = page.data.links?.find((link) => link.rel === "next")?.uri;
      if (next && !next.startsWith(`${LMS_API}/sections?`))
        throw new LmsError("lms_invalid_response");
    }
    return rows;
  }
  /** The created assignment. Any answer AMP can't use (unreadable, or an ID
   * it couldn't address later) is `lms_create_outcome_unknown`: it exists. */
  async createAssignment(
    token: string,
    section: string,
    body: AssignmentBody,
  ): Promise<CleverAssignment> {
    const created = await this.data(
      "POST",
      this.assignmentPath(section),
      token,
      assignmentSchema,
      body,
    );
    if (!assignmentId.safeParse(created.id).success)
      throw new LmsError("lms_create_outcome_unknown");
    return created;
  }
  getAssignment(
    token: string,
    section: string,
    assignment: string,
  ): Promise<CleverAssignment> {
    return this.data(
      "GET",
      this.assignmentPath(section, assignment),
      token,
      assignmentSchema,
    );
  }
  updateAssignment(
    token: string,
    section: string,
    assignment: string,
    body: Partial<AssignmentBody>,
  ): Promise<CleverAssignment> {
    return this.data(
      "PATCH",
      this.assignmentPath(section, assignment),
      token,
      assignmentSchema,
      body,
    );
  }
  /** "deleted", or "missing" when the LMS no longer has it (a teacher deleted
   * it there): either way it is gone. */
  async deleteAssignment(
    token: string,
    section: string,
    assignment: string,
  ): Promise<"deleted" | "missing"> {
    try {
      await this.request(
        "DELETE",
        this.assignmentPath(section, assignment),
        token,
      );
      return "deleted";
    } catch (error) {
      if (
        error instanceof LmsError &&
        error.lmsCode === "lms_assignment_missing"
      )
        return "missing";
      throw error;
    }
  }
  /** Every submission, following `next` links; there is no `previous`. */
  async submissions(
    token: string,
    section: string,
    assignment: string,
  ): Promise<CleverSubmission[]> {
    const base = `${this.assignmentPath(section, assignment)}/submissions`;
    const started = this.now();
    const rows: CleverSubmission[] = [];
    const seen = new Set<string>();
    let next: string | undefined = `${base}?limit=100`;
    while (next) {
      if (this.now() - started > PAGE_LINK_LIFETIME_MS)
        throw new LmsError("lms_pagination_expired");
      if (seen.has(next) || seen.size >= 10_000)
        throw new LmsError("lms_invalid_response");
      seen.add(next);
      const page = z
        .object({
          data: z.array(submissionSchema),
          links: z
            .array(z.object({ rel: z.string(), uri: z.string() }))
            .nullable()
            .optional(),
        })
        .safeParse(await this.request("GET", next, token));
      if (!page.success) throw new LmsError("lms_invalid_response");
      rows.push(...page.data.data);
      next = page.data.links?.find((link) => link.rel === "next")?.uri;
      if (next && !next.startsWith(`${base}?`) && next !== base)
        throw new LmsError("lms_invalid_response");
    }
    return rows;
  }
  submission(
    token: string,
    section: string,
    assignment: string,
    user: string,
  ): Promise<CleverSubmission> {
    return this.data(
      "GET",
      `${this.assignmentPath(section, assignment)}/submissions/${cleverId.parse(user)}`,
      token,
      submissionSchema,
    );
  }
  updateSubmission(
    token: string,
    section: string,
    assignment: string,
    user: string,
    body: SubmissionBody,
  ): Promise<CleverSubmission> {
    return this.data(
      "PATCH",
      `${this.assignmentPath(section, assignment)}/submissions/${cleverId.parse(user)}`,
      token,
      submissionSchema,
      body,
      body.state === undefined,
    );
  }
}

/** Clever's `{message}`, bounded, for classification only. */
async function safeMessage(response: Response): Promise<string> {
  try {
    const text = (await response.text()).slice(0, 2000);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { message?: unknown }).message === "string"
      )
        return (parsed as { message: string }).message;
    } catch {
      /* Clever's documented bodies are sometimes not JSON. */
    }
    return text;
  } catch {
    return "";
  }
}
