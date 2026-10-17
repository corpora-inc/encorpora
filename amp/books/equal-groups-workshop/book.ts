import type { MathBook } from "../../src/publishing/schema.js";
import { Author } from "./authoring.js";
import { meaning } from "./meaning.js";
import { strategies } from "./strategies.js";
import { division } from "./division.js";
import { decisions } from "./decisions.js";
import { transfer } from "./transfer.js";
const author = new Author();
meaning(author);
strategies(author);
division(author);
decisions(author);
transfer(author);
export const equalGroupsWorkshop: MathBook = {
  id: "equal-groups-workshop",
  version: "1.0.0",
  title: "The Equal Groups Workshop",
  subtitle: "Build, Break Apart, and Share",
  audience:
    "Grade-two entry, grade-three multiplication/division core, and selected grade-four extensions; an adult may read aloud.",
  description:
    "An original illustrated investigation of equal groups, arrays, area, flexible fact strategies, division meanings, remainder decisions, and mixed transfer, with a workbook and reasoned solutions.",
  pages: author.finish(),
};
