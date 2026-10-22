import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../../scripts/migrate.js";
import { changeAdvertisingPermission } from "../../src/advertising/permission.js";
import { PURCHASE_MEASUREMENT_NOTICE } from "../../src/advertising/permission-contracts.js";
import { applyCommerceEvent } from "../../src/commerce/postgres.js";
import type { RefundFact } from "../../src/billing/evidence/contracts.js";
export const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
export const destination = {
  conversionCustomerId: "1234567890",
  conversionActionId: "123",
};
export const sources = {
  stripeNamespace: "acct_fixture:live",
  efaChannelReference: "synthetic-ar-program",
  azEsaChannelReference: "synthetic-az-program",
};
export const day = 86400000;
export const paidAt = () => Math.floor((Date.now() - day) / 1000);
export async function fixture(run: (pool: Pool) => Promise<void>) {
  const schema = `amp_ad_queue_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  const admin = new Pool({ connectionString: url.href, max: 1 });
  url.searchParams.set(
    "options",
    `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
  );
  const pool = new Pool({ connectionString: url.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(url.href);
    await pool.query(`INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES
      ('parent','Fixture parent','parent@example.invalid',true),('other','Other parent','other@example.invalid',true)`);
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|parent','Learner fixture')",
    );
    await grant(pool);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
export async function grant(pool: Pool, revision: string | null = null) {
  const result = await changeAdvertisingPermission(pool, "amp|parent", {
    action: "allow",
    revision,
    noticeVersion: PURCHASE_MEASUREMENT_NOTICE.version,
    adultAttestation: true,
  });
  await pool.query(
    "UPDATE amp_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days' WHERE account_id='amp|parent'",
  );
  return result;
}
export async function stripe(
  pool: Pool,
  options: {
    account?: string;
    namespace?: string;
    live?: boolean;
    currency?: string;
    reason?: string;
    paidAt?: number;
    paidMinor?: number;
    status?: string;
    refunds?: RefundFact[];
  } = {},
) {
  const id = randomUUID(),
    checkout = randomUUID(),
    chargeId = `ch_${id}`;
  const account = options.account ?? "amp|parent",
    namespace = options.namespace ?? sources.stripeNamespace;
  const baseline = {
    invoiceId: `in_${id}`,
    checkoutId: checkout,
    chargeId,
    paidAt: options.paidAt ?? paidAt(),
    paidMinor: options.paidMinor ?? 49900,
    currency: options.currency ?? "usd",
    invoiceReason: options.reason ?? "subscription_create",
    profile: {
      accountId: namespace.split(":")[0],
      livemode: options.live ?? true,
    },
    billingName: "Do not export this name",
    cardLast4: "4242",
  };
  await pool.query(
    `INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,closed)
    VALUES($1,$2,$3,'child',$4,true)`,
    [checkout, namespace, account, randomUUID()],
  );
  await pool.query(
    `INSERT INTO amp_payment_records(id,namespace,invoice_id,checkout_id,account_id,learner_id,baseline,baseline_sha256,status)
    VALUES($1,$2,$3,$4,$5,'child',$6,'synthetic-digest',$7)`,
    [
      id,
      namespace,
      baseline.invoiceId,
      checkout,
      account,
      baseline,
      options.status ?? "verified",
    ],
  );
  await observation(pool, id, options.refunds ?? []);
  return {
    reference: { kind: "stripe" as const, id },
    chargeId,
    invoiceId: baseline.invoiceId,
    occurredAt: new Date(baseline.paidAt * 1000).toISOString(),
  };
}
export async function observation(
  pool: Pool,
  record: string,
  refunds: RefundFact[],
  kind = "verified",
) {
  await pool.query(
    `INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id)
    VALUES($1,$2,$3,'synthetic-digest',$4)`,
    [randomUUID(), record, { kind, observation: { refunds } }, randomUUID()],
  );
}
export function refund(
  chargeId: string,
  amountMinor: number,
  status: RefundFact["status"] = "succeeded",
): RefundFact {
  return {
    id: randomUUID(),
    chargeId,
    amountMinor,
    currency: "usd",
    created: paidAt() + 60,
    status,
  };
}
export async function esa(
  pool: Pool,
  options: {
    linked?: boolean;
    settled?: boolean;
    program?: string;
    owner?: string;
    kind?: "arkansas-efa" | "arizona-esa";
    channelReference?: string;
  } = {},
) {
  const kind = options.kind ?? "arkansas-efa";
  const channel =
    options.channelReference ??
    (kind === "arizona-esa"
      ? sources.azEsaChannelReference
      : sources.efaChannelReference);
  const id = randomUUID(),
    at = new Date(Date.now() - day).toISOString();
  const base = {
    orderId: id,
    channel: "esa" as const,
    channelReference: channel,
    occurredAt: at,
  };
  await applyCommerceEvent(pool, {
    ...base,
    id: randomUUID(),
    type: "order.created",
    order: {
      id,
      account: { id: "amp|parent" },
      license: {
        learnerId: "child",
        accountId: "amp|parent",
        sku: "fixture-annual",
        startsAt: at,
        endsAt: new Date(Date.now() + 365 * day).toISOString(),
      },
      channel: "esa",
      channelReference: channel,
      externalOrderId: randomUUID(),
      currency: "USD",
      amountMinor: 49900,
      activationPolicy: "after-settlement",
    },
  });
  if (options.settled !== false)
    await applyCommerceEvent(pool, {
      ...base,
      id: randomUUID(),
      type: "order.settled",
      amountMinor: 49900,
      currency: "USD",
      evidence: "fixture verified settlement",
    });
  if (options.linked !== false)
    await pool.query(
      `INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at,order_id,conversion_payload)
    VALUES($1,$2,'child',$3,'fixture-offer','v1',$4,clock_timestamp()-interval '2 days',clock_timestamp()+interval '10 days',$5,'{}')`,
      [
        randomUUID(),
        options.owner ?? "amp|parent",
        randomUUID(),
        {
          programId:
            options.program ?? (kind === "arizona-esa" ? "az-esa" : "ar-efa"),
          jurisdiction: kind === "arizona-esa" ? "AZ" : "AR",
          channelReference: channel,
        },
        id,
      ],
    );
  return { reference: { kind, id }, base };
}
