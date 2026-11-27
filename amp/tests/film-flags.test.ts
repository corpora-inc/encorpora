import { reportEditorialLimit } from "./fixtures/editorial";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  filmFlagReasonLabels,
  filmFlagReasons,
  filmFlagSchema,
  type FilmFlag,
} from "../src/feedback/film-flags.js";
import { FLAG_RATE_LIMIT } from "../src/feedback/problem-flags.js";
import { lessonFilms } from "../src/content/lesson-films.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, type Repository } from "../src/server/repository.js";
import { filmNoteAllowed } from "../src/web/features/films/film-flag.js";

const film = lessonFilms["multiply-fractions"]!;
const body = {
  templateId: "multiply-fractions",
  filmVersion: film.version,
  requestId: "6f1c2f4e-6c1d-4a4b-9a0e-2b6f8d1c0a11",
  seconds: 42.37,
  layout: "tall",
  reasons: ["voice-wrong"],
  client: { kind: "web", viewport: { width: 390, height: 844 } },
};

test("film report labels are short and cover every reason", () => {
  assert.deepEqual(Object.keys(filmFlagReasonLabels), [...filmFlagReasons]);
  assert.deepEqual(Object.values(filmFlagReasonLabels), [
    "Picture looks wrong",
    "Voice sounds wrong",
    "Too fast",
    "Confusing",
    "Other",
  ]);
  for (const label of Object.values(filmFlagReasonLabels))
    reportEditorialLimit(
      label.length <= 20,
      `report label exceeds 20 characters: ${label}`,
    );
});

test("the film report body accepts only known reasons, the moment and the client's own details", () => {
  assert.equal(filmFlagSchema.safeParse(body).success, true);
  assert.equal(
    filmFlagSchema.safeParse({ ...body, problemId: "a".repeat(64) }).success,
    true,
  );
  for (const bad of [
    { ...body, reasons: [] },
    { ...body, reasons: ["voice-wrong", "voice-wrong"] },
    { ...body, reasons: ["wrong-answer"] },
    { ...body, seconds: -1 },
    { ...body, seconds: Number.POSITIVE_INFINITY },
    { ...body, layout: "square" },
    { ...body, filmVersion: "v2" },
    { ...body, templateId: "../etc" },
    // An identifier field never carries words.
    { ...body, problemId: "my name is" },
    { ...body, note: "x".repeat(281) },
    { ...body, filmId: "multiply-fractions--sm" },
    { ...body, viewer: "adult" },
    { ...body, client: { ...body.client, userAgent: "x" } },
    { ...body, webCommit: "HEAD" },
  ])
    assert.equal(
      filmFlagSchema.safeParse(bad).success,
      false,
      JSON.stringify(bad),
    );
});

test("the sheet offers a note to adults and to learners the note rule allows, never to a visitor", () => {
  const year = new Date().getUTCFullYear();
  assert.equal(filmNoteAllowed(null, null), false);
  assert.equal(filmNoteAllowed({ token: "parent-session" }, null), true);
  // A learner's own session follows `noteAllowed`.
  assert.equal(
    filmNoteAllowed({ token: "st_child" }, { birthYear: year - 9 }),
    false,
  );
  assert.equal(
    filmNoteAllowed({ token: "st_teen" }, { birthYear: year - 15 }),
    true,
  );
  assert.equal(
    filmNoteAllowed(
      { token: "st_roster" },
      { birthYear: year - 15, namePending: true },
    ),
    false,
  );
  assert.equal(filmNoteAllowed({ token: "st_unknown" }, null), false);
});

/** The route against a stand-in repository: who sent each report is decided
 * by the credential alone. */
function app(consented = true) {
  const year = new Date().getUTCFullYear();
  const saved: FilmFlag[] = [];
  const learners: Record<string, { birthYear: number; namePending: boolean }> =
    {
      child: { birthYear: year - 8, namePending: false },
      teen: { birthYear: year - 15, namePending: false },
      roster: { birthYear: year - 15, namePending: true },
    };
  const repository = {
    studentAccount: async (token: string) => {
      const learnerId = token.slice(3);
      if (!(learnerId in learners)) return null;
      return {
        accountId: learnerId === "roster" ? "school:p1" : "amp|parent",
        personId: "p1",
        learnerId,
      };
    },
    trialAccount: async (token: string) =>
      token === "t".repeat(24) ? "trial:t1" : null,
    list: async (account: string) =>
      account === "trial:t1" ? [{ id: "trial-learner" }] : [],
    hasConsent: async () => consented,
    transaction: async (
      _account: string,
      learnerId: string,
      run: (tx: unknown) => Promise<unknown>,
    ) =>
      run({
        birthYear: async () => learners[learnerId]!.birthYear,
        namePending: async () => learners[learnerId]!.namePending,
      }),
    saveFilmFlag: async (flag: FilmFlag) => {
      const earlier = saved.find((row) => row.requestId === flag.requestId);
      if (!earlier) {
        saved.push(flag);
        return { id: flag.id };
      }
      return earlier.viewer === flag.viewer &&
        earlier.learnerId === flag.learnerId &&
        earlier.accountId === flag.accountId
        ? { id: earlier.id }
        : null;
    },
  } as unknown as Repository;
  const server = buildApp({
    repository,
    authenticate: async (request) => {
      const header = request.headers.authorization ?? "";
      // A trial is a device's capability under an adult's own sign-in.
      if (header.startsWith("Trial ")) return "amp|trial-owner";
      const token = header.match(/^Bearer (\w+)$/)?.[1];
      if (!token) throw new ApiError(401, "Sign in to continue");
      return `amp|${token}`;
    },
  });
  const send = (
    payload: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) =>
    server.inject({
      method: "POST",
      url: "/api/v1/film-flags",
      headers,
      payload: { ...body, requestId: randomUUID(), ...payload },
    });
  return { server, saved, send };
}

