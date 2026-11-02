import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import {
  satCompletionTemplates,
  generateSatCompletionProblem,
} from "../math/sat-completion-practice";

type Instruction = ProblemMethod & { intuition: string; principle: string };
const instruction: Record<string, Instruction> = {
  "sample-mean-estimate": {
    goal: "Use a random sample average to estimate a population average or total.",
    intuition:
      "A population is the whole group of interest; a sample is the smaller group observed. A simple random sample gives every group of the chosen size an equal chance of selection. Its average can estimate the population average, with uncertainty because another sample can give a different result.",
    terms: [
      [
        "mean-average",
        "Here, the mean of the values observed in a sample, used to estimate the population mean.",
      ],
    ],
    method: [
      "Identify the sampled population and the sample mean, including its units.",
      "Use that mean to estimate the population mean. For an estimated total, multiply the average by the population size, not the sample size.",
    ],
    watch:
      "An estimate is not an exact population value. A sample total and a population total refer to different groups.",
    principle:
      "For a simple random sample from a population of size $N$, the sample mean estimates the population mean, and $N$ times the sample mean estimates its total.",
  },
  "probability-missing-count": {
    goal: "Recover an unknown count from an event probability.",
    intuition:
      "For equally likely objects, a probability is the number of favorable objects divided by the total number. If the favorable count is unknown, the total may contain that same unknown. Express both counts before solving.",
    terms: ["complement-probability"],
    method: [
      "Name the unknown event count and add the known complementary count to express the total.",
      "Set favorable count divided by total equal to the stated probability. Solve and substitute the count into the original ratio.",
    ],
    watch:
      "Do not use the complementary count alone as the denominator; the denominator counts every possible object.",
    principle:
      "With favorable count $r$, complementary count $b$, and equally likely objects, $P=r/(r+b)$. If $0<P<1$, then $r=Pb/(1-P)$.",
  },
  "standard-deviation-compare": {
    goal: "Compare spread using distances from each data set's own mean.",
    intuition:
      "The mean is the sum of the values divided by their count. Standard deviation measures spread around that mean. Large values need not have large spread: moving every value the same distance leaves their spacing unchanged.",
    terms: [
      [
        "standard-deviation",
        "Compare two data sets using the same convention: dividing by $n$ or by $n - 1$.",
      ],
    ],
    method: [
      "Find how the values and the mean change. Compare distances from each set's own mean.",
      "An equal shift leaves spread unchanged. Multiplying all values by a factor multiplies spread by its absolute value. Otherwise compare the squared distances.",
    ],
    watch:
      "Compare distances from the mean, not the size of the mean or the range alone.",
    principle:
      "Replacing every value $x$ by $ax+b$ multiplies the standard deviation by $|a|$, using the same standard-deviation convention. A shift changes no deviations from the mean.",
  },
  "sample-size-margin": {
    goal: "Explain how a larger comparable random sample affects margin of error.",
    intuition:
      "A sample is the part of a population that we observe. Different random samples give different estimates. A margin of error describes sampling uncertainty around an estimate; information from more people generally reduces that uncertainty.",
    terms: ["confidence-level"],
    method: [
      "Check that the population, random sampling method, confidence level, and quantity estimated are comparable.",
      "Under comparable conditions, choose the larger sample for a generally smaller margin of error. Keep bias separate from random sampling uncertainty.",
    ],
    watch:
      "A larger sample does not guarantee an exact answer and does not repair a biased sampling method.",
    principle:
      "For comparable simple random samples at fixed confidence level, sampling uncertainty generally decreases as sample size increases. For proportions, comparison also assumes comparable proportions and sampling fractions.",
  },
  "compound-unit-conversion": {
    goal: "Convert all dimensions of a compound measurement while preserving the quantity.",
    intuition:
      "A unit conversion changes how we count the same quantity. A square has two length dimensions; a cube has three. A rate compares two quantities, so its numerator and denominator may both need conversion.",
    terms: ["derived-unit"],
    method: [
      "Write the desired units and multiply by conversion ratios equal to one so the old units cancel.",
      "Square a length conversion for area and cube it for volume. Convert both parts of a rate; multiply power by time to obtain energy.",
    ],
    watch:
      "Do not use a length factor just once for area or volume. A denominator unit changes the rate inversely.",
    principle:
      "If one old length unit equals $k$ new length units, one old area unit equals $k^2$ new area units and one old volume unit equals $k^3$ new volume units. Conversion ratios equal to one preserve the measurement.",
  },
  "degree-radian-conversion": {
    goal: "Express the same angle in degrees or radians.",
    intuition:
      "An angle measures a turn. A full turn is 360 degrees. A radian is the turn sweeping an arc as long as the radius, so a full turn is $2\\pi$ radians. Both units describe the same turn.",
    terms: ["radian"],
    method: [
      "Use the equivalence of 180 degrees and $\\pi$ radians.",
      "For degrees to radians, multiply by $\\pi/180$. For radians to degrees, multiply by $180/\\pi$. Keep exact fractions.",
    ],
    watch:
      "Change the unit without changing the fraction of a full turn; do not invert the conversion factor.",
    principle:
      "For the same angle, $\\theta_{\\rm rad}=\\theta_{\\rm deg}\\pi/180$ and $\\theta_{\\rm deg}=180\\theta_{\\rm rad}/\\pi$.",
  },
  "unit-circle-coordinate": {
    goal: "Find an endpoint coordinate on a unit circle using a reference triangle and a quadrant.",
    intuition:
      "The unit circle is centered at the origin and has radius one. Measure an angle counterclockwise from the positive horizontal axis. Its endpoint's horizontal coordinate is cosine and its vertical coordinate is sine. A reference angle is the acute angle between the radius and the horizontal axis.",
    terms: ["quadrant"],
    method: [
      "Find the acute reference angle. A 30–60–90 triangle has side ratio $1:\\sqrt{3}:2$; a 45–45–90 triangle has ratio $1:1:\\sqrt{2}$.",
      "Divide the relevant leg by the hypotenuse to get the magnitude. Give the horizontal or vertical coordinate its quadrant sign.",
    ],
    watch:
      "Cosine is horizontal and sine is vertical. Determine the sign from the endpoint's location.",
    principle:
      "The unit-circle point at angle $\\theta$ is $(\\cos\\theta,\\sin\\theta)$. In quadrants I through IV the coordinate signs are $(+,+)$, $(-,+)$, $(-,-)$, and $(+,-)$, respectively.",
  },
  "similar-solid-volume": {
    goal: "Connect corresponding lengths and volumes of similar solids.",
    intuition:
      "Similar solids have the same shape, with every corresponding length multiplied by one scale factor. Volume counts three dimensions, so the length factor acts three times.",
    terms: ["scale-factor"],
    method: [
      "Find the ratio of corresponding lengths; cube that ratio to obtain the volume ratio.",
      "If volumes are given instead, take the positive cube root of their ratio to recover the length ratio, then scale the requested edge.",
    ],
    watch:
      "Use the same direction for both ratios. A volume ratio is the cube of a length ratio.",
    principle:
      "For similar solids with positive length scale factor $k$, areas scale by $k^2$ and volumes by $k^3$.",
  },
  "nonlinear-formula-isolate": {
    goal: "Isolate a positive quantity that appears squared in a formula.",
    intuition:
      "A formula is an equation connecting quantities. To find one quantity, undo the operations around it while preserving equality. A positive radius or speed selects the positive square root.",
    terms: ["principal-square-root"],
    method: [
      "Multiply or divide both sides by the stated nonzero factors until the squared unknown is isolated.",
      "Take the positive square root when the domain requires it. Substitute the result into the original formula to check.",
    ],
    watch:
      "Isolate the whole square first. Every factor inside a square root stays under the root until simplified validly.",
    principle:
      "If $z>0$ and $z^2=q$ with $q>0$, then $z=\\sqrt{q}$. Without the positivity restriction, the real solutions are $z=\\pm\\sqrt{q}$.",
  },
  "quadratic-context-model": {
    goal: "Build a quadratic and interpret its physically meaningful solution or maximum.",
    intuition:
      "A quadratic contains the square of an unknown. It can arise when two changing lengths are multiplied, or when a height rises and then falls. Define the unknown with units before writing the equation.",
    terms: ["vertex-parabola"],
    method: [
      "Express each quantity in terms of the unknown and translate the relationship, such as area equals length times width.",
      "Solve or find the vertex as requested. Substitute to obtain the requested quantity and reject values outside the context's domain.",
    ],
    watch:
      "A time, height, and length are different answers. Reject negative lengths and distinguish a vertex's input from its output.",
    principle:
      "For $f(x)=ax^2+bx+c$ with $a\\ne0$, the vertex input is $-b/(2a)$. If $a<0$, the maximum occurs there. With two zeros the axis of symmetry lies midway between them.",
  },
  "exponential-time-scale": {
    goal: "Interpret a growth or decay factor over its stated time interval.",
    intuition:
      "Exponential change multiplies by the same positive factor over equal time intervals. The exponent counts those intervals. Changing the time unit changes the factor per unit without changing the modeled population.",
    terms: ["initial-value"],
    method: [
      "Identify the initial value and the length of time that increases the exponent by one.",
      "Compare the model at two times one such interval apart. For a per-unit factor, take the positive root matching the interval length.",
    ],
    watch:
      "A factor for several years is not the same factor every year. Multiplicative change differs from adding a fixed amount.",
    principle:
      "For $A>0$, $b>0$, and $d>0$, $P(t)=Ab^{t/d}=A(b^{1/d})^t$ and $P(t+d)=bP(t)$. Growth has $b>1$; decay has $0<b<1$.",
  },
  "symbolic-rational-exponent": {
    goal: "Write roots as powers with fractional exponents on a positive domain.",
    intuition:
      "An exponent records repeated multiplication; a root reverses a power. A fractional exponent combines these operations. A positive base avoids sign and domain complications of roots of negative numbers.",
    terms: ["nth-root"],
    method: [
      "Write an nth root as a power with exponent $1/n$, then multiply by any exponent already on the base.",
      "A reciprocal negates the exponent. Keep the base's domain and reduce the exponent fraction.",
    ],
    watch:
      "The root index divides the power; it does not multiply it. A negative exponent means reciprocal, not a negative value.",
    principle:
      "For $x>0$ and positive integer $n$, $\\sqrt[n]{x^m}=x^{m/n}$ and $1/\\sqrt[n]{x^m}=x^{-m/n}$.",
  },
  "rational-expression-operation": {
    goal: "Combine fractions containing a variable without changing their allowed inputs.",
    intuition:
      "A rational expression is a quotient of polynomials. Like numerical fractions, these need a common denominator before addition or subtraction. A denominator cannot be zero, even if simplification cancels its factor.",
    terms: ["excluded-value"],
    method: [
      "Record excluded inputs. For addition or subtraction, rewrite both fractions over a common denominator, then combine numerators.",
      "For multiplication, multiply numerators and denominators and cancel common nonzero factors. Retain the original exclusions.",
    ],
    watch:
      "Cancel factors of a product, never terms in a sum; distribute subtraction to the entire numerator.",
    principle:
      "For nonzero $B,D$, $A/B+C/D=(AD+BC)/(BD)$, $A/B-C/D=(AD-BC)/(BD)$, and $(A/B)(C/D)=AC/(BD)$. Simplification preserves equality on the original domain.",
  },
  "nonlinear-data-model": {
    goal: "Select the model with the smallest total squared discrepancy from observations.",
    intuition:
      "A model predicts an output from an input. Real observations can differ from predictions. A residual is observed minus predicted output. Squaring prevents positive and negative discrepancies from cancelling and gives larger discrepancies more weight.",
    terms: ["sum-of-squared-residuals"],
    method: [
      "For each candidate, predict the output at every observed input and subtract from the observation.",
      "Square each residual and add. Choose the smallest total; check that every observation was included.",
    ],
    watch:
      "Compare the candidates using every point. A good fit is not proof of causation or accurate distant predictions.",
    principle:
      "For observations $(x_i,y_i)$, the squared-error total for model $f$ is $\\sum_i(y_i-f(x_i))^2$. Among supplied candidates, the smallest total is the least-squares choice.",
  },
  "quadratic-parameter-root": {
    goal: "Find a coefficient that gives a quadratic exactly one distinct real root.",
    intuition:
      "A quadratic graph can cross the horizontal axis twice, touch it once, or miss it. A single distinct root occurs when the graph just touches the axis, so the two quadratic-formula values coincide.",
    terms: ["discriminant"],
    method: [
      "Identify signed coefficients and check that the leading coefficient is nonzero. Set the discriminant equal to zero.",
      "Solve for the unknown coefficient and substitute it back. Verify a repeated root.",
    ],
    watch:
      "Square the signed linear coefficient and keep the factor $4a$ when solving for the constant coefficient.",
    principle:
      "For real coefficients and $a\\ne0$, $ax^2+bx+c=0$ has exactly one distinct real root if and only if $b^2-4ac=0$. Its root is $-b/(2a)$.",
  },
  "rational-function-representation": {
    goal: "Connect a fractional rule with input-output pairs while respecting its excluded input.",
    intuition:
      "A function assigns an output to each allowed input. A variable denominator can exclude an input where the denominator is zero. A table gives sample pairs, which can be checked by substitution.",
    terms: ["domain"],
    method: [
      "Exclude any input making a zero denominator. Substitute a table input into each proposed rule and compare outputs.",
      "To recover an input, undo the outside addition before solving the fraction equation. Check in the original rule.",
    ],
    watch:
      "Apply the denominator shift before dividing and the outside shift afterward. A table need not list the excluded input for the restriction to apply.",
    principle:
      "For $a\\ne0$, $f(x)=a/(x-h)+k$ has domain $x\\ne h$. For output $y\\ne k$, its input is $x=h+a/(y-k)$; output $k$ is impossible.",
  },
};
const furtherPitfalls: Record<string, string> = {
  "standard-deviation-compare":
    "A larger range alone need not imply a larger standard deviation; the other values and their distances also matter.",
  "sample-size-margin":
    "Changing the confidence level, sampling method, or population can invalidate a comparison based only on sample size.",
  "compound-unit-conversion":
    "Watts measure power; watt-hours measure energy. Multiply power by time, rather than dividing by time.",
  "degree-radian-conversion":
    "Keep the exact multiple of $\\pi$ unless a decimal approximation is requested.",
  "unit-circle-coordinate":
    "Use the acute reference angle for a special triangle, then return to the original angle's quadrant.",
  "similar-solid-volume":
    "The solids must be similar. A volume ratio alone does not determine an edge ratio for unrelated shapes.",
  "nonlinear-formula-isolate":
    "The domain chooses the positive root here; an unrestricted algebraic variable could also have a negative root.",
  "quadratic-context-model":
    "Check the result in the original area or height relationship and use the units of the quantity requested.",
  "exponential-time-scale":
    "The initial value comes from time zero and stays the same when the time interval is rewritten.",
  "symbolic-rational-exponent":
    "The positive-base assumption matters. Even roots of negative real numbers are outside the real domain.",
  "rational-expression-operation":
    "A factor cancelled during simplification still excludes its original zero from the domain.",
  "nonlinear-data-model":
    "Reversing the residual sign leaves its square unchanged, but changes its interpretation as overprediction or underprediction.",
  "quadratic-parameter-root":
    "A zero leading coefficient gives a linear equation; the quadratic discriminant test assumes a nonzero leading coefficient.",
  "rational-function-representation":
    "In the denominator $x-h$, a positive $h$ moves the vertical gap to the right, not left.",
  "sample-mean-estimate":
    "Use population size for a population total. Sample size gives only an estimated total for the sampled group.",
  "probability-missing-count":
    "Check that the recovered count is nonnegative and that the favorable count divided by the full total reproduces the probability.",
};
export const satCompletionMethods: Record<string, ProblemMethod> = instruction;
export const satCompletionPrinciples = Object.fromEntries(
  Object.entries(instruction).map(([id, value]) => [id, value.principle]),
);
export const satCompletionLessons: Lesson[] = satCompletionTemplates.map(
  (meta) => {
    const text = instruction[meta.id]!;
    const example = generateSatCompletionProblem(meta.id, "sat-reference");
    const response = example.public.response;
    const answer =
      response.kind === "choice"
        ? response.options.find((o) => o.id === example.answer)!.label
        : example.answer;
    return {
      id: meta.id,
      title: meta.title,
      summary: text.intuition,
      templateIds: [meta.id],
      includeGeneratedRepresentation: false,
      objectives: [text.goal, text.method[0]!],
      sections: [],
      closingSections: [
        { stage: "method", title: meta.title, paragraphs: text.method },
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
      parentGuide:
        "Ask the learner to identify the givens, the requested quantity, and the reason each step preserves the relationship.",
    };
  },
);
