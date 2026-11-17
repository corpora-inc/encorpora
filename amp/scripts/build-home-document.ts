import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { brand } from "../src/brand";

/**
 * `/` gets its own document: the app's shell, with the light home entry
 * (`src/web/home-entry.tsx`) in place of the app's. A signed-out visitor from
 * an ad gets the pitch from that entry's small bundle; the app loads after
 * the pitch is up. The browser starts the film's poster, the pitch's code,
 * the prices and the two boot answers with the document. It also carries the
 * canonical link and structured data that only `/` needs.
 */
// AMP_DIST_DIR: a build elsewhere (scripts/verify-hostile-entry-ui.ts).
const dist = process.env.AMP_DIST_DIR
  ? pathToFileURL(`${resolve(process.env.AMP_DIST_DIR)}/`)
  : new URL("../dist/", import.meta.url);
const shell = await readFile(new URL("index.html", dist), "utf8");
const assets = await readdir(new URL("assets/", dist));
type Chunk = { file: string; imports?: string[]; css?: string[] };
// Vite's build manifest (vite.config.ts), read here and then removed: the
// documents name every file a page loads, and nothing else is served.
const manifestUrl = new URL(".vite/manifest.json", dist);
const manifest = JSON.parse(
  await readFile(manifestUrl, "utf8").catch(() => {
    throw new Error("build-home-document: run `vite build` first");
  }),
) as Record<string, Chunk>;
const homeKey = "src/web/home-entry.tsx";
if (!manifest[homeKey]) throw new Error("build-home-document: no home entry");
/** The home entry and every chunk it imports statically, in load order. */
const closure: Chunk[] = [];
const visit = (key: string) => {
  const chunk = manifest[key]!;
  if (closure.includes(chunk)) return;
  closure.push(chunk);
  for (const next of chunk.imports ?? []) visit(next);
};
visit(homeKey);
const asset = (pattern: RegExp) => {
  const name = assets.find((file) => pattern.test(file));
  if (!name) throw new Error(`build-home-document: no asset ${pattern}`);
  return `/assets/${name}`;
};
const origin = "https://amp.corpora.inc";
const organization = "https://corpora.inc/#organization";
const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": organization,
      name: brand.company,
      url: "https://corpora.inc/",
      logo: `${origin}/icon-512.png`,
      email: "support@corpora.inc",
      sameAs: [
        "https://www.youtube.com/@corporainc",
        "https://www.instagram.com/adaptivemathpathways",
        "https://x.com/corporainc",
        "https://www.tiktok.com/@adaptivemathpathways",
      ],
    },
    {
      "@type": "WebApplication",
      name: brand.name,
      alternateName: brand.expansion,
      url: `${origin}/`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: brand.description,
      publisher: { "@id": organization },
    },
  ],
};
const tags = [
  `<link rel="canonical" href="${origin}/" />`,
  `<link rel="preload" as="image" type="image/webp" href="${asset(/^pitch-poster-square-.*\.webp$/)}" media="(max-width: 480px)" fetchpriority="high" />`,
  `<link rel="preload" as="image" type="image/webp" href="${asset(/^pitch-poster-wide-.*\.webp$/)}" media="(min-width: 481px)" fetchpriority="high" />`,
  `<link rel="preload" as="fetch" crossorigin="anonymous" href="/api/v1/billing/prices" />`,
  // The two answers `/` waits on to choose the pitch or the app, asked with
  // the document instead of after the main bundle runs. Each matches its
  // fetch exactly (src/web/auth.ts): the configuration with same-origin
  // credentials, the session with the account client's "include".
  `<link rel="preload" as="fetch" crossorigin="anonymous" href="/api/v1/auth-config" />`,
  `<link rel="preload" as="fetch" crossorigin="use-credentials" href="/api/auth/get-session" />`,
  // `<` can't appear in the values, but escaping keeps a data block a data block.
  `<script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\\u003c")}</script>`,
];
if (!shell.includes("</head>"))
  throw new Error("build-home-document: the shell has no </head>");
// The pitch shows no math: its math-font preloads (index.html, for problem
// screens) would take a phone's first seconds of bandwidth from the pitch.
// The app (app/boot.tsx) preloads them once `/` resolves to it instead.
const mathFont = /<link\b[^>]*\bas="font"[^>]*KaTeX_[^>]*>\s*/g;
const fonts = shell.match(mathFont)?.length ?? 0;
if (fonts !== 3)
  throw new Error(
    `build-home-document: expected 3 math font preloads, found ${fonts}`,
  );
// The app's own script and the chunks it preloads are what the pitch doesn't
// wait for: the home entry imports the app once the pitch is up.
const appScript =
  /<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/;
const appEntry = appScript.exec(shell)?.[1];
if (!appEntry)
  throw new Error("build-home-document: the shell has no app script");
const [home$, ...homeImports] = closure;
const stylesheets = new Set(
  [...shell.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+)"/g)].map(
    (match) => match[1],
  ),
);
// The pitch's own styles, after the app's as when the pitch was the app's
// lazy screen; a sheet the app's document already links is linked once.
const pitchStyles = [
  ...new Set(closure.flatMap((chunk) => chunk.css ?? [])),
].filter((css) => !stylesheets.has(css));
const home = shell
  .replace(mathFont, "")
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
  .replace(
    appScript,
    // The release this document runs is named by the app's entry, as every
    // other document's script names it (src/web/lib/app-recovery.ts).
    `<meta name="amp-app-entry" content="${appEntry}" />
    <script type="module" crossorigin src="/${home$!.file}"></script>`,
  )
  .replace(
    "</head>",
    `${[
      ...homeImports.map(
        (chunk) =>
          `<link rel="modulepreload" crossorigin href="/${chunk.file}" />`,
      ),
      ...pitchStyles.map(
        (css) => `<link rel="stylesheet" crossorigin href="/${css}" />`,
      ),
      ...tags,
    ].join("\n    ")}\n  </head>`,
  );
// Every script AMP serves has a URL, so an error report can always say whose
// code failed: one with no URL ("inline") is a browser's or app's own. The
// content policy blocks inline scripts too; this keeps the document honest.
for (const [tag] of home.matchAll(/<script\b[^>]*>/gi))
  if (!/\bsrc=/.test(tag) && !/\btype="application\/ld\+json"/.test(tag))
    throw new Error(`build-home-document: inline script ${tag}`);
await writeFile(new URL("home.html", dist), home);
await rm(new URL(".vite/", dist), { recursive: true });
console.log("Built the home document.");
