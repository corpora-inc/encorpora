import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import {
  bandLabel,
  layout,
  neighborhood,
  relatedConnections,
  connectionLabel,
} from "../src/web/features/pathways/model";

const origin = "https://amp.corpora.inc";
const destination = new URL("../dist/", import.meta.url);
const shell = (
  await readFile(new URL("index.html", destination), "utf8")
).replace(
  /\n<!--amp-assessment-social-start-->[\s\S]*?<!--amp-assessment-social-end-->\n/g,
  "",
);
const byId = new Map(skills.map((skill) => [skill.id, skill]));
const dependents = new Map(
  skills.map((skill) => [
    skill.id,
    skills.filter((candidate) => candidate.prerequisites.includes(skill.id)),
  ]),
);
const points = layout(skills);
const positions = new Map(points.map((point) => [point.skill.id, point]));
const fontFiles = ["Regular", "Bold"].map((weight) =>
  fileURLToPath(
    new URL(
      `../node_modules/katex/dist/fonts/KaTeX_SansSerif-${weight}.ttf`,
      import.meta.url,
    ),
  ),
);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function skillUrl(id: string) {
  return `/pathways/${encodeURIComponent(id)}`;
}

function metaDescription(description: string) {
  return `${description.trim().replace(/[.!?]+$/, "")}. Explore this skill and its connections in AMP's free math map.`;
}

const mapColors = [
  "#6dbce4",
  "#a58be3",
  "#56d7c5",
  "#efbd74",
  "#8bd8bb",
  "#e694bb",
];
const minX = Math.min(...points.map((point) => point.position[0]));
const maxX = Math.max(...points.map((point) => point.position[0]));
const minY = Math.min(...points.map((point) => point.position[1]));
const maxY = Math.max(...points.map((point) => point.position[1]));
function project(id: string) {
  const position = positions.get(id)?.position;
  if (!position) throw new Error(`Missing map position for ${id}`);
  return {
    x: 675 + ((position[0] - minX) / (maxX - minX)) * 465,
    y: 545 - ((position[1] - minY) / (maxY - minY)) * 465,
  };
}
const mapEdges = skills
  .flatMap((skill) =>
    skill.prerequisites
      .filter((prior) => byId.has(prior))
      .map((prior) => {
        const from = project(prior);
        const to = project(skill.id);
        return `<path d="M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="#6cabae" stroke-opacity=".22" stroke-width="1"/>`;
      }),
  )
  .join("");
const mapNodes = skills
  .map((skill) => {
    const point = project(skill.id);
    return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.4" fill="${mapColors[neighborhood(skill)]}" fill-opacity=".7"/>`;
  })
  .join("");

