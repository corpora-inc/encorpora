/**
 * The pitch video: one typed manifest. Production media is supplied with the
 * campaign; until then `production` is null and the page shows no player.
 * The development server serves a synthetic fixture (a test pattern and tone,
 * `scripts/fixtures/pitch/`) so the player can be built and verified.
 */
export type PitchVideoSource = {
  url: string;
  /** A full MIME type with codecs, checked with `canPlayType`. */
  type: string;
  /** Encoded frame width in pixels. */
  width: number;
};
export type PitchVideo = {
  title: string;
  /** Width over height of every source and the poster. */
  aspect: number;
  durationSeconds: number;
  poster: { url: string; alt: string };
  captions: { url: string; language: string; label: string };
  sources: readonly PitchVideoSource[];
};

const production: PitchVideo | null = null;

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
 * shows the page as production does without media. */
export const pitchVideo: PitchVideo | null =
  production ??
  (import.meta.env.DEV && import.meta.env.VITE_AMP_PITCH_FIXTURE !== "off"
    ? pitchFixture
    : null);

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
