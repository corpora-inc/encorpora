/**
 * "New user" on `/dev/personas`, development only. The browser signs up a
 * brand-new account through the real sign-up (`PersonaSwitcher.tsx`); this
 * confirms its address, as the emailed link does before a real person first
 * signs in (production requires it: `requireEmailVerification` in
 * src/server/accounts.ts). The seeded "signed-up" persona is confirmed the
 * same way (scripts/design-personas.ts).
 *
 * It lives on the Vite development server, beside the persona switcher it
 * serves: vite.config.ts registers it with `apply: "serve"`, the same gate as
 * `import.meta.env.DEV` that adds `/dev/personas`. A production build has no
 * dev server, so the endpoint does not exist there (tests/dev-new-user.test.ts).
 * It touches only `new-…@personas.amp.test` accounts in a loopback database.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import pg from "pg";
import {
  NEW_USER_CONFIRM_PATH,
  NEW_USER_EMAIL,
} from "../src/web/features/dev/persona-list";

type Query = (
  sql: string,
  values: unknown[],
) => Promise<{ rowCount: number | null }>;
type Next = (error?: unknown) => void;

const send = (response: ServerResponse, status: number, body: object) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 1024) throw new Error("body too large");
  }
  return JSON.parse(text);
}

/** The middleware over a query function (tests pass their own). Null: the
 * dev server was started without a database to confirm in. */
export function newUserConfirmation(query: Query | null) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: Next,
  ) => {
    if ((request.url ?? "").split("?")[0] !== NEW_USER_CONFIRM_PATH)
      return next();
    if (request.method !== "POST")
      return send(response, 405, { error: "POST only" });
    let email: unknown;
    try {
      email = ((await readJson(request)) as { email?: unknown })?.email;
    } catch {
      return send(response, 400, { error: 'Send JSON: {"email": …}' });
    }
    if (typeof email !== "string" || !NEW_USER_EMAIL.test(email))
      return send(response, 400, {
        error: "Only a new-…@personas.amp.test account can be confirmed",
      });
    if (!query)
      return send(response, 503, {
        error:
          "This dev server has no AMP_DATABASE_URL. Start the preview with scripts/design-preview.sh",
      });
    try {
      const updated = await query(
        'UPDATE amp_auth_users SET "emailVerified"=true, "updatedAt"=now() WHERE lower(email)=$1',
        [email],
      );
      if (!updated.rowCount)
        return send(response, 404, { error: `No account ${email}` });
      return send(response, 200, { email, confirmed: true });
    } catch (error) {
      console.error("[dev new user] confirmation failed", error);
      return send(response, 500, {
        error: `Confirming ${email} failed: ${(error as Error).message}`,
      });
    }
  };
}

/** The dev server's middleware over the preview database. A database off
 * loopback is refused at startup: this never reaches a shared one. */
export function devNewUser(databaseUrl: string | undefined) {
  if (!databaseUrl) return newUserConfirmation(null);
  const host = new URL(databaseUrl).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host))
    throw new Error(`New user is loopback-only, not ${host}`);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  return newUserConfirmation((sql, values) => pool.query(sql, values));
}
