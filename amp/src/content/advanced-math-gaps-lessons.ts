import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const advancedMathGapMethods: Record<string, ProblemMethod> = {
  "series-recursion": {
    goal: "Sum an arithmetic series, move between recursive and explicit rules, or find a term from a table or a recursive rule.",
    intuition:
      "A sequence is an ordered list of numbers called terms. A recursive rule gives the first term and says how to get each term from the one before it. An explicit rule gives term $n$ directly. An arithmetic sequence adds the same number, the common difference $d$, at every step. A series is the sum of the terms.",
    terms: [
      [
        "recursive rule",
        "A first term plus a rule such as $a_{n+1}=a_n+d$ that builds each term from the previous one.",
      ],
      [
        "explicit rule",
        "A formula such as $a_n=a_1+(n-1)d$ that gives term $n$ from $n$ alone.",
      ],
      [
        "series",
        "The sum of the terms of a sequence, such as the first $n$ terms.",
      ],
    ],
    method: [
      "Find the first term and the common difference. From two table entries, divide the change in value by the number of steps between them.",
      "To jump to term $n$, count $n-1$ steps from the first term: $a_n=a_1+(n-1)d$. To convert a rule, test it at $n=1$.",
      "For a sum, pair each term with its partner from the other end. The sum of $n$ terms is $n$ times the average of the first and last terms. For a recursion that is not arithmetic, apply the rule one term at a time.",
    ],
    watch:
      "Count steps, not terms: term $n$ is $n-1$ steps after term 1. In a table, divide the change by the number of steps, not by the change in value.",
  },
  "compound-growth": {
    goal: "Compute a compound-interest balance, or convert between an annual growth rate and the rate for one compounding period.",
    intuition:
      "Interest that is added to a balance earns interest itself. Compounding $n$ times a year means the annual rate $r$ is split into $n$ equal period rates of $r/n$, and each period multiplies the balance by $1+r/n$. When $n$ grows without limit, the balance follows $Pe^{rt}$.",
    terms: [
      [
        "compounding period",
        "The time between interest additions, such as a month or a quarter.",
      ],
      [
        "growth factor",
        "The number multiplied by a value in one period: $1+p$ for a $100p$% increase, $1-p$ for a decrease.",
      ],
      [
        "continuous compounding",
        "The limit of compounding more and more often, giving $A=Pe^{rt}$ with $r$ as a decimal.",
      ],
    ],
    method: [
      "Write the annual rate as a decimal. For $n$ compoundings per year, use $A=P(1+r/n)^{nt}$; for continuous compounding, use $A=Pe^{rt}$.",
      "To change time units, keep the same total growth: a yearly factor $F$ becomes $F^{1/12}$ per month, and a monthly factor $G$ becomes $G^{12}$ per year.",
      "Round only at the end, as the problem states. Convert a yearly factor to a percent change by subtracting 1.",
    ],
    watch:
      "Do not divide a yearly factor by the number of periods, and do not multiply a period rate by the number of periods. Equivalent factors come from powers and roots.",
  },
  "polynomial-factoring-patterns": {
    goal: "Choose the complete factorization of a cubic or quartic polynomial over the integers.",
    intuition:
      "Some polynomials are products of simpler pieces that follow a pattern. A factorization is complete when no factor can be split further into integer-coefficient polynomials. Check each factor again after every step.",
    terms: [
      [
        "sum or difference of cubes",
        "An expression $u^3\\pm v^3$, which factors as $(u\\pm v)(u^2\\mp uv+v^2)$.",
      ],
      [
        "factoring by grouping",
        "Factoring common factors from pairs of terms, then factoring out the binomial that the pairs share.",
      ],
      [
        "quadratic in form",
        "A polynomial such as $x^4-5x^2+4$, which becomes a quadratic after the substitution $u=x^2$.",
      ],
    ],
    method: [
      "Take out any common factor first. Then look at the number of terms: two terms suggest cubes or a difference of squares; four terms suggest grouping; $x^4$, $x^2$ and a constant suggest the substitution $u=x^2$.",
      "Apply the pattern: $u^3\\pm v^3=(u\\pm v)(u^2\\mp uv+v^2)$, group in pairs, or factor the quadratic in $u$ and replace $u$ by $x^2$.",
      "Test every factor again. A difference of squares $x^2-c^2$ splits further. A sum $x^2+c$ with $c>0$ does not, and neither does the trinomial from a cube pattern.",
    ],
    watch:
      "Stopping at $(x^2-4)(x^2-9)$ is incomplete because each factor is a difference of squares. The middle sign of a cube trinomial is opposite the binomial's sign, and its middle term is $uv$, not $2uv$.",
  },
  "residual-function-fit": {
    goal: "Use a residual plot or a table to choose a model type, or compute and interpret a residual from a nonlinear model.",
    intuition:
      "A residual is observed value minus predicted value. A positive residual means the point lies above the model; a negative residual means it lies below. If a model has the right shape, residuals scatter around 0 with no pattern. A curve in the residuals shows a shape the model missed.",
    terms: [
      [
        "residual",
        "Observed value minus the value the model predicts at the same input.",
      ],
      [
        "residual plot",
        "A graph of each residual against the input, with a horizontal line at 0.",
      ],
      [
        "model type",
        "The family of the model: linear (equal differences), quadratic (equal second differences) or exponential (equal ratios).",
      ],
    ],
    method: [
      "For a residual plot, read from left to right. Random scatter keeps the model. Positive-negative-positive means the data bend upward from the line; negative-positive-negative means they bend downward.",
      "For a table at equally spaced inputs, compare consecutive differences, then the differences of the differences, then ratios. Equal first differences mean linear, equal second differences mean quadratic, and equal ratios mean exponential.",
      "For a residual, evaluate the model at the input, then subtract: observed minus predicted. A negative residual means the model overestimates; a positive one means it underestimates.",
    ],
    watch:
      "Residuals of both signs are normal. The shape of the pattern, not the signs, tells whether the model type is wrong. Always subtract in the order observed minus predicted.",
  },
  "function-graph-features": {
    goal: "Read the intercept, asymptote, domain, range, direction or end behavior of an exponential or logarithmic function from an equation or graph.",
    intuition:
      "An exponential function $a\\cdot b^x+k$ levels off at the height $k$ in one direction and grows or falls without bound in the other. A logarithmic function $a\\log_b(x-h)+k$ is built from the inverse of an exponential function: it lives to the right of a vertical line $x=h$ and climbs or falls slowly.",
    terms: [
      [
        "horizontal asymptote",
        "A height the graph approaches but never reaches as $x$ becomes very large or very negative.",
      ],
      [
        "vertical asymptote",
        "A vertical line the graph approaches but never touches.",
      ],
      [
        "end behavior",
        "What the function values approach as $x$ grows without bound in either direction.",
      ],
    ],
    method: [
      "For $a\\cdot b^x+k$: the horizontal asymptote is $y=k$; the y-intercept is $a+k$; the range is above $k$ when $a>0$ and below $k$ when $a<0$. It is increasing when $a>0,b>1$ or $a<0,b<1$.",
      "For $a\\log_b(x-h)+k$: the input must be positive, so the domain is $x>h$ and the vertical asymptote is $x=h$. When $k=0$ the x-intercept is $(h+1,0)$.",
      "For end behavior, decide which direction makes $b^x$ grow and which makes it approach 0. Apply the sign of $a$ and the shift $k$. On a graph, read each feature from the grid.",
    ],
    watch:
      "The asymptote is set by the added constant, not by the y-intercept. In $\\log_b(x+3)$ the shift moves the asymptote to $x=-3$, the opposite sign of the number written.",
  },
};

