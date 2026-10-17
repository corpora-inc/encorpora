import type { MathBook } from "../../src/publishing/schema.js";
import { Author } from "./authoring.js";
import { expressions } from "./expressions.js";
import { equations } from "./equations.js";
import { relationships } from "./relationships.js";
import { models } from "./models.js";
import { transfer } from "./transfer.js";
const author = new Author();
expressions(author);
equations(author);
relationships(author);
models(author);
transfer(author);
export const balanceAndChange: MathBook = {
  id: "balance-and-change",
  version: "1.0.0",
  title: "Balance and Change",
  subtitle: "What Stays Equal? What Changes Together?",
  audience:
    "Grades six through eight with selected Algebra I connections; arithmetic with fractions, decimals and signed values is assumed.",
  description:
    "An original illustrated route through expressions, equality, linear equations, coordinates, functions and linear models, with investigations, mixed retrieval, workbook space and reasoned solutions.",
  pages: author.finish(),
};
