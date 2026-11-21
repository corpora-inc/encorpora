import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { AccountMail, LinkedMessage } from "../email/email.js";
import { fixedWindow } from "../server/rate-limits.js";
import { forgedPost } from "../schools/request-origin.js";
import { limited } from "../schools/sign-in-routes.js";
import { INQUIRY_MAILBOX } from "../schools/share-routes.js";
import {
  pilotBands,
  pilotInterestSchema,
  pilotPlaces,
  pilotRoles,
  pilotSettings,
  pilotTests,
  type PilotInterestRow,
} from "./pilot.js";

/** Sign-ups per address per hour: a person signs up once, a family with two
 * adults twice. */
export const PILOT_SIGNUPS_PER_ADDRESS = 5;
/** Notices to the mailbox per hour, from everyone. Past it, sign-ups are still
 * saved and only the notices stop: a burst from many addresses can't close the
 * form to real people, nor fill the inbox. */
export const PILOT_NOTICES_PER_HOUR = 60;

/** The notice to the company mailbox: who joined, and how long the list is.
 * The person who signed up gets no mail from this form, so it can't be used to
 * send mail to anyone; the study writes to them when enrolment opens. */
export function pilotSignupNotice(
  signup: Omit<PilotInterestRow, "website">,
  listed: { total: number; returning: boolean },
  origin: string,
): LinkedMessage {
  const names = <T extends Record<string, string>>(
    choices: T,
    picked: readonly string[],
  ) => picked.map((key) => choices[key] ?? key).join(", ");
  return {
    subject: `${listed.returning ? "Pilot list updated" : "Pilot list"}: ${listed.total} signed up`,
    text: [
      `${signup.name ? `${signup.name} <${signup.email}>` : signup.email} ${listed.returning ? "updated their entry" : "joined the pilot interest list"}.`,
      "",
      `Who: ${pilotRoles[signup.role]}`,
      `Learners: ${signup.learners}, grades ${names(pilotBands, signup.bands)}`,
      `Setting: ${pilotSettings[signup.setting]}`,
      `Where: ${pilotPlaces[signup.place] ?? signup.place}`,
      `Tests: ${signup.tests.length ? names(pilotTests, signup.tests) : "none given"}`,
      signup.source ? `Heard from: ${signup.source}` : "",
      `AMP news: ${signup.news ? "yes" : "no"}`,
    ]
      .filter((line, index) => index < 2 || line)
      .join("\n"),
    url: `${origin}/research/pilot`,
    action: "Open the pilot page",
  };
}

/** Adds or updates one person's entry, by email. Says whether they were on
 * the list already, and how many are on it now. */
export async function savePilotInterest(
  pool: Pick<Pool, "query">,
  signup: Omit<PilotInterestRow, "website">,
) {
  const { rows } = await pool.query<{ returning: boolean; total: string }>(
    `WITH saved AS (
       INSERT INTO amp_research_pilot_interest
         (email,name,role,learners,bands,setting,place,tests,source,news)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT ((lower(email))) DO UPDATE SET
         email=EXCLUDED.email, name=COALESCE(EXCLUDED.name,
           amp_research_pilot_interest.name),
         role=EXCLUDED.role, learners=EXCLUDED.learners, bands=EXCLUDED.bands,
         setting=EXCLUDED.setting, place=EXCLUDED.place, tests=EXCLUDED.tests,
         source=COALESCE(EXCLUDED.source, amp_research_pilot_interest.source),
         news=EXCLUDED.news, updated_at=now()
       RETURNING (xmax <> 0) AS returning
     )
     SELECT saved.returning,
       (SELECT count(*) FROM amp_research_pilot_interest)
         + CASE WHEN saved.returning THEN 0 ELSE 1 END AS total
     FROM saved`,
    [
      signup.email,
      signup.name ?? null,
      signup.role,
      signup.learners,
      signup.bands,
      signup.setting,
      signup.place,
      signup.tests,
      signup.source ?? null,
      signup.news,
    ],
  );
  const row = rows[0]!;
  return { returning: row.returning, total: Number(row.total) };
}

/** Public: the form on `/research/pilot`. */
export async function registerResearchPilotRoutes(
  app: FastifyInstance,
  options: {
    pool: Pick<Pool, "query">;
    /** Every origin AMP's pages are served from (request-origin.ts). */
    origins: readonly string[];
    origin: string;
    mail?: AccountMail;
  },
) {
  const hourly = fixedWindow(60 * 60_000);
  await app.register(async (scope) => {
    scope.addHook("onRequest", async (request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff");
      if (forgedPost(request, options.origins, true))
        return reply.code(403).send({ error: "request_origin_invalid" });
    });
    scope.setErrorHandler((error, request, reply) => {
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_pilot_signup" });
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      if (status === 429)
        return reply.code(429).send({ error: "too_many_requests" });
      if (status >= 400 && status < 500)
        return reply.code(status).send({ error: "invalid_pilot_signup" });
      // The code only: a database error's detail can quote the row.
      request.log.error(
        { code: (error as { code?: string }).code ?? null },
        "Pilot signup not saved",
      );
      return reply.code(503).send({ error: "pilot_signup_unavailable" });
    });
    scope.post(
      "/api/v1/research/pilot",
      { ...limited, bodyLimit: 8192 },
      async (request, reply) => {
        const { website, ...signup } = pilotInterestSchema.parse(request.body);
        if (website) return reply.code(204).send();
        if (
          !hourly.consume(`address:${request.ip}`, PILOT_SIGNUPS_PER_ADDRESS)
        ) {
          reply.header("Retry-After", 3600);
          return reply.code(429).send({ error: "too_many_requests" });
        }
        const listed = await savePilotInterest(options.pool, signup);
        // The entry is saved; a notice that doesn't send loses nothing.
        if (hourly.consume("notices", PILOT_NOTICES_PER_HOUR))
          await options
            .mail?.(
              INQUIRY_MAILBOX,
              pilotSignupNotice(signup, listed, options.origin),
            )
            .catch((error: Error) =>
              console.error("[research] pilot signup notice not sent", {
                message: error.message,
              }),
            );
        return reply.code(204).send();
      },
    );
  });
}
