import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import type { LinkedMessage } from "../src/email/email.js";
import {
  PILOT_NOTICES_PER_HOUR,
  PILOT_SIGNUPS_PER_ADDRESS,
  registerResearchPilotRoutes,
} from "../src/research/pilot-routes.js";
import { INQUIRY_MAILBOX } from "../src/schools/share-routes.js";
import { buildApp } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";

type Mail = { to: string; subject: string; text: string };
const ORIGIN = "https://amp.example";

/** The route with the database and mail captured. */
async function app(options: { mail?: boolean; failMail?: boolean } = {}) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const sent: Mail[] = [];
  const server = buildApp({
    repository: {} as Repository,
    authenticate: async () => {
      throw Object.assign(new Error("unused"), { statusCode: 401 });
    },
  });
  await registerResearchPilotRoutes(server, {
    pool: {
      query: async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows: [{ returning: false, total: "7" }] };
      },
    } as unknown as Pool,
    origins: [ORIGIN],
    origin: ORIGIN,
    ...(options.mail === false
      ? {}
      : {
          mail: async (to: string, { subject, text }: LinkedMessage) => {
            if (options.failMail) throw new Error("mail down");
            sent.push({ to, subject, text });
          },
        }),
  });
  return { server, queries, sent };
}

const signup = {
  role: "parent",
  name: "Fixture Parent",
  email: "parent@fixture.example",
  learners: 2,
  bands: ["6-8", "3-5", "3-5"],
  setting: "home",
  place: "AZ",
  tests: ["map"],
  source: "A homeschool co-op",
  news: true,
};
const post = (
  server: Awaited<ReturnType<typeof app>>["server"],
  body: unknown,
  {
    ip = "198.51.100.7",
    origin = ORIGIN,
  }: { ip?: string; origin?: string } = {},
) =>
  server.inject({
    method: "POST",
    url: "/api/v1/research/pilot",
    payload: body as object,
    remoteAddress: ip,
    headers: { origin },
  });

test("a sign-up is saved and the company mailbox hears of it", async () => {
  const { server, queries, sent } = await app();
  const response = await post(server, signup);
  assert.equal(response.statusCode, 204);
  assert.equal(queries.length, 1);
  const values = queries[0]!.values;
  assert.equal(values[0], "parent@fixture.example");
  // Grades are stored once each, in the order offered.
  assert.deepEqual(values[4], ["3-5", "6-8"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, INQUIRY_MAILBOX);
  assert.equal(sent[0]!.subject, "Pilot list: 7 signed up");
  assert.match(sent[0]!.text, /Fixture Parent <parent@fixture\.example>/);
  assert.match(sent[0]!.text, /Learners: 2, grades 3–5, 6–8/);
  assert.match(sent[0]!.text, /Where: Arizona/);
  assert.match(sent[0]!.text, /Tests: MAP Growth/);
  await server.close();
});

test("the form never mails the person who signed up, or anyone they name", async () => {
  const { server, sent } = await app();
  const relay = await post(server, { ...signup, to: "anyone@example.com" });
  assert.equal(relay.statusCode, 400);
  assert.deepEqual(await relay.json(), { error: "invalid_pilot_signup" });
  await post(server, signup);
  assert.deepEqual(
    sent.map((mail) => mail.to),
    [INQUIRY_MAILBOX],
  );
  await server.close();
});

test("a filled trap field is thanked and nothing is saved", async () => {
  const { server, queries, sent } = await app();
  const response = await post(server, { ...signup, website: "spam.example" });
  assert.equal(response.statusCode, 204);
  assert.equal(queries.length, 0);
  assert.equal(sent.length, 0);
  await server.close();
});

test("a sign-up needs its required answers", async () => {
  const { server, queries } = await app();
  for (const body of [
    { ...signup, email: "not-an-address" },
    { ...signup, bands: [] },
    { ...signup, learners: 0 },
    { ...signup, place: "ZZ" },
    { ...signup, setting: "moon" },
    { ...signup, name: "two\nlines" },
  ])
    assert.equal((await post(server, body)).statusCode, 400);
  assert.equal(queries.length, 0);
  await server.close();
});

test("another site can't post the form", async () => {
  const { server, queries } = await app();
  const response = await post(server, signup, {
    origin: "https://elsewhere.example",
  });
  assert.equal(response.statusCode, 403);
  assert.equal(queries.length, 0);
  await server.close();
});

test("one address is limited per hour", async () => {
  const { server } = await app();
  for (let i = 0; i < PILOT_SIGNUPS_PER_ADDRESS; i++)
    assert.equal(
      (await post(server, { ...signup, email: `p${i}@fixture.example` }))
        .statusCode,
      204,
    );
  const over = await post(server, signup);
  assert.equal(over.statusCode, 429);
  assert.equal(
    (await post(server, signup, { ip: "198.51.100.8" })).statusCode,
    204,
  );
  await server.close();
});

test("the entry is kept when the notice can't send, or there is no mail", async () => {
  for (const options of [{ failMail: true }, { mail: false }]) {
    const { server, queries } = await app(options);
    assert.equal((await post(server, signup)).statusCode, 204);
    assert.equal(queries.length, 1);
    await server.close();
  }
});

test("past the hourly notices, sign-ups are still saved and the inbox stays quiet", async () => {
  const { server, queries, sent } = await app();
  for (let i = 0; i < PILOT_NOTICES_PER_HOUR + 3; i++)
    assert.equal(
      (
        await post(
          server,
          { ...signup, email: `n${i}@fixture.example` },
          { ip: `198.51.${Math.floor(i / 4)}.${i % 4}` },
        )
      ).statusCode,
      204,
    );
  assert.equal(queries.length, PILOT_NOTICES_PER_HOUR + 3);
  assert.equal(sent.length, PILOT_NOTICES_PER_HOUR);
  await server.close();
});
