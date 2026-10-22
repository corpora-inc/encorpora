import { createHash } from "node:crypto";
import { z } from "zod";
import { googleClickIdentifiersSchema } from "./click-identifiers.js";

const origin = "https://datamanager.googleapis.com/v1/";
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  );
const accountId = z.string().regex(/^\d{10}$/);
const requestId = z.string().regex(/^[A-Za-z0-9._~:+/=-]{1,512}$/);
export const googleDestinationSchema = z.strictObject({
  conversionCustomerId: accountId,
  loginCustomerId: accountId.optional(),
  conversionActionId: z.string().regex(/^[1-9]\d{0,19}$/),
});
export type GoogleConversionDestination = z.infer<
  typeof googleDestinationSchema
>;
/** Logical conversion identity excludes the manager access path. Changing the
 * login manager must not allocate another transaction for the same action. */
export function googleConversionDestinationKey(
  config: GoogleConversionDestination,
) {
  const checked = parse(googleDestinationSchema, config, "invalid_destination");
  return createHash("sha256")
    .update(
      JSON.stringify([
        checked.conversionCustomerId,
        checked.conversionActionId,
      ]),
    )
    .digest("hex");
}

/** Internal transport input, never a browser or arbitrary event-upload endpoint.
 * The caller must derive this from a verified settlement and current permission.
 * These assertions describe that evidence; this module cannot establish it.
 */
const purchaseSchema = z.strictObject({
  transactionId: z.string().regex(/^amp_[a-f0-9]{64}$/),
  occurredAt: instant,
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.literal("USD"),
  matchingMode: z.enum(["click_only", "enhanced_email"]).optional(),
  adultEmailSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  adIdentifiers: googleClickIdentifiersSchema.optional(),
  eventSource: z.enum(["WEB", "OTHER"]).optional(),
  permission: z.strictObject({
    adultAttested: z.literal(true),
    adUserData: z.literal(true),
    adPersonalization: z.literal(false),
    grantedAt: instant,
    expiresAt: instant,
  }),
});
export type GooglePurchase = z.infer<typeof purchaseSchema>;

