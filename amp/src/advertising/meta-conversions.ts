import { createHash } from "node:crypto";
import { z } from "zod";
import { metaClickIdentifiersSchema } from "./click-identifiers.js";

import { META_ENROLLMENT_CONFIRMATION_URL } from "./meta-context-contracts.js";
import { META_PURCHASE_MEASUREMENT_NOTICE } from "./permission-contracts.js";

const origin = "https://graph.facebook.com/v26.0/";
export const META_PURCHASE_PERMISSION_VERSION =
  META_PURCHASE_MEASUREMENT_NOTICE.version;
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  );
export const metaDestinationSchema = z.strictObject({
  enabled: z.boolean().default(false),
  datasetId: z.string().regex(/^[1-9]\d{4,29}$/),
});
export type MetaDestination = z.input<typeof metaDestinationSchema>;
const sourceSchema = z.discriminatedUnion("actionSource", [
  z.strictObject({
    actionSource: z.literal("website"),
    // Fixed adult purchase pages only. No return tokens, queries or learner URLs.
    // A dispatcher must establish that the event actually occurred on this page.
    eventSourceUrl: z.enum([
      META_ENROLLMENT_CONFIRMATION_URL,
      "https://amp.corpora.inc/purchase/annual",
      "https://amp.corpora.inc/purchase/funded",
      "https://amp.corpora.inc/purchase/arkansas-efa",
    ]),
    clientUserAgent: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[\x20-\x7e]+$/),
  }),
  z.strictObject({
    actionSource: z.enum(["email", "phone_call", "chat", "other"]),
  }),
]);
/** Evidence assertions, not a permission grant or payment verification. The
 * dispatcher must derive these from current server-owned records under lock.
 * A Google permission grant does not authorize this payload.
 */
export const metaMatchingIdentifiersSchema = z
  .strictObject({
    fbc: metaClickIdentifiersSchema.shape.fbc,
    fbp: metaClickIdentifiersSchema.shape.fbp,
  })
  .refine((v) => !!(v.fbc || v.fbp));
const purchaseSchema = z.strictObject({
  eventId: z.string().regex(/^amp_meta_[a-f0-9]{64}$/),
  occurredAt: instant,
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.literal("USD"),
  adultEmailSha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: sourceSchema,
  clickIdentifiers: metaMatchingIdentifiersSchema.optional(),
  permission: z.strictObject({
    noticeVersion: z.literal(META_PURCHASE_PERMISSION_VERSION),
    adultAttested: z.literal(true),
    purpose: z.literal("measurement-and-ad-delivery"),
    grantedAt: instant,
    expiresAt: instant,
  }),
});
export type MetaPurchase = z.infer<typeof purchaseSchema>;
const modeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("preview") }),
  z.strictObject({ kind: z.literal("live") }),
  z.strictObject({
    kind: z.literal("test"),
    testEventCode: z.string().regex(/^TEST[0-9A-Za-z]{1,60}$/),
  }),
]);
export type MetaDeliveryMode = z.infer<typeof modeSchema>;
export class MetaConversionError extends Error {
  constructor(
    readonly code: string,
    readonly outcome: "not_sent" | "rejected" | "unknown",
    readonly status?: number,
  ) {
    super(`Meta purchase measurement: ${code}`);
    this.name = "MetaConversionError";
  }
}
function parse<T>(schema: z.ZodType<T>, input: unknown, code: string): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new MetaConversionError(code, "not_sent");
  return result.data;
}
/** Meta normalization is trim + lowercase. Preserve dots and plus tags;
 * Google's Gmail-specific normalization must not be reused here. */
