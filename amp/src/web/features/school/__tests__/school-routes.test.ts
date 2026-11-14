import { expect, test, vi } from "vitest";

vi.mock("../../../auth", () => ({
  accessSession: vi.fn(async () => null),
  authConfig: async () => ({
    mode: "accounts",
    passwords: true,
    providers: [],
  }),
  onSessionChanged: () => () => {},
  signIn: async () => {},
  signOut: async () => {},
  notifyAccountSessionChanged: () => {},
}));

const { router } = await import("../../../app/router");
const org = "87ef26d5-002c-451f-98e0-2d7799808705";
const klass = "5b0c7a5e-9d0e-4c41-8f5a-0a1d6b2c3e4f";
const routeOf = (path: string) => router.getMatchedRoutes(path)[2]?.id;

test("a school's own address is its overview, never the not-found screen", () => {
  // The overview is the index under /school/$org; the catch-all is a sibling
  // child that needs a segment, so the bare address cannot reach it.
  expect(routeOf(`/school/${org}`)).toBe("/school/$org/");
  expect(routeOf(`/school/${org}/`)).toBe("/school/$org/");
  expect(routeOf(`/school/${org}/nonsense`)).toBe("/school/$org/$");
  for (const tab of ["classes", "staff", "activity", "settings", "students"])
    expect(routeOf(`/school/${org}/${tab}`)).toBe(`/school/$org/${tab}`);
});

test("a class's own address opens the class, an unknown one says so", () => {
  const place = `/school/${org}/classes/${klass}`;
  expect(routeOf(place)).toBe("/school/$org/classes/$class/");
  expect(routeOf(`${place}/today`)).toBe("/school/$org/classes/$class/today");
  expect(routeOf(`${place}/grades`)).toBe("/school/$org/classes/$class/$");
});

test("self-service and buyer links resolve outside org catch-all routes", () => {
  expect(routeOf("/school/start")).toBe("/school/start");
  expect(routeOf("/school/connect")).toBe("/school/connect");
  expect(routeOf("/school/adopt")).toBe("/school/adopt");
  expect(routeOf("/schools/continue")).toBe("/schools/continue");
  expect(routeOf(`/school/${org}/classes/${klass}/import`)).toBe(
    "/school/$org/classes/$class/import",
  );
});
