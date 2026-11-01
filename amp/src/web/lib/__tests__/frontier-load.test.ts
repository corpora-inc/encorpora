import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFrontier } from "../frontier-load";
import { AccountSessionChanged } from "../account-session";

afterEach(() => vi.restoreAllMocks());

describe("loadFrontier", () => {
  it("shows the map for the learner still on screen", async () => {
    const show = vi.fn();
    await loadFrontier(
      async () => ({ level: 4 }),
      () => true,
      show,
    );
    expect(show).toHaveBeenCalledWith({ level: 4 });
  });

  it("discards a response for a learner who is no longer on screen", async () => {
    const show = vi.fn();
    await loadFrontier(
      async () => ({ level: 4 }),
      () => false,
      show,
    );
    expect(show).not.toHaveBeenCalled();
  });

  it("treats an account change as superseded, not as a page error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const show = vi.fn();
    await loadFrontier(
      () => Promise.reject(new AccountSessionChanged()),
      () => true,
      show,
    );
    expect(show).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledOnce();
  });

  it("does not report a failure for a learner who has gone", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    await loadFrontier(
      () => Promise.reject(new Error("offline")),
      () => false,
      vi.fn(),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("reports a real failure as an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await loadFrontier(
      () => Promise.reject(new Error("offline")),
      () => true,
      vi.fn(),
    );
    expect(error).toHaveBeenCalledWith(
      "Frontier map failed to load",
      expect.any(Error),
    );
  });
});
