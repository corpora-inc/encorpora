import { beforeEach, afterEach, test, expect, vi } from "vitest";
import {
  cleverOnboardingSession,
  clearCleverOnboardingSession,
} from "./onboarding-session";

const token = `po_${"x".repeat(43)}`;
beforeEach(() => {
  clearCleverOnboardingSession();
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState({}, "", "/school/connect");
});
afterEach(() => vi.unstubAllGlobals());
test("setup proof is verified independently, removes its fragment, and clears a previous student only after verification", async () => {
  history.replaceState({}, "", `/school/connect#clever-onboarding=${token}`);
  sessionStorage.setItem(
    "amp.student",
    JSON.stringify({
      accountId: "school:old-student",
      token: `st_${"s".repeat(43)}`,
    }),
  );
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetch = vi.fn(async () => {
    await gate;
    return Response.json({
      token,
      accountId: "amp|fixture",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
  });
  vi.stubGlobal("fetch", fetch);
  const pending = cleverOnboardingSession();
  expect(location.hash).toBe("");
  expect(sessionStorage.getItem("amp.student")).not.toBeNull();
  release();
  expect((await pending)?.accountId).toBe("amp|fixture");
  expect(sessionStorage.getItem("amp.student")).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/provider/onboarding-session",
    expect.objectContaining({
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
    }),
  );
  // Refresh/resume checks the same proof again instead of trusting storage.
  expect((await cleverOnboardingSession())?.token).toBe(token);
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "clever_onboarding_expired" }, { status: 401 }),
    ),
  );
  expect(await cleverOnboardingSession()).toBeNull();
  expect(sessionStorage.getItem("amp.clever.onboarding")).toBeNull();
});
test("a forged or rejected completion cannot replace the previous student", async () => {
  sessionStorage.setItem("amp.student", "retained");
  history.replaceState({}, "", `/school/connect#clever-onboarding=${token}`);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "invalid" }, { status: 401 })),
  );
  expect(await cleverOnboardingSession()).toBeNull();
  expect(sessionStorage.getItem("amp.student")).toBe("retained");
  history.replaceState({}, "", "/school/connect#clever-onboarding=not-a-proof");
  expect(await cleverOnboardingSession()).toBeNull();
  expect(sessionStorage.getItem("amp.student")).toBe("retained");
});

test("a transient validation failure retains only in-memory completion intent for retry", async () => {
  history.replaceState({}, "", `/school/connect#clever-onboarding=${token}`);
  sessionStorage.setItem("amp.student", "previous student");
  const valid = () =>
    Response.json({
      token,
      accountId: "amp|fixture",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(async () => valid()),
  );
  await expect(cleverOnboardingSession()).rejects.toThrow("offline");
  expect(location.hash).toBe("");
  expect(sessionStorage.getItem("amp.clever.onboarding")).toBeNull();
  expect(sessionStorage.getItem("amp.student")).toBe("previous student");
  // A route guard can join the component's retry after the fragment is gone.
  expect((await cleverOnboardingSession())?.token).toBe(token);
  expect(sessionStorage.getItem("amp.student")).toBeNull();
  // A proof retained from a completed setup cannot replace a later student.
  sessionStorage.setItem("amp.student", "later student");
  expect((await cleverOnboardingSession())?.token).toBe(token);
  expect(sessionStorage.getItem("amp.student")).toBe("later student");
});
