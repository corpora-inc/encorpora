/** Render independently supplied review fixtures; no reference answers live here. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  expressionToTex,
  segmentPrintText,
} from "../src/content/math-typesetting";
import { PrintMathText } from "../src/content/PrintMathText";
const sources: unknown = JSON.parse(readFileSync(0, "utf8"));
if (!Array.isArray(sources) || !sources.every((s) => typeof s === "string"))
  throw new Error("Expected an array of source strings");
console.log(
  JSON.stringify(
    sources.map((source) => ({
      source,
      tex: expressionToTex(source),
      segments: segmentPrintText(source),
      html: renderToStaticMarkup(
        createElement(PrintMathText, { text: source }),
      ),
    })),
  ),
);
