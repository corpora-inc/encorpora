import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARD_AREAS,
  facebookShareUrl,
  levelCardData,
  levelShareUrl,
  mayBeChild,
  shareText,
  xShareUrl,
} from "../src/web/features/trial/share-data";

const estimate = (level: number, answered: number) => ({
  level,
  sd: 0.8,
  answered,
  independent: answered - 1,
});
/** Progress as the trial API returns it, plus fields a careless caller
 * might pass along: none of them may reach a card. */
const progress = {
  learnerId: "1f9c7e9a-3b8e-4d0a-9a51-1c2d3e4f5a6b",
  token: "trial-token-must-never-leave",
  name: "Avery",
  birthYear: 2016,
  totals: { answered: 25, correct: 20, assisted: 2 },
  frontier: {
    current: {
      expected: 4,
      overall: estimate(4.234567, 25),
      strands: {
        number: estimate(4.5, 6),
        fractions: estimate(3.2, 5),
        geometry: estimate(5.1, 4),
        data: estimate(4, 3),
        algebra: estimate(4.4, 3),
        measurement: estimate(3.9, 2),
        operations: estimate(4.1, 2),
      },
    },
  },
};
const order = [
  "number",
  "operations",
  "fractions",
  "algebra",
  "geometry",
  "measurement",
  "data",
];

test("a level card carries levels and a count, nothing that identifies anyone", () => {
  const card = levelCardData(progress, order);
  assert.deepEqual(Object.keys(card).sort(), [
    "answered",
    "overall",
    "strands",
  ]);
  assert.deepEqual(Object.keys(card.overall).sort(), ["level", "sd"]);
  for (const area of card.strands)
    assert.deepEqual(Object.keys(area).sort(), ["level", "sd", "strand"]);
  const text = JSON.stringify(card);
  for (const secret of [
    progress.learnerId,
    progress.token,
    progress.name,
    String(progress.birthYear),
    "expected",
  ])
    assert.ok(!text.includes(secret), `the card omits ${secret}`);
  assert.equal(card.answered, 25);
  assert.equal(card.overall.level, 4.23);
  // The most practiced areas, at most CARD_AREAS, in the map's order.
  assert.equal(card.strands.length, CARD_AREAS);
  assert.deepEqual(
    card.strands.map((area) => area.strand),
    ["number", "operations", "fractions", "algebra", "geometry", "data"],
  );
});

test("the shared link starts a fresh level check and carries no learner data", () => {
  const link = new URL(levelShareUrl("https://amp.corpora.inc"));
  assert.equal(link.origin + link.pathname, "https://amp.corpora.inc/level");
  assert.deepEqual(
    [...link.searchParams.entries()],
    [
      ["utm_source", "share"],
      ["utm_medium", "level-card"],
    ],
  );
  assert.equal(link.hash, "");
  const facebook = new URL(facebookShareUrl(link.href));
  assert.equal(facebook.origin, "https://www.facebook.com");
  assert.deepEqual([...facebook.searchParams.keys()], ["u"]);
  assert.equal(facebook.searchParams.get("u"), link.href);
  const x = new URL(xShareUrl(link.href));
  assert.equal(x.origin, "https://x.com");
  assert.deepEqual(Object.fromEntries(x.searchParams), {
    text: shareText,
    url: link.href,
  });
});

test("social sharing waits for a grown-up unless the learner is surely 13 or older", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(mayBeChild(null, now), true);
  assert.equal(mayBeChild(undefined, now), true);
  assert.equal(mayBeChild(2016, now), true);
  // Born in 2013: 12 or 13 this year, so possibly 12.
  assert.equal(mayBeChild(2013, now), true);
  assert.equal(mayBeChild(2012, now), false);
  assert.equal(mayBeChild(1985, now), false);
});

test("/level serves the app with the card's Open Graph tags and no learner data", () => {
  const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const index = read("index.html"),
    level = read("level.html");
  const body = (html: string) => html.slice(html.indexOf("<body>"));
  assert.equal(body(level), body(index), "the same app boots");
  const og = (property: string) =>
    new RegExp(`<meta property="og:${property}" content="([^"]+)"`).exec(
      level,
    )?.[1];
  assert.equal(og("url"), "https://amp.corpora.inc/level");
  assert.equal(og("image"), "https://amp.corpora.inc/og/level.jpg");
  assert.equal(og("title"), "What’s your level?");
  assert.match(
    level,
    /<meta name="twitter:card" content="summary_large_image"/,
  );
  // A JPEG, so Git LFS (which holds *.png here) never swaps in a pointer.
  const image = readFileSync(
    new URL("../public/og/level.jpg", import.meta.url),
  );
  assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  const nginx = read("docker/nginx.conf");
  assert.match(
    nginx,
    /location = \/level \{[^}]*try_files \/level\.html =404;/,
  );
  assert.match(read("vite.config.ts"), /level: "level\.html"/);
});