test("a film report records the server's film id, the moment and who sent it, for every viewer", async () => {
  const { server, saved, send } = app();
  try {
    // A visitor who is not signed in: reasons only.
    const visitor = await send({});
    assert.equal(visitor.statusCode, 201, visitor.body);
    assert.equal(visitor.json().recorded, true);
    assert.equal(
      (await send({ note: "Hello" })).json().error,
      "Notes are not available for this viewer",
    );
    // An adult's own sign-in, watching outside a child's session: a note.
    const adult = await send(
      {
        note: "  The voice skips at the second step.  ",
        problemId: "problem-1",
        reasons: ["voice-wrong", "too-fast"],
      },
      { authorization: "Bearer parent" },
    );
    assert.equal(adult.statusCode, 201, adult.body);
    // A child's own session: reasons, linked to them; a note is refused.
    const child = { authorization: "Bearer st_child" };
    assert.equal((await send({}, child)).statusCode, 201);
    assert.equal((await send({ note: "Hi" }, child)).statusCode, 400);
    // A learner 13 or older in a family: a note.
    assert.equal(
      (await send({ note: "Too quiet" }, { authorization: "Bearer st_teen" }))
        .statusCode,
      201,
    );
    // A school's unnamed roster student keeps reasons only.
    assert.equal(
      (await send({ note: "Hi" }, { authorization: "Bearer st_roster" }))
        .statusCode,
      400,
    );
    // A trial: reasons only, linked to its learner.
    const trial = { authorization: `Trial ${"t".repeat(24)}` };
    assert.equal((await send({}, trial)).statusCode, 201);
    assert.equal((await send({ note: "Hi" }, trial)).statusCode, 400);

    const [first, second, third, fourth, fifth] = saved;
    assert.deepEqual(
      saved.map((row) => [row.viewer, row.learnerId, row.accountId, row.note]),
      [
        ["signed-out", null, null, null],
        ["adult", null, "amp|parent", "The voice skips at the second step."],
        ["learner", "child", null, null],
        ["learner", "teen", null, "Too quiet"],
        ["trial", "trial-learner", null, null],
      ],
    );
    assert.ok(first && second && third && fourth && fifth);
    // The film's id is the manifest's, never the client's.
    assert.equal(second.filmId, film.id);
    assert.equal(second.filmVersion, film.version);
    assert.equal(second.templateId, "multiply-fractions");
    assert.equal(second.problemId, "problem-1");
    assert.equal(second.seconds, 42.4);
    assert.equal(second.layout, "tall");
    assert.deepEqual(second.reasons, ["voice-wrong", "too-fast"]);
    assert.equal(second.clientKind, "web");
    assert.deepEqual(second.viewport, { width: 390, height: 844 });
    assert.equal(first.problemId, null);
  } finally {
    await server.close();
  }
});

test("a viewer reports one film many times; a retry is the same report", async () => {
  const { server, saved, send } = app();
  try {
    const parent = { authorization: "Bearer parent" };
    const requestId = randomUUID();
    const sent = await send({ requestId }, parent);
    const retry = await send({ requestId }, parent);
    assert.equal(retry.statusCode, 201);
    assert.equal(retry.json().id, sent.json().id);
    // The same film again, at another moment: a second report, not a refusal.
    const later = await send({ seconds: 90 }, parent);
    assert.equal(later.statusCode, 201);
    assert.notEqual(later.json().id, sent.json().id);
    assert.equal(saved.length, 2);
    // Another viewer can't take over a request id.
    assert.equal((await send({ requestId })).statusCode, 409);
  } finally {
    await server.close();
  }
});

test("an unknown film is refused, a learner without permission is not linked, and a bad sign-in is not a visitor", async () => {
  const { server, saved, send } = app(false);
  try {
    assert.equal((await send({ templateId: "no-such-film" })).statusCode, 404);
    const child = await send({}, { authorization: "Bearer st_teen" });
    assert.equal(child.statusCode, 201);
    assert.deepEqual(
      [saved[0]?.viewer, saved[0]?.learnerId],
      ["learner", null],
    );
    assert.equal(
      (await send({ note: "Hi" }, { authorization: "Bearer st_teen" }))
        .statusCode,
      400,
    );
    // A presented token that signs nobody in fails; it is never a visitor.
    assert.equal(
      (await send({}, { authorization: "Bearer st_gone" })).statusCode,
      401,
    );
  } finally {
    await server.close();
  }
});

test("film reports share the problem reports' limit per credential", async () => {
  const { server, send } = app();
  try {
    let status = 0;
    for (let i = 0; i <= FLAG_RATE_LIMIT && status !== 429; i++)
      status = (await send({}, { authorization: "Bearer limited" })).statusCode;
    assert.equal(status, 429);
  } finally {
    await server.close();
  }
});
