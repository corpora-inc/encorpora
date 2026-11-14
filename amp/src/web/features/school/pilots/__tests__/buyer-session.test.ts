import { beforeEach, expect, test, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  history.replaceState(null, "", "/schools/continue");
});
test("buyer capability leaves the address immediately and survives a reload", async () => {
  const token = "a".repeat(43);
  history.replaceState(null, "", `/schools/continue#token=${token}`);
  const first = await import("../buyer-session");
  expect(first.prepareBuyerHandoff()).toBe(token);
  expect(location.hash).toBe("");
  vi.resetModules();
  expect((await import("../buyer-session")).prepareBuyerHandoff()).toBe(token);
});
test("a malformed incoming link cannot reopen a previous buyer request", async () => {
  history.replaceState(null, "", `/schools/continue#token=${"a".repeat(43)}`);
  const helper = await import("../buyer-session");
  helper.prepareBuyerHandoff();
  history.replaceState(null, "", "/schools/continue#token=invalid");
  expect(helper.prepareBuyerHandoff()).toBeNull();
  expect(helper.prepareBuyerHandoff()).toBeNull();
});
