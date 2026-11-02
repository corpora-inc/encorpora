import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const trigonometryMethods: Record<string, ProblemMethod> = {
  "special-angle-exact-value": {
    goal: "For a special angle in degrees or radians, find the exact sine, cosine or tangent, or where its terminal side meets the unit circle.",
    intuition:
      "The unit circle is the circle of radius 1 around the origin. An angle $\\theta$ starts on the positive $x$-axis and turns counterclockwise, or clockwise if negative; a full turn is $360^\\circ$, or $2\\pi$ radians. Where it stops, its terminal side meets the circle at $(\\cos\\theta,\\sin\\theta)$: the cosine is the $x$-coordinate and the sine the $y$-coordinate. The size of each coordinate depends only on the reference angle, the acute angle between the terminal side and the $x$-axis. The quadrant, the quarter of the plane the angle ends in, decides the signs.",
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
      "On the unit circle, the circle of radius 1 around the origin, the angle $\\theta$ marks the point $(\\cos\\theta,\\sin\\theta)$: the cosine is the $x$-coordinate and the sine the $y$-coordinate. Turning the angle to $-\\theta$ flips the point across the $x$-axis. Adding $\\pi$, a half turn, moves it to the opposite side of the circle. Adding $2\\pi$, a full turn, returns to the same point. Each move changes the signs of the coordinates in a simple way.",
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
      "A sinusoid is a wave-shaped graph. The graph of $y=\\sin x$ rises and falls between $-1$ and $1$ and repeats every $2\\pi$; that length is its period. Each number in $y=A\\sin(B(x-h))+k$ changes one feature: $A$ stretches the height (its size $|A|$ is the amplitude), $B$ squeezes the width, $h$ slides the graph sideways and $k$ lifts it, setting the midline $y=k$.",
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
      "Many angles have the same sine, so sine cannot be undone until we agree on one interval of angles where each value appears once. $\\arcsin v$, read “arc sine of $v$”, answers: which angle between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$ has sine $v$? $\\arccos v$ uses angles from 0 to $\\pi$, and $\\arctan v$ uses angles strictly between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
    terms: [
      [
        "range-function",
        "For arcsin, the outputs are the angles from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
      ],
      [
        "range-function",
        "For arccos, the outputs are the angles from 0 to $\\pi$.",
      ],
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
      "A trigonometric equation asks which angles have a given sine, cosine or tangent. On the unit circle, the circle of radius 1 around the origin, one value is usually reached at two angles in each full turn of $2\\pi$. The interval, the stretch of angles allowed, tells how many turns to search; in $0\\le x<2\\pi$, the sign $\\le$ means is at most and $<$ means is less than.",
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
      "An identity is an equation true for every angle. The point $(\\cos\\theta,\\sin\\theta)$ lies on the unit circle, the circle of radius 1, so its coordinates satisfy $x^2+y^2=1$, that is, $\\sin^2\\theta+\\cos^2\\theta=1$. This is called the Pythagorean identity. When two angles are added, the new point is found from the points of the two parts, which gives the angle-sum formulas.",
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
      "An oblique triangle has no right angle. Name its sides $a$, $b$, $c$ and the angles across from them $A$, $B$, $C$. The law of sines says each side divided by the sine of the angle across from it gives the same number. The law of cosines, $c^2=a^2+b^2-2ab\\cos C$, extends the Pythagorean theorem with a correction for the angle between two sides. In any triangle the longest side is across from the largest angle.",
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
      "The area of a triangle is half its base times its height, the straight-up distance to the opposite corner. If $a$ is the base and $b$ is another side meeting it at angle $C$, the angle between them, the height is $b\\sin C$. So the area is $\\frac12ab\\sin C$.",
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
      "Tides, wheels and springs repeat. A sinusoid, a wave-shaped graph, models them: it swings equally above and below a middle level, the midline. The amplitude is how far it swings from the midline, and the period is the time for one full cycle. These, and where the quantity starts, fix the model.",
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
    "The unit circle is a circle of radius 1 centered at the origin. An angle turns from the positive $x$-axis and stops at a point on that circle, whose coordinates are the angle's cosine ($x$) and sine ($y$). For angles built from $30^\\circ$, $45^\\circ$ or $60^\\circ$, a small triangle gives the size of each value. The quarter of the plane the angle ends in, its quadrant, gives the sign.",
    [
      "Find the quadrant and the reference angle, the acute angle to the $x$-axis, of an angle in degrees or radians.",
      "Write the exact value of sine, cosine or tangent, including angles on an axis where tangent is undefined.",
    ],
    "The unit circle gives every angle a point",
    [
      "The unit circle is the circle of radius 1 around the origin, the point $(0, 0)$. An angle $\\theta$ (the Greek letter theta) starts on the positive $x$-axis and turns counterclockwise, or clockwise if it is negative. The ray where it stops is called its terminal side. It meets the circle at the point $(\\cos\\theta, \\sin\\theta)$: the cosine is the $x$-coordinate and the sine is the $y$-coordinate. The tangent is $\\tan\\theta = \\tfrac{\\sin\\theta}{\\cos\\theta}$.",
      "Angles are measured in degrees ($^\\circ$), where a full turn is $360^\\circ$, or in radians, where a full turn is $2\\pi$. So $\\pi$ radians is a half turn, $180^\\circ$, and $\\tfrac{\\pi}{6}$ is $30^\\circ$.",
      "The axes cut the plane into four quadrants, numbered I to IV counterclockwise from the upper right. In quadrant I, drop a line from the point straight down to the $x$-axis. That makes a right triangle with hypotenuse 1, so its legs are the cosine and the sine. In the other quadrants the same triangle appears, flipped, so only the signs change. The acute angle between the terminal side and the $x$-axis is called the reference angle.",
      "For the special angles, the triangle's sides are known. In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle with hypotenuse 1, the short leg is $\\tfrac{1}{2}$ and the long leg is $\\tfrac{\\sqrt{3}}{2}$. In a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle with hypotenuse 1, both legs are $\\tfrac{\\sqrt{2}}{2}$.",
    ],
    {
      prompt: "Find the exact value of $\\sin\\left(\\frac{5\\pi}{6}\\right)$.",
      steps: [
        "Change to degrees to see where the angle points: $\\tfrac{5\\pi}{6} = \\tfrac{5}{6} \\times 180^\\circ = 150^\\circ$. That is between $90^\\circ$ and $180^\\circ$, so the terminal side is in quadrant II, the upper left.",
        "The reference angle is the gap to the negative $x$-axis: $\\pi - \\tfrac{5\\pi}{6} = \\tfrac{\\pi}{6}$, which is $30^\\circ$.",
        "At $30^\\circ$, the sine is the leg opposite the angle in the special triangle, $\\tfrac{1}{2}$.",
        "In quadrant II the $y$-coordinate is positive, so the sine is positive. Check: the point is $\\left(-\\tfrac{\\sqrt{3}}{2}, \\tfrac{1}{2}\\right)$, and $\\left(-\\tfrac{\\sqrt{3}}{2}\\right)^2 + \\left(\\tfrac{1}{2}\\right)^2 = \\tfrac{3}{4} + \\tfrac{1}{4} = 1$, so it is on the circle.",
      ],
      answer: "$\\frac12$",
    },
    "From angle to exact value",
    [
      "Add or subtract whole turns until the angle is between 0 and one full turn. Name the quadrant and take the reference angle. The sizes are $\\tfrac{1}{2}$, $\\tfrac{\\sqrt{2}}{2}$, $\\tfrac{\\sqrt{3}}{2}$ for sine at $30^\\circ$, $45^\\circ$, $60^\\circ$; cosine uses the same three in reverse order; tangent uses $\\tfrac{\\sqrt{3}}{3}$, 1, $\\sqrt{3}$.",
      "Signs: sine is positive in quadrants I and II, cosine in I and IV, and tangent in I and III. On an axis, the point is $(\\pm 1, 0)$ or $(0, \\pm 1)$, where $\\pm$ means plus or minus. Tangent is undefined where the $x$-coordinate is 0, because division by 0 has no answer.",
    ],
    "Why the signs and sizes work",
    [
      "A reflection across an axis keeps distances, so the reference angle gives the same sizes of the coordinates. The sign of each coordinate comes from which side of the axis the point is on. Since $\\tan\\theta = \\tfrac{y}{x}$, it is undefined exactly when $x = 0$, at $\\tfrac{\\pi}{2} + n\\pi$ for any integer $n$ (a whole number or its negative).",
    ],
    [
      "Measure the reference angle from the $x$-axis, not the $y$-axis.",
      "Reduce an angle larger than a full turn before choosing the quadrant.",
      "Tangent at $90^\\circ$ and $270^\\circ$ is undefined, not 0.",
    ],
    "Ask the learner to say the quadrant and the reference angle of $\\frac{7\\pi}{6}$ before giving any value.",
  ),
  lesson(
    "trig-symmetry-value",
    "Unit-circle symmetry",
    "On the unit circle, the circle of radius 1 around the origin, an angle $\\theta$ marks the point $(\\cos\\theta, \\sin\\theta)$. Changing the angle in simple ways moves that point in simple ways. A negative angle flips the point across the $x$-axis, a half turn moves it to the opposite side, and a full turn brings it back. So the new sine or cosine is the old one, perhaps with its sign changed.",
    [
      "Find the sine or cosine of $-\\theta$, $\\pi - \\theta$, $\\theta + \\pi$ or $\\theta + 2\\pi$ from the value at $\\theta$.",
      "Find a missing sine or cosine from the other one and the quadrant, the quarter of the plane the angle ends in.",
    ],
    "Moving the angle moves the point",
    [
      "On the unit circle, the angle $\\theta$ (the Greek letter theta) marks the point $(\\cos\\theta, \\sin\\theta)$: the cosine is the $x$-coordinate and the sine is the $y$-coordinate. A full turn is $2\\pi$ radians, the same as $360^\\circ$, so a half turn is $\\pi$.",
      "Replacing $\\theta$ by $-\\theta$ turns the other way, which flips the point across the $x$-axis. The $x$-coordinate stays the same and the $y$-coordinate changes sign. So $\\cos(-\\theta) = \\cos\\theta$ and $\\sin(-\\theta) = -\\sin\\theta$.",
      "Adding $\\pi$ turns the point halfway around the circle, to the opposite side of the origin, so both coordinates change sign. Adding $2\\pi$ is a full turn and returns to the same point. The angle $\\pi - \\theta$ flips the point across the $y$-axis: the $x$-coordinate changes sign and the $y$-coordinate stays.",
    ],
    {
      prompt:
        "Given $\\sin\\theta=0.6$ and $\\theta$ acute, find $\\cos(\\pi-\\theta)$.",
      steps: [
        "$\\theta$ is acute, between 0 and $\\tfrac{\\pi}{2}$, so its point is in quadrant I and $\\cos\\theta$ is positive. Every point on the unit circle has $\\cos^2\\theta + \\sin^2\\theta = 1$, because its distance from the origin is 1. Here $\\cos^2\\theta$ means $(\\cos\\theta)^2$.",
        "So $\\cos^2\\theta = 1 - 0.6^2 = 1 - 0.36 = 0.64$, and $\\cos\\theta = 0.8$, the positive square root.",
        "The angle $\\pi - \\theta$ flips the point across the $y$-axis: the $x$-coordinate changes sign and the $y$-coordinate stays. So $\\cos(\\pi - \\theta) = -\\cos\\theta = -0.8$.",
        "Check: $\\pi - \\theta$ ends in quadrant II, the upper left, where cosine is negative.",
      ],
      answer: "$-0.8$",
    },
    "Write the angle as a move",
    [
      "Write the new angle as $\\theta$ or $-\\theta$ plus some number of half turns $\\pi$. Apply the flip first: $\\sin(-\\theta) = -\\sin\\theta$ and $\\cos(-\\theta) = \\cos\\theta$. Each added half turn changes the sign of both sine and cosine, and full turns change nothing. The tangent, $\\tan\\theta = \\tfrac{\\sin\\theta}{\\cos\\theta}$, is unchanged by a half turn: $\\tan(\\theta + \\pi) = \\tan\\theta$.",
    ],
    "Parity and period",
    [
      "A function is called odd if $f(-x) = -f(x)$ and even if $f(-x) = f(x)$. Sine is odd and cosine is even. The period of a function, the length after which it repeats, is $2\\pi$ for sine and cosine and $\\pi$ for tangent. The supplement rules follow: $\\sin(\\pi - \\theta) = \\sin\\theta$ and $\\cos(\\pi - \\theta) = -\\cos\\theta$.",
    ],
    [
      "A flip across the $x$-axis changes only the sign of the $y$-coordinate, the sine. Do not change both signs.",
      "Find the other function's size from $\\sin^2\\theta + \\cos^2\\theta = 1$ before using it.",
      "Tangent repeats every $\\pi$, not every $2\\pi$.",
    ],
    "Have the learner sketch the unit circle and mark $\\theta$ and $\\pi - \\theta$ before working anything out.",
  ),
  lesson(
    "sinusoid-parameters",
    "Amplitude, period, midline and shift",
    "A sinusoid is a wave-shaped graph like $y = \\sin x$. In $y = A\\sin(B(x - h)) + k$, each letter is a dial that changes one feature. $A$ sets the height of the wave, $B$ sets how long one cycle takes, $h$ slides the wave left or right, and $k$ lifts it up or down.",
    [
      "Read the amplitude, period, midline and horizontal shift from an equation.",
      "Read the same features from a graph, and choose the sign in front.",
    ],
    "One curve, four dials",
    [
      "The graph of $y = \\sin x$ rises to 1, falls to $-1$, and repeats every $2\\pi$. One full repeat is called a cycle, and its length is called the period.",
      "A number $A$ in front stretches the wave up and down. Its size $|A|$ (its value without the sign) is the amplitude: how far the wave rises above or falls below its middle. A negative $A$ also flips the wave over. A number $B > 0$ inside squeezes the wave sideways, so the period becomes $\\tfrac{2\\pi}{B}$.",
      "Subtracting $h$ from $x$ slides the wave $h$ units right; this slide is called a horizontal shift. Adding $k$ lifts the wave $k$ units. The horizontal line halfway between the highest and lowest points, $y = k$, is called the midline.",
    ],
    {
      prompt:
        "Find the period, amplitude and horizontal shift of $y=3\\sin\\left(2x-\\frac{\\pi}{3}\\right)+1$.",
      steps: [
        "The amplitude is the size of the number in front of the sine: $|3| = 3$. The midline is $y = 1$, from the added 1.",
        "Here $B = 2$, so the period is $\\tfrac{2\\pi}{B} = \\tfrac{2\\pi}{2} = \\pi$.",
        "To read the shift, take 2 out of the bracket as a common factor: $2x - \\tfrac{\\pi}{3} = 2\\left(x - \\tfrac{\\pi}{6}\\right)$. The number subtracted from $x$ is $\\tfrac{\\pi}{6}$, so the shift is $\\tfrac{\\pi}{6}$ to the right.",
        "Check: at $x = \\tfrac{\\pi}{6}$ the bracket is 0 and $\\sin 0 = 0$, so $y = 1$, the midline. The wave is there and rising, just as plain sine is at 0.",
      ],
      answer: "period $\\pi$, amplitude 3, shift $\\frac{\\pi}{6}$ right",
    },
    "Reading the equation or the graph",
    [
      "From the equation: amplitude $|A|$, midline $y = k$, period $\\tfrac{2\\pi}{B}$. For the shift, take $B$ out of the bracket and read the number subtracted from $x$. The highest value, the maximum, is $k + |A|$, and the lowest, the minimum, is $k - |A|$.",
      "From a graph: the highest and lowest points give the midline, halfway between them, and the amplitude, half their distance. Measure one cycle for the period, then $B = \\tfrac{2\\pi}{\\text{period}}$. See whether the curve rises or falls as it leaves the midline at $x = 0$ to choose the sign of $A$.",
    ],
    "Why a full turn is divided by the frequency factor",
    [
      "The sine repeats when its input grows by $2\\pi$. The input is $B(x - h)$, so $x$ must grow by an amount $\\Delta x$ (read “delta $x$”, a change in $x$) with $B\\,\\Delta x = 2\\pi$. That gives the period $\\tfrac{2\\pi}{B}$. Replacing $x$ by $x - h$ moves every point $h$ units right.",
    ],
    [
      "Amplitude is a distance, never negative.",
      "Take $B$ out of the bracket before reading the shift.",
      "The midline is $y = k$, not the $x$-axis unless $k = 0$.",
    ],
    "Ask the learner to sketch one cycle after finding the midline, amplitude and period.",
  ),
  lesson(
    "inverse-trig-value",
    "Inverse trigonometric values",
    "Many angles share the same sine, so asking “which angle has sine $\\tfrac{1}{2}$?” has many answers. An inverse trigonometric function picks one: $\\arcsin$, $\\arccos$ and $\\arctan$ each return the single angle in an agreed interval that has the given value.",
    [
      "Find $\\arcsin v$, $\\arccos v$ and $\\arctan v$ at special values, inside the right interval.",
      "Work out expressions like $\\arcsin(\\sin x)$ and $\\tan(\\arcsin v)$ from the inside out.",
    ],
    "Choosing one angle from many",
    [
      "On the unit circle, the circle of radius 1 around the origin, the angle $\\theta$ ends at the point $(\\cos\\theta, \\sin\\theta)$. The value $\\tfrac{1}{2}$ is the sine of $\\tfrac{\\pi}{6}$ ($30^\\circ$), of $\\tfrac{5\\pi}{6}$ ($150^\\circ$), and of many other angles.",
      "To undo sine, we agree on one interval, a stretch of angles, where each value appears exactly once. $\\arcsin v$, read “arc sine of $v$”, is the angle between $-\\tfrac{\\pi}{2}$ and $\\tfrac{\\pi}{2}$ whose sine is $v$; this interval is written $\\left[-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right]$, with square brackets meaning the ends are included.",
      "$\\arccos v$ is the angle in $[0, \\pi]$ whose cosine is $v$. $\\arctan v$ is the angle strictly between $-\\tfrac{\\pi}{2}$ and $\\tfrac{\\pi}{2}$, written $\\left(-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right)$, whose tangent is $v$.",
    ],
    {
      prompt: "Find $\\arcsin\\left(\\sin\\frac{5\\pi}{6}\\right)$.",
      steps: [
        "Work from the inside out. First $\\sin\\tfrac{5\\pi}{6} = \\tfrac{1}{2}$, because $\\tfrac{5\\pi}{6}$ is $150^\\circ$ and its reference angle is $30^\\circ$.",
        "Now find the angle in $\\left[-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right]$ whose sine is $\\tfrac{1}{2}$, because that is the only interval $\\arcsin$ answers in.",
        "That angle is $\\tfrac{\\pi}{6}$. The angle $\\tfrac{5\\pi}{6}$ has the same sine, but it is outside the interval, so it is not the answer.",
        "Check: $\\sin\\tfrac{\\pi}{6} = \\tfrac{1}{2}$, and $\\tfrac{\\pi}{6}$ lies in the interval.",
      ],
      answer: "$\\frac{\\pi}{6}$",
    },
    "Find the angle in the range",
    [
      "Find the reference angle, the acute angle whose value has the right size, then use the interval to place it. For $\\arcsin$ and $\\arctan$, a negative value gives the negative of the reference angle. For $\\arccos$, a negative value gives $\\pi$ minus the reference angle.",
      "For $\\arcsin(\\sin x)$, $\\arccos(\\cos x)$ or $\\arctan(\\tan x)$ with $x$ outside the interval, work out the inside first, then apply the inverse. For $\\cos(\\arcsin v)$, find the angle in the interval first, then take its cosine.",
    ],
    "Why the restriction is needed",
    [
      "A function has an inverse, a function that undoes it, only if each output comes from exactly one input. Sine takes each value between $-1$ and 1 many times, so we restrict it to an interval where it only increases. Then $\\sin(\\arcsin v) = v$ for every $v$ from $-1$ to 1, but $\\arcsin(\\sin x) = x$ only for $x$ in the interval.",
    ],
    [
      "$\\arcsin(\\sin x)$ is not always $x$.",
      "$\\arccos$ never gives a negative angle.",
      "$\\arcsin$ and $\\arctan$ never give angles in quadrants II or III, the left half of the circle.",
    ],
    "Ask the learner to say the allowed interval aloud before every inverse evaluation.",
  ),
  lesson(
    "trig-equation-solutions",
    "Solve trigonometric equations",
    "An equation like $2\\sin x = \\sqrt{3}$ asks which angles have a given sine. On the unit circle, most values are reached at two angles in each full turn. So get the sine alone, find one angle from the special triangles, use the sign to find the other, and keep every angle that lies in the stated interval.",
    [
      "Solve a sine, cosine or tangent equation and list every solution in an interval.",
      "Count the solutions when the angle is doubled, as in $\\sin(2x)$.",
    ],
    "Which angles have this value?",
    [
      "On the unit circle, the circle of radius 1 around the origin, an angle $x$ ends at the point $(\\cos x, \\sin x)$. The sine is the height of that point. The equation $\\sin x = \\tfrac{\\sqrt{3}}{2}$ asks for every angle whose point has that height.",
      "A given height is reached at two points of the circle, mirror images across the $y$-axis, unless it is the very top or bottom, where there is one point. A height above 1 or below $-1$ is never reached.",
      "The interval says which angles count. $0 \\le x < 2\\pi$ means one full turn, including 0 but not $2\\pi$; the sign $\\le$ means is at most, and $<$ means is less than.",
    ],
    {
      prompt: "Solve $2\\sin x=\\sqrt3$ on $0\\le x<2\\pi$.",
      steps: [
        "Get the sine alone: divide both sides by 2 to get $\\sin x = \\tfrac{\\sqrt{3}}{2}$.",
        "The acute angle with sine $\\tfrac{\\sqrt{3}}{2}$ is $\\tfrac{\\pi}{3}$, or $60^\\circ$, from the $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle. This is the reference angle.",
        "Sine is positive in quadrants I and II, the top half of the circle. So $x = \\tfrac{\\pi}{3}$ and $x = \\pi - \\tfrac{\\pi}{3} = \\tfrac{2\\pi}{3}$, its mirror image across the $y$-axis.",
        "Check: $2\\sin\\tfrac{2\\pi}{3} = 2 \\times \\tfrac{\\sqrt{3}}{2} = \\sqrt{3}$. Both angles are in $0 \\le x < 2\\pi$.",
      ],
      answer: "$x=\\frac{\\pi}{3},\\ \\frac{2\\pi}{3}$",
    },
    "List, then check the interval",
    [
      "Get the function alone and find the reference angle. For sine or cosine of a value strictly between $-1$ and 1, there are two solutions in each full turn. At 1 or $-1$ there is one, and outside that range there are none. Tangent repeats every half turn, so it has one solution per half turn: two per full turn.",
      "For $\\sin(2x) = v$, the angle $2x$ runs from 0 to $4\\pi$ while $x$ runs from 0 to $2\\pi$, so there are twice as many solutions. Solve for $2x$, then halve. In $0 \\le x < 2\\pi$, the angle $2\\pi$ itself is not included.",
    ],
    "All solutions and a restricted interval",
    [
      "If $\\alpha = \\arcsin v$, the angle in $\\left[-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}\\right]$ with sine $v$, then $\\sin x = v$ exactly when $x = \\alpha + 2\\pi n$ or $x = \\pi - \\alpha + 2\\pi n$ for an integer $n$, a whole number or its negative. The solutions in an interval are the angles of these forms that fall inside it.",
    ],
    [
      "Do not stop after the first solution.",
      "Check whether each end of the interval is included.",
      "Sine and cosine never have a value larger than 1 or smaller than $-1$.",
    ],
    "Ask the learner to mark both solution points on a unit circle before writing the angles.",
  ),
  lesson(
    "trig-identity-value",
    "Identities and angle sums",
    "An identity is an equation that is true for every angle. Because the point $(\\cos\\theta, \\sin\\theta)$ is on a circle of radius 1, its coordinates satisfy $\\cos^2\\theta + \\sin^2\\theta = 1$. That gives a missing sine or cosine from the other one. The angle-sum formulas give exact values at new angles, such as $75^\\circ = 45^\\circ + 30^\\circ$.",
    [
      "Find a missing sine, cosine or tangent from one value and the quadrant.",
      "Use the angle-sum and difference formulas to find exact values at new angles.",
    ],
    "Coordinates on a circle",
    [
      "On the unit circle, the circle of radius 1 around the origin, the angle $\\theta$ ends at the point $(\\cos\\theta, \\sin\\theta)$. Its distance from the origin is 1, so by the Pythagorean theorem its coordinates satisfy $x^2 + y^2 = 1$. Written with sine and cosine, $\\sin^2\\theta + \\cos^2\\theta = 1$, where $\\sin^2\\theta$ means $(\\sin\\theta)^2$. This is called the Pythagorean identity.",
      "If one coordinate is known, the identity gives the size of the other. Its sign depends on the quadrant, the quarter of the plane the angle ends in.",
      "Adding two angles gives a point whose coordinates combine those of the two parts. That gives the angle-sum formula $\\sin(A + B) = \\sin A\\cos B + \\cos A\\sin B$, and similar ones for cosine and for differences.",
    ],
    {
      prompt: "Find the exact value of $\\sin 75^\\circ$.",
      steps: [
        "$75^\\circ$ is not a special angle, but it is a sum of two: $75^\\circ = 45^\\circ + 30^\\circ$.",
        "Use the angle-sum formula $\\sin(A + B) = \\sin A\\cos B + \\cos A\\sin B$ with $A = 45^\\circ$ and $B = 30^\\circ$, because we know both angles' sines and cosines.",
        "Put in the values: $\\sin 75^\\circ = \\tfrac{\\sqrt{2}}{2} \\times \\tfrac{\\sqrt{3}}{2} + \\tfrac{\\sqrt{2}}{2} \\times \\tfrac{1}{2} = \\tfrac{\\sqrt{6}}{4} + \\tfrac{\\sqrt{2}}{4}$. Each product's bottom is $2 \\times 2 = 4$.",
        "Check with a calculator: $\\sin 75^\\circ \\approx 0.966$, and $\\tfrac{2.449 + 1.414}{4} \\approx 0.966$.",
      ],
      answer: "$\\frac{\\sqrt6+\\sqrt2}{4}$",
    },
    "Choose the identity",
    [
      "If you know one coordinate and the quadrant, $\\sin^2\\theta + \\cos^2\\theta = 1$ gives the size of the other coordinate, and the quadrant gives its sign. Then $\\tan\\theta = \\tfrac{\\sin\\theta}{\\cos\\theta}$.",
      "If the angle is a sum or difference of special angles, use the sum or difference formula. For complementary angles, two angles that add to $\\tfrac{\\pi}{2}$ ($90^\\circ$), use $\\sin x = \\cos\\left(\\tfrac{\\pi}{2} - x\\right)$.",
    ],
    "The formulas",
    [
      "$\\sin(A \\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B$ and $\\cos(A \\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B$. Here $\\pm$ means plus or minus, and $\\mp$ means the opposite sign: minus when the other is plus. Putting $A = B$ in the cosine difference formula gives $\\cos 0 = \\cos^2 A + \\sin^2 A = 1$, the Pythagorean identity again.",
    ],
    [
      "A square root gives two possible signs: choose it from the quadrant.",
      "$\\cos(A + B)$ subtracts the product of the sines.",
      "When multiplying fractions, the bottoms multiply: $2 \\times 2 = 4$.",
    ],
    "Ask the learner to decide the sign of the answer from the quadrant before working it out.",
  ),
  lesson(
    "oblique-triangle-solve",
    "Law of sines and law of cosines",
    "An oblique triangle is one with no right angle. Two rules solve it. The law of sines works when you know an angle and the side across from it. The law of cosines works when you know two sides and the angle between them, or all three sides.",
    [
      "Choose the law of sines or the law of cosines from what is known, and find a missing side or angle.",
      "Decide how many triangles fit when two sides and an angle not between them are given.",
    ],
    "Beyond right triangles",
    [
      "In a right triangle, the sine of an angle is the opposite side divided by the hypotenuse, the longest side. For any triangle, name the sides $a$, $b$, $c$ and the angles across from them $A$, $B$, $C$.",
      "The law of sines says each side divided by the sine of the angle across from it gives the same number: $\\tfrac{a}{\\sin A} = \\tfrac{b}{\\sin B} = \\tfrac{c}{\\sin C}$.",
      "The law of cosines changes the Pythagorean theorem, $c^2 = a^2 + b^2$ for a right triangle, into $c^2 = a^2 + b^2 - 2ab\\cos C$. That works when the angle $C$ between sides $a$ and $b$ is not a right angle.",
    ],
    {
      prompt:
        "In triangle $ABC$, $A=40^\\circ$, $B=65^\\circ$ and $a=12$. Find $b$ to the nearest tenth.",
      steps: [
        "Side $a$ is across from angle $A$, and side $b$ is across from angle $B$. We know $A$, $a$ and $B$, so the law of sines links them: $\\tfrac{b}{\\sin 65^\\circ} = \\tfrac{12}{\\sin 40^\\circ}$.",
        "Multiply both sides by $\\sin 65^\\circ$ to get $b$ alone: $b = \\tfrac{12\\sin 65^\\circ}{\\sin 40^\\circ} \\approx \\tfrac{12 \\times 0.9063}{0.6428}$.",
        "Work it out and round to one decimal place: $b \\approx 16.9$.",
        "Check: angle $B$ is bigger than angle $A$, so side $b$ should be longer than side $a$, and $16.9 > 12$.",
      ],
      answer: "$16.9$",
    },
    "Pick the law, then check",
    [
      "An angle and the side across from it are known: use the law of sines. Two sides and the angle between them: use the law of cosines for the third side. Three sides: use the law of cosines to find an angle. With two sides and an angle that is not between them, first work out $h = b\\sin A$, the shortest distance from the far corner to the other side, and compare it with $a$.",
      "For an acute $A$ (less than $90^\\circ$): if $a < h$ there is no triangle, if $a = h$ one right triangle, if $h < a < b$ two triangles, and if $a$ is at least $b$, one. For an obtuse $A$ (more than $90^\\circ$): one triangle when $a > b$, otherwise none.",
    ],
    "Why the case analysis works",
    [
      "Side $a$ must reach the line along the other side of angle $A$. The shortest distance from corner $C$ to that line is $h = b\\sin A$. When $a$ is between $h$ and $b$, a circle of radius $a$ around $C$ meets the line at two points, so two different triangles fit.",
    ],
    [
      "Pair each side with the angle across from it.",
      "Inverse sine gives only an acute angle. Check whether an obtuse angle, $180^\\circ$ minus that angle, also fits.",
      "Keep the calculator in degree mode and round only at the end.",
    ],
    "Ask the learner to label all the sides and the angles across from them on a sketch before choosing a law.",
  ),
  lesson(
    "trig-triangle-area",
    "Triangle area from two sides and the angle",
    "The area of a triangle is half its base times its height. When you know two sides and the angle between them, the sine of that angle gives the height. So the area is half the product of the two sides times the sine of the angle between them: $\\tfrac{1}{2}ab\\sin C$.",
    [
      "Find a triangle's area from two sides and the angle between them.",
      "Find a missing side from the area, two of the parts, and the sine.",
    ],
    "Height from an angle",
    [
      "A triangle's area is $\\tfrac{1}{2} \\times \\text{base} \\times \\text{height}$, where the height is the straight-up distance from the base to the opposite corner.",
      "Take side $a$ as the base. Side $b$ leans away from the base at angle $C$, the angle between the two sides. In a right triangle, the sine of an angle is the opposite side over the hypotenuse, so the height above the base is $b\\sin C$.",
      "So the area is $\\tfrac{1}{2} \\times a \\times b\\sin C = \\tfrac{1}{2}ab\\sin C$. The angle must be the one between the two sides, called the included angle.",
    ],
    {
      prompt:
        "Two sides measure 8 and 6 units with a $30^\\circ$ angle between them. Find the area.",
      steps: [
        "The $30^\\circ$ angle is between the two sides, so it is the included angle and the formula $\\tfrac{1}{2}ab\\sin C$ applies.",
        "$\\sin 30^\\circ = \\tfrac{1}{2}$, from the $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle.",
        "Area $= \\tfrac{1}{2} \\times 8 \\times 6 \\times \\tfrac{1}{2} = 12$.",
        "Check another way: the height above the base 8 is $6\\sin 30^\\circ = 3$, and $\\tfrac{1}{2} \\times 8 \\times 3 = 12$.",
      ],
      answer: "12 square units",
    },
    "Use the angle between the sides",
    [
      "Check that the angle lies between the two known sides. Then work out $\\tfrac{1}{2}ab\\sin C$. To find a missing side, solve the formula for it: $a = \\tfrac{2 \\times \\text{area}}{b\\sin C}$.",
      "Two included angles that add to $180^\\circ$ have the same sine, so they give the same area.",
    ],
    "Derivation",
    [
      "Draw the height $h$ from the end of side $b$ straight down to the line of side $a$. In the right triangle formed, $\\sin C = \\tfrac{h}{b}$, so $h = b\\sin C$. If $C$ is obtuse, more than $90^\\circ$, the height falls outside the base, but $h = b\\sin(180^\\circ - C) = b\\sin C$ still holds.",
    ],
    [
      "Use the sine of the included angle, not the cosine.",
      "Keep the factor $\\tfrac{1}{2}$.",
      "The angle must be between the two known sides.",
    ],
    "Ask the learner to say which angle lies between the two given sides.",
  ),
  lesson(
    "sinusoid-model",
    "Build a periodic model",
    "A periodic quantity repeats over and over, like a tide or a Ferris wheel seat. Its highest and lowest values give the middle level, the midline, and the size of the swing, the amplitude. The time for one full repeat, the period, gives the number $B$. The starting position decides whether to use cosine, negative cosine or sine.",
    [
      "Find the midline, amplitude and period of a repeating quantity from a description.",
      "Write a sine or cosine model that starts in the right place, and use it.",
    ],
    "Repeating quantities",
    [
      "A tide, a Ferris wheel and a bobbing buoy each swing equally above and below a middle level. The midline is the average of the highest and lowest values, and the amplitude is half their difference.",
      "The period is the time for one full cycle. In $A\\cos(Bt) + k$, the number $B$ is $\\tfrac{2\\pi}{\\text{period}}$, because cosine repeats when $Bt$ grows by $2\\pi$.",
      "Cosine starts at its highest value, 1, so $A\\cos(Bt) + k$ starts at the top. Negative cosine starts at the bottom. Sine starts at the midline and rises.",
    ],
    {
      prompt:
        "A Ferris wheel rider boards at its lowest point, 2 m above ground. The highest point is 30 m, and one turn takes 8 minutes. Write $h(t)$.",
      steps: [
        "The midline is the average of the extremes: $k = \\tfrac{30 + 2}{2} = 16$. The amplitude is half their difference: $A = \\tfrac{30 - 2}{2} = 14$.",
        "One turn takes 8 minutes, so $B = \\tfrac{2\\pi}{8} = \\tfrac{\\pi}{4}$.",
        "At $t = 0$ the rider is at the lowest point, so use negative cosine, which starts at its minimum: $-A\\cos(Bt) + k$.",
        "So $h(t) = -14\\cos\\left(\\tfrac{\\pi}{4}t\\right) + 16$. Check: $h(0) = -14 \\times 1 + 16 = 2$, the boarding height.",
      ],
      answer: "$h(t)=-14\\cos\\left(\\frac{\\pi}{4}t\\right)+16$",
    },
    "Parameters from context",
    [
      "$k = \\tfrac{\\text{max} + \\text{min}}{2}$, $A = \\tfrac{\\text{max} - \\text{min}}{2}$ and $B = \\tfrac{2\\pi}{\\text{period}}$. Starting at a maximum: $A\\cos(Bt) + k$. Starting at a minimum: $-A\\cos(Bt) + k$. Starting at the midline and rising: $A\\sin(Bt) + k$.",
      "To use a model, find the angle $Bt$ first, take its cosine or sine, multiply by $A$, and add $k$.",
    ],
    "Why these parameters",
    [
      "Cosine starts at its maximum 1, and sine at its midline 0, rising. Multiplying by $A$ makes the extremes $A$ and $-A$, and adding $k$ moves them to $k + A$ and $k - A$. One cycle needs $Bt$ to go through $2\\pi$, so the period is $\\tfrac{2\\pi}{B}$.",
    ],
    [
      "The amplitude is half the distance from lowest to highest, not the maximum.",
      "$B$ is $2\\pi$ divided by the period.",
      "Check that the model gives the stated value at $t = 0$.",
    ],
    "Ask the learner to check the finished model at $t = 0$ and at half a period.",
  ),
];
