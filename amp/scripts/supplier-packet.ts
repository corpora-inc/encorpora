import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  supplierCatalog,
  catalogCsv,
  sha256,
} from "../src/funding/supplier-packet/catalog.js";
import { auditPacketEvidence } from "../src/funding/supplier-packet/evidence.js";
import { verifyPublication } from "../src/funding/supplier-packet/publication.js";
import {
  renderSupplierPacket,
  type PacketPreview,
} from "../src/funding/supplier-packet/render.js";
import { firstWaveDossiers } from "../src/funding/first-wave-dossiers.js";
import { auditDossiers } from "../src/funding/dossier.js";
import { transactionDocumentTemplates } from "../src/funding/supplier-packet/documents.js";
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i],
    value = process.argv[i + 1];
  if (
    !["--output", "--publications", "--evidence", "--as-of"].includes(key) ||
    !value ||
    value.startsWith("--") ||
    args.has(key)
  )
    throw new Error(
      "Usage: supplier-packet.ts --output DIR --publications DIR [--evidence PRIVATE_JSON] [--as-of YYYY-MM-DD]",
    );
  args.set(key, value);
}
if (!args.has("--output") || !args.has("--publications"))
  throw new Error("--output and --publications are required");
const output = resolve(args.get("--output")!),
  publications = resolve(args.get("--publications")!);
if (output === publications || output.startsWith(publications + "/"))
  throw new Error("Use a separate packet output directory");
const root = fileURLToPath(new URL("..", import.meta.url));
const asOf = args.get("--as-of") ?? new Date().toISOString().slice(0, 10);
const catalog = supplierCatalog(),
  catalogText = JSON.stringify(catalog, null, 2),
  catalogHash = sha256(catalogText);
const evidence = args.has("--evidence")
  ? JSON.parse(await readFile(resolve(args.get("--evidence")!), "utf8"))
  : {
      program: "fl-pep",
      candidate: "AMP-PRACTICE-STUDENT",
      catalogSha256: catalogHash,
      records: [],
    };
