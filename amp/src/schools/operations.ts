import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import { SchoolError } from "./contracts.js";
import { SchoolRepository } from "./repository.js";
import { recordEvent } from "./events.js";

/** Operator workflow only. A teacher's buyer request neither purchases seats
 * nor changes authority. Payment/PO authorization is recorded explicitly. */
export async function schoolOperations(
  repo: SchoolRepository,
  command: string,
  raw: unknown,
) {
  if (command === "school-queue") {
    z.strictObject({}).parse(raw);
    return {
      connections: (
        await repo.pool.query(
          `SELECT id,method,status,institution_name,contact_email,created_at FROM amp_school_connection_requests WHERE status IN ('requested','invited') ORDER BY created_at LIMIT 200`,
        )
      ).rows,
      purchases: (
        await repo.pool.query(
          `SELECT id,org_id,class_ids,seats,status,created_at FROM amp_school_purchase_requests WHERE status NOT IN ('active','closed') ORDER BY created_at LIMIT 200`,
        )
      ).rows,
      releases: (
        await repo.pool.query(
          `SELECT id,connection_id,kind,created_at FROM amp_school_connection_tasks WHERE status='open' ORDER BY created_at LIMIT 200`,
        )
      ).rows,
    };
  }
  if (command === "connection-request-status") {
    const input = z
      .strictObject({
        id: z.uuid(),
        status: z.enum(["invited", "connected", "closed"]),
        reference: z.string().trim().min(1).max(200),
      })
      .parse(raw);
    const result = await repo.pool.query(
      `UPDATE amp_school_connection_requests SET status=$2,provider_reference=$3,updated_at=now() WHERE id=$1 RETURNING id,status`,
      [input.id, input.status, input.reference],
    );
    if (!result.rowCount) throw new SchoolError(404, "request_not_found");
    return result.rows[0];
  }
  if (command === "purchase-status") {
    const input = z
      .strictObject({
        id: z.uuid(),
        status: z.enum(["quoted", "awaiting_po", "invoiced", "closed"]),
        reference: z.string().trim().min(1).max(200),
      })
      .parse(raw);
    return repo.transaction(async (db) => {
      const result = (
        await db.query(
          `UPDATE amp_school_purchase_requests SET status=$2 WHERE id=$1 AND status<>'active' RETURNING id,org_id,status`,
          [input.id, input.status],
        )
      ).rows[0];
      if (!result) throw new SchoolError(409, "purchase_request_unavailable");
      await recordEvent(db, {
        orgId: result.org_id,
        action: "purchase.status-changed",
        targetKind: "purchase",
        targetId: input.id,
        detail: { after: { status: input.status, reference: input.reference } },
      });
      return { id: result.id, status: result.status };
    });
  }
  if (command === "activate-purchase") {
    const input = z
      .strictObject({
        id: z.uuid(),
        seats: z.number().int().min(1).max(1000000),
        startsAt: z.iso.datetime({ offset: true }).optional(),
        endsAt: z.iso.datetime({ offset: true }),
        reference: z.string().trim().min(1).max(200),
      })
      .parse(raw);
    return repo.transaction(async (db) => {
      const request = (
        await db.query(
          "SELECT * FROM amp_school_purchase_requests WHERE id=$1 FOR UPDATE",
          [input.id],
        )
      ).rows[0];
      if (!request) throw new SchoolError(404, "request_not_found");
      if (request.status === "closed")
        throw new SchoolError(409, "purchase_request_closed");
      if (request.license_id)
        return {
          id: request.id,
          status: "active",
          licenseId: request.license_id,
        };
      const license = await repo.issueLicenseIn(db, {
        orgId: request.org_id,
        classIds: request.class_ids,
        seats: input.seats,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reference: input.reference,
      });
      await db.query(
        "UPDATE amp_school_purchase_requests SET status='active',license_id=$2 WHERE id=$1",
        [request.id, license.licenseId],
      );
      await recordEvent(db, {
        orgId: request.org_id,
        action: "purchase.activated",
        targetKind: "purchase",
        targetId: input.id,
        detail: {
          after: {
            licenseId: license.licenseId,
            seats: input.seats,
            reference: input.reference,
          },
        },
      });
      return { id: request.id, status: "active", ...license };
    });
  }
  throw new SchoolError(400, "unknown_command");
}

/** Review only: never automatically disconnect a school. Active paid capacity,
 * any active pilot/extension, or other valid learner grants keep the connection. */
export async function refreshConnectionReviews(pool: Pool) {
  await pool.query(`WITH eligible AS (
    SELECT c.id FROM amp_clever_connections c WHERE c.status='active'
    AND EXISTS(SELECT 1 FROM amp_class_pilots cp JOIN amp_classes k ON k.id=cp.class_id
      JOIN amp_orgs o ON o.id=k.org_id WHERE o.path[1]=c.tenant_id)
    AND NOT EXISTS(SELECT 1 FROM amp_class_pilots cp JOIN amp_teacher_pilots p ON p.id=cp.pilot_id
      JOIN amp_classes k ON k.id=cp.class_id JOIN amp_orgs o ON o.id=k.org_id WHERE o.path[1]=c.tenant_id
      AND greatest(p.grace_ends_at,(SELECT max(until_at) FROM amp_pilot_extensions WHERE pilot_id=p.id))>now())
    AND NOT EXISTS(SELECT 1 FROM amp_school_licenses l JOIN amp_orgs o ON o.id=l.org_id
      WHERE o.path[1]=c.tenant_id AND l.status='active' AND l.ends_at>now())
    AND NOT EXISTS(SELECT 1 FROM amp_people p JOIN amp_grants g ON g.learner_id=p.learner_id
      WHERE p.tenant_id=c.tenant_id AND p.deleted_at IS NULL AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now() AND amp_school_grant_valid(g.id))
  ), close_old AS (
    UPDATE amp_school_connection_tasks SET status='cancelled',completed_at=now()
     WHERE kind='review_release' AND status='open' AND connection_id NOT IN(SELECT id FROM eligible)
  )
  INSERT INTO amp_school_connection_tasks(id,connection_id,kind)
    SELECT gen_random_uuid(),id,'review_release' FROM eligible
    ON CONFLICT(connection_id,kind) WHERE status='open' DO NOTHING`);
  await pool.query(`INSERT INTO amp_school_connection_tasks(id,connection_id,kind)
    SELECT gen_random_uuid(),id,'provider_disconnected' FROM amp_clever_connections WHERE status='disconnected'
    ON CONFLICT(connection_id,kind) WHERE status='open' DO NOTHING`);
}
