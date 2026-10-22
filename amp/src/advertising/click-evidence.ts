import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  fundedCampaignSchema,
  type FundedCampaign,
} from "../analytics/funded-campaign.js";
import {
  clickEvidenceSchema,
  providerClickIdentifiers,
  type ClickEvidence,
} from "./click-identifiers.js";

export const AD_CLICK_SOURCE_URL = "https://corpora.inc/esa/arkansas-efa/";
export const adClickSourceSchema = z.enum([
  AD_CLICK_SOURCE_URL,
  "https://corpora.inc/amp/",
  "https://corpora.inc/esa/arizona-esa/",
]);
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("funding-request"),
    id: z.string().min(1).max(500),
  }),
  z.strictObject({ kind: z.literal("stripe-checkout"), id: z.uuid() }),
]);
export type AttributionTarget = z.infer<typeof targetSchema>;

/** Internal repository primitive. Caller owns a transaction and the collection
 * policy/Origin/privacy checks. It has no HTTP route or automatic collection.
 * Only the opaque handle is returned; raw identifiers stay in the database. */
export async function retainAdClick(
  client: PoolClient,
  input: ClickEvidence,
  token?: string,
  labels?: FundedCampaign,
  predecessorToken?: string,
  sourceUrl: string = AD_CLICK_SOURCE_URL,
) {
  sourceUrl = adClickSourceSchema.parse(sourceUrl);
  const parsed = clickEvidenceSchema.safeParse(input);
  if (
    !parsed.success ||
    (token !== undefined && !tokenSchema.safeParse(token).success)
  )
    throw new Error("invalid_click_evidence");
  const campaignLabels =
    labels === undefined ? {} : fundedCampaignSchema.parse(labels);
  let journey = token
    ? (
        await client.query(
          "SELECT id,expires_at,account_id FROM amp_ad_click_journeys WHERE token_digest=$1 AND expires_at>clock_timestamp() FOR UPDATE",
          [digest(token)],
        )
      ).rows[0]
    : null;
  // Sample after the lock: another capture may have committed while we waited.
  const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
    .now as Date;
  providerClickIdentifiers(parsed.data, now);
  if (journey && +journey.expires_at <= +now) journey = null;
  const previousJourneyId =
    predecessorToken && tokenSchema.safeParse(predecessorToken).success
      ? ((
          await client.query(
            "SELECT id FROM amp_ad_click_journeys WHERE token_digest=$1 AND expires_at>clock_timestamp()",
            [digest(predecessorToken)],
          )
        ).rows[0]?.id ?? null)
      : (journey?.id ?? null);
  // An anonymous capture cannot establish who is using a previously bound
  // browser. Rotate rather than append new activity to that parent account.
  if (!journey || journey.account_id) {
    token = randomBytes(32).toString("hex");
    const id = randomUUID();
    const expires = new Date(+now + 90 * 86400000);
    await client.query(
      "INSERT INTO amp_ad_click_journeys(id,token_digest,created_at,expires_at) VALUES($1,$2,$3,$4)",
      [id, digest(token), now, expires],
    );
    journey = { id, expires_at: expires };
  }
  // Reloads preserve first observation. Each distinct captured click is retained.
  const identifiers = parsed.data.identifiers;
  const canonical =
    parsed.data.provider === "google"
      ? parsed.data.identifiers.gclid
        ? ["gclid", parsed.data.identifiers.gclid]
        : parsed.data.identifiers.gbraid
          ? ["gbraid", parsed.data.identifiers.gbraid]
          : ["wbraid", parsed.data.identifiers.wbraid]
      : parsed.data.identifiers.fbclid || parsed.data.identifiers.fbc
        ? [
            "fbclid",
            parsed.data.identifiers.fbclid ??
              parsed.data.identifiers.fbc!.split(".").slice(3).join("."),
          ]
        : ["fbp", parsed.data.identifiers.fbp];
  const clickKey = digest(JSON.stringify(canonical));
  // Cookie enrichment is another observation of the same click, not a new
  // click. Keep both records but preserve the earliest server observation.
  const firstObserved = (
    await client.query(
      "SELECT min(first_observed_at) AS first FROM amp_ad_click_evidence WHERE journey_id IN ($1,$4) AND provider=$2 AND click_digest=$3",
      [journey.id, parsed.data.provider, clickKey, previousJourneyId],
    )
  ).rows[0].first as Date | null;
  const key = digest(
    JSON.stringify(
      Object.entries(identifiers).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  const count = Number(
    (
      await client.query(
        "SELECT count(*) AS count FROM amp_ad_click_evidence WHERE journey_id=$1",
        [journey.id],
      )
    ).rows[0].count,
  );
  if (
    count >= 100 &&
    !(
      await client.query(
        "SELECT 1 FROM amp_ad_click_evidence WHERE journey_id=$1 AND provider=$2 AND evidence_digest=$3",
        [journey.id, parsed.data.provider, key],
      )
    ).rowCount
  )
    throw new Error("click_history_limit");
  await client.query(
    `INSERT INTO amp_ad_click_evidence(id,journey_id,provider,identifiers,evidence_digest,observed_at,source_url,click_digest,first_observed_at,campaign_labels)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(journey_id,provider,evidence_digest) DO NOTHING`,
    [
      randomUUID(),
      journey.id,
      parsed.data.provider,
      identifiers,
      key,
      now,
      sourceUrl,
      clickKey,
      firstObserved ?? now,
      campaignLabels,
    ],
  );
  return {
    token: token!,
    expiresAt: (journey.expires_at as Date).toISOString(),
  };
}

/** Bind each provider's last observed click before the exact owned order was
 * created. Retrying cannot overwrite that order's attribution, even with a new
 * browser/click. Caller holds the account privacy lock and owns the transaction.
 * This does not grant export permission or establish payment. */
export async function bindAdClicksToOrder(
  client: PoolClient,
  account: string,
  token: string,
  rawTarget: AttributionTarget,
  providers: readonly ("google" | "meta")[] = ["google", "meta"],
) {
  const parsed = targetSchema.safeParse(rawTarget);
  if (!parsed.success || !tokenSchema.safeParse(token).success)
    throw new Error("invalid_attribution_target");
  const target = parsed.data;
  const funding = target.kind === "funding-request";
  const table = funding ? "amp_funding_requests" : "amp_stripe_checkouts";
  const owned = (
    await client.query(
      `SELECT created_at FROM ${table} WHERE id=$1 AND account_id=$2`,
      [target.id, account],
    )
  ).rows[0];
  if (!owned) throw new Error("attribution_target_unavailable");
  const journey = (
    await client.query(
      "SELECT id,account_id FROM amp_ad_click_journeys WHERE token_digest=$1 AND expires_at>clock_timestamp() FOR UPDATE",
      [digest(token)],
    )
  ).rows[0];
  if (!journey || (journey.account_id && journey.account_id !== account))
    return { bound: 0 };
  await client.query(
    "UPDATE amp_ad_click_journeys SET account_id=$2 WHERE id=$1 AND account_id IS NULL",
    [journey.id, account],
  );
  const clicks = await client.query(
    `SELECT DISTINCT ON(provider) id,provider FROM amp_ad_click_evidence
     WHERE journey_id=$1 AND observed_at<=$2 ORDER BY provider,first_observed_at DESC,sequence DESC`,
    [journey.id, owned.created_at],
  );
  let bound = 0;
  for (const click of clicks.rows) {
    if (!providers.includes(click.provider)) continue;
    const result = await client.query(
      `INSERT INTO amp_ad_order_attribution(account_id,funding_request_id,stripe_checkout_id,provider,click_id)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [
        account,
        funding ? target.id : null,
        funding ? null : target.id,
        click.provider,
        click.id,
      ],
    );
    bound += result.rowCount ?? 0;
  }
  return { bound };
}

/** Financial references resolve through ownership-checked order bindings.
 * A dispatcher must separately verify payment, current permission and provider
 * windows. This function is never sufficient authority for external delivery. */
export async function orderClickEvidence(
  client: PoolClient,
  account: string,
  rawTarget: AttributionTarget,
  provider: "google" | "meta",
) {
  const target = targetSchema.parse(rawTarget);
  if (!["google", "meta"].includes(provider))
    throw new Error("invalid_attribution_provider");
  const column =
    target.kind === "funding-request"
      ? "funding_request_id"
      : "stripe_checkout_id";
  const row = (
    await client.query(
      `SELECT c.identifiers,c.observed_at,c.first_observed_at,c.source_url FROM amp_ad_order_attribution a
     JOIN amp_ad_click_evidence c ON c.id=a.click_id AND c.provider=a.provider
     JOIN amp_ad_click_journeys j ON j.id=c.journey_id AND j.account_id=a.account_id
     WHERE a.${column}=$1 AND a.account_id=$2 AND a.provider=$3 AND j.expires_at>clock_timestamp()`,
      [target.id, account, provider],
    )
  ).rows[0];
  return row
    ? {
        identifiers: providerClickIdentifiers(
          { provider, identifiers: row.identifiers } as ClickEvidence,
          row.first_observed_at,
          row.observed_at,
        ),
        observedAt: row.first_observed_at.toISOString(),
        sourceUrl: row.source_url,
      }
    : null;
}

/** Expiry removes raw identifiers while immutable order bindings remain empty;
 * a later browser visit cannot replace a purged order's attribution. */
export async function purgeAdClickEvidence(client: PoolClient) {
  const result = await client.query(
    `DELETE FROM amp_ad_click_journeys WHERE id IN
     (SELECT id FROM amp_ad_click_journeys WHERE expires_at<=clock_timestamp()
      ORDER BY expires_at,id LIMIT 200 FOR UPDATE SKIP LOCKED)`,
  );
  return result.rowCount ?? 0;
}

/** Caller holds the account privacy lock. Provider withdrawal removes only that
 * recipient's IDs; financial bindings retain a null tombstone to prevent refill. */
export async function eraseAccountAdClicks(
  client: PoolClient,
  account: string,
  provider?: "google" | "meta",
) {
  if (provider !== undefined && !["google", "meta"].includes(provider))
    throw new Error("invalid_attribution_provider");
  const result = await client.query(
    `DELETE FROM amp_ad_click_evidence c USING amp_ad_click_journeys j
     WHERE j.id=c.journey_id AND j.account_id=$1 AND ($2::text IS NULL OR c.provider=$2)`,
    [account, provider ?? null],
  );
  return result.rowCount ?? 0;
}
