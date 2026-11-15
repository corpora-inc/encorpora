import { expect, test } from "vitest";
import { appReturn } from "../returns";

const TOKEN = "a".repeat(43);

test("a return never carries a link's secret or returns to one", () => {
  for (const value of [
    `/school/invite#${TOKEN}`,
    "/school/invite",
    `/family/approve#${TOKEN}`,
    "/family/approvals/123",
    `/schools/continue#token=${TOKEN}`,
    `/school/adopt#token=${TOKEN}`,
    `/c#${TOKEN}`,
    `/p#${TOKEN}`,
    "/join/ABC123",
    "/start/parent",
    "/continue/pip",
    "/purchase/annual?billing=processing&purchase=cs_1",
    "https://elsewhere.example/school",
    "//elsewhere.example",
  ])
    expect(appReturn(value), value).toBeUndefined();
});

test("a place keeps its view, never its fragment or other keys", () => {
  expect(
    appReturn(
      `/school/11111111-1111-4111-8111-111111111111/classes/22222222-2222-4222-8222-222222222222/map?sort=level&token=${TOKEN}#${TOKEN}`,
    ),
  ).toBe(
    "/school/11111111-1111-4111-8111-111111111111/classes/22222222-2222-4222-8222-222222222222/map?sort=level",
  );
  expect(appReturn("/pathways?learner=pip&skill=add")).toBe(
    "/pathways?learner=pip&skill=add",
  );
  const person = "11111111-1111-4111-8111-111111111111";
  expect(
    appReturn(
      `/school/11111111-1111-4111-8111-111111111111/students?open=student:${person}`,
    ),
  ).toBe(
    `/school/11111111-1111-4111-8111-111111111111/students?open=student%3A${person}`,
  );
  // A layer stack that isn't one is dropped, the place kept.
  expect(
    appReturn(
      "/school/11111111-1111-4111-8111-111111111111/students?open=%3Cnot%20a%20stack%3E",
    ),
  ).toBe("/school/11111111-1111-4111-8111-111111111111/students");
  expect(appReturn("/account/security")).toBe("/account/security");
  // Practice at a level is a place to come back to, with its choice; so is
  // the adult's own time.
  expect(appReturn("/me/level?grade=4&pace=behind")).toBe(
    "/me/level?grade=4&pace=behind",
  );
  expect(
    appReturn(`/practice?profile=p1&from=${encodeURIComponent("/me/level")}`),
  ).toBe(`/practice?profile=p1&from=${encodeURIComponent("/me/level")}`);
  expect(appReturn("/me/time")).toBe("/me/time");
  expect(appReturn(`/me?x=${"y".repeat(3000)}`)).toBeUndefined();
});

test("CP-2 r2 M3: what the documented returns need, and nothing that isn't a place", () => {
  const school = "/school/11111111-1111-4111-8111-111111111111";
  // A practice profile keeps its own way back, one level deep.
  expect(
    appReturn(
      `/practice?profile=grade-4&from=${encodeURIComponent(`${school}/classes`)}`,
    ),
  ).toBe(
    `/practice?profile=grade-4&from=${encodeURIComponent(`${school}/classes`)}`,
  );
  // …never a secret-bearing or nested one.
  expect(
    appReturn(
      `/practice?profile=grade-4&from=${encodeURIComponent("/school/invite#x")}`,
    ),
  ).toBe("/practice?profile=grade-4");
  // Time's range, a devices sheet and a settings section survive.
  expect(appReturn(`${school}/classes?from=2026-11-01&to=2026-11-07`)).toBe(
    `${school}/classes?from=2026-11-01&to=2026-11-07`,
  );
  expect(appReturn(`${school}?devices=cards&section=calendar`)).toBe(
    `${school}?devices=cards&section=calendar`,
  );
  // An address that isn't one of the app's places is not a return.
  expect(appReturn("/not-a-real-app-page")).toBeUndefined();
});
