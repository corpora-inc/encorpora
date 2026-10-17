import type { MathBook } from "../../src/publishing/schema.js";
import { Author } from "./authoring.js";
import { addCounting } from "./counting.js";
import { addPartners } from "./partners.js";
import { addTens } from "./tens.js";
import { addStories } from "./stories.js";
import { addStrategies } from "./strategies.js";
import { addTransfer } from "./transfer.js";
import { addMaterials } from "./materials.js";
import { addGuide } from "./guide.js";
const author = new Author();
addCounting(author);
addPartners(author);
addTens(author);
addStories(author);
addStrategies(author);
addTransfer(author);
addGuide(author);
addMaterials(author);
export const numberBuilders: MathBook = {
  id: "number-builders",
  version: "1.0.0",
  title: "Number Builders",
  subtitle: "Count, Compose, and Change",
  audience:
    "Early-number learners, with selected K–2 number-and-operations ideas. An adult may read the invitations aloud; counting, drawing and explaining belong to the learner.",
  description:
    "Build quantities, see parts of ten, trade equal units and explain addition and subtraction. Large exact models, open drawing tasks and reasoned adult keys connect early counting to selected two-digit strategies.",
  pages: author.finish(),
};
