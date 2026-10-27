// End-to-end smoke test of the AMP cinema pipeline (python3 -m cinema) on
// synthetic lavfi clips at quarter resolution: centered cards, ducked mix,
// four formats, QC receipts, and the pixel-level safe-zone gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ff = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const py = (args, env = {}) =>
  spawnSync("python3", args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });

// Mean level (dB) of the low band (music tone) in a window of the mix.
function bassLevel(file, start, seconds) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-ss", String(start), "-t", String(seconds), "-i", file,
    "-af", "lowpass=f=400,volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  return Number(/mean_volume: (-?[\d.]+) dB/.exec(r.stderr)[1]);
}

test("renders every format with centered text, ducked music and passing QC", async () => {
  const dir = await mkdtemp(join(tmpdir(), "amp-cinema-"));
  try {
    ff("-f", "lavfi", "-i", "testsrc2=s=640x360:r=24:d=4", "-pix_fmt", "yuv420p", join(dir, "a-wide.mp4"));
    ff("-f", "lavfi", "-i", "testsrc2=s=360x640:r=24:d=4", "-pix_fmt", "yuv420p", join(dir, "a-portrait.mp4"));
    ff("-f", "lavfi", "-i", "mandelbrot=s=640x360:r=24", "-t", "4", "-pix_fmt", "yuv420p", join(dir, "b.mp4"));
    ff("-f", "lavfi", "-i", "sine=f=3000:d=1.6", join(dir, "voice.wav"));
    ff("-f", "lavfi", "-i", "sine=f=200:d=20", join(dir, "music.wav"));
    const spec = {
      id: "smoke", title: "Smoke test", duration: 6, fps: 24,
      formats: ["portrait", "feed", "square", "wide"],
      shots: [
        { id: "a", source: "a-{orientation}.mp4", in: 0, out: 3, duration: 3, transition: { type: "fade", duration: 0.5 } },
        { id: "b", source: "b.mp4", in: 0, out: 3, duration: 3 },
      ],
      cards: [{ text: "Math that moves.", start: 0.3, end: 2.5 }],
      endCard: { start: 4, cta: "Try AMP free" },
      voice: { voice: "test tone", take: "voice.wav", script: "Tone.", start: 1 },
      music: { title: "Tone", path: "music.wav", rights: "synthetic test tone" },
    };
    await writeFile(join(dir, "ad.json"), JSON.stringify(spec));
    const out = join(dir, "out");
    const env = { AMP_X264_PRESET: "ultrafast", AMP_VIDEO_ENCODER: "libx264" };
    const render = () => py(["-m", "cinema", "render", join(dir, "ad.json"), "--out", out, "--divisor", "4"], env);
    const r = render();
    assert.equal(r.status, 0, r.stderr);
    const sizes = { portrait: [270, 480], feed: [270, 336], square: [270, 270], wide: [480, 270] };
    for (const [fmt, dims] of Object.entries(sizes)) {
      const receipt = JSON.parse(await readFile(join(out, "smoke", `${fmt}-receipt.json`), "utf8"));
      assert.deepEqual(receipt.dimensions, dims);
      assert.equal(receipt.status, "needs-voice-check"); // transcriptVerified is false
      assert.ok(Object.values(receipt.qc.checks).every(Boolean), JSON.stringify(receipt.qc));
      assert.ok(Math.abs(receipt.qc.integratedLufs + 14) <= 1.5, String(receipt.qc.integratedLufs));
      assert.ok(receipt.recipe.args.includes("-filter_complex"));
    }
    const cards = JSON.parse(await readFile(join(out, "smoke", "cards", "portrait-cards.json"), "utf8"));
    assert.ok(cards.inkBoxes["portrait-card-0"]);
    // Ducking: the music band drops while the voice speaks (1.0-2.6 s).
    const mix = join(out, "smoke", "mix.m4a");
    const ducked = bassLevel(mix, 1.4, 1.0), open = bassLevel(mix, 3.1, 0.9);
    assert.ok(open - ducked >= 4, `music only ${open - ducked} dB lower under the voice`);
    // Unchanged inputs reuse every artifact; changed encoder settings refuse to overwrite.
    const again = render();
    assert.equal(again.status, 0, again.stderr);
    const changed = py(["-m", "cinema", "render", join(dir, "ad.json"), "--out", out, "--divisor", "4"],
      { ...env, AMP_X264_PRESET: "veryfast" });
    assert.match(changed.stderr, /exists with different inputs/);
    // A 4K master of a format already rendered at delivery size sits beside it.
    const master = py(["-m", "cinema", "render", join(dir, "ad.json"), "--out", out, "--divisor", "4", "--master",
      "--format", "portrait"], env);
    assert.equal(master.status, 0, master.stderr);
    const m = JSON.parse(await readFile(join(out, "smoke", "portrait-4k-receipt.json"), "utf8"));
    assert.deepEqual(m.dimensions, [540, 960]);
    assert.equal(render().status, 0);
    // Music that ends before the ad is refused, not silently truncated.
    ff("-f", "lavfi", "-i", "sine=f=200:d=3", join(dir, "short.wav"));
    await writeFile(join(dir, "short.json"), JSON.stringify({ ...spec, id: "short", voice: undefined,
      music: { ...spec.music, path: "short.wav" } }));
    const short = py(["-m", "cinema", "render", join(dir, "short.json"), "--out", out, "--divisor", "4"], env);
    assert.match(short.stderr, /music track ends before the ad/);
    // A review page lists the ad.
    assert.equal(py(["-m", "cinema", "review", out]).status, 0);
    assert.match(await readFile(join(out, "review.html"), "utf8"), /Smoke test/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the pixel gate rejects text near the top or bottom and accepts centered text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "amp-cinema-gate-"));
  try {
    const card = (name, y) =>
      ff("-f", "lavfi", "-i", "color=c=white:s=270x480,format=rgba", "-vf",
        `geq=r=255:g=255:b=255:a='255*between(X,60,209)*between(Y,${y},${y + 39})'`, "-frames:v", "1", join(dir, name));
    card("top.png", 20);
    card("bottom.png", 420);
    card("center.png", 220);
    const check = (name) =>
      py(["-c", `from pathlib import Path; from cinema.render import check_card; print(check_card('portrait', Path(${JSON.stringify(join(dir, name))}), (270, 480)))`]);
    assert.match(check("top.png").stderr, /centered-text rule: text enters the top/);
    assert.match(check("bottom.png").stderr, /text enters the bottom/);
    const ok = check("center.png");
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /\(60, 220, 210, 260\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
