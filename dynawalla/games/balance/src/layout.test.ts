// THE FRAME.
//
// Every other test in this game is about brass and rational arithmetic, and not
// one of them can see where a thing is drawn. So COUNTERPOISE shipped with its
// movement name underneath the host's exit button, its sound toggle underneath
// the how-to-play button, and its rack of weights — the row a child touches on
// every single turn — sitting in the bottom `h * 0.035` of the glass, which on
// a phone with a home indicator is underneath the home indicator.
//
// This file is the gate for all three. It runs the layout through
// `layoutForViewport`, which is the exact entry point `Game.resize` uses, so
// what is asserted here is the arrangement a child gets rather than a pure
// function fed hand-picked arguments.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hitsHostChrome,
  safeRect,
  type Insets,
} from "../../../packs/shared/game-chrome/index.ts";
import { computeLayout, layoutForViewport, rackSlot } from "./layout.ts";

/** Phones held both ways, tablets held both ways, and the smallest phone. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
  ["laptop", 1440, 900],
];

/** Rack sizes the generator actually produces, from the sparsest to the fullest. */
const RACKS = [4, 6, 9, 12];

for (const [name, w, h] of VIEWPORTS) {
  test(`nothing readable sits under the host's chrome at ${name} (${w}×${h})`, () => {
    for (const n of RACKS) {
      const L = layoutForViewport(w, h, n);

      // The movement name, the progress dots and the gems. A child reads these.
      assert.equal(
        hitsHostChrome(L.hud, w),
        false,
        `${name}, rack ${n}: the HUD stack is under host chrome`,
      );

      // The sound toggle. A child TOUCHES this, which is worse: a tap that
      // lands on the host's control instead does something else entirely.
      const sound = {
        x: L.sound.x - L.sound.half,
        y: L.sound.y - L.sound.half,
        w: L.sound.half * 2,
        h: L.sound.half * 2,
      };
      assert.equal(
        hitsHostChrome(sound, w),
        false,
        `${name}, rack ${n}: the sound toggle is under host chrome`,
      );

      // The sound toggle is still a real target, and still on the glass.
      assert.ok(L.sound.half * 2 >= 44, "the sound toggle is under 44px");
      assert.ok(L.sound.x + L.sound.half <= w + 0.5, "the sound toggle runs off the right");
      assert.ok(L.sound.y - L.sound.half >= 0, "the sound toggle runs off the top");
    }
  });

  test(`the rack of weights stays inside the safe area at ${name} (${w}×${h})`, () => {
    const area = safeRect(w, h);
    for (const n of RACKS) {
      const L = layoutForViewport(w, h, n);
      for (let i = 0; i < n; i++) {
        const p = rackSlot(L, i, n);
        assert.ok(
          p.y + L.rack.slotH / 2 <= area.y + area.h + 0.5,
          `${name}, rack ${n}: weight ${i} hangs below the safe area`,
        );
        assert.ok(
          p.x - L.rack.slotW / 2 >= area.x - 0.5,
          `${name}, rack ${n}: weight ${i} runs off the safe left edge`,
        );
        assert.ok(
          p.x + L.rack.slotW / 2 <= area.x + area.w + 0.5,
          `${name}, rack ${n}: weight ${i} runs off the safe right edge`,
        );
      }
      // The rack must not have been pushed up into the plinth to achieve that.
      assert.ok(
        L.rack.y > L.plinth.y + L.plinth.h - 0.5,
        `${name}, rack ${n}: the rack overlaps the plinth`,
      );
    }
  });

  test(`the apparatus fits the safe area at ${name} (${w}×${h})`, () => {
    const area = safeRect(w, h);
    const L = layoutForViewport(w, h, 9);
    assert.ok(L.pivot.y - L.arm * 0.2 > area.y, "the beam is above the safe area");
    assert.ok(L.pivot.x - L.arm >= area.x - 0.5, "the arm runs off the safe left edge");
    assert.ok(L.pivot.x + L.arm <= area.x + area.w + 0.5, "the arm runs off the safe right edge");
    assert.ok(L.plinth.x >= area.x - 0.5, "the plinth runs off the safe left edge");
    assert.ok(
      L.plinth.x + L.plinth.w <= area.x + area.w + 0.5,
      "the plinth runs off the safe right edge",
    );
    // A prompt a child cannot read is not a prompt.
    assert.ok(L.promptSize >= 17, `the engraving is ${L.promptSize.toFixed(1)}px`);
  });
}

// Node has no notch, so `safeInsets()` reads zeros here and the tests above
// cannot tell a layout that honours the safe area from one that ignores it.
// These do: they hand `computeLayout` the rectangle a real device would give
// it, and assert against that rectangle rather than against the glass.
const NOTCHED: Array<[string, number, number, Insets]> = [
  ["phone portrait, notch + home indicator", 390, 844, { top: 59, right: 0, bottom: 34, left: 0 }],
  ["phone landscape, notch on the left", 844, 390, { top: 0, right: 59, bottom: 21, left: 59 }],
  ["small phone, notch + home indicator", 320, 568, { top: 44, right: 0, bottom: 34, left: 0 }],
];

for (const [name, w, h, insets] of NOTCHED) {
  test(`the safe area is honoured on a ${name}`, () => {
    const area = safeRect(w, h, insets);
    for (const n of RACKS) {
      const L = computeLayout(w, h, n, area);

      // The rack. This is the bug: `h - rackH - h * 0.035` put the bottom row
      // of weights under the home indicator, where a drag is a system gesture.
      for (let i = 0; i < n; i++) {
        const p = rackSlot(L, i, n);
        assert.ok(
          p.y + L.rack.slotH / 2 <= area.y + area.h + 0.5,
          `${name}, rack ${n}: weight ${i} is under the home indicator`,
        );
        assert.ok(
          p.x - L.rack.slotW / 2 >= area.x - 0.5 &&
            p.x + L.rack.slotW / 2 <= area.x + area.w + 0.5,
          `${name}, rack ${n}: weight ${i} is under a rounded corner`,
        );
      }

      // The apparatus and the engraving.
      assert.ok(L.pivot.y >= area.y, `${name}: the pivot is above the safe area`);
      assert.ok(L.pivot.x - L.arm >= area.x - 0.5, `${name}: the arm is off the safe left`);
      assert.ok(
        L.pivot.x + L.arm <= area.x + area.w + 0.5,
        `${name}: the arm is off the safe right`,
      );
      assert.ok(
        L.plinth.y + L.plinth.h <= area.y + area.h + 0.5,
        `${name}: the engraving is below the safe area`,
      );

      // And the chrome promise still holds once there ARE insets, which move
      // both of the host's corners.
      assert.equal(hitsHostChrome(L.hud, w, insets), false, `${name}: the HUD is under chrome`);
      assert.equal(
        hitsHostChrome(
          {
            x: L.sound.x - L.sound.half,
            y: L.sound.y - L.sound.half,
            w: L.sound.half * 2,
            h: L.sound.half * 2,
          },
          w,
          insets,
        ),
        false,
        `${name}: the sound toggle is under chrome`,
      );
    }
  });
}

test("the safe rectangle is what the layout is actually built from", () => {
  // The other direction: give the layout a smaller box and everything inside
  // it moves. If this stops holding, the `area` argument has quietly become
  // decoration and the notch is back.
  const wide = layoutForViewport(390, 844, 9);
  assert.deepEqual(wide.area, safeRect(390, 844));
  assert.ok(wide.rack.y < 844, "the rack is off the bottom of the glass");
});
