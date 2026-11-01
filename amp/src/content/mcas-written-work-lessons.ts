import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "similar-triangles-work",
    title: "Angle, scale factor and sides of similar triangles",
    summary:
      "Similar triangles have equal corresponding angles and one scale factor for all sides: find the angle, then the factor, then the sides.",
    objectives: [
      "Find an unknown angle from the angle sum and the correspondence of two similar triangles.",
      "Find the scale factor from one pair of corresponding sides and use it to find the other sides.",
    ],
    intuition:
      "A photo and its enlargement have the same angles, and every length is multiplied by the same number. If a side of 8 cm becomes 12 cm, the factor is $\\frac{12}{8}=\\frac{3}{2}$, and every other side is also multiplied by $\\frac{3}{2}$.",
    terms: [
      "corresponding",
      [
        "scale-factor",
        "Name the direction: from the first triangle to the second.",
      ],
    ],
    method: [
      "Find the third angle of the first triangle: $180^\\circ$ minus the two given angles. The corresponding angle of the second triangle is equal to it.",
      "Choose a pair of corresponding sides with both lengths known and divide the second by the first for the scale factor.",
      "Multiply each remaining side of the first triangle by the scale factor.",
      "Check that the longest side of one triangle corresponds to the longest side of the other.",
    ],
    watch:
      "The scale factor depends on direction: from the small triangle to the large one it is above 1, and the reverse is its reciprocal. Divide the side of the second triangle by the side of the first.",
    principle:
      "If triangle $T'$ is similar to triangle $T$ with scale factor $k$, every side of $T'$ is $k$ times the corresponding side of $T$ and every angle of $T'$ equals the corresponding angle of $T$. The factor from $T'$ to $T$ is $\\frac{1}{k}$.",
    example: {
      prompt:
        "Triangle $ABC$ has $\\angle A=40^\\circ$, $\\angle B=65^\\circ$, $AB=6$, $BC=9$ and $CA=12$ cm. Triangle $DEF$ is similar with $D\\leftrightarrow A$, $E\\leftrightarrow B$, $F\\leftrightarrow C$ and $DE=4$ cm. Find $\\angle F$, the scale factor and $EF$.",
      steps: [
        "$\\angle C=180-40-65=75^\\circ$, so $\\angle F=75^\\circ$.",
        "Scale factor from $ABC$ to $DEF$: $\\frac{DE}{AB}=\\frac{4}{6}=\\frac{2}{3}$.",
        "$EF=BC\\times\\frac{2}{3}=9\\times\\frac{2}{3}=6$ cm.",
      ],
      answer: "$\\angle F=75^\\circ$, scale factor $\\frac{2}{3}$, $EF=6$ cm",
    },
    methodTitle: "Check the order of the sides",
    methodText: [
      "After finding the sides, sort them. The shortest side of $DEF$ must correspond to the shortest side of $ABC$, and so on.",
      "A factor below 1 must give shorter sides; above 1, longer ones.",
    ],
    formal:
      "A similarity is a dilation by factor $k$ followed by a rigid motion. A dilation preserves angles and multiplies lengths by $k$, so the ratios of corresponding sides are all equal to $k$.",
    pitfalls: [
      "Divide the second triangle's side by the first triangle's side when the factor goes from the first to the second.",
      "Use the angle sum $180^\\circ$ for the third angle; do not copy a given angle to the unmatched vertex.",
    ],
    parentGuide:
      "Ask your learner whether the second triangle should be bigger or smaller, and whether the answers agree.",
  },
  {
    id: "scale-drawing-work",
    title: "Actual size, area and a new scale from a scale drawing",
    summary:
      "A scale says how much actual length one unit of the drawing stands for. Lengths scale by the factor; areas use the actual lengths.",
    objectives: [
      "Find an actual length and area of a rectangle from its drawing and scale.",
      "Find the scale of a second drawing of the same object and the width it gives.",
    ],
    intuition:
      "If 1 cm on a plan stands for 5 ft, a wall drawn 4 cm long is $4\\times5=20$ ft long. To find an area, first find the actual length and width, then multiply them: $20\\times12=240$ square feet. Multiplying the drawing's area by 5 would be wrong, because area grows by the factor twice.",
    terms: [
      "scale",
      ["scale", "The actual size is the real object's size, in real units."],
    ],
    method: [
      "Multiply the drawing's length and width by the number of actual units one drawing unit stands for.",
      "Multiply the actual length by the actual width for the area, in square units.",
      "For a second drawing, divide the actual length by the new drawing's length to get actual units per drawing unit.",
      "Divide the actual width by that number for the new drawing's width.",
    ],
    watch:
      "Find area from the actual length and width. Multiplying the drawing's area by the scale undercounts, because both dimensions are scaled.",
    principle:
      "A scale of 1 drawing unit to $s$ actual units multiplies every length by $s$ and every area by $s^2$. Drawings of the same object at two scales have drawing lengths in the inverse ratio of their scales.",
    example: {
      prompt:
        "A plan shows a room 6 cm long and 4 cm wide, at $1\\text{ cm}=3\\text{ ft}$. A second plan shows the room 2 in. long. Find the actual length and area, the second scale and the second plan's width.",
      steps: [
        "Length $6\\times3=18$ ft; width $4\\times3=12$ ft.",
        "Area $18\\times12=216$ square feet.",
        "Second scale: $18\\div2=9$, so 1 in. stands for 9 ft.",
        "Second width: $12\\div9=\\frac{4}{3}$ in., about 1.33 in.",
      ],
      answer: "18 ft, 216 square feet, 1 in. = 9 ft, $\\frac{4}{3}$ in.",
    },
    methodTitle: "Check by scaling back",
    methodText: [
      "Multiply the new drawing's length by the new scale: $2\\times9=18$ ft, the actual length again.",
      "The two scales may use different units. Keep each unit with its number.",
    ],
    formal:
      "Scaling every length by $s$ is a dilation. A rectangle with sides $a$ and $b$ becomes one with sides $sa$ and $sb$ and area $s^2ab$.",
    pitfalls: [
      "Change both length and width by the scale before finding area.",
      "Divide the actual length by the drawing length to get a scale; multiplying them finds nothing.",
    ],
    parentGuide:
      "Ask your learner to say what one unit of each drawing stands for before calculating.",
  },
  {
    id: "scientific-notation-work",
    title: "Scientific notation: write, divide and multiply",
    summary:
      "A number in scientific notation is $a\\times10^n$ with $1\\le a<10$. Powers of 10 shift the decimal point; the coefficients carry the digits.",
    objectives: [
      "Write a large or small number as $a\\times10^n$ with $1\\le a<10$.",
      "Divide two numbers in scientific notation to compare them, and multiply a count by one to find a total.",
    ],
    intuition:
      "Moving a decimal point left 5 places divides by $10^5$, so 300,000 is $3\\times10^5$. A small number such as 0.001 needs the point moved right 3 places, which is $10^{-3}$, so 0.001 is $1\\times10^{-3}$. The coefficient always keeps one nonzero digit before the point.",
    terms: [
      [
        "coefficient",
        "In scientific notation $a \\times 10^n$, the coefficient $a$ is at least 1 and less than 10.",
      ],
      [
        "power-of-10",
        "For a negative exponent, $10^{-n} = \\frac{1}{10^n}$, such as $10^{-2} = 0.01$.",
      ],
    ],
    method: [
      "Count the places the decimal point moves to leave one nonzero digit in front. Left moves give a positive $n$; right moves give a negative $n$.",
      "To find how many times greater one number is, write each as an ordinary number and divide, or divide the coefficients and subtract the exponents.",
      "To find a total, multiply the count by the coefficient, then fix the coefficient to be between 1 and 10 by changing the exponent.",
      "Write the answer as $a\\times10^n$ and check that $1\\le a<10$.",
    ],
    watch:
      "A coefficient of 20 or 0.5 is not scientific notation: $20\\times10^4$ is $2\\times10^5$. Shift the point and change the exponent together.",
    principle:
      "$a\\times10^m\\div(b\\times10^k)=\\frac{a}{b}\\times10^{m-k}$ and $c\\times(a\\times10^m)=ca\\times10^m$. Each is rewritten with a coefficient from 1 up to 10 by moving the decimal point and adjusting the exponent to keep the value.",
    example: {
      prompt:
        "A whale weighs 300,000 pounds. A mouse weighs 0.05 pound. A seal weighs $1\\times10^{4}$ pounds and a dog $5\\times10^{1}$ pounds. How many times as heavy is the seal as the dog, and what do 1,200 seals weigh in all?",
      steps: [
        "$300{,}000=3\\times10^{5}$ and $0.05=5\\times10^{-2}$.",
        "$\\frac{10{,}000}{50}=200$ times as heavy.",
        "$1{,}200\\times10{,}000=12{,}000{,}000=1.2\\times10^{7}$ pounds.",
      ],
      answer: "200 times; $1.2\\times10^{7}$ pounds",
    },
    methodTitle: "Check the size",
    methodText: [
      "A positive exponent means the number is at least 10; a negative exponent means it is less than 1.",
      "The exponent of a product is about the sum of the exponents of its factors, plus 1 when the coefficients multiply to 10 or more.",
    ],
    formal:
      "Every positive number is $a\\times10^n$ for exactly one integer $n$ and exactly one $a$ with $1\\le a<10$. Equal numbers have equal coefficients and exponents.",
    pitfalls: [
      "Move the decimal point toward the leading digit and count the places; a small number needs a negative exponent.",
      "After multiplying, check whether the coefficient is 10 or more and adjust the exponent.",
    ],
    parentGuide:
      "Ask your learner whether each number is larger or smaller than 1 and whether the sign of the exponent matches.",
  },
];

