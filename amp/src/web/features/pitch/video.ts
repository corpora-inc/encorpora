import { FILM_MIXES, type FilmMix } from "../../../analytics/events";

/**
 * The pitch video: one typed manifest. Production is the explainer film, in
 * three music mixes for a live test. The development server serves a synthetic
 * fixture (a test pattern and tone, `scripts/fixtures/pitch/`) so the player can
 * be built and verified.
 */
export type PitchVideoSource = {
  url: string;
  /** A full MIME type with codecs, checked with `canPlayType`. */
  type: string;
  /** Encoded frame width in pixels. */
  width: number;
};
/** One framing of the video: its box, poster and files. */
export type PitchVideoFraming = {
  /** Width over height of every source and the poster. */
  aspect: number;
  poster: { url: string; alt: string };
  sources: readonly PitchVideoSource[];
  /** The same picture in several mixes: a browser plays one mix's sources. */
  mixes?: Readonly<Record<FilmMix, readonly PitchVideoSource[]>>;
};
export type PitchVideo = PitchVideoFraming & {
  title: string;
  durationSeconds: number;
  /** Absent when the words are part of the picture, as in the film. */
  captions?: { url: string; language: string; label: string };
  /** The same film recomposed for a phone. */
  phone?: PitchVideoFraming;
};
/** Screens that get the phone framing. Wider than this, the square film would
 * fill the whole screen, so the wide film plays. Matches the pitch's first
 * layout step in `Pitch.module.css`. */
export const phoneVideoQuery = "(max-width: 480px)";

/** CDN files are immutable, so a new cut of a film gets a new directory. */
const filmCdn = "https://d38iwc9748jekz.cloudfront.net/amp/pitch/explainer";
const filmRoot = `${filmCdn}/v1`;
const filmSources =
  (
    root: string,
    name: string,
    ladder: readonly (readonly [number, string])[],
  ) =>
  (mix: FilmMix): readonly PitchVideoSource[] =>
    ladder.map(([width, codec]) => ({
      url: `${root}/${name}-${width}-${mix}.mp4`,
      type: `video/mp4; codecs="${codec}, mp4a.40.2"`,
      width,
    }));
const wideSources = filmSources(`${filmCdn}/v2`, "amp-explainer", [
  [854, "avc1.64001F"],
  [1280, "avc1.640028"],
  [1920, "avc1.640032"],
]);
const squareSources = filmSources(filmRoot, "amp-explainer-square", [
  [540, "avc1.64001F"],
  [720, "avc1.64001F"],
  [1080, "avc1.640028"],
]);
export const pitchFilm: PitchVideo = {
  title: "How AMP works",
  aspect: 16 / 9,
  durationSeconds: 163.6,
  poster: {
    url: `${filmRoot}/amp-explainer-poster.jpg`,
    alt: "A workbook made for a learner named Nora, on a pile of different workbooks",
  },
  sources: wideSources("a"),
  mixes: { a: wideSources("a"), b: wideSources("b"), c: wideSources("c") },
  phone: {
    aspect: 1,
    poster: {
      url: `${filmRoot}/amp-explainer-square-poster.jpg`,
      alt: "A workbook made for a learner named Nora, on a pile of different workbooks",
    },
    sources: squareSources("a"),
    mixes: {
      a: squareSources("a"),
      b: squareSources("b"),
      c: squareSources("c"),
    },
  },
};

const fixtureRoot = "/__amp-fixtures/pitch";
export const pitchFixture: PitchVideo = {
  title: "AMP test fixture",
  aspect: 16 / 9,
  durationSeconds: 8,
  poster: {
    url: `${fixtureRoot}/pitch-fixture-poster.jpg`,
    alt: "Test pattern",
  },
  captions: {
    url: `${fixtureRoot}/pitch-fixture.vtt`,
    language: "en",
    label: "English",
  },
  sources: [
    {
      url: `${fixtureRoot}/pitch-fixture.webm`,
      type: 'video/webm; codecs="vp9, opus"',
      width: 640,
    },
    {
      url: `${fixtureRoot}/pitch-fixture.mp4`,
      type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      width: 640,
    },
  ],
};

/** Development serves the fixture unless `VITE_AMP_PITCH_FIXTURE=off`, which
 * shows the page with no player. */
export const pitchVideo: PitchVideo | null = import.meta.env.DEV
  ? import.meta.env.VITE_AMP_PITCH_FIXTURE === "off"
    ? null
    : pitchFixture
  : pitchFilm;

const filmMixKey = "amp.pitch.film-mix";
/** This browser's mix for the live test: chosen once at random, then kept, so
 * a returning parent hears the same film and the results stay comparable. */
export function browserFilmMix(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  random: () => number = Math.random,
): FilmMix {
  try {
    const kept = storage?.getItem(filmMixKey);
    const known = FILM_MIXES.find((mix) => mix === kept);
    if (known) return known;
  } catch {
    // Storage can be blocked; the mix then lasts for this page.
  }
  const mix = FILM_MIXES[Math.floor(random() * FILM_MIXES.length)] ?? "a";
  try {
    storage?.setItem(filmMixKey, mix);
  } catch {
    // As above.
  }
  return mix;
}

/** The smallest playable source at least as wide as the rendered player,
 * else the widest playable one. Null when this browser can play none. */
export function chooseSource(
  sources: readonly PitchVideoSource[],
  renderedWidth: number,
  canPlay: (type: string) => boolean,
): PitchVideoSource | null {
  const playable = sources
    .filter((source) => canPlay(source.type))
    .sort((a, b) => a.width - b.width);
  return (
    playable.find((source) => source.width >= renderedWidth) ??
    playable.at(-1) ??
    null
  );
}

export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Quartiles reached at this playback fraction and not yet reported. */
export function reachedQuartiles(
  fraction: number,
  reported: ReadonlySet<number>,
): (25 | 50 | 75 | 100)[] {
  return ([25, 50, 75, 100] as const).filter(
    (quartile) =>
      !reported.has(quartile) &&
      fraction * 100 >= (quartile === 100 ? 99 : quartile),
  );
}
