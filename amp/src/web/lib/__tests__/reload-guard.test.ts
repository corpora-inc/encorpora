import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { claimReload, reloadSlot, reloadTtlMs } from "../reload-guard";

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

test("claims once across documents, then permits recovery after a quiet TTL", () => {
  const now = 100_000;
  expect(claimReload(sessionStorage, now)).toBeNull();
  expect(claimReload(sessionStorage, now + 1)).toBe("recent");
  expect(claimReload(sessionStorage, now + reloadTtlMs)).toBe("recent");
  expect(claimReload(sessionStorage, now + 2 * reloadTtlMs)).toBeNull();
});
test("persistent failures extend the guard and cannot loop", () => {
  expect(claimReload(sessionStorage, 100_000)).toBeNull();
  for (let time = 110_000; time < 1_000_000; time += 10_000)
    expect(claimReload(sessionStorage, time)).toBe("recent");
});
test("clock rollback and malformed timestamps recover safely", () => {
  sessionStorage.setItem(reloadSlot, "200000");
  expect(claimReload(sessionStorage, 100_000)).toBe("recent");
  sessionStorage.setItem(reloadSlot, "not-a-time");
  expect(claimReload(sessionStorage, 100_001)).toBeNull();
  expect(claimReload(sessionStorage, 100_002)).toBe("recent");
});
test("unavailable or silently discarded storage never permits reload", () => {
  expect(
    claimReload({
      getItem: () => {
        throw Error();
      },
      setItem: () => {},
    }),
  ).toBe("storage");
  expect(
    claimReload({
      getItem: () => null,
      setItem: () => {
        throw Error();
      },
    }),
  ).toBe("storage");
  expect(claimReload({ getItem: () => null, setItem: () => {} })).toBe(
    "storage",
  );
});
test.each([
  "/?billing=processing&purchase=synthetic",
  "/?billing=account",
  "/start/purchase",
  "/purchase/annual",
  "/?payment_intent=synthetic",
  "/?redirect_status=succeeded",
])("protects payment return %s", async (path) => {
  vi.resetModules();
  vi.stubGlobal("location", new URL(path, "https://amp.example"));
  const { autoReloadBlock } = await import("../reload-guard");
  expect(autoReloadBlock()).toBe("payment");
  expect(sessionStorage.getItem(reloadSlot)).toBeNull();
});
test("payment protection survives URL cleanup", async () => {
  vi.resetModules();
  vi.stubGlobal("location", new URL("https://amp.example/?billing=processing"));
  const { autoReloadBlock, watchReloadSafety } =
    await import("../reload-guard");
  watchReloadSafety();
  vi.stubGlobal("location", new URL("https://amp.example/"));
  expect(autoReloadBlock()).toBe("payment");
});
test("detects autofill and preserves edits after controls unmount", async () => {
  vi.resetModules();
  vi.stubGlobal("location", new URL("https://amp.example/sign-up"));
  const { autoReloadBlock, watchReloadSafety } =
    await import("../reload-guard");
  document.body.innerHTML = '<input value="synthetic">';
  expect(autoReloadBlock()).toBe("input");
  watchReloadSafety();
  document
    .querySelector("input")!
    .dispatchEvent(new Event("input", { bubbles: true }));
  document.body.innerHTML = "";
  expect(autoReloadBlock()).toBe("input");
  expect(sessionStorage.getItem(reloadSlot)).toBeNull();
});

test("a payment destination also blocks stale-release navigation", async () => {
  vi.resetModules();
  vi.stubGlobal("location", new URL("https://amp.example/"));
  const { autoReloadBlock } = await import("../reload-guard");
  expect(autoReloadBlock({ pathname: "/start/purchase", search: "" })).toBe(
    "payment",
  );
  expect(sessionStorage.getItem(reloadSlot)).toBeNull();
});

test("a replacement document cannot reload again after a slow chunk failure", () => {
  expect(claimReload(sessionStorage, 100_000, 90_000)).toBeNull();
  expect(claimReload(sessionStorage, 200_000, 100_001)).toBe("recent");
  expect(claimReload(sessionStorage, 300_000, 100_001)).toBe("recent");
  expect(claimReload(sessionStorage, 400_000, 400_000)).toBeNull();
});
