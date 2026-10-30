import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { providerClickIdentifiers } from "./click-identifiers.js";
import { lockSignupSharing } from "./signup-privacy-lock.js";

const day = 86400_000;
export const signupUserAgent = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^[\x20-\x7e]+$/);
const configSchema = z.discriminatedUnion("provider", [
  z.strictObject({
    provider: z.literal("meta"),
    enabled: z.boolean(),
    destinationId: z.string().regex(/^[1-9]\d{4,29}$/),
  }),
  z.strictObject({
    provider: z.literal("openai"),
    enabled: z.boolean(),
    destinationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  }),
]);
export type ProviderSignupConfig = z.infer<typeof configSchema>;
export type SignupRuntime = {
  accessToken: () => Promise<string>;
  fetcher?: typeof fetch;
};
const destinationKey = (c: ProviderSignupConfig) =>
  createHash("sha256").update(`${c.provider}:${c.destinationId}`).digest("hex");
type Evidence = {
  user_id: string;
  evidence_id: string;
  verified_at: Date;
  identifiers: unknown;
  first_observed_at: Date;
  observed_at: Date;
  user_agent: string | null;
};
// Reused for collection and delivery. Every event requires real pre-signup
// click evidence and a currently verified account, never a returning login.
const eligibleSql = `SELECT p.user_id,p.verified_at,c.id AS evidence_id,c.identifiers,c.first_observed_at,c.observed_at,b.user_agent
 FROM amp_parent_followups p JOIN amp_auth_users u ON u.id=p.user_id
 JOIN amp_ad_click_journeys j ON j.id=p.acquisition_journey_id AND j.account_id='amp|'||p.user_id AND j.expires_at>clock_timestamp()
 JOIN LATERAL (SELECT * FROM amp_ad_click_evidence c WHERE c.journey_id=j.id AND c.provider=$1
   AND c.observed_at<=p.verified_at AND c.first_observed_at>=p.verified_at-interval '30 days'
   ORDER BY c.first_observed_at DESC,c.sequence DESC LIMIT 1) c ON true
 LEFT JOIN amp_signup_browser_contexts b ON b.user_id=p.user_id AND b.evidence_id=c.id AND b.expires_at>clock_timestamp()
 WHERE p.new_account AND p.verified_at<=clock_timestamp() AND p.verified_at>clock_timestamp()-interval '7 days'+interval '1 second'
 AND u."emailVerified" AND u.email=p.email
 AND ($1<>'meta' OR b.user_agent IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM amp_ad_collection_withdrawals w WHERE w.account_id='amp|'||p.user_id AND w.provider=$1)`;

async function begin(db: PoolClient, userId: string, delivery = false) {
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='3s'");
  await db.query("SET LOCAL statement_timeout='15s'");
  await db.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
  if (delivery) await lockSignupSharing(db, `amp|${userId}`, true);
  else
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `amp|${userId}`,
    ]);
}

/** Contains click identifiers and browser context. Never log the result. */
export function signupPayload(
  provider: "meta" | "openai",
  id: string,
  evidence: Evidence,
  now = new Date(),
) {
  z.uuid().parse(id);
  const time = +evidence.verified_at;
  if (!Number.isFinite(time) || time > +now || time <= +now - 7 * day + 1000)
    throw new Error("signup_expired");
  const identifiers = providerClickIdentifiers(
    { provider, identifiers: evidence.identifiers } as Parameters<
      typeof providerClickIdentifiers
    >[0],
    evidence.first_observed_at,
    evidence.observed_at,
  );
  const eventId = `amp_signup_${provider}_${id.replaceAll("-", "")}`;
  if (provider === "openai")
    return {
      events: [
        {
          id: eventId,
          type: "registration_completed",
          timestamp_ms: time,
          ...identifiers,
          action_source: "web",
          source_url: "https://amp.corpora.inc/sign-up",
          opt_out: true,
          data: { type: "customer_action" },
        },
      ],
    };
  return {
    data: [
      {
        event_name: "CompleteRegistration",
        event_id: eventId,
        event_time: Math.floor(time / 1000),
        action_source: "website",
        event_source_url: "https://amp.corpora.inc/sign-up",
        user_data: {
          ...identifiers,
          client_user_agent: signupUserAgent.parse(evidence.user_agent),
        },
      },
    ],
  };
}

