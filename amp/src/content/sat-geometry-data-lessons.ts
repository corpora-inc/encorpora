import type { Lesson } from "./lessons";
import { withTemplateGlossary } from "../math/template-glossary";
import type { ProblemMethod } from "./problem-lessons";
import {
  satGeometryDataTemplates,
  generateSatGeometryDataProblem,
} from "../math/sat-geometry-data-practice";

type Instruction = ProblemMethod & {
  intuition: string;
  principle: string;
  /** The reference lesson's short plain opening. */
  summary: string;
  objectives: [string, string];
  /** The reference lesson's intuition section, before the worked example. */
  explain: { title: string; paragraphs: string[] };
  parentGuide: string;
};
const instruction: Record<string, Instruction> = {
  "trig-context-triangle": {
    goal: "Turn a described situation into a right triangle, then find a side or an angle with sine, cosine or tangent.",
    summary:
      "A ladder against a wall, a ramp or a line of sight makes a right triangle: a triangle with a square corner. If you know one of its other angles and one side, you can find the other sides. A ratio is one length divided by another. Trigonometry uses three ratios of the triangle's sides, and each one depends only on the angle.",
    objectives: [
      "Draw a described situation as a right triangle and name its sides from a given angle.",
      "Find a side or an angle with sine, cosine or tangent.",
    ],
    intuition:
      "A right triangle has one right angle, a square corner of $90^\\circ$ (90 degrees). The legs are the two sides that form the right angle. The other two angles are acute, which means smaller than $90^\\circ$. Pick one acute angle and call it $\\theta$, the Greek letter theta. The hypotenuse is the longest side, across from the right angle. The opposite side is the side across from $\\theta$. The adjacent side is the other side that touches $\\theta$. A ratio is one side length divided by another. Sine means opposite ÷ hypotenuse; cosine means adjacent ÷ hypotenuse; tangent means opposite ÷ adjacent. An angle of elevation is the angle measured up from a level line. An angle of depression is the angle measured down from a level line. Height means how far up something reaches.",
    explain: {
      title: "Same angle, same shape",
      paragraphs: [
        "Every right triangle with the same acute angle has the same shape, whatever its size. So a ratio of two of its sides, one length divided by another, is always the same number. For an angle of $52^\\circ$, the opposite side divided by the adjacent side is always about 1.28.",
        "We write $\\sin\\theta$ for the sine of $\\theta$, $\\cos\\theta$ for its cosine and $\\tan\\theta$ for its tangent. A calculator gives each value; set it to degree mode when the angles are in degrees.",
        "To find an angle from two sides, work backward with the inverse tangent: it takes opposite ÷ adjacent and gives back the angle. We write it $\\tan^{-1}$. The inverse sine and inverse cosine work the same way.",
        "Parallel lines are lines that never meet, like a level line at the top of a cliff and the level sea below. A line that crosses both makes equal angles on opposite sides of it, between the two parallel lines. These are called alternate interior angles. So an angle of depression from the top equals the angle of elevation from the bottom.",
        "Rounding means keeping fewer digits, choosing the closest value. To the nearest tenth, 83.196 is 83.2.",
      ],
    },
    senses: {
      tangent: "tangent-trig",
      degree: "degree-angle",
      side: "side",
      square: "square-shape",
    },
    noLink: ["base"],
    terms: [
      "opposite-side-angle",
      "adjacent-leg",
      [
        "angle-of-depression",
        "It equals the angle of elevation from the object back up, because the two level lines are parallel.",
      ],
      "inverse-trig-function",
    ],
    method: [
      "Sketch the right triangle. Mark the right angle, the given angle and the given side. For an angle of depression, draw a level line through the viewer. The same angle sits at the object, inside the triangle, because the level line and the ground are parallel, which means they never meet.",
      "Name the sides from the angle you use: opposite, adjacent and hypotenuse. Choose the ratio that holds the given side and the unknown side: sine for opposite and hypotenuse, cosine for adjacent and hypotenuse, tangent for opposite and adjacent.",
      "Solve. If the unknown is on top of the ratio, multiply: height $= 65 \\times \\tan 52^\\circ \\approx 83.2$. If it is on the bottom, divide. To find an angle, use the inverse ratio. Round only at the end.",
      "Add any extra height the problem gives, such as how high the viewer's eyes are above the ground.",
    ],
    watch:
      "Name the sides from the angle you use: a side opposite one acute angle is adjacent to the other. Measure an angle of depression down from a level line, not from an upright one.",
    principle:
      "In a right triangle with an acute angle $\\theta$: $\\sin\\theta=\\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos\\theta=\\frac{\\text{adjacent}}{\\text{hypotenuse}}$ and $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$. These values depend only on $\\theta$, because all right triangles with that angle have the same shape. The two acute angles add to $90^\\circ$. For angles in degrees, the calculator must be in degree mode.",
    parentGuide:
      "Ask the learner to sketch the situation as a right triangle, point to the side across from the given angle, and say which ratio uses the two sides in the problem.",
  },
  "midpoint-endpoint": {
    goal: "Use averages to find a midpoint, a missing endpoint, or the center and equation of a circle from a diameter.",
    summary:
      "A segment is a straight piece of a line with two ends. Its midpoint is the point exactly halfway between them. Halfway across is the average of the two $x$-coordinates: add them and divide by 2. Halfway up is the average of the two $y$-coordinates. From $(5, 9)$ to $(7, -1)$, the midpoint is $(6, 4)$.",
    objectives: [
      "Find the midpoint of a segment, or a missing endpoint, from coordinates.",
      "Find the center and equation of a circle from the ends of a diameter.",
    ],
    intuition:
      "A segment is the straight piece of a line between two points, called its endpoints. We write $\\overline{AB}$, with a bar on top, for the segment from $A$ to $B$. A point $(x, y)$ is $x$ across and $y$ up. The midpoint is the point halfway between the endpoints. It is halfway across and halfway up. So each of its coordinates is the average of the endpoints' coordinates: add the two and divide by 2. A circle's radius is the distance from its center to the circle.",
    explain: {
      title: "Halfway in each direction",
      paragraphs: [
        "Halfway between 5 and 7 is 6, and $\\frac{5 + 7}{2} = 6$. Halfway between 9 and $-1$ is 4, and $\\frac{9 + (-1)}{2} = 4$. So the midpoint of $(5, 9)$ and $(7, -1)$ is $(6, 4)$.",
        "To find a missing endpoint, work backward. The midpoint is as far from the known endpoint as the missing endpoint is from the midpoint. From $A(1, 2)$ to the midpoint $(4, 6)$ is 3 across and 4 up. So the other endpoint is 3 across and 4 up again: $(7, 10)$.",
        "A circle is all the points at one distance from a center point. That distance is called the radius. A diameter is a segment through the center with both ends on the circle. The center is the midpoint of any diameter, and the radius is half a diameter. The circle with center $(h, k)$ and radius $r$ has the equation $(x - h)^2 + (y - k)^2 = r^2$, where $r^2$ means $r$ times $r$.",
      ],
    },
    senses: { square: "square-number" },
    terms: ["midpoint", "diameter"],
    method: [
      "For a midpoint, average the $x$-coordinates and average the $y$-coordinates of the endpoints: add each pair and divide by 2.",
      "For a missing endpoint, double the midpoint and subtract the known endpoint, one coordinate at a time. Midpoint $(4, 6)$ and endpoint $(1, 2)$ give $(2 \\times 4 - 1, 2 \\times 6 - 2) = (7, 10)$.",
      "For a circle from a diameter, the center is the midpoint. For $r^2$, square the across change and the up change from the center to one endpoint, and add them. Then write $(x - h)^2 + (y - k)^2 = r^2$.",
    ],
    watch:
      "In $(x - h)^2$ the center's coordinate is subtracted, so a center with $x = -3$ gives $(x + 3)^2$. The right side is $r^2$, not $r$.",
    principle:
      "The midpoint of $(x_1, y_1)$ and $(x_2, y_2)$ is $\\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)$. The small numbers 1 and 2 name the two endpoints. If $M$ is the midpoint of $\\overline{AB}$, then $B = 2M - A$, worked one coordinate at a time. A circle with center $(h, k)$ and radius $r$ has the equation $(x - h)^2 + (y - k)^2 = r^2$. It is the Pythagorean theorem for the across and up distances from the center to a point on the circle.",
    parentGuide:
      "Mark two points on grid paper and ask the learner to find the point halfway between them by counting, then check it with the averages.",
  },
  "space-diagonal": {
    goal: "Find the corner-to-corner length of a box, or a missing edge, by using the Pythagorean theorem twice.",
    summary:
      "Think of a shoebox. The longest straight line inside it runs from one bottom corner to the opposite top corner. It is called the space diagonal. To find its length, use the Pythagorean theorem, a rule about triangles with a square corner, twice: once across the floor of the box, then once up to the top. For a box 3 by 4 by 12, the floor diagonal is 5 and the space diagonal is 13.",
    objectives: [
      "Find the space diagonal of a rectangular box from its three edges.",
      "Find a missing edge from the space diagonal and the other two edges.",
    ],
    intuition:
      "A rectangular box has three edges that meet at each corner. The length $\\ell$ and the width $w$ run along the floor. The height is how tall the box is, and we call it $h$. A right triangle is a triangle with a right angle, a square corner. Its two shorter sides are the legs, and the longest side is the hypotenuse. Squared means multiplied by itself. The Pythagorean theorem is the rule that leg squared plus leg squared equals hypotenuse squared. The floor diagonal and an upright edge meet at a square corner. So they are the legs of a second right triangle, and its hypotenuse is the space diagonal.",
    explain: {
      title: "Across the floor, then up",
      paragraphs: [
        "Floor first. The floor is a rectangle 3 by 4. Its diagonal $f$ is the hypotenuse of a right triangle with legs 3 and 4. So $f^2 = 3^2 + 4^2 = 9 + 16 = 25$, and $f = 5$.",
        "Then up. The floor diagonal, 5, and the height, 12, are the legs of a right triangle standing up inside the box. So $d^2 = 5^2 + 12^2 = 25 + 144 = 169$, and $d = 13$.",
        "You can skip the middle step. Since $f^2 = \\ell^2 + w^2$, the two steps give $d^2 = \\ell^2 + w^2 + h^2$. A square root is the number that times itself makes a given number: the square root of 169 is 13. When the root is not exact, as for 122, leave the answer with a root sign: $\\sqrt{122}$. An answer written with a root sign is called a radical.",
      ],
    },
    senses: {
      square: "square-number",
      root: "root-radical",
      edge: "edge",
      face: "face-solid",
      side: "side",
    },
    noLink: ["rule"],
    terms: [
      [
        "diagonal",
        "A space diagonal joins two corners of a solid that do not share a face.",
      ],
      "pythagorean-theorem",
    ],
    method: [
      "Square each of the three edges and add: $d^2 = \\ell^2 + w^2 + h^2$. For 3, 7 and 8, that is $9 + 49 + 64 = 122$.",
      "Take the square root, the number that times itself makes the sum: $d = \\sqrt{122}$. Simplify the root if you can, as in $\\sqrt{50} = \\sqrt{25 \\times 2} = 5\\sqrt{2}$.",
      "For a missing edge, subtract the squares of the known edges from $d^2$, then take the square root.",
    ],
    watch:
      "Add the squares of the three edges, not the edges themselves, and take one square root at the end.",
    principle:
      "A rectangular box with edges $\\ell$, $w$ and $h$ has space diagonal $d = \\sqrt{\\ell^2 + w^2 + h^2}$. It comes from using the Pythagorean theorem twice: across the floor, then up. A cube with edge $a$ has $d = \\sqrt{3a^2} = a\\sqrt{3}$.",
    parentGuide:
      "Use a real box. Stretch a string from one bottom corner to the opposite top corner, and compare its length with the answer.",
  },
  "circle-segment-lengths": {
    goal: "Use products of chord, secant and tangent pieces, and the radius at a right angle to a tangent, to find lengths and slopes.",
    summary:
      "A chord is a straight piece joining two points on a circle. When two chords cross inside a circle, multiply the two pieces of each chord: the two results, called products, are equal. With pieces 2 and 6 on one chord and 3 and 4 on the other, $2 \\times 6 = 3 \\times 4 = 12$. The same idea works for lines that meet outside the circle.",
    objectives: [
      "Find a missing length from crossing chords, two secants, or a tangent and a secant.",
      "Find the slope of a tangent line from the radius to the point where it touches.",
    ],
    intuition:
      "A circle is all the points at one distance from one point. That point is called the center, and the distance is called the radius. A chord is a segment with both ends on the circle. A secant is a line that crosses the circle at two points. A tangent line is a line that touches the circle at exactly one point, called the point of tangency. Where two such lines meet, multiply the two pieces of each line, measured from the meeting point. The two products, the results of multiplying, are equal. Slope means how steep a line is: rise ÷ run. Lines that meet at a right angle, a square corner, are called perpendicular.",
    explain: {
      title: "Pieces that multiply to the same number",
      paragraphs: [
        "Two chords that cross inside the circle: each chord is cut into two pieces. The product of one chord's pieces equals the product of the other's. If one chord has pieces 2 and 6, and the other has pieces 3 and $x$, then $3x = 12$ and $x = 4$.",
        "Two secants from a point $P$ outside the circle: on each one, measure the outside piece, from $P$ to the near crossing. Also measure the whole secant, from $P$ to the far crossing. Outside piece times whole secant is the same for both lines.",
        "A tangent from $P$ touches the circle once, so its outside piece and its whole length are the same segment $PT$. Then $PT \\times PT = PA \\times PB$ for any secant from $P$. Squared means multiplied by itself, and we write $PT^2$ for $PT \\times PT$. With $PA = 4$ and $PB = 9$, $PT^2 = 36$, so $PT = 6$.",
        "A tangent line makes a right angle with the radius drawn to the point of tangency. A fraction's reciprocal is the fraction flipped upside down. On a grid, the slope of one perpendicular line is the negative reciprocal of the other's: flip the fraction and change its sign. A radius with slope $\\frac{12}{-5}$ has a tangent with slope $\\frac{5}{12}$.",
      ],
    },
    senses: {
      tangent: "tangent-line",
      center: "center",
      product: "product-multiply",
      square: "square-shape",
      squared: "square-number",
    },
    noLink: ["plane"],
    terms: ["chord", "secant", "tangent-line"],
    method: [
      "Find the pieces, measured from the point where the lines meet. For crossing chords, use the two pieces of each chord. For lines from an outside point, use the outside piece and the whole secant, out to the far crossing.",
      "Set the products equal and solve: $a \\times b = c \\times d$ for chords, $PA \\times PB = PC \\times PD$ for two secants, and $PT^2 = PA \\times PB$ for a tangent and a secant. If asked for the chord inside the circle, subtract the outside piece from the whole secant.",
      "For a tangent's slope, find the slope of the radius to the point of tangency, then take its negative reciprocal, the fraction flipped with its sign changed. A horizontal radius gives an upright tangent, whose slope is undefined. An upright radius gives a horizontal tangent, with slope 0.",
    ],
    watch:
      "Use the whole secant, from the outside point to the far crossing, not only the part inside the circle. For a tangent's slope, do not use the radius's slope itself.",
    principle:
      "If chords $AB$ and $CD$ cross at $E$, then $AE \\times EB = CE \\times ED$. If two secants from $P$ meet the circle at $A$ and $B$, and at $C$ and $D$, with $A$ and $C$ nearer to $P$, then $PA \\times PB = PC \\times PD$. If $PT$ is tangent at $T$ and a secant from $P$ meets the circle at $A$ then $B$, then $PT^2 = PA \\times PB$. A tangent is perpendicular to the radius at the point of tangency. Two perpendicular lines, neither horizontal nor upright, have slopes $m_1$ and $m_2$ with $m_1 \\times m_2 = -1$.",
    parentGuide:
      "Draw a circle and two crossing chords. Measure the four pieces with a ruler and check that the two products come out nearly equal.",
  },
  "frequency-table-center": {
    goal: "Find or compare a mean or median when the data come as a frequency table, as weights, or as a changed list.",
    summary:
      "A frequency table lists each value once, with how many times it appears. The mean is the total of all the data divided by how many values there are. The median is the middle value when all the data are put in order. For the scores 2, 2, 2, 5, 9, the table says “2 appears 3 times”. The mean is $20 \\div 5 = 4$, and the median is 2.",
    objectives: [
      "Find the mean and the median from a frequency table.",
      "Find a weighted mean, and the new mean after a value is added or removed.",
    ],
    intuition:
      "Data are the numbers you collect, and each one is a value. A frequency is how many times a value appears. The mean is the total of all the values divided by how many values there are. The median is the middle value once the values are in order from least to greatest. A weighted mean is a mean that counts some values more than others, such as a test that counts twice.",
    explain: {
      title: "Each row stands for many values",
      paragraphs: [
        "In a frequency table, the row “value 2, frequency 3” stands for three 2s. To find the total, multiply each value by its frequency and add: $2 \\times 3 + 5 \\times 1 + 9 \\times 1 = 20$. The number of values is the sum of the frequencies: $3 + 1 + 1 = 5$.",
        "For the median, count through the frequencies in order. With 5 values, the middle one is the 3rd. The first three values are all 2, so the median is 2. With an even count, the median is the mean of the two middle values.",
        "Removing or adding a value changes both the total and the count. If 4 numbers have a mean of 32, their total is $4 \\times 32 = 128$. Remove 17: the new total is $128 - 17 = 111$ for 3 numbers, and the new mean is $111 \\div 3 = 37$.",
      ],
    },
    senses: { mean: "mean-average" },
    terms: ["frequency", "weighted-mean", "median"],
    method: [
      "For a mean from a table, multiply each value by its frequency and add. Add the frequencies to get the count. Divide the first sum by the count.",
      "For a median, count through the frequencies from the least value until you reach the middle position, or the two middle positions.",
      "For a weighted mean or a mean of two groups, multiply each mean by its weight or group size, add, and divide by the total weight or count. When a value is added or removed, find the new total and count first.",
    ],
    watch:
      "Do not average the listed values without their frequencies. Do not average two group means as if the groups were the same size.",
    principle:
      "For values $x_1, x_2, \\ldots$ with frequencies $f_1, f_2, \\ldots$, the mean is $\\frac{x_1 f_1 + x_2 f_2 + \\cdots}{f_1 + f_2 + \\cdots}$. The small numbers match each value with its frequency, and $x_1 f_1$ means $x_1$ times $f_1$. Since mean = total ÷ count, the total is the count times the mean. Adding a value above the mean raises the mean, and a value below lowers it. A value equal to the mean leaves it unchanged.",
    parentGuide:
      "Write a short list of scores with repeats, make its frequency table together, and check that both give the same mean.",
  },
  "independence-test": {
    goal: "Decide from a two-way table whether two events are independent, and read “given” probability statements correctly.",
    summary:
      "Two events are independent when knowing that one happened does not change the chance of the other. A two-way table, a table that sorts people by two questions at once, lets you check. Suppose 30% of all students play a sport, and 30% of band members play a sport too. Then being in the band tells you nothing about playing a sport, so the two events are independent.",
    objectives: [
      "Find a probability inside one group of a two-way table, and compare it with the overall probability.",
      "Read a statement such as $P(A \\mid B) = 0.2$ in words.",
    ],
    intuition:
      "An event is a result that may or may not happen, such as “plays a sport”. Probability means chance: a number from 0 to 1, written $P(A)$ for an event $A$. An outcome is one possible result, such as one student chosen. A conditional probability is a chance inside a smaller group. We write $P(A \\mid B)$, read “the probability of $A$ given $B$”: among the outcomes in $B$, the share that are also in $A$. Events $A$ and $B$ are independent when $P(A \\mid B) = P(A)$.",
    explain: {
      title: "Compare a share inside a group with the overall share",
      paragraphs: [
        "A two-way table counts people by two questions, one along the rows and one along the columns. Suppose 200 students say whether they are in the band and whether they play a sport. If 60 of the 200 play a sport, then $P(\\text{sport}) = \\frac{60}{200} = 0.3$.",
        "Now look only at the band row. If 15 of the 50 band members play a sport, then $P(\\text{sport} \\mid \\text{band}) = \\frac{15}{50} = 0.3$. The share inside the band is the same as overall, so the events are independent.",
        "If the shares differ, the events are dependent, which means not independent. The group named after the bar is the one you divide by. So $P(B \\mid A)$ divides by the count in $A$, and it is usually different from $P(A \\mid B)$.",
      ],
    },
    senses: { event: "event" },
    noLink: ["mean", "average", "averages", "sorts"],
    terms: [
      [
        "independent-events",
        "To test it, check whether $P(A \\mid B) = P(A)$.",
      ],
      "conditional-probability",
      [
        "mutually-exclusive",
        "This is a different idea from independent events.",
      ],
    ],
    method: [
      "Find the overall share for one event: its total divided by the grand total.",
      "Find the share of that event inside each group, a row or a column. Divide by the group's total, not the grand total.",
      "Compare. Equal shares mean the events are independent. Unequal shares mean they are not, and the larger share shows where the event is more likely.",
      "For the count expected if the events were independent, multiply the two overall probabilities, then the total number of people. To read $P(A \\mid B) = p$, say: among those in $B$, a share $p$ are in $A$.",
    ],
    watch:
      "Divide by the group named after the bar. $P(A \\mid B)$ and $P(B \\mid A)$ are usually different, and events that overlap can still be dependent.",
    principle:
      "Events $A$ and $B$, with $P(B) > 0$ (greater than 0), are independent exactly when $P(A \\mid B) = P(A)$. This is the same as $P(A \\text{ and } B) = P(A) \\times P(B)$. Mutually exclusive means that two events cannot both happen. Such events are never independent when both have a probability greater than 0.",
    parentGuide:
      "Make a small two-way table from family or class data. Ask whether the share in one row matches the share overall, and what that says about the two questions.",
  },
};
const furtherPitfalls: Record<string, string> = {
  "trig-context-triangle":
    "Check that the answer makes sense: a leg is always shorter than the hypotenuse, and a larger angle of elevation means a steeper line.",
  "midpoint-endpoint":
    "A midpoint can have a coordinate that ends in .5, such as 3.5. Do not round it.",
  "space-diagonal":
    "The path along the edges of the box is longer than the space diagonal, which is the straight-line shortcut.",
  "circle-segment-lengths":
    "Check which piece the problem names. A secant has an outside piece, an inside chord and a whole length, and these are three different numbers.",
  "frequency-table-center":
    "A mean can be a value that does not appear in the table. The median of an even count is the mean of the two middle values.",
  "independence-test":
    "Shares that are close but not equal do not make events independent. Compare exact fractions, not shortened ones.",
};
export const satGeometryDataMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    Object.entries(instruction).map(
      ([
        id,
        {
          principle: _principle,
          summary: _summary,
          objectives: _objectives,
          explain: _explain,
          parentGuide: _parentGuide,
          ...method
        },
      ]) => [id, method],
    ),
  );
