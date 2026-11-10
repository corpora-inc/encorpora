import { readdir, readFile, writeFile } from "node:fs/promises";
import { brand } from "../src/brand";

/**
 * `/` gets its own document: the app's shell plus what the pitch paints first.
 * The browser starts the film's poster, the pitch's code and the prices while
 * the main bundle is still downloading, instead of finding them after it runs.
 * It also carries the canonical link and structured data that only `/` needs.
 */
const dist = new URL("../dist/", import.meta.url);
const shell = await readFile(new URL("index.html", dist), "utf8");
const assets = await readdir(new URL("assets/", dist));
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
  `<link rel="modulepreload" crossorigin href="${asset(/^PitchScreen-.*\.js$/)}" />`,
  `<link rel="preload" as="fetch" crossorigin="anonymous" href="/api/v1/billing/prices" />`,
  // `<` can't appear in the values, but escaping keeps a data block a data block.
  `<script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\\u003c")}</script>`,
];
if (!shell.includes("</head>"))
  throw new Error("build-home-document: the shell has no </head>");
await writeFile(
  new URL("home.html", dist),
  shell.replace("</head>", `${tags.join("\n    ")}\n  </head>`),
);
console.log("Built the home document.");
