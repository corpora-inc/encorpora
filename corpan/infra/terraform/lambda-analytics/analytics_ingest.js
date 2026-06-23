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
//   4. Schema is allowlist on TOP-LEVEL fields (the Glue table columns).
//      Arbitrary additional client props are stuffed into one `props_json`
//      column; they never grow the table schema and never escape sanitization.
//   5. Subdivision-level geo (CloudFront-Viewer-Country-Region) is intentionally
//      NOT read here — country alone is the policy line.

const { FirehoseClient, PutRecordBatchCommand } = require("@aws-sdk/client-firehose");

const firehose = new FirehoseClient({});
const STREAM = process.env.FIREHOSE_NAME;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS_PER_REQUEST = 100;
const MAX_PROPS = 32;
const MAX_PROP_STRING = 256;
const SCHEMA_VERSION = 1;

// Top-level fields → mapped 1:1 to Glue columns. Anything else gets serialized
// into `props_json` for forward-compat without DDL.
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

// Event-name shape — any new client event works without redeploying the Lambda.
// Keeps "garbage" out (random unicode, scripts, etc.) but doesn't gatekeep new
// product events. Adding a column to Glue still requires DDL, but `props_json`
// makes that optional for ad-hoc analyses.
const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;

const ALLOWED_PLATFORMS = new Set([
  "ios", "android", "web", "macos", "windows", "linux", "unknown",
]);

const ALLOWED_READERS = new Set(["stargate", "earthgate", "corpan-app"]);

// CORS — must echo Origin (not "*") to satisfy WebKit when the request comes
// from a custom URI scheme (Tauri WKWebView with `corpan-pack://localhost/...`
// sends `Origin: null`, and WebKit refuses to match `null` against `*`).
// Mirrors the verify_purchase Lambda's pattern.
let _requestOrigin = "*";
const setRequestOrigin = (event) => {
  _requestOrigin = event.headers?.origin ?? event.headers?.Origin ?? "*";
};

const corsHeaders = () => ({
  "access-control-allow-origin": _requestOrigin,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "vary": "Origin",
});

const noContent = () => ({ statusCode: 204, headers: corsHeaders(), body: "" });

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

// Sanitize the `props` bag. Keys must match EVENT_NAME (snake_case) and values
// must be string|number|boolean. Caps total entries + per-string length so a
// rogue client can't inflate Firehose payload.
function sanitizeProps(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  let count = 0;
  for (const k of Object.keys(raw)) {
    if (count >= MAX_PROPS) break;
    if (!EVENT_NAME.test(k)) continue;
    const v = raw[k];
    if (typeof v === "string") {
      out[k] = clampString(v, MAX_PROP_STRING);
      count++;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
      count++;
    } else if (typeof v === "boolean") {
      out[k] = v;
      count++;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const out = {};
  for (const k of Object.keys(raw)) {
    if (ALLOWED_FIELDS.has(k)) out[k] = raw[k];
  }

  if (out.schema !== SCHEMA_VERSION) return null;
  if (typeof out.event !== "string" || !EVENT_NAME.test(out.event)) return null;
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

  // Stuff arbitrary extras into props_json — forward-compat for new event types.
  const props = sanitizeProps(raw.props);
  out.props_json = props ? JSON.stringify(props) : "";

  return out;
}

exports.handler = async (event) => {
  setRequestOrigin(event);

  // CORS preflight — Lambda Function URL / API Gateway both forward OPTIONS here.
  if (event.requestContext?.http?.method === "OPTIONS") return noContent();
  if (event.requestContext?.http?.method !== "POST") return noContent();

  // Country only — region (subdivision) intentionally NOT read or persisted.
  const country = clampString(getHeader(event, "cloudfront-viewer-country"), 4) || "";
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
    ev.ingest_ts = ingestTs;
    records.push({ Data: Buffer.from(JSON.stringify(ev) + "\n", "utf-8") });
  }

  if (records.length === 0) return noContent();

  try {
    const response = await firehose.send(new PutRecordBatchCommand({
      DeliveryStreamName: STREAM,
      Records: records,
    }));
    const failed = response?.FailedPutCount || 0;
    const dropped = incoming.length - records.length;
    console.log(`ingest accepted=${records.length - failed} sanitized_dropped=${dropped} firehose_failed=${failed}`);
  } catch (err) {
    // Errors are an infra problem (throttling, IAM, bad stream), not user data.
    console.error(`firehose error: ${err.name} ${err.message}`);
  }
  return noContent();
};
