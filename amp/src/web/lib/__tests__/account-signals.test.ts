import { afterEach, expect, test, vi } from "vitest";
import { accountChannel, broadcastAccountChange } from "../account-signals";
afterEach(() => vi.unstubAllGlobals());
test("blocked cross-tab messaging cannot fail signup", () => {
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor() {
        throw new DOMException("Blocked", "SecurityError");
      }
    },
  );
  expect(accountChannel()).toBeNull();
  expect(() => broadcastAccountChange()).not.toThrow();
});
test("a failed broadcast still releases its channel", () => {
  const close = vi.fn();
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage() {
        throw new DOMException("Closed", "InvalidStateError");
      }
      close = close;
    },
  );
  expect(() => broadcastAccountChange()).not.toThrow();
  expect(close).toHaveBeenCalledOnce();
});
