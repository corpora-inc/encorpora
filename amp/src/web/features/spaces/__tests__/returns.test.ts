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
    appReturn(`/school/o/classes/c/map?sort=level&token=${TOKEN}#${TOKEN}`),
  ).toBe("/school/o/classes/c/map?sort=level");
  expect(appReturn("/pathways?learner=pip&skill=add")).toBe(
    "/pathways?learner=pip&skill=add",
  );
  const person = "11111111-1111-4111-8111-111111111111";
  expect(appReturn(`/school/o/students?open=student:${person}`)).toBe(
    `/school/o/students?open=student%3A${person}`,
  );
  // A layer stack that isn't one is dropped, the place kept.
  expect(appReturn("/school/o/students?open=%3Cnot%20a%20stack%3E")).toBe(
    "/school/o/students",
  );
  expect(appReturn("/account/security")).toBe("/account/security");
  expect(appReturn(`/me?x=${"y".repeat(3000)}`)).toBeUndefined();
});
