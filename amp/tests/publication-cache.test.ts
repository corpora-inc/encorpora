import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPublications,
  rendererFingerprint,
  type PublicationDocument,
} from "../scripts/publication-cache";

const doc = (
  lessonId: string,
  html = `<p>${lessonId}</p>`,
): PublicationDocument => ({
  lessonId,
  kind: "lesson",
  html: () => html,
  formats: ["Letter", "A4"],
});

/** A deterministic fake renderer that counts documents and tracks overlap. */
function fakeRenderer(delayMs = 0) {
  const calls: string[] = [];
  let active = 0;
  let peak = 0;
  return {
    calls,
    peak: () => peak,
    render: async (html: string, formats: readonly string[]) => {
      calls.push(html);
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, delayMs));
      active--;
      return formats.map((f) => Buffer.from(`%PDF-1.7 ${f} ${html}`));
    },
  };
}

const dir = () => mkdtemp(join(tmpdir(), "amp-publications-"));

test("an unchanged document is reused from a seed; only changed HTML re-renders", async () => {
  const seed = await dir();
  const first = fakeRenderer();
  await buildPublications({
    documents: [doc("a"), doc("b"), doc("c")],
    output: seed,
    renderer: "r1",
    render: first.render,
  });
  assert.equal(first.calls.length, 3);

  const output = await dir();
  const second = fakeRenderer();
  const result = await buildPublications({
    documents: [doc("a"), doc("b", "<p>b, reworded</p>"), doc("c")],
    output,
    seeds: [seed],
    renderer: "r1",
    render: second.render,
  });
  assert.deepEqual(second.calls, ["<p>b, reworded</p>"]);
  assert.equal(result.rendered, 2, "both paper sizes of the changed document");
  assert.equal(result.reused, 2);
  // Reused PDFs are copied into the output and keep their hashes.
  const manifest = JSON.parse(
    await readFile(join(output, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.renderer, "r1");
  assert.deepEqual(
    manifest.publications.map((p: { filename: string }) => p.filename),
    [
      "a-lesson-Letter.pdf",
      "a-lesson-A4.pdf",
      "b-lesson-Letter.pdf",
      "b-lesson-A4.pdf",
      "c-lesson-Letter.pdf",
      "c-lesson-A4.pdf",
    ],
    "catalog order, not render order",
  );
  for (const entry of manifest.publications) {
    const pdf = await readFile(join(output, entry.filename));
    assert.equal(pdf.length, entry.bytes);
    assert.match(entry.htmlSha256, /^[a-f0-9]{64}$/);
  }
});

test("a different renderer never reuses prior PDFs", async () => {
  const seed = await dir();
  await buildPublications({
    documents: [doc("a")],
    output: seed,
    renderer: "r1",
    render: fakeRenderer().render,
  });
  const next = fakeRenderer();
  await buildPublications({
    documents: [doc("a")],
    output: await dir(),
    seeds: [seed],
    renderer: "r2",
    render: next.render,
  });
  assert.equal(next.calls.length, 1);
});

test("a corrupted or missing seed PDF is re-rendered, never shipped", async () => {
  const seed = await dir();
  await buildPublications({
    documents: [doc("a"), doc("b")],
    output: seed,
    renderer: "r1",
    render: fakeRenderer().render,
  });
  await writeFile(join(seed, "a-lesson-A4.pdf"), "%PDF-tampered");
  const manifest = JSON.parse(
    await readFile(join(seed, "manifest.json"), "utf8"),
  );
  await writeFile(
    join(seed, "manifest.json"),
    JSON.stringify({
      ...manifest,
      publications: manifest.publications.filter(
        (p: { filename: string }) => p.filename !== "b-lesson-Letter.pdf",
      ),
    }),
  );
  const next = fakeRenderer();
  const output = await dir();
  await buildPublications({
    documents: [doc("a"), doc("b")],
    output,
    seeds: [seed],
    renderer: "r1",
    render: next.render,
  });
  assert.deepEqual(next.calls.sort(), ["<p>a</p>", "<p>b</p>"]);
  assert.match(
    await readFile(join(output, "a-lesson-A4.pdf"), "utf8"),
    /A4 <p>a<\/p>/,
  );
});

test("manifests without HTML hashes (before content keys) are not trusted", async () => {
  const seed = await dir();
  await writeFile(join(seed, "a-lesson-Letter.pdf"), "%PDF-old");
  await writeFile(join(seed, "a-lesson-A4.pdf"), "%PDF-old");
  await writeFile(
    join(seed, "manifest.json"),
    JSON.stringify({
      edition: "1",
      publications: [
        {
          lessonId: "a",
          kind: "lesson",
          format: "Letter",
          filename: "a-lesson-Letter.pdf",
          sha256: "0".repeat(64),
          bytes: 8,
        },
      ],
    }),
  );
  const next = fakeRenderer();
  await buildPublications({
    documents: [doc("a")],
    output: await dir(),
    seeds: [seed],
    renderer: "r1",
    render: next.render,
  });
  assert.equal(next.calls.length, 1);
});

test("rendering is bounded by the concurrency and removes stale files", async () => {
  const output = await dir();
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "gone-lesson-Letter.pdf"), "%PDF-stale");
  const renderer = fakeRenderer(10);
  const documents = Array.from({ length: 12 }, (_, i) => doc(`l${i}`));
  const result = await buildPublications({
    documents,
    output,
    renderer: "r1",
    render: renderer.render,
    concurrency: 3,
  });
  assert.equal(result.rendered, 24);
  assert.equal(renderer.peak(), 3);
  assert.ok(!(await readdir(output)).includes("gone-lesson-Letter.pdf"));
  // The output itself is a valid seed: a rebuild renders nothing.
  const again = fakeRenderer();
  const second = await buildPublications({
    documents,
    output,
    renderer: "r1",
    render: again.render,
  });
  assert.equal(again.calls.length, 0);
  assert.equal(second.reused, 12);
});

