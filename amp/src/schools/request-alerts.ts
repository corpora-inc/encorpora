import type { Pool } from "pg";
import { z } from "zod";
import { accountEmail, type Email } from "../email/email.js";
import { AGREEMENT_VERSION } from "./agreement.js";

/**
 * The operator's alerts about a school's request for Clever or Clever
 * AnySchool (docs/clever-anyschool.md). Clever has no API that creates an
 * AnySchool district, so a person sends the invitation from Clever's
 * dashboard; these emails tell that person, and remind them.
 *
 * The request is the record. The worker derives one alert from its age while
 * it stays `requested`: `requested` (under 24 hours), `reminder` (the 24-hour
 * target has passed) and `overdue` (the 72-hour limit has passed), each at
 * most once. A school that asks again adds one `rerequested` alert. Delivery
 * runs in the Clever worker's pass, never in the request handler, and a failed
 * alert never fails the school's request.
 */

/** The invitation target, from the request: within 24 hours. */
export const INVITE_TARGET_HOURS = 24;
/** The invitation limit, from the request: 72 hours at most. */
export const INVITE_LIMIT_HOURS = 72;

export const OPERATOR_EMAIL_DEFAULT = "skylar@corpora.inc";

/** Where operator alerts go: `AMP_OPERATOR_EMAIL`, or the founder. */
export function operatorEmail(env: NodeJS.ProcessEnv): string {
  const value = env.AMP_OPERATOR_EMAIL?.trim();
  if (!value) return OPERATOR_EMAIL_DEFAULT;
  const parsed = z.email().max(254).safeParse(value);
  if (!parsed.success) throw new Error("AMP_OPERATOR_EMAIL must be an email");
  return parsed.data;
}

export type AlertKind = "requested" | "rerequested" | "reminder" | "overdue";

/** The school asked again while its request waits for the invitation. The
 * request itself already stands; this only tells the operator. An alert not
 * yet sent (or not yet recorded) reads the request's current details when it
 * goes, so then nothing is added. Never throws. */
export async function alertReRequest(
  db: Pick<Pool, "query">,
  requestId: string,
): Promise<boolean> {
  try {
    const result = await db.query(
      `INSERT INTO amp_school_request_alerts(request_id,kind)
       SELECT r.id,'rerequested' FROM amp_school_connection_requests r
       WHERE r.id=$1 AND r.status='requested'
         AND EXISTS (SELECT 1 FROM amp_school_request_alerts a WHERE a.request_id=r.id)
         AND NOT EXISTS (
         SELECT 1 FROM amp_school_request_alerts a
         WHERE a.request_id=r.id AND a.sent_at IS NULL AND a.stopped_at IS NULL)
       ON CONFLICT DO NOTHING`,
      [requestId],
    );
    return !!result.rowCount;
  } catch (error) {
    console.error("[schools] operator alert not queued", {
      requestId,
      message: (error as Error).message,
    });
    return false;
  }
}

/** Requests whose age-derived alert is not recorded yet. Shared with the
 * worker's due check, so the two can never disagree. */
export const ALERTS_TO_DERIVE_SQL = `SELECT r.id,CASE
    WHEN r.created_at>now()-interval '${INVITE_TARGET_HOURS} hours' THEN 'requested'
    WHEN r.created_at>now()-interval '${INVITE_LIMIT_HOURS} hours' THEN 'reminder'
    ELSE 'overdue' END AS kind
  FROM amp_school_connection_requests r WHERE r.status='requested'`;

/** Alerts ready to send now. */
export const ALERTS_READY_SQL = `SELECT a.id FROM amp_school_request_alerts a
  WHERE a.sent_at IS NULL AND a.stopped_at IS NULL AND a.available_at<=now()
    AND (a.lease_until IS NULL OR a.lease_until<=now())`;

