import type { MathBook } from "../../src/publishing/schema.js";
import { Author } from "./authoring.js";
import { length } from "./length.js";
import { border } from "./border.js";
import { cover } from "./cover.js";
import { compare } from "./compare.js";
import { units } from "./units.js";
import { studio } from "./studio.js";
const author = new Author();
length(author);
border(author);
cover(author);
compare(author);
units(author);
studio(author);
export const measureBorderCover: MathBook = {
  id: "measure-border-cover",
  version: "1.0.0",
  title: "Measure, Border, Cover",
  subtitle: "Choose the Quantity. Build the Argument.",
  audience:
    "Selected grades three through five measurement ideas, with a ruler-interval bridge; whole-number operations and introductory fractions and decimals are assumed.",
  description:
    "An original illustrated investigation of length, perimeter, rectangular area and selected metric-length conversions, with visual arguments, design challenges, mixed retrieval and reasoned solutions.",
  pages: author.finish(),
};