test("--force re-renders everything", async () => {
  const output = await dir();
  await buildPublications({
    documents: [doc("a")],
    output,
    renderer: "r1",
    render: fakeRenderer().render,
  });
  const again = fakeRenderer();
  await buildPublications({
    documents: [doc("a")],
    output,
    renderer: "r1",
    render: again.render,
    force: true,
  });
  assert.equal(again.calls.length, 1);
});

test("the renderer fingerprint changes with the toolchain files", async () => {
  const root = await dir();
  await writeFile(join(root, "package-lock.json"), "{}");
  const before = await rendererFingerprint(root);
  assert.equal(await rendererFingerprint(root), before);
  await writeFile(join(root, "package-lock.json"), '{"playwright":"2"}');
  assert.notEqual(await rendererFingerprint(root), before);
});

test("release mode: precomputed hashes skip HTML for reused documents and keep no HTML", async () => {
  const seed = await dir();
  await buildPublications({
    documents: [doc("a"), doc("b")],
    output: seed,
    renderer: "r1",
    render: fakeRenderer().render,
  });
  const { createHash } = await import("node:crypto");
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  let built = 0;
  const counted = (d: PublicationDocument): PublicationDocument => ({
    ...d,
    html: () => (built++, d.html()),
  });
  const docs = [counted(doc("a")), counted(doc("b", "<p>b2</p>"))];
  const output = await dir();
  const next = fakeRenderer();
  const result = await buildPublications({
    documents: docs,
    output,
    seeds: [seed],
    renderer: "r1",
    render: next.render,
    writeHtml: false,
    htmlSha256s: [hash("<p>a</p>"), hash("<p>b2</p>")],
  });
  assert.equal(result.reused, 1);
  assert.equal(built, 1, "only the changed document's HTML is built");
  assert.ok(!(await readdir(output)).some((n) => n.endsWith(".html")));
});

test("a precomputed hash that does not match the rendered HTML fails the build", async () => {
  await assert.rejects(
    buildPublications({
      documents: [doc("a")],
      output: await dir(),
      renderer: "r1",
      render: fakeRenderer().render,
      writeHtml: false,
      htmlSha256s: ["0".repeat(64)],
    }),
    /not deterministic: a-lesson/,
  );
});
