import { expect, test, vi } from "vitest";
import {
  closeSearch,
  closesBack,
  closeTo,
  returnTarget,
  sameScreen,
  stampPrevious,
  withoutSearch,
} from "../return-to";
import { filmFrom, filmReturn } from "../../features/films/FilmScreen";

const answer =
  "/school/o1/classes/c1/map/s1/work/w1?skill=missing-addend";

test("a return target is a path inside the app, normalized", () => {
  expect(returnTarget(answer)).toBe(answer);
  expect(returnTarget("/pathways/x?lesson=y#top")).toBe(
    "/pathways/x?lesson=y#top",
  );
  expect(returnTarget("/a/../school/o1")).toBe("/school/o1");
  expect(returnTarget("/")).toBe("/");
});

test("no open redirects: other sites, schemes and tricks are refused", () => {
  for (const value of [
    "https://evil.example/",
    "http://evil.example",
    "//evil.example/path",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/school\\..\\evil",
    "javascript:alert(1)",
    "data:text/html,hi",
    "mailto:a@b.c",
    " /school",
    "school/o1",
    "/school\n//evil.example",
    "/school\t",
    "/school\u0000",
    "/api/v1/me",
    "/API/auth/sign-out",
    "",
    "/" + "a".repeat(2048),
  ])
    expect(returnTarget(value), JSON.stringify(value)).toBeUndefined();
  for (const value of [undefined, null, 1, {}, ["/school"]])
    expect(returnTarget(value)).toBeUndefined();
});

test("a film returns where it was opened, never to a film, else its lesson", () => {
  expect(filmFrom(`${answer}&lesson=t1`)).toBe(`${answer}&lesson=t1`);
  expect(filmFrom("/lessons/t1/watch?from=/pathways")).toBeUndefined();
  expect(filmFrom("//evil.example")).toBeUndefined();
  expect(filmReturn("https://evil.example", "t1")).toBe(
    "/pathways?lesson=t1",
  );
  expect(filmReturn("/practice?skill=a", "t1")).toBe("/practice?skill=a");
});

test("the same screen: path and search, the list's own view aside", () => {
  expect(sameScreen("/a/b?x=1&y=2", "/a/b?y=2&x=1")).toBe(true);
  expect(sameScreen("/a/b/", "/a/b")).toBe(true);
  expect(sameScreen("/a/b?sort=name:ascending", "/a/b")).toBe(true);
  expect(sameScreen("/a/b?lesson=t1", "/a/b")).toBe(false);
  expect(sameScreen("/a/b", "/a/b?lesson=t1")).toBe(false);
  expect(sameScreen("/a/c", "/a/b")).toBe(false);
  expect(sameScreen("/a/b?student=s1", "/a/b?student=s2")).toBe(false);
});

test("each pushed entry records the one before it; a replace keeps it", () => {
  const here = { href: "/map/s1", state: { ampPrevious: "/map" } };
  expect(stampPrevious({ href: "/map/s1/work/w1" }, here)).toEqual({
    ampPrevious: "/map/s1",
  });
  expect(
    stampPrevious({ href: "/map/s1/work/w2", replace: true }, here),
  ).toEqual({ ampPrevious: "/map" });
  // The same address again changes nothing (no duplicate entry).
  expect(stampPrevious({ href: "/map/s1" }, here)).toEqual({
    ampPrevious: "/map",
  });
  expect(stampPrevious({ href: "/x", replace: true }, { href: "/", state: {} }))
    .toEqual({});
});

test("closing goes Back to where it was opened, else to its parent", () => {
  const at = (href: string, previous?: string) => ({
    href,
    state: previous ? { ampPrevious: previous } : {},
  });
  // Opened from its parent, or from another screen: Back.
  expect(closesBack(at("/map/s1/work/w1", "/map/s1"), "/map/s1")).toBe(true);
  expect(closesBack(at("/map/s1/work/w1", "/today"), "/map/s1")).toBe(true);
  // Nothing recorded (a shared link, a full load): the parent.
  expect(closesBack(at("/map/s1/work/w1"), "/map/s1")).toBe(false);
  // An earlier state of the same screen is not where it was opened.
  expect(closesBack(at("/g?student=s2", "/g?student=s1"), "/g")).toBe(false);
  // Signing in is never gone Back to.
  expect(closesBack(at("/map/s1", "/sign-in"), "/map")).toBe(false);
  // A named `from` must be the entry before.
  expect(closesBack(at("/lessons/t/watch", "/x?lesson=t"), "/p", "/x?lesson=t"))
    .toBe(true);
  expect(closesBack(at("/lessons/t/watch", "/y"), "/p", "/x?lesson=t")).toBe(
    false,
  );
});

test("closeTo goes Back or replaces; closeSearch drops what was opened", () => {
  const router = (href: string, previous?: string) => ({
    history: {
      location: { href, state: previous ? { ampPrevious: previous } : {} },
      back: vi.fn(),
    },
    navigate: vi.fn(),
  });
  const opened = router(`${answer}&lesson=t1`, answer);
  closeSearch(opened, "lesson");
  expect(opened.history.back).toHaveBeenCalledOnce();
  expect(opened.navigate).not.toHaveBeenCalled();
  const shared = router(`${answer}&lesson=t1`);
  closeSearch(shared, "lesson");
  expect(shared.history.back).not.toHaveBeenCalled();
  expect(shared.navigate).toHaveBeenCalledWith({ href: answer, replace: true });
  const film = router("/lessons/t1/watch", "/elsewhere");
  closeTo(film, "/pathways?lesson=t1", `${answer}&lesson=t1`);
  expect(film.navigate).toHaveBeenCalledWith({
    href: `${answer}&lesson=t1`,
    replace: true,
  });
  expect(withoutSearch("/a?lesson=t&skill=s#h", "lesson")).toBe("/a?skill=s#h");
});
