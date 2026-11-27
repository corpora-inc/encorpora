/** Study IDs: the only key an extract carries (docs/research-export.md).
 *
 * An ID is HMAC-SHA256 under the study-ID key of the study code, the kind of
 * entity and its AMP id, so it is stable across runs of one study, differs
 * between studies, and can't be reversed or recomputed without the key. The
 * key lives in Secret Manager and reaches the export Job as
 * `AMP_RESEARCH_ID_KEY`; without it nothing is exported. */
import { createHmac } from "node:crypto";

/** Crockford base32: no I, L, O or U, so an ID reads aloud and copies cleanly. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 60 bits: 12 characters. Collisions are checked per extract anyway. */
const CHARACTERS = 12;
/** A key shorter than this is a configuration mistake, not a key. */
export const MIN_KEY_BYTES = 32;

export type StudyEntity = "learner" | "family";
const PREFIX: Record<StudyEntity, string> = { learner: "L", family: "F" };

export type StudyIdKey = { readonly bytes: Buffer };

/** Reads the key from the environment. Fails closed: a missing or short key
 * stops the export before it reads anything. */
export function studyIdKeyFrom(
  env: NodeJS.ProcessEnv = process.env,
): StudyIdKey {
  const value = env.AMP_RESEARCH_ID_KEY?.trim();
  if (!value) throw new Error("AMP_RESEARCH_ID_KEY is not set");
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length < MIN_KEY_BYTES)
    throw new Error(
      `AMP_RESEARCH_ID_KEY must be at least ${MIN_KEY_BYTES} bytes`,
    );
  return { bytes };
}

/** `L-7K2M-9QXA-3TJD` for a learner, `F-…` for a family. */
export function studyId(
  key: StudyIdKey,
  study: string,
  entity: StudyEntity,
  id: string,
): string {
  // NUL separators: no study code, kind or id can run into the next.
  const digest = createHmac("sha256", key.bytes)
    .update(`${study}\0${entity}\0${id}`, "utf8")
    .digest();
  let bits = 0n;
  for (const byte of digest.subarray(0, 8)) bits = (bits << 8n) | BigInt(byte);
  bits >>= 64n - BigInt(CHARACTERS * 5);
  let text = "";
  for (let i = CHARACTERS - 1; i >= 0; i--)
    text += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return `${PREFIX[entity]}-${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8)}`;
}

/** One extract's IDs, with a check that no two AMP ids share one. */
export function studyIdMapper(key: StudyIdKey, study: string) {
  const seen = new Map<string, string>();
  return (entity: StudyEntity, id: string) => {
    const value = studyId(key, study, entity, id);
    const owner = `${entity}\0${id}`;
    const previous = seen.get(value);
    if (previous === undefined) seen.set(value, owner);
    else if (previous !== owner)
      throw new Error("Two participants map to one study ID; rotate the key");
    return value;
  };
}
