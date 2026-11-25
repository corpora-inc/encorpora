import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { qk } from "../../../lib/keys";
import { queryClient } from "../../../lib/query-client";
import {
  holdLook,
  lookAgain,
  lookReleases,
  lookIsFed,
  lookWaits,
  onLookRelease,
  problemTurned,
  setLookFed,
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
  setLookFed(false);
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("a tab nothing feeds reads the look again with each answer, once", () => {
  lookAgain(scope("pip"), "answer-1");
  expect(invalidated).toEqual([key("pip")]);
  // The same answer again (its workspace mounted anew, a return from a
  // book): nothing.
  lookAgain(scope("pip"), "answer-1");
  expect(invalidated).toEqual([key("pip")]);
  lookAgain(scope("pip"), "answer-2");
  expect(invalidated).toEqual([key("pip"), key("pip")]);
  // Another learner in the same tab has their own answers.
  lookAgain(scope("wren"), "answer-2");
  expect(invalidated).toEqual([key("pip"), key("pip"), key("wren")]);
});

test("a tab the student stream feeds asks nothing per answer, and asks again once the stream stops streaming", () => {
  setLookFed(true);
  expect(lookIsFed()).toBe(true);
  lookAgain(scope("theo"), "answer-1");
  lookAgain(scope("theo"), "answer-2");
  expect(invalidated).toEqual([]);
  // The network holds the stream now (it polls): practice carries it.
  setLookFed(false);
  lookAgain(scope("theo"), "answer-3");
  expect(invalidated).toEqual([key("theo")]);
});

test("no learner, nothing to read", () => {
  lookAgain(scope(""), "answer-1");
  lookAgain(scope(""), "answer-2");
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
