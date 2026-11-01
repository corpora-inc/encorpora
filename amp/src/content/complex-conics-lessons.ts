import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const r = String.raw;

export const complexConicsMethods: Record<string, ProblemMethod> = {
  "complex-plane-forms": {
    goal: "Given a complex number as a point, a sum of points, a modulus request or a polar form, find the requested exact value.",
    intuition: r`A complex number $a+bi$ is the point $(a,b)$: $a$ counts across the real axis and $b$ counts up the imaginary axis. Its distance from 0 is its modulus. The same point can be named by that distance $r$ and an angle $\theta$ from the positive real axis.`,
    terms: ["modulus", "polar-form"],
    method: [
      r`Read the real part from the horizontal coordinate and the imaginary part from the vertical coordinate.`,
      r`For a modulus, apply the Pythagorean theorem to the two parts. For a sum, add real parts and add imaginary parts.`,
      r`To change polar to $a+bi$, use $a=r\cos\theta$ and $b=r\sin\theta$. To go back, find $r$, then the angle whose cosine and sine have the signs of $a$ and $b$.`,
    ],
    watch: r`The real part uses cosine and the horizontal axis. Check the quadrant before choosing an angle: the reference angle alone does not say which quadrant.`,
  },
  "complex-conjugate-division": {
    goal: "Given a complex number or a quotient of complex numbers, use the conjugate to give an exact standard-form result.",
    intuition: r`Changing the sign of the imaginary part of $a+bi$ gives its conjugate $a-bi$. Multiplying a number by its conjugate cancels the $i$ and leaves a real number, which is why a conjugate can clear $i$ from a denominator.`,
    terms: [
      "complex-conjugate",
      [
        "complex-number",
        "For a complex number, it is $x + yi$ with $x$ and $y$ real; fractions are allowed.",
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
    intuition: r`Subtracting two complex numbers gives the arrow from one to the other. The modulus of that arrow is the distance between the points. The midpoint is where the average of the two numbers lies.`,
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
      r`Read $|z-w|=r$ as "$z$ is $r$ away from $w$": a circle with center $w$ and radius $r$.`,
    ],
    watch: r`Rewrite $|z+w|$ as $|z-(-w)|$ before reading a center. The distance squares both differences before adding.`,
  },
  "complex-quadratic-factors": {
    goal: "Factor a sum of squares or solve or build a quadratic whose roots are not real.",
    intuition: r`A sum of squares $x^2+k^2$ has no real roots, but $(ki)^2=-k^2$, so it has two imaginary roots. A quadratic with a negative discriminant has two roots that are conjugates of each other.`,
    terms: [
      ["discriminant", "For $x^2 + bx + c$, where $a = 1$, it is $b^2 - 4c$."],
      "complex-conjugate",
    ],
    method: [
      r`For $x^2+k^2$ write $x^2-(ki)^2$ and factor as a difference of squares: $(x+ki)(x-ki)$.`,
      r`For a quadratic, compute $b^2-4c$. If it is negative, write $\sqrt{b^2-4c}=\sqrt{4c-b^2}\,i$, simplify the radical, and divide by 2.`,
      r`To build a quadratic from roots, use $x^2-(\text{sum})x+\text{product}$; for $p\pm qi$ the sum is $2p$ and the product is $p^2+q^2$.`,
    ],
    watch: r`Both factors need an $i$ and opposite signs. Divide the whole numerator by 2 in the quadratic formula, and remember that $q^2$ adds to $p^2$ in the product.`,
  },
  "polynomial-root-count": {
    goal: "Given a polynomial, count its complex roots with multiplicity or use conjugate pairs to restrict its real and nonreal roots.",
    intuition: r`Every polynomial of degree $n\ge1$ has exactly $n$ roots among the complex numbers when a root of multiplicity $m$ is counted $m$ times. When the coefficients are real, a nonreal root always comes with its conjugate.`,
    terms: [
      "multiplicity",
      [
        "coefficient",
        "Here every coefficient is a real number, so nonreal roots come in conjugate pairs.",
      ],
      "real-number",
    ],
    method: [
      r`Find the degree, or add the exponents of all the factors. That total is the number of complex roots.`,
      r`For a real polynomial, pair each nonreal root with its conjugate. The number of nonreal roots is even.`,
      r`Subtract the forced nonreal roots from the degree to find how many real roots remain possible.`,
    ],
    watch: r`Count roots with multiplicity, and count factors like $x^2+k$ as two roots. A single nonreal root of a real polynomial is never alone.`,
  },
  "polar-cartesian-conversion": {
    goal: "Convert between polar and Cartesian coordinates at special angles, and recognize different polar names for one point.",
    intuition: r`A point can be located by two steps: turn through an angle $\theta$ from the positive $x$-axis, then move $r$ units. If $r$ is negative, move that distance in the opposite direction. Different turns can end at the same point.`,
    terms: ["polar-coordinates", "reference-angle"],
    method: [
      r`For polar to Cartesian, use $x=r\cos\theta$ and $y=r\sin\theta$, keeping the sign of $r$.`,
      r`For Cartesian to polar, use $r=\sqrt{x^2+y^2}$, then the angle in $[0,2\pi)$ whose cosine is $x/r$ and sine is $y/r$.`,
      r`For another name, add $2\pi$ to the angle, or change the sign of $r$ and add $\pi$.`,
    ],
    watch: r`Choose the quadrant from the signs of $x$ and $y$; the reference angle alone fits four points. A negative $r$ reverses direction, so the angle must also turn by $\pi$ to keep the same point.`,
  },
  "parametric-linear-motion": {
    goal: "Given linear equations $x(t)$ and $y(t)$ for a moving object, find its position, path, speed, a time, or its direction.",
    intuition: r`A parametric model gives each coordinate as its own function of time. At each time $t$ the pair $(x(t),y(t))$ is the object's position. When both functions are linear, the object moves along a line at a steady speed.`,
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
      r`To eliminate $t$, solve one equation for $t$ and substitute into the other. The slope of the path is $\frac{b}{a}$, the ratio of the rates.`,
      r`Read direction from the signs of the rates, and speed from $\sqrt{a^2+b^2}$.`,
    ],
    watch: r`Include the starting position when evaluating. The slope of the path is $y$'s rate divided by $x$'s rate, and the speed combines both rates.`,
  },
  "conic-standard-form": {
    goal: "Given a conic equation, name the curve, read its center or axis ends, or complete the square to find its center and size.",
    intuition: r`Circles, ellipses, parabolas and hyperbolas are the curves made by slicing a cone. Their equations differ in which variables are squared, whether the squared terms are added or subtracted, and whether their denominators match.`,
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
    goal: "Given a focus and directrix, or a parabola equation, find the vertex, equation, focus or directrix.",
    intuition: r`A parabola is every point that is the same distance from a fixed point (the focus) and a fixed line (the directrix). The vertex is the point of the curve closest to both, halfway between them.`,
    terms: [
      "focus",
      "directrix",
      [
        "focus",
        "$p$ is the signed distance from the vertex to the focus, along the axis of symmetry.",
      ],
    ],
    method: [
      r`The vertex is the midpoint of the focus and the nearest point of the directrix; $p$ is the distance from the vertex to the focus, positive when the parabola opens up (or right).`,
      r`Write $(x-h)^2=4p(y-k)$ for a vertical parabola, or $(y-k)^2=4p(x-h)$ for a horizontal one.`,
      r`To read an equation, match it to the form: the vertex is $(h,k)$, the bracket coefficient is $4p$, the focus is $p$ from the vertex and the directrix is $p$ on the other side.`,
    ],
    watch: r`The coefficient is $4p$, not $p$; $p$ is half the distance from focus to directrix; and the vertex is halfway, not at the focus.`,
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
  "conic-standard-form": r`Each conic is the set of points satisfying a second-degree equation. $(x-h)^2+(y-k)^2=r^2$ is a circle, $\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1$ with $a\ne b$ is an ellipse, and a minus sign between the squared terms gives a hyperbola. An equation with one squared variable is a parabola.`,
  "parabola-focus-directrix": r`The parabola with focus $(h,k+p)$ and directrix $y=k-p$ is $(x-h)^2=4p(y-k)$: a point $(x,y)$ is equally far from the focus and the directrix exactly when this holds.`,
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
};
const lesson = (s: Spec): Lesson => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
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
    summary: r`A complex number $a+bi$ is the point $(a,b)$. Its distance from 0 is the modulus, and its direction is an angle.`,
    objectives: [
      "Read a complex number from a point and add complex numbers as arrows.",
      r`Find a modulus and convert between $a+bi$ and $r(\cos\theta+i\sin\theta)$ at special angles.`,
    ],
    intuition: {
      title: "A number as a point",
      paragraphs: [
        r`A complex number $a+bi$ has a real part $a$ and an imaginary part $b$, where $i^2=-1$. Draw a plane whose horizontal axis counts real parts and whose vertical axis counts imaginary parts. Then $a+bi$ is the point $a$ units across and $b$ units up, with negative values going left or down.`,
        r`The point also has a distance from 0, called the modulus, and a direction, given by the angle from the positive real axis. Giving the distance $r$ and the angle $\theta$ names the same number in polar form.`,
      ],
    },
    example: {
      prompt: r`Write $4\left(\cos\frac{2\pi}{3}+i\sin\frac{2\pi}{3}\right)$ in the form $a+bi$.`,
      steps: [
        r`The angle $\frac{2\pi}{3}$ is $120^\circ$, in the second quadrant. Its reference angle is $60^\circ$, so $\cos\frac{2\pi}{3}=-\frac12$ and $\sin\frac{2\pi}{3}=\frac{\sqrt3}{2}$.`,
        r`The real part is $a=r\cos\theta=4\cdot\left(-\frac12\right)=-2$.`,
        r`The imaginary part is $b=r\sin\theta=4\cdot\frac{\sqrt3}{2}=2\sqrt3$.`,
        r`Check the modulus: $\sqrt{(-2)^2+(2\sqrt3)^2}=\sqrt{4+12}=4$, which matches $r$.`,
      ],
      answer: r`$-2+2\sqrt3\,i$`,
    },
    method: {
      title: "Three readings of one point",
      paragraphs: [
        r`The modulus of $a+bi$ is the hypotenuse of the right triangle with legs $|a|$ and $|b|$: $\sqrt{a^2+b^2}$. Adding two numbers adds their real parts and their imaginary parts, which is the diagonal of the parallelogram built on the two arrows.`,
        r`To go from $a+bi$ to polar form, find $r$, then choose the angle in $[0,2\pi)$ whose cosine is $a/r$ and whose sine is $b/r$.`,
      ],
    },
    formal: {
      title: "Polar form",
      paragraphs: [
        r`Every complex number $z\ne0$ can be written $z=r(\cos\theta+i\sin\theta)$ with $r=|z|>0$ and $\theta$ determined up to adding multiples of $2\pi$. Then $a=r\cos\theta$ and $b=r\sin\theta$, so $a^2+b^2=r^2$.`,
      ],
    },
    pitfalls: [
      r`The real part goes with the horizontal axis and with cosine.`,
      r`The modulus is $\sqrt{a^2+b^2}$, not $|a|+|b|$.`,
      r`Pick the angle from the signs of both parts; the reference angle fits four quadrants.`,
    ],
    parentGuide: r`Ask the learner to plot $-2+2\sqrt3\,i$ roughly and say which quadrant it lies in before computing an angle.`,
  }),
  lesson({
    id: "complex-conjugate-division",
    title: "Conjugates and dividing complex numbers",
    summary: r`Multiplying by the conjugate makes a denominator real, so a quotient can be written as $x+yi$.`,
    objectives: [
      r`Use $z\bar z=|z|^2$ and find conjugates.`,
      "Divide complex numbers into exact standard form.",
    ],
    intuition: {
      title: "Clearing the imaginary unit from a denominator",
      paragraphs: [
        r`A complex number is $a+bi$ with $i^2=-1$. Its conjugate $a-bi$ has the opposite imaginary part. Multiplying them gives $a^2-(bi)^2=a^2+b^2$, a real number with no $i$.`,
        r`A fraction with $i$ in the denominator cannot be simplified directly. Multiplying top and bottom by the conjugate of the denominator keeps the value and makes the denominator real.`,
      ],
    },
    example: {
      prompt: r`Write $\dfrac{5+i}{2-i}$ in the form $x+yi$.`,
      steps: [
        r`The conjugate of the denominator $2-i$ is $2+i$. Multiply top and bottom by it.`,
        r`Bottom: $(2-i)(2+i)=4-i^2=4+1=5$.`,
        r`Top: $(5+i)(2+i)=10+5i+2i+i^2=10+7i-1=9+7i$.`,
        r`Divide each part by 5: $\frac95+\frac75 i$. Check: $\left(\frac95+\frac75 i\right)(2-i)=\frac{18}{5}+\frac75+\left(\frac{14}{5}-\frac95\right)i=5+i$.`,
      ],
      answer: r`$\frac95+\frac75 i$`,
    },
    method: {
      title: "Conjugate, multiply, divide",
      paragraphs: [
        r`Multiply the numerator and the denominator by the conjugate of the denominator. The denominator becomes $c^2+d^2$. Multiply the numerator out using $i^2=-1$, then divide the real part and the imaginary part by $c^2+d^2$.`,
        r`If the quotient is exact, such as $\frac{-4+7i}{2+i}$ giving a whole-number result, the division still works the same way.`,
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
    summary: r`The distance between $z$ and $w$ is $|z-w|$ and their midpoint is the average $\frac{z+w}{2}$.`,
    objectives: [
      "Find the distance and midpoint of two complex numbers.",
      r`Read $|z-w|=r$ as a circle.`,
    ],
    intuition: {
      title: "Subtract to find the arrow between points",
      paragraphs: [
        r`In the complex plane $a+bi$ is the point $(a,b)$, and the modulus $|a+bi|=\sqrt{a^2+b^2}$ is its distance from 0. Subtracting two numbers subtracts both coordinates, so $z-w$ is the arrow from $w$ to $z$. Its modulus is the distance between the two points.`,
        r`The midpoint is halfway along the segment: average the real parts and average the imaginary parts.`,
      ],
    },
    example: {
      prompt: r`Find the distance and the midpoint for $z=1+2i$ and $w=-3-i$.`,
      steps: [
        r`$z-w=(1+3)+(2+1)i=4+3i$.`,
        r`$|z-w|=\sqrt{4^2+3^2}=\sqrt{25}=5$.`,
        r`Midpoint: $\frac{(1-3)+(2-1)i}{2}=\frac{-2+i}{2}=-1+\frac12 i$.`,
        r`Check: the midpoint is $2.5$ from each end because half of $5$ is $2.5$.`,
      ],
      answer: r`Distance $5$; midpoint $-1+\frac12 i$`,
    },
    method: {
      title: "Difference, average, and circles",
      paragraphs: [
        r`Distance: subtract, then $\sqrt{(\Delta a)^2+(\Delta b)^2}$. Midpoint: add and halve. A missing endpoint: $w=2m-z$.`,
        r`$|z-w|=r$ says every $z$ is $r$ away from $w$. These points form a circle with center $w$ and radius $r$. For $|z+w|=r$, rewrite as $|z-(-w)|=r$.`,
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
    summary: r`Using $i^2=-1$, $x^2+k^2$ factors, and quadratics with negative discriminant have conjugate roots.`,
    objectives: [
      r`Factor $x^2+k^2$ as $(x+ki)(x-ki)$.`,
      "Solve quadratics with negative discriminant and build one from conjugate roots.",
    ],
    intuition: {
      title: "A sum of squares can factor",
      paragraphs: [
        r`The number $i$ satisfies $i^2=-1$. Then $(ki)^2=k^2i^2=-k^2$ for any real $k$. So $x^2+k^2=x^2-(ki)^2$, a difference of squares, which factors.`,
        r`The same idea gives the roots of a quadratic whose graph does not reach the $x$-axis: the quadratic formula has a negative number under the square root, and $\sqrt{-n}=\sqrt n\,i$.`,
      ],
    },
    example: {
      prompt: r`Solve $x^2-4x+13=0$.`,
      steps: [
        r`The discriminant is $b^2-4c=16-52=-36$, which is negative.`,
        r`$\sqrt{-36}=6i$, so $x=\frac{4\pm6i}{2}$.`,
        r`Divide both terms by 2: $x=2\pm3i$.`,
        r`Check: the sum of the roots is $4$ and their product is $4+9=13$, matching $-b$ and $c$.`,
      ],
      answer: r`$x=2\pm3i$`,
    },
    method: {
      title: "Discriminant first",
      paragraphs: [
        r`For $x^2+bx+c$, compute $b^2-4c$. When it is negative, write the root as $\sqrt{4c-b^2}\,i$, simplify the radical, and divide the whole numerator by 2. For $x^2+k^2$ with $b=0$ the roots are $\pm ki$.`,
        r`To build a quadratic from roots $p\pm qi$: the sum is $2p$ and the product is $p^2+q^2$, so the quadratic is $x^2-2px+(p^2+q^2)$.`,
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
    summary: r`A degree-$n$ polynomial has $n$ complex roots counting multiplicity; real polynomials pair nonreal roots with conjugates.`,
    objectives: [
      "Count complex roots with multiplicity.",
      "Use conjugate pairs to bound the real roots of a real polynomial.",
    ],
    intuition: {
      title: "Degree counts roots",
      paragraphs: [
        r`A root of a polynomial $p(x)$ is a number $a$ with $p(a)=0$. The degree is the largest exponent of $x$. The Fundamental Theorem of Algebra says that, allowing complex numbers, a polynomial of degree $n\ge1$ has exactly $n$ roots when a root that appears $m$ times as a factor is counted $m$ times.`,
        r`If every coefficient is real, a nonreal root such as $2+3i$ always arrives with its conjugate $2-3i$, so nonreal roots come two at a time.`,
      ],
    },
    example: {
      prompt: r`A polynomial with real coefficients has degree $6$ and the roots $1+2i$ and $3$. At most how many of its roots are real?`,
      steps: [
        r`There are $6$ roots in all, counting multiplicity.`,
        r`The root $1+2i$ is nonreal, so $1-2i$ is also a root. That is $2$ nonreal roots.`,
        r`The remaining $6-2=4$ roots may all be real.`,
        r`Check: $3$ is one of those $4$, and nothing forces any other root to be nonreal.`,
      ],
      answer: r`$4$`,
    },
    method: {
      title: "Count, pair, subtract",
      paragraphs: [
        r`Add the exponents of all factors to get the degree; a factor $x^2+k$ contributes $2$. For a real polynomial, list the nonreal roots with their conjugates, then subtract that count from the degree.`,
        r`The number of real roots (with multiplicity) has the same parity as the degree, because the nonreal roots contribute an even number.`,
      ],
    },
    formal: {
      title: "Statement",
      paragraphs: [
        r`Fundamental Theorem of Algebra: every nonconstant polynomial with complex coefficients has a complex root, so a degree-$n$ polynomial factors as $a(x-r_1)\cdots(x-r_n)$. If the coefficients are real and $p(z)=0$, then $p(\bar z)=\overline{p(z)}=0$, so $\bar z$ is also a root with the same multiplicity.`,
      ],
    },
    pitfalls: [
      r`Count multiplicity: $(x-2)^3$ gives three roots.`,
      r`A nonreal root of a real polynomial forces its conjugate.`,
      r`The listed roots may not be all of the roots; the degree says how many there are.`,
    ],
    parentGuide: r`Ask how many roots $x^2+1$ has and what they are, then ask what changes for $(x^2+1)^2$.`,
  }),
  lesson({
    id: "polar-cartesian-conversion",
    title: "Polar and Cartesian coordinates",
    summary: r`A point can be named by $(x,y)$ or by a distance $r$ and angle $\theta$; many polar names describe one point.`,
    objectives: [
      "Convert between polar and Cartesian coordinates at special angles.",
      "Find equivalent polar names, including with negative $r$.",
    ],
    intuition: {
      title: "Turn, then travel",
      paragraphs: [
        r`Cartesian coordinates $(x,y)$ say how far to go across and up. Polar coordinates $(r,\theta)$ say to turn counterclockwise by the angle $\theta$ from the positive $x$-axis, then travel $r$ units in that direction. If $r$ is negative you travel $|r|$ units the opposite way.`,
        r`A full turn of $2\pi$ returns to the same direction, so adding $2\pi$ to $\theta$ names the same point.`,
      ],
    },
    example: {
      prompt: r`Convert $\left(4,\frac{5\pi}{6}\right)$ to Cartesian coordinates.`,
      steps: [
        r`$\frac{5\pi}{6}=150^\circ$ has reference angle $30^\circ$ and lies in the second quadrant: $\cos=-\frac{\sqrt3}{2}$, $\sin=\frac12$.`,
        r`$x=4\cdot\left(-\frac{\sqrt3}{2}\right)=-2\sqrt3$.`,
        r`$y=4\cdot\frac12=2$.`,
        r`Check: $\sqrt{12+4}=4$, the given $r$.`,
      ],
      answer: r`$(-2\sqrt3,\,2)$`,
    },
    method: {
      title: "Both directions",
      paragraphs: [
        r`Polar to Cartesian: $x=r\cos\theta$, $y=r\sin\theta$. Cartesian to polar: $r=\sqrt{x^2+y^2}$, then choose the angle by the signs of $x$ and $y$.`,
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
    summary: r`Two functions of time give an object's coordinates; eliminating the time shows its path.`,
    objectives: [
      "Find position, timing, speed and direction from $x(t)$ and $y(t)$.",
      "Eliminate the parameter to write a linear path.",
    ],
    intuition: {
      title: "One clock, two coordinates",
      paragraphs: [
        r`Instead of writing $y$ as a function of $x$, a parametric model writes both coordinates as functions of a third variable, the parameter, usually time $t$. At each $t$ the point $(x(t),y(t))$ is where the object is.`,
        r`In a linear model $x(t)=x_0+at$ and $y(t)=y_0+bt$: $x_0,y_0$ is the starting position and $a,b$ are the changes per unit of time.`,
      ],
    },
    example: {
      prompt: r`A cart has $x(t)=2+3t$ and $y(t)=1-2t$ (meters, seconds). Find its path as $y$ in terms of $x$ and its speed.`,
      steps: [
        r`Solve $x=2+3t$ for $t$: $t=\frac{x-2}{3}$.`,
        r`Substitute: $y=1-2\cdot\frac{x-2}{3}=1-\frac23x+\frac43=-\frac23x+\frac73$.`,
        r`Each second $x$ changes by $3$ and $y$ by $-2$, so the speed is $\sqrt{3^2+(-2)^2}=\sqrt{13}$ m/s.`,
        r`Check at $t=1$: the position $(5,-1)$ satisfies $y=-\frac23(5)+\frac73=-1$.`,
      ],
      answer: r`$y=-\frac23x+\frac73$; speed $\sqrt{13}$ m/s`,
    },
    method: {
      title: "Evaluate, solve, eliminate",
      paragraphs: [
        r`Position at a time: substitute. A time for a given coordinate: set that coordinate's equation equal to the value and solve. Path: solve one equation for $t$ and substitute into the other; the slope is $\frac{b}{a}$.`,
        r`Direction: $a>0$ moves right and $a<0$ left; $b>0$ moves up and $b<0$ down. Speed: $\sqrt{a^2+b^2}$.`,
      ],
    },
    formal: {
      title: "Linear parametric equations",
      paragraphs: [
        r`If $x(t)=x_0+at$ and $y(t)=y_0+bt$ with $a\ne0$, then every position satisfies $y-y_0=\frac{b}{a}(x-x_0)$. The distance moved in time $t$ is $t\sqrt{a^2+b^2}$.`,
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
    summary: r`The squared terms of an equation tell whether the graph is a circle, ellipse, parabola or hyperbola, and completing the square reveals its center.`,
    objectives: [
      "Identify a conic from its equation.",
      "Read a center or axis ends, and complete the square in general form.",
    ],
    intuition: {
      title: "Four curves from one idea",
      paragraphs: [
        r`Slicing a cone gives four curves. In an equation, look at the squared variables. If only one variable is squared, the graph is a parabola. If both are squared and added, it is a circle (equal coefficients) or an ellipse (different ones). If both are squared and subtracted, it is a hyperbola.`,
        r`Shifting a graph $h$ right and $k$ up replaces $x$ by $x-h$ and $y$ by $y-k$, so the center is the point that makes both bracketed expressions zero.`,
      ],
    },
    example: {
      prompt: r`Find the center and radius of the circle $x^2+y^2-6x+4y-12=0$.`,
      steps: [
        r`Group: $(x^2-6x)+(y^2+4y)=12$.`,
        r`Half of $-6$ is $-3$ and $(-3)^2=9$. Half of $4$ is $2$ and $2^2=4$. Add $9$ and $4$ to both sides.`,
        r`$(x-3)^2+(y+2)^2=25$.`,
        r`The center is $(3,-2)$ and the radius is $\sqrt{25}=5$. Check: $(3,3)$ gives $0+25=25$ and satisfies the original equation.`,
      ],
      answer: r`Center $(3,-2)$, radius $5$`,
    },
    method: {
      title: "Identify, then read or complete",
      paragraphs: [
        r`A center is the opposite of the numbers inside the brackets. An ellipse $\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1$ extends $a$ horizontally and $b$ vertically from $(h,k)$; the longer axis follows the larger denominator.`,
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
  lesson({
    id: "parabola-focus-directrix",
    title: "Parabolas from focus and directrix",
    summary: r`A parabola is the set of points equally far from a focus and a directrix; its equation comes from the vertex and $p$.`,
    objectives: [
      "Find the vertex, $p$ and the equation from a focus and directrix.",
      "Find the focus and directrix from an equation, including a sideways parabola.",
    ],
    intuition: {
      title: "Equal distance to a point and a line",
      paragraphs: [
        r`Pick a point (the focus) and a line (the directrix) that does not contain it. The points that are the same distance from the focus as from the line form a parabola. The vertex is the point of the curve nearest both, halfway between the focus and the line.`,
        r`Let $p$ be the signed distance from the vertex to the focus. A parabola with a vertical axis then has the equation $(x-h)^2=4p(y-k)$, with the vertex $(h,k)$.`,
      ],
    },
    example: {
      prompt: r`Find the equation of the parabola with focus $(1,5)$ and directrix $y=1$.`,
      steps: [
        r`The vertex is halfway between $y=5$ and $y=1$ on the line $x=1$: $(1,3)$.`,
        r`$p$ is the vertex-to-focus distance, upward, so $p=5-3=2$ and $4p=8$.`,
        r`Substitute into $(x-h)^2=4p(y-k)$: $(x-1)^2=8(y-3)$.`,
        r`Check with the point $(5,5)$ on the curve: distance to the focus is $4$ and distance to the line $y=1$ is $4$, and $(5-1)^2=16=8(5-3)$.`,
      ],
      answer: r`$(x-1)^2=8(y-3)$`,
    },
    method: {
      title: "Vertex, focal distance, equation",
      paragraphs: [
        r`From focus and directrix: vertex first, then $p$ (positive if the focus is above the vertex), then the equation. From an equation: the vertex is $(h,k)$, the bracket coefficient is $4p$, the focus is $p$ from the vertex and the directrix is $p$ on the other side.`,
        r`For $(y-k)^2=4p(x-h)$ the roles of $x$ and $y$ swap: the axis is horizontal and the focus is $(h+p,k)$.`,
      ],
    },
    formal: {
      title: "Derivation",
      paragraphs: [
        r`With focus $(h,k+p)$ and directrix $y=k-p$, equal distances give $\sqrt{(x-h)^2+(y-k-p)^2}=|y-k+p|$. Squaring and simplifying gives $(x-h)^2=4p(y-k)$.`,
      ],
    },
    pitfalls: [
      r`The coefficient is $4p$, not $p$.`,
      r`The vertex is halfway between the focus and the directrix, not at the focus.`,
      r`For a sideways parabola the focus moves horizontally.`,
    ],
    parentGuide: r`Ask the learner to pick a point on the parabola and measure its distance to the focus and to the directrix.`,
  }),
];
