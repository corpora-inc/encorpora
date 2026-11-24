import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { goHandedHome, handedHomePath } from "../handed-home";

/* A handed device's way home (the bar's family mark, the menu's "Back to
 * family"): Back when the device was handed over from that screen a moment
 * ago, so the parent is where they were on it; the screen's address
 * otherwise. The scroll position itself is the router's and a real
 * browser's (scripts/verify-child-practice-ui.ts). */

const FAMILY = "/family/11111111-1111-4111-8111-111111111111";
const router = (href: string, previous?: string) => {
  const back = vi.fn();
  const navigate = vi.fn();
  return {
    back,
    navigate,
    router: {
      history: {
        location: {
          href,
          state: previous === undefined ? {} : { ampPrevious: previous },
        },
        back,
      },
      navigate,
    },
  };
};

beforeEach(() => {
  sessionStorage.setItem("amp.student.handed", "1");
});
afterEach(() => sessionStorage.clear());

test("home is the family's Today, whichever of its screens handed the device over", () => {
  sessionStorage.setItem("amp.student.return", `${FAMILY}/kids/abc`);
  expect(handedHomePath()).toBe(FAMILY);
  sessionStorage.setItem("amp.student.return", `${FAMILY}?open=skill:x`);
  expect(handedHomePath()).toBe(FAMILY);
});

test("handed over from Today a moment ago: the way home is Back, to where the parent was", () => {
  sessionStorage.setItem("amp.student.return", FAMILY);
  // From their row's Practice, or from a sheet over Today (the sheet is the
  // history entry's own state, the address is Today's).
  const at = router("/practice/abc/skills/adding", FAMILY);
  goHandedHome(at.router);
  expect(at.back).toHaveBeenCalledTimes(1);
  expect(at.navigate).not.toHaveBeenCalled();
});

test("from anywhere else, home opens by its address: never a guess at Back", () => {
  sessionStorage.setItem("amp.student.return", FAMILY);
  // A lesson opened in practice sits between: Back is the lesson.
  const deeper = router("/practice/abc", "/lessons/adding");
  goHandedHome(deeper.router);
  expect(deeper.back).not.toHaveBeenCalled();
  expect(deeper.navigate).toHaveBeenCalledWith({
    href: FAMILY,
    replace: false,
  });
  // Practice opened by its address alone (typed, a bookmark): nothing
  // behind it, and the way back is still the child's family.
  const typed = router("/practice/abc");
  goHandedHome(typed.router);
  expect(typed.back).not.toHaveBeenCalled();
  expect(typed.navigate).toHaveBeenCalledWith({ href: FAMILY, replace: false });
});
