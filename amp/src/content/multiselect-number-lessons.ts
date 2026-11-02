import { buildSelectContent, type SelectContentSpec } from "./multiselect-kit";

const specs: SelectContentSpec[] = [
  {
    id: "place-value-forms-select",
    skillId: "large-place-value",
    title: "Expressions and word forms equal to a number",
    summary:
      "A digit is one of the symbols 0 to 9. In a big number, what a digit is worth depends on its place. In this lesson you check statements about a number. Some add up what its digits are worth. Some write a number in words.",
    goal: "Select the statements that are true for a number by finding what each of its digits is worth.",
    intuition:
      "A digit is one of the symbols 0 to 9. Its place in a number sets what it is worth. In $36{,}731$, the first 3 is in the ten-thousands place, so it is worth $30{,}000$. The 6 is worth $6{,}000$, the 7 is worth 700, the next 3 is worth 30 and the 1 is worth 1. Add those values and you get the number back: $30{,}000+6{,}000+700+30+1=36{,}731$.",
    more: "One number can be written in many ways. $36\\times1{,}000+731$ means 36 thousands and 731 more. That is $36{,}000+731=36{,}731$, so it is equal. But $36\\times100+731$ means 36 hundreds and 731 more. That is $3{,}600+731=4{,}331$, so it is not equal. To compare two whole numbers, first count their digits: the one with more digits is greater. If they have the same number of digits, start at the left. The first place where the digits differ decides which number is greater.",
    terms: ["place-value", "expanded-form"],
    steps: [
      "Write what each digit of the number is worth, such as $30{,}000+6{,}000+700+30+1$.",
      "Find the value of each statement. Add up its parts, or write its number words in digits.",
      "Compare that value with the number. A number with more digits is greater. With the same number of digits, start at the left, with the biggest place.",
      "Select only the true statements. Check that you chose as many as the question asks.",
    ],
    watch:
      "A digit one place off is worth 10 times more or 10 times less. Check the zeros in every part.",
    principle:
      "A digit's value is the digit times the value of its place. A whole number is the sum of its digit values. A count of a place works the same way: $36\\times1{,}000$ is 36 thousands, so $36\\times1{,}000+731=36{,}000+731$. To compare two whole numbers, a number with more digits is greater. With the same number of digits, find the first place from the left where the digits differ. The number with the greater digit there is the greater number.",
    example: {
      prompt: "Is $4\\times1{,}000+52$ equal to $4{,}502$?",
      steps: [
        "$4\\times1{,}000=4{,}000$, because 4 thousands is $4{,}000$.",
        "Add the rest: $4{,}000+52=4{,}052$.",
        "Compare with $4{,}502$. There the 5 is in the hundreds place, so it is worth 500. In $4{,}052$ the 5 is worth only 50, so the numbers are not equal.",
      ],
      answer: "No, it equals $4{,}052$",
    },
    objectives: [
      "Add place-value parts and decide whether they equal a given number.",
      "Write number words in digits and compare them with a number.",
    ],
    pitfalls: [
      "Using only the digit itself. The first 3 in $36{,}731$ is worth $30{,}000$, not 3.",
      "Reading $36\\times100$ as thirty-six thousand. It is thirty-six hundreds, which is $3{,}600$.",
      "Judging number words by how long they are. Write each one in digits, then compare.",
    ],
    parentGuide:
      "Write a big number. Ask your learner what each digit is worth. Then read it aloud together as thousands and ones.",
    assessed:
      "Selecting every true statement among five about a five- or six-digit whole number: sums of place-value parts, with and without a zero digit, grouped forms with counts of hundreds or thousands, and comparisons with numbers written in words.",
    notAssessed:
      "Does not assess writing a number in words, matching expanded forms to word forms in two linked parts, or numbers above 999,999.",
    facet: "large-place-value.digit-value-and-comparison",
    senses: { part: "part" },
  },
  {
    id: "equivalent-fractions-select",
    skillId: "fraction-equivalence",
    title: "Choosing every equivalent fraction",
    summary:
      "Equivalent fractions name the same amount, like $\\frac{1}{2}$ and $\\frac{2}{4}$ of a pizza. In this lesson you pick every fraction that names the same amount as a given fraction. The test is simple: the top and the bottom must both be multiplied, or both divided, by the same number, other than 0.",
    goal: "Select the fractions equal to a given fraction by checking that its top and bottom are multiplied or divided by one number.",
    intuition:
      "A fraction like $\\frac{1}{3}$ has two numbers. The bottom number, the denominator, says how many equal pieces make one whole. The top number, the numerator, says how many of those pieces you have. Equivalent fractions name the same amount. Cut each third into 2 equal pieces. Now the whole has 6 pieces and you have 2 of them. So $\\frac{1}{3}$ and $\\frac{2}{6}$ are the same amount.",
    more: "To make an equivalent fraction, multiply the top and the bottom by the same number, other than 0. For the fractions here, changing only one of them changes the amount. Adding the same number to both also changes it: $\\frac{1}{3}$ is not equal to $\\frac{2}{4}$.",
    terms: ["numerator", "denominator", "equivalent"],
    steps: [
      "Find what you multiply the given denominator by to get the choice's denominator. If the choice's denominator is smaller, find what you divide by instead.",
      "Multiply, or divide, the given numerator by that same number. If you get the choice's numerator, the fractions are equivalent.",
      "If no whole number works, multiply across. $\\frac{2}{4}$ and $\\frac{3}{6}$ are equal because $2\\times6$ and $4\\times3$ are both 12.",
      "Select only the equivalent fractions. Check that you chose as many as the question asks.",
    ],
    watch:
      "Check both numbers. A fraction with the right denominator but a different numerator is a different amount.",
    principle:
      "Two fractions $\\frac{a}{b}$ and $\\frac{c}{d}$ are equal exactly when $a\\times d=b\\times c$. Here $a$, $b$, $c$ and $d$ stand for whole numbers, and $b$ and $d$ are not 0. Multiplying or dividing the top and the bottom by the same number, other than 0, gives an equivalent fraction.",
    example: {
      prompt: "Is $\\frac{8}{12}$ equivalent to $\\frac{2}{3}$?",
      steps: [
        "To go from the denominator 3 to 12, multiply by 4.",
        "Multiply the numerator by 4 too: $2\\times4=8$.",
        "That gives $\\frac{8}{12}$, so the two fractions are equivalent.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Decide whether two fractions are equivalent by finding one number that multiplies both the top and the bottom.",
      "Spot fractions made by changing only one number or by adding to both.",
    ],
    pitfalls: [
      "Adding the same number to the top and the bottom. $\\frac{1}{3}$ and $\\frac{2}{4}$ are not equivalent.",
      "Multiplying only the top or only the bottom.",
      "Swapping the top and the bottom. $\\frac{3}{4}$ and $\\frac{4}{3}$ are different amounts.",
    ],
    parentGuide:
      "Fold a strip of paper in halves, then in quarters. Ask which fractions name the same shaded part.",
    assessed:
      "Selecting the two or three fractions equivalent to a given proper fraction among five, where the wrong choices change one part, add to both parts or exchange the parts.",
    notAssessed:
      "Does not assess finding an equivalent fraction by entry, simplifying to lowest terms, or equivalent fractions on a drawn model.",
    senses: {
      factor: "factor-number",
      third: "third",
      whole: "whole",
      quarters: "fourth",
    },
    noLink: ["changes"],
  },
  {
    id: "fraction-line-names-select",
    skillId: "fractions-number-line",
    title: "Naming a point on a number line",
    summary:
      "A fraction names part of a whole. In $\\frac{2}{6}$, the bottom number says the whole is cut into 6 equal parts, and the top number says we count 2 of them. A number line shows numbers in order along a straight line. Between 0 and 1 it can be cut into equal parts. In this lesson you read a point on that line as a fraction. Then you pick every fraction that names the same point.",
    goal: "Read the fraction at a point on a number line from 0 to 1, then select every fraction that names the same point.",
    intuition:
      "A fraction such as $\\frac{2}{6}$ has a top number and a bottom number. The bottom number says how many equal parts make the whole. The top number says how many of those parts you count. Look at the number line from 0 to 1. Small marks called ticks cut it into equal parts. If there are 6 equal parts, each part is one sixth. A point 2 parts from 0 is at $\\frac{2}{6}$. The same point has other names too, such as $\\frac{1}{3}$, because $\\frac{2}{6}$ and $\\frac{1}{3}$ are equal.",
    more: "The bottom number of the fraction, the denominator, is how many equal parts are between 0 and 1. The top number, the numerator, is how many parts you count from 0 to the point.",
    terms: ["tick-mark", "equal-parts"],
    steps: [
      "Count the equal parts between 0 and 1. That number is the denominator.",
      "Count the parts from 0 to the point. That number is the numerator.",
      "Check each choice. It names the point when it is equal to your fraction.",
      "Select only those fractions. Check that you chose as many as the question asks.",
    ],
    watch:
      "Count the spaces between the ticks, not the ticks. A line with 6 spaces has 7 ticks.",
    principle:
      "On a number line from 0 to 1 cut into $d$ equal parts, the point $p$ parts from 0 is at $\\frac{p}{d}$. Here $d$ and $p$ stand for counts. Two fractions name the same point exactly when they are equal.",
    example: {
      prompt:
        "A number line from $0$ to $1$ is cut into $6$ equal parts. A point is $3$ parts from $0$. Which names it, $\\frac{1}{2}$ or $\\frac{2}{3}$?",
      steps: [
        "The point is 3 of the 6 equal parts from 0, so it is at $\\frac{3}{6}$.",
        "$\\frac{3}{6}=\\frac{1}{2}$: 3 is half of 6, just as 1 is half of 2.",
        "$\\frac{2}{3}=\\frac{4}{6}$, which is 4 parts from 0, not 3.",
      ],
      answer: "$\\frac{1}{2}$",
    },
    objectives: [
      "Read the fraction at a point from the equal parts of a number line.",
      "Name one point with equal fractions.",
    ],
    pitfalls: [
      "Counting the ticks instead of the spaces between them.",
      "Counting parts from 1 instead of from 0.",
      "Using 1 as the numerator for every point.",
    ],
    parentGuide:
      "Mark a strip of tape from 0 to 1. Ask where each fraction goes, and which fractions share a spot.",
    assessed:
      "Reading a point on a drawn number line from $0$ to $1$ cut into sixths, eighths, ninths, tenths or twelfths, and selecting the two or three fractions that name it.",
    notAssessed:
      "Does not assess placing a point on a line, number lines past $1$ or mixed numbers.",
    senses: { part: "part" },
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
    summary:
      "To round a number is to swap it for a nearby, simpler number. Many numbers round to the same value. In this lesson you find the boundaries, where rounding to a given value starts and stops. Then you pick every number between them.",
    goal: "Select the numbers that round to a given value by checking each one against the two boundaries of that value.",
    intuition:
      "To round to the nearest tenth, swap a number for the closest tenth: a number like $124.6$, with one digit after the point. Many numbers round to $124.6$. They are the numbers nearer to $124.6$ than to $124.7$, and at least as near to $124.6$ as to $124.5$.",
    more: "A number exactly halfway between two tenths rounds up, to the greater one. So the numbers that round to $124.6$ start at $124.55$. They go up to $124.65$, but $124.65$ itself rounds up to $124.7$. These two numbers, $124.55$ and $124.65$, are the boundaries.",
    terms: ["round"],
    steps: [
      "Find the two boundaries, where rounding to the value starts and stops. Go half a step of the rounding place below and above the value. For $124.6$ at the tenths, they are $124.55$ and $124.65$.",
      "A number rounds to the value when it is at least the lower boundary and less than the upper boundary.",
      "Compare each number with both boundaries, digit by digit from the left.",
      "Select only the numbers between the boundaries. Check that you chose as many as the question asks.",
    ],
    watch:
      "Look only at the digit just right of the rounding place. $124.549$ rounds to $124.5$, even though it ends in 9.",
    principle:
      "Say the rounding place has size $u$, such as $0.1$ for tenths. A number $x$ rounds to $v$ at that place when $v-\\frac{u}{2}\\le x<v+\\frac{u}{2}$: $x$ is at least the lower boundary and less than the upper one. A number exactly halfway rounds up.",
    example: {
      prompt: "Does $38.64$ round to $38.6$ at the nearest tenth?",
      steps: [
        "Half a tenth is $0.05$. So the boundaries for $38.6$ are $38.55$ and $38.65$.",
        "$38.64$ is at least $38.55$ and less than $38.65$, so it is between them.",
        "Check another way: the hundredths digit is 4, less than 5, so the tenths digit stays 6.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find the boundaries where rounding to a given value starts and stops.",
      "Round decimals to the nearest whole number, tenth or hundredth, including numbers in the hundreds.",
    ],
    pitfalls: [
      "Rounding down a number that is exactly halfway. Halfway rounds up.",
      "Looking at a digit two places right of the rounding place.",
      "Choosing numbers that are close to the value but outside the boundaries.",
    ],
    parentGuide:
      "Put a decimal on a number line together. Ask which tenth it is closest to.",
    assessed:
      "Selecting the two or three numbers of five that round to a stated value at the nearest whole number, tenth or hundredth, including numbers with a hundreds place and numbers exactly halfway between two roundings.",
    notAssessed:
      "Does not assess rounding by entry, negative numbers or estimating sums.",
    noLink: ["boundary", "boundaries"],
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
      "A multiplication fact is a sentence like $3\\times8=24$. The numbers you multiply are the factors. The answer is the product. In this lesson you find every fact in a grid with a given product.",
    goal: "Select the multiplication facts in a grid that have a given product.",
    intuition:
      "The numbers you multiply are called factors, and the answer is called the product. One product can come from several pairs of factors. 24 is $3\\times8$, $4\\times6$ and $2\\times12$. Each pair also works in the other order, like $8\\times3$.",
    more: "The facts here use factors from 2 to 12. To find them, think of the numbers that divide the product evenly, with nothing left over. A fact that changes one factor by 1 looks close, but it gives a different product.",
    terms: ["factor-number", "product-multiply"],
    steps: [
      "List the numbers up to 12 that divide the product evenly.",
      "Find the product of each fact in the grid. Or check whether each factor is on your list with the right partner.",
      "Compare each product with the given product.",
      "Select only the facts with that product. Check that you chose as many as the question asks.",
    ],
    watch:
      "Changing just one factor changes the product: $6\\times8=48$, but $5\\times8=40$.",
    principle:
      "A product $p$ equals $a\\times b$ exactly when $a$ divides $p$ evenly and $b=p\\div a$. Here the letters stand for whole numbers, and $a$ is not 0. The order of the factors does not change the product: $a\\times b=b\\times a$.",
    example: {
      prompt: "Which fact has a product of $48$: $6\\times7$ or $6\\times8$?",
      steps: [
        "Work out the first fact: $6\\times7=42$.",
        "Work out the second fact: $6\\times8=48$.",
        "So only $6\\times8$ has the product 48.",
      ],
      answer: "$6\\times8$",
    },
    objectives: [
      "Find all the multiplication facts up to $12\\times12$ that have the same product.",
      "Use the factors of a product to check facts quickly.",
    ],
    pitfalls: [
      "Stopping after the first fact with the product.",
      "Choosing a fact whose factors are each one away from a true pair.",
      "Forgetting that the order of the factors does not matter.",
    ],
    parentGuide:
      "Pick a product such as 24. Make arrays of counters, in rows and columns, and find every pair of factors together.",
    assessed:
      "Selecting the two or three facts of six, with factors from $2$ to $12$, that have a stated product from $12$ to $72$.",
    notAssessed:
      "Does not assess recalling a single fact by entry, division facts or products above $144$.",
    facet: "multiplication-facts.core",
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["change", "changes"],
  },
  {
    id: "equal-factor-truth-select",
    lessonId: "equal-factor-equations-select-lesson",
    skillId: "multiplication-division-equality",
    title: "True equations with a number times itself",
    summary:
      "An equation is a number sentence with an equal sign, like $8\\times8=64$. It is true when both sides have the same value. In this lesson you decide whether multiplication and division equations are true or false. Some of them multiply a number by itself.",
    goal: "Decide whether each multiplication or division equation is true or false, including a number times itself.",
    intuition:
      "An equation is true when both sides of the equal sign have the same value. A number times itself, like $8\\times8=64$, is a fact like any other. Its division fact, $64\\div8=8$, gives back the 8.",
    more: "An equation can be written with the result first, like $64=8\\times8$. Swapping the sides does not change whether it is true.",
    terms: ["equation", "perfect-square"],
    steps: [
      "For a multiplication, work out the product. Compare it with the other side.",
      "For a division, ask what number times the divisor, the number you divide by, gives the starting number. Compare that with the other side.",
      "If the result is written first, work out the side with the $\\times$ or $\\div$ sign.",
      "For each equation, choose the statement that says correctly whether it is true or false. Choose one statement for each equation.",
    ],
    watch:
      "A number other than 0, times itself, divided by that number, gives the number back. $49\\div7=7$, not 6 or 8.",
    principle:
      "Each multiplication fact $a\\times b=p$ gives two division facts: $p\\div a=b$ and $p\\div b=a$. Here the letters stand for whole numbers other than 0. When $a$ and $b$ are the same number, the two division facts are the same. An equation is true when its two sides are equal, whichever side comes first.",
    example: {
      prompt: "Is $81=9\\times9$ true?",
      steps: [
        "Work out the side with the operation: $9\\times9=81$.",
        "The other side is 81.",
        "Both sides are 81, so the equation is true.",
      ],
      answer: "True",
    },
    objectives: [
      "Decide whether a multiplication or division equation is true, including a number times itself.",
      "Read an equation written with its result first.",
    ],
    pitfalls: [
      "Doubling instead of multiplying a number by itself. $7\\times7$ is 49, not 14.",
      "Thinking an equation is false because the result is on the left.",
      "Getting a number one away when dividing. $49\\div7$ is 7.",
    ],
    parentGuide:
      "Make a square of counters, such as 6 rows of 6. Ask for the multiplication and the division it shows.",
    assessed:
      "Selecting the true equations among six, mixing products, quotients and facts with equal factors from $3\\times3$ to $12\\times12$, with the result first or last.",
    notAssessed:
      "Does not assess finding a missing factor by entry, products above $144$ or square roots.",
    senses: {
      product: "product-multiply",
      side: "side-of-equation",
      square: "square-shape",
    },
    noLink: ["change"],
  },
];

export const multiselectNumberContent = buildSelectContent(specs);
