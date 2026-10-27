import type { ContentFamily } from "./registry/types";
import { vasolGrade3 } from "../curriculum/released-items/vasol-2014-3";
import { vasolGrade4 } from "../curriculum/released-items/vasol-2014-4";
import { vasolGrade5 } from "../curriculum/released-items/vasol-2014-5";

/** Virginia SOL grades 3 to 5 released mathematics tests (spring 2014, 2009
 * standards): a released-item ledger and the archetypes no earlier source named. */
export const family = {
  id: "virginia-sol-ledger",
  archetypes: [
    {
      id: "measure.thermometer",
      domain: "geometry",
      summary: "Read a temperature from a Celsius or Fahrenheit thermometer",
    },
    {
      id: "shape.congruent-figures",
      domain: "geometry",
      summary: "Pick the figure or pair of figures that are congruent",
    },
    {
      id: "shape.subdivide-name",
      domain: "geometry",
      summary:
        "Name the figures formed when a flat figure is cut along drawn segments",
    },
    {
      id: "triangle.classify-sides",
      domain: "geometry",
      summary: "Classify a triangle as scalene, isosceles or equilateral",
    },
    {
      id: "pattern.repeating-unit",
      domain: "algebra",
      summary:
        "Extend or repair a repeating pattern of figures and find the missing elements",
    },
    {
      id: "equation.model-choice",
      domain: "algebra",
      summary:
        "Choose the drawn tile or bar model that shows a one-step equation",
    },
    {
      id: "equation.variable-identify",
      domain: "algebra",
      summary:
        "Choose the quantity in a situation that can change and so is a variable",
    },
    {
      id: "whole.property-identify",
      domain: "arithmetic",
      summary:
        "Identify an example of the identity, commutative, associative or distributive property",
    },
    {
      id: "probability.likelihood-design",
      domain: "data",
      summary:
        "Build or choose a set of outcomes, bag or spinner that meets a stated likelihood",
    },
    {
      id: "probability.likelihood-scale",
      domain: "data",
      summary:
        "Name the likelihood of an event in words or place its probability on a zero to one number line",
    },
    {
      id: "univariate.mode",
      domain: "data",
      summary: "Find the mode of a data set",
    },
    {
      id: "univariate.measure-meaning",
      domain: "data",
      summary:
        "Name the measure of center or variation that a description or situation defines",
    },
  ],
  releasedLedgers: [vasolGrade3, vasolGrade4, vasolGrade5],
} satisfies ContentFamily;
