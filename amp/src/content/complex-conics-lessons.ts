import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const r = String.raw;

const focusSenses = {
  vertex: "vertex-parabola",
  focus: "focus",
  square: "square-shape",
  side: "side",
  squared: "square-number",
  squaring: "square-number",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

export const complexConicsMethods: Record<string, ProblemMethod> = {
  "complex-plane-forms": {
    goal: "Given a complex number as a point, a sum of points, a modulus request or a polar form, find the requested exact value.",
    intuition: r`A complex number $a+bi$, where $i^2=-1$, is the point $(a,b)$ in the complex plane: $a$ counts across the real axis and $b$ counts up the imaginary axis. Its distance from 0 is its modulus. The same point can be named by that distance $r$ and the angle $\theta$ it makes with the positive real axis, which is called polar form.`,
    terms: ["modulus", "polar-form"],
    method: [
      r`Read the real part from the horizontal coordinate and the imaginary part from the vertical coordinate.`,
      r`For a modulus, apply the Pythagorean theorem to the two parts. For a sum, add real parts and add imaginary parts.`,
      r`To change polar to $a+bi$, use $a=r\cos\theta$ and $b=r\sin\theta$. To go back from a number other than 0, find $r$, then the angle whose cosine is $a/r$ and whose sine is $b/r$. The signs of $a$ and $b$ tell you the quadrant.`,
    ],
    watch: r`The real part uses cosine and the horizontal axis. Check the quadrant before choosing an angle: the reference angle alone does not say which quadrant.`,
  },
  "complex-conjugate-division": {
    goal: "Given a complex number or a quotient of complex numbers, use the conjugate to give an exact standard-form result.",
    intuition: r`A complex number $a+bi$ has a real part $a$ and an imaginary part $b$, where $i^2=-1$. Changing the sign of the imaginary part gives its conjugate, $a-bi$. A number times its conjugate is $a^2+b^2$, a real number with no $i$. So multiplying the top and bottom of a fraction by the conjugate of the bottom clears $i$ from the bottom without changing the value.`,
    terms: [
      "complex-conjugate",
      [
        "complex-number",
        "Standard form for a complex number is $x + yi$ with $x$ and $y$ real; fractions are allowed.",
      ],
    ],
    method: [
      r`Write the conjugate of the denominator.`,
      r`Multiply the numerator and the denominator by it. The denominator becomes $c^2+d^2$.`,
      r`Multiply out the numerator using $i^2=-1$, then divide the real part and the imaginary part by the denominator and simplify.`,
    ],
    watch: r`Multiply by the conjugate of the denominator on top and bottom, and change only the sign of the imaginary part. The new denominator is $c^2+d^2$, a sum.`,
  },
  "complex-distance-midpoint": {
    goal: "Given complex numbers, find the distance between them, their midpoint, a missing endpoint, or the center and radius of $|z-w|=r$.",
    intuition: r`In the complex plane, $a+bi$ is the point $(a,b)$. Subtracting two complex numbers gives the arrow from one point to the other. The modulus of that arrow, its length, is the distance between the points. The midpoint, halfway between them, is the average of the two numbers.`,
    terms: [
      ["distance", "For complex numbers $z$ and $w$, it is $|z - w|$."],
      [
        "midpoint",
        "For complex numbers $z$ and $w$, it is $\\frac{z + w}{2}$.",
      ],
    ],
    method: [
      r`For a distance, subtract the real parts and the imaginary parts, then take $\sqrt{(\Delta a)^2+(\Delta b)^2}$ and simplify.`,
      r`For a midpoint, average the real parts and average the imaginary parts. For a missing endpoint, double the midpoint and subtract the known endpoint.`,
      r`For a fixed $w$ and $r>0$, read $|z-w|=r$ as "$z$ is $r$ away from $w$": a circle with center $w$ and radius $r$.`,
    ],
    watch: r`Rewrite $|z+w|$ as $|z-(-w)|$ before reading a center. The distance squares both differences before adding.`,
  },
  "complex-quadratic-factors": {
    goal: "Factor a sum of squares or solve or build a quadratic whose roots are not real.",
    intuition: r`A sum of squares $x^2+k^2$, with $k$ a real number other than 0, is never 0 for a real $x$. But $i^2=-1$ gives $(ki)^2=-k^2$, so it has the two roots $ki$ and $-ki$. In the same way, a quadratic whose discriminant, the number under the square root in the quadratic formula, is negative has two roots $p+qi$ and $p-qi$. They are conjugates: they differ only in the sign of the imaginary part.`,
    terms: [
      ["discriminant", "For $x^2 + bx + c$, where $a = 1$, it is $b^2 - 4c$."],
      "complex-conjugate",
    ],
    method: [
      r`For $x^2+k^2$ write $x^2-(ki)^2$ and factor as a difference of squares: $(x+ki)(x-ki)$.`,
      r`For $x^2+bx+c$, with 1 in front of $x^2$, compute $b^2-4c$. If it is negative, the roots are $\frac{-b\pm\sqrt{4c-b^2}\,i}{2}$: simplify the radical and divide both terms by 2.`,
      r`To build a quadratic from roots, use $x^2-(\text{sum})x+\text{product}$; for $p\pm qi$ the sum is $2p$ and the product is $p^2+q^2$.`,
    ],
    watch: r`Both factors need an $i$ and opposite signs. Divide the whole numerator by 2 in the quadratic formula, and remember that $q^2$ adds to $p^2$ in the product.`,
  },
  "polynomial-root-count": {
    goal: "Given a polynomial, count its complex roots with multiplicity or use conjugate pairs to restrict its real and nonreal roots.",
    intuition: r`A root of a polynomial is a value of $x$ that makes it 0, and its degree is its largest exponent of $x$. If the factor $(x-a)$ appears $m$ times, the root $a$ has multiplicity $m$ and counts $m$ times. Counted this way, every polynomial of degree $n\ge1$ has exactly $n$ roots among the complex numbers, the numbers $a+bi$ with $a$ and $b$ real and $i^2=-1$. When the coefficients are real, a root that is not real always comes with its conjugate.`,
    terms: [
      "multiplicity",
      [
        "coefficient",
        "Here every coefficient is a real number, so nonreal roots come in conjugate pairs.",
      ],
      "real-number",
    ],
    method: [
      r`Find the degree. From factors, add each factor's degree times its exponent, so $(x^2+1)^3$ counts 6. That total is the number of complex roots.`,
      r`For a real polynomial, pair each nonreal root with its conjugate. The number of nonreal roots is even.`,
      r`Subtract the forced nonreal roots from the degree to find how many real roots remain possible.`,
    ],
    watch: r`Count roots with multiplicity, and count a factor like $x^2+k$ as two roots. When the coefficients are real, a root that is not real is never alone.`,
  },
  "polar-cartesian-conversion": {
    goal: "Convert between polar and Cartesian coordinates at special angles, and recognize different polar names for one point.",
    intuition: r`Polar coordinates $(r,\theta)$ locate a point in two steps: turn through an angle $\theta$ counterclockwise from the positive $x$-axis, then move $r$ units. If $r$ is negative, move that distance the opposite way. Cartesian coordinates $(x,y)$ give the same point as across and up. Different turns can end at the same point.`,
    terms: ["polar-coordinates", "reference-angle"],
    method: [
      r`For polar to Cartesian, use $x=r\cos\theta$ and $y=r\sin\theta$, keeping the sign of $r$.`,
      r`For Cartesian to polar, for a point other than the origin, use $r=\sqrt{x^2+y^2}$, then the angle in $[0,2\pi)$ whose cosine is $x/r$ and sine is $y/r$.`,
      r`For another name, add $2\pi$ to the angle, or change the sign of $r$ and add $\pi$.`,
    ],
    watch: r`Choose the quadrant from the signs of $x$ and $y$; the reference angle alone fits four points. A negative $r$ reverses direction, so the angle must also turn by $\pi$ to keep the same point.`,
  },
  "parametric-linear-motion": {
    goal: "Given linear equations $x(t)$ and $y(t)$ for a moving object, find its position, path, speed, a time, or its direction.",
    senses: { rule: "rule", rules: "rule", parameter: "parameter" },
    intuition: r`A parametric model gives each coordinate as its own rule depending on time $t$, called the parameter. At each time $t$ the pair $(x(t),y(t))$ is the object's position. When both rules are linear, like $x(t)=2+3t$, the object moves along a straight line at a steady speed.`,
    terms: [
      [
        "parametric-equations",
        "Here the parameter is time $t$; both $x$ and $y$ depend on it.",
      ],
      [
        "speed",
        "For rates $a$ and $b$ in $x$ and $y$, the speed is $\\sqrt{a^2+b^2}$.",
      ],
    ],
    method: [
      r`To find a position or a time, substitute into, or solve, the equation for the coordinate you are given.`,
      r`To eliminate $t$, solve one equation for $t$ and substitute into the other. When $a\ne0$, the slope of the path is $\frac{b}{a}$, the ratio of the rates.`,
      r`Read direction from the signs of the rates, and speed from $\sqrt{a^2+b^2}$.`,
    ],
    watch: r`Include the starting position when evaluating. The slope of the path is $y$'s rate divided by $x$'s rate, and the speed combines both rates.`,
  },
  "conic-standard-form": {
    goal: "Given a conic equation, name the curve, read its center or axis ends, or complete the square to find its center and size.",
    intuition: r`Circles, ellipses (ovals), parabolas (U shapes) and hyperbolas (two opposite curves) are the curves made by slicing a cone, called conic sections. Their equations differ in which variables are squared, whether the squared terms are added or subtracted, and whether their denominators match.`,
    terms: [
      [
        "center",
        "For the circle $(x - h)^2 + (y - k)^2 = r^2$, the center is $(h, k)$.",
      ],
      "completing-the-square",
    ],
    method: [
      r`To identify: count the squared variables, then look at the sign between them and whether their denominators or coefficients are equal.`,
      r`To read a center, take the opposite of the number added inside each $(x\pm\cdot)$ or $(y\pm\cdot)$. An ellipse's axis ends are the square root of each denominator away from the center.`,
      r`To complete the square, group each variable, factor out its leading coefficient, add the squares to both sides, and rewrite as squares.`,
    ],
    watch: r`The sign inside the parentheses is opposite the coordinate. Divide by the leading coefficient before halving, and take the square root of a denominator to get a distance.`,
  },
  "parabola-focus-directrix": {
    goal: "From a focus and directrix, or from a parabola's equation, find the vertex, the equation, the focus or the directrix.",
    intuition: r`A parabola is a U-shaped curve. It is every point that is the same distance from a fixed point, called the focus, and a fixed line that does not pass through it, called the directrix. The vertex is the turning point of the curve, and it is halfway between the focus and the directrix. Let $p$ be the distance from the vertex to the focus, with a minus sign if the focus is below (or left of) the vertex. A parabola that opens up or down with vertex $(h, k)$ has the equation $(x - h)^2 = 4p(y - k)$.`,
    terms: [
      "focus",
      "directrix",
      [
        "focus",
        "$p$ is the signed distance from the vertex to the focus, along the axis of symmetry.",
      ],
    ],
    senses: focusSenses,
    noLink: [
      "part",
      "parts",
      "change",
      "changes",
      "leaves",
      "key",
      "jumps",
      "jump",
      "third",
      "mean",
      "means",
      "sort",
      "image",
      "images",
      "solid",
      "scales",
      "net",
      "inverse",
      "population",
      "whole",
      "more than",
      "period",
      "periods",
      "quarter",
      "quarters",
      "one quarter",
      "mirror image",
      "rule",
      "rules",
      "opposite",
      "opposites",
      "unit",
      "units",
      "average",
      "decreasing",
      "increasing",
      "model",
      "models",
      "pattern",
      "patterns",
    ],
    method: [
      r`The vertex is halfway between the focus and the nearest point of the directrix. The number $p$ is the distance from the vertex to the focus: positive if the parabola opens up (or right), negative if it opens down (or left).`,
      r`Write $(x - h)^2 = 4p(y - k)$ for a parabola that opens up or down, or $(y - k)^2 = 4p(x - h)$ for one that opens sideways.`,
      r`To read an equation, match it to the form. The vertex is $(h, k)$ and the number in front of the bracket is $4p$. The focus is $|p|$ units from the vertex, in the direction the parabola opens, and the directrix is $|p|$ units away on the other side. Here $|p|$ means the size of $p$ without its sign.`,
    ],
    watch: r`The number in front of the bracket is $4p$, not $p$. The vertex is halfway between the focus and the directrix, not at the focus.`,
  },
};

export const complexConicsPrinciples: Record<string, string> = {
  "complex-plane-forms": r`The complex number $a+bi$ is the point $(a,b)$, its modulus is $\sqrt{a^2+b^2}$, and $a+bi=r(\cos\theta+i\sin\theta)$ when $a=r\cos\theta$ and $b=r\sin\theta$. Addition is vector addition of the arrows from 0.`,
  "complex-conjugate-division": r`For real $a$ and $b$, $(a+bi)(a-bi)=a^2+b^2=|a+bi|^2$. For $c+di\ne0$, $\frac{a+bi}{c+di}=\frac{(a+bi)(c-di)}{c^2+d^2}$.`,
  "complex-distance-midpoint": r`The distance between $z$ and $w$ is $|z-w|$ and the midpoint is $\frac{z+w}{2}$. The solutions of $|z-w|=r$ with $r>0$ form the circle of radius $r$ about $w$.`,
  "complex-quadratic-factors": r`Since $(ki)^2=-k^2$ for real $k$, $x^2+k^2=(x+ki)(x-ki)$. If $b^2-4c<0$ the roots of $x^2+bx+c$ are $\frac{-b\pm i\sqrt{4c-b^2}}{2}$, a conjugate pair.`,
  "polynomial-root-count": r`A polynomial of degree $n\ge1$ has exactly $n$ complex roots counting multiplicity. If its coefficients are real and $p+qi$ is a root, then $p-qi$ is a root with the same multiplicity.`,
  "polar-cartesian-conversion": r`For $(r,\theta)$, $x=r\cos\theta$ and $y=r\sin\theta$; conversely $r^2=x^2+y^2$. The pairs $(r,\theta)$, $(r,\theta+2\pi)$ and $(-r,\theta+\pi)$ name the same point.`,
  "parametric-linear-motion": r`For $x(t)=x_0+at$ and $y(t)=y_0+bt$ the object moves along a line with slope $\frac{b}{a}$ (when $a\ne0$) at constant speed $\sqrt{a^2+b^2}$.`,
  "conic-standard-form": r`Each conic is the set of points satisfying a second-degree equation. $(x-h)^2+(y-k)^2=r^2$ is a circle, $\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1$ with $a\ne b$ is an ellipse, and a minus sign between the squared terms gives a hyperbola. An equation with one squared variable is a parabola. These names apply when the graph is a curve, not a point, a line or nothing.`,
  "parabola-focus-directrix": r`The parabola with focus $(h, k + p)$ and directrix $y = k - p$ is $(x - h)^2 = 4p(y - k)$. A point $(x, y)$ is the same distance from the focus and the directrix exactly when this equation holds.`,
};

type Spec = {
  id: string;
  title: string;
  summary: string;
  objectives: string[];
  intuition: { title: string; paragraphs: string[] };
  example: { prompt: string; steps: string[]; answer: string };
  method: { title: string; paragraphs: string[] };
  formal: { title: string; paragraphs: string[] };
  pitfalls: string[];
  parentGuide: string;
  senses?: Lesson["senses"];
  noLink?: string[];
};
const lesson = (s: Spec): Lesson => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
  ...(s.senses ? { senses: s.senses } : {}),
  ...(s.noLink ? { noLink: s.noLink } : {}),
  templateIds: [s.id],
  objectives: s.objectives,
  sections: [
    {
      stage: "intuition",
      title: s.intuition.title,
      paragraphs: s.intuition.paragraphs,
    },
  ],
  workedExample: s.example,
  closingSections: [
    {
      stage: "method",
      keepTogetherInPrint: true,
      title: s.method.title,
      paragraphs: s.method.paragraphs,
    },
    { stage: "formal", title: s.formal.title, paragraphs: s.formal.paragraphs },
  ],
  pitfalls: s.pitfalls,
  parentGuide: s.parentGuide,
});

