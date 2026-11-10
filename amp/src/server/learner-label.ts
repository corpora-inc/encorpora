import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  numberedName,
  PARENT_ENTRY,
  type LabelScope,
} from "../learning/nickname.js";

/** The next number in a family's children or a school's unnamed students,
 * for "Child 3" or "Student 3" (src/learning/nickname.ts). The scope is the
 * family account or school org, never a student's own account. Every child
 * made this way takes a number, named or not, so clearing a name later
 * returns the same label. */
export async function allocateLabel(client: PoolClient, scope: LabelScope) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `learner-label:${scope}`,
  ]);
  const { rows } = await client.query<{ next: number }>(
    "SELECT COALESCE(max(label_number),0)+1 AS next FROM amp_learners WHERE identity_scope=$1 AND deleted_at IS NULL",
    [scope],
  );
  const number = rows[0]!.next;
  return { scope, number, name: numberedName(scope, number) };
}

/** A family's child before verified consent: the name their parent entered,
 * or "Child 2", and a birth year, owned by the parent's account. A name
 * entered here records its basis (`PARENT_ENTRY`). The child learns on the
 * restricted basis (`name_pending`) until consent is verified. The caller
 * holds the account's learning lock and has checked its consent state and
 * learner room, in the same transaction. */
export async function insertFamilyChild(
  client: PoolClient,
  accountId: string,
  birthYear: number,
  name?: string,
) {
  const label = await allocateLabel(client, `family:${accountId}`);
  const learner = {
    id: randomUUID(),
    name: name ?? label.name,
    birthYear,
    namePending: true as const,
  };
  await client.query(
    // The time it is written, not the transaction's: several children made
    // together keep the order they were given in (learners list by it).
    `INSERT INTO amp_learners(id,account_id,name,birth_year,name_pending,label_number,identity_scope,
       name_basis,name_basis_version,name_basis_at,created_at)
     VALUES($1,$2,$3,$4,true,$5,$6,$7,$8,CASE WHEN $7::text IS NULL THEN NULL ELSE now() END,clock_timestamp())`,
    [
      learner.id,
      accountId,
      learner.name,
      birthYear,
      label.number,
      label.scope,
      name ? PARENT_ENTRY.method : null,
      name ? PARENT_ENTRY.version : null,
    ],
  );
  return learner;
}
