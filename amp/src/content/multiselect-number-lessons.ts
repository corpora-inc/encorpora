import { buildSelectContent, type SelectContentSpec } from "./multiselect-kit";

const specs: SelectContentSpec[] = [
  {
    id: "place-value-forms-select",
    skillId: "large-place-value",
    title: "Expressions and word forms equal to a number",
    summary:
      "Decide which place-value expressions and word forms are equal to a multidigit number.",
    goal: "Select the expressions or comparisons that are true for a given number by finding the value of each digit.",
    intuition:
      "In a number such as $36{,}731$ each digit is worth its face value times its place: the $3$ is in the ten-thousands place, so it is worth $30{,}000$. A number equals the sum of what its digits are worth, and two numbers are compared place by place from the left.",
    more: "Different expressions can have the same value. $36\\times1{,}000+731$ groups the thousands into one count and is still $36{,}731$, but $36\\times100+731$ is not, because $36$ hundreds is only $3{,}600$.",
    terms: ["place-value", "expanded-form"],
    steps: [
      "Write what each digit of the given number is worth, such as $30{,}000+6{,}000+700+30+1$.",
      "Find the value of each statement: add the parts of an expression, or change a number in words to a numeral.",
      "Compare that value with the given number, starting at the greatest place where the digits could differ.",
      "Select only the true statements and check that the count matches the question.",
    ],
    watch:
      "A digit in the wrong place changes its value by a factor of $10$: check the zeros of every part.",
    principle:
      "The value of a digit is the digit times its place value, and a whole number is the sum of its digit values. Grouping does not change a sum, so $36\\times1{,}000+731=36{,}000+731$. To compare two whole numbers, find the greatest place where their digits differ; the number with the greater digit there is the greater number.",
    example: {
      prompt: "Is $4\\times1{,}000+52$ equal to $4{,}502$?",
      steps: [
        "$4\\times1{,}000=4{,}000$.",
        "$4{,}000+52=4{,}052$.",
        "$4{,}052$ is not $4{,}502$: the $5$ in $4{,}502$ is in the hundreds place and is worth $500$, not $50$.",
      ],
      answer: "No, it equals $4{,}052$",
    },
    objectives: [
      "Find the value of an expression made of place-value parts and decide whether it equals a given number.",
      "Compare a number with a number written in words by changing the words to a numeral.",
    ],
    pitfalls: [
      "Using a digit's face value: the $3$ in $36{,}731$ is worth $30{,}000$, not $3$.",
      "Reading $36\\times100$ as thirty-six thousand when it is thirty-six hundreds.",
      "Comparing number words by how long they are instead of changing them to numerals.",
    ],
    parentGuide:
      "Ask your learner what each digit of a number is worth, then to read the number aloud as thousands and ones.",
    assessed:
      "Selecting every true statement among five about a five- or six-digit whole number: sums of place-value parts, with and without a zero digit, grouped forms with counts of hundreds or thousands, and comparisons with numbers written in words.",
    notAssessed:
      "Does not assess writing a number in words, matching expanded forms to word forms in two linked parts, or numbers above 999,999.",
    facet: "large-place-value.digit-value-and-comparison",
  },
  {
    id: "equivalent-fractions-select",
    skillId: "fraction-equivalence",
    title: "Choosing every equivalent fraction",
    summary:
      "Select the fractions that name the same amount as a given fraction.",
    goal: "Select the fractions that name the same amount as a given fraction by checking that both parts scale by one factor.",
    intuition:
      "Equivalent fractions name the same amount. Cut every part of a whole into $2$ equal pieces and you have twice as many pieces in the whole and twice as many pieces counted, so $\\frac{1}{3}$ and $\\frac{2}{6}$ are the same size.",
    more: "To make an equivalent fraction, multiply the numerator and the denominator by the same number. Changing only one of them changes the amount, and adding the same number to both also changes it.",
    terms: ["numerator", "denominator", "equivalent"],
    steps: [
      "Find the number that takes the given denominator to the choice's denominator.",
      "Multiply the given numerator by that same number. The choice is equivalent when it has that numerator.",
      "If one denominator is not a multiple of the other, cross-multiply: $\\frac{a}{b}=\\frac{c}{d}$ when $a\\times d=b\\times c$.",
      "Select only the equivalent fractions and check the count.",
    ],
    watch:
      "Check both parts. A fraction with the right denominator but another numerator is a different amount.",
    principle:
      "$\\frac{a}{b}=\\frac{c}{d}$ exactly when $a\\times d=b\\times c$. Multiplying or dividing the numerator and the denominator by the same nonzero number gives an equivalent fraction.",
    example: {
      prompt: "Is $\\frac{8}{12}$ equivalent to $\\frac{2}{3}$?",
      steps: [
        "To get from the denominator $3$ to $12$, multiply by $4$.",
        "Multiply the numerator by $4$ too: $2\\times4=8$.",
        "The result is $\\frac{8}{12}$, so the two fractions are equivalent.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Decide whether a fraction is equivalent to a given fraction by finding one factor for both parts.",
      "Reject fractions made by changing only one part or by adding to both parts.",
    ],
    pitfalls: [
      "Adding the same number to both parts: $\\frac{1}{3}$ and $\\frac{2}{4}$ are not equivalent.",
      "Multiplying only the numerator or only the denominator.",
      "Exchanging the numerator and the denominator.",
    ],
    parentGuide:
      "Fold a strip of paper in halves, then in quarters, and ask which fractions name the same shaded part.",
    assessed:
      "Selecting the two or three fractions equivalent to a given proper fraction among five, where the wrong choices change one part, add to both parts or exchange the parts.",
    notAssessed:
      "Does not assess finding an equivalent fraction by entry, simplifying to lowest terms, or equivalent fractions on a drawn model.",
  },
  {
    id: "fraction-line-names-select",
    skillId: "fractions-number-line",
    title: "Naming a point on a number line",
    summary:
      "Read a point on a zero-to-one number line and select every fraction that names it.",
    goal: "Read the fraction at a point on a number line from $0$ to $1$ and select every fraction that names the same point.",
    intuition:
      "A number line from $0$ to $1$ cut into $6$ equal parts has ticks at sixths. A point $2$ ticks from $0$ is at $\\frac{2}{6}$. The same point also has other names, such as $\\frac{1}{3}$, because they are equal.",
    more: "The number of equal parts in the whole is the denominator, and the number of parts counted from $0$ is the numerator.",
    terms: ["tick-mark", "equal-parts"],
    steps: [
      "Count the equal parts between $0$ and $1$. That is the denominator.",
      "Count the parts from $0$ to the point. That is the numerator.",
      "Check each choice against that fraction: it names the point when it is equivalent.",
      "Select only those fractions and check the count.",
    ],
    watch:
      "Count the spaces between ticks, not the tick marks: a line with $6$ spaces has $7$ marks.",
    principle:
      "On a number line from $0$ to $1$ cut into $d$ equal parts, the point $p$ parts from $0$ is at $\\frac{p}{d}$. Two fractions name the same point exactly when they are equal.",
    example: {
      prompt:
        "A number line from $0$ to $1$ is cut into $6$ equal parts. A point is $3$ parts from $0$. Which names it, $\\frac{1}{2}$ or $\\frac{2}{3}$?",
      steps: [
        "The point is at $\\frac{3}{6}$.",
        "$\\frac{3}{6}=\\frac{1}{2}$ because $3\\times2=6\\times1$.",
        "$\\frac{2}{3}=\\frac{4}{6}$, which is not $\\frac{3}{6}$.",
      ],
      answer: "$\\frac{1}{2}$",
    },
    objectives: [
      "Read the fraction at a point from the equal parts of a number line.",
      "Name one point with equivalent fractions.",
    ],
    pitfalls: [
      "Counting tick marks instead of spaces between them.",
      "Counting parts from $1$ instead of from $0$, which gives $\\frac{d-p}{d}$.",
      "Using a numerator of $1$ for every point.",
    ],
    parentGuide:
      "Mark a ruler or a strip of tape from $0$ to $1$ and ask where each fraction goes and which fractions share a spot.",
    assessed:
      "Reading a point on a drawn number line from $0$ to $1$ cut into sixths, eighths, ninths, tenths or twelfths, and selecting the two or three fractions that name it.",
    notAssessed:
      "Does not assess placing a point on a line, number lines past $1$ or mixed numbers.",
  },
  {
    id: "equivalent-ratios-select",
    skillId: "ratios",
    title: "Groups that keep a ratio",
    summary: "Select the pairs of amounts that keep a stated ratio.",
    goal: "Select the groups whose two amounts keep a stated ratio by finding the one number that scales both parts.",
    intuition:
      "A ratio compares two amounts. If a recipe uses $5$ cups of flour for every $2$ cups of milk, a double batch uses $10$ and $4$, and a triple batch uses $15$ and $6$. Each batch multiplies both amounts by the same number.",
    more: "A group keeps the ratio when both amounts are the same multiple of the ratio's two numbers. Adding the same amount to both parts, or switching the order of the parts, does not keep the ratio.",
    terms: ["ratio", "equivalent-ratios"],
    steps: [
      "Divide a group's first amount by the first number of the ratio to find the scale factor.",
      "Multiply the ratio's second number by that factor. The group keeps the ratio when this equals the group's second amount.",
      "If the first amount is not a multiple, check by cross-multiplying: $a:b$ matches $c:d$ when $a\\times d=b\\times c$.",
      "Select only the groups that keep the ratio and check the count.",
    ],
    watch:
      "Keep the parts in order: $2$ adults to $5$ students is not $5$ students to $2$ adults.",
    principle:
      "The ratio $a:b$ is equivalent to $c:d$ exactly when $a\\times d=b\\times c$, which happens when $c=ka$ and $d=kb$ for one number $k$.",
    example: {
      prompt:
        "A mix needs $3$ cups of nuts for every $4$ cups of raisins. Does a batch with $12$ cups of nuts and $16$ cups of raisins keep the ratio?",
      steps: [
        "$12\\div3=4$, so the nuts are $4$ times as many.",
        "$4\\times4=16$, which matches the raisins.",
        "Both amounts were multiplied by $4$.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Decide whether a pair of amounts keeps a stated ratio by finding a common scale factor.",
      "Tell scaling both parts from adding to both parts.",
    ],
    pitfalls: [
      "Adding the same amount to both parts: $5:2$ and $7:4$ are different ratios.",
      "Reversing the order of the two amounts.",
      "Scaling one part by a different number from the other.",
    ],
    parentGuide:
      "Double or triple a recipe together and check that every ingredient was multiplied by the same number.",
    assessed:
      "Selecting the two or three groups of five whose amounts keep a stated part-to-part ratio, in four contexts, with wrong choices that add to both parts, reverse the parts or scale unevenly.",
    notAssessed:
      "Does not assess finding a missing value by entry, unit rates, ratio tables or percent.",
  },
  {
    id: "rounds-to-select",
    skillId: "decimal-place-value",
    title: "Numbers that round to a value",
    summary: "Decide which numbers round to a stated value at a stated place.",
    goal: "Select the numbers that round to a stated value by comparing each with the lower and upper rounding boundaries.",
    intuition:
      "Rounding to the nearest tenth replaces a number with the closest multiple of $0.1$. Many different numbers round to the same value: everything within half a tenth of it.",
    more: "A number halfway between two tenths rounds up, to the greater tenth. So the numbers that round to $124.6$ start at $124.55$ and stop just below $124.65$.",
    terms: [
      "round",
      [
        "round",
        "Here, the lowest and highest numbers that still round to the value.",
      ],
    ],
    steps: [
      "Find the boundaries: half a unit of the place below and above the stated value, such as $124.55$ and $124.65$ for $124.6$ at the tenths.",
      "A number rounds to the value when it is at least the lower boundary and less than the upper boundary.",
      "For each number, compare digit by digit from the left with both boundaries.",
      "Select only the numbers between the boundaries and check the count.",
    ],
    watch:
      "Look at only the digit just right of the rounding place, not at digits farther right: $124.549$ rounds to $124.5$ even though it ends in $9$.",
    principle:
      "A number $x$ rounds to $v$ at a place of size $u$ when $v-\\frac{u}{2}\\le x<v+\\frac{u}{2}$. A value exactly halfway between two roundings rounds up.",
    example: {
      prompt: "Does $38.64$ round to $38.6$ at the nearest tenth?",
      steps: [
        "The boundaries for $38.6$ are $38.55$ and $38.65$.",
        "$38.64$ is at least $38.55$ and less than $38.65$.",
        "The hundredths digit is $4$, so the tenths digit stays $6$.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find the lowest and highest numbers that round to a stated value.",
      "Round decimals with a hundreds place to the nearest whole number, tenth or hundredth.",
    ],
    pitfalls: [
      "Rounding down every number that ends in $5$: a value halfway between rounds up.",
      "Looking at a digit two places right of the rounding place.",
      "Choosing numbers that are close to the stated value but fall outside the boundaries.",
    ],
    parentGuide:
      "Put a decimal on a number line with your learner and ask which tenth it is closest to.",
    assessed:
      "Selecting the two or three numbers of five that round to a stated value at the nearest whole number, tenth or hundredth, including numbers with a hundreds place and numbers exactly halfway between two roundings.",
    notAssessed:
      "Does not assess rounding by entry, negative numbers or estimating sums.",
  },
  {
    id: "compare-to-pi-select",
    skillId: "approximate-roots",
    title: "Comparing decimals, fractions and roots with a value",
    summary:
      "Compare decimals, fractions and square roots with $\\pi$ or a square root.",
    goal: "Select the numbers that are greater or less than $\\pi$ or a square root by writing each as a decimal.",
    intuition:
      "Numbers in different forms can be compared by writing each as a decimal. $\\pi$ is a never-ending decimal that starts $3.14159\\ldots$, so $3.14$ is less than $\\pi$ and $3.15$ is greater.",
    more: "A square root of a whole number between two perfect squares is between their roots. $\\sqrt{10}$ is between $\\sqrt{9}=3$ and $\\sqrt{16}=4$, and since $3.14^2<10$ it is greater than $3.14$.",
    terms: ["pi", "square-root"],
    steps: [
      "Write the number to compare with, such as $\\pi\\approx3.14159$, to at least four decimal places.",
      "Write each choice as a decimal to the same number of places: divide a fraction, and square a decimal to place a square root.",
      "Compare digit by digit from the left.",
      "Select only the numbers that are greater (or less) as asked and check the count.",
    ],
    watch:
      "Do not stop at $3.14$: $3.1416$ is greater than $\\pi$ and $3.1415$ is less, so compare past the hundredths place.",
    principle:
      "For positive numbers, $a<b$ exactly when $a^2<b^2$, so square roots can be compared by comparing the numbers under the radicals. $\\pi$ lies between $3.14159$ and $3.1416$.",
    example: {
      prompt: "Is $\\frac{22}{7}$ greater than $\\pi$?",
      steps: [
        "$22\\div7=3.142857\\ldots$",
        "$\\pi=3.141592\\ldots$",
        "The first difference is at the thousandths: $2$ is greater than $1$, so $\\frac{22}{7}$ is greater.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Compare a decimal, a fraction and a square root with $\\pi$ by writing them in one form.",
      "Compare square roots by comparing the numbers under the radicals.",
    ],
    pitfalls: [
      "Treating $\\pi$ as exactly $3.14$.",
      "Comparing a fraction by its numerator or denominator alone.",
      "Thinking $\\sqrt{n}$ is greater when it is written with more digits.",
    ],
    parentGuide:
      "Ask your learner to say whether $\\frac{22}{7}$ or $3.14$ is closer to $\\pi$ by writing both as decimals.",
    assessed:
      "Selecting the two or three numbers of five that are greater than or less than $\\pi$, or greater than a square root of a whole number from $20$ to $70$, among decimals, fractions and square roots written within about $0.2$ of it.",
    notAssessed:
      "Does not assess ordering a list, comparing negative numbers or proving irrationality.",
    facet: "approximate-roots.compare-forms",
  },
  {
    id: "multiplication-fact-grid-select",
    skillId: "multiplication-facts",
    title: "Facts with the same product",
    summary:
      "Find every multiplication fact in a set that has a stated product.",
    goal: "Select the multiplication facts in a grid that have a stated product.",
    intuition:
      "A product can come from several pairs of factors. $24$ is $3\\times8$, $4\\times6$ and $2\\times12$, and each pair also works in the other order.",
    more: "To find the facts with a product, think of the factors of the product: the numbers that divide it evenly. Facts that change one factor by $1$ look close but give a different product.",
    terms: ["factor-number", "product-multiply"],
    steps: [
      "List the numbers up to $12$ that divide the stated product evenly.",
      "Work out the product of each fact in the grid, or check whether each factor is on your list with the right partner.",
      "Compare each product with the stated product.",
      "Select only the facts with that product and check the count.",
    ],
    watch:
      "A fact one away from a true fact, such as $5\\times8$ next to $6\\times8$, has a different product.",
    principle:
      "A product $p$ equals $a\\times b$ exactly when $a$ divides $p$ and $b=p\\div a$. Multiplication is commutative: $a\\times b=b\\times a$.",
    example: {
      prompt: "Which fact has a product of $48$: $6\\times7$ or $6\\times8$?",
      steps: [
        "$6\\times7=42$.",
        "$6\\times8=48$.",
        "Only $6\\times8$ has the product $48$.",
      ],
      answer: "$6\\times8$",
    },
    objectives: [
      "Find all multiplication facts up to $12\\times12$ that share a product.",
      "Use factors of a product to check facts quickly.",
    ],
    pitfalls: [
      "Stopping after the first fact with the product.",
      "Choosing a fact whose factors are each one away from a true pair.",
      "Forgetting that the order of the factors does not matter.",
    ],
    parentGuide:
      "Choose a product such as $24$ and ask your learner to find every pair of factors, using an array of counters.",
    assessed:
      "Selecting the two or three facts of six, with factors from $2$ to $12$, that have a stated product from $12$ to $72$.",
    notAssessed:
      "Does not assess recalling a single fact by entry, division facts or products above $144$.",
    facet: "multiplication-facts.core",
  },
  {
    id: "equal-factor-truth-select",
    lessonId: "equal-factor-equations-select-lesson",
    skillId: "multiplication-division-equality",
    title: "True equations with a number times itself",
    summary:
      "Decide which multiplication and division equations are true, including squares.",
    goal: "Select the true multiplication and division equations, including a number times itself, written with the result first or last.",
    intuition:
      "An equation is true when both sides have the same value. A number times itself, such as $8\\times8=64$, is a multiplication fact like any other, and the matching division $64\\div8=8$ gives back the factor.",
    more: "An equation can be written with the result first, such as $64=8\\times8$. Swapping the sides does not change whether it is true.",
    terms: ["equation", "perfect-square"],
    steps: [
      "For a multiplication, work out the product and compare it with the other side.",
      "For a division, ask what number times the divisor gives the number you start with, and compare with the other side.",
      "A result written first is read the same way: work out the side with the operation.",
      "Select the true equations and check the count.",
    ],
    watch:
      "A division of a square by its factor, such as $49\\div7$, equals that factor, $7$, not $7$ plus or minus $1$.",
    principle:
      "A multiplication fact $a\\times b=p$ gives two division facts, $p\\div a=b$ and $p\\div b=a$. When $a=b$ these are the same fact. An equation is true when its two sides are equal, whichever side is written first.",
    example: {
      prompt: "Is $81=9\\times9$ true?",
      steps: [
        "Work out the side with the operation: $9\\times9=81$.",
        "The other side is $81$.",
        "Both sides are $81$.",
      ],
      answer: "True",
    },
    objectives: [
      "Decide whether a multiplication or division equation is true, including facts with equal factors.",
      "Read an equation written with its result first.",
    ],
    pitfalls: [
      "Doubling instead of squaring: $7\\times7$ is $49$, not $14$.",
      "Believing an equation is false because the result is on the left.",
      "Dividing a square by its factor and getting a number one away from the factor.",
    ],
    parentGuide:
      "Make a square out of counters, such as $6$ by $6$, and ask for the multiplication and the division it shows.",
    assessed:
      "Selecting the true equations among six, mixing products, quotients and facts with equal factors from $3\\times3$ to $12\\times12$, with the result first or last.",
    notAssessed:
      "Does not assess finding a missing factor by entry, products above $144$ or square roots.",
  },
];

export const multiselectNumberContent = buildSelectContent(specs);
