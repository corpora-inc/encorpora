import assert from "node:assert/strict";
import { test } from "node:test";
import { listenNativeKeyboard, MIN_KEYBOARD_PX, nextKeyboardLayout, type KeyboardLayout, type KeyboardListener, type ViewportSample } from "./keyboard";

const sample = (s: Partial<ViewportSample>): ViewportSample => ({
  layoutHeight: 844, layoutWidth: 390, visualHeight: 844, visualOffsetTop: 0, editing: false, ...s,
});
/** Feeds a sequence of samples through the layout, as the studio does on each viewport event. */
const run = (...samples: Partial<ViewportSample>[]) =>
  samples.reduce<KeyboardLayout[]>((out, s) => [...out, nextKeyboardLayout(out.at(-1), sample(s))], []);

test("iOS: the layout viewport stays and the visual viewport shrinks; the overlap is the keyboard", () => {
  const [rest, focused, open, closed] = run({}, { editing: true }, { editing: true, visualHeight: 553 }, { visualHeight: 844 });
  assert.deepEqual(rest, { stage: 844, keyboard: 0, viewport: 0, width: 390 });
  assert.deepEqual(focused, { stage: 844, keyboard: 0, viewport: 0, width: 390 }, "focus alone moves nothing before the keyboard arrives");
  assert.deepEqual(open, { stage: 844, keyboard: 291, viewport: 291, width: 390 }, "sheets and the dock lift alike");
  assert.deepEqual(closed, { stage: 844, keyboard: 0, viewport: 0, width: 390 });
});

test("iOS: a page scrolled under the keyboard is not counted twice", () => {
  // If WebKit still scrolls the visual viewport down, the visible bottom is offsetTop + height.
  const [, open] = run({ editing: true }, { editing: true, visualHeight: 553, visualOffsetTop: 120 });
  assert.equal(open!.keyboard, 171);
  assert.equal(open!.viewport, 171);
});

test("a WebView without the bridge that shrinks itself: the stage keeps its height and the overlap is the keyboard", () => {
  const [rest, focused, open, closedByBack, blurred] = run(
    { layoutHeight: 832, visualHeight: 832, layoutWidth: 384 },
    { layoutHeight: 832, visualHeight: 832, layoutWidth: 384, editing: true },
    { layoutHeight: 500, visualHeight: 500, layoutWidth: 384, editing: true },
    { layoutHeight: 832, visualHeight: 832, layoutWidth: 384, editing: true },
    { layoutHeight: 832, visualHeight: 832, layoutWidth: 384 },
  );
  assert.equal(rest!.stage, 832);
  assert.equal(focused!.keyboard, 0);
  assert.deepEqual(open, { stage: 832, keyboard: 332, viewport: 0, width: 384 },
    "the dock lifts by the keyboard; viewport-anchored sheets already end at it, so neither is double-counted");
  assert.equal(closedByBack!.keyboard, 0, "Back closes the keyboard but keeps focus: the dock comes down");
  assert.deepEqual(blurred, { stage: 832, keyboard: 0, viewport: 0, width: 384 });
});

test("Android with an overlaid keyboard (no resize): only the visual viewport shrinks", () => {
  const [, open] = run({ layoutHeight: 832, visualHeight: 832, editing: true }, { layoutHeight: 832, visualHeight: 500, editing: true });
  assert.equal(open!.keyboard, 332);
  assert.equal(open!.viewport, 332);
});

test("desktop: resizing the window is a new stage, never a keyboard", () => {
  const [, shorter, taller] = run({ layoutHeight: 900, visualHeight: 900, layoutWidth: 1280 },
    { layoutHeight: 700, visualHeight: 700, layoutWidth: 1280 }, { layoutHeight: 760, visualHeight: 760, layoutWidth: 1280 });
  assert.deepEqual(shorter, { stage: 700, keyboard: 0, viewport: 0, width: 1280 });
  assert.deepEqual(taller, { stage: 760, keyboard: 0, viewport: 0, width: 1280 });
  // Even with a field focused, equal viewports mean no keyboard.
  const [, typing] = run({ layoutHeight: 900, visualHeight: 900, layoutWidth: 1280 }, { layoutHeight: 900, visualHeight: 900, layoutWidth: 1280, editing: true });
  assert.equal(typing!.keyboard, 0);
});