function titleLines(title: string) {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(" ")) {
    if (line && `${line} ${word}`.length > 20) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function cardSvg(skill?: (typeof skills)[number]) {
  const title = skill?.title ?? "Explore math skills";
  const lines = titleLines(title);
  const grade = skill
    ? bandLabel(skill.gradeBand).toUpperCase()
    : "KINDERGARTEN THROUGH PRECALCULUS";
  const titleY = lines.length > 1 ? 260 : 290;
  if (
    lines.length > 3 ||
    lines.some((line) => line.length > 20) ||
    titleY + (lines.length - 1) * 63 + 52 > 460
  )
    throw new Error(`Social card title exceeds its text area: ${title}`);
  const selected = skill ? project(skill.id) : null;
  const closeConnections = skill
    ? [
        ...skill.prerequisites.map((id) => [id, skill.id] as const),
        ...(dependents.get(skill.id) ?? []).map(
          (next) => [skill.id, next.id] as const,
        ),
      ]
        .filter(([from, to]) => positions.has(from) && positions.has(to))
        .map(([from, to]) => {
          const a = project(from);
          const b = project(to);
          return `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}" stroke="#8ce8df" stroke-opacity=".8" stroke-width="2"/>`;
        })
        .join("")
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="surface" x2="1" y2="1"><stop stop-color="#071c25"/><stop offset="1" stop-color="#10263a"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#165f70" stop-opacity=".7"/><stop offset="1" stop-color="#165f70" stop-opacity="0"/></radialGradient>
      <clipPath id="map"><rect x="625" y="35" width="555" height="560" rx="26"/></clipPath>
    </defs>
    <rect width="1200" height="630" fill="url(#surface)"/>
    <circle cx="900" cy="315" r="350" fill="url(#glow)"/>
    <path d="M60 74c12-40 24-40 36 0s24 40 36 0 24-40 36 0" fill="none" stroke="#a1f0e4" stroke-width="3"/>
    <text x="190" y="80" fill="#c8eee7" font-family="KaTeX_SansSerif" font-size="24">AMP PATHWAYS</text>
    <text x="64" y="180" fill="#8ce8df" font-family="KaTeX_SansSerif" font-size="22">${escapeHtml(grade)}</text>
    ${lines.map((line, index) => `<text x="64" y="${titleY + index * 63}" fill="#f0f8f6" font-family="KaTeX_SansSerif" font-size="52">${escapeHtml(line)}</text>`).join("")}
    <text x="64" y="492" fill="#bfd7d5" font-family="KaTeX_SansSerif" font-size="25">Explore the skill map</text>
    <text x="64" y="550" fill="#8ce8df" font-family="KaTeX_SansSerif" font-size="22">amp.corpora.inc/pathways</text>
    <g clip-path="url(#map)">${mapEdges}${closeConnections}${mapNodes}
      ${selected ? `<circle cx="${selected.x.toFixed(1)}" cy="${selected.y.toFixed(1)}" r="21" fill="none" stroke="#c5fff2" stroke-opacity=".65" stroke-width="2"/><circle cx="${selected.x.toFixed(1)}" cy="${selected.y.toFixed(1)}" r="9" fill="#a1f0e4"/>` : ""}
    </g>
  </svg>`;
}

const imageDirectory = new URL("assets/pathway-cards/", destination);
await mkdir(imageDirectory, { recursive: true });
const cardUrls = new Map<string, string>();
async function writeCard(id: string, skill?: (typeof skills)[number]) {
  const png = new Resvg(cardSvg(skill), {
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: "KaTeX_SansSerif",
    },
  })
    .render()
    .asPng();
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 12);
  const filename = `${id}-${hash}.png`;
  await writeFile(new URL(filename, imageDirectory), png);
  cardUrls.set(id, `/assets/pathway-cards/${filename}`);
}
await writeCard("map");
for (const skill of skills) await writeCard(skill.id, skill);

function skillLinks(ids: string[]) {
  const links = ids
    .map((id) => byId.get(id))
    .filter((skill) => skill !== undefined)
    .map(
      (skill) =>
        `<li><a href="${skillUrl(skill.id)}">${escapeHtml(skill.title)}</a> <small>${escapeHtml(bandLabel(skill.gradeBand))}</small></li>`,
    );
  return links.length ? `<ul>${links.join("")}</ul>` : "<p>None listed.</p>";
}

const staticStyles = `<style>
  .pathways-static{max-width:780px;margin:0 auto;padding:clamp(20px,5vw,56px);font:16px/1.6 system-ui,sans-serif;color:#183e3a}
  .pathways-static h1{font-size:clamp(28px,5vw,42px);line-height:1.15}
  .pathways-static h2{font-size:20px;margin-top:32px}
  .pathways-static a{color:#086d78}
  .pathways-static li{margin:8px 0}
  .pathways-static small,.pathways-static .grade{color:#45615b}
  @media(prefers-color-scheme:dark){.pathways-static{color:#e9f0e8}.pathways-static a{color:#7ddbe2}.pathways-static small,.pathways-static .grade{color:#abc8bf}}
</style>`;

function page(
  title: string,
  description: string,
  path: string,
  content: string,
  imagePath: string,
) {
  const canonical = `${origin}${path}`;
  const image = `${origin}${imagePath}`;
  const withHead = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    )
    .replace(
      "</head>",
      `<link rel="canonical" href="${canonical}" data-pathways-static="" />
      <meta property="og:type" content="website" data-pathways-static="" />
      <meta property="og:title" content="${escapeHtml(title)}" data-pathways-static="" />
      <meta property="og:description" content="${escapeHtml(description)}" data-pathways-static="" />
      <meta property="og:url" content="${canonical}" data-pathways-static="" />
      <meta property="og:image" content="${image}" data-pathways-static="" />
      <meta property="og:image:width" content="1200" data-pathways-static="" />
      <meta property="og:image:height" content="630" data-pathways-static="" />
      <meta name="twitter:card" content="summary_large_image" data-pathways-static="" />
      <meta name="twitter:image" content="${image}" data-pathways-static="" />
      ${staticStyles}</head>`,
    );
  if (withHead === shell || !withHead.includes('rel="canonical"'))
    throw new Error("Vite HTML shell did not expose the expected head");
  const rootStart = withHead.indexOf('<div id="root">');
  const bodyEnd = withHead.indexOf("</body>", rootStart);
  if (rootStart < 0 || bodyEnd < 0)
    throw new Error("Vite HTML shell has no app root");
  return `${withHead.slice(0, rootStart)}<div id="root">${content}</div>\n  ${withHead.slice(bodyEnd)}`;
}

function skillPage(skill: (typeof skills)[number]) {
  const families = templates.filter(
    (template) => template.skillId === skill.id,
  );
  const typeList = families.length
    ? `<ul>${families
        .map(
          (family) =>
            `<li>${escapeHtml(family.title ?? family.id.replaceAll("-", " "))}</li>`,
        )
        .join("")}</ul>`
    : "<p>Practice for this skill is being developed.</p>";
  const next = dependents.get(skill.id) ?? [];
  const related = relatedConnections(skills, skill.id);
  const relatedList = related.length
    ? `<ul>${related.map(({ skill: other, connection }) => `<li><a href="${skillUrl(other.id)}">${escapeHtml(other.title)}</a> · ${escapeHtml(bandLabel(other.gradeBand))}${connection ? ` · ${escapeHtml(connectionLabel(connection))}<p>${escapeHtml(connection.explanation)}</p>` : " · Shared foundations"}</li>`).join("")}</ul>`
    : "<p>None listed.</p>";
  const content = `<main class="pathways-static">
    <nav><a href="/pathways">Explore the whole skill map</a></nav>
    <p class="grade">${escapeHtml(bandLabel(skill.gradeBand))}</p>
    <h1>${escapeHtml(skill.title)}</h1>
    <p>${escapeHtml(skill.description)}</p>
    <section><h2>Problem types</h2>${typeList}</section>
    <section><h2>Builds on</h2>${skillLinks(skill.prerequisites)}</section>
    <section><h2>Leads to</h2>${skillLinks(next.map((item) => item.id))}</section>
    <section><h2>Related skills</h2>${relatedList}</section>
    <p><a href="/pathways">Open the interactive map</a> to explore lessons and skill connections.</p>
  </main>`;
  return page(
    `${skill.title} · ${bandLabel(skill.gradeBand)} | AMP Pathways`,
    metaDescription(skill.description),
    skillUrl(skill.id),
    content,
    cardUrls.get(skill.id)!,
  );
}

const catalog = skills.map((skill) => skill.id);
if (new Set(catalog).size !== catalog.length)
  throw new Error("Skill IDs must be unique for public URLs");
for (const skill of skills) {
  if (!/^[a-z0-9-]+$/.test(skill.id))
    throw new Error(`Skill ID cannot be a public path segment: ${skill.id}`);
  const directory = new URL(`pathways/${skill.id}/`, destination);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("index.html", directory), skillPage(skill));
}

const groups = new Map<string, typeof skills>();
for (const skill of skills) {
  const group = groups.get(skill.gradeBand) ?? [];
  group.push(skill);
  groups.set(skill.gradeBand, group);
}
const listing = [...groups]
  .map(
    ([band, group]) =>
      `<section><h2>${escapeHtml(bandLabel(band))}</h2>${skillLinks(group.map((skill) => skill.id))}</section>`,
  )
  .join("");
const mapDirectory = new URL("pathways/", destination);
await mkdir(mapDirectory, { recursive: true });
await writeFile(
  new URL("index.html", mapDirectory),
  page(
    "Explore Math Skills | AMP Pathways",
    "Explore connected math skills from kindergarten through precalculus. Browse lessons and see how each skill builds on another.",
    "/pathways",
    `<main class="pathways-static"><h1>Your pathways</h1><p>Explore connected math skills from kindergarten through precalculus. Each link opens a skill with its problem types and connections.</p>${listing}<p><a href="/try">Start free assessment</a></p></main>`,
    cardUrls.get("map")!,
  ),
);
// The SPA fallback also serves /try. Give assessment invitations a cached
// curriculum image; skill documents above retain their own specific metadata.
const assessmentImage = origin + cardUrls.get("map")!;
await writeFile(
  new URL("index.html", destination),
  shell.replace(
    "</head>",
    `
<!--amp-assessment-social-start-->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Think you’re good at math? | Adaptive Math Pathways" />
  <meta property="og:description" content="Take a free math assessment, find your level, and explore connected math pathways from kindergarten through precalculus." />
  <meta property="og:url" content="${origin}/try" />
  <meta property="og:image" content="${assessmentImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${assessmentImage}" />
<!--amp-assessment-social-end-->
</head>`,
  ),
);
const urls = ["/pathways", ...skills.map((skill) => skillUrl(skill.id))];
await writeFile(
  new URL("sitemap.xml", destination),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${escapeHtml(origin + path)}</loc></url>`).join("\n")}\n</urlset>\n`,
);
await writeFile(
  new URL("robots.txt", destination),
  `User-agent: *\nAllow: /pathways\nSitemap: ${origin}/sitemap.xml\n`,
);
const privateBuild = new URL("../artifacts/", import.meta.url);
await mkdir(privateBuild, { recursive: true });
await writeFile(
  new URL("pathways-nginx-map.conf", privateBuild),
  `# Generated catalog whitelist for legacy /pathways?skill= links.\nmap $arg_skill $pathways_document {\n  default /pathways/index.html;\n${skills.map((skill) => `  ${skill.id} /pathways/${skill.id}/index.html;`).join("\n")}\n}\n`,
);
console.log(`Built ${skills.length} public skill pages and a sitemap.`);