export const mcasWrittenWorkContent = workContent(entries);

export const mcasWrittenWorkFacetMappings: FacetMapping[] = [
  {
    templateId: "similar-triangles-work",
    facetId: "dilations-similarity.core",
    extent: "partial",
    rationale:
      "Written work for two similar triangles drawn as a figure: the corresponding angle from the angle sum, the scale factor from one pair of sides and the two other sides, each an exact step. Factors with numerators and denominators up to 5, enlargements and reductions. Does not assess overlapping or nested triangles in one figure, a proof of similarity, or explanations in words.",
  },
  {
    templateId: "scale-drawing-work",
    facetId: "scale-drawings.core",
    extent: "partial",
    rationale:
      "Written work for a scale drawing of a rectangle: the actual length, the actual area, the scale of a second drawing from its length and that drawing's width, each an exact step, in feet and inches or meters and centimeters. Does not assess scales stated as ratios, map scales with fractions, or explanations in words.",
  },
  {
    templateId: "scientific-notation-work",
    facetId: "scientific-notation.standard-form",
    extent: "partial",
    rationale:
      "Written work: a large and a small number written in scientific notation as a coefficient and a power of 10 (each graded exactly, so 20 and 5 is not accepted for 2 and 6), with exact quotients and products of numbers in scientific notation. Does not assess negative numbers, calculator notation or explanations in words.",
  },
  {
    templateId: "scientific-notation-work",
    facetId: "scientific-notation.operations",
    extent: "partial",
    rationale:
      "A quotient of two numbers in scientific notation entered as an exact number, and a count times a number in scientific notation entered as a coefficient and a power of 10. Does not assess sums or differences of numbers in scientific notation.",
  },
];