export async function collectProviderSignups(
  pool: Pool,
  input: ProviderSignupConfig,
  limit = 20,
) {
  const config = configSchema.parse(input);
  if (!config.enabled) return 0;
  const candidates = await pool.query<Evidence>(
    `${eligibleSql}
    AND NOT EXISTS(SELECT 1 FROM amp_provider_signup_exports e WHERE e.user_id=p.user_id AND e.provider=$1)
    ORDER BY p.verified_at LIMIT $2`,
    [config.provider, limit],
  );
  let count = 0;
  for (const candidate of candidates.rows) {
    const db = await pool.connect();
    try {
      await begin(db, candidate.user_id);
      const current = (
        await db.query<Evidence>(`${eligibleSql} AND p.user_id=$2`, [
          config.provider,
          candidate.user_id,
        ])
      ).rows[0];
      if (current) {
        const id = randomUUID();
        signupPayload(config.provider, id, current);
        count +=
          (
            await db.query(
              `INSERT INTO amp_provider_signup_exports(id,user_id,provider,destination_key,evidence_id,occurred_at)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,provider) DO NOTHING`,
              [
                id,
                current.user_id,
                config.provider,
                destinationKey(config),
                current.evidence_id,
                current.verified_at,
              ],
            )
          ).rowCount ?? 0;
      }
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }
  return count;
}

async function receiptBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_receipt");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((bytes += value.length) > 65536) throw new Error("large_receipt");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function deliverProviderSignup(
  pool: Pool,
  input: ProviderSignupConfig,
  runtime: SignupRuntime,
) {
  const config = configSchema.parse(input);
  if (!config.enabled) return false;
  // Read credentials before taking the privacy lock. Recheck evidence under
  // that lock immediately before I/O; withdrawal and deletion serialize here.
  const token = await runtime.accessToken();
  if (!/^[A-Za-z0-9._~+/=-]{1,8192}$/.test(token))
    throw new Error("invalid_credentials");
  const lease = randomUUID();
  const job = (
    await pool.query(
      `UPDATE amp_provider_signup_exports SET lease_id=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1
    WHERE id=(SELECT id FROM amp_provider_signup_exports WHERE provider=$1 AND state IN ('ready','retry')
      AND available_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`,
      [config.provider, lease],
    )
  ).rows[0];
  if (!job) return false;
  const db = await pool.connect();
  try {
    await begin(db, job.user_id, true);
    const owned = await db.query(
      "SELECT 1 FROM amp_provider_signup_exports WHERE id=$1 AND lease_id=$2 AND lease_until>clock_timestamp()+interval '15 seconds' AND state IN ('ready','retry') FOR UPDATE",
      [job.id, lease],
    );
    if (!owned.rowCount) {
      await db.query("COMMIT");
      return true;
    }
    const evidence = (
      await db.query<Evidence>(
        `${eligibleSql} AND p.user_id=$2 AND c.id=$3 AND date_trunc('milliseconds',p.verified_at)=$4`,
        [config.provider, job.user_id, job.evidence_id, job.occurred_at],
      )
    ).rows[0];
    const reason =
      job.destination_key !== destinationKey(config)
        ? "destination_changed"
        : job.attempts > 8
          ? "attempts_exhausted"
          : !evidence
            ? "ineligible_or_expired"
            : null;
    if (reason) {
      await db.query(
        "UPDATE amp_provider_signup_exports SET state='stopped',stopped_reason=$2,lease_until=NULL WHERE id=$1",
        [job.id, reason],
      );
      await db.query("COMMIT");
      return true;
    }
    const payload = signupPayload(config.provider, job.id, evidence!);
    let state = "retry",
      status: number | null = null,
      receipt: object | null = null;
    try {
      const response = await (runtime.fetcher ?? fetch)(
        config.provider === "meta"
          ? `https://graph.facebook.com/v26.0/${config.destinationId}/events`
          : `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(config.destinationId)}`,
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        },
      );
      status = response.status;
      if (response.ok) {
        const raw = await receiptBody(response);
        if (config.provider === "meta") {
          const parsed = z
            .object({
              events_received: z.literal(1),
              messages: z.array(z.string()).default([]),
            })
            .safeParse(raw);
          if (parsed.success)
            receipt = {
              eventsReceived: 1,
              messageCount: parsed.data.messages.length,
            };
        } else if (
          z.object({ accepted_events: z.literal(1) }).safeParse(raw).success
        )
          receipt = { eventsReceived: 1 };
        if (receipt) state = "accepted";
      } else {
        void response.body?.cancel().catch(() => {});
        if (status >= 400 && status < 500 && ![408, 425, 429].includes(status))
          state = "rejected";
      }
    } catch {
      /* Uncertain requests retry the same stable event ID. */
    }
    await db.query(
      `UPDATE amp_provider_signup_exports SET state=$2,receipt=$3,http_status=$4,
      available_at=now()+interval '15 minutes',lease_until=NULL WHERE id=$1 AND lease_id=$5`,
      [job.id, state, receipt, status, lease],
    );
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function providerSignupBatch(
  pool: Pool,
  config: ProviderSignupConfig,
  operation: string,
  limit: number,
  runtime: SignupRuntime,
) {
  if (operation === "report")
    return {
      enabled: config.enabled,
      deliveries: (
        await pool.query(
          "SELECT state,count(*)::int AS count FROM amp_provider_signup_exports WHERE provider=$1 GROUP BY state ORDER BY state",
          [config.provider],
        )
      ).rows,
    };
  if (!config.enabled) return { enabled: false };
  if (operation === "collect")
    return { collected: await collectProviderSignups(pool, config, limit) };
  let processed = 0;
  while (
    processed < limit &&
    (await deliverProviderSignup(pool, config, runtime))
  )
    processed++;
  return { processed };
}

export async function purgeSignupMeasurement(pool: Pool) {
  const browser = await pool.query(
    "DELETE FROM amp_signup_browser_contexts WHERE expires_at<=now()",
  );
  const exports = await pool.query(
    "DELETE FROM amp_provider_signup_exports WHERE occurred_at<now()-interval '90 days'",
  );
  const intents = await pool.query(
    "DELETE FROM amp_parent_signup_intents WHERE expires_at<=now()",
  );
  return {
    signupBrowserContexts: browser.rowCount,
    signupExports: exports.rowCount,
    signupIntents: intents.rowCount,
  };
}
