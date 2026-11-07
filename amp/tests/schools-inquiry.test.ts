import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import type { Repository } from "../src/server/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import {
  INQUIRIES_PER_ADDRESS,
  INQUIRY_MAILBOX,
} from "../src/schools/share-routes.js";
import { buildApp } from "../src/server/app.js";

type Mail = { to: string; subject: string; text: string; url: string };
/** The school routes with mail captured. The inquiry never reads the
 * database, so the pool refuses any query. */
async function app(mail: ((sent: Mail) => Promise<void>) | null) {
  const server = buildApp({
    repository: {} as Repository,
    authenticate: async () => {
      throw Object.assign(new Error("unused"), { statusCode: 401 });
    },
  });
  await registerSchoolRoutes(server, {
    pool: {
      query: async () => {
        throw new Error("the inquiry must not read the database");
      },
    } as unknown as Pool,
    authenticate: async () => {
      throw Object.assign(new Error("unused"), { statusCode: 401 });
    },
    services: {
      secret: "fixture".padEnd(48, "-"),
      origin: "https://amp.example",
      ...(mail
        ? {
            mail: (to: string, subject: string, text: string, url: string) =>
              mail({ to, subject, text, url }),
          }
        : {}),
    } as never,
  });
  return server;
}
const inquiry = {
  name: "Fixture Head",
  email: "head@fixture-academy.example",
  school: "Fixture Academy",
  students: 140,
  message: "Three classes to start.",
};
const send = (
  server: Awaited<ReturnType<typeof app>>,
  body: unknown,
  ip = "198.51.100.7",
) =>
  server.inject({
    method: "POST",
    url: "/api/v1/schools/inquiry",
    payload: body as object,
    remoteAddress: ip,
  });

test("an inquiry reaches the company mailbox and nobody else", async () => {
  const sent: Mail[] = [];
  const server = await app(async (mail) => void sent.push(mail));
  const response = await send(server, inquiry);
  assert.equal(response.statusCode, 204);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, INQUIRY_MAILBOX);
  assert.equal(sent[0]!.subject, "School inquiry: Fixture Academy");
  assert.match(sent[0]!.text, /Fixture Head <head@fixture-academy\.example>/);
  assert.match(sent[0]!.text, /Students: 140/);
  assert.match(sent[0]!.text, /Three classes to start\./);
  // Only the fields above: a recipient can't be supplied.
  const relay = await send(server, { ...inquiry, to: "anyone@example.com" });
  assert.equal(relay.statusCode, 400);
  assert.equal(sent.length, 1);
  await server.close();
});

test("a filled trap field is thanked and sends nothing", async () => {
  const sent: Mail[] = [];
  const server = await app(async (mail) => void sent.push(mail));
  const response = await send(server, { ...inquiry, website: "https://spam" });
  assert.equal(response.statusCode, 204);
  assert.equal(sent.length, 0);
  await server.close();
});

test("an inquiry needs a name, an email and a school, on one line each", async () => {
  const server = await app(async () => {});
  for (const body of [
    { ...inquiry, name: "" },
    { ...inquiry, email: "not an address" },
    { ...inquiry, school: "" },
    { ...inquiry, school: "Fixture\nBcc: anyone@example.com" },
    { ...inquiry, students: 0 },
  ]) {
    const response = await send(server, body);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(response.json(), { error: "invalid_school_request" });
  }
  await server.close();
});

test("one address is limited each hour; another still gets through", async () => {
  const sent: Mail[] = [];
  const server = await app(async (mail) => void sent.push(mail));
  for (let i = 0; i < INQUIRIES_PER_ADDRESS; i++)
    assert.equal((await send(server, inquiry, "203.0.113.9")).statusCode, 204);
  const limited = await send(server, inquiry, "203.0.113.9");
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error, "too_many_requests");
  assert.equal((await send(server, inquiry, "203.0.113.10")).statusCode, 204);
  assert.equal(sent.length, INQUIRIES_PER_ADDRESS + 1);
  await server.close();
});

test("without mail, or when it fails, the visitor is told to write", async () => {
  const none = await app(null);
  const absent = await send(none, inquiry);
  assert.equal(absent.statusCode, 503);
  assert.equal(absent.json().error, "mail_unavailable");
  await none.close();
  const failing = await app(async () => {
    throw new Error("provider down");
  });
  const failed = await send(failing, inquiry);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.json().error, "mail_unavailable");
  await failing.close();
});
