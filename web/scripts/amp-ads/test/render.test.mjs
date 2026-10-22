import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { validate, card, render, formats, parseCaptions } from "../render.mjs";
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

test("Reels captions reject ambiguous, overlapping, and out-of-range SRT", () => {
  const cue = "1\n00:00:00,000 --> 00:00:00,800\nSee the missing piece.\n";
  assert.equal(parseCaptions(cue, 1)[0].end, 0.8);
  for (const invalid of ["", cue.replace("00,800", "61,000"), cue.replace("See", "<b>See</b>"), cue + "\n" + cue])
    assert.throws(() => parseCaptions(invalid, 1));
  assert.throws(() => parseCaptions(cue, 0.5));
});

test("Reels safe area contains key content and actual encoded captions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "amp-reels-"));
  try {
    const path = join(dir, "manifest.json");
    const m = { ...manifest, id: "reels-proof", format: "reels", disclosure: "Illustrated example", captions: "words.srt", voice: "tone.wav", voiceDisclosure: "Synthetic test tone", music: "tone.wav", musicRights: "Generated test tone", scenes: [{ ...scene, seconds: 1 }] };
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-y", join(dir, "tone.wav")]);
    await writeFile(join(dir, "words.srt"), "1\n00:00:00,000 --> 00:00:00,300\nFind your next step.\n\n2\n00:00:00,500 --> 00:00:00,700\nTry the assessment.\n");
    await writeFile(path, JSON.stringify(m));
    await render(path, dir);
    const proof = JSON.parse(await readFile(join(dir, m.id + "-verification.json"), "utf8"));
    // Independent expectations from Meta's 14% top / 6% sides / 40% bottom guidance.
    for (const b of Object.values(proof.evidence[0].boxes)) {
      assert.ok(b.x >= 1080 * 0.06 && b.right <= 1080 * 0.94);
      assert.ok(b.y >= 1920 * 0.14 && b.bottom <= 1920 * 0.60);
    }
    assert.equal(proof.evidence.at(-1).streams.length, 2);
    const cue = proof.evidence.find(e => e.captions).captions[0];
    assert.ok(cue.y > proof.evidence[0].boxes[".media"].bottom);
    assert.ok(cue.y + cue.height < proof.evidence[0].boxes.footer.y);
    const pixels = (name, at) => execFileSync("ffmpeg", ["-v", "error", "-ss", at, "-i", join(dir, name), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 10e6 });
    const picture = pixels(m.id + "-picture.mp4", "0.1");
    for (const [at, visible] of [["0.1", true], ["0.4", false], ["0.6", true], ["0.8", false]]) {
      const final = pixels(m.id + ".mp4", at);
      let inside = 0, outside = 0;
      for (let p = 0; p < final.length; p += 3) {
        if (Math.max(...[0, 1, 2].map(c => Math.abs(final[p + c] - picture[p + c]))) <= 50) continue;
        const x = (p / 3) % 1080, y = Math.floor(p / 3 / 1080);
        if (x >= cue.x - 2 && x < cue.x + cue.width + 2 && y >= cue.y - 2 && y < cue.y + cue.height + 2) inside++;
        else outside++;
      }
      assert.equal(outside, 0, "caption pixels escaped reserved band");
      assert.ok(visible ? inside > 1000 : inside === 0, "caption timing or rendering is wrong");
    }
    for (const change of [
      { detail: "Long disclosure ".repeat(40) },
      { disclosure: "Long disclosure ".repeat(40) },
      { scenes: [{ ...scene, heading: "A\nB\nC\nD", seconds: 1 }] },
    ]) {
      await writeFile(path, JSON.stringify({ ...m, static: true, ...change }));
      await assert.rejects(render(path, dir), /overlap|overflow/i);
    }
    await writeFile(join(dir, "words.srt"), "1\n00:00:00,000 --> 00:00:00,500\n" + "Too many words. ".repeat(30));
    await writeFile(path, JSON.stringify(m));
    await assert.rejects(render(path, dir), /caption exceeds two lines/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