export const complexConicsLessons: Lesson[] = [
  lesson({
    id: "complex-plane-forms",
    title: "The complex plane, modulus and polar form",
    senses: { plane: "plane", units: "unit" },
    noLink: ["parts"],
    summary: r`A complex number $a+bi$ has a real part $a$ and an imaginary part $b$, where $i$ is the number with $i^2=-1$. Plotting $a$ across and $b$ up turns each complex number into a point. For any point other than 0, its distance from 0, called the modulus, and its direction, an angle, describe it another way, called polar form.`,
    objectives: [
      "Read a complex number from a point, and add complex numbers as arrows.",
      r`Find a modulus, and convert between $a+bi$ and $r(\cos\theta+i\sin\theta)$ at special angles.`,
    ],
    intuition: {
      title: "A number as a point",
      paragraphs: [
        r`A complex number $a+bi$ has a real part $a$ and an imaginary part $b$, where $i$, the imaginary unit, is the number with $i^2=-1$. Draw a plane whose horizontal axis, the real axis, counts real parts, and whose vertical axis, the imaginary axis, counts imaginary parts. This is the complex plane. Then $a+bi$ is the point $a$ units across and $b$ units up, with negative values going left or down.`,
        r`The distance from 0 to the point is called the modulus, written $|a+bi|$. By the Pythagorean theorem it is $\sqrt{a^2+b^2}$. The direction is the angle $\theta$ (theta) measured counterclockwise from the positive real axis. Naming the point by its distance $r$ and its angle $\theta$, as $r(\cos\theta+i\sin\theta)$, is called polar form.`,
        r`On the unit circle, the point at angle $\theta$ is $(\cos\theta,\sin\theta)$. Stretching it by $r$ gives the point $r$ away from 0, so $a=r\cos\theta$ across and $b=r\sin\theta$ up.`,
      ],
    },
    example: {
      prompt: r`Write $4\left(\cos\frac{2\pi}{3}+i\sin\frac{2\pi}{3}\right)$ in the form $a+bi$.`,
      steps: [
        r`The angle $\frac{2\pi}{3}$ is $120^\circ$, in the second quadrant, the upper left. Its reference angle, the acute angle to the real axis, is $60^\circ$. So $\cos\frac{2\pi}{3}=-\frac12$, negative because the point is left of 0, and $\sin\frac{2\pi}{3}=\frac{\sqrt3}{2}$.`,
        r`Here $r=4$. The real part is $a=r\cos\theta=4\cdot\left(-\frac12\right)=-2$.`,
        r`The imaginary part is $b=r\sin\theta=4\cdot\frac{\sqrt3}{2}=2\sqrt3$.`,
        r`Check the modulus: $\sqrt{(-2)^2+(2\sqrt3)^2}=\sqrt{4+12}=4$, which matches $r$.`,
      ],
      answer: r`$-2+2\sqrt3\,i$`,
    },
    method: {
      title: "Three readings of one point",
      paragraphs: [
        r`The modulus of $a+bi$ is the hypotenuse of a right triangle whose legs are $|a|$ and $|b|$, the sizes of the two parts: $\sqrt{a^2+b^2}$. To add two complex numbers, add the real parts and add the imaginary parts. On the plane, the sum is the far corner of the parallelogram built on the two arrows from 0.`,
        r`To go from $a+bi$, other than 0, to polar form, find $r=\sqrt{a^2+b^2}$. Then choose the angle in $[0,2\pi)$, from 0 up to but not including a full turn, whose cosine is $a/r$ and whose sine is $b/r$.`,
      ],
    },
    formal: {
      title: "Polar form",
      paragraphs: [
        r`Every complex number $z\ne0$ can be written $z=r(\cos\theta+i\sin\theta)$ with $r=|z|>0$. The angle $\theta$ is fixed except that adding a full turn, $2\pi$, gives the same point. Then $a=r\cos\theta$ and $b=r\sin\theta$, so $a^2+b^2=r^2$.`,
      ],
    },
    pitfalls: [
      r`The real part goes with the horizontal axis and with cosine.`,
      r`The modulus is $\sqrt{a^2+b^2}$, not $|a|+|b|$.`,
      r`Choose the angle from the signs of both parts. One reference angle fits a point in each of the four quadrants.`,
    ],
    parentGuide: r`Ask the learner to plot $-2+2\sqrt3\,i$ roughly and say which quadrant it lies in before computing an angle.`,
  }),
  lesson({
    id: "complex-conjugate-division",
    title: "Conjugates and dividing complex numbers",
    senses: { square: "square-number" },
    noLink: ["opposite", "standard form", "part", "parts", "change"],
    summary: r`A complex number $a+bi$ has a real part $a$ and an imaginary part $b$, where $i^2=-1$. Its conjugate, $a-bi$, has the opposite imaginary part, and a number times its conjugate is always real. So multiplying the top and bottom of a fraction by the conjugate of the bottom removes $i$ from the bottom. Then the answer can be written as $x+yi$.`,
    objectives: [
      r`Find conjugates, and use $z\bar z=|z|^2$, where $\bar z$ is the conjugate of $z$.`,
      r`Divide complex numbers, and write the exact answer in standard form, $x+yi$.`,
    ],
    intuition: {
      title: "Clearing the imaginary unit from a denominator",
      paragraphs: [
        r`A complex number is $a+bi$, where $a$ and $b$ are real numbers and $i^2=-1$. Its conjugate is $a-bi$, the same number with the opposite imaginary part. For $z=a+bi$ it is written $\bar z$. Multiplying them gives $a^2-(bi)^2=a^2-b^2i^2=a^2+b^2$, a real number with no $i$. That number is $|z|^2$, the square of the modulus, the distance from 0.`,
        r`Standard form for a complex number is $x+yi$ with $x$ and $y$ real. A fraction with $i$ in its denominator, the bottom, is not in that form. Multiplying the top and the bottom by the same number, other than 0, keeps the fraction's value. So multiplying both by the conjugate of the denominator makes the bottom real without changing the answer.`,
      ],
    },
    example: {
      prompt: r`Write $\dfrac{5+i}{2-i}$ in the form $x+yi$.`,
      steps: [
        r`The conjugate of the denominator $2-i$ is $2+i$. Multiply top and bottom by it, which keeps the value of the fraction.`,
        r`Bottom: $(2-i)(2+i)=4-i^2=4+1=5$, since $i^2=-1$.`,
        r`Top: $(5+i)(2+i)=10+5i+2i+i^2=10+7i-1=9+7i$, again using $i^2=-1$.`,
        r`Divide each part by 5: $\frac95+\frac75 i$. Check: $\left(\frac95+\frac75 i\right)(2-i)=\frac{18}{5}+\frac75+\left(\frac{14}{5}-\frac95\right)i=5+i$.`,
      ],
      answer: r`$\frac95+\frac75 i$`,
    },
    method: {
      title: "Conjugate, multiply, divide",
      paragraphs: [
        r`Multiply the numerator, the top, and the denominator, the bottom, by the conjugate of the denominator. If the denominator is $c+di$, it becomes $c^2+d^2$. Multiply the numerator out using $i^2=-1$, then divide the real part and the imaginary part by $c^2+d^2$.`,
        r`Sometimes the parts divide evenly. For $\frac{3+4i}{2+i}$, the top becomes $(3+4i)(2-i)=10+5i$ and the bottom becomes 5, so the quotient is $2+i$. The steps are the same either way.`,
      ],
    },
    formal: {
      title: "Why it works",
      paragraphs: [
        r`For real $a,b$: $(a+bi)(a-bi)=a^2+b^2=|a+bi|^2$. Hence for $c+di\ne0$, $\dfrac{a+bi}{c+di}=\dfrac{(a+bi)(c-di)}{c^2+d^2}=\dfrac{(ac+bd)+(bc-ad)i}{c^2+d^2}$.`,
      ],
    },
    pitfalls: [
      r`Change only the sign of the imaginary part in the conjugate.`,
      r`The new denominator is $c^2+d^2$, a sum, because $-d^2i^2=+d^2$.`,
      r`Divide both the real and the imaginary part by the denominator.`,
    ],
    parentGuide: r`Ask why $(2-i)(2+i)$ has no $i$ in it, and have the learner multiply it out.`,
  }),
  lesson({
    id: "complex-distance-midpoint",
    title: "Distance and midpoint in the complex plane",
    senses: {
      plane: "plane",
      average: "mean-average",
      center: "center",
      change: "change",
      square: "square-number",
      differences: "difference-subtract",
    },
    noLink: ["parts"],
    summary: r`Each complex number $a+bi$ is a point, $a$ across and $b$ up, in the complex plane. So two complex numbers have a distance between them and a midpoint halfway between. Subtracting them and taking the size of the result gives the distance, $|z-w|$. Averaging them gives the midpoint, $\frac{z+w}{2}$.`,
    objectives: [
      "Find the distance between two complex numbers and their midpoint.",
      r`Read $|z-w|=r$ as a circle.`,
    ],
    intuition: {
      title: "Subtract to find the arrow between points",
      paragraphs: [
        r`In the complex plane, $a+bi$ is the point $(a,b)$. Its modulus, $|a+bi|=\sqrt{a^2+b^2}$, is its distance from 0. Subtracting two complex numbers subtracts both coordinates, so $z-w$ is the arrow from $w$ to $z$. The modulus of that arrow, $|z-w|$, is the distance between the two points.`,
        r`The midpoint is the point halfway along the segment between them. Average the real parts and average the imaginary parts: $\frac{z+w}{2}$.`,
        r`For $r>0$, the equation $|z-w|=r$ says that $z$ is a distance $r$ from $w$. The points $z$ that satisfy it form the circle with center $w$ and radius $r$.`,
      ],
    },
    example: {
      prompt: r`Find the distance and the midpoint for $z=1+2i$ and $w=-3-i$.`,
      steps: [
        r`Subtract to get the arrow from $w$ to $z$: $z-w=(1+3)+(2+1)i=4+3i$.`,
        r`Its modulus is the distance: $|z-w|=\sqrt{4^2+3^2}=\sqrt{25}=5$.`,
        r`Midpoint: add the two numbers and halve: $\frac{(1-3)+(2-1)i}{2}=\frac{-2+i}{2}=-1+\frac12 i$.`,
        r`Check: the midpoint should be half of 5, which is $2.5$, from each end. From $z$, the difference is $(1+2i)-\left(-1+\frac12 i\right)=2+\frac32 i$. Its modulus is $\sqrt{4+\frac94}=\frac52$.`,
      ],
      answer: r`Distance $5$; midpoint $-1+\frac12 i$`,
    },
    method: {
      title: "Difference, average, and circles",
      paragraphs: [
        r`Distance: subtract the real parts and the imaginary parts, then take $\sqrt{(\Delta a)^2+(\Delta b)^2}$. Here $\Delta a$, read “delta $a$”, is the change in the real part, and $\Delta b$ is the change in the imaginary part. Midpoint: add and halve. For a missing endpoint $w$, when $z$ and the midpoint $m$ are known, use $w=2m-z$.`,
        r`For a fixed $w$ and $r>0$, the points $z$ with $|z-w|=r$ are exactly the points $r$ away from $w$. They form a circle with center $w$ and radius $r$. For $|z+w|=r$, rewrite it as $|z-(-w)|=r$, so the center is $-w$.`,
      ],
    },
    formal: {
      title: "Definitions",
      paragraphs: [
        r`For complex numbers $z$ and $w$, the distance is $d(z,w)=|z-w|$ and the midpoint is $\frac{z+w}{2}$. The set $\{z:|z-w|=r\}$ with $r>0$ is the circle with center $w$ and radius $r$.`,
      ],
    },
    pitfalls: [
      r`Square both differences before adding; do not add the differences themselves.`,
      r`Halve both parts of the sum for a midpoint.`,
      r`The center of $|z+w|=r$ is $-w$.`,
    ],
    parentGuide: r`Ask the learner to sketch the two points and the midpoint, then check the distances from the midpoint to each end.`,
  }),
  lesson({
    id: "complex-quadratic-factors",
    title: "Factoring and solving over the complex numbers",
    senses: {
      root: "root-equation",
      roots: "root-equation",
      factor: "factor-number",
      factors: "factor-number",
      square: "square-number",
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["whole", "opposite"],
    summary: r`Some quadratics, such as $x^2+9$, are never 0 for a real $x$. With the imaginary unit $i$, the number with $i^2=-1$, they do have roots, and they can be factored. The two roots come as a pair, $p+qi$ and $p-qi$, called conjugates.`,
    objectives: [
      r`Factor $x^2+k^2$ as $(x+ki)(x-ki)$.`,
      "Solve a quadratic whose discriminant is negative, and build a quadratic from a pair of conjugate roots.",
    ],
    intuition: {
      title: "A sum of squares can factor",
      paragraphs: [
        r`The imaginary unit $i$ is the number with $i^2=-1$. Then $(ki)^2=k^2i^2=-k^2$ for any real $k$. So $x^2+k^2=x^2-(ki)^2$. That is a difference of squares, one square minus another, which factors as $(x+ki)(x-ki)$.`,
        r`A root of a quadratic is a value of $x$ that makes it 0. For $x^2+bx+c$, the quadratic formula gives the roots $\frac{-b\pm\sqrt{b^2-4c}}{2}$. The number under the square root, $b^2-4c$, is called the discriminant. When it is negative, the graph never reaches the $x$-axis, so there are no real roots. But $\sqrt{-n}=\sqrt n\,i$ for $n>0$, so the formula still gives two roots.`,
        r`Those two roots are $p+qi$ and $p-qi$: they differ only in the sign of the imaginary part. Two such numbers are called complex conjugates.`,
      ],
    },
    example: {
      prompt: r`Solve $x^2-4x+13=0$.`,
      steps: [
        r`Here $b=-4$ and $c=13$, so the discriminant is $b^2-4c=16-52=-36$. It is negative, so the roots are not real.`,
        r`$\sqrt{-36}=\sqrt{36}\,i=6i$, so the quadratic formula gives $x=\frac{4\pm6i}{2}$.`,
        r`Divide both terms by 2: $x=2\pm3i$.`,
        r`Check: the two roots add to $4$, which is $-b$, and multiply to $(2+3i)(2-3i)=4+9=13$, which is $c$.`,
      ],
      answer: r`$x=2\pm3i$`,
    },
    method: {
      title: "Discriminant first",
      paragraphs: [
        r`For $x^2+bx+c$, compute $b^2-4c$. When it is negative, write its square root as $\sqrt{4c-b^2}\,i$, simplify the radical, and divide the whole top by 2. For $x^2+k^2$, where $b=0$, the roots are $\pm ki$, meaning $ki$ and $-ki$.`,
        r`To build a quadratic from roots $p\pm qi$, use $x^2-(\text{sum})x+\text{product}$. The sum is $2p$ and the product is $p^2+q^2$, so the quadratic is $x^2-2px+(p^2+q^2)$.`,
      ],
    },
    formal: {
      title: "Conjugate pairs",
      paragraphs: [
        r`If $b$ and $c$ are real and $b^2-4c<0$, the roots are $\frac{-b}{2}\pm\frac{\sqrt{4c-b^2}}{2}i$. They are conjugates, so their sum $-b$ and product $c$ are real.`,
      ],
    },
    pitfalls: [
      r`Both factors of $x^2+k^2$ contain $i$, with opposite signs.`,
      r`Divide the whole numerator by 2, including the imaginary term.`,
      r`The product of $p+qi$ and $p-qi$ is $p^2+q^2$.`,
    ],
    parentGuide: r`Ask the learner to expand $(x+3i)(x-3i)$ and explain why the middle terms cancel.`,
  }),
  lesson({
    id: "polynomial-root-count",
    title: "How many roots does a polynomial have?",
    senses: {
      degree: "degree-polynomial",
      root: "root-equation",
      roots: "root-equation",
      term: "term-expression",
      terms: "term-expression",
      factor: "factor-number",
      factors: "factor-number",
    },
    noLink: ["changes"],
    summary: r`A polynomial's degree, its highest power of $x$, tells exactly how many roots it has once complex numbers, numbers $a+bi$ with $i^2=-1$, are allowed. A repeated root counts once for each time it repeats. If the coefficients are real, every root that is not real comes with its conjugate, so those roots come in pairs.`,
    objectives: [
      "Count the complex roots of a polynomial, counting a repeated root each time it repeats.",
      "Use conjugate pairs to find how many roots of a polynomial with real coefficients can be real.",
    ],
    intuition: {
      title: "Degree counts roots",
      paragraphs: [
        r`A polynomial in $x$ is a sum of terms like $3x^4$ and $-2x$. Its degree is the largest exponent of $x$. A root of a polynomial $p(x)$ is a number $a$ with $p(a)=0$. If the factor $(x-a)$ appears $m$ times, the root $a$ has multiplicity $m$ and is counted $m$ times.`,
        r`The Fundamental Theorem of Algebra says that, once complex numbers are allowed, a polynomial of degree $n\ge1$ has exactly $n$ roots, counting multiplicity. For example, $x^2+1$ has degree 2 and the two roots $i$ and $-i$.`,
        r`The numbers multiplying the powers of $x$ are called coefficients. If every coefficient is real, a root that is not real, such as $2+3i$, always comes with its conjugate $2-3i$. So the roots that are not real come two at a time.`,
      ],
    },
    example: {
      prompt: r`A polynomial with real coefficients has degree $6$ and the roots $1+2i$ and $3$. At most how many of its roots are real?`,
      steps: [
        r`The degree is $6$, so there are $6$ roots in all, counting multiplicity.`,
        r`The coefficients are real and $1+2i$ is not real, so its conjugate $1-2i$ is also a root. That makes $2$ roots that are not real.`,
        r`The remaining $6-2=4$ roots could all be real.`,
        r`Check: $3$ is one of those $4$, and nothing forces any other root to be not real.`,
      ],
      answer: r`$4$`,
    },
    method: {
      title: "Count, pair, subtract",
      paragraphs: [
        r`To get the degree from factors, add each factor's own degree times its exponent: $(x-2)^3$ contributes 3, $x^2+k$ contributes 2, and $(x^2+1)^3$ contributes 6. For a polynomial with real coefficients, list the roots that are not real together with their conjugates, then subtract that count from the degree.`,
        r`The number of real roots, counting multiplicity, is even when the degree is even and odd when the degree is odd. That is because the roots that are not real add an even number.`,
      ],
    },
    formal: {
      title: "Statement",
      paragraphs: [
        r`Fundamental Theorem of Algebra: every polynomial of degree at least 1 with complex coefficients has a complex root. So a polynomial of degree $n$ factors as $a(x-r_1)\cdots(x-r_n)$, where $r_1,\ldots,r_n$ are its roots. If the coefficients are real and $p(z)=0$, then $p(\bar z)=\overline{p(z)}=0$, where the bar means conjugate. So $\bar z$ is also a root, with the same multiplicity.`,
      ],
    },
    pitfalls: [
      r`Count multiplicity: $(x-2)^3$ gives three roots.`,
      r`If the coefficients are real, a root that is not real forces its conjugate.`,
      r`The listed roots may not be all of the roots; the degree says how many there are.`,
    ],
    parentGuide: r`Ask how many roots $x^2+1$ has and what they are, then ask what changes for $(x^2+1)^2$.`,
  }),
  lesson({
    id: "polar-cartesian-conversion",
    title: "Polar and Cartesian coordinates",
    senses: { units: "unit" },
    noLink: ["face", "faces", "opposite", "side"],
    summary: r`There are two ways to give directions to a point. Cartesian coordinates $(x,y)$ say how far across and how far up. Polar coordinates $(r,\theta)$ say which way to face, an angle $\theta$, and how far to walk, $r$, where a negative $r$ means walking backward. One point has many polar names, because turning a full circle faces the same way again.`,
    objectives: [
      "Convert between polar and Cartesian coordinates at special angles.",
      "Find equivalent polar names, including with negative $r$.",
    ],
    intuition: {
      title: "Turn, then travel",
      paragraphs: [
        r`Cartesian coordinates $(x,y)$ say how far to go across and up. Polar coordinates $(r,\theta)$ say to turn counterclockwise by the angle $\theta$ from the positive $x$-axis, then travel $r$ units in that direction. If $r$ is negative you travel $|r|$ units the opposite way.`,
        r`Angles here are in radians: a full turn is $2\pi$ radians, the same as $360^\circ$. A full turn returns to the same direction, so adding $2\pi$ to $\theta$ names the same point.`,
        r`On the unit circle, the point at angle $\theta$ is $(\cos\theta,\sin\theta)$. Walking $r$ units instead of 1 multiplies both coordinates by $r$, so $x=r\cos\theta$ and $y=r\sin\theta$.`,
      ],
    },
    example: {
      prompt: r`Convert $\left(4,\frac{5\pi}{6}\right)$ to Cartesian coordinates.`,
      steps: [
        r`$\frac{5\pi}{6}=150^\circ$, in the second quadrant, the upper left. Its reference angle, the acute angle to the $x$-axis, is $30^\circ$. So $\cos\frac{5\pi}{6}=-\frac{\sqrt3}{2}$, negative because the point is left of the $y$-axis, and $\sin\frac{5\pi}{6}=\frac12$.`,
        r`Here $r=4$, so $x=r\cos\theta=4\cdot\left(-\frac{\sqrt3}{2}\right)=-2\sqrt3$.`,
        r`$y=r\sin\theta=4\cdot\frac12=2$.`,
        r`Check: the distance from the origin is $\sqrt{(-2\sqrt3)^2+2^2}=\sqrt{12+4}=4$, the given $r$.`,
      ],
      answer: r`$(-2\sqrt3,\,2)$`,
    },
    method: {
      title: "Both directions",
      paragraphs: [
        r`Polar to Cartesian: $x=r\cos\theta$, $y=r\sin\theta$. Cartesian to polar, for a point other than the origin: $r=\sqrt{x^2+y^2}$, then the angle whose cosine is $x/r$ and whose sine is $y/r$. The signs of $x$ and $y$ tell you the quadrant.`,
        r`Equivalent names of $(r,\theta)$: $(r,\theta+2\pi)$ and $(-r,\theta+\pi)$. To remove a negative $r$, flip its sign and add $\pi$.`,
      ],
    },
    formal: {
      title: "Relations",
      paragraphs: [
        r`For $r\ne0$, the point $(x,y)=(r\cos\theta,r\sin\theta)$ satisfies $x^2+y^2=r^2$. Every point other than the origin has exactly one polar name with $r>0$ and $0\le\theta<2\pi$; the origin has $r=0$ and any $\theta$.`,
      ],
    },
    pitfalls: [
      r`$x$ goes with cosine and $y$ with sine.`,
      r`Choose the quadrant from the signs of $x$ and $y$.`,
      r`A negative $r$ alone puts the point on the other side; also turn by $\pi$ to keep the same point.`,
    ],
    parentGuide: r`Ask the learner where $(-2,\frac{\pi}{2})$ lies and why it is not on the positive $y$-axis.`,
  }),
  lesson({
    id: "parametric-linear-motion",
    title: "Linear parametric motion",
    senses: {
      rule: "rule",
      rules: "rule",
      parameter: "parameter",
      model: "model",
      change: "change",
      changes: "change",
      unit: "unit",
      terms: "term-expression",
    },
    noLink: ["third"],
    summary: r`To describe something moving, give its position at each moment: one rule for how far across, $x$, and one for how far up, $y$, both depending on the time $t$. These are called parametric equations. Removing $t$ from the two rules gives one equation for the path, and the rates of change give the speed and direction.`,
    objectives: [
      "Find position, timing, speed and direction from $x(t)$ and $y(t)$.",
      "Eliminate the parameter to write a linear path.",
    ],
    intuition: {
      title: "One clock, two coordinates",
      paragraphs: [
        r`Instead of writing $y$ as a function of $x$, a parametric model writes both coordinates as functions of a third variable, the parameter, usually time $t$. At each $t$ the point $(x(t),y(t))$ is where the object is.`,
        r`In a linear model $x(t)=x_0+at$ and $y(t)=y_0+bt$, the point $(x_0,y_0)$ (read “$x$ naught, $y$ naught”) is the starting position, at $t=0$. The numbers $a$ and $b$ are the rates: how much $x$ and $y$ change in each unit of time. Each unit of time, the object moves $a$ across and $b$ up, so by the Pythagorean theorem it travels $\sqrt{a^2+b^2}$, its speed.`,
      ],
    },
    example: {
      prompt: r`A cart has $x(t)=2+3t$ and $y(t)=1-2t$ (meters, seconds). Find its path as $y$ in terms of $x$ and its speed.`,
      steps: [
        r`To remove $t$, first solve $x=2+3t$ for $t$: $t=\frac{x-2}{3}$.`,
        r`Substitute it into the rule for $y$: $y=1-2\cdot\frac{x-2}{3}=1-\frac23x+\frac43=-\frac23x+\frac73$.`,
        r`Each second $x$ changes by $3$ and $y$ by $-2$, so the speed is $\sqrt{3^2+(-2)^2}=\sqrt{13}$ m/s.`,
        r`Check at $t=1$: the position $(5,-1)$ satisfies $y=-\frac23(5)+\frac73=-1$.`,
      ],
      answer: r`$y=-\frac23x+\frac73$; speed $\sqrt{13}$ m/s`,
    },
    method: {
      title: "Evaluate, solve, eliminate",
      paragraphs: [
        r`Position at a time: substitute. A time for a given coordinate: set that coordinate's equation equal to the value and solve. Path: solve one equation for $t$ and substitute into the other. When $a\ne0$, the slope is $\frac{b}{a}$.`,
        r`Direction: $a>0$ moves right and $a<0$ left; $b>0$ moves up and $b<0$ down. Speed: $\sqrt{a^2+b^2}$.`,
      ],
    },
    formal: {
      title: "Linear parametric equations",
      paragraphs: [
        r`If $x(t)=x_0+at$ and $y(t)=y_0+bt$ with $a\ne0$, then every position satisfies $y-y_0=\frac{b}{a}(x-x_0)$. From time 0 to a time $t\ge0$, the object moves a distance $t\sqrt{a^2+b^2}$.`,
      ],
    },
    pitfalls: [
      r`Include the starting position when evaluating.`,
      r`The path's slope is $y$'s rate over $x$'s rate, not the reverse.`,
      r`The speed uses both rates.`,
    ],
    parentGuide: r`Ask the learner to plot the position at $t=0,1,2$ and see that the points lie on one line.`,
  }),
  lesson({
    id: "conic-standard-form",
    title: "Conic sections from equations",
    senses: {
      squared: "square-number",
      square: "square-number",
      squares: "square-number",
      center: "center",
      term: "term-expression",
      terms: "term-expression",
      sides: "side-of-equation",
      factor: "factor-number",
    },
    noLink: ["opposite"],
    summary: r`Slicing a cone, like an ice-cream cone, at different angles gives four curves: a circle, an oval called an ellipse, a U-shaped parabola, and a two-piece hyperbola. These are the conic sections. In an equation, which variables are squared, and how, tells which curve it is. Rewriting the equation by completing the square, turning $x^2+bx$ into a perfect square, shows where the curve sits: its center, or a parabola's vertex.`,
    objectives: [
      "Identify a conic from its equation.",
      "Read a center or axis ends, and complete the square in general form.",
    ],
    intuition: {
      title: "Four curves from one idea",
      paragraphs: [
        r`Slicing a cone gives four curves. In an equation, look at the squared variables. If only one variable is squared, the graph is a parabola. If both are squared and added, it is a circle (equal coefficients) or an ellipse (different ones). If both are squared and subtracted, it is a hyperbola. A few equations of these shapes give only a point, a line or no graph at all, such as $x^2+y^2=0$, which is just the origin.`,
        r`The coefficient of a squared term is the number multiplying it. Shifting a graph $h$ right and $k$ up replaces $x$ by $x-h$ and $y$ by $y-k$. So the center is the point that makes both bracketed expressions zero.`,
        r`Completing the square rewrites $x^2+bx$ as a square minus a number: add $\left(\frac b2\right)^2$, the square of half the coefficient of $x$, to make $\left(x+\frac b2\right)^2$. Adding the same amount to both sides keeps the equation true.`,
      ],
    },
    example: {
      prompt: r`Find the center and radius of the circle $x^2+y^2-6x+4y-12=0$.`,
      steps: [
        r`Group the $x$ terms and the $y$ terms, and move the constant to the right: $(x^2-6x)+(y^2+4y)=12$.`,
        r`Half of $-6$ is $-3$ and $(-3)^2=9$. Half of $4$ is $2$ and $2^2=4$. Add $9$ and $4$ to both sides to complete both squares.`,
        r`Since $x^2-6x+9=(x-3)^2$ and $y^2+4y+4=(y+2)^2$, this gives $(x-3)^2+(y+2)^2=12+9+4=25$.`,
        r`The center is $(3,-2)$ and the radius is $\sqrt{25}=5$. Check: $(3,3)$ gives $0+25=25$ and satisfies the original equation.`,
      ],
      answer: r`Center $(3,-2)$, radius $5$`,
    },
    method: {
      title: "Identify, then read or complete",
      paragraphs: [
        r`In completed-square form, such as $(x-h)^2$ and $(y-k)^2$, the center is $(h,k)$: each coordinate is the opposite of the number added inside its bracket. An ellipse $\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1$ extends $a$ horizontally and $b$ vertically from $(h,k)$; the longer axis follows the larger denominator.`,
        r`In general form, group each variable. If a variable has a leading coefficient other than 1, factor it out first; the amount added on the right is multiplied by that coefficient.`,
      ],
    },
    formal: {
      title: "Standard forms",
      paragraphs: [
        r`Circle: $(x-h)^2+(y-k)^2=r^2$. Ellipse: $\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1$ with $a\ne b$. Hyperbola: $\frac{(x-h)^2}{a^2}-\frac{(y-k)^2}{b^2}=\pm1$. Parabola: $(x-h)^2=4p(y-k)$ or $(y-k)^2=4p(x-h)$.`,
      ],
    },
    pitfalls: [
      r`The sign inside a bracket is opposite the coordinate.`,
      r`A denominator is a squared distance; take its square root.`,
      r`Factor out the leading coefficient before halving.`,
    ],
    parentGuide: r`Ask the learner what happens to $(x-3)^2+(y+2)^2=25$ if the plus becomes a minus.`,
  }),
  {
    ...lesson({
      id: "parabola-focus-directrix",
      title: "Parabolas from focus and directrix",
      summary: r`Pick a point and a line that does not pass through it. Mark every spot that is exactly as far from the point as from the line. Those spots form a U-shaped curve called a parabola. The point is called the focus and the line is called the directrix. This lesson turns a focus and directrix into the parabola's equation, and back again.`,
      objectives: [
        "Find the vertex, the number $p$ and the equation from a focus and a directrix.",
        "Find the focus and the directrix from an equation, including a parabola that opens sideways.",
      ],
      intuition: {
        title: "Equal distance to a point and a line",
        paragraphs: [
          r`Pick a point, called the focus, and a line that does not pass through it, called the directrix. The distance from a point to a line is measured straight across, at a right angle (a square corner) to the line. All the points that are the same distance from the focus as from the directrix form a parabola.`,
          r`The vertex is the turning point of the parabola. It is the point of the curve nearest the directrix, and it sits exactly halfway between the focus and the directrix.`,
          r`Let $p$ be the distance from the vertex to the focus. Give it a minus sign if the focus is below the vertex. A parabola that opens up or down, with vertex $(h, k)$, has the equation $(x - h)^2 = 4p(y - k)$. The closing section shows where this comes from.`,
          r`For example, with vertex $(0, 0)$ and $p = 1$, the equation is $x^2 = 4y$. The point $(2, 1)$ is on it, because $2^2 = 4 = 4 \times 1$.`,
        ],
      },
      example: {
        prompt: r`Find the equation of the parabola with focus $(1,5)$ and directrix $y=1$.`,
        steps: [
          r`Find the vertex. The directrix $y = 1$ is horizontal, so measure straight up from it, along $x = 1$, to the focus at $y = 5$. Halfway between $y = 1$ and $y = 5$ is $y = 3$, so the vertex is $(1, 3)$.`,
          r`Find $p$, the distance from the vertex up to the focus: $p = 5 - 3 = 2$. It is positive because the focus is above the vertex. So $4p = 8$.`,
          r`Put $h = 1$, $k = 3$ and $4p = 8$ into $(x - h)^2 = 4p(y - k)$: $(x - 1)^2 = 8(y - 3)$.`,
          r`Check with the point $(5, 5)$. Its distance to the focus $(1, 5)$ is $5 - 1 = 4$, and its distance down to the line $y = 1$ is $5 - 1 = 4$. They match. The equation agrees: $(5 - 1)^2 = 16$ and $8(5 - 3) = 16$.`,
        ],
        answer: r`$(x-1)^2=8(y-3)$`,
      },
      method: {
        title: "Vertex, focal distance, equation",
        paragraphs: [
          r`From a focus and directrix: find the vertex first, then $p$ (positive if the focus is above the vertex), then write the equation.`,
          r`From an equation: the vertex is $(h, k)$, and the number in front of the bracket is $4p$, so divide it by 4 to get $p$. The focus is $|p|$ units from the vertex, in the direction the parabola opens, and the directrix is $|p|$ units away on the other side. Here $|p|$ means the size of $p$ without its sign.`,
          r`For $(y - k)^2 = 4p(x - h)$, the roles of $x$ and $y$ swap. The parabola opens sideways, and the focus is $(h + p, k)$.`,
        ],
      },
      formal: {
        title: "Derivation",
        paragraphs: [
          r`Put the focus at $(h, k + p)$ and the directrix at $y = k - p$, so the vertex $(h, k)$ is halfway between. A point $(x, y)$ is on the parabola when its distance to the focus equals its distance to the line: $\sqrt{(x - h)^2 + (y - k - p)^2} = |y - k + p|$. The left side, the part before the equals sign, uses the distance formula. The bars mean the distance is never negative.`,
          r`Squaring means multiplying something by itself. Square both sides and multiply out, and the $(y - k)^2$ and $p^2$ parts cancel. What is left is $(x - h)^2 = 4p(y - k)$.`,
        ],
      },
      pitfalls: [
        r`The number in front of the bracket is $4p$, not $p$.`,
        r`The vertex is halfway between the focus and the directrix, not at the focus.`,
        r`For a parabola that opens sideways, the focus moves left or right, not up or down.`,
      ],
      parentGuide: r`Ask the learner to pick a point on the parabola, measure its distance to the focus and to the directrix, and check that they are equal.`,
    }),
    senses: focusSenses,
    noLink: [
      "part",
      "parts",
      "change",
      "changes",
      "leaves",
      "key",
      "jumps",
      "jump",
      "third",
      "mean",
      "means",
      "sort",
      "image",
      "images",
      "solid",
      "scales",
      "net",
      "inverse",
      "population",
      "whole",
      "more than",
      "period",
      "periods",
      "quarter",
      "quarters",
      "one quarter",
      "mirror image",
      "rule",
      "rules",
      "opposite",
      "opposites",
      "unit",
      "units",
      "average",
      "decreasing",
      "increasing",
      "model",
      "models",
      "pattern",
      "patterns",
    ],
  },
];
