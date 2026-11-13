import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { coinKinds } from "../src/math/scene/art.js";
import { layoutScene, type Scene } from "../src/math/scene/index.js";
import { IMAGE_EDGE, type Drawn } from "../src/math/scene/layout.js";
import { coinFaceUrl } from "../src/web/scene/coin-art.js";
import { SceneSvg } from "../src/web/scene/SceneSvg.js";
import { Figure } from "../src/web/Figure.js";

const art = (name: string) =>
  readFileSync(new URL(`../src/web/scene/coin-art/${name}`, import.meta.url));
const coinScene = (coins: string[]): Scene =>
  ({
    v: 1,
    elements: [
      { type: "coins", id: "c", coins: coins.map((coin) => ({ coin })) },
    ],
  }) as Scene;

test("each coin face is a small bundled WebP, embedded exactly as on disk", () => {
  const readme = art("README.md").toString();
  for (const coin of coinKinds) {
    const bytes = art(`${coin}.webp`);
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF", coin);
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP", coin);
    assert.ok(bytes.length <= 60 * 1024, `${coin} is ${bytes.length} bytes`);
    const [head, data] = coinFaceUrl[coin].split(",");
    assert.equal(head, "data:image/webp;base64");
    assert.ok(
      Buffer.from(data!, "base64").equals(bytes),
      `coin-art.ts is stale for ${coin}: run npx tsx scripts/build-coin-art.ts`,
    );
    // Every file has its source and public-domain basis recorded.
    assert.match(
      readme,
      new RegExp(`\\| \`${coin}\\.webp\` \\|.*https://.*\\| .+ \\|`),
    );
  }
});

test("an image takes the room of a circle outlined 2 px wide, and no more", () => {
  const l = layoutScene(coinScene(["quarter"]));
  const face = l.items.find((d) => d.id === "c.coin.0") as Extract<
    Drawn,
    { k: "image" }
  >;
  assert.equal(face.k, "image");
  assert.equal(l.width, Math.ceil(2 * face.r + IMAGE_EDGE + 2 * 4));
  assert.equal(l.height, Math.ceil(2 * face.r + IMAGE_EDGE + 2 * 4));
  assert.ok(Math.abs(face.cx - l.width / 2) < 1);
});

test("the renderer draws each coin's photo over a metal disc, unnamed, and lights it with a ring", () => {
  const coins = ["penny", "nickel", "dime", "quarter"];
  const layout = layoutScene(coinScene(coins));
  const plain = renderToStaticMarkup(
    React.createElement(SceneSvg, { layout, label: "Four coins" }),
  );
  assert.equal(plain.match(/<image /g)?.length, 4);
  assert.equal(plain.match(/href="data:image\/webp;base64,/g)?.length, 4);
  assert.match(plain, /fill="var\(--color-coin-copper\)"/);
  assert.equal(plain.match(/fill="var\(--color-coin-silver\)"/g)?.length, 3);
  // Ridges only on the reeded coins: the dime and the quarter.
  assert.equal(plain.match(/stroke-dasharray="0.42 0.58"/g)?.length, 2);
  assert.ok(!/penny|nickel|dime|quarter/.test(plain), "a coin is named");
  assert.ok(!plain.includes("data-coin-lit"));

  const lit = renderToStaticMarkup(
    React.createElement(SceneSvg, {
      layout,
      label: "Four coins",
      states: { "c.coin.2": { highlight: true, emphasis: 1 } },
    }),
  );
  assert.equal(lit.match(/data-coin-lit/g)?.length, 1);
  assert.equal(lit.match(/scale\(1.25\)/g)?.length, 1);
  // The portrait is never recolored: the same four photos.
  assert.equal(lit.match(/href="data:image\/webp;base64,/g)?.length, 4);
});

test("money sets draw the same coin faces, each with its value written on it", () => {
  const svg = renderToStaticMarkup(
    React.createElement(Figure, {
      figure: {
        kind: "money-sets",
        sets: [{ items: ["quarter", "dime", "nickel", "penny", "dollar"] }],
      },
    } as never),
  );
  assert.equal(svg.match(/<image /g)?.length, 4);
  for (const coin of ["quarter", "dime", "nickel", "penny"] as const)
    assert.ok(svg.includes(coinFaceUrl[coin]), coin);
  for (const value of ["25¢", "10¢", "5¢", "1¢", "$1"])
    assert.ok(svg.includes(`>${value}<`), value);
});
