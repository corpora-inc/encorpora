import type { MathBook } from "../../src/publishing/schema.js";
import { Author } from "./authoring.js";
import { meaning } from "./meaning.js";
import { scaling } from "./scaling.js";
import { rates } from "./rates.js";
import { models } from "./models.js";
import { percent } from "./percent.js";
import { studio } from "./studio.js";
const author = new Author();
meaning(author);
scaling(author);
rates(author);
models(author);
percent(author);
studio(author);
export const inTheSameProportion: MathBook = {
  id: "in-the-same-proportion",
  version: "1.0.0",
  title: "In the Same Proportion",
  subtitle: "Ratios, Rates and the Whole That Matters",
  audience:
    "Selected grade-six and grade-seven ideas, with fraction and equal-group bridges. Multiplication, division, introductory fractions and coordinate pairs are prerequisites.",
  description:
    "An original illustrated investigation of ratio meaning, multiplicative scaling, unit rates, proportional models and selected percent relationships, with error repair, design challenges, mixed retrieval and reasoned solutions.",
  pages: author.finish(),
};
