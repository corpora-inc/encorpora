import { z } from "zod";
import { entryContextSchema, type EntryContext } from "./entry-context.js";
/** A first-party analytics identifier, never an authentication credential. */
export const VISITOR_KEY = "amp.visitor";
export const FIRST_VISIT_KEY = "amp.visitor.first";
export const TRAFFIC_KEY = "amp.analytics.traffic";
const VISITOR_COOKIE = "amp_analytics_visitor";
const TRAFFIC_COOKIE = "amp_analytics_traffic";
const CONTEXT_COOKIE = "amp_analytics_entry";
const CONTEXT_KEY = "amp.analytics.entry";
const storedContextSchema = z.strictObject({
  visitorId: z.uuidv4(),
  context: entryContextSchema,
  expiresAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AGE = 90 * 86400;
export type IdentityEnvironment = {
  hostname: string;
  protocol: string;
  storage: Pick<Storage, "getItem" | "setItem">;
  readCookie: () => string;
  writeCookie: (value: string) => void;
  randomUUID: () => string;
  now: () => number;
};
function sharedDomain(e: IdentityEnvironment) {
  return (
    e.protocol === "https:" &&
    (e.hostname === "corpora.inc" || e.hostname.endsWith(".corpora.inc"))
  );
}
function readCookie(e: IdentityEnvironment, name: string) {
  try {
    const matches = e
      .readCookie()
      .split(";")
      .map((v) => v.trim())
      .filter((v) => v.startsWith(name + "="));
    return matches.length === 1 ? matches[0].slice(name.length + 1) : undefined;
  } catch {
    return undefined;
  }
}
function writeCookie(e: IdentityEnvironment, name: string, value: string) {
  if (!sharedDomain(e)) return;
  try {
    e.writeCookie(
      `${name}=${value}; Domain=corpora.inc; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`,
    );
  } catch {
    /* Browser storage refusal must not break learning or checkout. */
  }
}
export function createBrowserIdentity(e: IdentityEnvironment) {
  let memory: string | undefined;
  let memoryContext: z.infer<typeof storedContextSchema> | undefined;
  const readContext = (raw: string | undefined | null, visitorId: string) => {
    if (!raw || raw.length > 2048) return;
    try {
      const parsed = storedContextSchema.safeParse(
        JSON.parse(decodeURIComponent(raw)),
      );
      if (
        parsed.success &&
        parsed.data.visitorId === visitorId &&
        parsed.data.expiresAt > e.now()
      )
        return parsed.data;
    } catch {
      /* Ignore malformed storage; never forward its raw contents. */
    }
  };
  return {
    visitor() {
      let local: string | null = null;
      try {
        local = e.storage.getItem(VISITOR_KEY);
      } catch {
        /* Session-only fallback. */
      }
      const cookie = sharedDomain(e)
        ? readCookie(e, VISITOR_COOKIE)
        : undefined;
      const id =
        (cookie && UUID.test(cookie) ? cookie : undefined) ??
        (local && UUID.test(local) ? local : undefined) ??
        memory ??
        e.randomUUID();
      memory = id;
      try {
        e.storage.setItem(VISITOR_KEY, id);
        if (local !== id) e.storage.setItem(FIRST_VISIT_KEY, String(e.now()));
      } catch {
        /* Retain the memory identity while this document is open. */
      }
      writeCookie(e, VISITOR_COOKIE, id);
      return id;
    },
    context(candidate: EntryContext): EntryContext {
      const visitorId = this.visitor();
      const shared = sharedDomain(e)
        ? readContext(readCookie(e, CONTEXT_COOKIE), visitorId)
        : undefined;
      let local: typeof shared;
      try {
        local = readContext(e.storage.getItem(CONTEXT_KEY), visitorId);
      } catch {
        /* Memory fallback. */
      }
      const record = shared ??
        local ??
        (memoryContext?.visitorId === visitorId &&
        memoryContext.expiresAt > e.now()
          ? memoryContext
          : undefined) ?? {
          visitorId,
          context: entryContextSchema.parse(candidate),
          expiresAt: e.now() + MAX_AGE * 1000,
        };
      record.expiresAt = e.now() + MAX_AGE * 1000;
      memoryContext = record;
      const encoded = encodeURIComponent(JSON.stringify(record));
      try {
        e.storage.setItem(CONTEXT_KEY, encoded);
      } catch {
        /* Cookie may still work. */
      }
      writeCookie(e, CONTEXT_COOKIE, encoded);
      return record.context;
    },
    internal() {
      let local = false;
      try {
        local = e.storage.getItem(TRAFFIC_KEY) === "internal";
      } catch {
        /* Cookie may still be available. */
      }
      const shared =
        sharedDomain(e) && readCookie(e, TRAFFIC_COOKIE) === "internal";
      if (local || shared) {
        writeCookie(e, TRAFFIC_COOKIE, "internal");
        return true;
      }
      return false;
    },
  };
}
export function browserIdentity() {
  // Read localStorage inside the methods: access to the property itself can throw.
  return createBrowserIdentity({
    hostname: location.hostname,
    protocol: location.protocol,
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    readCookie: () => document.cookie,
    writeCookie: (value) => {
      document.cookie = value;
    },
    randomUUID: () => crypto.randomUUID(),
    now: () => Date.now(),
  });
}
