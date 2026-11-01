import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const trigonometryMethods: Record<string, ProblemMethod> = {
  "special-angle-exact-value": {
    goal: "For a special angle in degrees or radians, find the exact sine, cosine or tangent, or where its terminal side meets the unit circle.",
    intuition:
      "The unit circle has radius 1. An angle $\\theta$ starts on the positive $x$-axis and turns counterclockwise (or clockwise if negative). Where it stops, the point on the circle is $(\\cos\\theta,\\sin\\theta)$. The size of each coordinate depends only on the acute angle between the terminal side and the $x$-axis; the quadrant decides the signs.",
    terms: ["terminal-side", "reference-angle", "coterminal-angles"],
    method: [
      "Subtract or add whole turns so the angle is between $0$ and a full turn.",
      "Name the quadrant and find the reference angle. On an axis, read the point $(\\pm1,0)$ or $(0,\\pm1)$ directly.",
      "Take the size from the reference angle: $\\sin$ and $\\cos$ use $\\frac12$, $\\frac{\\sqrt2}{2}$, $\\frac{\\sqrt3}{2}$; $\\tan$ uses $\\frac{\\sqrt3}{3}$, $1$, $\\sqrt3$.",
      "Give the value the sign of that function in the quadrant. Tangent is undefined where $x=0$.",
    ],
    watch:
      "Measure the reference angle from the $x$-axis, never from the $y$-axis. On the $y$-axis the $x$-coordinate is 0, so tangent is undefined there, not 0.",
  },
  "trig-symmetry-value": {
    goal: "Given one value of $\\sin\\theta$ or $\\cos\\theta$, find the value of the function at $-\\theta$, $\\pi\\pm\\theta$ or $\\theta$ plus whole turns.",
    intuition:
      "On the unit circle the angle $\\theta$ marks a point $(\\cos\\theta,\\sin\\theta)$. Turning the angle to $-\\theta$ reflects the point across the $x$-axis. Adding $\\pi$ moves it to the opposite side of the circle. Adding $2\\pi$ returns to the same point. Each move changes the coordinates in a simple, predictable way.",
    terms: [
      ["odd-function", "Sine and tangent are odd."],
      ["even-function", "Cosine is even: $\\cos(-x)=\\cos x$."],
      [
        "period",
        "Sine and cosine repeat every $2\\pi$; tangent repeats every $\\pi$.",
      ],
    ],
    method: [
      "Write the new angle as $\\pm\\theta$ plus a multiple of $\\pi$.",
      "Reflection: $\\sin(-\\theta)=-\\sin\\theta$, $\\cos(-\\theta)=\\cos\\theta$. Each odd multiple of $\\pi$ reverses the sign of sine and cosine; even multiples change nothing.",
      "If the question asks for the other function, find it from $\\sin^2\\theta+\\cos^2\\theta=1$ and the stated quadrant before applying the rule.",
    ],
    watch:
      "Sine and cosine do not both change sign under reflection. Test the rule on a point: if $\\theta$ is in quadrant I, the reflected point is in quadrant IV, where the $y$-coordinate is negative but the $x$-coordinate is the same.",
  },
  "sinusoid-parameters": {
    goal: "Read amplitude, period, midline, extreme values or horizontal shift from $y=A\\sin(B(x-h))+k$, or choose the equation of a graph.",
    intuition:
      "The graph of $y=\\sin x$ rises and falls between $-1$ and $1$ and repeats every $2\\pi$. Each constant in $y=A\\sin(B(x-h))+k$ changes one feature: $A$ stretches the height, $B$ squeezes the width, $h$ slides the graph sideways and $k$ lifts it.",
    terms: [
      ["amplitude", "In $y=A\\sin(B(x-h))+k$ it is $|A|$."],
      ["midline", "In $y=A\\sin(B(x-h))+k$ it is $y=k$."],
      "period",
      [
        "phase-shift",
        "In $y=A\\sin(B(x-h))+k$ it is $h$: to the right when $h>0$.",
      ],
    ],
    method: [
      "Amplitude $|A|$ is the coefficient of the sine; a negative sign only reflects the curve. Midline is $y=k$.",
      "Period is $\\frac{2\\pi}{B}$. From a graph, measure one full cycle and set $B=\\frac{2\\pi}{\\text{period}}$.",
      "For a shift, factor $B$ out of the bracket: $Bx-c=B\\left(x-\\frac{c}{B}\\right)$, so the shift is $\\frac{c}{B}$.",
      "Maximum $=k+|A|$ and minimum $=k-|A|$.",
    ],
    watch:
      "The shift is the number subtracted from $x$ after factoring out $B$, not the constant inside before factoring. A plus sign inside the bracket means a shift to the left.",
  },
  "inverse-trig-value": {
    goal: "Evaluate $\\arcsin$, $\\arccos$ or $\\arctan$ at a special value, or an expression built from them.",
    intuition:
      "Many angles have the same sine, so the sine function has no inverse until we agree on one interval of angles. $\\arcsin v$ answers: which angle in that agreed interval has sine $v$? The same idea defines $\\arccos$ and $\\arctan$ on their own intervals.",
    terms: [
      [
        "range-function",
        "For arcsin, the outputs are the angles from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
      ],
      "inverse-trig-function",
      [
        "range-function",
        "For arccos, the outputs are the angles from 0 to $\\pi$.",
      ],
      "inverse-trig-function",
      [
        "range-function",
        "For arctan, the outputs are the angles strictly between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
      ],
      "inverse-trig-function",
    ],
    method: [
      "State the range of the inverse function you need.",
      "Find the reference angle whose function has the size of the given value.",
      "Place it in the range: negative arcsin and arctan values give negative angles; arccos of a negative value gives an angle in quadrant II.",
      "For $\\arcsin(\\sin x)$ with $x$ outside the range, first evaluate the inside, then find the angle in the range with that value.",
    ],
    watch:
      "$\\arcsin(\\sin x)=x$ only when $x$ is in $\\left[-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right]$. For $x=\\frac{5\\pi}{6}$ the answer is $\\frac{\\pi}{6}$, which has the same sine.",
  },
  "trig-equation-solutions": {
    goal: "Find all solutions of a simple trigonometric equation on $0\\le x<2\\pi$ (or $0^\\circ\\le x<360^\\circ$), or count them.",
    intuition:
      "A trigonometric equation asks which angles have a given sine, cosine or tangent. Because the unit circle repeats, one value usually occurs at two places in each turn. The interval tells how many turns to search.",
    terms: [
      [
        "solution-set",
        "Here, every angle in the stated interval that makes the equation true.",
      ],
      [
        "interval-notation",
        "$[0,2\\pi)$ includes 0 but not $2\\pi$, so the same angle is not counted twice.",
      ],
    ],
    method: [
      "Isolate $\\sin x$, $\\cos x$ or $\\tan x$.",
      "Find the reference angle from the size of the value. If the value is outside $[-1,1]$ for sine or cosine, there is no solution.",
      "Use the sign to choose quadrants: two angles per turn, except at $\\pm1$ (one angle). Tangent repeats every $\\pi$.",
      "For $\\sin(2x)$ or $\\cos(2x)$, solve for $2x$ over $[0,4\\pi)$, then halve.",
    ],
    watch:
      "Check the endpoints. $\\cos x=1$ has the solution $x=0$ once on $[0,2\\pi)$; $2\\pi$ is not in the interval. A double angle $2x$ doubles the number of solutions.",
  },
  "trig-identity-value": {
    goal: "Use $\\sin^2\\theta+\\cos^2\\theta=1$ with a quadrant, the angle-sum formulas for exact values, or $\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$.",
    intuition:
      "A point $(\\cos\\theta,\\sin\\theta)$ lies on the unit circle, so its coordinates satisfy $x^2+y^2=1$. That is the Pythagorean identity. When two angles are added, the new point is found from the points of the two parts, which gives the sum formulas.",
    terms: ["identity-equation", "cofunction-identity"],
    method: [
      "Pythagorean: solve $\\sin^2\\theta+\\cos^2\\theta=1$ for the missing size, take the square root, and choose the sign from the quadrant. Then $\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}$.",
      "Angle sum: write the angle as a sum or difference of special angles and use $\\sin(A\\pm B)=\\sin A\\cos B\\pm\\cos A\\sin B$, $\\cos(A\\pm B)=\\cos A\\cos B\\mp\\sin A\\sin B$.",
      "Cofunction: $\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$; subtract from $\\frac{\\pi}{2}$.",
    ],
    watch:
      "Taking a square root gives two signs; do not skip the quadrant. In $\\cos(A+B)$ the product terms are subtracted, in $\\sin(A+B)$ they are added.",
  },
  "oblique-triangle-solve": {
    goal: "Use the law of sines or the law of cosines to find a side or angle of a non-right triangle, or count triangles in the SSA case.",
    intuition:
      "In any triangle the longest side is across from the largest angle. The law of sines says side lengths are proportional to the sines of the opposite angles. The law of cosines extends the Pythagorean theorem with a correction for the angle between two sides.",
    terms: ["oblique-triangle", "ssa"],
    method: [
      "Law of sines: $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}$, when an angle and its opposite side are known.",
      "Law of cosines: $c^2=a^2+b^2-2ab\\cos C$, for two sides and the included angle, or $\\cos C=\\frac{a^2+b^2-c^2}{2ab}$ for three sides.",
      "SSA: compute the height $h=b\\sin A$. For acute $A$: $a<h$ gives none, $a=h$ one right triangle, $h<a<b$ two, $a\\ge b$ one. For obtuse $A$: one if $a>b$, otherwise none.",
      "Round only at the end, and use degree mode for degree angles.",
    ],
    watch:
      "Pair each side with the angle across from it. Inverse sine returns only acute angles, so the obtuse supplement is a second possibility only when the side opposite the unknown angle is not the longest.",
  },
  "trig-triangle-area": {
    goal: "Find the area of a triangle from two sides and the angle between them, or find a side from the area.",
    intuition:
      "The area of a triangle is half its base times its height. If $a$ is the base and $b$ is another side meeting it at angle $C$, the height is $b\\sin C$. So the area is $\\frac12ab\\sin C$.",
    terms: ["included-angle"],
    method: [
      "Identify the two sides and the angle between them.",
      "Compute $\\frac12ab\\sin C$ with the exact or rounded value of $\\sin C$.",
      "To find a side, solve $A=\\frac12ab\\sin C$ for it: multiply by 2, then divide by the other side and $\\sin C$.",
    ],
    watch:
      "An angle and its supplement have the same sine, so an obtuse included angle gives the same area as its acute partner. Use sine, not cosine.",
  },
  "sinusoid-model": {
    goal: "From a maximum, minimum, period and starting position, build or use a model $h(t)=A\\cos(Bt)+k$ or $A\\sin(Bt)+k$.",
    intuition:
      "Tides, wheels and springs repeat. A sinusoid models them: it swings equally above and below a middle level. Three facts fix the model: how high and low it goes, how long one cycle takes, and where it starts.",
    terms: ["midline", "amplitude"],
    method: [
      "Midline $k=\\frac{\\max+\\min}{2}$; amplitude $A=\\frac{\\max-\\min}{2}$; $B=\\frac{2\\pi}{\\text{period}}$.",
      "Choose the form from the start: maximum at $t=0$ gives $+A\\cos$; minimum gives $-A\\cos$; midline moving up gives $+A\\sin$.",
      "To use the model, compute $Bt$ first, then the trigonometric value, then multiply and add $k$.",
    ],
    watch:
      "The amplitude is not the maximum value, and $B$ is not the period. Check the model at $t=0$: it must give the stated starting value.",
  },
};

