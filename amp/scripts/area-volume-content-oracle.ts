/** Export authored area/volume content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { areaVolumeLessons as lessons } from "../src/content/area-volume-lessons";
import { areaVolumeWorksheet } from "../src/content/area-volume-worksheets";
import {
  AreaVolumeIllustration,
  type AreaVolumeIllustrationKind,
} from "../src/content/AreaVolumeIllustration";
const worksheets = lessons.flatMap((lesson) =>
  Array.from({ length: 8 }, (_, i) => ({
    templateId: lesson.templateIds[0]!,
    edition: String(i + 1),
    problems: areaVolumeWorksheet(
      lesson.templateIds[0]!,
      lesson.id,
      String(i + 1),
    ),
  })),
);
const kinds: AreaVolumeIllustrationKind[] = [
  "av-triangle-half",
  "av-polygon-split",
  "av-prism-net",
  "av-cube-packing",
  "av-composite-split",
  "av-prism-layers",
  "av-prism-unrolled",
  "av-cylinder-stack",
  "av-cone-sphere-cylinder",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(AreaVolumeIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
