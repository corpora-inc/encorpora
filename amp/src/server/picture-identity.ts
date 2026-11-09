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
