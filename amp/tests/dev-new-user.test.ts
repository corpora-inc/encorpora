import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveConfig } from "vite";
import { newUserConfirmation } from "../scripts/dev-new-user.ts";
import {
  NEW_USER_CONFIRM_PATH,
  NEW_USER_EMAIL,
  newUserEmail,
} from "../src/web/features/dev/persona-list.ts";

const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
const pluginNames = async (command: "build" | "serve") =>
  (
    await resolveConfig(
      { configFile, logLevel: "silent" },
      command,
      command === "build" ? "production" : "development",
    )
  ).plugins.map((plugin) => plugin.name);

test("a production build never registers the New user endpoint; only the dev server does", async () => {
  // The same gate as `import.meta.env.DEV`, which adds /dev/personas.
  assert.ok((await pluginNames("serve")).includes("amp-dev-new-user"));
  assert.ok(!(await pluginNames("build")).includes("amp-dev-new-user"));
});

test("New user addresses are unique, on the persona domain", () => {
  const email = newUserEmail(1763300000000);
  assert.equal(email, "new-1763300000000@personas.amp.test");
  assert.match(email, NEW_USER_EMAIL);
  for (const other of [
    "signed-up@personas.amp.test",
    "family@personas.amp.test",
    "new-1@example.com",
    "new-1@personas.amp.test.evil.com",
  ])
    assert.doesNotMatch(other, NEW_USER_EMAIL, other);
});

type Answer = { status: number; body: { error?: string } } | "next";
async function call(
  middleware: ReturnType<typeof newUserConfirmation>,
  method: string,
  url: string,
  body?: unknown,
): Promise<Answer> {
  const request = Readable.from(
    body === undefined ? [] : [JSON.stringify(body)],
  ) as unknown as IncomingMessage;
  Object.assign(request, { method, url });
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      setHeader() {},
      end(text: string) {
        resolve({ status: response.statusCode, body: JSON.parse(text) });
      },
    } as unknown as ServerResponse;
    void middleware(request, response, () => resolve("next"));
  });
}

test("the endpoint confirms only a new-…@personas.amp.test account, by POST", async () => {
  const queries: unknown[][] = [];
  const confirm = newUserConfirmation(async (_sql, values) => {
    queries.push(values);
    return { rowCount: values[0] === "new-1@personas.amp.test" ? 1 : 0 };
  });
  assert.equal(await call(confirm, "POST", "/api/auth/sign-up/email"), "next");
  assert.equal(
    ((await call(confirm, "GET", NEW_USER_CONFIRM_PATH)) as { status: number })
      .status,
    405,
  );
  for (const email of ["family@personas.amp.test", "new-1@example.com", 7])
    assert.equal(
      (
        (await call(confirm, "POST", NEW_USER_CONFIRM_PATH, { email })) as {
          status: number;
        }
      ).status,
      400,
      String(email),
    );
  assert.deepEqual(queries, []);
  assert.deepEqual(
    await call(confirm, "POST", NEW_USER_CONFIRM_PATH, {
      email: "new-1@personas.amp.test",
    }),
    {
      status: 200,
      body: { email: "new-1@personas.amp.test", confirmed: true },
    },
  );
  assert.equal(
    (
      (await call(confirm, "POST", NEW_USER_CONFIRM_PATH, {
        email: "new-2@personas.amp.test",
      })) as { status: number }
    ).status,
    404,
  );
});

test("without a database the endpoint says how to start the preview", async () => {
  const answer = await call(
    newUserConfirmation(null),
    "POST",
    NEW_USER_CONFIRM_PATH,
    { email: "new-1@personas.amp.test" },
  );
  assert.ok(answer !== "next");
  assert.equal(answer.status, 503);
  assert.match(String(answer.body.error), /design-preview\.sh/);
});
