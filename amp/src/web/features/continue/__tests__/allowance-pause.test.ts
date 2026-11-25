import { afterEach, describe, expect, it } from "vitest";
import {
  clearStudentDevice,
  handedChildPage,
  rememberStudentSession,
} from "../../../lib/student-device";
import { pauseWords } from "../AllowancePause";

const child = { accountId: "school:family", token: "st_child" };
afterEach(() => {
  clearStudentDevice();
  sessionStorage.clear();
  localStorage.clear();
});

describe("the free problems' end on a child's sign-in", () => {
  it("a parent's device handed to their child offers the parent the child's page", () => {
    rememberStudentSession(child, "personal", true, "/family/f1/kids/k1");
    expect(handedChildPage("k1")).toBe("/family/f1/kids/k1");
    // Handed over from Today, or by the practice's own address.
    rememberStudentSession(child, "personal", true, "/family/f1");
    expect(handedChildPage("k 1")).toBe("/family/f1/kids/k%201");
  });

  it("a child's own device, and one handed over in a class, offer nothing to buy", () => {
    expect(handedChildPage("k1")).toBeNull();
    rememberStudentSession(child, "personal", false);
    expect(handedChildPage("k1")).toBeNull();
    rememberStudentSession(
      child,
      "personal",
      true,
      "/school/o1/classes/c1/students",
    );
    expect(handedChildPage("k1")).toBeNull();
  });

  it("the handed device reads as the parent's pause; the child's own keeps its words", () => {
    expect(pauseWords("problems", "student", "Fox", true)).toEqual(
      pauseWords("problems", "parent", "Fox"),
    );
    expect(pauseWords("problems", "student", "Fox")).toEqual({
      fact: "You’ve finished the free problems.",
      detail: "Your grown-up can continue AMP.",
    });
  });
});
