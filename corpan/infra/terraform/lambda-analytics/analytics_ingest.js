// Anonymous reader analytics ingest.
//
// Privacy contract enforced by THIS code (not policy):
//   1. Source IP and X-Forwarded-For are read ONLY to derive country (when no
//      CloudFront-Viewer-Country header is present, which currently never
//      happens — CF always sets it). They are NEVER written to Firehose and
//      NEVER logged.
//   2. The Lambda function logs only counts and parse errors, never bodies.
//   3. Unknown / oversize / malformed events are dropped silently with a
//      counter increment. Clients always get 204 — never tell a probing
//      adversary which fields are required.
//   4. Schema is allowlist: any field not in ALLOWED_FIELDS is stripped.

const { FirehoseClient, PutRecordBatchCommand } = require("@aws-sdk/client-firehose");

const firehose = new FirehoseClient({});
const STREAM = process.env.FIREHOSE_NAME;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS_PER_REQUEST = 100;
const SCHEMA_VERSION = 1;

const ALLOWED_FIELDS = new Set([
  "schema",
  "ts",
  "session_id",
  "event",
  "reader_id",
  "reader_version",
  "app_version",
  "platform",
  "locale",
  "tz_offset_minutes",
  "book_id",
  "narration_pack_id",
  "language",
  "voice_id",
  "duration_ms",
]);

const ALLOWED_EVENTS = new Set([
  "book_open",
  "book_close",
  "book_heartbeat",
  "language_switch",
  "session_start",
]);

const ALLOWED_PLATFORMS = new Set([
  "ios", "android", "web", "macos", "windows", "linux", "unknown",
]);

const ALLOWED_READERS = new Set(["stargate", "earthgate"]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "Origin",
};

const noContent = () => ({ statusCode: 204, headers: CORS, body: "" });

const getHeader = (event, key) => {
  const headers = event.headers || {};
  const match = Object.keys(headers).find(
    (n) => n.toLowerCase() === key.toLowerCase()
  );
  return match ? headers[match] : undefined;
};

function clampString(v, max) {
  if (typeof v !== "string") return undefined;
  if (v.length > max) return v.slice(0, max);
  return v;
}

function clampInt(v, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.trunc(v);
  if (n < min || n > max) return undefined;
  return n;
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const out = {};
  for (const k of Object.keys(raw)) {
    if (ALLOWED_FIELDS.has(k)) out[k] = raw[k];
  }

  if (out.schema !== SCHEMA_VERSION) return null;
  if (!ALLOWED_EVENTS.has(out.event)) return null;
  if (!ALLOWED_READERS.has(out.reader_id)) return null;

  out.ts = clampString(out.ts, 32);
  if (!out.ts) return null;

  out.session_id = clampString(out.session_id, 64);
  if (!out.session_id) return null;

  out.reader_version = clampString(out.reader_version, 32) || "";
  out.app_version = clampString(out.app_version, 32) || "";

  if (!ALLOWED_PLATFORMS.has(out.platform)) out.platform = "unknown";

  out.locale = clampString(out.locale, 16) || "";
  out.tz_offset_minutes = clampInt(out.tz_offset_minutes, -1440, 1440);

  out.book_id = clampString(out.book_id, 128);
  out.narration_pack_id = clampString(out.narration_pack_id, 128);
  out.language = clampString(out.language, 8);
  out.voice_id = clampString(out.voice_id, 64);
  out.duration_ms = clampInt(out.duration_ms, 0, 24 * 60 * 60 * 1000);

  return out;
}

exports.handler = async (event) => {
  // CORS preflight (Lambda Function URL forwards OPTIONS as a normal invocation)
  if (event.requestContext?.http?.method === "OPTIONS") return noContent();
  if (event.requestContext?.http?.method !== "POST") return noContent();

  const country = clampString(getHeader(event, "cloudfront-viewer-country"), 4) || "";
  const region  = clampString(getHeader(event, "cloudfront-viewer-country-region"), 8) || "";
  const ingestTs = new Date().toISOString();

  const rawBody = event.body || "";
  if (typeof rawBody !== "string" || rawBody.length > MAX_BODY_BYTES) {
    return noContent();
  }

  let parsed;
  try {
    parsed = event.isBase64Encoded
      ? JSON.parse(Buffer.from(rawBody, "base64").toString("utf-8"))
      : JSON.parse(rawBody);
  } catch {
    return noContent();
  }

  const incoming = Array.isArray(parsed?.events)
    ? parsed.events.slice(0, MAX_EVENTS_PER_REQUEST)
    : [parsed];

  const records = [];
  for (const raw of incoming) {
    const ev = sanitize(raw);
    if (!ev) continue;
    ev.country = country;
    ev.country_region = region;
    ev.ingest_ts = ingestTs;
    records.push({ Data: Buffer.from(JSON.stringify(ev) + "\n", "utf-8") });
  }

  if (records.length === 0) return noContent();

  try {
    await firehose.send(new PutRecordBatchCommand({
      DeliveryStreamName: STREAM,
      Records: records,
    }));
    console.log(`ingest ok=${records.length} dropped=${incoming.length - records.length}`);
  } catch (err) {
    console.error(`firehose error: ${err.name} ${err.message}`);
  }
  return noContent();
};
