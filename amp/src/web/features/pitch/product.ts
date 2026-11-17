// A still of the real app, answered and explained, at the top of the pitch.
// Served from this origin and preloaded by the home document
// (scripts/build-home-document.ts), like the film's posters.
import square from "./posters/practice-square.webp";
import wide from "./posters/practice-wide.webp";

/** The phone framing is square; wider screens get the app's wide layout.
 * Matches `phoneVideoQuery` (video.ts) and the pitch's first layout step. */
export const practiceStill = {
  wide: { url: wide, width: 1280, height: 720 },
  square: { url: square, width: 720, height: 720 },
  alt: "AMP practice: a ratio problem answered correctly, with its step-by-step explanation and the next problem one tap away",
} as const;
