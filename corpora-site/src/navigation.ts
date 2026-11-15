/** Keep shared article URLs usable while publishing one canonical guide. */
export const redirects: Readonly<Record<string, string>> = {
  "/how-it-works/": "/amp/how-it-works/",
};

/** Keep an article's historical analytics category when its URL moves. */
export function analyticsPath(path: string): string {
  const normalized = path.replace(/\/$/, "");
  return Object.entries(redirects).find(([, destination]) => destination.replace(/\/$/, "") === normalized)?.[0] ?? path;
}

/** React's serialized anchors use quoted attributes and escaped values. Apply
 * the policy to every generated document, including shared AMP components.
 * Keep referrers: site-to-app attribution must survive the new tab. */
export function externalLinks(html: string, siteUrl = "https://corpora.inc/"): string {
  const origin = new URL(siteUrl).origin;
  return html.replace(/<a(?=\s|>)[^>]*>/g, tag => {
    const href = tag.match(/\shref="([^"]*)"/)?.[1];
    if (!href || !/^(https?:)?\/\//i.test(href)) return tag;
    const destination = new URL(href.replaceAll("&amp;", "&"), siteUrl);
    if (destination.origin === origin) return tag;
    const rel = new Set((tag.match(/\srel="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    return tag.replace(/\s(?:target|rel)="[^"]*"/g, "").replace(/>$/, ` target="_blank" rel="${[...rel].join(" ")}">`);
  });
}
