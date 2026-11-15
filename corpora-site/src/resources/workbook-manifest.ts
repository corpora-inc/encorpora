import { readFileSync } from "node:fs";
import { z } from "zod";
import bundled from "./workbooks.json";

const grade = z.enum(["K", "1", "2", "3", "4", "5", "6", "7", "8", "algebra-1", "geometry", "algebra-2", "precalculus"]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.string().refine(value => {
  if (/^\/workbooks\/\d{4}-\d{2}-\d{2}\/[a-z0-9/-]+\.(pdf|webp|png)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.origin === "https://d38iwc9748jekz.cloudfront.net" && !url.search && !url.hash && /^\/amp\/public-site\/workbooks\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\/[a-z0-9/-]+\.(pdf|png|webp)$/.test(url.pathname);
  } catch { return false; }
}, "Expected a dated public workbook asset");
const pdf = z.strictObject({
  paper: z.enum(["letter", "a4"]), bytes: z.number().int().positive(), sha256: hash,
  pages: z.number().int().positive(), studentPages: z.number().int().positive(),
  answerKeyPages: z.number().int().positive(), url: asset,
}).refine(v => v.url.endsWith(".pdf") && v.pages === v.studentPages + v.answerKeyPages);
const edition = z.strictObject({
  grade, slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1),
  minutes: z.number().min(42.5).max(45), topics: z.array(z.string().min(1)).min(1),
  areas: z.array(z.string().min(1)).min(3), problems: z.number().int().min(6), date: z.iso.date(),
  files: z.array(pdf).length(2).refine(v => new Set(v.map(f => f.paper)).size === 2),
  cover: asset, preview: asset, sourceCommit: z.string().regex(/^[a-f0-9]{40}$/), generatorSha256: hash.optional(), generationSeed: z.string().min(1).max(200).optional(),
}).refine(v => !v.cover.endsWith(".pdf") && !v.preview.endsWith(".pdf"));
export const workbookManifestSchema = z.strictObject({
  date: z.iso.date(), editions: z.array(edition).length(13),
}).superRefine((value, ctx) => {
  if (new Set(value.editions.map(e => e.grade)).size !== 13 || new Set(value.editions.map(e => e.slug)).size !== 13)
    ctx.addIssue({ code: "custom", message: "Every grade/course must appear exactly once" });
  if (value.editions.some(e => e.date !== value.date || ![e.cover, e.preview, ...e.files.map(f => f.url)].every(url => url.includes(`/${value.date}/`))))
    ctx.addIssue({ code: "custom", message: "Asset dates must match the edition" });
  if (value.date > new Date().toISOString().slice(0, 10))
    ctx.addIssue({ code: "custom", message: "A workbook edition cannot be future-dated" });
});
export const workbookManifest = workbookManifestSchema.parse(
  process.env.CORPORA_WORKBOOK_MANIFEST
    ? JSON.parse(readFileSync(process.env.CORPORA_WORKBOOK_MANIFEST, "utf8"))
    : bundled,
);
export type WorkbookManifest = z.infer<typeof workbookManifestSchema>;