test("rotation while typing starts over at the new width instead of keeping the old height", () => {
  const [, , rotated] = run({ editing: true }, { editing: true, visualHeight: 553 },
    { editing: true, layoutWidth: 844, layoutHeight: 390, visualHeight: 200 });
  assert.deepEqual(rotated, { stage: 390, keyboard: 190, viewport: 190, width: 844 });
});

test("a visual viewport larger than the layout (pinch-out, rounding) never lifts the dock", () => {
  const [, open] = run({ editing: true }, { editing: true, visualHeight: 844.4 });
  assert.equal(open!.keyboard, 0);
  const [, sub] = run({ editing: true }, { editing: true, visualHeight: 843.6 });
  assert.equal(sub!.keyboard, 0, "sub-pixel differences are not a keyboard");
  const [, rounding] = run({ editing: true }, { editing: true, visualHeight: 844 - MIN_KEYBOARD_PX + 1 });
  assert.equal(rounding!.keyboard, 0, "nor are a few pixels of viewport rounding");
  const [, shortcuts] = run({ editing: true }, { editing: true, visualHeight: 844 - 55 });
  assert.equal(shortcuts!.keyboard, 55, "iPad's shortcut bar over a hardware keyboard still lifts the dock");
});

test("Android bridge: the keyboard overlays an unchanged WebView; its height is the overlap, frame by frame", () => {
  // The S26 report: the window panned and the dock math moved the dock as well, so the answer
  // overshot to mid-screen and settled back. With the bridge the viewports are never consulted.
  const frames = [0, 40, 180, 520, 760, 812, 812];
  const layouts = run({ layoutHeight: 832, layoutWidth: 384 },
    ...frames.map(native => ({ layoutHeight: 832, layoutWidth: 384, editing: true, native })));
  assert.deepEqual(layouts.map(l => l.stage), Array(layouts.length).fill(832), "the stage never changes");
  assert.deepEqual(layouts.slice(1).map(l => l.keyboard), frames, "every frame passes through, small ones too");
  assert.deepEqual(layouts.slice(1).map(l => l.viewport), frames, "sheets lift by the same overlap");
  for (let i = 1; i < layouts.length; i++) assert.ok(layouts[i]!.keyboard >= layouts[i - 1]!.keyboard, "an opening keyboard never moves the dock back down");
  const [ignoresViewport] = run({ layoutHeight: 832, visualHeight: 300, editing: true, native: 0 });
  assert.equal(ignoresViewport!.keyboard, 0, "a stray visual-viewport change is not counted on top of the bridge");
  const [closing] = run({ layoutHeight: 832, editing: false, native: 300 });
  assert.equal(closing!.keyboard, 300, "after the field blurs the dock still follows the keyboard down");
});

test("listenNativeKeyboard converts the shell's device px to CSS px and unsubscribes cleanly", () => {
  const seen: [number, boolean][] = [];
  const host: { ahaKeyboard?: { height(): number }; __ahaKeyboard?: KeyboardListener; devicePixelRatio: number } =
    { ahaKeyboard: { height: () => 281.25 }, devicePixelRatio: 2.8125 };
  const stop = listenNativeKeyboard(host, (px, settled) => seen.push([px, settled]));
  assert.ok(stop);
  host.__ahaKeyboard!(1406.25, false);
  host.__ahaKeyboard!(Number.NaN, true);
  assert.deepEqual(seen, [[100, true], [500, false], [0, true]]);
  stop!();
  assert.equal(host.__ahaKeyboard, undefined);
  assert.equal(listenNativeKeyboard({ devicePixelRatio: 3 }, () => assert.fail("no bridge, no calls")), undefined, "iOS and desktop have no bridge");
});
