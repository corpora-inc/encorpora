import { expect, test } from "vitest";
import {
  browserFilmMix,
  chooseSource,
  formatDuration,
  pitchFilm,
  pitchFixture,
  pitchVideo,
  reachedQuartiles,
  reachedSeconds,
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

test("early watch marks are reported once each", () => {
  const seen = new Set<number>();
  expect(reachedSeconds(2.9, seen)).toEqual([]);
  expect(reachedSeconds(10.2, seen)).toEqual([3, 10]);
  seen.add(3).add(10);
  expect(reachedSeconds(12, seen)).toEqual([]);
  expect(reachedSeconds(31, seen)).toEqual([20, 30]);
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
    pitchFixture.captions!.url,
    ...pitchFixture.sources.map((s) => s.url),
  ])
    expect(url.startsWith("/__amp-fixtures/")).toBe(true);
});

test("the film offers the same sizes in every mix, from the CDN", () => {
  const sizes = (list: readonly { width: number }[]) =>
    list.map((source) => source.width);
  const mixes = pitchFilm.mixes!;
  expect(sizes(mixes.a)).toEqual([854, 1280, 1920]);
  expect(sizes(mixes.b)).toEqual(sizes(mixes.a));
  expect(sizes(mixes.c)).toEqual(sizes(mixes.a));
  for (const [mix, sources] of Object.entries(mixes))
    for (const source of sources)
      expect(source.url).toMatch(
        new RegExp(`^https://[^/]+/amp/pitch/explainer/v2/.+-${mix}\\.mp4$`),
      );
  // The words are burned into the picture; a track would show them twice.
  expect(pitchFilm.captions).toBeUndefined();
  expect(formatDuration(pitchFilm.durationSeconds)).toBe("2:44");
});

test("the phone framing is the same film, square, in every mix", () => {
  const phone = pitchFilm.phone!;
  expect(phone.aspect).toBe(1);
  expect(phone.poster.url).toMatch(/pitch-poster-square/);
  for (const [mix, sources] of Object.entries(phone.mixes!)) {
    expect(sources.map((source) => source.width)).toEqual([540, 720, 1080]);
    for (const source of sources)
      expect(source.url).toMatch(
        new RegExp(
          `^https://[^/]+/amp/pitch/explainer/v1/amp-explainer-square-${source.width}-${mix}\\.mp4$`,
        ),
      );
  }
});

function memoryStorage(initial?: string) {
  let kept = initial ?? null;
  return {
    getItem: () => kept,
    setItem: (_key: string, value: string) => {
      kept = value;
    },
    kept: () => kept,
  };
}

test("a browser is given one mix at random and keeps it", () => {
  for (const [roll, mix] of [
    [0, "a"],
    [0.4, "b"],
    [0.99, "c"],
  ] as const) {
    const storage = memoryStorage();
    expect(browserFilmMix(storage, () => roll)).toBe(mix);
    expect(storage.kept()).toBe(mix);
    // A later visit keeps it, whatever the dice say.
    expect(browserFilmMix(storage, () => 0.5)).toBe(mix);
    expect(browserFilmMix(storage, () => 0)).toBe(mix);
  }
});

test("an unknown stored mix is replaced, and blocked storage still plays", () => {
  const storage = memoryStorage("z");
  expect(browserFilmMix(storage, () => 0)).toBe("a");
  expect(storage.kept()).toBe("a");
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(browserFilmMix(blocked, () => 0.5)).toBe("b");
  expect(browserFilmMix(null, () => 0.99)).toBe("c");
});
