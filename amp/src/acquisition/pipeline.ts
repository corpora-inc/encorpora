import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { purchaseEvidenceSql, grantedAccessSql } from "./evidence.js";
import {
  classificationCommandSchema,
  classifyAccount,
} from "./classification.js";

const text = z.string().trim().min(1).max(500);
const email = z
  .email()
  .max(320)
  .transform((v) => v.toLowerCase());
const at = z.iso
  .datetime({ offset: true })
  .refine((v) => Date.parse(v) <= Date.now() + 300_000, "Future evidence");
const purpose = z.enum(["welcome", "reply", "followup"]);
const common = { email, eventKey: text };
const receipt = {
  sender: email,
  recipient: email,
  subject: z.string().min(1).max(500),
  sentAt: at,
  messageId: text,
  threadId: text,
};
export const pipelineCommandSchema = z.discriminatedUnion("action", [
  classificationCommandSchema,
  z
    .object({
      action: z.literal("reconcile-sent"),
      ...common,
      ...receipt,
      id: z.uuid(),
      reference: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("reconcile-unsent"),
      ...common,
      id: z.uuid(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      reference: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("import-sent"),
      ...common,
      ...receipt,
      purpose,
      intentKey: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("record-event"),
      ...common,
      kind: z.enum([
        "reply",
        "optout",
        "bounce",
        "mailbox_checked",
        "hold",
        "release",
      ]),
      occurredAt: at,
      reason: text.optional(),
      messageId: text.optional(),
      threadId: text.optional(),
      mailbox: email.optional(),
      complete: z.literal(true).optional(),
      nextContactAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("save-draft"),
      ...common,
      purpose,
      intentKey: text,
      sender: email,
      recipient: email,
      subject: z.string().min(1).max(500),
      body: z.string().min(1).max(30_000),
      draftId: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      ...common,
      id: z.uuid(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      reference: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("claim"),
      ...common,
      id: z.uuid(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm-sent"),
      ...common,
      ...receipt,
      id: z.uuid(),
      claimId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("cancel"),
      ...common,
      id: z.uuid(),
      reason: text,
    })
    .strict(),
]);
export type PipelineCommand = z.infer<typeof pipelineCommandSchema>;

export function draftHash(mail: {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  draftId: string;
}) {
  // Exact single-recipient, plain-text draft; no CC, BCC or attachments.
  return createHash("sha256")
    .update(
      JSON.stringify([
        mail.sender,
        mail.recipient,
        mail.subject,
        mail.body,
        mail.draftId,
      ]),
    )
    .digest("hex");
}

async function event(
  db: PoolClient,
  user: string,
  key: string,
  kind: string,
  when: string,
  details: unknown,
) {
  const result = await db.query(
    `INSERT INTO amp_acquisition_contact_events(id,user_id,event_key,kind,occurred_at,details)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id`,
    [randomUUID(), user, key, kind, when, details],
  );
  if (!result.rowCount) {
    const same = await db.query(
      `SELECT 1 FROM amp_acquisition_contact_events WHERE user_id=$1 AND event_key=$2 AND kind=$3 AND occurred_at=$4 AND details=$5::jsonb`,
      [user, key, kind, when, details],
    );
    if (!same.rowCount)
      throw new Error("Event key already represents different evidence");
  }
}

/** Operator-only commands. This module never calls a mail provider or sends mail. */
export async function runPipelineCommand(pool: Pool, input: unknown) {
  const c = pipelineCommandSchema.parse(input);
  if (c.action === "classify-account") return classifyAccount(pool, c);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='15s'");
    // Serialize contacts sharing a case-insensitive recipient, as well as each account.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `outreach:${c.email}`,
    ]);
    const contact = (
      await db.query(
        `SELECT c.*,p.email,p.unsubscribed_at,p.verified_at,u."emailVerified",u.email AS current_email
      FROM amp_acquisition_contacts c JOIN amp_parent_followups p USING(user_id) JOIN amp_auth_users u ON u.id=c.user_id
      WHERE lower(p.email)=$1 FOR UPDATE OF c`,
        [c.email],
      )
    ).rows;
    if (contact.length !== 1)
      throw new Error("Expected exactly one acquisition contact");
    const lead = contact[0];
    const uid = lead.user_id as string;
    const now = (await db.query("SELECT now() AS at")).rows[0].at.toISOString();
    const oldEvent = (
      await db.query(
        "SELECT details FROM amp_acquisition_contact_events WHERE user_id=$1 AND event_key=$2",
        [uid, c.eventKey],
      )
    ).rows[0];
    if (oldEvent) {
      // Commands are immutable under their event key, including repeated claims.
      if (
        JSON.stringify(oldEvent.details.command) !==
        JSON.stringify(JSON.parse(JSON.stringify(c)))
      ) {
        const same = await db.query(
          "SELECT 1 FROM amp_acquisition_contact_events WHERE user_id=$1 AND event_key=$2 AND details->'command'=$3::jsonb",
          [uid, c.eventKey, c],
        );
        if (!same.rowCount)
          throw new Error("Event key already represents a different command");
      }
      await db.query("COMMIT");
      return {
        replay: true,
        result:
          c.action === "claim"
            ? { id: c.id, status: "reconcile_before_any_send" }
            : oldEvent.details.result,
      };
    }
    let result: unknown;
    let kind: string = c.action;
    let occurredAt = now;
    if (c.action === "record-event") {
      kind = c.kind;
      occurredAt = c.occurredAt;
      if (
        ["reply", "optout", "bounce"].includes(c.kind) &&
        (!c.messageId || !c.threadId || !c.mailbox)
      )
        throw new Error(
          "Mail evidence requires mailbox, message and thread IDs",
        );
      if (c.kind === "mailbox_checked") {
        if (!c.complete || !c.mailbox)
          throw new Error(
            "Complete sent and inbound mailbox reconciliation is required",
          );
        await db.query(
          "UPDATE amp_acquisition_contacts SET mailbox_checked_at=$2,mailbox_checked_for=$3 WHERE user_id=$1 AND (mailbox_checked_at IS NULL OR mailbox_checked_at<=$2::timestamptz)",
          [uid, c.occurredAt, c.mailbox],
        );
      }
      if (c.kind === "optout" || c.kind === "bounce") {
        await db.query(
          "UPDATE amp_acquisition_contacts SET suppressed_at=coalesce(suppressed_at,$2),suppression_reason=coalesce(suppression_reason,$3) WHERE user_id=$1",
          [uid, c.occurredAt, c.kind],
        );
        if (c.kind === "optout")
          await db.query(
            "UPDATE amp_parent_followups SET unsubscribed_at=coalesce(unsubscribed_at,$2),newsletter=false WHERE user_id=$1",
            [uid, c.occurredAt],
          );
      }
      if (c.kind === "hold" || c.kind === "release") {
        if (!c.reason) throw new Error("Hold/release requires a reason");
        await db.query(
          "UPDATE amp_acquisition_contacts SET hold_reason=$2,next_contact_at=coalesce($3,next_contact_at) WHERE user_id=$1",
          [uid, c.kind === "hold" ? c.reason : null, c.nextContactAt ?? null],
        );
      }
      result = { recorded: c.kind };
    } else if (c.action === "import-sent") {
      kind = "sent";
      occurredAt = c.sentAt;
      if (c.recipient !== c.email)
        throw new Error("Receipt does not match contact");
      const id = randomUUID();
      const existing = (
        await db.query(
          "SELECT * FROM amp_acquisition_messages WHERE user_id=$1 AND intent_key=$2",
          [uid, c.intentKey],
        )
      ).rows[0];
      if (existing) {
        if (
          existing.status !== "sent" ||
          existing.sender !== c.sender ||
          existing.recipient !== c.recipient ||
          existing.subject !== c.subject ||
          existing.purpose !== c.purpose ||
          existing.provider_message_id !== c.messageId ||
          existing.provider_thread_id !== c.threadId ||
          existing.sent_at.toISOString() !== new Date(c.sentAt).toISOString()
        )
          throw new Error(
            "Intent already has different correspondence; reconcile it explicitly",
          );
        result = { id: existing.id, status: "sent" };
      } else {
        await db.query(
          `INSERT INTO amp_acquisition_messages(id,user_id,purpose,intent_key,sender,recipient,subject,status,sent_at,provider_message_id,provider_thread_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,'sent',$8,$9,$10)`,
          [
            id,
            uid,
            c.purpose,
            c.intentKey,
            c.sender,
            c.recipient,
            c.subject,
            c.sentAt,
            c.messageId,
            c.threadId,
          ],
        );
        result = { id, status: "sent" };
      }
    } else if (c.action === "save-draft") {
      kind = "draft";
      if (c.recipient !== c.email)
        throw new Error("Draft does not match contact");
      const hash = draftHash(c);
      const row = (
        await db.query(
          `INSERT INTO amp_acquisition_messages(id,user_id,purpose,intent_key,sender,recipient,subject,body,draft_id,content_hash,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
        ON CONFLICT(user_id,intent_key) DO UPDATE SET sender=excluded.sender,recipient=excluded.recipient,subject=excluded.subject,body=excluded.body,
          draft_id=excluded.draft_id,content_hash=excluded.content_hash,status='draft',approved_at=NULL,approval_reference=NULL
        WHERE amp_acquisition_messages.status IN ('draft','approved','cancelled') AND amp_acquisition_messages.claimed_at IS NULL AND amp_acquisition_messages.purpose=excluded.purpose RETURNING id,status,content_hash`,
          [
            randomUUID(),
            uid,
            c.purpose,
            c.intentKey,
            c.sender,
            c.recipient,
            c.subject,
            c.body,
            c.draftId,
            hash,
          ],
        )
      ).rows[0];
      if (!row) throw new Error("Sent or claimed intent cannot be replaced");
      result = row;
    } else {
      const m = (
        await db.query(
          "SELECT * FROM amp_acquisition_messages WHERE id=$1 AND user_id=$2 FOR UPDATE",
          [c.id, uid],
        )
      ).rows[0];
      if (!m) throw new Error("Message not found");
      if (c.action === "approve") {
        kind = "approved";
        if (m.status !== "draft" || m.content_hash !== c.contentHash)
          throw new Error("Review the current draft before approval");
        await db.query(
          "UPDATE amp_acquisition_messages SET status='approved',approved_at=now(),approval_reference=$2 WHERE id=$1",
          [m.id, c.reference],
        );
        result = { id: m.id, status: "approved" };
      } else if (c.action === "claim") {
        kind = "claimed";
        if (m.status !== "approved" || m.content_hash !== c.contentHash)
          throw new Error("Only the exact approved draft can be claimed");
        if (
          !lead.emailVerified ||
          !lead.verified_at ||
          lead.current_email.toLowerCase() !== c.email ||
          m.recipient !== c.email
        )
          throw new Error("Recipient is unverified or changed");
        if (lead.suppressed_at || lead.unsubscribed_at || lead.hold_reason)
          throw new Error("Contact is held or suppressed");
        if (
          m.purpose !== "reply" &&
          (
            await db.query(
              "SELECT 1 FROM amp_account_classifications WHERE user_id=$1 AND category<>'prospect'",
              [uid],
            )
          ).rowCount
        )
          throw new Error("Account is not an acquisition prospect");
        if (
          !lead.mailbox_checked_at ||
          lead.mailbox_checked_for !== m.sender ||
          Date.parse(now) - lead.mailbox_checked_at.getTime() > 3600_000
        )
          throw new Error(
            "Reconcile sender mailbox, sent mail and replies before sending",
          );
        if (
          m.purpose !== "reply" &&
          lead.next_contact_at.getTime() > Date.parse(now)
        )
          throw new Error("Contact is not due");
        const duplicates = await db.query(
          "SELECT 1 FROM amp_acquisition_messages WHERE recipient=$1 AND id<>$2 AND (status='sending' OR ($3='welcome' AND purpose='welcome' AND status='sent'))",
          [c.email, m.id, m.purpose],
        );
        if (duplicates.rowCount)
          throw new Error(
            "Contact already has a welcome or an unresolved send",
          );
        if (
          m.purpose !== "reply" &&
          (
            await db.query(
              "SELECT 1 FROM amp_acquisition_contact_events WHERE user_id=$1 AND kind='reply'",
              [uid],
            )
          ).rowCount
        )
          throw new Error("Contact has replied; review the conversation");
        if (
          m.purpose !== "reply" &&
          (
            await db.query(
              `SELECT 1 WHERE ${purchaseEvidenceSql("$1")} OR ${grantedAccessSql("$1")}`,
              [`amp|${uid}`],
            )
          ).rowCount
        )
          throw new Error(
            "Contact already has access; review the conversation",
          );
        const claimId = randomUUID();
        await db.query(
          "UPDATE amp_acquisition_messages SET status='sending',claimed_at=now(),claim_id=$2 WHERE id=$1",
          [m.id, claimId],
        );
        result = {
          id: m.id,
          claimId,
          draftId: m.draft_id,
          contentHash: m.content_hash,
          sender: m.sender,
          recipient: m.recipient,
          subject: m.subject,
          body: m.body,
        };
      } else if (c.action === "confirm-sent" || c.action === "reconcile-sent") {
        kind = "sent";
        occurredAt = c.sentAt;
        if (
          m.status !== "sending" ||
          (c.action === "confirm-sent" && m.claim_id !== c.claimId) ||
          m.sender !== c.sender ||
          m.recipient !== c.recipient ||
          m.subject !== c.subject
        )
          throw new Error("Receipt does not match claimed draft");
        if (
          c.action === "reconcile-sent" &&
          (!lead.mailbox_checked_at ||
            lead.mailbox_checked_for !== m.sender ||
            lead.mailbox_checked_at < m.claimed_at)
        )
          throw new Error("Reconcile the sender mailbox after the claim first");
        await db.query(
          "UPDATE amp_acquisition_messages SET status='sent',sent_at=$2,provider_message_id=$3,provider_thread_id=$4 WHERE id=$1",
          [m.id, c.sentAt, c.messageId, c.threadId],
        );
        result = { id: m.id, status: "sent" };
      } else if (c.action === "reconcile-unsent") {
        kind = "cancelled";
        if (
          m.status !== "sending" ||
          m.content_hash !== c.contentHash ||
          !lead.mailbox_checked_at ||
          lead.mailbox_checked_for !== m.sender ||
          lead.mailbox_checked_at < m.claimed_at
        )
          throw new Error(
            "Reconcile the unchanged unsent draft and sender mailbox after the claim first",
          );
        await db.query(
          "UPDATE amp_acquisition_messages SET status='draft',claim_id=NULL,claimed_at=NULL,approved_at=NULL,approval_reference=NULL WHERE id=$1",
          [m.id],
        );
        result = { id: m.id, status: "draft", requiresNewApproval: true };
      } else {
        kind = "cancelled";
        // A claimed send may have reached Gmail even when the response was lost.
        if (!["draft", "approved"].includes(m.status))
          throw new Error(
            "Claimed or sent messages require provider reconciliation and cannot be cancelled",
          );
        await db.query(
          "UPDATE amp_acquisition_messages SET status='cancelled' WHERE id=$1",
          [m.id],
        );
        result = { id: m.id, status: "cancelled" };
      }
    }
    await event(db, uid, c.eventKey, kind, occurredAt, { command: c, result });
    await db.query("COMMIT");
    return { replay: false, result };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
