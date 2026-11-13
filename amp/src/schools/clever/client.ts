import { z } from "zod";
import {
  cleverId,
  CleverSyncError,
  districtSchema,
  schoolSchema,
  userSchema,
  sectionSchema,
  courseSchema,
  termSchema,
  type Snapshot,
} from "./model.js";

const links = z
  .array(z.object({ rel: z.string(), uri: z.string() }))
  .optional();
export const eventSchema = z.object({
  id: cleverId,
  type: z.string(),
  created: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
export type CleverEvent = z.infer<typeof eventSchema>;
export class CleverHttpError extends CleverSyncError {
  constructor(readonly status: number) {
    super(`clever_http_${status}`);
  }
}
type Options = {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

/** Server-side only. Credentials never appear in errors, URLs or persisted data. */
export class CleverClient {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly options: Options) {
    if (!options.clientId || !options.clientSecret)
      throw new CleverSyncError("clever_credentials_missing");
    this.fetcher = options.fetch ?? fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }
  private async request(url: URL, authorization: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: { authorization, accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
        });
      } catch {
        if (attempt === 3) throw new CleverSyncError("clever_network_failed");
        await this.sleep(250 * 2 ** attempt);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const retry = response.headers.get("retry-after");
        const seconds = retry ? Number(retry) : NaN;
        const delay = Number.isFinite(seconds)
          ? seconds * 1000
          : 500 * 2 ** attempt;
        await response.body?.cancel();
        await this.sleep(Math.min(30_000, Math.max(0, delay)));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new CleverHttpError(response.status);
      }
      try {
        return await response.json();
      } catch {
        throw new CleverSyncError("clever_invalid_json");
      }
    }
    throw new CleverSyncError("clever_network_failed");
  }
  private apiUrl(path: string): URL {
    const url = new URL(path, "https://api.clever.com");
    if (
      url.origin !== "https://api.clever.com" ||
      !url.pathname.startsWith("/v3.1/") ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new CleverSyncError("clever_unsafe_pagination_link");
    return url;
  }
  async get<T>(path: string, token: string, schema: z.ZodType<T>): Promise<T> {
    const response = z
      .object({ data: schema })
      .parse(await this.request(this.apiUrl(path), `Bearer ${token}`));
    return response.data;
  }
  async list<T>(
    path: string,
    token: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const result: T[] = [];
    const seen = new Set<string>();
    let next: string | undefined = path;
    while (next) {
      const url = this.apiUrl(next);
      if (seen.has(url.href) || seen.size >= 10_000)
        throw new CleverSyncError("clever_pagination_loop");
      seen.add(url.href);
      const page = z
        .object({ data: z.array(z.object({ data: schema })), links })
        .parse(await this.request(url, `Bearer ${token}`));
      result.push(...page.data.map((row) => row.data));
      next = page.links?.find((link) => link.rel === "next")?.uri;
    }
    return result;
  }
  async districtToken(districtId: string): Promise<string> {
    cleverId.parse(districtId);
    const url = new URL("https://clever.com/oauth/tokens");
    url.searchParams.set("district", districtId);
    const auth = Buffer.from(
      `${this.options.clientId}:${this.options.clientSecret}`,
    ).toString("base64");
    const token = z.object({
      access_token: z.string().min(1).optional(),
      access_code: z.string().min(1).optional(),
      owner: z.object({ id: cleverId, type: z.literal("district") }).optional(),
      district: cleverId.optional(),
    });
    const response = z
      .object({ data: z.array(token) })
      .parse(await this.request(url, `Basic ${auth}`));
    if (!response.data.length)
      throw new CleverSyncError("district_not_authorized");
    if (response.data.length !== 1)
      throw new CleverSyncError("district_token_ambiguous");
    const found = response.data[0];
    if (
      (found.owner && found.owner.id !== districtId) ||
      (found.district && found.district !== districtId)
    )
      throw new CleverSyncError("district_token_mismatch");
    const value = found.access_token ?? found.access_code;
    if (!value) throw new CleverSyncError("district_token_missing");
    return value;
  }
  async snapshot(districtId: string, token: string): Promise<Snapshot> {
    const district = await this.get(
      `/v3.1/districts/${districtId}`,
      token,
      districtSchema,
    );
    // Even optional collections must complete successfully. Forbidden and failed
    // responses are not empty collections and must not archive existing data.
    const schools = await this.list(
      "/v3.1/schools?limit=1000",
      token,
      schoolSchema,
    );
    const users = await this.list("/v3.1/users?limit=1000", token, userSchema);
    const courses = await this.list(
      "/v3.1/courses?limit=1000",
      token,
      courseSchema,
    );
    const terms = await this.list("/v3.1/terms?limit=1000", token, termSchema);
    const sections = await this.list(
      "/v3.1/sections?limit=1000",
      token,
      sectionSchema,
    );
    return { district, schools, users, courses, terms, sections };
  }
  async latestEvent(token: string): Promise<string | null> {
    const events = await this.list(
      "/v3.1/events?ending_before=last&limit=1",
      token,
      eventSchema,
    );
    return events.at(-1)?.id ?? null;
  }
  async events(token: string, after: string): Promise<CleverEvent[]> {
    cleverId.parse(after);
    return this.list(
      `/v3.1/events?starting_after=${after}&limit=1000`,
      token,
      eventSchema,
    );
  }
}
