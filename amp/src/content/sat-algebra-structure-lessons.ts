import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const satAlgebraStructureMethods: Record<string, ProblemMethod> = {
  "quadratic-root-relations": {
    goal: "Given a quadratic with real solutions, find a sum, product or reciprocal sum of them, a coefficient or a solution, without solving both.",
    intuition:
      "A quadratic equation $ax^2+bx+c=0$ has solutions $p$ and $q$ exactly when it can be written $a(x-p)(x-q)=0$. Multiplying that out shows how the coefficients $b$ and $c$ are built from $p$ and $q$, so the coefficients tell you the sum and product of the solutions directly.",
    terms: [
      [
        "solution",
        "A number that makes the equation true when it replaces $x$.",
      ],
      [
        "coefficient",
        "The number multiplying a power of $x$: $a$ for $x^2$, $b$ for $x$; $c$ is the constant term.",
      ],
    ],
    method: [
      "Write the equation as $ax^2+bx+c=0$ and read $a$, $b$ and $c$ with their signs.",
      "The solutions $p$ and $q$ satisfy $p+q=-\\frac{b}{a}$ and $pq=\\frac{c}{a}$.",
      "Rewrite the requested quantity using only $p+q$ and $pq$, for example $p^2+q^2=(p+q)^2-2pq$ or $\\frac1p+\\frac1q=\\frac{p+q}{pq}$.",
      "If one solution is given, subtract it from the sum, or substitute it into the equation to find a missing coefficient.",
    ],
    watch:
      "The sum is $-b/a$, not $b/a$, and both relations divide by $a$. When $a\\ne1$, the sum is not $-b$ and the product is not $c$.",
  },
  "system-expression-value": {
    goal: "Given linear equations in $x$ and $y$, find the value of a requested expression by combining the equations, not solving for each variable.",
    intuition:
      "If two equations are true, then multiplying each by a number and adding the results gives another true equation. When the left side of that new equation is the expression you want, its right side is the answer. You never need $x$ or $y$ alone.",
    terms: [
      [
        "combination of equations",
        "Multiply each equation by a number, then add the left sides and add the right sides.",
      ],
      [
        "multiplier",
        "The number that multiplies one whole equation, both sides.",
      ],
    ],
    method: [
      "Compare the requested expression's $x$ coefficient with those in the equations and find multipliers $u$ and $v$ that build it.",
      "Check that the same multipliers build the $y$ coefficient.",
      "Apply the same multipliers to the right sides and add them. That sum is the expression's value.",
      "If the equations describe one line, the requested expression is a multiple of the left side. Scale the right side by the same number, even though $x$ and $y$ are not fixed separately.",
    ],
    watch:
      "Multiply the right side by the same number as the left, and apply each multiplier to its own equation only. Adding the right sides without the multipliers answers a different question.",
  },
  "variation-constant": {
    goal: "For direct or inverse variation, find the constant, predict a value, choose the fitting equation or table, or find how one quantity changes.",
    intuition:
      "Two quantities vary directly when one is always the same multiple of the other: doubling one doubles the other. They vary inversely when their product stays the same: doubling one halves the other. In either case one number, the constant of variation, describes the whole relationship.",
    terms: [
      [
        "varies directly",
        "$y=kx$ for one constant $k\\ne0$; the ratio $y/x$ is always $k$.",
      ],
      [
        "varies inversely",
        "$y=\\frac{k}{x}$ for one constant $k\\ne0$; the product $xy$ is always $k$.",
      ],
      ["constant of variation", "The fixed number $k$ in either equation."],
    ],
    method: [
      "Decide the kind from the wording, or from a table: a constant ratio $y/x$ means direct, a constant product $xy$ means inverse.",
      "Use one known pair to find $k$: $k=y/x$ for direct variation, $k=xy$ for inverse.",
      "Use $y=kx$ or $y=k/x$ with the new input, or compare the two inputs as a factor.",
      "Check the answer has the expected direction: direct variation moves both quantities the same way, inverse variation moves them opposite ways.",
    ],
    watch:
      "Do not add the same amount to both quantities and do not mix the two kinds. A relationship such as $y=3x+2$ is neither: its ratio and its product both change.",
  },
  "rate-combination-model": {
    goal: "Combine constant rates: shared work, filling with a drain, mixing solutions, average speed over equal distances, or a rate that changes.",
    intuition:
      "A rate says how much happens per unit of time, such as $\\frac15$ of a job per hour. Rates working together add, and a rate working against another subtracts. Times and speeds do not add or average that way, so convert to rates or to totals first.",
    terms: [
      [
        "rate",
        "The amount done per unit of time, for example jobs per hour or liters per minute.",
      ],
      [
        "concentration",
        "The part of a mixture that is the named substance, such as 20% salt means $0.20$ of the mixture's volume is salt.",
      ],
      ["average speed", "Total distance divided by total time."],
    ],
    method: [
      "Name what is being measured and write each given as an amount per unit time, or as an amount of the pure substance.",
      "Combine: add rates working together and subtract a rate working against; add the amounts of pure substance in a mixture; add distances and add times for a trip.",
      "Solve for the unknown total using time = amount ÷ rate, concentration = pure amount ÷ total amount, or average speed = total distance ÷ total time.",
      "Check that the result is reasonable: a shared job takes less time than either worker alone, and an average speed lies between the two speeds.",
    ],
    watch:
      "Do not average times, concentrations or speeds directly. Weight by volume for a mixture, and divide total distance by total time for speed.",
  },
  "absolute-compound-inequality": {
    goal: "Choose the solution set of an absolute-value or compound inequality, or the inequality that describes a set on a number line.",
    intuition:
      'The absolute value $|E|$ is the distance of $E$ from 0. So $|E|<c$ means $E$ is closer than $c$ to 0, between $-c$ and $c$. And $|E|>c$ means $E$ is farther than $c$, either below $-c$ or above $c$. A compound inequality joins two conditions with "and" (both true) or "or" (at least one true).',
    terms: [
      [
        "absolute value",
        "$|E|$ is the distance of $E$ from 0 on the number line, never negative.",
      ],
      [
        "compound inequality",
        'Two inequalities joined by "and" (a chain such as $2<3x+1<10$) or "or".',
      ],
    ],
    method: [
      "For $|E|<c$ with $c>0$, write $-c<E<c$. For $|E|>c$, write $E<-c$ or $E>c$.",
      "Solve every part of the chain, or each case, by the same steps; reverse an inequality sign whenever you multiply or divide by a negative number.",
      'Read "and" as the overlap and "or" as the union, and keep each endpoint open for $<,>$ and closed for $\\le,\\ge$.',
      "To go from a number line to $|x-m|$: use the midpoint as $m$ and the distance from it to an endpoint as the radius.",
    ],
    watch:
      'If $c<0$, check the sign before solving: $|E|<c$ has no solutions and $|E|>c$ is true for every real number. And "or" never means the numbers between the cases.',
  },
  "quadratic-from-data": {
    goal: "Choose the quadratic equation fixed by two zeros and a point, a vertex and a point, a table with equal steps, or three points.",
    intuition:
      "A quadratic has three unknowns, so three facts fix it. Zeros point to a factored form, a vertex points to vertex form, and a table or points point to the standard form $y=ax^2+bx+c$. In each form, one fact is used for the shape and one point is used to find the stretch $a$.",
    terms: [
      ["zero", "An $x$-value where $y=0$, also an $x$-intercept."],
      [
        "vertex",
        "The turning point of the parabola, its highest or lowest point.",
      ],
      [
        "second difference",
        "For $x$-values equally spaced, subtract consecutive $y$-values to get first differences, then subtract those; for a quadratic it is constant.",
      ],
    ],
    method: [
      "Choose the form that matches the given facts: $y=a(x-p)(x-q)$ for zeros $p$ and $q$, $y=a(x-h)^2+k$ for vertex $(h,k)$, or $y=ax^2+bx+c$ for a table or points.",
      "Substitute the extra point into that form and solve for $a$. For a table with equal steps $h$, use $a=\\frac{\\text{second difference}}{2h^2}$.",
      "For standard form, use two points to find $b$, then one point to find $c$.",
      "Check each given point in the finished equation, including the sign of each factor or shift.",
    ],
    watch:
      "A zero at $x=r$ comes from the factor $(x-r)$, and a vertex at $x=h$ gives $(x-h)$, so the sign inside the bracket is opposite to the number. The zeros or vertex alone never fix $a$.",
  },
};

