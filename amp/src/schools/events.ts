import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export type SchoolEvent = {
  orgId: string;
  actorPersonId?: string | null;
  action: string;
  targetKind: string;
  targetId: string;
  /** Before and after values, for comparing outcomes and for the activity log. */
  detail?: { before?: unknown; after?: unknown };
};

const NAMES = new Set([
  "name",
  "givenname",
  "familyname",
  "displayname",
  "signername",
  "email",
]);
function assertNoNames(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(assertNoNames);
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (NAMES.has(key.replace(/[^a-z]/gi, "").toLowerCase()))
      throw new Error(`School events never hold names: ${key}`);
    assertNoNames(entry);
  }
}

/** The one writer of `amp_school_events`, inside the change's own transaction. */
export async function recordEvent(
  client: Pick<PoolClient, "query">,
  event: SchoolEvent,
): Promise<void> {
  const detail = event.detail ?? {};
  assertNoNames(detail);
  await client.query(
    `INSERT INTO amp_school_events(id,org_id,actor_person_id,action,target_kind,target_id,detail)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      randomUUID(),
      event.orgId,
      event.actorPersonId ?? null,
      event.action,
      event.targetKind,
      event.targetId,
      JSON.stringify(detail),
    ],
  );
}
