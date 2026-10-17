import { createHmac } from "node:crypto";
import {
  CompactSign,
  compactVerify,
  importPKCS8,
  importSPKI,
  exportSPKI,
  type CryptoKey,
} from "jose";
import { readFile } from "node:fs/promises";
import { packSchema, type OfflinePack } from "./contracts.js";
export interface PackSigner {
  kid: string;
  serviceId: string;
  bind(domain: string, values: readonly string[]): string;
  publicKey: string;
  sign(pack: OfflinePack): Promise<string>;
}
export async function packSigner(
  privatePem: string,
  publicPem: string,
  kid: string,
  serviceId: string,
  bindingKey: Uint8Array,
): Promise<PackSigner> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(kid))
    throw new Error("Invalid offline signing configuration");
  const service = new URL(serviceId);
  if (
    service.protocol !== "https:" ||
    service.username ||
    service.password ||
    service.search ||
    service.hash ||
    serviceId.length > 200 ||
    service.href !== serviceId ||
    bindingKey.byteLength !== 32
  )
    throw new Error("Invalid offline service configuration");
  const secret = Buffer.from(bindingKey);
  const privateKey = await importPKCS8(privatePem, "EdDSA");
  const publicKey = await importSPKI(publicPem, "EdDSA");
  // A mismatched pair fails startup; key material is never included in errors.
  if (
    privateKey.algorithm.name !== "Ed25519" ||
    publicKey.algorithm.name !== "Ed25519"
  )
    throw new Error("Invalid offline signing algorithm");
  const probe = await new CompactSign(new Uint8Array([1]))
    .setProtectedHeader({ alg: "EdDSA" })
    .sign(privateKey);
  await compactVerify(probe, publicKey, { algorithms: ["EdDSA"] });
  return {
    kid,
    serviceId,
    bind(domain, values) {
      return createHmac("sha256", secret)
        .update(JSON.stringify([serviceId, domain, ...values]))
        .digest("hex");
    },
    publicKey: await exportSPKI(publicKey),
    async sign(pack) {
      const payload = new TextEncoder().encode(
        JSON.stringify(packSchema.parse(pack)),
      );
      if (payload.byteLength > 256 * 1024)
        throw new Error("Offline pack exceeds bound");
      return new CompactSign(payload)
        .setProtectedHeader({ alg: "EdDSA", kid, typ: "amp-offline+jws" })
        .sign(privateKey);
    },
  };
}
/** Integrity verification only: caller must enforce identity, expiry and authorization separately. */
export async function verifyPack(
  signed: string,
  publicKey: CryptoKey,
  kid: string,
): Promise<OfflinePack> {
  if (signed.length > 524288) throw new Error("Offline pack exceeds bound");
  const result = await compactVerify(signed, publicKey, {
    algorithms: ["EdDSA"],
  });
  if (
    result.protectedHeader.typ !== "amp-offline+jws" ||
    result.protectedHeader.kid !== kid
  )
    throw new Error("Unexpected offline signature profile");
  return packSchema.parse(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(result.payload),
    ),
  );
}
export async function offlineSigningConfiguration(
  env: NodeJS.ProcessEnv,
): Promise<PackSigner | null> {
  if (env.AMP_OFFLINE_PACKS !== "enabled") return null;
  const {
    AMP_OFFLINE_PRIVATE_KEY_FILE: privatePath,
    AMP_OFFLINE_PUBLIC_KEY_FILE: publicPath,
    AMP_OFFLINE_KEY_ID: kid,
    AMP_OFFLINE_SERVICE_ID: serviceId,
    AMP_OFFLINE_ACCOUNT_BINDING_KEY: bindingKey,
  } = env;
  if (
    !privatePath ||
    !publicPath ||
    !kid ||
    !serviceId ||
    !bindingKey ||
    !/^[A-Za-z0-9+/]{43}=$/.test(bindingKey)
  )
    throw new Error("Offline signing configuration is incomplete");
  try {
    return await packSigner(
      await readFile(privatePath, "utf8"),
      await readFile(publicPath, "utf8"),
      kid,
      serviceId,
      Buffer.from(bindingKey, "base64"),
    );
  } catch {
    throw new Error("Offline signing configuration is invalid");
  }
}

/** Match a verified envelope to a fresh authenticated server preflight. Not an offline clock oracle. */
export function assertPackAuthorization(
  pack: OfflinePack,
  expected: {
    packId: string;
    learnerId: string;
    serviceId: string;
    accountBinding: string;
    authorization: OfflinePack["authorization"];
    expiresAt: string;
  },
): void {
  if (
    pack.packId !== expected.packId ||
    pack.learnerId !== expected.learnerId ||
    pack.serviceId !== expected.serviceId ||
    pack.accountBinding !== expected.accountBinding ||
    pack.expiresAt !== expected.expiresAt ||
    pack.authorization.consentRevision !==
      expected.authorization.consentRevision ||
    pack.authorization.grantBinding !== expected.authorization.grantBinding
  )
    throw new Error("Offline authorization binding mismatch");
}
