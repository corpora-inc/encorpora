import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { validate, card, render, formats } from "../render.mjs";
const scene = {
  heading: "Find your next step.",
  body: "Try an adaptive math assessment.",
  seconds: 0.5,
};
const manifest = {
  id: "test",
  format: "landscape",
  cta: "Try AMP",
  detail: "Adaptive Math Pathways",
  scenes: [scene],
};
test("reject missing rights and invalid layouts before rendering", () => {
  for (const change of [
    { id: "../escape" },
    { format: "bogus" },
    { scenes: [] },
    { voice: "v.wav" },
    { music: "m.wav" },
    { static: true, scenes: [{ ...scene, video: "demo.mp4" }] },
    { scenes: [{ ...scene, seconds: -1 }] },
  ])
    assert.throws(() => validate({ ...manifest, ...change }));
  assert.match(
    card(manifest, { ...scene, heading: "<script>bad</script>" }),
    /&lt;script&gt;/,
  );
});
test("static layouts fit, sources are hashed, and captioned video encodes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "amp ad's "));
  try {
    await writeFile(
      join(dir, "diagram.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><text x="200" y="300" font-size="80">2 + 3 = 5</text></svg>',
    );
    for (const format of Object.keys(formats)) {
      const m = {
        ...manifest,
        format,
        id: "test-" + format,
        static: true,
        scenes: [{ ...scene, image: "diagram.svg" }],
      };
      const path = join(dir, "manifest.json");
      await writeFile(path, JSON.stringify(m));
      await render(path, dir);
      const proof = JSON.parse(
        await readFile(join(dir, m.id + "-verification.json"), "utf8"),
      );
      assert.equal(proof.outputs.length, 1);
      assert.equal(proof.sources.length, 1);
      assert.match(proof.sources[0].sha256, /^[a-f0-9]{64}$/);
      for (const box of Object.values(proof.evidence[0].boxes))
        assert.ok(box.bottom <= formats[format][1]);
    }
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-y",
      join(dir, "voice.wav"),
    ]);
    await writeFile(
      join(dir, "words.srt"),
      "1\n00:00:00,000 --> 00:00:00,800\nFind your next step.\n",
    );
    const m = {
      ...manifest,
      voice: "voice.wav",
      voiceDisclosure: "Synthetic test tone",
      captions: "words.srt",
      scenes: [scene, { ...scene, heading: "Explore AMP." }],
    };
    const path = join(dir, "manifest.json");
    await writeFile(path, JSON.stringify(m));
    await render(path, dir);
    const proof = JSON.parse(
      await readFile(join(dir, "test-verification.json"), "utf8"),
    );
    assert.equal(proof.evidence.at(-1).streams.length, 2);
    assert.equal(proof.evidence.at(-1).streams[0].width, 1920);
    assert.ok(Math.abs(Number(proof.evidence.at(-1).duration) - 1) < 0.1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
