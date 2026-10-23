/** Run inside the built API image: no database, listener, or real accounts. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/server/app";
import {
  ApiError,
  type Repository,
  type LearnerTransaction,
} from "../src/server/repository";
import { lessons } from "../src/content/lessons";
import { books } from "../src/books/catalog";
import { verifyPdfRelease } from "./pdf-release";
assert.equal(
  process.getuid?.(),
  65532,
  "Run this check as the API image runtime user",
);
const report = await verifyPdfRelease(
  fileURLToPath(new URL("../artifacts/", import.meta.url)),
);
const fixtures: Record<
  string,
  { learner: string; consent: boolean; access: boolean }
> = {
  owner: {
    learner: "11111111-1111-4111-8111-111111111111",
    consent: true,
    access: true,
  },
  unlicensed: {
    learner: "22222222-2222-4222-8222-222222222222",
    consent: true,
    access: false,
  },
  unconsented: {
    learner: "33333333-3333-4333-8333-333333333333",
    consent: false,
    access: true,
  },
  foreign: {
    learner: "44444444-4444-4444-8444-444444444444",
    consent: true,
    access: true,
  },
};
// Unknown operations throw: downloads without problemId must never write support evidence.
const repository = {
  hasConsent: async (account: string) => fixtures[account]?.consent ?? false,
  transaction: async <T>(
    account: string,
    learner: string,
    run: (tx: LearnerTransaction) => Promise<T>,
  ) => {
    const fixture = fixtures[account];
    if (!fixture || fixture.learner !== learner)
      throw new ApiError(404, "Learner not found");
    const tx = new Proxy(
      { hasAccess: async () => fixture.access },
      {
        get(target, key) {
          if (key === "hasAccess") return target.hasAccess;
          throw new Error(`Unexpected repository operation: ${String(key)}`);
        },
      },
    );
    return run(tx as unknown as LearnerTransaction);
  },
} as unknown as Repository;
const app = buildApp({
  repository,
  development: false,
  authenticate: async (request) => {
    const account = request.headers.authorization?.replace(/^Bearer /, "");
    if (!account || !fixtures[account])
      throw new ApiError(401, "Sign in required");
    return account;
  },
});
let responses = 0;
try {
  const owner = fixtures.owner.learner;
  async function pdf(url: string, method: "GET" | "POST" = "GET") {
    const response = await app.inject({
      method,
      url,
      headers: { authorization: "Bearer owner" },
      ...(method === "POST" ? { payload: {} } : {}),
    });
    assert.equal(response.statusCode, 200, response.body.slice(0, 160));
    assert.match(String(response.headers["content-type"]), /^application\/pdf/);
    assert.match(
      String(response.headers["content-disposition"]),
      /^attachment;/,
    );
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.rawPayload.subarray(0, 5).toString(), "%PDF-");
    responses++;
  }
  for (const lesson of [
    lessons[0],
    lessons[Math.floor(lessons.length / 2)],
    lessons.at(-1)!,
  ])
    for (const kind of ["lesson", "workbook", "solutions"])
      for (const format of ["Letter", "A4"])
        await pdf(
          `/api/v1/learners/${owner}/publications/${lesson.id}/${kind}?format=${format}`,
        );
  for (const { content: book } of books)
    await pdf(`/api/v1/learners/${owner}/books/${book.id}/download`, "POST");
  let denied = 0;
  for (const [method, suffix] of [
    ["GET", `publications/${lessons[0].id}/lesson`],
    ["POST", `books/${books[0].content.id}/download`],
  ] as const) {
    for (const [account, status] of [
      [undefined, 401],
      ["unconsented", 403],
      ["unlicensed", 403],
      ["foreign", 404],
    ] as const) {
      const learner =
        account && account !== "foreign" ? fixtures[account].learner : owner;
      const response = await app.inject({
        method,
        url: `/api/v1/learners/${learner}/${suffix}`,
        headers: account ? { authorization: `Bearer ${account}` } : {},
        ...(method === "POST" ? { payload: {} } : {}),
      });
      assert.equal(
        response.statusCode,
        status,
        `${method} ${account ?? "anonymous"}`,
      );
      denied++;
    }
  }
  console.log(
    JSON.stringify({
      ...report,
      pdfResponses: responses,
      deniedRequests: denied,
      uid: process.getuid?.(),
      databaseUsed: false,
    }),
  );
} finally {
  await app.close();
}
