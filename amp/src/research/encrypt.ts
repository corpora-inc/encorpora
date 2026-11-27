/** The extract is encrypted with age (age-encryption.org/v1) to every named
 * researcher's public key before it leaves the Job, so only a holder of one
 * of their private keys can read it, and the bucket holds ciphertext only.
 * Encryption streams: plaintext never touches a disk. Required by the
 * study's data security plan, and how AMP meets COPPA's security duty for
 * children's data it hands to researchers (16 CFR 312.8). */
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { Encrypter } from "age-encryption";

/** An X25519 (`age1…`) or post-quantum hybrid (`age1pq1…`) recipient. */
const RECIPIENT = /^age1[0-9a-z]+$/;

/** `AMP_RESEARCH_RECIPIENTS`: one or more public keys, separated by commas,
 * spaces or new lines (a mounted file of one key per line works). Lines from
 * `#` on are comments. Fails closed: no key, or anything that isn't one, and
 * nothing is exported. */
export function recipientsFrom(env: NodeJS.ProcessEnv = process.env): string[] {
  const value = env.AMP_RESEARCH_RECIPIENTS ?? "";
  const keys = value
    .split("\n")
    .map((line) => line.replace(/#.*$/, ""))
    .join(" ")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!keys.length) throw new Error("AMP_RESEARCH_RECIPIENTS names no key");
  for (const key of keys) {
    if (key.toUpperCase().startsWith("AGE-SECRET-KEY"))
      throw new Error(
        "AMP_RESEARCH_RECIPIENTS holds a private key; give the public key",
      );
    if (!RECIPIENT.test(key))
      throw new Error(
        "AMP_RESEARCH_RECIPIENTS holds a value that is not an age public key",
      );
    // Parses the key now, so a bad one fails before any data is read.
    new Encrypter().addRecipient(key);
  }
  return [...new Set(keys)];
}

/** The ciphertext of a byte stream, as a Node stream. */
export async function encryptStream(
  plaintext: AsyncIterable<Uint8Array>,
  recipients: readonly string[],
): Promise<Readable> {
  if (!recipients.length) throw new Error("No research recipients");
  const encrypter = new Encrypter();
  for (const recipient of recipients) encrypter.addRecipient(recipient);
  // Pulled one chunk at a time, so the extract is read only as fast as the
  // ciphertext is consumed (the upload paces the database reads).
  const iterator = plaintext[Symbol.asyncIterator]();
  const source = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      async cancel(reason) {
        await iterator.return?.(reason);
      },
    },
    { highWaterMark: 0 },
  );
  const ciphertext = await encrypter.encrypt(source);
  return Readable.fromWeb(
    ciphertext as unknown as WebReadableStream<Uint8Array>,
  );
}
