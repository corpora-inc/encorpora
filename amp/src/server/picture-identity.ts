import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { schoolPictures } from "../schools/contracts.js";

/** Public identity is independent of the student's private picture password.
 * The scope is the family account or school org, never a student's account. */
export async function allocatePictureIdentity(
  client: PoolClient,
  scope: string,
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `picture-identity:${scope}`,
  ]);
  const { rows } = await client.query<{
    picture_identity: string;
    picture_number: number;
  }>(
    "SELECT picture_identity,picture_number FROM amp_learners WHERE identity_scope=$1 AND deleted_at IS NULL",
    [scope],
  );
  const used = new Set(
    rows.map((row) => `${row.picture_identity}:${row.picture_number}`),
  );
  for (let index = 0; ; index++) {
    const picture = schoolPictures[index % schoolPictures.length];
    const number = 1 + Math.floor(index / schoolPictures.length);
    if (used.has(`${picture}:${number}`)) continue;
    const label = picture[0].toUpperCase() + picture.slice(1);
    return {
      picture,
      number,
      scope,
      name: number === 1 ? label : `${label} ${number}`,
    };
  }
}

/** A family's child with no name: a picture identity ("Fox", "Moon 2") from
 * the family's own scope and a birth year, owned by the parent's account.
 * The caller holds the account's learning lock and has checked its consent
 * state and learner room, in the same transaction. */
export async function insertUnnamedChild(
  client: PoolClient,
  accountId: string,
  birthYear: number,
) {
  const identity = await allocatePictureIdentity(client, `family:${accountId}`);
  const learner = {
    id: randomUUID(),
    name: identity.name,
    birthYear,
    namePending: true as const,
    pictureIdentity: identity.picture,
  };
  await client.query(
    // The time it is written, not the transaction's: several children made
    // together keep the order they were given in (learners list by it).
    `INSERT INTO amp_learners(id,account_id,name,birth_year,name_pending,picture_identity,picture_number,identity_scope,created_at)
     VALUES($1,$2,$3,$4,true,$5,$6,$7,clock_timestamp())`,
    [
      learner.id,
      accountId,
      learner.name,
      birthYear,
      identity.picture,
      identity.number,
      identity.scope,
    ],
  );
  return learner;
}
