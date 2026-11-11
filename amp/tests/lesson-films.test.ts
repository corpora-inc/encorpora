import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templates } from "../src/math/engine";
import { buildApp } from "../src/server/app";
import type { Repository } from "../src/server/repository";
import { trialLimits } from "../src/server/trials";
import {
  filmForClient,
  filmManifestSchema,
  FILM_CAPABILITY,
  lessonFilmFor,
  lessonFilms,
} from "../src/content/lesson-films";
import {
  approvedIds,
  committedApprovalIds,
  assertReviewedFiles,
  canonical,
  filmCapability,
  filmManifest,
  planFilm,
  publishFilms,
  screenplayFromExport,
} from "../film/publication";
import { scriptSchema } from "../film/schema";
import { templateOf } from "../film/cast";
import { buildCorpus } from "../src/search/corpus";

const script = {
  id: "count-objects",
  title: "Count objects",
  shots: [
    { beats: [{ say: "One dot.", do: [{ do: "text", text: "One dot." }] }] },
  ],
};
const timing = {
  duration: 3,
  shots: [
    [
      {
        start: 0.5,
        end: 2,
        words: [
          { text: "One", start: 0.5, end: 1 },
          { text: "dot.", start: 1.1, end: 2 },
        ],
      },
    ],
  ],
};
const exported = () => ({
  id: script.id,
  title: script.title,
  problemType: script.id,
  script: structuredClone(script),
  timing: structuredClone(timing),
  figure: null,
  note: "Private review annotation",
});
const audio = Buffer.from("0000ftyp0000000000000000");
const plan = (source: unknown = exported(), bytes = audio) =>
  planFilm(script.id, source, script, bytes, new Set([script.id]));
/** The same film with a shot that draws its own app figure: only a v3 player can draw it. */
const sceneScript = {
  ...script,
  shots: [
    {
      figure: {
        scene: {
          v: 1,
          elements: [
            { type: "barChart", id: "c", bars: [{ label: "Dots", value: 1 }], max: 2, step: 1 },
          ],
        },
      },
      beats: [
        {
          say: "One dot.",
          do: [{ do: "scene", actions: [{ do: "highlight", target: "c.bar.0" }] }],
        },
      ],
    },
  ],
};
const scenePlan = () =>
  planFilm(
    script.id,
    { ...exported(), script: structuredClone(sceneScript) },
    sceneScript,
    audio,
    new Set([script.id]),
  );
/** Problem types for films that teach several of them. */
const skillTypes = new Set([
  "compare-groups",
  "dot-group-compared-to-number",
  "count-objects",
  "count-out-objects",
]);
/**
 * A film `id` whose committed screenplay teaches `teaches`. The export is the
 * reviewed edition, voiced before `teaches` was written: listing problem types
 * never sends a film back to review.
 */
const skillPlan = (
  id: string,
  teaches?: string[],
  source: object = script,
) => {
  const reviewed = { ...structuredClone(source), id };
  return planFilm(
    id,
    { ...exported(), id, problemType: templateOf(id).template, script: reviewed },
    { ...reviewed, ...(teaches ? { teaches } : {}) },
    audio,
    skillTypes,
  );
};
const manifestOf = async (plans: ReturnType<typeof skillPlan>[]) => {
  let written: Record<string, { id: string }> = {};
  await publishFilms(plans, async () => {}, async () => {}, async (manifest) => {
    written = manifest;
  });
  return Object.fromEntries(Object.entries(written).map(([type, film]) => [type, film.id]));
};

