import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { ConsentPolicy, ConsentStage } from "./contracts.js";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");
export const noticeDigest = (policy: ConsentPolicy): string =>
  digest(policy.notice);
export class ConsentSecrets {
  private encryption: Buffer;
  private challenge: Buffer;
  private address: Buffer;
  constructor(secret: Buffer) {
    if (secret.length !== 32)
      throw new Error("Consent secret must be 32 random bytes");
    const key = (purpose: string) =>
      Buffer.from(
        hkdfSync(
          "sha256",
          secret,
          Buffer.from("amp-consent-v1"),
          Buffer.from(purpose),
          32,
        ),
      );
    this.encryption = key("recipient");
    this.challenge = key("challenge");
    this.address = key("address-binding");
  }
  addressHash(email: string): string {
    return createHmac("sha256", this.address).update(email).digest("hex");
  }
  token(
    binding: {
      id: string;
      account: string;
      nonce: string;
      emailHash: string;
      noticeHash: string;
    },
    stage: ConsentStage,
  ): string {
    return createHmac("sha256", this.challenge)
      .update(canonical({ ...binding, stage }))
      .digest("base64url");
  }
  encrypt(email: string, requestId: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.encryption, iv);
    cipher.setAAD(Buffer.from(requestId));
    const encrypted = Buffer.concat([
      cipher.update(email, "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64url",
    );
  }
  decrypt(value: string, requestId: string): string {
    const data = Buffer.from(value, "base64url");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.encryption,
      data.subarray(0, 12),
    );
    cipher.setAAD(Buffer.from(requestId));
    cipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      cipher.update(data.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
}
export function tokenMatches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