export const satAlgebraStructurePrinciples: Record<string, string> = {
  "quadratic-root-relations":
    "Let $a\\ne0$ and let the equation $ax^2+bx+c=0$ have real solutions $p$ and $q$, counted with multiplicity. Then $ax^2+bx+c=a(x-p)(x-q)=ax^2-a(p+q)x+apq$, so $p+q=-\\frac{b}{a}$ and $pq=\\frac{c}{a}$. A real solution pair exists exactly when $b^2-4ac\\ge0$. Any symmetric expression in $p$ and $q$ can be written using these two numbers; for example $p^2+q^2=(p+q)^2-2pq$, and $\\frac1p+\\frac1q=\\frac{p+q}{pq}$ when $pq\\ne0$.",
  "system-expression-value":
    "If $a_1x+b_1y=c_1$ and $a_2x+b_2y=c_2$ hold, then $u(a_1x+b_1y)+v(a_2x+b_2y)=uc_1+vc_2$ holds for all numbers $u$ and $v$. If the target is $Ax+By$ and $(A,B)=u(a_1,b_1)+v(a_2,b_2)$, its value is $uc_1+vc_2$. When $a_1b_2-a_2b_1\\ne0$ such $u$ and $v$ always exist. When the left sides are proportional, they exist exactly when $(A,B)$ is proportional to them, and then the value is fixed even though $x$ and $y$ are not.",
  "variation-constant":
    "A quantity $y$ varies directly with $x$ when $y=kx$ for a constant $k\\ne0$; then $y/x=k$ for every $x\\ne0$, the graph is a line through the origin, and multiplying $x$ by a factor multiplies $y$ by the same factor. A quantity $y$ varies inversely with $x$ when $y=\\frac{k}{x}$ for a constant $k\\ne0$ and $x\\ne0$; then $xy=k$, and multiplying $x$ by a nonzero factor $f$ multiplies $y$ by $\\frac1f$.",
  "rate-combination-model":
    "For constant rates, amount = rate × time. Rates $r_1$ and $r_2$ working on the same task together give rate $r_1+r_2$, and working against each other give $r_1-r_2$; a task of size 1 then takes $\\frac{1}{r_1\\pm r_2}$. Times $t_1$ and $t_2$ to do one job alone give $\\frac{t_1t_2}{t_1+t_2}$ together. Mixing $V_1$ and $V_2$ of concentrations $c_1$ and $c_2$ gives concentration $\\frac{c_1V_1+c_2V_2}{V_1+V_2}$. Equal distances at speeds $u$ and $v$ give average speed $\\frac{2uv}{u+v}$, because average speed is total distance divided by total time.",
  "absolute-compound-inequality":
    "For real $E$ and $c>0$: $|E|<c$ is equivalent to $-c<E<c$, and $|E|>c$ is equivalent to $E<-c$ or $E>c$; the same holds with $\\le$ and $\\ge$. For $c<0$, $|E|<c$ has no real solution and $|E|>c$ holds for all real $x$. $|E|\\le0$ holds exactly when $E=0$. Multiplying or dividing an inequality by a negative number reverses its direction. The set of $x$ with $|x-m|\\le r$ is the closed segment from $m-r$ to $m+r$.",
  "quadratic-from-data":
    "A quadratic function has the form $y=ax^2+bx+c$ with $a\\ne0$. With zeros $p$ and $q$ it equals $a(x-p)(x-q)$; with vertex $(h,k)$ it equals $a(x-h)^2+k$. Three points with different $x$-values lie on exactly one such function when they are not collinear. For equally spaced $x$-values with step $h$, the second difference of the $y$-values equals $2ah^2$.",
};