export const trigonometryPrinciples: Record<string, string> = {
  "special-angle-exact-value":
    "For an angle $\\theta$ in standard position, the terminal side meets the unit circle at $(\\cos\\theta,\\sin\\theta)$ and $\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}$ when $\\cos\\theta\\ne0$. The values for reference angles $30^\\circ$, $45^\\circ$ and $60^\\circ$ come from the $30$-$60$-$90$ and $45$-$45$-$90$ triangles, and the signs from the quadrant.",
  "trig-symmetry-value":
    "Reflection across the $x$-axis gives $\\sin(-\\theta)=-\\sin\\theta$ and $\\cos(-\\theta)=\\cos\\theta$. A half turn gives $\\sin(\\theta+\\pi)=-\\sin\\theta$ and $\\cos(\\theta+\\pi)=-\\cos\\theta$. Also $\\sin(\\pi-\\theta)=\\sin\\theta$, $\\cos(\\pi-\\theta)=-\\cos\\theta$, and sine and cosine have period $2\\pi$.",
  "sinusoid-parameters":
    "For $y=A\\sin(B(x-h))+k$ with $B>0$: amplitude $|A|$, period $\\frac{2\\pi}{B}$, midline $y=k$, horizontal shift $h$, maximum $k+|A|$ and minimum $k-|A|$. A negative $A$ reflects the graph across its midline.",
  "inverse-trig-value":
    "$\\arcsin$ is the inverse of $\\sin$ restricted to $\\left[-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right]$, $\\arccos$ of $\\cos$ restricted to $[0,\\pi]$, and $\\arctan$ of $\\tan$ restricted to $\\left(-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right)$. Each restriction makes the function one-to-one, so $\\sin(\\arcsin v)=v$ for $|v|\\le1$, but $\\arcsin(\\sin x)=x$ only on the restricted interval.",
  "trig-equation-solutions":
    "If $|v|\\le1$, then $\\sin x=v$ has solutions $x=\\alpha+2\\pi n$ and $x=\\pi-\\alpha+2\\pi n$, where $\\alpha=\\arcsin v$. Similarly $\\cos x=v$ has $x=\\pm\\arccos v+2\\pi n$, and $\\tan x=v$ has $x=\\arctan v+\\pi n$. The solutions in a stated interval are the values of $n$ that place $x$ inside it.",
  "trig-identity-value":
    "For every angle, $\\sin^2\\theta+\\cos^2\\theta=1$, because $(\\cos\\theta,\\sin\\theta)$ is on the unit circle. Also $\\sin(A\\pm B)=\\sin A\\cos B\\pm\\cos A\\sin B$, $\\cos(A\\pm B)=\\cos A\\cos B\\mp\\sin A\\sin B$ and $\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$.",
  "oblique-triangle-solve":
    "In triangle $ABC$ with sides $a,b,c$ opposite $A,B,C$: $\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}$ and $c^2=a^2+b^2-2ab\\cos C$. The law of sines can give two triangles when two sides and a non-included angle are known and $b\\sin A<a<b$ with $A$ acute.",
  "trig-triangle-area":
    "A triangle with sides $a$ and $b$ and included angle $C$ has area $\\frac12ab\\sin C$, because $b\\sin C$ is the height above side $a$. Since $\\sin(180^\\circ-C)=\\sin C$, supplementary included angles give equal areas.",
  "sinusoid-model":
    "A quantity with maximum $M$, minimum $m$ and period $P$ is modeled by $A\\cos(Bt)+k$ or $A\\sin(Bt)+k$ with $A=\\frac{M-m}{2}$, $k=\\frac{M+m}{2}$ and $B=\\frac{2\\pi}{P}$. The sign and the choice of sine or cosine match the value and direction at $t=0$.",
};

