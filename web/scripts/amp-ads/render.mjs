import { chromium } from "playwright";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const formats = {
  portrait: [1080, 1350],
  vertical: [1080, 1920],
  square: [1080, 1080],
  landscape: [1920, 1080],
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function validate(m) {
  if (!/^[a-z0-9-]+$/.test(m.id))
    throw Error("Use a stable lowercase asset id");
  if (!formats[m.format]) throw Error("Unknown format");
  if (!Array.isArray(m.scenes) || !m.scenes.length)
    throw Error("Scenes required");
  for (const s of m.scenes) {
    if (!s.heading || s.heading.length > 100)
      throw Error("Heading required, maximum 100 characters");
    if (!Number.isFinite(s.seconds) || s.seconds <= 0 || s.seconds > 60)
      throw Error("Invalid duration");
    if (s.video && s.image) throw Error("Choose one media source");
    if (m.static && s.video)
      throw Error("Static assets require an image source");
  }
  if (m.music && !m.musicRights) throw Error("Music provenance required");
  if (m.voice && !m.voiceDisclosure) throw Error("Voice disclosure required");
  return m;
}
export function card(m, s, image) {
  const [w, h] = formats[m.format],
    wide = w > h,
    short = h <= 1080 && !wide;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
 *{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;background:#f6f5ee;color:#103b37;font-family:Arial,sans-serif}main{position:relative;width:100%;height:100%;padding:${wide ? "62px 88px" : "76px 76px"};overflow:hidden}
 header{display:flex;align-items:center;gap:20px;font-size:24px;letter-spacing:.4px}.mark{display:grid;place-items:center;background:#103b37;color:#b7f5d3;border-radius:20px;width:88px;height:72px;font-size:30px;font-weight:800;letter-spacing:-2px}.brand{font-size:24px;line-height:1.25;font-weight:700}.brand small{display:block;font-size:17px;font-weight:400;color:#536a61;margin-top:5px}
 .eyebrow{font-size:21px;letter-spacing:3px;font-weight:700;margin:0 0 24px;color:#416459;text-transform:uppercase}
 .copy{position:absolute;top:${wide ? 205 : 190}px;left:${wide ? 88 : 76}px;width:${wide ? 740 : 928}px}h1{font-size:${wide ? 84 : short ? 66 : 78}px;line-height:1.06;letter-spacing:-3.5px;font-weight:700;margin:0;white-space:pre-line}h1 em{font-style:normal;color:#267663}p{font-size:${wide ? 30 : 29}px;line-height:1.4;max-width:850px;margin:24px 0 0;color:#486056}
 .media{position:absolute;left:${wide ? 930 : 76}px;top:${wide ? 176 : short ? 460 : 520}px;width:${wide ? 902 : 928}px;height:${wide ? 570 : short ? 340 : h === 1920 ? 800 : 530}px;border-radius:28px;overflow:hidden;border:1px solid #dce0d4;background:#fffdf7;box-shadow:0 20px 50px #103b3714;display:flex;align-items:center;justify-content:center}.media img{width:100%;height:100%;object-fit:contain}.media:empty{background:#103b37}
 footer{position:absolute;bottom:${h === 1920 ? 240 : 70}px;left:${wide ? 88 : 76}px;right:${wide ? 88 : 76}px}.cta{display:inline-block;background:#103b37;color:#f8faf2;border-radius:100px;font-size:27px;padding:21px 32px;font-weight:700}.detail{font-size:21px;color:#486056;margin-top:20px}.tag{position:absolute;right:0;bottom:4px;text-align:right;font-size:22px;font-weight:700;line-height:1.4}.disclosure{position:absolute;bottom:${h === 1920 ? 180 : 25}px;left:${wide ? 88 : 76}px;color:#6b7d73;font-size:16px}
 </style></head><body><main><header><div class="mark">AMP</div><div class="brand">Adaptive Math Pathways<small>by Corpora</small></div></header><section class="copy"><div class="eyebrow">${esc(s.eyebrow || m.eyebrow)}</div><h1>${esc(s.heading)}</h1><p>${esc(s.body)}</p></section><div class="media">${image ? `<img src="${image}" alt="AMP demonstration">` : ""}</div><footer><div class="cta">${esc(s.cta || m.cta)}</div><div class="detail">${esc(s.detail || m.detail)}</div>${wide ? '<div class="tag">Get excited about math.<br>Get AMP’d.</div>' : ""}</footer><div class="disclosure">${esc(s.disclosure || m.disclosure)}</div></main></body></html>`;
}
function ff(args, cwd) {
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "pipe", maxBuffer: 2e6, cwd },
  );
}
export async function render(manifestPath, out) {
  const source = resolve(manifestPath),
    m = validate(JSON.parse(await readFile(source, "utf8")));
  out = resolve(out);
  await mkdir(out, { recursive: true });
  const base = dirname(source),
    file = (p) => resolve(base, p);
  const browser = await chromium.launch();
  const [width, height] = formats[m.format];
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const parts = [],
    evidence = [];
  try {
    for (const [i, s] of m.scenes.entries()) {
      let im;
      if (s.image) {
        const bytes = await readFile(file(s.image));
        im = `data:image/${{ ".jpg": "jpeg", ".jpeg": "jpeg", ".svg": "svg+xml", ".png": "png", ".webp": "webp" }[extname(s.image).toLowerCase()]};base64,${bytes.toString("base64")}`;
      }
      await page.setContent(card(m, s, im));
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator("img")
        .evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
      const boxes = await page.evaluate(() =>
        Object.fromEntries(
          [".copy", ".media", "footer"].map((sel) => {
            const r = document.querySelector(sel).getBoundingClientRect();
            return [
              sel,
              {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                bottom: r.bottom,
              },
            ];
          }),
        ),
      );
      if (width <= height && boxes[".copy"].bottom > boxes[".media"].y - 18)
        throw Error("Copy overlaps product media");
      if (boxes[".media"].bottom > boxes.footer.y - 18 && width <= height)
        throw Error("Media overlaps CTA");
      const png = resolve(out, `${m.id}-${i + 1}.png`);
      await page.screenshot({ path: png });
      evidence.push({ scene: i + 1, boxes });
      if (m.static) continue;
      const dest = resolve(out, `${m.id}-${i + 1}.mp4`);
      parts.push(dest);
      const inputs = ["-loop", "1", "-i", png];
      let filters = [];
      if (s.video) {
        inputs.push(
          "-stream_loop",
          "-1",
          "-ss",
          String(s.start || 0),
          "-i",
          file(s.video),
        );
        const b = boxes[".media"];
        const bw = Math.floor(b.width / 2) * 2,
          bh = Math.floor(b.height / 2) * 2;
        filters = [
          "-filter_complex",
          `[1:v]scale=${bw}:${bh}:force_original_aspect_ratio=decrease,pad=${bw}:${bh}:(ow-iw)/2:(oh-ih)/2:color=0xfffdf7,setsar=1[ui];[0:v][ui]overlay=${b.x}:${b.y}:shortest=1[v]`,
          "-map",
          "[v]",
        ];
      }
      ff([
        ...inputs,
        ...filters,
        "-t",
        String(s.seconds),
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-an",
        dest,
      ]);
    }
  } finally {
    await browser.close();
  }
  if (parts.length) {
    const list = resolve(out, `${m.id}-concat.txt`);
    await writeFile(list, parts.map((p) => `file '${basename(p)}'`).join("\n"));
    const picture = resolve(out, `${m.id}-picture.mp4`);
    ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", picture]);
    const total = m.scenes.reduce((a, s) => a + s.seconds, 0);
    let inputs = ["-i", picture],
      filter = "",
      maps = ["-map", "0:v"];
    let n = 1;
    if (m.voice) {
      inputs.push("-i", file(m.voice));
      filter += `[${n++}:a]apad,atrim=0:${total},asetpts=PTS-STARTPTS[voice];`;
    }
    if (m.music) {
      inputs.push("-stream_loop", "-1", "-i", file(m.music));
      filter += `[${n}:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.10,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, total - 2)}:d=2[music];`;
    }
    if (m.voice || m.music) {
      filter +=
        (m.voice && m.music
          ? "[voice][music]amix=inputs=2:normalize=0"
          : m.voice
            ? "[voice]anull"
            : "[music]anull") + ",loudnorm=I=-16:TP=-1.5:LRA=9[a]";
      maps.push("-map", "[a]");
    }
    const final = resolve(out, `${m.id}.mp4`);
    const captionName = `${m.id}-captions.srt`;
    if (m.captions) await copyFile(file(m.captions), resolve(out, captionName));
    const captionArgs = m.captions
      ? [
          "-vf",
          `subtitles=${captionName}:force_style='FontName=Arial,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H002D2821,BorderStyle=3,Outline=2,Shadow=0,MarginV=${height === 1920 ? 60 : 56}'`,
        ]
      : [];
    ff(
      [
        ...inputs,
        ...(filter ? ["-filter_complex", filter] : []),
        ...maps,
        ...captionArgs,
        "-c:v",
        m.captions ? "libx264" : "copy",
        ...(m.captions ? ["-preset", "fast", "-crf", "18"] : []),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-t",
        String(total),
        "-movflags",
        "+faststart",
        final,
      ],
      out,
    );
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-show_streams", "-show_format", "-of", "json", final],
        { encoding: "utf8" },
      ),
    );
    evidence.push({
      duration: probe.format.duration,
      streams: probe.streams.map((s) => ({
        type: s.codec_type,
        width: s.width,
        height: s.height,
        codec: s.codec_name,
      })),
    });
  }
  const outputs = [];
  for (const name of m.static
    ? m.scenes.map((_, i) => `${m.id}-${i + 1}.png`)
    : [`${m.id}.mp4`]) {
    outputs.push({
      name,
      sha256: createHash("sha256")
        .update(await readFile(resolve(out, name)))
        .digest("hex"),
    });
  }
  const sources = [];
  for (const p of new Set(
    [
      m.voice,
      m.music,
      m.captions,
      ...m.scenes.flatMap((s) => [s.image, s.video]),
    ].filter(Boolean),
  )) {
    sources.push({
      path: p,
      sha256: createHash("sha256")
        .update(await readFile(file(p)))
        .digest("hex"),
    });
  }
  await writeFile(
    resolve(out, `${m.id}-verification.json`),
    JSON.stringify(
      {
        manifest: m,
        sourceManifestSha256: createHash("sha256")
          .update(await readFile(source))
          .digest("hex"),
        sources,
        outputs,
        evidence,
      },
      null,
      2,
    ),
  );
  console.log(`Rendered ${m.id}`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 4)
    throw Error("Usage: node render.mjs MANIFEST.json OUTPUT_DIR");
  await render(process.argv[2], process.argv[3]);
}
