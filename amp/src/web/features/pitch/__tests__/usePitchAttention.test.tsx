// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { trackOnce } from "../../../lib/analytics";
import { usePitchAttention } from "../usePitchAttention";

vi.mock("../../../lib/analytics", () => ({ trackOnce: vi.fn() }));
const tracked = vi.mocked(trackOnce);

let observed: Element[] = [];
let disconnected = 0;
let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
class FakeObserver {
  constructor(callback: typeof report) {
    report = callback;
  }
  observe(element: Element) {
    observed.push(element);
  }
  disconnect() {
    disconnected++;
  }
}
function Page() {
  const actions = useRef<HTMLDivElement>(null);
  usePitchAttention(actions, ".buy", "card");
  return (
    <div ref={actions}>
      <button className="buy">Buy</button>
    </div>
  );
}
// jsdom can't dispatch trusted events, so call the listeners as the browser would.
let listeners = new Map<string, EventListener>();
const fire = (type: string, isTrusted = true) =>
  listeners.get(type)?.({ type, isTrusted } as Event);

beforeEach(() => {
  tracked.mockClear();
  observed = [];
  disconnected = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  listeners = new Map();
  vi.spyOn(window, "addEventListener").mockImplementation(
    ((type: string, listener: EventListener) =>
      void listeners.set(type, listener)) as typeof window.addEventListener,
  );
  vi.spyOn(window, "removeEventListener").mockImplementation(
    ((type: string) =>
      void listeners.delete(type)) as typeof window.removeEventListener,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("the first real input is recorded once, then nothing listens", () => {
  render(<Page />);
  fire("pointerdown", false); // scripted: not trusted
  expect(tracked).not.toHaveBeenCalled();
  expect(listeners.size).toBe(5);
  fire("touchstart");
  expect(listeners.size).toBe(0);
  fire("keydown");
  expect(tracked).toHaveBeenCalledTimes(1);
  expect(tracked).toHaveBeenCalledWith(
    "first-interaction",
    "first_interaction",
    { kind: "pointer" },
  );
});

test("Buy coming into view is recorded once, then the observer stops", () => {
  render(<Page />);
  expect(observed.map((e) => e.className)).toEqual(["buy"]);
  report([{ isIntersecting: false }]);
  expect(tracked).not.toHaveBeenCalled();
  report([{ isIntersecting: true }]);
  expect(tracked).toHaveBeenCalledWith("pitch-buy-seen", "pitch_buy_seen", {});
  expect(disconnected).toBeGreaterThan(0);
});

test("a browser without IntersectionObserver still works", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  expect(() => render(<Page />)).not.toThrow();
});
