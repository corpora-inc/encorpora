import { describe, expect, it } from "vitest";
import { initials } from "../Avatar";

describe("initials", () => {
  it("uses the first and last names", () => {
    expect(initials("Amara Osei")).toBe("AO");
    expect(initials("Cher")).toBe("C");
  });
  it("ignores a same-name ordinal and other non-letter words", () => {
    expect(initials("Ana Ruiz (2)")).toBe("AR");
    expect(initials("Ana R. (3)")).toBe("AR");
    expect(initials("Élise Ødegård")).toBe("ÉØ");
  });
});
