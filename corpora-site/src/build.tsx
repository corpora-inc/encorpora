import { writeDiscovery } from "./discovery.js";
import { createHash } from "node:crypto";
import { workbookManifest } from "./resources/catalog.js";
import { printFigureCss, publicationCss } from "../../amp/src/content/print-exercise.js";
import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import React, { renderToStaticMarkup } from "./react.js";
import type { SiteConfig } from "./config.js";
import { Page, RedirectPage, routesFor, title } from "./pages.js";
import { externalLinks, redirects } from "./navigation.js";
import { build as bundle } from "esbuild";
import { product } from "./product.js";
import { writeIcons } from "./icons.js";
import { parseTokens, renderCard } from "./social-card.js";
export async function buildSite(config: SiteConfig, output: string = "dist") {
  const routes = routesFor(config);
  // A checkout without LFS must fail before publishing pointer text as a PDF.
  // CDN editions are validated by their publishing job before this manifest is used.
  for(const edition of workbookManifest.editions) for(const file of edition.files) {
    if(!file.url.startsWith("/")) continue;
    const bytes=await readFile(`public${file.url}`);
    if(bytes.subarray(0,5).toString()!=="%PDF-" || createHash("sha256").update(bytes).digest("hex")!==file.sha256) throw new Error(`Invalid public workbook asset: ${file.url}. Fetch public Git LFS assets before building.`);
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(`${output}/assets`, { recursive: true });
  // Extract the existing token block; loading the entire app stylesheet would
  // import app layout selectors into an unrelated document.
  const theme = await readFile("../amp/src/web/ui/tokens.css", "utf8");
  const tokens = theme.match(/:root\s*\{[^}]+\}/)?.[0];
  if (!tokens) throw new Error("AMP theme token block not found");
  await writeFile(
    `${output}/assets/site.css`,
    tokens + "\n" + (await readFile("src/site.css", "utf8")),
  );
  await cp("src/library.css", `${output}/assets/library.css`);
  await writeFile(`${output}/assets/resources.css`, printFigureCss()+"\n"+publicationCss.split("}").filter(rule=>rule.trim().startsWith(".print-")).map(rule=>rule+"}").join("\n")+"\n"+await readFile("src/resources.css","utf8"));
  await cp("public", output, { recursive: true });
  await cp(
    "../amp/node_modules/katex/dist/katex.min.css",
    `${output}/assets/katex.min.css`,
  );
  await cp("../amp/node_modules/katex/dist/fonts", `${output}/assets/fonts`, {
    recursive: true,
  });
  await writeFile(
    `${output}/assets/print.js`,
    'document.querySelector("[data-print]")?.addEventListener("click",()=>window.print());\n',
  );
  await writeIcons(output, config);
  await cp("src/invoice-client.js", `${output}/assets/invoice.js`);
  await bundle({entryPoints:["src/engagement-client.ts"],bundle:true,format:"iife",platform:"browser",target:"es2022",minify:true,define:{__AMP_SITE_PAGES__:JSON.stringify(Object.fromEntries(routes.map(route=>[route.replace(/\/$/,"")||"/",title(route,config)])))},outfile:`${output}/assets/engagement.js`});
  await cp("src/campaign-client.js", `${output}/assets/campaign.js`);
  await cp("src/acquisition-client.js", `${output}/assets/acquisition.js`);
  // Every page gets its own share card, named by content hash so a changed
  // card is never served from a social network's stale image cache.
  await mkdir(`${output}/assets/social`, { recursive: true });
  const themeTokens = parseTokens(theme);
  for (const route of routes) {
    const card = renderCard(route, config, themeTokens);
    await writeFile(`${output}/assets/social/${card.name}`, card.png);
    const dir = `${output}${route}`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}index.html`,
      "<!doctype html>" +
        externalLinks(renderToStaticMarkup(
          <Page
            route={route}
            config={config}
            socialImage={{ path: `/assets/social/${card.name}`, alt: card.alt }}
          />,
        ), config.siteUrl),
    );
  }
  await writeFile(`${output}/404.html`, "<!doctype html>" + externalLinks(renderToStaticMarkup(<Page route="/404/" config={config} />), config.siteUrl));
  for (const [previous, destination] of Object.entries(redirects)) {
    if (!routes.includes(destination) || routes.includes(previous)) throw new Error(`Invalid page redirect: ${previous}`);
    await mkdir(`${output}${previous}`, { recursive: true });
    await writeFile(`${output}${previous}index.html`, "<!doctype html>" + renderToStaticMarkup(<RedirectPage destination={destination} config={config} />));
  }
  await writeDiscovery(output, config, routes);
  await writeFile(
    `${output}/coverage.json`,
    // Publishes the curriculum's breadth. The audit's workflow counters track
    // engineering work inside AMP and stay internal (#1996).
    JSON.stringify(
      {
        product: "AMP Mathematics",
        scope: "A complete math curriculum, from counting to precalculus.",
        counts: {
          problemTypes: product.summary.templatesPresent,
          skills: product.skillsWithProblems,
          lessons: product.summary.lessonsPresent,
        },
        gradeBands: product.bands.map(({ band, templates }) => ({
          band,
          problemTypes: templates.map(({ id, title, description }) => ({
            id,
            title,
            description,
          })),
        })),
        source: "AMP curriculum and content audit",
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${output}/robots.txt`,
    config.mode === "preview"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", config.siteUrl).href}\nSitemap: ${new URL("/video-sitemap.xml", config.siteUrl).href}\n`,
  );
  if (config.siteUrl)
    await writeFile(
      `${output}/sitemap.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${new URL(r, config.siteUrl).href.replaceAll("&", "&amp;")}</loc></url>`).join("")}</urlset>`,
    );
  console.log(
    `Built ${routes.length} static pages (${config.mode}); coverage audit valid.`,
  );
}