export const advancedMathGapPrinciples: Record<string, string> = {
  "series-recursion":
    "For an arithmetic sequence with first term $a_1$ and common difference $d$, $a_{n+1}=a_n+d$ is equivalent to $a_n=a_1+(n-1)d$, and the sum of the first $n$ terms is $S_n=\\tfrac{n}{2}(a_1+a_n)$. A term of a recursive sequence is found by applying its rule from the first term.",
  "compound-growth":
    "With annual rate $r$ compounded $n$ times per year for $t$ years, a deposit $P$ grows to $A=P(1+r/n)^{nt}$; continuous compounding gives $A=Pe^{rt}$. A yearly growth factor $F$ equals a per-period factor $F^{1/n}$ when a year has $n$ equal periods, and a period factor $G$ equals $G^{n}$ per year.",
  "polynomial-factoring-patterns":
    "$u^3+v^3=(u+v)(u^2-uv+v^2)$ and $u^3-v^3=(u-v)(u^2+uv+v^2)$. If the two groups of a four-term polynomial share a binomial, that binomial factors out. A polynomial $x^4+bx^2+c$ equals $u^2+bu+c$ with $u=x^2$. Over the integers, $x^2-c^2$ factors and $x^2+c$ with $c>0$ does not.",
  "residual-function-fit":
    "For a model $\\hat y=f(x)$ and observation $(x,y)$, the residual is $e=y-f(x)$. A model type fits equally spaced data exactly when first differences are constant (linear), second differences are constant and nonzero (quadratic), or consecutive ratios are constant (exponential). A systematic pattern in residuals shows that the model type misses structure in the data.",
  "function-graph-features":
    "For $f(x)=a\\,b^x+k$ with $a\\ne0$, $b>0$, $b\\ne1$, the line $y=k$ is a horizontal asymptote and the range is $y>k$ if $a>0$, $y<k$ if $a<0$. For $g(x)=a\\log_b(x-h)+k$, the domain is $x>h$ and $x=h$ is a vertical asymptote.",
};

