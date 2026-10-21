import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

/** A software WebAuthn authenticator: real "none" attestations and ES256
 * assertions, so server tests verify actual ceremonies. */
const b64url = (data: Uint8Array) => Buffer.from(data).toString("base64url");
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest();

/** Minimal CBOR: unsigned/negative integers, byte and text strings, maps. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number) => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    const out = Buffer.alloc(3);
    out[0] = (major << 5) | 25;
    out.writeUInt16BE(length, 1);
    return out;
  };
  if (typeof value === "number")
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array)
    return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  if (value instanceof Map)
    return Buffer.concat([
      head(5, value.size),
      ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]),
    ]);
  throw new Error("unsupported CBOR value");
}

export function softwareAuthenticator(rpID: string, origin: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = randomBytes(16);
  const userHandle = { value: "" };
  let counter = 0;
  const rpHash = sha256(Buffer.from(rpID));
  const client = (type: string, challenge: string, at = origin) =>
    Buffer.from(
      JSON.stringify({ type, challenge, origin: at, crossOrigin: false }),
    );
  return {
    id: b64url(credentialId),
    /** The response `navigator.credentials.create` would return. */
    register(
      options: { challenge: string; user: { id: string } },
      overrides: { challenge?: string; origin?: string } = {},
    ) {
      userHandle.value = options.user.id;
      const cose = cbor(
        new Map<number, unknown>([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, Buffer.from(jwk.x!, "base64url")],
          [-3, Buffer.from(jwk.y!, "base64url")],
        ]),
      );
      const length = Buffer.alloc(2);
      length.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([
        rpHash,
        Buffer.from([0x01 | 0x04 | 0x40]),
        Buffer.alloc(4),
        Buffer.alloc(16),
        length,
        credentialId,
        cose,
      ]);
      const attestationObject = cbor(
        new Map<string, unknown>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData],
        ]),
      );
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(
            client(
              "webauthn.create",
              overrides.challenge ?? options.challenge,
              overrides.origin,
            ),
          ),
          attestationObject: b64url(attestationObject),
          transports: ["internal"],
        },
      };
    },
    /** The response `navigator.credentials.get` would return. */
    assert(options: { challenge: string }) {
      const count = Buffer.alloc(4);
      count.writeUInt32BE(++counter);
      const authenticatorData = Buffer.concat([
        rpHash,
        Buffer.from([0x01 | 0x04]),
        count,
      ]);
      const clientDataJSON = client("webauthn.get", options.challenge);
      const signature = sign(
        "sha256",
        Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
        privateKey,
      );
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          authenticatorData: b64url(authenticatorData),
          clientDataJSON: b64url(clientDataJSON),
          signature: b64url(signature),
          userHandle: userHandle.value,
        },
      };
    },
  };
}
