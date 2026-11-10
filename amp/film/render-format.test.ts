import { expect, it } from "vitest";
import { renderFormat } from "./render-format";

it("makes 2160p true 4K in either orientation", () => {
  expect(renderFormat(2160)).toMatchObject({ pixelWidth: 3840, pixelHeight: 2160 });
  expect(renderFormat(2160, true)).toMatchObject({ pixelWidth: 2160, pixelHeight: 3840 });
});

it("produces even encoder dimensions at every supported size", () => {
  for (const res of [360, 540, 720, 1080, 1440, 2160]) {
    for (const tall of [false, true]) {
      const frame = renderFormat(res, tall);
      expect(frame.pixelWidth % 2).toBe(0);
      expect(frame.pixelHeight % 2).toBe(0);
      expect(Math.min(frame.pixelWidth, frame.pixelHeight)).toBe(res);
    }
  }
  expect(renderFormat(540)).toMatchObject({ pixelWidth: 960, pixelHeight: 540 });
  for (const res of [0, -1080, NaN, Infinity, 1215]) expect(() => renderFormat(res)).toThrow(/--res/);
});
