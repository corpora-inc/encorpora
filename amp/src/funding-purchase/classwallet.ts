import { createHash } from "node:crypto";
import { z } from "zod";
import type { FundingRequest } from "./contracts.js";
import { annualTermEnd, fundedProvisionSchema } from "./provision.js";

export const classWalletHeaders = [
  "Order ID",
  "User Name",
  "Organization",
  "State",
  "School",
  "Payment Approval Date",
  "Est. Timeframe",
  "Invoice/Quote",
  "Distribution Name",
  "Payment Amount",
  "Fee",
  "Total",
  "Status",
  "Last Update",
  "Transaction ID",
];
export class ClassWalletError extends Error {}
const fail = (code: string): never => {
  throw new ClassWalletError(code);
};
/** No defaults: an operator must verify report semantics for this vendor account. */
export const classWalletConfigSchema = z
  .strictObject({
    verificationReference: z.string().min(1).max(200),
    currency: z.literal("USD"),
    grossColumn: z.enum(["Payment Amount", "Total"]),
    netColumn: z.enum(["Payment Amount", "Total"]),
    dateFormat: z.literal("canonical-utc-iso"),
    settledStatus: z.literal("Settled"),
    lastUpdateMeaning: z.literal("settlement-time-for-settled-rows"),
    programs: z
      .array(
        z.strictObject({
          organization: z.string().min(1),
          state: z.string().min(1),
          distribution: z.string().min(1),
          programId: z.string().min(1),
          channelReference: z.string().min(1),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (c) => c.grossColumn !== c.netColumn,
    "Distinct amount columns required",
  );
export type ClassWalletConfig = z.infer<typeof classWalletConfigSchema>;
export type ClassWalletRow = Record<string, string>;
/** Bounded RFC4180 subset. No delimiter guessing, formula evaluation or permissive quotes. */
export function parseClassWalletReport(input: string): ClassWalletRow[] {
  if (Buffer.byteLength(input) > 2_000_000 || input.includes("\0"))
    fail("report_bounds");
  const rows: string[][] = [],
    row: string[] = [];
  let field = "",
    quoted = false,
    closed = false;
  const pushField = () => {
    if (field.length > 4096) fail("field_bounds");
    row.push(field);
    field = "";
    closed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((v) => v !== "")) rows.push([...row]);
    row.length = 0;
    if (rows.length > 1001) fail("row_bounds");
  };
  const source = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === ",") pushField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"') fail("invalid_csv");
      field += c;
    }
  }
  if (quoted) fail("invalid_csv");
  if (field || row.length || closed) pushRow();
  const header = rows.shift()?.map((v) => v.trim());
  if (!header || header.join("|") !== classWalletHeaders.join("|"))
    fail("unknown_report_headers");
  return rows.map((values) => {
    if (values.length !== classWalletHeaders.length) fail("column_count");
    return Object.fromEntries(
      classWalletHeaders.map((key, i) => [key, values[i]]),
    );
  });
}
export function classWalletMoney(value: string): number {
  if (!/^(?:0|[1-9]\d{0,8})\.\d{2}$/.test(value))
    return fail("unknown_money_format");
  const [whole, cents] = value.split(".");
  return Number(whole) * 100 + Number(cents);
}
function instant(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    fail("unknown_date_format");
  return value;
}
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function classWalletOrderId(transaction: string): string {
  if (
    !transaction ||
    transaction.length > 200 ||
    transaction.trim() !== transaction
  )
    fail("invalid_transaction_id");
  return `classwallet:${digest(transaction)}`;
}
/** Exact invoice matching only. Names and email addresses are never used as identity. */
export function prepareClassWalletProvision(
  row: ClassWalletRow,
  request: FundingRequest,
  config: ClassWalletConfig,
  at: string,
  previous?: unknown,
) {
  if (row["Status"] !== config.settledStatus) fail("not_settled");
  if (
    !z.string().uuid().safeParse(row["Invoice/Quote"]).success ||
    row["Invoice/Quote"] !== request.id
  )
    fail("invoice_mismatch");
  const programs = config.programs.filter(
    (p) =>
      p.organization === row.Organization &&
      p.state === row.State &&
      p.distribution === row["Distribution Name"],
  );
  if (
    programs.length !== 1 ||
    programs[0].programId !== request.offer.programId ||
    programs[0].channelReference !== request.offer.channelReference
  )
    fail("program_mismatch");
  const gross = classWalletMoney(row[config.grossColumn]),
    net = classWalletMoney(row[config.netColumn]),
    fee = classWalletMoney(row.Fee);
  if (
    gross !== net + fee ||
    gross !== request.offer.subtotalMinor + request.offer.taxMinor ||
    request.offer.currency !== config.currency
  )
    fail("amount_mismatch");
  if (!row["Order ID"] || row["Order ID"].length > 200)
    fail("missing_provider_order");
  const orderId = classWalletOrderId(row["Transaction ID"]);
  const approved = instant(row["Payment Approval Date"]),
    updated = instant(row["Last Update"]),
    now = instant(at);
  if (approved < request.createdAt || updated < approved || updated > now)
    fail("invalid_payment_dates");
  const old =
    previous === undefined ? undefined : fundedProvisionSchema.parse(previous);
  // Repeated exports can change Last Update. Reuse the committed settlement and activation instants.
  const activated =
    old?.events.find((e) => e.type === "license.activated")?.occurredAt ?? now;
  const settled =
    old?.events.find((e) => e.type === "order.settled")?.occurredAt ?? updated;
  const evidence = `classwallet-report:${digest([row["Transaction ID"], row["Order ID"], request.id, programs[0], gross, net, fee, approved])}`;
  const envelope = (type: string, occurredAt: string) => ({
    id: `${orderId}:${type}`,
    orderId,
    channel: "esa" as const,
    channelReference: request.offer.channelReference,
    occurredAt,
  });
  return fundedProvisionSchema.parse({
    requestId: request.id,
    events: [
      {
        ...envelope("created", approved),
        type: "order.created",
        order: {
          id: orderId,
          account: { id: request.accountId },
          license: {
            accountId: request.accountId,
            learnerId: request.learnerId,
            sku: request.offer.sku,
            startsAt: activated,
            endsAt: annualTermEnd(activated),
          },
          channel: "esa",
          channelReference: request.offer.channelReference,
          externalOrderId: orderId,
          currency: config.currency,
          amountMinor: gross,
          activationPolicy: request.offer.activationPolicy,
        },
      },
      { ...envelope("approved", approved), type: "order.approved", evidence },
      {
        ...envelope("settled", settled),
        type: "order.settled",
        evidence,
        amountMinor: gross,
        currency: config.currency,
      },
      {
        ...envelope("fulfilled", activated),
        type: "order.fulfilled",
        evidence,
      },
      {
        ...envelope("activated", activated),
        type: "license.activated",
        evidence,
      },
    ],
  });
}
