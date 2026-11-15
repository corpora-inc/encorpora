import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { SiteConfig } from "./config.js";
import { title } from "./pages.js";
import { resources, videos, videoPath, workbookManifest } from "./resources/catalog.js";
import { articles } from "./library/catalog.js";
const xml = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export async function writeDiscovery(output: string, config: SiteConfig, routes: string[]) {
  if (config.mode !== "production" || !config.siteUrl) return;
  const absolute = (path: string) => new URL(path, config.siteUrl).href;
  const videoSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${videos.map(v => {
    const resource = resources.find(r => r.path === videoPath(v))!;
    return `<url><loc>${xml(absolute(videoPath(v)))}</loc><video:video><video:thumbnail_loc>${xml(v.posterUrl)}</video:thumbnail_loc><video:title>${xml(v.title)}</video:title><video:description>${xml(resource.description)}</video:description><video:content_loc>${xml(v.videoUrl)}</video:content_loc><video:duration>${Math.round(v.durationSeconds)}</video:duration><video:publication_date>${xml(v.uploadDate)}</video:publication_date><video:family_friendly>yes</video:family_friendly></video:video></url>`;
  }).join("")}</urlset>\n`;
  await writeFile(`${output}/video-sitemap.xml`, videoSitemap);
  await writeFile(`${output}/resource-catalog.json`, JSON.stringify({
    version: 1, name: "AMP Mathematics public resource catalog", publisher: "Corpora Inc", website: config.siteUrl,
    resources: resources.map(resource => ({
      url: absolute(resource.path), type: resource.kind, title: resource.label, description: resource.description,
      ...("level" in resource ? { level: resource.level.label } : {}),
      ...(resource.kind === "lesson" ? { lessonId: resource.lesson.id } : {}),
      ...(resource.kind === "video" ? { video: { contentUrl: resource.video.videoUrl, thumbnailUrl: resource.video.posterUrl, captionsUrl: resource.video.captionsUrl, transcriptUrl: resource.video.transcriptUrl, durationSeconds: resource.video.durationSeconds, uploadDate: resource.video.uploadDate, standards: resource.video.standardIds } } : {}),
      ...(resource.kind === "workbook" ? { edition: resource.workbook.date, files: resource.workbook.files.map(file => ({ ...file, url: absolute(file.url) })) } : {}),
    })),
  }, null, 2) + "\n");
  await writeFile(`${output}/workbook-editions.json`, JSON.stringify({ ...workbookManifest, editions: workbookManifest.editions.map(edition => ({ ...edition, cover: absolute(edition.cover), preview: absolute(edition.preview), files: edition.files.map(file => ({ ...file, url: absolute(file.url) })) })) }, null, 2) + "\n");
  const link = (path: string, label: string, description = "") => `- [${label}](${absolute(path)})${description ? `: ${description}` : ""}`;
  await writeFile(`${output}/llms.txt`, [
    "# AMP Mathematics by Corpora Inc", "", "> A complete adaptive mathematics curriculum from counting to precalculus, with mixed practice, concise lessons and personalized printable workbooks.", "",
    "AMP means Adaptive Math Pathways. The public website explains the curriculum, teaching approach, program comparisons, education-fund purchase routes and free resources. The learning application is at https://amp.corpora.inc.", "",
    "## Product and approach", ...["/amp/", "/plans/", "/parents/", "/schools/", "/esa/"].map(path => link(path, title(path, config))),
    ...articles.map(article => link(article.path, article.label, article.description)), "",
    "## Grade guides, comparisons and free resources", ...resources.map(resource => link(resource.path, resource.label, resource.description)), "",
    "## Education funding", ...config.funding.flatMap(funding => funding.page ? [link(`/esa/${funding.page.slug}/`, funding.program, funding.page.summary)] : []), "",
    "## Machine-readable catalogs", link("/resource-catalog.json", "Resource catalog", "Canonical pages, video files, captions, standards and workbook downloads."), link("/workbook-editions.json", "Current workbook editions", "Edition dates, page counts, permanent download URLs and SHA-256 checksums."), link("/sitemap.xml", "Page sitemap"), link("/video-sitemap.xml", "Video sitemap"), "",
  ].join("\n"));
  const documents = await Promise.all(routes.map(async path => ({
    url: absolute(path), sha256: createHash("sha256").update(await readFile(`${output}${path}index.html`)).digest("hex"),
  })));
  const indexNowKey = config.discovery?.indexNowKey;
  if (indexNowKey) await writeFile(`${output}/${indexNowKey}.txt`, indexNowKey);
  await writeFile(`${output}/search-index.json`, JSON.stringify({ origin: config.siteUrl, documents, ...(indexNowKey ? { keyLocation: absolute(`/${indexNowKey}.txt`) } : {}) }, null, 2) + "\n");
}
