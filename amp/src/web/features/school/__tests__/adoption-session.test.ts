// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSchoolAdoption,
  prepareSchoolAdoption,
  schoolAdoptionToken,
} from "../adoption-session";
const token = `adopt_${"a".repeat(43)}`;
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/school/adopt");
});
afterEach(() => vi.restoreAllMocks());
describe("single-use school approval browser handoff", () => {
  it("removes the fragment before sign-in and retains only a valid approval across reload", () => {
    window.history.replaceState(
      null,
      "",
      `/school/adopt?district=fixture#token=${token}`,
    );
    prepareSchoolAdoption();
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?district=fixture");
    expect(schoolAdoptionToken()).toBe(token);
    prepareSchoolAdoption();
    expect(schoolAdoptionToken()).toBe(token);
  });
  it("an invalid new fragment clears an older approval instead of opening the wrong school", () => {
    window.history.replaceState(null, "", `/school/adopt#token=${token}`);
    prepareSchoolAdoption();
    window.history.replaceState(null, "", "/school/adopt#token=bad");
    prepareSchoolAdoption();
    expect(schoolAdoptionToken()).toBeNull();
    expect(window.location.hash).toBe("");
  });
  it("expires the stored approval and clears it after acceptance", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    window.history.replaceState(null, "", `/school/adopt#token=${token}`);
    prepareSchoolAdoption();
    vi.spyOn(Date, "now").mockReturnValue(now + 7 * 86400000);
    expect(schoolAdoptionToken()).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now);
    window.history.replaceState(null, "", `/school/adopt#token=${token}`);
    prepareSchoolAdoption();
    clearSchoolAdoption();
    expect(schoolAdoptionToken()).toBeNull();
  });
});
