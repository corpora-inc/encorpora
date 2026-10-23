import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { FastifyReply, FastifyRequest } from "fastify";

const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

type Representation = { body: Buffer; etag: string };
export type PublicJson = {
  identity: Representation;
  gzip: Representation;
};

function representation(body: Buffer): Representation {
  return {
    body,
    etag: `"${createHash("sha256").update(body).digest("hex")}"`,
  };
}

/** Prepare both wire representations once; Fastify sends the buffers unchanged. */
export function publicJson(value: unknown): PublicJson {
  const identity = representation(Buffer.from(JSON.stringify(value)));
  return { identity, gzip: representation(gzipSync(identity.body)) };
}

function selectedEncoding(
  header: string | undefined,
): "identity" | "gzip" | null {
  if (!header) return "identity";
  let wildcard: number | undefined;
  let gzip: number | undefined;
  let identity: number | undefined;
  for (const part of header.split(",")) {
    const [rawCoding, ...parameters] = part.trim().toLowerCase().split(";");
    const coding = rawCoding.trim();
    if (coding !== "gzip" && coding !== "identity" && coding !== "*") continue;
    const quality = parameters.find((parameter) => /^\s*q\s*=/.test(parameter));
    const value =
      quality &&
      /^\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/.exec(quality)?.[1];
    const weight = quality === undefined ? 1 : value ? Number(value) : 0;
    if (coding === "gzip") gzip = weight;
    else if (coding === "identity") identity = weight;
    else wildcard = weight;
  }
  const gzipWeight = gzip ?? wildcard ?? 0;
  const identityWeight = identity ?? wildcard ?? 1;
  if (gzipWeight > 0 && gzipWeight >= identityWeight) return "gzip";
  if (identityWeight > 0) return "identity";
  return null;
}

/** If-None-Match uses weak comparison for GET, including lists and `*`. */
function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const candidate = part.trim();
    return candidate === "*" || candidate.replace(/^W\//, "") === etag;
  });
}

export function sendPublicJson(
  request: FastifyRequest,
  reply: FastifyReply,
  cached: PublicJson,
) {
  const encoding = selectedEncoding(request.headers["accept-encoding"]);
  if (!encoding) return reply.code(406).send({ error: "Not acceptable" });
  const selected = cached[encoding];
  reply
    .type("application/json; charset=utf-8")
    .header("Cache-Control", CACHE_CONTROL)
    .header("ETag", selected.etag)
    .header("Vary", "Accept-Encoding");
  if (encoding === "gzip") reply.header("Content-Encoding", "gzip");
  if (matchesEtag(request.headers["if-none-match"], selected.etag))
    return reply.code(304).send();
  return reply.send(selected.body);
}