test("publication accepts only current explicit approvals", () => {
  assert.deepEqual(
    approvedIds(
      {
        approved: { grade: "approved", added: "a" },
        stale: { grade: "approved", added: "old" },
        rejected: { grade: "rejected", added: "a" },
        missing: { grade: "approved" },
      },
      [
        { id: "approved", added: "a" },
        { id: "stale", added: "new" },
        { id: "rejected", added: "a" },
        { id: "missing" },
      ],
    ),
    ["approved"],
  );
});
test("new approvals cannot block or enter a committed publication batch", async () => {
  const grades = {
    "count-objects": { grade: "approved", added: "edition" },
    "new-film": { grade: "approved", added: "edition" },
    rejected: { grade: "rejected", added: "edition" },
  };
  const rows = Object.keys(grades).map((id) => ({ id, added: "edition" }));
  const paths = new Set([
    "amp/film/lessons/count-objects.json",
    "amp/film/lessons/rejected.json",
  ]);
  const selection = committedApprovalIds(grades, rows, paths);
  assert.deepEqual(selection, { ids: ["count-objects"], pending: ["new-film"] });
  let written: unknown;
  await publishFilms(
    selection.ids.map(() => plan()),
    async () => {},
    async () => {},
    async (manifest) => { written = Object.keys(manifest); },
  );
  assert.deepEqual(written, ["count-objects"]);
  paths.add("amp/film/lessons/new-film.json");
  assert.deepEqual(committedApprovalIds(grades, rows, paths), {
    ids: ["count-objects", "new-film"], pending: [],
  });
});
test("a failed re-export cannot reuse approval for older bytes", () => {
  const approval = {
    added: "2026-01-01T10:00:00Z",
    at: "2026-01-01T10:05:00Z",
    grade: "approved",
  };
  assert.doesNotThrow(() =>
    assertReviewedFiles(approval, [Date.parse(approval.added)]),
  );
  assert.throws(
    () => assertReviewedFiles(approval, [Date.parse(approval.at) + 1]),
    /reviewed edition/,
  );
  assert.throws(() => assertReviewedFiles({}, [0]), /timestamps/);
  const archive = { ...approval, at: "2025-12-31T10:00:00Z" };
  assert.doesNotThrow(() =>
    assertReviewedFiles(archive, [Date.parse(archive.added) + 2000]),
  );
  assert.throws(
    () => assertReviewedFiles(archive, [Date.parse(archive.added) + 6000]),
    /reviewed edition/,
  );
});
test("publication compares the actual committed screenplay and validates bindings and timing", () => {
  const changed = exported();
  changed.script.shots[0]!.beats[0]!.say = "Two dots.";
  assert.throws(() => plan(changed), /committed screenplay/);
  assert.throws(() => plan({ ...exported(), problemType: "other" }), /binding/);
  const bad = exported();
  bad.timing.shots[0]![0]!.end = 8;
  assert.throws(() => plan(bad), /timing/);
  assert.throws(() => plan(exported(), Buffer.from("bad")), /AAC/);
});
test("content versions change with data or audio, never with private annotations", () => {
  const a = plan();
  assert.equal(
    a.film.version,
    plan({ ...exported(), note: "different" }).film.version,
  );
  assert.ok(!a.data.toString().includes("Private"));
  assert.notEqual(
    a.film.version,
    plan(exported(), Buffer.concat([audio, Buffer.from("x")])).film.version,
  );
  const changed = exported();
  changed.timing.duration = 4;
  assert.notEqual(a.film.version, plan(changed).film.version);
});
test("legacy cast descriptors require the exact recorded voice binding", () => {
  const cast = { teacher: { voice: "J3Ei0Lj6fAobhIqY5ySH", name: "Paul" } };
  const source = {
    ...exported(),
    script: { ...script, cast },
    timing: { ...timing, voices: { teacher: "J3Ei0Lj6fAobhIqY5ySH" } },
  };
  assert.deepEqual(screenplayFromExport(source).cast, { teacher: {} });
  assert.throws(
    () => screenplayFromExport({ ...source, timing }),
    /recorded voices/,
  );
});
test("publication fails closed for unrecorded casts and unapproved voices", () => {
  const source = {
    ...exported(),
    script: { ...script, cast: { teacher: {} } },
  };
  assert.throws(
    () =>
      planFilm(script.id, source, source.script, audio, new Set([script.id])),
    /Missing recorded cast/,
  );
  assert.throws(
    () =>
      plan({
        ...exported(),
        timing: { ...timing, voices: { narrator: "unknown" } },
      }),
    /approved voice/,
  );
});
test("all media readbacks precede the manifest write; failure preserves the previous manifest", async () => {
  const events: string[] = [];
  await publishFilms(
    [plan()],
    async () => {
      events.push("upload");
    },
    async () => {
      events.push("verify");
    },
    async () => {
      events.push("manifest");
    },
  );
  assert.deepEqual(events, [
    "upload",
    "upload",
    "verify",
    "verify",
    "manifest",
  ]);
  let written = false;
  await assert.rejects(
    publishFilms(
      [plan()],
      async () => {},
      async () => {
        throw Error("CDN failed");
      },
      async () => {
        written = true;
      },
    ),
    /CDN failed/,
  );
  assert.equal(written, false);
  let uploaded = false;
  await assert.rejects(
    publishFilms(
      [plan(), plan()],
      async () => {
        uploaded = true;
      },
      async () => {},
      async () => {},
    ),
    /Multiple approved/,
  );
  assert.equal(uploaded, false);
  let empty: unknown;
  await publishFilms(
    [],
    async () => {
      assert.fail("No upload for an empty catalog");
    },
    async () => {},
    async (manifest) => {
      empty = manifest;
    },
  );
  assert.deepEqual(
    empty,
    {},
    "Rejecting all films can withdraw the published catalog",
  );
});
test("committed manifest resolves real problem types, committed screenplays and immutable URLs", () => {
  for (const [id, film] of Object.entries(lessonFilms)) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    const committed = JSON.parse(
      readFileSync(
        new URL(`../film/lessons/${film.id}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.equal(committed.id, film.id);
    assert.equal(committed.title, film.title);
    // Listed under its own problem type, or one its screenplay teaches.
    assert.ok(
      templateOf(film.id).template === id || committed.teaches?.includes(id),
      `${id} → ${film.id}`,
    );
    assert.equal(lessonFilmFor(id), undefined);
    assert.equal(lessonFilmFor(id, "future-unsupported"), undefined);
    assert.equal(lessonFilmFor(id, FILM_CAPABILITY), film);
    // The manifest records the oldest player that can draw the committed screenplay.
    assert.equal(film.capability, filmCapability(scriptSchema.parse(committed)), id);
    assert.equal(film.editions[0]?.voices && Object.keys(film.editions[0].voices).length > 0, true);
    if (film.capability === "lesson-film-v3") {
      assert.equal(lessonFilmFor(id, "lesson-film-v2"), undefined);
      assert.equal(lessonFilmFor(id, "lesson-film-v1"), undefined);
      continue;
    }
    assert.equal(lessonFilmFor(id, "lesson-film-v2"), film);
    const v1 = lessonFilmFor(id, "lesson-film-v1");
    assert.ok(v1);
    assert.equal(v1.capability, "lesson-film-v1");
    assert.equal("editions" in v1, false);
    assert.equal(v1.dataUrl, film.dataUrl);
  }
  const film = plan().film;
  assert.throws(() =>
    filmManifestSchema.parse({
      [script.id]: { ...film, audioUrl: "https://example.com/audio.m4a" },
    }),
  );
  assert.equal(canonical({ a: 1, b: 2 }), canonical({ b: 2, a: 1 }));
});
test("a film with a shot's own app figure is published for v3 players only", () => {
  const v2 = plan().film;
  const v3 = scenePlan().film;
  assert.equal(v2.capability, "lesson-film-v2");
  assert.equal(v3.capability, "lesson-film-v3");
  assert.doesNotThrow(() => filmManifestSchema.parse({ [script.id]: v3 }));
  // An example shot still plays on v2 players; only a shot's own scene needs v3.
  assert.equal(
    filmCapability(scriptSchema.parse({ ...script, shots: [{ ...script.shots[0], figure: { example: true } }] })),
    "lesson-film-v2",
  );
  for (const capability of [undefined, "future-unsupported", "lesson-film-v1", "lesson-film-v2"])
    assert.equal(filmForClient(v3, capability), undefined, String(capability));
  assert.equal(filmForClient(v3, FILM_CAPABILITY), v3);
  // Films without one keep reaching older players, unchanged.
  assert.equal(filmForClient(v2, FILM_CAPABILITY), v2);
  assert.equal(filmForClient(v2, "lesson-film-v2"), v2);
  assert.equal(filmForClient(v2, "lesson-film-v1")?.capability, "lesson-film-v1");
  assert.equal(FILM_CAPABILITY, "lesson-film-v3");
});
test("a film is linked from its own problem type and every problem type it teaches", async () => {
  const film = skillPlan("compare-groups--sk", ["dot-group-compared-to-number", "count-objects"]);
  assert.deepEqual(film.teaches, ["dot-group-compared-to-number", "count-objects"]);
  const uploads: string[] = [];
  let written: Record<string, unknown> = {};
  await publishFilms(
    [film],
    async (url) => {
      uploads.push(url);
    },
    async () => {},
    async (manifest) => {
      written = manifest;
    },
  );
  // One film, uploaded once, is the same entry under every key.
  assert.deepEqual(Object.keys(written), ["compare-groups", "count-objects", "dot-group-compared-to-number"]);
  for (const entry of Object.values(written)) assert.equal(entry, film.film);
  assert.deepEqual(uploads, [film.film.dataUrl, film.film.audioUrl]);
  assert.doesNotThrow(() => filmManifestSchema.parse(written));
  // The capability gate is the entry's own: a v3 film stays v3 under every key.
  const v3 = filmManifest([skillPlan("compare-groups--sk", ["dot-group-compared-to-number"], sceneScript)]).manifest;
  assert.deepEqual(Object.keys(v3), ["compare-groups", "dot-group-compared-to-number"]);
  for (const entry of Object.values(v3)) {
    assert.equal(entry.capability, "lesson-film-v3");
    assert.equal(filmForClient(entry, FILM_CAPABILITY), entry);
    for (const older of [undefined, "lesson-film-v1", "lesson-film-v2"])
      assert.equal(filmForClient(entry, older), undefined, String(older));
  }
});
test("teaches routes a film without changing what was reviewed or published", () => {
  const plain = skillPlan("compare-groups--sk");
  const teaching = skillPlan("compare-groups--sk", ["dot-group-compared-to-number"]);
  assert.deepEqual(plain.teaches, []);
  assert.equal(teaching.film.version, plain.film.version);
  assert.ok(teaching.data.equals(plain.data));
  assert.ok(!teaching.data.toString().includes("teaches"));
  // An export made after `teaches` was written matches the same screenplay.
  const reviewed = { ...structuredClone(script), id: "compare-groups--sk", teaches: ["count-objects"] };
  assert.equal(
    planFilm(
      reviewed.id,
      { ...exported(), id: reviewed.id, problemType: "compare-groups", script: reviewed },
      { ...reviewed, teaches: ["dot-group-compared-to-number"] },
      audio,
      skillTypes,
    ).film.version,
    plain.film.version,
  );
});
test("teaches names other real problem types, each once", () => {
  assert.throws(() => skillPlan("compare-groups--sk", ["no-such-type"]), /Unknown problem type no-such-type in teaches: compare-groups--sk/);
  assert.throws(() => skillPlan("compare-groups--sk", ["compare-groups"]), /Own problem type listed in teaches: compare-groups--sk/);
  assert.throws(
    () => skillPlan("compare-groups--sk", ["count-objects", "dot-group-compared-to-number", "count-objects"]),
    /Problem type count-objects listed twice in teaches: compare-groups--sk/,
  );
  // The schema checks only the shape.
  assert.throws(() => scriptSchema.parse({ ...script, teaches: "count-objects" }));
  assert.throws(() => scriptSchema.parse({ ...script, teaches: ["Count Objects"] }));
  assert.deepEqual(scriptSchema.parse({ ...script, teaches: ["no-such-type"] }).teaches, ["no-such-type"]);
});
test("a film made for a problem type wins over a film that only teaches it", async () => {
  const skill = skillPlan("compare-groups--sk", ["dot-group-compared-to-number"]);
  const specific = skillPlan("dot-group-compared-to-number");
  const expected = {
    "compare-groups": "compare-groups--sk",
    "dot-group-compared-to-number": "dot-group-compared-to-number",
  };
  assert.deepEqual(await manifestOf([skill, specific]), expected);
  assert.deepEqual(await manifestOf([specific, skill]), expected);
  assert.deepEqual(filmManifest([skill, specific]).conflicts, []);
  // A specific film still never shares its problem type with another edition.
  assert.throws(() => filmManifest([specific, skillPlan("dot-group-compared-to-number--va")]), /Multiple approved editions for dot-group-compared-to-number/);
});
test("a problem type taught by two films is reported and linked to neither", async () => {
  const plans = [
    skillPlan("compare-groups--sk", ["dot-group-compared-to-number", "count-out-objects"]),
    skillPlan("count-objects--sk", ["dot-group-compared-to-number"]),
  ];
  const { conflicts } = filmManifest(plans);
  assert.deepEqual(conflicts, [
    "Multiple approved films teach dot-group-compared-to-number (compare-groups--sk, count-objects--sk); none is linked there until one screenplay drops it from teaches",
  ]);
  assert.deepEqual(await manifestOf(plans), {
    "compare-groups": "compare-groups--sk",
    "count-objects": "count-objects--sk",
    "count-out-objects": "compare-groups--sk",
  });
  // A film made for that problem type settles it: no conflict.
  const settled = [...plans, skillPlan("dot-group-compared-to-number")];
  assert.deepEqual(filmManifest(settled).conflicts, []);
  assert.equal((await manifestOf(settled))["dot-group-compared-to-number"], "dot-group-compared-to-number");
});
test("withdrawing an approval removes its film from every problem type it was linked from", async () => {
  const skill = skillPlan("compare-groups--sk", ["dot-group-compared-to-number", "count-out-objects"]);
  const other = skillPlan("count-objects");
  assert.deepEqual(await manifestOf([skill, other]), {
    "compare-groups": "compare-groups--sk",
    "count-objects": "count-objects",
    "count-out-objects": "compare-groups--sk",
    "dot-group-compared-to-number": "compare-groups--sk",
  });
  assert.deepEqual(await manifestOf([other]), { "count-objects": "count-objects" });
  assert.deepEqual(await manifestOf([]), {});
  // Withdrawing the film made for a problem type hands it to the film that teaches it.
  const specific = skillPlan("dot-group-compared-to-number");
  assert.equal((await manifestOf([skill, specific]))["dot-group-compared-to-number"], "dot-group-compared-to-number");
  assert.equal((await manifestOf([skill]))["dot-group-compared-to-number"], "compare-groups--sk");
});
test("search lists a film once, however many problem types link it", () => {
  const film = { id: "count-objects", title: "Count objects" };
  const docs = buildCorpus({
    lessons: [],
    templates: [
      { id: "count-objects", title: "Count objects", skillId: "counting" },
      { id: "count-out-objects", title: "Count out objects", skillId: "counting" },
    ],
    skills: [{ id: "counting", gradeBand: "K", strand: "number" }],
    // Object.values of a manifest that lists the film under both problem types.
    films: [film, film],
    bandOrder: ["K"],
  });
  assert.deepEqual(
    docs.filter((doc) => doc.kind === "film").map((doc) => doc.id),
    ["film:count-objects"],
  );
});
test("native CSP permits every published film's data and narration", () => {
  const { app } = JSON.parse(
    readFileSync(new URL("../mobile/tauri.conf.json", import.meta.url), "utf8"),
  );
  for (const policy of [app.security.csp, app.security.devCsp] as string[]) {
    const directives = new Map(
      policy.split(";").map((directive) => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        return [name, sources];
      }),
    );
    for (const film of Object.values(lessonFilms)) {
      const urls = [
        ["connect-src", film.dataUrl],
        ["media-src", film.audioUrl],
        ...film.editions.flatMap((edition) => [
          ["connect-src", edition.dataUrl],
          ["media-src", edition.audioUrl],
        ] as const),
      ] as const;
      for (const [directive, value] of urls) {
        const destination = new URL(value);
        assert.ok(
          directives.get(directive)?.some((source) => {
            if (!source.startsWith("https://")) return false;
            const allowed = new URL(source);
            return (
              allowed.origin === destination.origin &&
              destination.pathname.startsWith(allowed.pathname)
            );
          }),
          `${directive} blocks ${film.id}`,
        );
      }
    }
  }
});
test("lesson capability negotiates separate cached representations for new and older clients", async () => {
  const server = buildApp({
    repository: { limits: trialLimits() } as Repository,
    authenticate: async () => {
      throw Error("public endpoint");
    },
  });
  try {
    const path = "/api/v1/problem-lessons/count-objects";
    const enhanced = await server.inject({
      url: `${path}?film=${FILM_CAPABILITY}`,
    });
    assert.equal(enhanced.statusCode, 200);
    assert.ok(enhanced.json().lesson.film.editions?.length);
    const previous = await server.inject({
      url: `${path}?film=lesson-film-v1`,
    });
    assert.equal(previous.statusCode, 200);
    assert.equal(previous.json().lesson.film.capability, "lesson-film-v1");
    assert.equal(previous.json().lesson.film.editions, undefined);
    assert.equal(previous.json().lesson.film.dataUrl, enhanced.json().lesson.film.dataUrl);
    const old = await server.inject({
      url: path,
      headers: { "if-none-match": String(enhanced.headers.etag) },
    });
    assert.equal(old.statusCode, 200);
    assert.equal(old.json().lesson.film, undefined);
    assert.notEqual(enhanced.headers.etag, old.headers.etag);
    const unknown = await server.inject({ url: `${path}?film=unsupported` });
    assert.deepEqual(unknown.json(), old.json());
    // A v2 film reaches a v2 client exactly as before.
    const v2 = await server.inject({ url: `${path}?film=lesson-film-v2` });
    assert.equal(v2.json().lesson.film.capability, "lesson-film-v2");
    assert.deepEqual(v2.json().lesson.film, enhanced.json().lesson.film);
  } finally {
    await server.close();
  }
});
test("the server sends a v3 film only to a client that declares v3", async () => {
  const id = "count-objects";
  const published = lessonFilms[id];
  assert.ok(published);
  // The committed v2 film, as if its screenplay had gained a shot with its own scene.
  lessonFilms[id] = { ...published, capability: "lesson-film-v3" };
  const server = buildApp({
    repository: { limits: trialLimits() } as Repository,
    authenticate: async () => {
      throw Error("public endpoint");
    },
  });
  try {
    const path = `/api/v1/problem-lessons/${id}`;
    const current = await server.inject({ url: `${path}?film=${FILM_CAPABILITY}` });
    assert.equal(current.statusCode, 200);
    assert.equal(current.json().lesson.film.capability, "lesson-film-v3");
    for (const older of ["lesson-film-v2", "lesson-film-v1"]) {
      const reply = await server.inject({ url: `${path}?film=${older}` });
      assert.equal(reply.statusCode, 200, older);
      assert.equal(reply.json().lesson.film, undefined, older);
      assert.ok(reply.json().lesson.title, older);
    }
  } finally {
    lessonFilms[id] = published;
    await server.close();
  }
});
