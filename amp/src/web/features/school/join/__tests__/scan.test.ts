import { describe, expect, test, vi } from "vitest";
import { readScan } from "../scan";

describe("readScan", () => {
  test("a card's link is its token, from any host", () => {
    expect(readScan("https://amp.corpora.inc/c#abc_DEF-123")).toEqual({
      kind: "card",
      token: "abc_DEF-123",
    });
  });
  test("a board's link is its class, in any case or with a hyphen", () => {
    for (const path of ["KTM4PQ", "ktm4pq", "ktm-4pq", "KTM4PQ/"])
      expect(readScan(`https://amp.corpora.inc/join/${path}`)).toEqual({
        kind: "class",
        code: "KTM4PQ",
      });
  });
  test("anything else is not a sign-in, and is never opened", () => {
    for (const text of [
      "hello",
      "KTM4PQ",
      "https://example.com/",
      "https://amp.corpora.inc/c",
      "https://amp.corpora.inc/c#",
      "https://amp.corpora.inc/join",
      "https://amp.corpora.inc/join/ABC",
      "https://amp.corpora.inc/join/KTM4PQ/extra",
    ])
      expect(readScan(text), text).toBeNull();
  });
});

describe("takeCardFragment", () => {
  test("takes the token out of the address before anything reads it, once", async () => {
    vi.resetModules();
    history.replaceState({ kept: 1 }, "", "/c#secret-token");
    const { claimCardToken } = await import("../../../../card-entry");
    expect(location.pathname + location.hash).toBe("/c");
    expect(history.state).toEqual({ kept: 1 });
    expect(claimCardToken()).toBe("secret-token");
    expect(claimCardToken()).toBeNull();
    history.replaceState(null, "", "/");
  });
  test("another page's fragment is left alone", async () => {
    vi.resetModules();
    history.replaceState(null, "", "/join#not-a-card");
    const { claimCardToken } = await import("../../../../card-entry");
    expect(location.hash).toBe("#not-a-card");
    expect(claimCardToken()).toBeNull();
    history.replaceState(null, "", "/");
  });
});