export const satGeometryDataPrinciples = Object.fromEntries(
  Object.entries(instruction).map(([id, value]) => [id, value.principle]),
);
export const satGeometryDataLessons: Lesson[] = satGeometryDataTemplates.map(
  (meta) => {
    const text = instruction[meta.id]!;
    // The worked example is generated text: link its words as the template does.
    const glossary = withTemplateGlossary(meta);
    const example = generateSatGeometryDataProblem(meta.id, "sat-reference");
    const response = example.public.response;
    const answer =
      response.kind === "choice"
        ? response.options.find((o) => o.id === example.answer)!.label
        : example.answer;
    return {
      id: meta.id,
      title: meta.title,
      summary: text.summary,
      templateIds: [meta.id],
      // The worked example is generated: read its words as the template does.
      senses: { ...glossary.glossarySenses, ...text.senses },
      noLink: [...(glossary.glossaryNoLink ?? []), ...(text.noLink ?? [])],
      includeGeneratedRepresentation: false,
      objectives: text.objectives,
      sections: [
        {
          stage: "intuition",
          title: "What the words mean",
          paragraphs: [text.intuition],
        },
        {
          stage: "intuition",
          title: text.explain.title,
          paragraphs: text.explain.paragraphs,
        },
      ],
      closingSections: [
        { stage: "method", title: "Steps", paragraphs: text.method },
        {
          stage: "formal",
          title: "Rule and conditions",
          paragraphs: [text.principle],
        },
      ],
      workedExample: {
        prompt: example.public.prompt,
        steps: example.explanation,
        answer,
        ...(response.kind === "choice"
          ? { choices: response.options.map((o) => o.label) }
          : {}),
        ...(example.public.figure ? { figure: example.public.figure } : {}),
      },
      pitfalls: [text.watch!, furtherPitfalls[meta.id]!],
      parentGuide: text.parentGuide,
    };
  },
);
