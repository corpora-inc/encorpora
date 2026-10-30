import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Authenticator } from "../server/auth.js";
import { advertisingOptOut } from "../advertising/permission-contracts.js";
import { signupIntentSchema } from "./contracts.js";
import {
  completeSignup,
  markSignupVerified,
  createSignupIntent,
  signupCookie,
  unsubscribe,
} from "./repository.js";
export async function registerParentFollowupRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    origin: string;
    authenticate: Authenticator;
    enabled: boolean;
  },
) {
  await app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer");
    });
    scope.setErrorHandler((_error, _request, reply) =>
      reply.code(503).send({ error: "signup_email_unavailable" }),
    );
    scope.post(
      "/api/v1/parent-followup/intent",
      { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
      async (request, reply) => {
        if (request.headers.origin !== options.origin)
          return reply.code(403).send({ error: "origin_not_allowed" });
        if (!options.enabled)
          return reply.code(503).send({ error: "signup_email_unavailable" });
        const intent = signupIntentSchema.safeParse(request.body);
        if (!intent.success)
          return reply.code(400).send({ error: "invalid_signup_intent" });
        if (advertisingOptOut(request.headers)) {
          delete intent.data.campaign;
          delete intent.data.entry;
          delete intent.data.analytics;
        }
        const token = await createSignupIntent(
          options.pool,
          intent.data,
          advertisingOptOut(request.headers)
            ? undefined
            : request.headers.cookie,
        );
        reply.header(
          "Set-Cookie",
          `${signupCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${options.origin.startsWith("https:") ? "; Secure" : ""}`,
        );
        return { ready: true };
      },
    );
    scope.post("/api/v1/parent-followup/complete", async (request, reply) => {
      if (request.headers.origin !== options.origin)
        return reply.code(403).send({ error: "origin_not_allowed" });
      const account = await options.authenticate(request);
      if (options.enabled && account.startsWith("amp|")) {
        await completeSignup(
          options.pool,
          request.headers.cookie,
          account.slice(4),
          request.headers,
        );
        await markSignupVerified(options.pool, account.slice(4));
      }
      reply.header(
        "Set-Cookie",
        `${signupCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${options.origin.startsWith("https:") ? "; Secure" : ""}`,
      );
      return { ready: true };
    });
    // Link scanners may GET a link. Only an explicit form POST unsubscribes.
    scope.get<{ Params: { token: string } }>(
      "/api/v1/parent-followup/unsubscribe/:token",
      async (request, reply) => {
        if (!/^[a-f0-9]{64}$/.test(request.params.token))
          return reply.code(404).send("Link not found");
        return reply
          .header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
          )
          .type("text/html")
          .send(
            `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMP email preferences</title><body style="font:18px system-ui;max-width:36rem;margin:4rem auto;padding:1rem"><h1>Stop optional AMP emails</h1><p>This stops trial reminders, math tips and product news. Your account and free practice stay available. Account security and purchase emails are unchanged.</p><form method="post"><button style="font:inherit;padding:1rem">Unsubscribe</button></form></body></html>`,
          );
      },
    );
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );
    scope.post<{ Params: { token: string } }>(
      "/api/v1/parent-followup/unsubscribe/:token",
      async (request, reply) => {
        await unsubscribe(options.pool, request.params.token);
        return reply
          .type("text/html")
          .send(
            '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><h1>You’re unsubscribed</h1><p>Your AMP account is unchanged. <a href="/sign-in">Return to AMP</a></p></html>',
          );
      },
    );
  });
}