export function metaAdultEmailHash(email: string): string {
  if (typeof email !== "string")
    throw new MetaConversionError("invalid_email", "not_sent");
  const normalized = email.trim().toLowerCase();
  if (!z.email().safeParse(normalized).success)
    throw new MetaConversionError("invalid_email", "not_sent");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
/** Pure builder. Contains personal data, including a linkable email hash;
 * do not log the return value. Test mode also discloses it to Meta. */
export function metaPurchaseRequest(
  input: MetaPurchase,
  mode: MetaDeliveryMode,
  now = new Date(),
) {
  const purchase = parse(purchaseSchema, input, "invalid_purchase");
  const checkedMode = parse(modeSchema, mode, "invalid_mode");
  const occurred = Date.parse(purchase.occurredAt);
  const granted = Date.parse(purchase.permission.grantedAt);
  const expires = Date.parse(purchase.permission.expiresAt);
  if (!Number.isFinite(+now))
    throw new MetaConversionError("invalid_clock", "not_sent");
  // Check the transmitted second: flooring must not move a timestamp outside
  // the provider's seven-day window.
  const eventTime = Math.floor(occurred / 1000);
  if (occurred > +now || eventTime * 1000 < +now - 7 * 86400000)
    throw new MetaConversionError("event_outside_delivery_window", "not_sent");
  if (granted > occurred || expires <= +now || expires <= granted)
    throw new MetaConversionError("permission_not_current", "not_sent");
  const source = purchase.source;
  return {
    data: [
      {
        event_name: "Purchase" as const,
        event_time: eventTime,
        event_id: purchase.eventId,
        action_source: source.actionSource,
        ...(source.actionSource === "website"
          ? { event_source_url: source.eventSourceUrl }
          : {}),
        user_data: {
          em: [purchase.adultEmailSha256],
          ...purchase.clickIdentifiers,
          ...(source.actionSource === "website"
            ? { client_user_agent: source.clientUserAgent }
            : {}),
        },
        custom_data: {
          value: purchase.amountMinor / 100,
          currency: purchase.currency,
        },
      },
    ],
    ...(checkedMode.kind === "test"
      ? { test_event_code: checkedMode.testEventCode }
      : {}),
  };
}
export interface MetaPurchasePreview {
  kind: "preview";
  submitted: false;
  eventName: "Purchase";
  actionSource: MetaPurchase["source"]["actionSource"];
  amountMinor: number;
  currency: "USD";
  includesBrowserContext: boolean;
}
export interface MetaPurchaseReceipt {
  kind: "accepted";
  mode: "live" | "test";
  destinationFingerprint: string;
  eventsReceived: 1;
  messageCount: number;
  traceId: string | null;
}
async function bounded<T>(
  work: (signal: AbortSignal) => Promise<T>,
  milliseconds = 10_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function responseJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing_body");
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  if (signal.aborted) {
    cancel();
    throw new Error("aborted");
  }
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error("response_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
  }
}
const receiptSchema = z.strictObject({
  events_received: z.literal(1),
  messages: z.array(z.string().max(4096)).max(1000).default([]),
  fbtrace_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,200}$/)
    .optional(),
  id: z
    .string()
    .regex(/^[1-9]\d{4,29}$/)
    .optional(),
  num_processed_entries: z.literal(1).optional(),
});
/** Transport only: no route, collector, scheduler, credentials file or retries.
 * Defaults to a local redacted preview. enabled:true and explicit test/live
 * mode are required to send. Durable dispatch owns uncertain outcomes;
 * acceptance never proves matching, attribution or net revenue.
 */
export class MetaConversions {
  private readonly config: z.output<typeof metaDestinationSchema>;
  readonly destinationFingerprint: string;
  constructor(
    config: MetaDestination,
    private readonly accessToken: () => Promise<string>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.config = parse(metaDestinationSchema, config, "invalid_destination");
    this.destinationFingerprint = createHash("sha256")
      .update(`meta:${this.config.datasetId}`)
      .digest("hex");
  }
  async purchase(
    input: MetaPurchase,
    mode: MetaDeliveryMode = { kind: "preview" },
  ): Promise<MetaPurchasePreview | MetaPurchaseReceipt> {
    const checkedMode = parse(modeSchema, mode, "invalid_mode");
    if (checkedMode.kind !== "preview" && !this.config.enabled)
      throw new MetaConversionError("delivery_disabled", "not_sent");
    const snapshot = parse(purchaseSchema, input, "invalid_purchase");
    const body = metaPurchaseRequest(snapshot, checkedMode, this.clock());
    if (checkedMode.kind === "preview")
      return {
        kind: "preview",
        submitted: false,
        eventName: "Purchase",
        actionSource: body.data[0]!.action_source,
        amountMinor: snapshot.amountMinor,
        currency: "USD",
        includesBrowserContext: body.data[0]!.action_source === "website",
      };
    let token: string;
    try {
      token = await bounded(() => this.accessToken());
      if (
        typeof token !== "string" ||
        !/^[A-Za-z0-9._~+/=-]{1,8192}$/.test(token)
      )
        throw new Error();
    } catch {
      throw new MetaConversionError("credentials_unavailable", "not_sent");
    }
    // Credentials may be slow. Never send an expired permission/event.
    metaPurchaseRequest(snapshot, checkedMode, this.clock());
    let raw: unknown;
    try {
      raw = await bounded(async (signal) => {
        const response = await this.fetcher(
          `${origin}${this.config.datasetId}/events`,
          {
            method: "POST",
            redirect: "error",
            credentials: "omit",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
            signal,
          },
        );
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw new MetaConversionError(
            "provider_rejected",
            response.status >= 500 ||
              response.status === 408 ||
              response.status === 429
              ? "unknown"
              : "rejected",
            response.status,
          );
        }
        return responseJson(response, signal);
      });
    } catch (error) {
      if (error instanceof MetaConversionError) throw error;
      throw new MetaConversionError("transport_or_response_failed", "unknown");
    }
    const result = receiptSchema.safeParse(raw);
    if (
      !result.success ||
      (result.data.id && result.data.id !== this.config.datasetId)
    )
      throw new MetaConversionError("invalid_provider_response", "unknown");
    return {
      kind: "accepted",
      mode: checkedMode.kind,
      destinationFingerprint: this.destinationFingerprint,
      eventsReceived: 1,
      messageCount: result.data.messages.length,
      traceId: result.data.fbtrace_id ?? null,
    };
  }
}
