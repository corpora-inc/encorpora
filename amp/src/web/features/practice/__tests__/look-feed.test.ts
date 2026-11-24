import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { qk } from "../../../lib/keys";
import { queryClient } from "../../../lib/query-client";
import {
  holdLook,
  lookAgain,
  lookReleases,
  lookWaits,
  onLookRelease,
  problemTurned,
} from "../look-feed";

const scope = (learnerId: string) => ({ identity: "account-1", learnerId });
const key = (learnerId: string) => qk.practiceSettings("account-1", learnerId);
let invalidated: unknown[] = [];

beforeEach(() => {
  invalidated = [];
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
    async (filters) => {
      invalidated.push((filters as { queryKey: unknown }).queryKey);
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("practice reads the look again with each new problem, never with the first or the same one", () => {
  lookAgain(scope("pip"), "p1");
  // The first problem: the screen has just read its settings.
  expect(invalidated).toEqual([]);
  // The same problem again (its workspace mounted anew): nothing.
  lookAgain(scope("pip"), "p1");
  expect(invalidated).toEqual([]);
  lookAgain(scope("pip"), "p2");
  expect(invalidated).toEqual([key("pip")]);
  lookAgain(scope("pip"), "p3");
  expect(invalidated).toEqual([key("pip"), key("pip")]);
  // Another learner in the same tab has their own first problem.
  lookAgain(scope("wren"), "w1");
  expect(invalidated).toHaveLength(2);
});

test("no learner, nothing to read", () => {
  lookAgain(scope(""), "p1");
  lookAgain(scope(""), "p2");
  expect(invalidated).toEqual([]);
});

test("a new problem lets go a look that waited for it, once; where none waited, no screen renders again", () => {
  let heard = 0;
  const stop = onLookRelease(() => heard++);
  const at = lookReleases();
  problemTurned();
  expect(heard).toBe(0);
  expect(lookReleases()).toBe(at);
  holdLook();
  holdLook();
  problemTurned();
  expect(heard).toBe(1);
  expect(lookReleases()).toBe(at + 1);
  problemTurned();
  expect(heard).toBe(1);
  stop();
  holdLook();
  problemTurned();
  expect(heard).toBe(1);
});

test("a look from elsewhere waits while an answer's feedback is on screen, unless the learner's own menu is over it", () => {
  expect(lookWaits()).toBe(false);
  const sheet = document.createElement("section");
  sheet.className = "feedback correct";
  document.body.append(sheet);
  expect(lookWaits()).toBe(true);
  const menu = document.createElement("div");
  menu.setAttribute("data-navigation-sheet", "");
  document.body.append(menu);
  // Their own choice in the menu shows at once.
  expect(lookWaits()).toBe(false);
});
