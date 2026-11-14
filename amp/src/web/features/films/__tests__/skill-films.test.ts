import { expect, test } from "vitest";
import { lessonFilms } from "../../../../content/lesson-films";
import { templates } from "../../../../math/engine";
import { skillFilms } from "../skill-films";
import { filmDuration, filmSpokenDuration } from "../FilmLink";

const film = (id: string, title: string, duration = 90) => ({
  id,
  title,
  duration,
});

test("no films: nothing to offer", () => {
  expect(skillFilms([{ id: "a", title: "A" }], {})).toEqual([]);
});

test("each problem type's film, in the catalog's order, under its title", () => {
  expect(
    skillFilms(
      [
        { id: "b", title: "Type B" },
        { id: "none", title: "No film" },
        { id: "a", title: "Type A" },
      ],
      { a: film("fa", "Film A", 61), b: film("fb", "Film B", 125) },
    ),
  ).toEqual([
    { templateId: "b", title: "Type B", duration: 125 },
    { templateId: "a", title: "Type A", duration: 61 },
  ]);
});

test("a film that teaches several types is offered once, under its own title", () => {
  const shared = film("fs", "Flat and solid shapes", 144);
  expect(
    skillFilms(
      [
        { id: "flat", title: "Name a flat shape" },
        { id: "solid", title: "Name a solid shape" },
        { id: "own", title: "Own film" },
      ],
      { flat: shared, solid: shared, own: film("fo", "Its film") },
    ),
  ).toEqual([
    { templateId: "flat", title: "Flat and solid shapes", duration: 144 },
    { templateId: "own", title: "Own film", duration: 90 },
  ]);
});

test("the real catalogue: a skill's cards are its distinct films", () => {
  const types = templates.filter((t) => t.skillId === "count-to-20");
  const cards = skillFilms(types);
  expect(cards.map((c) => c.templateId)).toEqual(["count-objects"]);
  const shapes = templates.filter((t) => t.skillId === "name-shapes");
  const distinct = new Set(
    shapes.filter((t) => lessonFilms[t.id]).map((t) => lessonFilms[t.id]!.id),
  );
  expect(skillFilms(shapes)).toHaveLength(distinct.size);
});

test("a film's length reads as a player shows it, and aloud", () => {
  expect(filmDuration(90)).toBe("1:30");
  expect(filmDuration(144.7)).toBe("2:24");
  expect(filmDuration(59)).toBe("0:59");
  expect(filmSpokenDuration(90)).toBe("1 minute 30 seconds");
  expect(filmSpokenDuration(120)).toBe("2 minutes");
  expect(filmSpokenDuration(61)).toBe("1 minute 1 second");
});