const readiness = auditPacketEvidence(evidence, catalogHash, asOf);
const dossier = firstWaveDossiers.dossiers.find(
  (d) => d.programId === "fl-pep",
)!;
const ids = new Set(dossier.requirements.flatMap((r) => r.sourceIds));
const sources = firstWaveDossiers.sources.filter((s) => ids.has(s.id));
const researchErrors = auditDossiers(
  { checkedOn: firstWaveDossiers.checkedOn, sources, dossiers: [dossier] },
  asOf,
  ["fl-pep"],
);
if (researchErrors.length) throw new Error(researchErrors.join("; "));
const run = promisify(execFile);
await run("pdfinfo", ["-v"]);
await run("pdftotext", ["-v"]);
const verified = await Promise.all(
  catalog.books.map(async (b) => ({
    book: b,
    ...(await verifyPublication(root, join(publications, b.id), b)),
  })),
);
await mkdir(join(output, "samples"), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1200 },
  });
  // All input HTML must equal a render of registered source before it reaches the browser.
  await page.route("**/*", (route) => route.abort());
  const previews: PacketPreview[] = [];
  for (const v of verified) {
    await page.setContent(v.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const sample = page.locator(".book-page.lesson").first();
    if ((await sample.count()) !== 1)
      throw new Error(`Missing lesson sample: ${v.book.id}`);
    const pageId = await sample.getAttribute("id");
    const title = await sample.locator("h1,h2").first().innerText();
    const bytes = await sample.screenshot({
      path: join(output, "samples", `${v.book.id}.png`),
    });
    previews.push({
      bookId: v.book.id,
      pageId: pageId!,
      title,
      image: `data:image/png;base64,${bytes.toString("base64")}`,
      sha256: sha256(bytes),
    });
  }
  const html = renderSupplierPacket(catalog, previews, asOf);
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".content")).flatMap(
      (el, index) => {
        const box = el.getBoundingClientRect();
        const bounds = Array.from(el.querySelectorAll("*")).map((e) =>
          e.getBoundingClientRect(),
        );
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(walker.currentNode);
          bounds.push(...Array.from(r.getClientRects()));
        }
        return bounds.some(
          (b) =>
            b.bottom > box.bottom + 1 ||
            b.right > box.right + 1 ||
            b.left < box.left - 1,
        )
          ? [index + 1]
          : [];
      },
    ),
  );
  if (overflow.length) throw new Error(`Packet layout overflow: ${overflow}`);
  const pdfPath = join(output, "supplier-product-review.pdf");
  await page.pdf({
    path: pdfPath,
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true,
  });
  const { stdout: info } = await run("pdfinfo", [pdfPath]);
  const pageCount = await page.locator(".page").count();
  if (
    Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]) !== pageCount ||
    !/^Tagged:\s+yes/m.test(info)
  )
    throw new Error("Invalid physical PDF structure");
  const { stdout: text } = await run("pdftotext", [pdfPath, "-"]);
  for (const required of [
    "Unsent",
    "twelve-month",
    ...catalog.products.map((p) => p.id),
  ])
    if (!text.replace(/\s+/g, " ").includes(required))
      throw new Error(`Missing PDF text: ${required}`);
  for (let i = 0; i < pageCount; i++)
    await page
      .locator(".page")
      .nth(i)
      .screenshot({
        path: join(output, `page-${String(i + 1).padStart(2, "0")}.png`),
      });
  await writeFile(join(output, "index.html"), html);
  await writeFile(join(output, "catalog.json"), catalogText);
  await writeFile(join(output, "catalog.csv"), catalogCsv(catalog));
  await writeFile(
    join(output, "program-evidence.json"),
    JSON.stringify({ sources, dossier }, null, 2),
  );
  await writeFile(
    join(output, "transaction-document-templates.json"),
    JSON.stringify(transactionDocumentTemplates(), null, 2),
  );
  await writeFile(
    join(output, "operations-draft.md"),
    await readFile(join(root, "docs/esa-dossiers/florida-operations-draft.md")),
  );
  // Public readiness lists requirement IDs only; restricted references never enter generated output.
  await writeFile(
    join(output, "readiness.json"),
    JSON.stringify(readiness, null, 2),
  );
  const { stdout: commit } = await run("git", [
    "-C",
    root,
    "rev-parse",
    "HEAD",
  ]);
  const packetSourceFiles = [
    "src/funding/supplier-packet/catalog.ts",
    "src/funding/supplier-packet/documents.ts",
    "docs/esa-dossiers/florida-operations-draft.md",
    "src/funding/supplier-packet/evidence.ts",
    "src/funding/supplier-packet/publication.ts",
    "src/funding/supplier-packet/render.tsx",
    "scripts/supplier-packet.ts",
  ];
  const packetSourceHashes = Object.fromEntries(
    await Promise.all(
      packetSourceFiles.map(async (path) => [
        path,
        sha256(await readFile(join(root, path))),
      ]),
    ),
  );
  const { stdout: sourceStatus } = await run("git", [
    "-C",
    root,
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ...packetSourceFiles,
  ]);
  await writeFile(
    join(output, "validation.json"),
    JSON.stringify(
      {
        asOf,
        sourceCommit: commit.trim(),
        packetSourceHashes,
        packetSourceDirty: !!sourceStatus.trim(),
        catalogSha256: catalogHash,
        pdfSha256: sha256(await readFile(pdfPath)),
        htmlSha256: sha256(html),
        pages: pageCount,
        pdfTagged: true,
        overflow,
        books: verified.map((v) => ({
          id: v.book.id,
          contentSha256: v.book.contentSha256,
          pdfSha256: v.pdfSha256,
          sourceHashes: v.sourceHashes,
        })),
        samples: previews.map(({ image, ...rest }) => rest),
        review:
          "Automated layout and provenance checks; independent source and rendered-page review required.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ output, pages: pageCount, ...readiness }, null, 2),
  );
} finally {
  await browser.close();
}