/** True when a pass has an alert to record or send. One cheap query. */
export async function requestAlertsDue(db: Pick<Pool, "query">) {
  return (
    await db.query(
      `SELECT EXISTS (SELECT 1 FROM (${ALERTS_TO_DERIVE_SQL}) d WHERE NOT EXISTS (
         SELECT 1 FROM amp_school_request_alerts a WHERE a.request_id=d.id AND a.kind=d.kind))
       OR EXISTS (${ALERTS_READY_SQL}) AS due`,
    )
  ).rows[0].due as boolean;
}

export interface RequestAlertInput {
  kind: AlertKind;
  requestId: string;
  method: "clever" | "anyschool";
  institutionName: string;
  setupEmail: string;
  /** The signed-in account that asked, when it has an email. */
  requesterEmail: string | null;
  /** Who accepted the agreement; null for the older contact form. */
  signerName: string | null;
  agreementVersion: string | null;
  orgId: string | null;
  createdAt: Date;
}

/** What a school typed: shown as text, never as a link in the operator's
 * mail (the layout links any http(s) URL). */
const asText = (value: string) => value.replace(/\bhttps?:\/\//gi, "");

const utc = (at: Date) =>
  `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
const plus = (at: Date, hours: number) =>
  new Date(at.getTime() + hours * 3600_000);

/** The operator's email about one request: who asked, for what, the target,
 * and the exact next step. */
export function requestAlertEmail(
  origin: string,
  input: RequestAlertInput,
): Email {
  const anyschool = input.method === "anyschool";
  const product = anyschool ? "Clever AnySchool" : "Clever";
  const target = plus(input.createdAt, INVITE_TARGET_HOURS);
  const limit = plus(input.createdAt, INVITE_LIMIT_HOURS);
  const name = asText(input.institutionName);
  const subject = {
    requested: `${product} request: invite ${name} by ${utc(target)}`,
    rerequested: `${name} asked again for ${product}`,
    reminder: `Reminder: invite ${name} to ${product} by ${utc(limit)}`,
    overdue: `Overdue: invite ${name} to ${product} now`,
  }[input.kind];
  const lead = {
    requested: `${name} asked AMP to set up ${product}.`,
    rerequested: `${name} asked again for ${product}. The request below has its current details.`,
    reminder: `${name} has waited ${INVITE_TARGET_HOURS} hours for its ${product} invitation. The target has passed.`,
    overdue: `${name} has waited more than ${INVITE_LIMIT_HOURS} hours for its ${product} invitation. It is overdue.`,
  }[input.kind];
  const signed =
    input.signerName === null
      ? anyschool
        ? "Agreement: not signed (the older contact form)"
        : "Agreement: not signed here; a district accepts it when it connects"
      : `Agreement: signed by ${asText(input.signerName)}, version ${input.agreementVersion ?? "unknown"}${
          input.agreementVersion === AGREEMENT_VERSION ? "" : " (out of date)"
        }`;
  const record = JSON.stringify({
    id: input.requestId,
    districtId: "<Clever district ID>",
    reference: "<free text>",
  });
  const steps: string[] = !anyschool
    ? [
        `A school or district already on Clever connects itself. Send ${input.setupEmail} this link for their Clever district administrator: ${origin}/school/connect`,
        "If they are not on Clever yet, invite them from the Clever dashboard: Home > Invite Districts.",
        `Then record it: npm run school:admin -- connection-request-status with {"id":"${input.requestId}","status":"invited","reference":"<free text>"}`,
      ]
    : input.signerName === null
      ? [
          "This request came from the older contact form. Nobody accepted the agreement, and anyschool-invite refuses it.",
          `Ask the school's administrator to ask again from the school's Integrations page${input.orgId ? `: ${origin}/school/${input.orgId}/integrations` : "."}`,
          `Then close this one: npm run school:admin -- connection-request-status with {"id":"${input.requestId}","status":"closed","reference":"<free text>"}`,
        ]
      : [
          `Clever dashboard: Home > Invite Districts > Add an AnySchool District. Enter “${name}”, then select Create new district.`,
          `On the district overview page, select Send email invite. Set District Email to ${input.setupEmail}, then select Send email.`,
          `Record it: npm run school:admin -- anyschool-invite with ${record}`,
        ];
  return accountEmail(origin, {
    subject,
    heading: {
      requested: `Invite ${name} to ${product}`,
      rerequested: `${name} asked again`,
      reminder: `Reminder: invite ${name}`,
      overdue: `Overdue: invite ${name}`,
    }[input.kind],
    body: [
      lead,
      {
        lines: [
          `Institution: ${name}`,
          `Method: ${input.method}`,
          `Setup contact: ${input.setupEmail}`,
          `Requester: ${input.requesterEmail ?? "unknown"}`,
          signed,
          `Requested: ${utc(input.createdAt)}`,
          `Request: ${input.requestId}`,
        ],
      },
      `Target: invite within ${INVITE_TARGET_HOURS} hours, by ${utc(target)}. Limit: ${INVITE_LIMIT_HOURS} hours, by ${utc(limit)}.`,
      "Next step:",
      { list: steps },
      {
        link: {
          label: "Operator steps",
          url: anyschool
            ? "https://github.com/corpora-inc/encorpora/blob/main/amp/docs/clever-anyschool.md#operator-steps"
            : "https://github.com/corpora-inc/encorpora/blob/main/amp/docs/clever-onboarding.md",
        },
        lead: anyschool
          ? "Every step, and what each refusal means:"
          : "How a district connects:",
      },
    ],
  });
}

/** A provider send. `idempotencyKey` is the alert's own: a retry after a
 * timeout, or after a crash between send and record, is delivered once. */
export type AlertSend = (
  to: string,
  email: Email,
  options: { idempotencyKey: string },
) => Promise<void>;

const SEND_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 8;

/**
 * One bounded pass: record each request's due alert, then send up to `limit`.
 * A claimed alert holds a two-minute lease, so concurrent passes never send it
 * twice. A failed send is retried with backoff and stops after eight
 * attempts; every failure is logged.
 */
export async function deliverRequestAlerts(
  pool: Pool,
  send: AlertSend,
  options: { to: string; origin: string; limit?: number },
) {
  const result = { queued: 0, sent: 0, failed: 0, stopped: 0 };
  result.queued =
    (
      await pool.query(
        `INSERT INTO amp_school_request_alerts(request_id,kind)
         SELECT d.id,d.kind FROM (${ALERTS_TO_DERIVE_SQL}) d WHERE NOT EXISTS (
           SELECT 1 FROM amp_school_request_alerts a WHERE a.request_id=d.id AND a.kind=d.kind)
         ON CONFLICT DO NOTHING`,
      )
    ).rowCount ?? 0;
  for (let n = 0; n < (options.limit ?? 8); n++) {
    const claimed = await claim(pool);
    if (!claimed) break;
    if ("stopped" in claimed) {
      result.stopped++;
      continue;
    }
    const email = requestAlertEmail(options.origin, claimed.input);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        send(options.to, email, {
          idempotencyKey: `amp-school-request-alert:${claimed.id}`,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("send timed out")),
            SEND_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      clearTimeout(timer);
      result.failed++;
      const message = (error as Error).message.slice(0, 300);
      const exhausted = claimed.attempts >= MAX_ATTEMPTS;
      console.error("[schools] operator alert not sent", {
        alertId: claimed.id,
        requestId: claimed.input.requestId,
        kind: claimed.input.kind,
        attempt: claimed.attempts,
        final: exhausted,
        message,
      });
      // Backoff 1, 2, 4 ... 64 minutes; the lease is released either way.
      await pool.query(
        `UPDATE amp_school_request_alerts SET lease_until=NULL,last_error=$2,
           available_at=now()+make_interval(mins => $3::int),
           stopped_at=CASE WHEN $4 THEN now() END,
           stopped_reason=CASE WHEN $4 THEN 'attempts-exhausted' END
         WHERE id=$1`,
        [
          claimed.id,
          message,
          2 ** Math.min(claimed.attempts - 1, 6),
          exhausted,
        ],
      );
      continue;
    }
    clearTimeout(timer);
    await pool.query(
      "UPDATE amp_school_request_alerts SET sent_at=now(),lease_until=NULL,last_error=NULL WHERE id=$1",
      [claimed.id],
    );
    console.info("[schools] operator alert sent", {
      alertId: claimed.id,
      requestId: claimed.input.requestId,
      kind: claimed.input.kind,
    });
    result.sent++;
  }
  return result;
}

/** Claims the next ready alert under a lease, or stops one whose request no
 * longer waits for an invitation. */
async function claim(pool: Pool) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const row = (
      await db.query(
        `SELECT a.id,a.kind,a.attempts,r.id AS request_id,r.status,r.method,r.institution_name,
           r.contact_email,r.signer_name,r.agreement_version,r.org_id,r.created_at,u.email AS requester
         FROM amp_school_request_alerts a JOIN amp_school_connection_requests r ON r.id=a.request_id
         LEFT JOIN amp_auth_users u ON r.account_id LIKE 'amp|%' AND u.id=substr(r.account_id,5)
         WHERE a.id=(${ALERTS_READY_SQL} ORDER BY a.available_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED)`,
      )
    ).rows[0];
    if (!row) {
      await db.query("COMMIT");
      return null;
    }
    if (row.status !== "requested") {
      await db.query(
        "UPDATE amp_school_request_alerts SET stopped_at=now(),stopped_reason='request-handled',lease_until=NULL WHERE id=$1",
        [row.id],
      );
      await db.query("COMMIT");
      return { stopped: true as const };
    }
    const attempts = row.attempts + 1;
    await db.query(
      "UPDATE amp_school_request_alerts SET lease_until=now()+interval '2 minutes',attempts=$2 WHERE id=$1",
      [row.id, attempts],
    );
    await db.query("COMMIT");
    return {
      id: row.id as string,
      attempts: attempts as number,
      input: {
        kind: row.kind,
        requestId: row.request_id,
        method: row.method,
        institutionName: row.institution_name,
        setupEmail: row.contact_email,
        requesterEmail: row.requester ?? null,
        signerName: row.signer_name ?? null,
        agreementVersion: row.agreement_version ?? null,
        orgId: row.org_id ?? null,
        createdAt: new Date(row.created_at),
      } satisfies RequestAlertInput,
    };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

/**
 * The Clever worker's alert pass (scripts/clever-sync.ts). Sends through the
 * account mail path (Resend: `AMP_MAIL_RESEND_API_KEY`, `AMP_MAIL_FROM`) with
 * the AMP origin (`AMP_ACCOUNTS_URL`) for the mark and links. Without them it
 * sends nothing and leaves every alert waiting, so none is marked sent that
 * was not.
 */
export async function runRequestAlertPass(
  pool: Pool,
  env: NodeJS.ProcessEnv,
  send?: AlertSend,
) {
  if (!(await requestAlertsDue(pool))) return { due: false as const };
  const to = operatorEmail(env);
  const origin = env.AMP_ACCOUNTS_URL ?? "";
  if (!URL.canParse(origin) || new URL(origin).origin !== origin)
    throw new Error("Operator alerts need AMP_ACCOUNTS_URL, the AMP origin");
  const apiKey = env.AMP_MAIL_RESEND_API_KEY,
    from = env.AMP_MAIL_FROM;
  if (!send && !(apiKey && from))
    throw new Error(
      "Operator alerts need AMP_MAIL_RESEND_API_KEY and AMP_MAIL_FROM",
    );
  // Loaded only when an alert is due: the idle pass stays cheap.
  const transport =
    send ??
    (await import("../server/accounts.js")).accountEmailSender({
      mail: { apiKey: apiKey!, from: from! },
      production: true,
    });
  return {
    due: true as const,
    ...(await deliverRequestAlerts(pool, transport, { to, origin })),
  };
}
