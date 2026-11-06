// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PitchVideo } from "../PitchVideo";
import { pitchFilm, pitchFixture } from "../video";

const listeners = new Set<() => void>();
const media = {
  matches: false,
  addEventListener: (_: string, listener: () => void) =>
    listeners.add(listener),
  removeEventListener: (_: string, listener: () => void) =>
    listeners.delete(listener),
};
function setPhone(matches: boolean) {
  media.matches = matches;
  act(() => listeners.forEach((listener) => listener()));
}
const player = () => document.querySelector("video")!;
const ratio = () => parseFloat(player().parentElement!.style.aspectRatio);
const tapPlay = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Play / }));

beforeEach(() => {
  media.matches = false;
  listeners.clear();
  localStorage.clear();
  localStorage.setItem("amp.pitch.film-mix", "b");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
  );
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue(
    "probably",
  );
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a phone gets the square film in its kept mix", () => {
  media.matches = true;
  render(<PitchVideo video={pitchFilm} />);
  expect(ratio()).toBe(1);
  expect(player().poster).toBe(pitchFilm.phone!.poster.url);
  tapPlay();
  expect(player().src).toMatch(/\/amp-explainer-square-\d+-b\.mp4$/);
});

test("a larger screen gets the wide film", () => {
  render(<PitchVideo video={pitchFilm} />);
  expect(ratio()).toBeCloseTo(16 / 9);
  expect(player().poster).toBe(pitchFilm.poster.url);
  tapPlay();
  expect(player().src).toMatch(/\/amp-explainer-\d+-b\.mp4$/);
});

test("the framing follows the screen until the tap, then stays", () => {
  render(<PitchVideo video={pitchFilm} />);
  setPhone(true);
  expect(ratio()).toBe(1);
  setPhone(false);
  expect(ratio()).toBeCloseTo(16 / 9);
  setPhone(true);
  tapPlay();
  const playing = player().src;
  setPhone(false);
  expect(ratio()).toBe(1);
  expect(player().src).toBe(playing);
});

test("a video with no phone framing never asks about the screen", () => {
  render(<PitchVideo video={pitchFixture} />);
  expect(matchMedia).not.toHaveBeenCalled();
});