export const advancedMathGapLessons: Lesson[] = [
  {
    id: "series-recursion",
    title: "Arithmetic series and recursive rules",
    summary:
      "An arithmetic sequence adds a fixed amount each step. Its terms can be built one at a time or found directly, and its sum pairs terms from both ends.",
    templateIds: ["series-recursion"],
    objectives: [
      "Convert between a recursive rule and an explicit rule for an arithmetic sequence.",
      "Find a term from two entries of a table, or from a recursion that is not arithmetic.",
      "Sum an arithmetic series using the first and last terms.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Build a term, or jump to it",
        paragraphs: [
          "You need to find a term of an arithmetic sequence, which starts at $a_1$ and adds the common difference $d$ each step. A recursive rule such as $a_1=5,\\ a_{n+1}=a_n+3$ builds each term from the one before. An explicit rule such as $a_n=3n+2$ gives any term at once. Both describe the same list 5, 8, 11, 14, and so on.",
          "A series is a sum of terms. Write $5+8+11+14$ and the same sum reversed, $14+11+8+5$. Each column totals 19, so twice the sum is $4\\times19$. That pairing gives a short formula for any arithmetic sum.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $5+8+11+\\cdots$ with 12 terms.",
      steps: [
        "The first term is 5 and the common difference is $8-5=3$.",
        "Term 12 takes 11 steps: $a_{12}=5+11(3)=38$.",
        "Pair the first and last terms: $5+38=43$. Twelve terms make six such pairs, so the sum is $6\\times43=258$.",
        "Check with the average: $12\\times(5+38)/2=12\\times21.5=258$.",
      ],
      answer: "$258$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Convert and sum",
        paragraphs: [
          "To turn $a_1=A,\\ a_{n+1}=a_n+d$ into an explicit rule, use $n-1$ steps: $a_n=A+(n-1)d=dn+(A-d)$. Check $n=1$ returns $A$. To go back, find $a_1$ by substituting $n=1$, and read $d$ as the coefficient of $n$.",
          "From a table with $a_i$ and $a_j$, the difference is $d=(a_j-a_i)/(j-i)$. For a recursion such as $a_{n+1}=2a_n-1$, apply the rule term by term; the sequence is not arithmetic, so no shortcut formula applies.",
        ],
      },
      {
        stage: "formal",
        title: "Why the sum formula works",
        paragraphs: [
          "Let $S_n=a_1+\\cdots+a_n$. Write the sum again in reverse order and add the two lines term by term. Each column is $a_k+a_{n+1-k}=a_1+a_n$, because moving one term forward and one back changes the sum by $d-d=0$. There are $n$ columns, so $2S_n=n(a_1+a_n)$ and $S_n=\\tfrac{n}{2}(a_1+a_n)$.",
        ],
      },
    ],
    pitfalls: [
      "Term $n$ is $n-1$ steps after term 1, not $n$ steps.",
      "In a table, divide the change in value by the number of steps between entries.",
      "Divide $n(a_1+a_n)$ by 2; the pairing counts every term twice.",
    ],
    parentGuide:
      "Ask for the first four terms of $a_n=3n+2$, then ask which recursive rule produces them. Check that the sum 5 + 8 + 11 + 14 equals $4\\times(5+14)/2$.",
  },
  {
    id: "compound-growth",
    title: "Compound interest and growth rates",
    summary:
      "Compounding multiplies a balance by the same factor each period. Time units change by powers and roots of the factor, never by dividing it.",
    templateIds: ["compound-growth"],
    objectives: [
      "Compute a balance with periodic or continuous compounding, rounded as stated.",
      "Convert between an annual factor and the factor for one month or quarter.",
      "Read the annual rate and compounding frequency from a formula.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Interest on interest",
        paragraphs: [
          "You need to multiply by a growth factor repeatedly. If a balance earns 5% a year, each year multiplies it by 1.05. If the 5% is shared over 12 months, each month earns $5\\%/12$, about 0.4167%, and that month's interest is added before the next month's is computed. The second plan ends the year with slightly more.",
          "Compounding more often makes the balance larger but with diminishing gains. The limit of compounding more and more often is continuous compounding, written with the number $e\\approx2.718$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A deposit of 2,000 dollars earns 6% annual interest, compounded monthly. What is the balance after 3 years, to the nearest dollar?",
      steps: [
        "Monthly compounding means $n=12$. The rate per month is $0.06/12=0.005$, so each month multiplies the balance by 1.005.",
        "In 3 years there are $12\\times3=36$ periods.",
        "$A=2000(1.005)^{36}\\approx2000\\times1.19668=2393.36$.",
        "To the nearest dollar the balance is 2,393 dollars. A yearly factor of 1.06 would give $2000\\times1.06^3\\approx2382$, so monthly compounding earns more.",
      ],
      answer: "2,393 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choose the formula, then convert units with powers",
        paragraphs: [
          "Periodic compounding: $A=P(1+r/n)^{nt}$. Continuous: $A=Pe^{rt}$. Always write $r$ as a decimal.",
          "A yearly factor $F$ and a monthly factor $G$ describe the same growth when $G^{12}=F$. So $F=1.12$ gives a monthly factor $1.12^{1/12}\\approx1.0095$, written $V=V_0(1.12)^{m/12}$ for $m$ months. A monthly rate of 2% gives a yearly factor $1.02^{12}\\approx1.268$, an annual increase of 26.8%.",
          "In a formula such as $B(t)=4000(1.015)^{4t}$, the exponent shows 4 periods per year and the factor shows 1.5% per period, so the annual rate is $4\\times1.5\\%=6\\%$.",
        ],
      },
      {
        stage: "formal",
        title: "Why continuous compounding uses e",
        paragraphs: [
          "With $n$ periods per year, the yearly factor is $(1+r/n)^n$. As $n$ grows without bound this approaches $e^{r}$, because $(1+x/n)^n\\to e^x$. Over $t$ years the factor is $e^{rt}$, so $A=Pe^{rt}$.",
        ],
      },
    ],
    pitfalls: [
      "Divide the annual rate by $n$ before compounding; multiply $n$ by $t$ for the exponent.",
      "A yearly factor is not divided by 12 to get a monthly factor. Take its 12th root.",
      "A monthly percent is not multiplied by 12 to get the yearly percent. Raise the monthly factor to the 12th power and subtract 1.",
    ],
    parentGuide:
      "Have the learner compute 1,000 dollars at 12% for one year compounded yearly (1,120) and monthly at 1% (about 1,126.83), and explain why they differ.",
  },
  {
    id: "polynomial-factoring-patterns",
    title: "Factoring patterns beyond trinomials",
    summary:
      "Sums and differences of cubes, grouping and substitution factor cubics and quartics. Check each factor again until none splits.",
    templateIds: ["polynomial-factoring-patterns"],
    objectives: [
      "Factor a sum or difference of cubes, including after a common factor.",
      "Factor a four-term polynomial by grouping and test the result for further factoring.",
      "Factor $x^4+bx^2+c$ by substituting $u=x^2$ and decide when the factorization is complete.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the expression to a pattern",
        paragraphs: [
          "You need to factor quadratics and recognize a difference of squares. A cube is a number or expression multiplied by itself twice, such as $8x^3=(2x)^3$. The sum $u^3+v^3$ and the difference $u^3-v^3$ each have a binomial factor and a trinomial factor. A polynomial with four terms can split into two groups that share a binomial. A polynomial with only $x^4$, $x^2$ and a constant is a quadratic in disguise, with $x^2$ in the place of the variable.",
          "A factorization is complete over the integers when no factor can be split into integer-coefficient factors of lower degree.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor $x^4-5x^2+4$ completely over the integers.",
      steps: [
        "Let $u=x^2$. The polynomial becomes $u^2-5u+4$.",
        "The numbers with product 4 and sum $-5$ are $-1$ and $-4$, so $u^2-5u+4=(u-1)(u-4)$.",
        "Put $x^2$ back: $(x^2-1)(x^2-4)$.",
        "Each factor is a difference of squares: $x^2-1=(x-1)(x+1)$ and $x^2-4=(x-2)(x+2)$. The complete factorization is $(x-1)(x+1)(x-2)(x+2)$.",
      ],
      answer: "$(x-1)(x+1)(x-2)(x+2)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Patterns and the final check",
        paragraphs: [
          "Cubes: $8x^3+27=(2x)^3+3^3=(2x+3)(4x^2-6x+9)$. The binomial copies the sign of the original sum or difference; the trinomial has the opposite sign on the middle term and a plus on the last term. For $2x^3+16$, factor out 2 first.",
          "Grouping: $x^3+3x^2-4x-12=x^2(x+3)-4(x+3)=(x+3)(x^2-4)=(x+3)(x-2)(x+2)$. The grouped factor $x^2-4$ splits further. By contrast, $x^3+3x^2+4x+12=(x+3)(x^2+4)$ is complete, because $x^2+4$ has no real roots.",
        ],
      },
      {
        stage: "formal",
        title: "Why the cube pattern works",
        paragraphs: [
          "Expand $(u+v)(u^2-uv+v^2)=u^3-u^2v+uv^2+u^2v-uv^2+v^3=u^3+v^3$. The middle terms cancel. Replacing $v$ by $-v$ gives $u^3-v^3=(u-v)(u^2+uv+v^2)$. The trinomial has discriminant $v^2-4v^2=-3v^2<0$ in $u$, so it has no real linear factors.",
        ],
      },
    ],
    pitfalls: [
      "The cube trinomial's middle term is $uv$, not $2uv$, and it has the opposite sign from the binomial.",
      "After grouping or substitution, test each factor for a difference of squares.",
      "A sum of squares $x^2+c$ with $c>0$ does not factor over the integers.",
    ],
    parentGuide:
      "Ask the learner to multiply $(x+2)(x^2-2x+4)$ to see the cancellation, and to explain why $(x^2-4)(x^2-1)$ is not a finished factorization.",
  },
  {
    id: "residual-function-fit",
    title: "Residuals and choosing a model type",
    summary:
      "A pattern in a residual plot, or the differences in a table, shows whether a line, a parabola or an exponential curve fits. A residual measures one miss.",
    templateIds: ["residual-function-fit"],
    objectives: [
      "Decide from a residual plot whether to keep a linear model or switch to a curved one.",
      "Classify equally spaced data as linear, quadratic or exponential from differences and ratios.",
      "Compute a residual from a nonlinear model and say whether the model over- or underestimates.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What a model leaves behind",
        paragraphs: [
          "You need to evaluate a model at an input and compare it with a data value. A residual is the observed value minus the predicted value. If the observed point is above the model, the residual is positive; if below, negative.",
          "When a model has the right shape, residuals fall above and below 0 at random. When they follow a curve, the data bend in a way the model cannot. Positive at both ends and negative in the middle means the data lie above a line at the ends and below it in the middle, so they curve upward.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A model predicts $\\hat y=3\\cdot2^x$. At $x=4$ the observed value is 45. Find the residual and say whether the model overestimates or underestimates.",
      steps: [
        "Predicted value: $3\\cdot2^4=3\\cdot16=48$.",
        "Residual = observed − predicted = $45-48=-3$.",
        "The residual is negative: the observed point is below the model, so the model overestimates by 3.",
        "Check the order of subtraction: observed minus predicted, so a prediction larger than the observation gives a negative residual.",
      ],
      answer: "$-3$; the model overestimates by 3",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choosing the type from a table",
        paragraphs: [
          "For y-values at equally spaced x-values: if the differences are equal, the type is linear. If they are not but the second differences are equal, the type is quadratic. If the ratios of consecutive y-values are equal, the type is exponential. For the y-values 2, 6, 18, 54 the differences are 4, 12, 36 and the ratios are all 3, so the data are exponential.",
          "A cubic such as $x^3+c$ has constant third differences only; it matches none of the three types.",
        ],
      },
      {
        stage: "formal",
        title: "Why differences identify the type",
        paragraphs: [
          "For a line $y=mx+b$ with spacing $h$, successive differences equal $mh$. For $y=ax^2+bx+c$ they change by the constant $2ah^2$. For $y=a\\,b^x$ each value is $b^h$ times the previous one. These are exact properties of equally spaced exact data; measured data only approximate them, which is why residual plots are used.",
        ],
      },
    ],
    pitfalls: [
      "Subtract in the order observed minus predicted.",
      "Residuals of both signs are normal; look for a pattern in them.",
      "Compare second differences and ratios only after first differences fail to be equal.",
    ],
    parentGuide:
      "Have the learner plot the data 1, 4, 9, 16, 25 with a line, mark the misses above and below the line, and describe their shape.",
  },
  {
    id: "function-graph-features",
    title: "Features of exponential and logarithmic graphs",
    summary:
      "The constants in $a\\cdot b^x+k$ and $a\\log_b(x-h)+k$ set the asymptote, domain, range, direction and intercepts of their graphs.",
    templateIds: ["function-graph-features"],
    objectives: [
      "Find the horizontal asymptote, range and intercept of an exponential graph or equation.",
      "Find the domain and vertical asymptote of a logarithmic function from its equation or graph.",
      "State end behavior and direction from the base and the sign of the coefficient.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Where the curve flattens, and where it cannot go",
        paragraphs: [
          "You need to read a graph and evaluate a power. The power $b^x$ with $b>1$ is always positive, grows quickly to the right and flattens toward 0 on the left. Adding $k$ lifts the whole graph, so it flattens toward $y=k$. A negative coefficient flips the graph over that level.",
          'A logarithm is the inverse of a power: $\\log_b(x)$ answers "which power of $b$ gives $x$?" It exists only for positive $x$, so its graph hugs a vertical line it never reaches. Shifting the input to $x-h$ moves that line to $x=h$.',
        ],
      },
    ],
    workedExample: {
      prompt:
        "For $f(x)=2\\cdot3^x-4$, find the horizontal asymptote, the range, the y-intercept and the end behavior.",
      steps: [
        "The power $3^x$ approaches 0 as $x\\to-\\infty$, so $f$ approaches $-4$. The horizontal asymptote is $y=-4$.",
        "The coefficient 2 is positive, so $f$ stays above $-4$. The range is $y>-4$.",
        "At $x=0$: $f(0)=2\\cdot1-4=-2$. The y-intercept is $(0,-2)$.",
        "Since $b=3>1$ and $a>0$, $f\\to\\infty$ as $x\\to\\infty$ and $f\\to-4$ as $x\\to-\\infty$. The function is increasing.",
      ],
      answer: "$y=-4$; range $y>-4$; $(0,-2)$; increasing",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read each feature",
        paragraphs: [
          "Exponential $a\\cdot b^x+k$: asymptote $y=k$; y-intercept $a+k$; range above $k$ if $a>0$, below if $a<0$; increasing if $a>0$ with $b>1$, or $a<0$ with $0<b<1$.",
          "Logarithmic $a\\log_b(x-h)+k$: domain $x>h$; vertical asymptote $x=h$. With $k=0$ the graph crosses the x-axis at $(h+1,0)$, because $\\log_b(1)=0$. For $\\log_2(x+3)$, $h=-3$: the domain is $x>-3$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the features follow",
        paragraphs: [
          "For $b>1$, $b^x\\to0$ as $x\\to-\\infty$ and $b^x\\to\\infty$ as $x\\to\\infty$; for $0<b<1$ the two ends swap. Multiplying by $a$ and adding $k$ gives $a\\,b^x+k\\to k$ at the flat end. Since $b^x>0$ for every $x$, $a\\,b^x+k$ lies on one side of $k$, above for $a>0$ and below for $a<0$. The logarithm is defined where its input is positive, so $a\\log_b(x-h)+k$ has domain $x>h$, and its values grow without bound in magnitude as $x\\to h^{+}$.",
        ],
      },
    ],
    pitfalls: [
      "The asymptote is the added constant $k$, not the y-intercept.",
      "In $\\log_b(x+3)$ the asymptote is $x=-3$, the opposite sign of the 3 written.",
      "A shift outside the logarithm moves the graph up or down and does not change the domain.",
    ],
    parentGuide:
      "Sketch $y=2^x$ and $y=2^x-3$ side by side on the same grid and ask where each flattens out and where each crosses the y-axis.",
  },
];
