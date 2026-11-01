import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

type Entry = WorkEntry & {
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
};

const entries: Entry[] = [
  {
    id: "similar-triangles-work",
    title: "Angle, scale factor and sides of similar triangles",
    goal: "Find a missing angle, the scale factor and the missing sides of two similar triangles.",
    summary:
      "Similar triangles have the same shape but may differ in size. Their matching angles are equal. Every side of one is the same number times the matching side of the other. That number is called the scale factor. Find the missing angle first, then the scale factor, then the missing sides.",
    senses: { side: "side", sides: "side", similar: "similar-figures" },
    noLink: ["factor", "third", "sort", "parts"],
    objectives: [
      "Find an unknown angle from the angle sum and the correspondence of two similar triangles.",
      "Find the scale factor from one pair of corresponding sides and use it to find the other sides.",
    ],
    intuition:
      "A photo and its enlargement have the same angles, and every length is multiplied by the same number. Corresponding parts are the parts that match when one triangle is laid on the other. The scale factor is the number every length is multiplied by. If a side of 8 cm becomes 12 cm, it is $\\frac{12}{8}=\\frac{3}{2}$. Every other side is also multiplied by $\\frac{3}{2}$. The three angles of any triangle add to $180^\\circ$, so two angles give the third. We write $\\angle A$ for the angle at corner $A$, and $D\\leftrightarrow A$ means corner $D$ matches corner $A$.",
    terms: [
      "corresponding",
      [
        "scale-factor",
        "Name the direction: from the first triangle to the second.",
      ],
    ],
    method: [
      "Find the third angle of the first triangle: $180^\\circ$ minus the two given angles. The matching angle of the second triangle is equal to it.",
      "Choose a pair of matching sides with both lengths known. Divide the second triangle's side by the first triangle's side to get the scale factor.",
      "Multiply each remaining side of the first triangle by the scale factor.",
      "Check that the longest side of one triangle matches the longest side of the other.",
    ],
    watch:
      "The scale factor depends on direction: from the small triangle to the large one it is above 1, and the reverse is its reciprocal (the fraction flipped). Divide the side of the second triangle by the side of the first.",
    principle:
      "If triangle $T'$ is similar to triangle $T$ with scale factor $k$, every side of $T'$ is $k$ times the corresponding side of $T$. Every angle of $T'$ equals the corresponding angle of $T$. The factor from $T'$ back to $T$ is $\\frac{1}{k}$.",
    example: {
      prompt:
        "Triangle $ABC$ has $\\angle A=46^\\circ$, $\\angle B=59^\\circ$, $AB=12$ cm and $BC=9$ cm. Triangle $DEF$ is similar with $D\\leftrightarrow A$, $E\\leftrightarrow B$, $F\\leftrightarrow C$ and $DE=8$ cm. Find $\\angle F$, the scale factor and $EF$.",
      steps: [
        "The angles of a triangle add to $180^\\circ$: $\\angle C=180-46-59=75^\\circ$. Matching angles are equal, so $\\angle F=75^\\circ$.",
        "$DE$ matches $AB$. The scale factor from $ABC$ to $DEF$ is $\\frac{DE}{AB}=\\frac{8}{12}=\\frac{2}{3}$.",
        "$EF$ matches $BC$, so multiply by the scale factor: $EF=9\\times\\frac{2}{3}=6$ cm.",
      ],
      answer: "$\\angle F=75^\\circ$, scale factor $\\frac{2}{3}$, $EF=6$ cm",
    },
    methodTitle: "Check the order of the sides",
    methodText: [
      "After finding the sides, sort them by length. The shortest side of $DEF$ must match the shortest side of $ABC$, and so on.",
      "A factor below 1 must give shorter sides, and a factor above 1 longer ones.",
    ],
    formal:
      "A similarity is a dilation, a resizing from a point by factor $k$, followed by a rigid motion, a slide, turn or flip. A dilation keeps every angle the same and multiplies every length by $k$. So every side of one triangle is $k$ times the corresponding side of the other.",
    pitfalls: [
      "Divide the second triangle's side by the first triangle's side when the factor goes from the first to the second.",
      "Use the angle sum $180^\\circ$ for the third angle; do not copy a given angle to the unmatched corner.",
    ],
    parentGuide:
      "Ask your learner whether the second triangle should be bigger or smaller, and whether the answers agree.",
  },
  {
    id: "scale-drawing-work",
    title: "Actual size, area and a new scale from a scale drawing",
    goal: "Find actual lengths and area from a scale drawing, then the scale and a width of a second drawing.",
    summary:
      "A drawing's scale is the real length that one unit of the drawing stands for, such as 1 cm = 5 ft. A scale drawing shows a real object with every length shrunk or stretched by the same amount. Multiply drawing lengths by it to get real lengths. Area, the space inside a shape, is the real length times the real width.",
    senses: {
      scale: "scale",
      scales: "scale",
      side: "side",
      sides: "side",
      unit: "unit",
      units: "unit",
      square: "unit-square",
      squares: "unit-square",
    },
    noLink: ["factor", "inverse", "change"],
    objectives: [
      "Find an actual length and area of a rectangle from its drawing and scale.",
      "Find the scale of a second drawing of the same object and the width it gives.",
    ],
    intuition:
      "A drawing's scale is the real length that one unit of the drawing stands for. If 1 cm on a plan stands for 5 ft, a wall drawn 4 cm long is $4\\times5=20$ ft long. Area is the space inside a shape, counted in square units, the number of 1-unit squares that fill it. To find an area, first find the real length and width, then multiply them: $20\\times12=240$ square feet. Multiplying the drawing's area by 5 would be wrong, because both the length and the width grow 5 times.",
    terms: [
      "scale",
      ["scale", "The actual size is the real object's size, in real units."],
    ],
    method: [
      "Multiply the drawing's length and width by the number of real units one drawing unit stands for.",
      "Multiply the real length by the real width for the area, in square units.",
      "For a second drawing, divide the real length by the new drawing's length. That gives the real units one drawing unit stands for.",
      "Divide the real width by that number for the new drawing's width.",
    ],
    watch:
      "Find area from the real length and width. Multiplying the drawing's area by the scale gives the wrong area, because both the length and the width are scaled.",
    principle:
      "A scale of 1 drawing unit to $s$ real units multiplies every length by $s$ and every area by $s^2$. If one drawing's unit stands for twice as much real length, that drawing is half as long.",
    example: {
      prompt:
        "A plan shows a room 6 cm long and 4 cm wide, at $1\\text{ cm}=3\\text{ ft}$. A second plan shows the room 2 in. long. Find the actual length and area, the second scale and the second plan's width.",
      steps: [
        "Each centimeter stands for 3 ft. Length: $6\\times3=18$ ft. Width: $4\\times3=12$ ft.",
        "Area uses the real lengths: $18\\times12=216$ square feet.",
        "The real 18 ft is drawn 2 in. long, so $18\\div2=9$: on the second plan, 1 in. stands for 9 ft.",
        "The real width is 12 ft, at 9 ft per inch: $12\\div9=\\frac{4}{3}$ in., about 1.33 in.",
      ],
      answer: "18 ft, 216 square feet, 1 in. = 9 ft, $\\frac{4}{3}$ in.",
    },
    methodTitle: "Check by scaling back",
    methodText: [
      "Multiply the new drawing's length by the new scale: $2\\times9=18$ ft, the real length again.",
      "The two scales may use different units. Keep each unit with its number.",
    ],
    formal:
      "Scaling every length by $s$ is a dilation, a resizing. A rectangle with sides $a$ and $b$ becomes one with sides $sa$ and $sb$, so its area becomes $sa\\times sb=s^2ab$.",
    pitfalls: [
      "Change both the length and the width by the scale before finding area.",
      "Divide the real length by the drawing length to get a scale; multiplying them finds nothing useful.",
    ],
    parentGuide:
      "Ask your learner to say what one unit of each drawing stands for before calculating.",
  },
  {
    id: "scientific-notation-work",
    title: "Scientific notation: write, divide and multiply",
    goal: "Write numbers in scientific notation, then divide and multiply numbers written that way.",
    summary:
      "A power of 10 is a product of 10s: $10^{5}=100{,}000$. Scientific notation is a way to write a number as a number from 1 up to 10 times a power of 10, such as $3\\times10^{5}$. The power of 10 sets the size, and the first number carries the digits.",
    noLink: ["change"],
    senses: { product: "product-multiply", factors: "factor-number" },
    objectives: [
      "Write a large or small number as $a\\times10^n$ with $1\\le a<10$.",
      "Divide two numbers in scientific notation to compare them, and multiply a count by one to find a total.",
    ],
    intuition:
      "300,000 is 3 times 100,000, and $100{,}000=10^{5}$, so 300,000 is $3\\times10^{5}$. The small raised 5 is called the exponent. It counts the places the decimal point moves when you multiply by $10^{5}$. A negative exponent means dividing: $10^{-3}=\\frac{1}{1000}=0.001$. So 0.001 is $1\\times10^{-3}$. For a small number, count how many places right the point moves to reach the first nonzero digit, and make that count negative. The first number is called the coefficient. It must be 1 or more and less than 10.",
    terms: [
      [
        "coefficient",
        "In scientific notation $a \\times 10^n$, the coefficient $a$ is 1 or more and less than 10.",
      ],
      [
        "power-of-10",
        "For a negative exponent, $10^{-n} = \\frac{1}{10^n}$, such as $10^{-2} = 0.01$.",
      ],
    ],
    method: [
      "Count the places the decimal point moves to leave one nonzero digit in front of it. Moving left gives a positive exponent; moving right gives a negative one.",
      "To find how many times greater one number is, write each as an ordinary number and divide. Or divide the coefficients and subtract the exponents.",
      "To find a total, multiply the count by the coefficient. Then make the coefficient between 1 and 10 by changing the exponent.",
      "Write the answer as $a\\times10^n$ and check that $a$ is 1 or more and less than 10.",
    ],
    watch:
      "A coefficient of 20 or 0.5 is not scientific notation: $20\\times10^4$ is $2\\times10^5$. Shift the point and change the exponent together.",
    principle:
      "$a\\times10^m\\div(b\\times10^k)=\\frac{a}{b}\\times10^{m-k}$ and $c\\times(a\\times10^m)=ca\\times10^m$. Each result is then rewritten with a coefficient from 1 up to 10, by moving the decimal point and changing the exponent to keep the value.",
    example: {
      prompt:
        "A whale weighs 300,000 pounds. A mouse weighs 0.05 pound. A seal weighs $1\\times10^{4}$ pounds and a dog $5\\times10^{1}$ pounds. How many times as heavy is the seal as the dog, and what do 1,200 seals weigh in all?",
      steps: [
        "Move the point 5 places left: $300{,}000=3\\times10^{5}$. Move it 2 places right: $0.05=5\\times10^{-2}$.",
        "Divide the seal's weight by the dog's: $\\frac{10{,}000}{50}=200$. The seal is 200 times as heavy.",
        "Multiply for the total: $1{,}200\\times10{,}000=12{,}000{,}000$. Move the point 7 places left: $1.2\\times10^{7}$ pounds.",
      ],
      answer: "200 times; $1.2\\times10^{7}$ pounds",
    },
    methodTitle: "Check the size",
    methodText: [
      "A positive exponent means the number is 10 or more; a negative exponent means it is less than 1.",
      "The exponent of a product is about the sum of the exponents of the two numbers multiplied. Add 1 more when the coefficients multiply to 10 or more.",
    ],
    formal:
      "An integer is a whole number or its negative. Every positive number is $a\\times10^n$ for exactly one integer $n$ and exactly one $a$ with $1\\le a<10$. Equal numbers have equal coefficients and equal exponents.",
    pitfalls: [
      "Move the decimal point toward the first nonzero digit and count the places; a small number needs a negative exponent.",
      "After multiplying, check whether the coefficient is 10 or more, and adjust the exponent.",
    ],
    parentGuide:
      "Ask your learner whether each number is larger or smaller than 1 and whether the sign of the exponent matches.",
  },
];

const built = workContent(entries);
export const mcasWrittenWorkContent = {
  ...built,
  methods: Object.fromEntries(
    entries.map((e) => [
      e.id,
      { ...built.methods[e.id]!, ...(e.goal ? { goal: e.goal } : {}) },
    ]),
  ),
};

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