export const satAlgebraStructureLessons: Lesson[] = [
  {
    id: "quadratic-root-relations",
    title: "Solutions of a quadratic from its coefficients",
    summary:
      "The coefficients of $ax^2+bx+c=0$ fix the sum and product of its solutions, which answers many questions without solving.",
    templateIds: ["quadratic-root-relations"],
    objectives: [
      "Find the sum and product of the solutions from $a$, $b$ and $c$.",
      "Rewrite a symmetric expression of the solutions using the sum and product.",
      "Find a missing coefficient or the second solution from one known solution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Solutions are built from the coefficients",
        paragraphs: [
          "A solution of an equation is a number that makes it true. If $p$ and $q$ are the solutions of a quadratic equation with leading coefficient $a$, the equation can be written $a(x-p)(x-q)=0$. Multiplying this out gives $ax^2-a(p+q)x+apq=0$.",
          "Compare with $ax^2+bx+c=0$. The $x$ coefficients match, so $-a(p+q)=b$. The constant terms match, so $apq=c$. The sum and product of the solutions are therefore known from the coefficients, even when the solutions themselves are messy.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The solutions of $2x^2-12x+9=0$ are $p$ and $q$. Find $p^2+q^2$ without solving for $p$ and $q$.",
      steps: [
        "Read $a=2$, $b=-12$, $c=9$. The discriminant $b^2-4ac=144-72=72$ is positive, so there are two real solutions.",
        "Sum: $p+q=-\\frac{b}{a}=-\\frac{-12}{2}=6$. Product: $pq=\\frac{c}{a}=\\frac{9}{2}$.",
        "Expanding $(p+q)^2$ gives $p^2+2pq+q^2$, so $p^2+q^2=(p+q)^2-2pq=36-2\\cdot\\frac92=36-9=27$.",
        "Check with the actual solutions $3\\pm\\frac{3\\sqrt2}{2}$: the squares are $9\\pm9\\sqrt2+\\frac92$, and adding the two gives $2\\left(9+\\frac92\\right)=27$.",
      ],
      answer: "$27$",
    },
    closingSections: [
      {
        stage: "method",
        title: "One method for every question",
        keepTogetherInPrint: true,
        paragraphs: [
          "Always start from $p+q=-\\frac{b}{a}$ and $pq=\\frac{c}{a}$. A question about the sum or product reads them directly. A question about $p^2+q^2$ or $\\frac1p+\\frac1q$ is rewritten first: $p^2+q^2=(p+q)^2-2pq$ and $\\frac1p+\\frac1q=\\frac{p+q}{pq}$.",
          "If one solution is known, the other is the sum minus it. If a coefficient is missing, substitute the known solution into the equation and solve the resulting equation for it.",
        ],
      },
      {
        stage: "formal",
        title: "Why the relations hold",
        paragraphs: [
          "For $a\\ne0$ and real solutions $p$ and $q$ counted with multiplicity, $ax^2+bx+c=a(x-p)(x-q)$. Expanding the right side and matching coefficients gives $p+q=-\\frac{b}{a}$ and $pq=\\frac{c}{a}$. Real solutions exist exactly when $b^2-4ac\\ge0$.",
          "Every expression that stays the same when $p$ and $q$ trade places can be written using $p+q$ and $pq$. That is why such questions can be answered from the coefficients alone.",
        ],
      },
    ],
    pitfalls: [
      "The sum is $-b/a$. Keep the minus sign, and divide by $a$ when $a\\ne1$.",
      "$p^2+q^2$ is not $(p+q)^2$; subtract $2pq$.",
      "Check the discriminant when the question needs real solutions.",
    ],
    parentGuide:
      "Ask the learner why $x^2-5x+6=0$, with solutions 2 and 3, has sum 5 and product 6, and how those match the coefficients $-5$ and $6$.",
  },
  {
    id: "system-expression-value",
    title: "The value of an expression from linear equations",
    summary:
      "Scale and add the given equations until the left side is the requested expression. The right side is its value.",
    templateIds: ["system-expression-value"],
    objectives: [
      "Find multipliers that turn two equations into a requested expression.",
      "Apply the same multipliers to the right sides.",
      "Recognize when the variables cannot be found separately but the value is still fixed.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A combination of true equations is true",
        paragraphs: [
          "An equation like $3x+2y=7$ says the two sides are equal. If you multiply both sides by the same number, they stay equal. If you add two true equations, left side to left side and right side to right side, the result is true again.",
          "That means you can build the expression you want on the left. The number you end up with on the right is its value. You never need to find $x$ or $y$ by themselves.",
        ],
      },
    ],
    workedExample: {
      prompt: "If $3x+2y=7$ and $x+4y=9$, what is the value of $5x+10y$?",
      steps: [
        "Look for multipliers $u$ and $v$ with $u(3x+2y)+v(x+4y)=5x+10y$.",
        "The $x$ coefficients need $3u+v=5$, and the $y$ coefficients need $2u+4v=10$. The values $u=1$ and $v=2$ satisfy both.",
        "Apply them to the right sides: $1\\cdot7+2\\cdot9=25$.",
        "Check by solving: $x=1$, $y=2$ satisfies both equations, and $5(1)+10(2)=25$.",
      ],
      answer: "$25$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When the variables cannot be found separately",
        keepTogetherInPrint: true,
        paragraphs: [
          "Suppose only $6x+9y=12$ is given, and you want $2x+3y$. The target's coefficients are one third of the equation's, so its value is one third of 12, which is 4. Many pairs $(x,y)$ satisfy the equation, but every one of them gives the same value of $2x+3y$.",
          "Two equations can also describe the same line, such as $4x+6y=10$ and $6x+9y=15$. Then again $x$ and $y$ are not fixed, but any expression that is a multiple of $2x+3y$ is. If the requested expression is not a multiple of the equation's left side, the value is not determined by it.",
        ],
      },
      {
        stage: "formal",
        title: "Why the method is exact",
        paragraphs: [
          "If $a_1x+b_1y=c_1$ and $a_2x+b_2y=c_2$ hold, then $u(a_1x+b_1y)+v(a_2x+b_2y)=uc_1+vc_2$ for every pair of numbers $u$ and $v$. When the target is $Ax+By$ with $(A,B)=u(a_1,b_1)+v(a_2,b_2)$, its value is $uc_1+vc_2$.",
          "When $a_1b_2-a_2b_1\\ne0$, such multipliers exist for every target. When the left sides are proportional, they exist only for targets proportional to them.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the right side by the same number as the left side.",
      "Use each multiplier on its own equation; do not just add the right sides.",
      "Do not decide the value is unknown because there is one equation; check whether the target is a multiple of it.",
    ],
    parentGuide:
      "Ask the learner to explain why $3x+2y=7$ and $x+4y=9$ give $4x+6y=16$ by adding, before trying $5x+10y$.",
  },
  {
    id: "variation-constant",
    title: "Direct and inverse variation",
    summary:
      "Direct variation keeps the ratio $y/x$ constant; inverse variation keeps the product $xy$ constant. One known pair gives the constant.",
    templateIds: ["variation-constant"],
    objectives: [
      "Find the constant of variation from one pair of values.",
      "Predict a value, choose an equation, or find a change factor.",
      "Tell direct, inverse and neither apart from a table.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One number describes the whole relationship",
        paragraphs: [
          "Two quantities vary directly when one is always the same multiple of the other. Pay that equals a fixed amount per hour does: twice the hours earns twice the pay. The fixed amount is the constant of variation, $k$, and the rule is $y=kx$.",
          "Two quantities vary inversely when their product never changes. A trip of fixed length does: doubling the speed halves the time. The rule is $y=\\frac{k}{x}$, and $k$ is the product $xy$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The mass $m$, in grams, of a block cut from one metal varies directly with its volume $V$, in cubic centimeters. When $V=8$, $m=20$. What is $m$ when $V=12$?",
      steps: [
        "Direct variation means $m=kV$. Using the known pair, $20=k\\cdot8$, so $k=\\frac{20}{8}=\\frac52$.",
        "Use the new volume: $m=\\frac52\\cdot12=30$ grams.",
        "Check the ratio: $\\frac{30}{12}=\\frac52$ and $\\frac{20}{8}=\\frac52$, so the ratio is unchanged.",
      ],
      answer: "$30$",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which kind is it?",
        keepTogetherInPrint: true,
        paragraphs: [
          "From a table, compute $y\\div x$ and $x\\cdot y$ for every row. If the ratio is the same, the relationship is direct and $y=kx$. If the product is the same, it is inverse and $y=\\frac{k}{x}$. If neither is the same, it is neither; a rule like $y=3x+2$ falls here because it adds a constant.",
          "To find how $y$ changes when $x$ changes from $a$ to $b$, use factors. For direct variation $y$ is multiplied by $\\frac{b}{a}$. For inverse variation it is multiplied by $\\frac{a}{b}$.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "$y$ varies directly with $x$ when $y=kx$ for a constant $k\\ne0$. Then $y/x=k$ for every $x\\ne0$. $y$ varies inversely with $x$ when $y=\\frac{k}{x}$ for a constant $k\\ne0$ and $x\\ne0$. Then $xy=k$.",
          "If $x$ is multiplied by a nonzero factor $f$, direct variation multiplies $y$ by $f$, and inverse variation multiplies $y$ by $\\frac1f$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the same amount to both quantities; variation is about multiplying.",
      "For inverse variation divide by the new input, not multiply.",
      "The constant of direct variation is $y/x$, not $x/y$.",
    ],
    parentGuide:
      "Ask the learner whether the pay for 3 hours and for 6 hours has the same ratio to hours, then whether a trip at 30 and at 60 miles per hour has the same product of speed and time.",
  },
  {
    id: "rate-combination-model",
    title: "Combining rates",
    summary:
      "Rates add when they work together and subtract when they work against each other. Times, concentrations and speeds are not averaged directly.",
    templateIds: ["rate-combination-model"],
    objectives: [
      "Add and subtract rates to find a shared or net time.",
      "Weight a mixture by volume and find an unknown amount.",
      "Compute an average speed as total distance over total time.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Work with rates, not times",
        paragraphs: [
          "A rate is an amount per unit of time. A worker who finishes a job in 4 hours does $\\frac14$ of the job each hour. A second worker who takes 6 hours does $\\frac16$ of it each hour.",
          "Working together they do both amounts in the same hour, so their rates add. The time for the whole job is then 1 divided by the combined rate. Times do not add or average: together they must be faster than either alone.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ana can paint a fence in 4 hours and Ben can paint it in 6 hours. Working together at these constant rates, how long do they need, in hours?",
      steps: [
        "Ana's rate is $\\frac14$ of the fence per hour and Ben's is $\\frac16$.",
        "Together: $\\frac14+\\frac16=\\frac{3}{12}+\\frac{2}{12}=\\frac{5}{12}$ of the fence per hour.",
        "One fence takes $1\\div\\frac{5}{12}=\\frac{12}{5}$ hours.",
        "Check: in $\\frac{12}{5}$ hours Ana paints $\\frac14\\cdot\\frac{12}{5}=\\frac35$ and Ben paints $\\frac16\\cdot\\frac{12}{5}=\\frac25$. Together $\\frac35+\\frac25=1$.",
      ],
      answer: "$\\frac{12}{5}$",
      answerUnit: "hours",
    },
    closingSections: [
      {
        stage: "method",
        title: "Other rate situations",
        keepTogetherInPrint: true,
        paragraphs: [
          "A drain works against a pipe, so subtract its rate. For mixtures, add the amounts of the pure substance: 9 liters of 27% salt solution hold $0.27\\cdot9$ liters of salt. The mixture's concentration is total salt divided by total volume.",
          "For a trip with equal distances $d$ at speeds $u$ and $v$, the total distance is $2d$ and the total time is $\\frac{d}{u}+\\frac{d}{v}$, so the average speed is $\\frac{2uv}{u+v}$. It is below the plain average because more time is spent at the slower speed. When a rate changes partway, find the amount made in the first phase, then divide what remains by the second rate.",
        ],
      },
      {
        stage: "formal",
        title: "Relations used",
        paragraphs: [
          "For constant rates, amount = rate × time. Rates $r_1$ and $r_2$ on the same task combine to $r_1+r_2$ together and $r_1-r_2$ against each other. Two times $t_1$ and $t_2$ for one job give $\\frac{t_1t_2}{t_1+t_2}$ together.",
          "Mixing volumes $V_1$ and $V_2$ with concentrations $c_1$ and $c_2$ gives concentration $\\frac{c_1V_1+c_2V_2}{V_1+V_2}$. Average speed is total distance divided by total time.",
        ],
      },
    ],
    pitfalls: [
      "Do not average the two times, concentrations or speeds directly.",
      "A result for working together must be less than the shorter individual time.",
      "Keep exact fractions until the end, and give the unit the question asks for.",
    ],
    parentGuide:
      "Ask the learner why two workers who take 4 and 6 hours cannot take 5 hours together, then how much of the job each does in one hour.",
  },
  {
    id: "absolute-compound-inequality",
    title: "Absolute-value and compound inequalities",
    summary:
      'An absolute value is a distance from 0. "Less than" means between two numbers, "greater than" means beyond them, and "and" and "or" join conditions.',
    templateIds: ["absolute-compound-inequality"],
    objectives: [
      "Solve $|ax+b|<c$ and $|ax+b|>c$.",
      'Solve chains and "or" pairs of linear inequalities.',
      "Match a described set on a number line to an absolute-value inequality.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Distance from zero",
        paragraphs: [
          "The absolute value $|E|$ is how far $E$ is from 0, so it is never negative. $|E|<7$ says $E$ is less than 7 away from 0: $E$ is between $-7$ and $7$. $|E|>7$ says $E$ is more than 7 away: $E$ is below $-7$ or above $7$.",
          'A compound inequality joins two conditions. A chain such as $2<3x+1<10$ means both conditions hold, so it describes the overlap. "$x<-1$ or $x>4$" means at least one holds, so it describes both outer pieces.',
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $|2x-3|<7$.",
      steps: [
        "Since 7 is positive, the inequality means $-7<2x-3<7$.",
        "Add 3 to all three parts: $-4<2x<10$.",
        "Divide all three parts by 2: $-2<x<5$.",
        "Check: $x=0$ gives $|-3|=3<7$. $x=5$ gives $|7|=7$, which is not less than 7, so 5 is excluded.",
      ],
      answer: "$-2<x<5$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Cases and the number line",
        keepTogetherInPrint: true,
        paragraphs: [
          'For $|E|>c$ with $c>0$, solve the two cases $E<-c$ and $E>c$ separately and join them with "or". When you multiply or divide by a negative number, reverse the inequality sign, which also swaps which end each bound belongs to in a chain.',
          "To write a number-line set with endpoints $L$ and $R$ as an absolute value, use the midpoint $m=\\frac{L+R}{2}$ and radius $r=\\frac{R-L}{2}$: the segment is $|x-m|\\le r$ (or $<r$ if endpoints are excluded), and the two outer rays are $|x-m|\\ge r$ (or $>r$). If the right side is negative, no distance can be less than it, and every distance is greater than it.",
        ],
      },
      {
        stage: "formal",
        title: "Rules",
        paragraphs: [
          "For real $E$ and $c>0$: $|E|<c$ is equivalent to $-c<E<c$, and $|E|>c$ is equivalent to $E<-c$ or $E>c$; the same holds with $\\le$ and $\\ge$. For $c<0$, $|E|<c$ has no real solution and $|E|>c$ holds for all $x$. Also $|E|\\le0$ holds exactly when $E=0$.",
          "Multiplying or dividing an inequality by a negative number reverses its direction.",
        ],
      },
    ],
    pitfalls: [
      '"Or" is not the numbers between the cases, and "and" is not both outer pieces.',
      "Reverse the sign when dividing by a negative number.",
      "Check the sign of the right side before solving.",
    ],
    parentGuide:
      "Ask the learner whether 0 and 5 satisfy $|2x-3|<7$, and what the answer says about the numbers between $-2$ and 5.",
  },
  {
    id: "quadratic-from-data",
    title: "Write a quadratic from given facts",
    summary:
      "Zeros, a vertex, a table or three points each point to a form of the equation. One extra point fixes the stretch $a$.",
    templateIds: ["quadratic-from-data"],
    objectives: [
      "Choose factored, vertex or standard form from the given facts.",
      "Use a point to find the leading coefficient.",
      "Use second differences for an equally spaced table.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Pick the form that uses the facts",
        paragraphs: [
          "A parabola's equation has three unknown numbers, so three facts fix it. A zero is an $x$-value where $y=0$; knowing both zeros $p$ and $q$ gives the shape $y=a(x-p)(x-q)$, with only the stretch $a$ left. The vertex is the turning point; knowing it at $(h,k)$ gives $y=a(x-h)^2+k$.",
          "Substitute one more point into the form to find $a$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A parabola crosses the $x$-axis at $x=-2$ and $x=3$ and passes through $(1,-12)$. Write its equation.",
      steps: [
        "The zeros give $y=a(x+2)(x-3)$.",
        "Substitute $(1,-12)$: $-12=a(1+2)(1-3)=a\\cdot3\\cdot(-2)=-6a$, so $a=2$.",
        "The equation is $y=2(x+2)(x-3)$.",
        "Check the point: $2(3)(-2)=-12$. Check the zeros: $x=-2$ and $x=3$ each make a factor 0.",
      ],
      answer: "$y=2(x+2)(x-3)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Tables and three points",
        keepTogetherInPrint: true,
        paragraphs: [
          "For three $x$-values spaced by $h$, subtract consecutive $y$-values to get two first differences, then subtract those to get the second difference. It equals $2ah^2$, so $a=\\frac{\\text{second difference}}{2h^2}$. Subtract two rows to find $b$, then use one row to find $c$.",
          "For three points with uneven spacing, find the slope between the first two and between the last two. These are $a(x_1+x_2)+b$ and $a(x_2+x_3)+b$, so their difference is $a(x_3-x_1)$. Then find $b$ and $c$.",
        ],
      },
      {
        stage: "formal",
        title: "Forms",
        paragraphs: [
          "A quadratic function has the form $y=ax^2+bx+c$ with $a\\ne0$. With zeros $p$ and $q$ it equals $a(x-p)(x-q)$. With vertex $(h,k)$ it equals $a(x-h)^2+k$.",
          "Three non-collinear points with different $x$-values lie on exactly one quadratic. For equally spaced $x$-values with step $h$, the second difference of the $y$-values is $2ah^2$.",
        ],
      },
    ],
    pitfalls: [
      "A zero at $x=r$ gives the factor $(x-r)$; the sign inside is opposite.",
      "Zeros or a vertex alone do not fix $a$; use the extra point.",
      "The second difference is $2ah^2$, not $a$.",
    ],
    parentGuide:
      "Ask the learner to check that $y=2(x+2)(x-3)$ passes through $(1,-12)$ and crosses the axis at both zeros.",
  },
];
