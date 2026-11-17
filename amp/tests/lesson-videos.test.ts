import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lessonVideos } from "../src/content/lesson-videos";
import { problemLesson } from "../src/content/problem-lessons";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";

test("YouTube release policy enforces hold, cadence, audience review, and fail-forward behavior", () => {
  const result = spawnSync(
    "python3",
    [
      "-m",
      "unittest",
      "discover",
      "-s",
      new URL("../scripts/", import.meta.url).pathname,
      "-p",
      "test_youtube_policy.py",
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("the YouTube uploader rejects an unapproved voice even with Python optimization enabled", () => {
  // #2406 removed the voice gate from publish-lesson-video.py; the uploader keeps its own.
  const dir = mkdtempSync(join(tmpdir(), "amp-video-policy-"));
  try {
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets/narration.json"), "{}");
    const manifest = join(dir, "manifest.json");
    writeFileSync(
      manifest,
      JSON.stringify({ ...lessonVideos[0], voiceId: "unapproved" }),
    );
    writeFileSync(join(dir, "description.txt"), "An example lesson.");
    const cases = [
      [
        "publish-lesson-youtube.py",
        manifest,
        dir,
        join(dir, "receipt.json"),
        "--title",
        "Example",
        "--description-file",
        join(dir, "description.txt"),
        "--plan",
        manifest,
      ],
    ];
    for (const [script, ...args] of cases) {
      const result = spawnSync(
        "python3",
        [
          "-O",
          new URL(`../scripts/${script}`, import.meta.url).pathname,
          ...args,
        ],
        { encoding: "utf8", timeout: 5000 },
      );
      assert.equal(result.status, 1, script);
      assert.match(result.stderr, /ValueError: Unapproved/, script);
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("YouTube uploader accepts a declared wordless film but never a missing voice", () => {
  const dir = mkdtempSync(join(tmpdir(), "amp-video-wordless-"));
  try {
    writeFileSync(join(dir, "description.txt"), "A wordless film.");
    const run = (manifest: object) => {
      const path = join(dir, "manifest.json");
      writeFileSync(path, JSON.stringify(manifest));
      return spawnSync(
        "python3",
        [
          "-O",
          new URL("../scripts/publish-lesson-youtube.py", import.meta.url).pathname,
          path,
          dir,
          join(dir, "receipt.json"),
          "--title",
          "Example",
          "--description-file",
          join(dir, "description.txt"),
          "--plan",
          path,
        ],
        { encoding: "utf8", timeout: 5000 },
      );
    };
    const assets = {
      video: { url: "https://local.invalid/missing.mp4", sha256: "0".repeat(64) },
    };
    const missing = run({ id: "x", version: 1, assets });
    assert.match(missing.stderr, /ValueError: Unapproved voice/);
    const wordless = run({ id: "x", version: 1, narration: "none", assets });
    assert.equal(wordless.status, 1);
    assert.doesNotMatch(wordless.stderr, /Unapproved voice/);
    assert.match(wordless.stderr, /missing\.mp4/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("video bindings name real families and immutable assets with approved narration", () => {
  const bound = new Set<string>();
  for (const video of lessonVideos) {
    assert(
      ["XescS24CsOySAkKrLAO3", "J3Ei0Lj6fAobhIqY5ySH"].includes(video.voiceId),
    );
    assert(video.durationSeconds > 0 && video.transcript.length > 0);
    for (const id of video.templateIds) {
      assert(
        templates.some((template) => template.id === id),
        id,
      );
      assert(!bound.has(id), `Ambiguous video for ${id}`);
      bound.add(id);
    }
    for (const kind of [
      "video",
      "captions",
      "poster",
      "source",
      "portrait",
      "captionedLandscape",
    ]) {
      const asset = video.assets[kind];
      assert(asset, kind);
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      const url = new URL(asset.url);
      assert.equal(url.protocol, "https:");
      assert(
        url.pathname.startsWith(`/amp/lessons/${video.id}/v${video.version}/`),
      );
    }
  }
});

test("the library and relevant practice have video; unrelated lessons do not", () => {
  assert.equal(
    problemLesson("add-fractions", "library").video?.id,
    "fraction-addition",
  );
  assert.equal(problemLesson("multiply-facts", "library").video, undefined);
  let visible = 0,
    hidden = 0;
  for (let i = 0; i < 500; i++) {
    const problem = generateProblem("add-fractions", `video-${i}`);
    const lesson = problemLesson(
      "add-fractions",
      problem.public.seed,
      problem.public.prompt,
      problem.public.response,
      problem,
    );
    if (gradeAnswer(problem, "11/12")) {
      hidden++;
      assert.equal(
        lesson.video,
        undefined,
        "The tutorial would answer the active problem",
      );
    } else {
      visible++;
      assert(lesson.video);
    }
  }
  assert(visible > 0 && hidden > 0, "Exercise both practice cases");
  assert.equal(
    problemLesson("add-fractions", "old-client", "An active problem").video,
    undefined,
  );
});
