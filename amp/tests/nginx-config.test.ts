import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const conf = readFileSync("docker/nginx.conf", "utf8");
const headers = readFileSync("docker/security-headers.conf", "utf8");

test("every location that sets a header also includes the security headers", () => {
  // nginx silently drops inherited add_header lines in a location with its own.
  const locations = [...conf.matchAll(/location [^{]+\{([^}]*)\}/g)];
  assert.ok(locations.length > 5);
  for (const [block, body] of locations) {
    if (!/add_header/.test(body!)) continue;
    assert.match(
      body!,
      /include \/etc\/nginx\/amp-security-headers\.conf;/,
      block,
    );
  }
  assert.doesNotMatch(
    conf.replace(/location [^{]+\{[^}]*\}/g, ""),
    /^\s*add_header/m,
    "headers belong in the snippet, not the server block",
  );
});

test("a missing file is a 404, and prefix routes win over the file rule", () => {
  assert.match(
    conf,
    /location ~ \\\.\[A-Za-z0-9\]\+\$ \{[^}]*try_files \$uri =404;/,
  );
  assert.match(conf, /location \^~ \/assets\//);
  assert.match(conf, /location \^~ \/pathways\//);
});

test("the security headers are complete and scripts stay restricted", () => {
  for (const header of [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Content-Security-Policy",
  ])
    assert.ok(headers.includes(`add_header ${header} `), header);
  const script = /script-src ([^;]+);/.exec(headers)?.[1] ?? "";
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval|https:(?!\/\/)/);
  assert.match(headers, /frame-ancestors 'self' https:\/\/corpora\.inc;/);
});

test("the camera is ours alone, and a class code stays out of access logs", () => {
  assert.match(
    headers,
    /Permissions-Policy "camera=\(self\), microphone=\(\), geolocation=\(\)"/,
  );
  assert.match(conf, /location \^~ \/join\/ \{\s*access_log off;/);
});

test("a family's progress link stays out of search and sends no referrer", () => {
  const block = /location = \/p \{([^}]*)\}/.exec(conf)?.[1] ?? "";
  assert.match(block, /X-Robots-Tag "noindex, nofollow" always;/);
  assert.match(block, /include \/etc\/nginx\/amp-security-headers\.conf;/);
  // The later header is the one browsers use.
  assert.match(
    block,
    /amp-security-headers\.conf;[\s\S]*Referrer-Policy no-referrer always;/,
  );
});

test("the component gallery stays out of search", () => {
  // `/design` and the documents it frames (`/design/canvas`, `/design/specimen/<id>`).
  const block =
    /location ~ \^\/design\(\?:\/\|\$\) \{([\s\S]*?)\n  \}/.exec(conf)?.[1] ?? "";
  assert.match(block, /X-Robots-Tag "noindex, nofollow" always;/);
  assert.match(block, /include \/etc\/nginx\/amp-security-headers\.conf;/);
  // Only the gallery's known addresses (document-routes.ts) are served.
  assert.match(block, /if \(\$amp_route_known = 0\) \{ return 404; \}/);
});

/** Whether a CSP directive allows an https URL. A `*.host` source matches
 * subdomains only, never the bare host (CSP3 §6.7.2.6). */
function allows(directive: string, url: string) {
  const sources = new RegExp(`(?:^|; )${directive} ([^;]+)`).exec(
    /Content-Security-Policy "([^"]+)"/.exec(headers)?.[1] ?? "",
  )?.[1];
  assert.ok(sources, `no ${directive}`);
  const host = new URL(url).host;
  return sources.split(" ").some((source) => {
    const match = /^https:\/\/(\*\.)?([^/]+)$/.exec(source);
    if (!match) return false;
    return match[1] ? host.endsWith(`.${match[2]}`) : host === match[2];
  });
}

test("every host GA4 sends to with ad storage granted is allowed", () => {
  // From the live tag on 2026-11-17: with US ad storage granted the hits move
  // off the regional collectors, and a blocked host silently empties GA.
  for (const url of [
    "https://region1.google-analytics.com/g/collect",
    "https://analytics.google.com/g/collect",
    "https://region1.analytics.google.com/g/collect",
    "https://www.google.com/g/collect",
    "https://stats.g.doubleclick.net/g/collect",
    "https://www.googletagmanager.com/gtag/js",
  ]) {
    assert.ok(allows("connect-src", url), `connect-src blocks ${url}`);
    assert.ok(allows("img-src", url), `img-src blocks ${url}`);
  }
  assert.ok(!allows("connect-src", "https://google.com.evil.example/x"));
});