type Outcome = "not_sent" | "rejected" | "unknown";
/** Safe to log: never contains payloads, access tokens or provider diagnostics. */
export class GoogleConversionError extends Error {
  constructor(
    readonly code: string,
    readonly outcome: Outcome,
    readonly status?: number,
  ) {
    super(`Google purchase measurement: ${code}`);
    this.name = "GoogleConversionError";
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new GoogleConversionError(code, "not_sent");
  return result.data;
}
function destination(value: GoogleConversionDestination) {
  const config = parse(googleDestinationSchema, value, "invalid_destination");
  return {
    operatingAccount: {
      accountType: "GOOGLE_ADS",
      accountId: config.conversionCustomerId,
    },
    ...(config.loginCustomerId
      ? {
          loginAccount: {
            accountType: "GOOGLE_ADS",
            accountId: config.loginCustomerId,
          },
        }
      : {}),
    productDestinationId: config.conversionActionId,
  };
}

/** Call only with the confirmed adult purchaser's email, after permission.
 * Hashes are personal data, not anonymized data. Never log this input/output.
 */
export function googleAdultEmailHash(email: string): string {
  if (typeof email !== "string")
    throw new GoogleConversionError("invalid_email", "not_sent");
  const normalized = email.toLowerCase().replace(/\s/g, "");
  if (!z.email().safeParse(normalized).success)
    throw new GoogleConversionError("invalid_email", "not_sent");
  let [local, domain] = normalized.split("@");
  if (domain === "gmail.com" || domain === "googlemail.com")
    local = local!.split("+", 1)[0]!.replaceAll(".", "");
  if (!local) throw new GoogleConversionError("invalid_email", "not_sent");
  return createHash("sha256")
    .update(`${local}@${domain}`, "utf8")
    .digest("hex");
}

/** Constructs exactly one event and one destination; no session, device, URL,
 * account, learner, grade, assessment or free-text fields are permitted.
 * Validation-only requests also disclose identifiers to Google.
 */
export function googlePurchaseRequest(
  config: GoogleConversionDestination,
  input: GooglePurchase,
  mode: "validate" | "ingest" = "validate",
  now = new Date(),
) {
  return eventRequest(config, input, mode, now, false);
}

/** Same event identity and identifiers as an already processed purchase. Zero
 * restates value; it does not retract the conversion count. Caller proves the receipt. */
export function googleRestatementRequest(
  config: GoogleConversionDestination,
  input: GooglePurchase,
  mode: "validate" | "ingest" = "validate",
  now = new Date(),
) {
  return eventRequest(config, input, mode, now, true);
}
function eventRequest(
  config: GoogleConversionDestination,
  input: GooglePurchase,
  mode: "validate" | "ingest",
  now: Date,
  restatement: boolean,
) {
  const target = destination(config);
  const schema = restatement
    ? purchaseSchema.extend({
        amountMinor: z.number().int().nonnegative().max(100_000_000),
      })
    : purchaseSchema;
  const purchase = parse(schema, input, "invalid_purchase");
  if (!Number.isFinite(+now) || !["validate", "ingest"].includes(mode))
    throw new GoogleConversionError("invalid_request", "not_sent");
  if (
    purchase.matchingMode === "click_only"
      ? !purchase.adIdentifiers || purchase.adultEmailSha256 !== undefined
      : !purchase.adultEmailSha256
  )
    throw new GoogleConversionError("invalid_matching_identifiers", "not_sent");
  const eventAt = Date.parse(purchase.occurredAt);
  const grantedAt = Date.parse(purchase.permission.grantedAt);
  const expiresAt = Date.parse(purchase.permission.expiresAt);
  if (eventAt > +now || eventAt < +now - 90 * 86400000)
    throw new GoogleConversionError(
      "event_outside_delivery_window",
      "not_sent",
    );
  if (grantedAt > eventAt || expiresAt <= +now || expiresAt <= grantedAt)
    throw new GoogleConversionError("permission_not_current", "not_sent");
  return {
    destinations: [target],
    encoding: "HEX",
    events: [
      {
        transactionId: purchase.transactionId,
        eventTimestamp: purchase.occurredAt,
        eventSource: purchase.eventSource ?? "WEB",
        ...(purchase.adIdentifiers
          ? { adIdentifiers: purchase.adIdentifiers }
          : {}),
        conversionValue: purchase.amountMinor / 100,
        currency: purchase.currency,
        ...(purchase.adultEmailSha256
          ? {
              userData: {
                userIdentifiers: [{ emailAddress: purchase.adultEmailSha256 }],
              },
            }
          : {}),
        consent: {
          adUserData: "CONSENT_GRANTED",
          adPersonalization: "CONSENT_DENIED",
        },
      },
    ],
    validateOnly: mode === "validate",
  };
}

export interface GoogleIngestionReceipt {
  kind: "accepted";
  requestId: string;
  destinationFingerprint: string;
  submittedRecords: 1;
  fieldWarningCount: number;
}
export interface GoogleValidationReceipt {
  kind: "validated";
  fieldWarningCount: number;
}
const object = z.object({});
const reasonCount = z.object({
  reason: z.string().regex(/^[A-Z][A-Z0-9_]{0,159}$/),
  recordCount: z
    .string()
    .regex(/^\d{1,20}$/)
    .default("0"),
});
const account = z.strictObject({
  accountType: z.literal("GOOGLE_ADS"),
  accountId,
});
const diagnosticSchema = z.object({
  requestStatusPerDestination: z
    .array(
      z.object({
        destination: z.strictObject({
          operatingAccount: account,
          loginAccount: account.optional(),
          productDestinationId: z.string(),
        }),
        requestStatus: z.enum([
          "PROCESSING",
          "SUCCESS",
          "PARTIAL_SUCCESS",
          "FAILED",
        ]),
        eventsIngestionStatus: z
          .object({
            recordCount: z
              .string()
              .regex(/^\d{1,20}$/)
              .default("0"),
          })
          .optional(),
        warningInfo: z
          .object({ warningCounts: z.array(reasonCount).max(200).default([]) })
          .optional(),
        errorInfo: z
          .object({ errorCounts: z.array(reasonCount).max(200).default([]) })
          .optional(),
      }),
    )
    .length(1),
});

async function responseJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error("response_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Transport only. The durable dispatcher owns permission rechecks, verified
 * payment selection, write-ahead receipts, serial delivery and reconciliation.
 * This class has no retry loop and is not registered in the application server.
 */
export class GoogleDataManager {
  private readonly target: ReturnType<typeof destination>;
  private readonly config: GoogleConversionDestination;
  readonly destinationFingerprint: string;
  constructor(
    config: GoogleConversionDestination,
    private readonly accessToken: () => Promise<string>,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.config = parse(googleDestinationSchema, config, "invalid_destination");
    this.target = destination(this.config);
    this.destinationFingerprint = createHash("sha256")
      .update(JSON.stringify(this.target))
      .digest("hex");
  }
  private async request(path: string, body?: unknown): Promise<unknown> {
    let token: string;
    try {
      token = await this.accessToken();
      if (
        typeof token !== "string" ||
        !/^[A-Za-z0-9._~+/=-]{1,8192}$/.test(token)
      )
        throw new Error();
    } catch {
      throw new GoogleConversionError("credentials_unavailable", "not_sent");
    }
    let response: Response;
    try {
      response = await this.fetcher(origin + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new GoogleConversionError("transport_failed", "unknown");
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new GoogleConversionError(
        "provider_rejected",
        response.status >= 500 || response.status === 408
          ? "unknown"
          : "rejected",
        response.status,
      );
    }
    try {
      return await responseJson(response);
    } catch {
      throw new GoogleConversionError(
        "invalid_provider_response",
        "unknown",
        response.status,
      );
    }
  }
  async purchase(
    input: GooglePurchase,
    mode: "validate" | "ingest" = "validate",
    now = new Date(),
  ): Promise<GoogleIngestionReceipt | GoogleValidationReceipt> {
    return this.send(
      googlePurchaseRequest(this.config, input, mode, now),
      mode,
    );
  }
  async restate(
    input: GooglePurchase,
    mode: "validate" | "ingest" = "validate",
    now = new Date(),
  ) {
    return this.send(
      googleRestatementRequest(this.config, input, mode, now),
      mode,
    );
  }
  private async send(
    body: unknown,
    mode: "validate" | "ingest",
  ): Promise<GoogleIngestionReceipt | GoogleValidationReceipt> {
    const raw = await this.request("events:ingest", body);
    const result = z
      .strictObject({
        requestId: requestId.optional(),
        fieldWarnings: z.array(object).max(1000).optional(),
      })
      .safeParse(raw);
    if (!result.success || (mode === "ingest" && !result.data.requestId))
      throw new GoogleConversionError("invalid_provider_response", "unknown");
    const fieldWarningCount = result.data.fieldWarnings?.length ?? 0;
    if (mode === "validate") return { kind: "validated", fieldWarningCount };
    return {
      kind: "accepted",
      requestId: result.data.requestId!,
      destinationFingerprint: this.destinationFingerprint,
      submittedRecords: 1,
      fieldWarningCount,
    };
  }
  async status(receipt: GoogleIngestionReceipt) {
    const checked = parse(
      z.strictObject({
        kind: z.literal("accepted"),
        requestId,
        destinationFingerprint: z.literal(this.destinationFingerprint),
        submittedRecords: z.literal(1),
        fieldWarningCount: z.number().int().nonnegative().max(1000),
      }),
      receipt,
      "invalid_receipt",
    );
    const raw = await this.request(
      `requestStatus:retrieve?requestId=${encodeURIComponent(checked.requestId)}`,
    );
    const result = diagnosticSchema.safeParse(raw);
    if (!result.success)
      throw new GoogleConversionError("invalid_diagnostics", "unknown");
    const status = result.data.requestStatusPerDestination[0]!;
    if (JSON.stringify(status.destination) !== JSON.stringify(this.target))
      throw new GoogleConversionError(
        "diagnostic_destination_mismatch",
        "unknown",
      );
    const recordCount = status.eventsIngestionStatus?.recordCount;
    if (status.requestStatus !== "PROCESSING" && recordCount !== "1")
      throw new GoogleConversionError(
        "diagnostic_record_count_mismatch",
        "unknown",
      );
    return {
      status: status.requestStatus,
      recordCount: recordCount ?? null,
      warnings: status.warningInfo?.warningCounts ?? [],
      errors: status.errorInfo?.errorCounts ?? [],
      // Processing success does not prove click matching or ad attribution.
      fieldWarningCount: checked.fieldWarningCount,
    };
  }
}