const lesson = (
  id: string,
  title: string,
  summary: string,
  objectives: string[],
  intuitionTitle: string,
  intuition: string[],
  example: { prompt: string; steps: string[]; answer: string },
  methodTitle: string,
  methodText: string[],
  formalTitle: string,
  formal: string[],
  pitfalls: string[],
  parentGuide: string,
): Lesson => ({
  id,
  title,
  summary,
  templateIds: [id],
  objectives,
  sections: [
    { stage: "intuition", title: intuitionTitle, paragraphs: intuition },
  ],
  workedExample: example,
  closingSections: [
    {
      stage: "method",
      keepTogetherInPrint: true,
      title: methodTitle,
      paragraphs: methodText,
    },
    { stage: "formal", title: formalTitle, paragraphs: formal },
  ],
  pitfalls,
  parentGuide,
});

export const trigonometryLessons: Lesson[] = [
  lesson(
    "special-angle-exact-value",
    "Exact values at special angles",
    "A reference angle of $30^\\circ$, $45^\\circ$ or $60^\\circ$ gives the size of sine, cosine or tangent; the quadrant gives the sign.",
    [
      "Find the quadrant and reference angle of an angle in degrees or radians.",
      "Write the exact value, including angles on an axis where tangent is undefined.",
    ],
    "The unit circle gives every angle a point",
    [
      "You need to recall the sides of a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle and a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle. The unit circle has radius 1. An angle $\\theta$ turns counterclockwise from the positive $x$-axis, and the point where it stops on the circle is $(\\cos\\theta,\\sin\\theta)$. Radians measure the turn by arc length: $\\pi$ radians is a half turn.",
      "Inside the first quadrant, the triangle made by the point, the $x$-axis and the origin has hypotenuse 1, so its legs are the cosine and sine. Other quadrants reuse the same triangle, reflected, so only the signs change.",
    ],
    {
      prompt: "Find the exact value of $\\sin\\left(\\frac{5\\pi}{6}\\right)$.",
      steps: [
        "$\\frac{5\\pi}{6}=150^\\circ$, between $90^\\circ$ and $180^\\circ$, so the terminal side is in quadrant II.",
        "The reference angle is $\\pi-\\frac{5\\pi}{6}=\\frac{\\pi}{6}$, that is $30^\\circ$.",
        "At the reference angle, $\\sin\\frac{\\pi}{6}=\\frac12$.",
        "In quadrant II the $y$-coordinate is positive, so sine is positive. Check: the point is $\\left(-\\frac{\\sqrt3}{2},\\frac12\\right)$, and $\\left(-\\frac{\\sqrt3}{2}\\right)^2+\\left(\\frac12\\right)^2=1$.",
      ],
      answer: "$\\frac12$",
    },
    "From angle to exact value",
    [
      "Reduce the angle by whole turns, name the quadrant and take the reference angle. The sizes are $\\frac12,\\frac{\\sqrt2}{2},\\frac{\\sqrt3}{2}$ for $30^\\circ,45^\\circ,60^\\circ$ in sine (reversed for cosine), and $\\frac{\\sqrt3}{3},1,\\sqrt3$ in tangent.",
      "Signs: sine is positive in quadrants I and II, cosine in I and IV, tangent in I and III. On an axis the point is $(\\pm1,0)$ or $(0,\\pm1)$; tangent is undefined where the $x$-coordinate is 0.",
    ],
    "Why the signs and sizes work",
    [
      "A reflection across an axis keeps distances, so the reference angle gives the same lengths of coordinates. The sign of each coordinate is the sign of the position on its axis. Since $\\tan\\theta=\\frac{y}{x}$, it is undefined exactly when $x=0$, at $\\frac{\\pi}{2}+n\\pi$.",
    ],
    [
      "Measure the reference angle from the $x$-axis, not the $y$-axis.",
      "Reduce angles larger than a full turn before choosing the quadrant.",
      "Tangent at $90^\\circ$ and $270^\\circ$ is undefined, not 0.",
    ],
    "Ask the learner to say the quadrant and the reference angle of $\\frac{7\\pi}{6}$ before giving any value.",
  ),
  lesson(
    "trig-symmetry-value",
    "Unit-circle symmetry",
    "Reflecting, half-turning or fully turning an angle changes a sine or cosine value in a predictable way.",
    [
      "Use odd and even symmetry and periodicity of sine and cosine.",
      "Find a value of a related angle from one given value.",
    ],
    "Moving the angle moves the point",
    [
      "You need the unit circle: angle $\\theta$ marks the point $(\\cos\\theta,\\sin\\theta)$. Replacing $\\theta$ by $-\\theta$ reflects that point across the $x$-axis, keeping the $x$-coordinate and reversing the $y$-coordinate. Adding $\\pi$ turns the point halfway around the circle, reversing both coordinates. Adding $2\\pi$ returns to the same point.",
    ],
    {
      prompt:
        "Given $\\sin\\theta=0.6$ and $\\theta$ acute, find $\\cos(\\pi-\\theta)$.",
      steps: [
        "Because $\\theta$ is acute, $\\cos\\theta>0$ and $\\cos^2\\theta=1-0.36=0.64$, so $\\cos\\theta=0.8$.",
        "The angle $\\pi-\\theta$ reflects the point across the $y$-axis: the $x$-coordinate changes sign and the $y$-coordinate stays.",
        "So $\\cos(\\pi-\\theta)=-\\cos\\theta=-0.8$.",
        "Check: $\\pi-\\theta$ is in quadrant II, where cosine is negative.",
      ],
      answer: "$-0.8$",
    },
    "Write the angle as a move",
    [
      "Write the angle as $\\pm\\theta$ plus a multiple of $\\pi$. Apply the reflection first: $\\sin(-\\theta)=-\\sin\\theta$, $\\cos(-\\theta)=\\cos\\theta$. Each added $\\pi$ reverses sine and cosine. Full turns change nothing. Tangent needs only half turns: $\\tan(\\theta+\\pi)=\\tan\\theta$.",
    ],
    "Parity and period",
    [
      "A function is odd if $f(-x)=-f(x)$ and even if $f(-x)=f(x)$. Sine is odd and cosine is even. Sine and cosine have period $2\\pi$; tangent has period $\\pi$. The supplement rules follow: $\\sin(\\pi-\\theta)=\\sin\\theta$ and $\\cos(\\pi-\\theta)=-\\cos\\theta$.",
    ],
    [
      "Do not reverse the sign of both coordinates when only reflecting across the $x$-axis.",
      "Find the other function's size from $\\sin^2\\theta+\\cos^2\\theta=1$ before using it.",
      "Tangent repeats every $\\pi$, not every $2\\pi$.",
    ],
    "Have the learner sketch the unit circle and mark $\\theta$ and $\\pi-\\theta$ before computing.",
  ),
  lesson(
    "sinusoid-parameters",
    "Amplitude, period, midline and shift",
    "In $y=A\\sin(B(x-h))+k$, $A$ sets the height, $B$ the period, $h$ the horizontal shift and $k$ the midline.",
    [
      "Read the features of a sinusoid from its equation.",
      "Choose the equation that matches a plotted sinusoid.",
    ],
    "One curve, four dials",
    [
      "You need the graph of $y=\\sin x$: it rises to 1, falls to $-1$, and repeats every $2\\pi$. A multiplier $A$ in front stretches it vertically. A multiplier $B$ inside squeezes it horizontally. Subtracting $h$ from $x$ slides it right. Adding $k$ lifts it. The horizontal line halfway between the highest and lowest points is the midline.",
    ],
    {
      prompt:
        "Find the period, amplitude and horizontal shift of $y=3\\sin\\left(2x-\\frac{\\pi}{3}\\right)+1$.",
      steps: [
        "The amplitude is the coefficient of the sine: $|3|=3$. The midline is $y=1$.",
        "The period is $\\frac{2\\pi}{B}=\\frac{2\\pi}{2}=\\pi$.",
        "Factor 2 out of the bracket: $2x-\\frac{\\pi}{3}=2\\left(x-\\frac{\\pi}{6}\\right)$, so the shift is $\\frac{\\pi}{6}$ to the right.",
        "Check: at $x=\\frac{\\pi}{6}$ the bracket is 0, so the curve is at its midline value 1 and rising.",
      ],
      answer: "period $\\pi$, amplitude 3, shift $\\frac{\\pi}{6}$ right",
    },
    "Reading the equation or the graph",
    [
      "From the equation: amplitude $|A|$; midline $y=k$; period $\\frac{2\\pi}{B}$; shift: factor $B$ out and read $x-h$. Maximum $k+|A|$, minimum $k-|A|$.",
      "From a graph: find the highest and lowest points to get midline and $|A|$, measure one cycle for the period and $B=\\frac{2\\pi}{\\text{period}}$, and see whether the curve first rises or falls from the midline at $x=0$ to choose the sign of $A$.",
    ],
    "Why a full turn is divided by the frequency factor",
    [
      "The sine repeats when its input increases by $2\\pi$. The input is $B(x-h)$, so $x$ must increase by $\\Delta x$ with $B\\,\\Delta x=2\\pi$, giving period $\\frac{2\\pi}{B}$. Replacing $x$ by $x-h$ shifts every point $h$ units right.",
    ],
    [
      "Amplitude is a distance, never negative.",
      "Factor $B$ out before reading the shift.",
      "The midline is $y=k$, not the $x$-axis unless $k=0$.",
    ],
    "Ask the learner to sketch one cycle after finding midline, amplitude and period.",
  ),
  lesson(
    "inverse-trig-value",
    "Inverse trigonometric values",
    "$\\arcsin$, $\\arccos$ and $\\arctan$ return the one angle in a standard interval that has the given value.",
    [
      "State the range of each inverse function.",
      "Evaluate inverse functions and compositions at special values.",
    ],
    "Choosing one angle from many",
    [
      "You need the unit-circle values at special angles. The value $\\frac12$ is the sine of $\\frac{\\pi}{6}$, $\\frac{5\\pi}{6}$, and many other angles. To make an inverse function, we agree on one interval where each value is used once. $\\arcsin v$ is the angle in $\\left[-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right]$ with sine $v$; $\\arccos v$ is in $[0,\\pi]$; $\\arctan v$ is in $\\left(-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right)$.",
    ],
    {
      prompt: "Find $\\arcsin\\left(\\sin\\frac{5\\pi}{6}\\right)$.",
      steps: [
        "Evaluate the inside: $\\sin\\frac{5\\pi}{6}=\\frac12$.",
        "Now find the angle in $\\left[-\\frac{\\pi}{2},\\frac{\\pi}{2}\\right]$ whose sine is $\\frac12$.",
        "That angle is $\\frac{\\pi}{6}$. The angle $\\frac{5\\pi}{6}$ has the same sine but is outside the interval.",
        "Check: $\\sin\\frac{\\pi}{6}=\\frac12$ and $\\frac{\\pi}{6}$ lies in the interval.",
      ],
      answer: "$\\frac{\\pi}{6}$",
    },
    "Find the angle in the range",
    [
      "Find the reference angle for the size of the value, then use the range to place it. For $\\arcsin$ and $\\arctan$ a negative value gives the negative reference angle. For $\\arccos$ a negative value gives $\\pi$ minus the reference angle.",
      "For $\\arcsin(\\sin x)$, $\\arccos(\\cos x)$ and $\\arctan(\\tan x)$ with $x$ outside the range, evaluate the inside first, then apply the inverse. For $\\cos(\\arcsin v)$ use the angle in the range, then evaluate.",
    ],
    "Why the restriction is needed",
    [
      "A function has an inverse only if each output comes from one input. Sine takes each value in $(-1,1)$ many times, so we restrict it to an interval on which it is increasing. Then $\\sin(\\arcsin v)=v$ for all $v\\in[-1,1]$, but $\\arcsin(\\sin x)=x$ only for $x$ in the interval.",
    ],
    [
      "$\\arcsin(\\sin x)$ is not always $x$.",
      "$\\arccos$ never returns a negative angle.",
      "$\\arcsin$ and $\\arctan$ never return angles in quadrants II or III.",
    ],
    "Ask the learner to state the allowed interval aloud before every inverse evaluation.",
  ),
  lesson(
    "trig-equation-solutions",
    "Solve trigonometric equations",
    "Isolate the function, find the reference angle, and use the sign to list every solution in the interval.",
    [
      "Find all solutions on one turn.",
      "Count solutions, including double angles and endpoints.",
    ],
    "Which angles have this value?",
    [
      "You need the unit-circle values at special angles. An equation such as $2\\sin x=\\sqrt3$ asks for the angles $x$ whose sine is $\\frac{\\sqrt3}{2}$. The sine is the height of the point on the unit circle. A given height is reached at two points of the circle, mirrored across the $y$-axis, unless it is the top or bottom, where there is one point.",
    ],
    {
      prompt: "Solve $2\\sin x=\\sqrt3$ on $0\\le x<2\\pi$.",
      steps: [
        "Isolate sine: $\\sin x=\\frac{\\sqrt3}{2}$.",
        "The reference angle with sine $\\frac{\\sqrt3}{2}$ is $\\frac{\\pi}{3}$.",
        "Sine is positive in quadrants I and II, so $x=\\frac{\\pi}{3}$ and $x=\\pi-\\frac{\\pi}{3}=\\frac{2\\pi}{3}$.",
        "Check: $2\\sin\\frac{2\\pi}{3}=2\\cdot\\frac{\\sqrt3}{2}=\\sqrt3$.",
      ],
      answer: "$x=\\frac{\\pi}{3},\\ \\frac{2\\pi}{3}$",
    },
    "List, then check the interval",
    [
      "Isolate the function and find the reference angle. For sine and cosine of a value strictly between $-1$ and $1$ there are two solutions per turn; at $\\pm1$ there is one; outside $[-1,1]$ there is none. Tangent has one solution per half turn, so two per turn.",
      "For $\\sin(2x)=v$, the angle $2x$ runs from $0$ to $4\\pi$ while $x$ runs from $0$ to $2\\pi$, so there are twice as many solutions. In a half-open interval $[0,2\\pi)$, the angle $2\\pi$ is not included.",
    ],
    "All solutions and a restricted interval",
    [
      "If $\\alpha=\\arcsin v$, then $\\sin x=v$ exactly when $x=\\alpha+2\\pi n$ or $x=\\pi-\\alpha+2\\pi n$. The solutions in an interval are those of these forms that fall in it.",
    ],
    [
      "Do not stop after the first solution.",
      "Check whether an endpoint belongs to the interval.",
      "Sine and cosine never take values larger than 1 in size.",
    ],
    "Ask the learner to mark both solution points on a unit circle before writing the angles.",
  ),
  lesson(
    "trig-identity-value",
    "Identities and angle sums",
    "The Pythagorean identity gives a missing coordinate, and angle-sum formulas build exact values at new angles.",
    [
      "Use $\\sin^2\\theta+\\cos^2\\theta=1$ with a quadrant to find sine, cosine or tangent.",
      "Use angle-sum and cofunction formulas for exact values.",
    ],
    "Coordinates on a circle",
    [
      "You need the unit circle. The point $(\\cos\\theta,\\sin\\theta)$ is on a circle of radius 1, so its coordinates satisfy $x^2+y^2=1$. If one coordinate is known, the other is found from this, up to a sign that depends on the quadrant. Adding two angles gives a point whose coordinates combine the coordinates of the parts; that gives the angle-sum formulas.",
    ],
    {
      prompt: "Find the exact value of $\\sin 75^\\circ$.",
      steps: [
        "Write $75^\\circ=45^\\circ+30^\\circ$, a sum of special angles.",
        "Use $\\sin(A+B)=\\sin A\\cos B+\\cos A\\sin B$.",
        "$\\sin75^\\circ=\\frac{\\sqrt2}{2}\\cdot\\frac{\\sqrt3}{2}+\\frac{\\sqrt2}{2}\\cdot\\frac12=\\frac{\\sqrt6}{4}+\\frac{\\sqrt2}{4}$.",
        "Check: $\\sin75^\\circ\\approx0.966$ and $\\frac{2.449+1.414}{4}\\approx0.966$.",
      ],
      answer: "$\\frac{\\sqrt6+\\sqrt2}{4}$",
    },
    "Choose the identity",
    [
      "A coordinate and a quadrant: $\\sin^2\\theta+\\cos^2\\theta=1$ gives the size of the other coordinate; the quadrant gives its sign; $\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}$.",
      "A non-special angle that is a sum or difference of special angles: use the sum or difference formula. Complementary angles: $\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$.",
    ],
    "The formulas",
    [
      "$\\sin(A\\pm B)=\\sin A\\cos B\\pm\\cos A\\sin B$ and $\\cos(A\\pm B)=\\cos A\\cos B\\mp\\sin A\\sin B$. Setting $A=B$ in cosine's difference formula gives $\\cos0=\\cos^2A+\\sin^2A=1$, the Pythagorean identity again.",
    ],
    [
      "The square root of an identity needs the sign from the quadrant.",
      "$\\cos(A+B)$ subtracts the product of sines.",
      "Common denominators multiply: $2\\cdot2=4$.",
    ],
    "Ask the learner to decide the sign of the answer from the quadrant before computing.",
  ),
  lesson(
    "oblique-triangle-solve",
    "Law of sines and law of cosines",
    "Use the law of sines when an angle and its opposite side are known, and the law of cosines for two sides and the included angle or three sides.",
    [
      "Find a side or an angle of a triangle with no right angle.",
      "Decide how many triangles fit two sides and a non-included angle.",
    ],
    "Beyond right triangles",
    [
      "You need the sine ratio of a right triangle. In any triangle with sides $a,b,c$ opposite angles $A,B,C$, the ratio of a side to the sine of the angle across from it is the same for all three. This is the law of sines. The law of cosines changes the Pythagorean theorem to $c^2=a^2+b^2-2ab\\cos C$, so that it works when $C$ is not a right angle.",
    ],
    {
      prompt:
        "In triangle $ABC$, $A=40^\\circ$, $B=65^\\circ$ and $a=12$. Find $b$ to the nearest tenth.",
      steps: [
        "Side $a$ is opposite $A$ and side $b$ is opposite $B$, so $\\frac{b}{\\sin65^\\circ}=\\frac{12}{\\sin40^\\circ}$.",
        "$b=\\frac{12\\sin65^\\circ}{\\sin40^\\circ}\\approx\\frac{12(0.9063)}{0.6428}$.",
        "$b\\approx16.9$.",
        "Check: $B>A$, so $b>a$; $16.9>12$.",
      ],
      answer: "$16.9$",
    },
    "Pick the law, then check",
    [
      "Angle plus opposite side known: law of sines. Two sides and the angle between: law of cosines for the third side. Three sides: law of cosines to find an angle. With two sides and a non-included angle, compute $h=b\\sin A$ first and compare with $a$.",
      "For an acute $A$: $a<h$ gives no triangle, $a=h$ one right triangle, $h<a<b$ two triangles and $a\\ge b$ one. For an obtuse $A$: one triangle when $a>b$, otherwise none.",
    ],
    "Why the case analysis works",
    [
      "Side $a$ must reach the line along the other side of $A$. The shortest distance from $C$ to that line is $h=b\\sin A$. When $a$ is between $h$ and $b$, the circle of radius $a$ around $C$ meets the line at two points, giving two triangles.",
    ],
    [
      "Pair each side with the angle across from it.",
      "Inverse sine gives only an acute angle; check whether an obtuse angle also fits.",
      "Keep degree mode and round only at the end.",
    ],
    "Ask the learner to label all sides and opposite angles on a sketch before choosing a law.",
  ),
  lesson(
    "trig-triangle-area",
    "Triangle area from two sides and the angle",
    "Area equals half the product of two sides times the sine of the angle between them.",
    [
      "Find area from two sides and the included angle.",
      "Find a missing side from the area.",
    ],
    "Height from an angle",
    [
      "You need area $=\\frac12\\times\\text{base}\\times\\text{height}$. Take side $a$ as the base. Side $b$ leans away from the base at angle $C$, so its vertical height above the base is $b\\sin C$. The area is therefore $\\frac12ab\\sin C$.",
    ],
    {
      prompt:
        "Two sides measure 8 and 6 units with a $30^\\circ$ angle between them. Find the area.",
      steps: [
        "The angle is between the sides, so use $\\frac12ab\\sin C$.",
        "$\\sin30^\\circ=\\frac12$.",
        "Area $=\\frac12(8)(6)\\left(\\frac12\\right)=12$.",
        "Check: the height above the base 8 is $6\\sin30^\\circ=3$, and $\\frac12(8)(3)=12$.",
      ],
      answer: "12 square units",
    },
    "Use the angle between the sides",
    [
      "Check that the angle lies between the two sides. Compute $\\frac12ab\\sin C$. To find a missing side, solve: $a=\\frac{2A}{b\\sin C}$.",
      "Two included angles that add to $180^\\circ$ have equal sines, so they give equal areas.",
    ],
    "Derivation",
    [
      "Draw the height $h$ from the vertex between $a$ and $b$ to the base. In the right triangle formed, $\\sin C=\\frac{h}{b}$, so $h=b\\sin C$. If $C$ is obtuse, the height is outside the base but $h=b\\sin(180^\\circ-C)=b\\sin C$ still holds.",
    ],
    [
      "Use sine of the included angle, not cosine.",
      "Keep the factor $\\frac12$.",
      "The angle must be between the two known sides.",
    ],
    "Ask the learner to say which angle lies between the two given sides.",
  ),
  lesson(
    "sinusoid-model",
    "Build a periodic model",
    "The maximum, minimum and period fix the midline, amplitude and $B$ of a sinusoid; the starting position fixes the form.",
    [
      "Find amplitude, midline and $B$ from context.",
      "Choose sine or cosine and use the model.",
    ],
    "Repeating quantities",
    [
      "You need the features of a sinusoid: midline, amplitude and period. A tide, a Ferris wheel and a bobbing buoy repeat. Each swings equally above and below a middle level, so the highest and lowest values give the midline (their average) and the amplitude (half their difference).",
    ],
    {
      prompt:
        "A Ferris wheel rider boards at its lowest point, 2 m above ground. The highest point is 30 m, and one turn takes 8 minutes. Write $h(t)$.",
      steps: [
        "Midline $k=\\frac{30+2}{2}=16$ and amplitude $A=\\frac{30-2}{2}=14$.",
        "$B=\\frac{2\\pi}{8}=\\frac{\\pi}{4}$.",
        "At $t=0$ the rider is at the minimum, so use $-A\\cos(Bt)$.",
        "$h(t)=-14\\cos\\left(\\frac{\\pi}{4}t\\right)+16$. Check: $h(0)=-14+16=2$.",
      ],
      answer: "$h(t)=-14\\cos\\left(\\frac{\\pi}{4}t\\right)+16$",
    },
    "Parameters from context",
    [
      "$k=\\frac{\\max+\\min}{2}$, $A=\\frac{\\max-\\min}{2}$, $B=\\frac{2\\pi}{\\text{period}}$. Starting at a maximum: $A\\cos(Bt)+k$; at a minimum: $-A\\cos(Bt)+k$; at the midline going up: $A\\sin(Bt)+k$.",
      "To use a model, find the angle $Bt$ first, evaluate the trigonometric function there, multiply by $A$, and add $k$.",
    ],
    "Why these parameters",
    [
      "Cosine starts at its maximum 1, sine at its midline 0 rising. Multiplying by $A$ makes the extremes $\\pm A$ and adding $k$ moves them to $k\\pm A$. One cycle needs $Bt$ to go through $2\\pi$, so the period is $\\frac{2\\pi}{B}$.",
    ],
    [
      "Amplitude is half the range, not the maximum.",
      "$B$ is $2\\pi$ divided by the period.",
      "Check that the model gives the stated value at $t=0$.",
    ],
    "Ask the learner to check the finished model at $t=0$ and at half a period.",
  ),
];
