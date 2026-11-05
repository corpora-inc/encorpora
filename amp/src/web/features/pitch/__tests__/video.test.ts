import { expect, test } from "vitest";
import {
  chooseSource,
  formatDuration,
  pitchFixture,
  pitchVideo,
  reachedQuartiles,
} from "../video";

const sources = [
  { url: "a-1920.mp4", type: "video/mp4", width: 1920 },
  { url: "a-640.webm", type: "video/webm", width: 640 },
  { url: "a-1280.webm", type: "video/webm", width: 1280 },
];

test("plays the smallest source that fills the player, in a playable codec", () => {
  const all = () => true;
  expect(chooseSource(sources, 600, all)?.url).toBe("a-640.webm");
  expect(chooseSource(sources, 1100, all)?.url).toBe("a-1280.webm");
  expect(chooseSource(sources, 4000, all)?.url).toBe("a-1920.mp4");
  const mp4Only = (type: string) => type === "video/mp4";
  expect(chooseSource(sources, 600, mp4Only)?.url).toBe("a-1920.mp4");
  expect(chooseSource(sources, 600, () => false)).toBeNull();
});

test("progress quartiles are reported once each", () => {
  const seen = new Set<number>();
  expect(reachedQuartiles(0.1, seen)).toEqual([]);
  expect(reachedQuartiles(0.55, seen)).toEqual([25, 50]);
  seen.add(25).add(50);
  expect(reachedQuartiles(0.6, seen)).toEqual([]);
  expect(reachedQuartiles(0.995, seen)).toEqual([75, 100]);
});

test("durations read as minutes and seconds", () => {
  expect(formatDuration(8)).toBe("0:08");
  expect(formatDuration(92.4)).toBe("1:32");
});

test("tests and development use the local fixture; it is never production media", () => {
  expect(pitchVideo).toBe(pitchFixture);
  expect(pitchFixture.title).toMatch(/fixture/i);
  for (const url of [
    pitchFixture.poster.url,
    pitchFixture.captions.url,
    ...pitchFixture.sources.map((s) => s.url),
  ])
    expect(url.startsWith("/__amp-fixtures/")).toBe(true);
});
