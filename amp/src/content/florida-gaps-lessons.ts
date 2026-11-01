import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const truthTerms: MethodTerm[] = ["equation", "true-equation"];
const truthMethod = (
  goal: string,
  watch: string,
  extra: string[] = [],
): ProblemMethod => ({
  goal,
  intuition:
    "The equal sign does not mean “the answer comes next.” It says that what is on the left has the same value as what is on the right. An equation can have an operation on both sides, or the result on the left, and it can be false.",
  terms: truthTerms,
  method: [
    "Find the value of the left side. Do any operation inside parentheses first.",
    "Find the value of the right side the same way.",
    ...extra,
    "Compare the two values. The equation is true exactly when they are equal.",
  ],
  watch,
});

export const floridaGapMethods: Record<string, ProblemMethod> = {
  "fl-equation-truth-20": truthMethod(
    "Given addition and subtraction equations within 20, choose the one that is true or false.",
    "Do not stop at the first operation sign. In $9-1=7$ the value on the left is 8, not 7, even though 7 sits right after the sign.",
  ),
  "fl-equation-truth-100": truthMethod(
    "Given addition and subtraction equations within 100, choose the one that is true or false.",
    "Two sums can have different addends and the same value, as in $27+13=26+14$. Compare values, not the individual numbers.",
  ),
  "multiplication-division-equation-truth": truthMethod(
    "Given multiplication and division equations with facts within 12, choose the one that is true or false.",
    "Division is not commutative: $24\\div 6$ is 4, but $6\\div 24$ is not. Evaluate each side as written.",
  ),
  "whole-number-equation-truth": truthMethod(
    "Given whole-number equations that use any of the four operations, choose the one that is true or false.",
    "Repeated subtraction counts how many times a number fits, but its value is what is left: $32-8-8-8-8=0$, not 4.",
  ),
  "fl-equation-truth-grouped": truthMethod(
    "Given equations with parentheses, decimals and any of the four operations, choose the true or false one.",
    "Work inside parentheses first, then multiplication and division, then addition and subtraction. Line up decimal points when adding or subtracting.",
    ["Keep decimals aligned by place value when you add or subtract."],
  ),
  "fl-decimal-tenth-hundredth-step": {
    goal: "Given a decimal with up to two places, find the decimal that is 0.1 or 0.01 more or less than it.",
    intuition:
      "The decimal 0.1 is one tenth and 0.01 is one hundredth. Adding or subtracting one tenth changes the digit in the tenths place by 1, and one hundredth changes the digit in the hundredths place by 1. Other digits stay the same unless a digit passes 9 or 0.",
    terms: [
      [
        "place",
        "The tenths place is the first place right of the decimal point; each count there is worth 0.1.",
      ],
      [
        "place",
        "The hundredths place is the second place right of the decimal point; each count there is worth 0.01.",
      ],
      "regroup",
    ],
    method: [
      "Write the number with two decimal places so every place has a digit.",
      "Change the digit in the tenths place (for 0.1) or hundredths place (for 0.01) by 1.",
      "If the digit would pass 9 or go below 0, regroup with the next place to the left.",
    ],
    watch:
      "Changing 0.01 less than $1.10$ means a hundredth, not a tenth: the answer is $1.09$, not $1.00$.",
  },
  "fl-decimal-by-tenth-hundredth": {
    goal: "Multiply or divide a decimal by 0.1 or 0.01, or find the missing factor, using place value.",
    intuition:
      "Multiplying by 0.1 takes one tenth of a number, which is the same as dividing by 10. Multiplying by 0.01 takes one hundredth, the same as dividing by 100. Dividing by 0.1 asks how many tenths fit, which is the same as multiplying by 10. Dividing by 0.01 is the same as multiplying by 100.",
    terms: [
      [
        "place-value",
        "Multiplying by 10 moves every digit one place left, worth 10 times as much; dividing by 10 moves it one place right.",
      ],
    ],
    method: [
      "Turn the decimal factor into its meaning: $0.1=\\frac{1}{10}$ and $0.01=\\frac{1}{100}$.",
      "Multiplying by 0.1 or 0.01 makes the number smaller: shift the digits right 1 or 2 places. Dividing by them makes it larger: shift left 1 or 2 places.",
      "For a missing factor, undo the operation with the opposite shift.",
    ],
    watch:
      "Dividing by a number less than 1 makes the result larger. $12.3\\div0.01$ is 1230, not 0.123.",
  },
  "fl-expression-description-match": {
    goal: "Choose the numerical expression that matches a written description, or the description that matches an expression.",
    intuition:
      "A written description such as “add 3 and 4, then multiply by 5” names the operations in the order they happen. Parentheses in an expression show which operation happens first. Without them, multiplication and division happen before addition and subtraction.",
    terms: [
      [
        "expression",
        "A numerical expression has numbers only, no variables, such as $5 \\times (3 + 4)$.",
      ],
      "order-of-operations",
    ],
    method: [
      "Read the description (or expression) and list its operations in the order they happen.",
      "The operation that happens first and is not the usual first one needs parentheses.",
      "Check each choice by naming its operations in order and comparing the list.",
    ],
    watch:
      "“Multiply the sum” means the addition comes first, so it goes inside parentheses: $(3+4)\\times5$, not $3+4\\times5$.",
  },
  "fl-two-step-story-equation": {
    goal: "Choose the equation with a variable and two different operations that models a whole-number story.",
    intuition:
      "A story with equal groups and one more step has two operations. Name the unknown with a letter, write what happens to it in the order of the story, and set that equal to the total the story gives.",
    terms: ["variable", ["equal-groups", "$6n$ means 6 groups of $n$."]],
    method: [
      "Say what the letter stands for.",
      "Write what happens to the unknown in the order of the story: multiply for equal groups, add or subtract for the extra step.",
      "If the extra step happens to each group, put it in parentheses before multiplying by the number of groups.",
    ],
    watch:
      "Compare “6 groups of $n$, then 4 more”, written $6n+4$, with “4 more in each of 6 groups”, written $6(n+4)$. They are different stories.",
  },
  "fl-metric-customary-conversion": {
    goal: "Use a stated conversion factor to convert a measure or an amount of money between systems.",
    intuition:
      "A conversion factor such as $1\\text{ inch}=2.54\\text{ centimeters}$ says how many of one unit make one of the other. A measure is the same size in either unit, so a larger unit has a smaller number, and a smaller unit has a larger number.",
    terms: ["conversion-factor", "customary-units", "metric-units"],
    method: [
      "Write the factor as “1 of the given unit equals $k$ of the wanted unit.”",
      "If you are going from the unit written on the left of the factor to the unit on the right, multiply by $k$. If you are going back, divide by $k$.",
      "Check the size: the unit with the smaller value in the factor has the larger number.",
    ],
    watch:
      "For $1\\text{ pound}=0.45\\text{ kilogram}$, 10 pounds is $10\\times0.45=4.5$ kilograms. Going from kilograms to pounds divides.",
  },
  "fl-integer-multiply-divide": {
    goal: "Multiply or divide two integers, using the sign rules and zero.",
    intuition:
      "An integer is a whole number, its opposite, or zero. Multiply or divide the numbers without their signs first. The product or quotient is positive when the signs are the same and negative when they are different. Zero times any number is 0, and 0 divided by a nonzero number is 0.",
    terms: ["opposite-number", "quotient"],
    method: [
      "Ignore the signs and multiply or divide the numbers.",
      "Same signs: the result is positive. Different signs: the result is negative.",
      "If either factor, or the dividend, is 0, the result is 0.",
    ],
    watch:
      "Two negatives give a positive product: $(-4)\\times(-5)=20$. A negative divided by $-1$ is positive.",
  },
  "fl-vector-dot-product": {
    goal: "Compute a dot product, a perpendicular condition, or a scalar projection for two-dimensional vectors.",
    intuition:
      "The dot product of two vectors multiplies matching components and adds the results, so it is a single number, not a vector. It is 0 exactly when the vectors are perpendicular. Divided by the length of a vector, it measures how far the other vector reaches along it.",
    terms: [
      "dot-product",
      "scalar-projection",
      [
        "perpendicular",
        "Two nonzero vectors are perpendicular exactly when their dot product is 0.",
      ],
    ],
    method: [
      "Multiply the first components and the second components, then add: $ac+bd$.",
      "For perpendicular vectors, set the dot product equal to 0 and solve for the unknown.",
      "For a scalar projection, divide the dot product by the length of the vector you project onto, $\\sqrt{c^2+d^2}$.",
    ],
    watch:
      "Do not add the components first. The dot product is $ac+bd$, not $(a+b)(c+d)$, and the result has no angle brackets.",
  },
  "fl-vector-angle": {
    goal: "Find the angle between two vectors, or decide whether they are perpendicular, parallel or neither.",
    intuition:
      "The dot product also equals the lengths times the cosine of the angle between the vectors. Solving for the cosine gives the angle. A dot product of 0 means a right angle, and when one vector is a multiple of the other the angle is $0^\\circ$ or $180^\\circ$.",
    terms: [
      [
        "angle",
        "Between two vectors drawn from the same point, it is the angle $\\theta$ from $0^\\circ$ to $180^\\circ$.",
      ],
      "vector",
      [
        "vector",
        "Parallel vectors are nonzero multiples of each other: a positive multiple points the same way, a negative one the opposite way.",
      ],
      "parallel",
    ],
    method: [
      "Compute the dot product and the two lengths.",
      "Use $\\cos\\theta=\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{u}||\\mathbf{v}|}$ and choose the angle between $0^\\circ$ and $180^\\circ$ with that cosine.",
      "A zero dot product means $90^\\circ$. If $u_1v_2-u_2v_1=0$, the vectors are parallel; the sign of the dot product tells the direction.",
    ],
    watch:
      "A negative dot product means an angle greater than $90^\\circ$. Do not report its supplement.",
  },
  "fl-even-odd-classify": {
    goal: "Use $f(-x)$ to classify a polynomial function as even, odd or neither, or choose a function with a stated symmetry.",
    intuition:
      "Replacing $x$ by $-x$ reflects a graph across the $y$-axis. If the function is unchanged, its graph is symmetric about the $y$-axis and it is even. If every output changes sign, the graph is symmetric about the origin and it is odd.",
    terms: ["even-function", "odd-function"],
    method: [
      "Replace every $x$ by $-x$. A term $kx^n$ becomes $k(-x)^n$, which keeps its sign when $n$ is even and changes sign when $n$ is odd.",
      "Simplify and compare with $f(x)$ and with $-f(x)$.",
      "Equal to $f(x)$: even. Equal to $-f(x)$: odd. Neither: neither.",
    ],
    watch:
      "A constant term has exponent 0, an even exponent. $x^3+1$ is neither even nor odd, because $f(-x)=-x^3+1$ equals neither $f(x)$ nor $-f(x)$.",
  },
  "fl-function-arithmetic": {
    goal: "Add, subtract, multiply or divide two functions, and give the domain or a value of the quotient.",
    intuition:
      "Two functions can be combined by doing the operation to their outputs. For $f$ and $g$, $(f+g)(x)$ means $f(x)+g(x)$, and so on. A quotient $\\frac{f(x)}{g(x)}$ is undefined where $g(x)=0$, so those inputs are left out of its domain.",
    terms: [
      [
        "function",
        "Here $(f+g)(x)=f(x)+g(x)$; subtract, multiply or divide the same way, using both outputs at the same input $x$.",
      ],
      [
        "domain",
        "For $\\frac{f(x)}{g(x)}$, also leave out every $x$ with $g(x)=0$.",
      ],
    ],
    method: [
      "Write the combination of the two formulas, with parentheses around each full formula.",
      "Sum and difference: distribute the sign to every term, then combine like terms. Product: multiply every term by every term.",
      "Quotient: solve $g(x)=0$ and exclude those inputs. To find a value, evaluate $f$ and $g$ at the input, then divide.",
    ],
    watch:
      "In $f-g$, the minus sign changes every term of $g$, not just the first one.",
  },
  "fl-trapezoid-consequences": {
    goal: "Use the trapezoid midsegment theorem and the angle and diagonal properties of an isosceles trapezoid.",
    intuition:
      "A trapezoid has one pair of parallel sides, the bases. The segment joining the midpoints of the two legs is the midsegment. It is parallel to the bases and its length is the average of theirs. In an isosceles trapezoid the legs are equal, which makes the base angles equal and the diagonals equal.",
    terms: [
      "trapezoid",
      [
        "midsegment",
        "In a trapezoid, the midsegment joins the midpoints of the two legs.",
      ],
      [
        "trapezoid",
        "In an isosceles trapezoid, the two legs are equal in length.",
      ],
    ],
    method: [
      "Midsegment: its length is half the sum of the bases, $\\frac{b_1+b_2}{2}$.",
      "Isosceles trapezoid angles: the two angles on the same base are equal. Each angle on the top base is supplementary to the angle on the same leg.",
      "Isosceles trapezoid diagonals are congruent. Set their expressions equal and solve.",
    ],
    watch:
      "The two angles on the same leg are supplementary because the bases are parallel, not equal. Equal angles are the two on the same base.",
  },
};

export const floridaGapPrinciples: Record<string, string> = {
  "fl-equation-truth-20":
    "An equation $L=R$ is true exactly when the number $L$ and the number $R$ are equal. The equal sign is symmetric: if $L=R$ then $R=L$.",
  "fl-equation-truth-100":
    "Different sums can have the same value. For whole numbers, $a+b=(a-k)+(b+k)$ and $a-b=(a+k)-(b+k)$. Transferring $k$ between addends keeps a sum, and adding the same $k$ to both terms keeps a difference.",
  "multiplication-division-equation-truth":
    "Division by a nonzero $b$ undoes multiplication by $b$: $a\\div b=c$ exactly when $c\\times b=a$. Multiplication is commutative, $a\\times b=b\\times a$, but division is not.",
  "whole-number-equation-truth":
    "Subtracting $b$ from $a$ a total of $k$ times gives $a-kb$. When $a=kb$, this is 0, while $a\\div b=k$. The two expressions count the same repetitions but have different values.",
  "fl-equation-truth-grouped":
    "Expressions are evaluated by the order of operations: parentheses, then multiplication and division from left to right, then addition and subtraction from left to right. Two expressions are equal exactly when they have the same value.",
  "fl-decimal-tenth-hundredth-step":
    "In base ten, $0.1=\\frac{1}{10}$ and $0.01=\\frac{1}{100}$. Ten hundredths make one tenth and ten tenths make one whole, so adding $0.01$ to a hundredths digit of 9 carries 1 to the tenths place.",
  "fl-decimal-by-tenth-hundredth":
    "Multiplying by $0.1=\\frac{1}{10}$ is the same as dividing by 10, and dividing by $0.1$ is the same as multiplying by 10. For every nonzero number $x$, $x\\div\\frac{1}{10}=10x$ and $x\\div\\frac{1}{100}=100x$.",
  "fl-expression-description-match":
    "In an expression, parentheses group the operations inside them as one value. Without grouping, multiplication and division are done before addition and subtraction, so $a+b\\times c$ means $a+(b\\times c)$.",
  "fl-two-step-story-equation":
    "If each of $g$ equal groups holds $n$ objects, the total is $gn$. Adding $e$ objects outside the groups gives $gn+e$. Adding $e$ objects to every group gives $g(n+e)=gn+ge$, a different total.",
  "fl-metric-customary-conversion":
    "If $1\\,A=k\\,B$ then $x\\,A=kx\\,B$ and $y\\,B=\\frac{y}{k}A$. For areas, a factor between square units must be used with square units, such as $1\\text{ in}^2=6.45\\text{ cm}^2$.",
  "fl-integer-multiply-divide":
    "For integers, $(-a)b=-(ab)$ and $(-a)(-b)=ab$. Since division by $b\\ne0$ is the inverse of multiplication by $b$, the quotient of two integers has the same sign as their product would. $0\\cdot a=0$, and division by 0 is undefined.",
  "fl-vector-dot-product":
    "For vectors $\\mathbf{u}=\\langle u_1,u_2\\rangle$ and $\\mathbf{v}=\\langle v_1,v_2\\rangle$, $\\mathbf{u}\\cdot\\mathbf{v}=u_1v_1+u_2v_2$. Nonzero vectors are perpendicular exactly when $\\mathbf{u}\\cdot\\mathbf{v}=0$. The scalar projection of $\\mathbf{u}$ on $\\mathbf{v}$ is $\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{v}|}$.",
  "fl-vector-angle":
    "For nonzero vectors, $\\mathbf{u}\\cdot\\mathbf{v}=|\\mathbf{u}||\\mathbf{v}|\\cos\\theta$ with $0^\\circ\\le\\theta\\le180^\\circ$, so $\\cos\\theta=\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{u}||\\mathbf{v}|}$. In the plane, $u_1v_2-u_2v_1=0$ exactly when one vector is a multiple of the other.",
  "fl-even-odd-classify":
    "A function $f$ is even if $f(-x)=f(x)$ for all $x$ in its domain, and odd if $f(-x)=-f(x)$. For a polynomial, it is even exactly when every term has an even exponent and odd exactly when every term has an odd exponent.",
  "fl-function-arithmetic":
    "For functions $f$ and $g$ with domains $D_f$ and $D_g$, $(f\\pm g)(x)=f(x)\\pm g(x)$ and $(fg)(x)=f(x)g(x)$ on $D_f\\cap D_g$, and $\\left(\\frac{f}{g}\\right)(x)=\\frac{f(x)}{g(x)}$ on $D_f\\cap D_g$ with $g(x)\\ne0$.",
  "fl-trapezoid-consequences":
    "The midsegment of a trapezoid with bases $b_1$ and $b_2$ is parallel to them and has length $\\frac{b_1+b_2}{2}$. In an isosceles trapezoid, each pair of base angles is congruent, the angles on a leg are supplementary, and the diagonals are congruent.",
};

type LessonInput = Omit<Lesson, "sections"> & {
  intuition: [string, string[]];
};
const build = ({ intuition, ...rest }: LessonInput): Lesson => ({
  ...rest,
  sections: [
    { stage: "intuition", title: intuition[0], paragraphs: intuition[1] },
  ],
});

export const floridaGapLessons: Lesson[] = [
  build({
    id: "equation-truth-check",
    title: "Decide whether an equation is true",
    summary:
      "An equation is true when both sides have the same value. Find each side's value and compare.",
    templateIds: [
      "fl-equation-truth-20",
      "fl-equation-truth-100",
      "multiplication-division-equation-truth",
      "whole-number-equation-truth",
      "fl-equation-truth-grouped",
    ],
    objectives: [
      "Say what the equal sign means: both sides have the same value.",
      "Find the value of each side and decide whether the equation is true or false.",
    ],
    intuition: [
      "The equal sign is a balance",
      [
        "You need to add, subtract, multiply and divide whole numbers. An equation joins two expressions with an equal sign. The sign says both sides have the same value, like a balanced scale.",
        "An equation can have an operation on both sides, and the number can be on the left: $12=5+7$ is as good as $5+7=12$. An equation is true when the sides match and false when they do not.",
      ],
    ],
    workedExample: {
      prompt: "Is $27+13=26+14$ true?",
      steps: [
        "Find the value of the left side: $27+13=40$.",
        "Find the value of the right side: $26+14=40$.",
        "The values are both 40, so the sides balance.",
        "Check: 26 is 1 less than 27 and 14 is 1 more than 13, so the sum does not change.",
      ],
      answer: "True. Both sides equal 40.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Find both values, then compare",
        paragraphs: [
          "Work out each side separately. Inside parentheses first, then multiplication and division, then addition and subtraction, from left to right. Do not carry the answer of the left side into the right side.",
          "Compare the two values. If they are equal the equation is true. If they differ it is false, and the equal sign should be replaced by $\\ne$.",
        ],
      },
      {
        stage: "formal",
        title: "Equality of values",
        paragraphs: [
          "An equation $L=R$ is true exactly when the numbers $L$ and $R$ are equal. Because equality is symmetric, $L=R$ and $R=L$ say the same thing.",
        ],
      },
    ],
    pitfalls: [
      "The equal sign does not mean “find the answer.” In $9-1=7$ the left side is 8, so the equation is false.",
      "Different numbers on each side can still be equal in value: $27+13=26+14$.",
      "Evaluate repeated subtraction as written: $32-8-8-8-8=0$, which is not 4.",
    ],
    parentGuide:
      "Ask the learner to say the value of each side of $8+5=10+3$ aloud before deciding whether the equal sign is right.",
  }),
  build({
    id: "decimal-tenth-hundredth-step",
    title: "Add or subtract 0.1 and 0.01",
    summary:
      "0.1 is one tenth and 0.01 is one hundredth. Change the matching place by 1, regrouping when a digit passes 9 or 0.",
    templateIds: ["fl-decimal-tenth-hundredth-step"],
    objectives: [
      "Name the place that 0.1 or 0.01 changes.",
      "Add or subtract one tenth or one hundredth, regrouping across places.",
    ],
    intuition: [
      "One tenth and one hundredth",
      [
        "You need to read decimals through hundredths. The decimal 0.1 is 1 tenth, and 0.01 is 1 hundredth. A decimal such as 1.10 is 1 one, 1 tenth and 0 hundredths.",
        "To add or subtract one tenth, change the tenths digit by 1. To add or subtract one hundredth, change the hundredths digit by 1. Regroup when the digit would go above 9 or below 0.",
      ],
    ],
    workedExample: {
      prompt: "What number is $0.01$ less than $1.10$?",
      steps: [
        "0.01 is 1 hundredth, so subtract 1 in the hundredths place of $1.10$.",
        "The hundredths digit is 0, so regroup: take 1 tenth from the tenths place and make it 10 hundredths.",
        "Now $1.10$ is 1 one, 0 tenths and 10 hundredths. Subtract 1 hundredth to leave 9 hundredths.",
        "The result is 1 one, 0 tenths and 9 hundredths. Check: $1.09+0.01=1.10$.",
      ],
      answer: "$1.09$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Change one place and regroup",
        paragraphs: [
          "Write the number with two decimal places. Identify the place: tenths for 0.1, hundredths for 0.01. Change that digit by 1 and leave the others.",
          "If the digit would pass 9, write 0 and add 1 to the place on its left. If it would go below 0, borrow 1 from the place on its left.",
        ],
      },
      {
        stage: "formal",
        title: "Place value",
        paragraphs: [
          "$0.1=\\frac{1}{10}$ and $0.01=\\frac{1}{100}$. Ten hundredths equal one tenth and ten tenths equal one whole, which is why regrouping works across places.",
        ],
      },
    ],
    pitfalls: [
      "A hundredth is not a tenth: $1.10-0.01=1.09$, not $1.00$.",
      "Do not change the digit in the wrong place when the number has one decimal place; write a zero in the hundredths place first.",
    ],
    parentGuide: "Ask what is 0.1 more than 2.95, and which two places change.",
  }),
  build({
    id: "decimal-by-tenth-hundredth",
    title: "Multiply and divide by 0.1 and 0.01",
    summary:
      "Multiplying by 0.1 or 0.01 divides by 10 or 100. Dividing by 0.1 or 0.01 multiplies by 10 or 100.",
    templateIds: ["fl-decimal-by-tenth-hundredth"],
    objectives: [
      "Explain why multiplying by 0.1 and dividing by 10 agree.",
      "Multiply and divide a decimal by 0.1 and 0.01, and find a missing factor.",
    ],
    intuition: [
      "A tenth of a number and how many tenths fit",
      [
        "You need to multiply and divide by 10 and 100 by moving digits. Multiplying by 0.1 takes one tenth of a number. Taking one tenth is the same as dividing by 10.",
        "Dividing by 0.1 asks how many tenths fit in the number. Each whole holds 10 tenths, so the result is 10 times as large.",
      ],
    ],
    workedExample: {
      prompt: "Find $12.3\\div0.01$.",
      steps: [
        "0.01 is one hundredth. Each whole holds 100 hundredths.",
        "So $12.3\\div0.01$ is $12.3\\times100$.",
        "Multiplying by 100 moves each digit 2 places left: 12.3 becomes 1230.",
        "Check: $1230\\times0.01=12.3$.",
      ],
      answer: "$1230$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Use the opposite shift for the opposite operation",
        paragraphs: [
          "Multiply by 0.1: digits move 1 place right. Multiply by 0.01: 2 places right. Divide by 0.1: 1 place left. Divide by 0.01: 2 places left.",
          "To find a missing factor in $?\\times0.01=3.7$, undo the multiplication by dividing by 0.01, which moves the digits 2 places left: $?=370$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the shifts work",
        paragraphs: [
          "$x\\times0.1=x\\times\\frac{1}{10}=x\\div10$ and $x\\div0.1=x\\times10$. The same is true for $0.01=\\frac{1}{100}$ and 100.",
        ],
      },
    ],
    pitfalls: [
      "Dividing by a number less than 1 gives a larger result.",
      "Count places carefully: 0.01 shifts two places, not one.",
    ],
    parentGuide: "Ask how many tenths are in 4 and why $4\\div0.1$ is 40.",
  }),
  build({
    id: "expression-description-match",
    title: "Match an expression to its description",
    summary:
      "Parentheses show which operation comes first. Match each description to the expression that does the same steps.",
    templateIds: ["fl-expression-description-match"],
    objectives: [
      "Write an expression for a description with a grouped operation.",
      "Describe an expression in words in the correct order.",
    ],
    intuition: [
      "Words in order become an expression",
      [
        "You need to know the order of operations: parentheses first, then multiplication and division, then addition and subtraction. A numerical expression is a group of numbers and operations. A description in words lists the operations in the order they happen.",
        "When a description says to add and then multiply the sum, the addition must happen first, so it goes inside parentheses.",
      ],
    ],
    workedExample: {
      prompt:
        "Which expression matches: “Add 4 and 6, then multiply the sum by 3”?",
      steps: [
        "The first operation is the addition $4+6$. Put it in parentheses: $(4+6)$.",
        "Then multiply that sum by 3: $(4+6)\\times3$.",
        "Compare $4+6\\times3$: it multiplies 6 by 3 first, so it does not match.",
      ],
      answer: "$(4+6)\\times3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "List the steps in order",
        paragraphs: [
          "Number the operations in the description. The first operation goes in parentheses when it is not what the order of operations would do first.",
          "To describe an expression, read it as the order of operations does and write the steps in that order.",
        ],
      },
      {
        stage: "formal",
        title: "Grouping",
        paragraphs: [
          "Parentheses make the operations inside them one value. Without them, $a+b\\times c$ means $a+(b\\times c)$.",
        ],
      },
    ],
    pitfalls: [
      "“The sum of 4 and 6, times 3” groups the sum. Without parentheses the multiplication would go first.",
      "Subtraction and division are not commutative: “subtract 4 from 9” is $9-4$.",
    ],
    parentGuide:
      "Ask the learner to write “subtract 2 from 10, then multiply by 3” as an expression.",
  }),
  build({
    id: "two-step-story-equation",
    title: "Write an equation for a two-step story",
    summary:
      "Name the unknown, write what happens to it in story order, and set it equal to the total.",
    templateIds: ["fl-two-step-story-equation"],
    objectives: [
      "Choose the operation for equal groups and the operation for the extra step.",
      "Tell apart extra items in total from extra items in each group.",
    ],
    intuition: [
      "Follow the story",
      [
        "You need to solve stories with multiplication, addition and subtraction. A variable is a letter for the unknown number. $6n$ means 6 groups of $n$.",
        "A two-step story does two things to the unknown. Write them in the order of the story, then set the result equal to the total.",
      ],
    ],
    workedExample: {
      prompt:
        "A store puts 5 equal rows of books on a shelf and 3 more books on a cart. There are 38 books in all. Let $b$ be the number of books in one row. Write an equation.",
      steps: [
        "The 5 equal rows hold $5b$ books.",
        "The 3 books on the cart are added to those, so the total is $5b+3$.",
        "The story says the total is 38.",
      ],
      answer: "$5b+3=38$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Where does the extra step happen?",
        paragraphs: [
          "If the extra items are added once to the total, add them after multiplying: $gn+e$. If each group gets extra items, add inside parentheses first: $g(n+e)$.",
          "The same applies to taking away: $gn-e$ takes away once from the total, and $g(n-e)$ takes the same amount from each group.",
        ],
      },
      {
        stage: "formal",
        title: "Equal groups",
        paragraphs: [
          "If each of $g$ equal groups holds $n$, the total is $gn$. The distributive property gives $g(n+e)=gn+ge$, which is why adding to each group is a different story from adding once.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the number of groups: “5 rows of $b$” is $5b$, not $5+b$.",
      "Match each equation to a story out loud before choosing.",
    ],
    parentGuide: "Ask how $4n+2$ and $4(n+2)$ describe two different stories.",
  }),
  build({
    id: "metric-customary-conversion",
    title: "Convert between customary and metric units",
    summary:
      "Use the given factor: multiply to go to the unit on its right, divide to come back.",
    templateIds: ["fl-metric-customary-conversion"],
    objectives: [
      "Read a conversion factor and use it in either direction.",
      "Check that the size of the number is reasonable for the unit.",
    ],
    intuition: [
      "A factor tells how many of one unit make one of another",
      [
        "You need to multiply and divide decimals. Customary units such as inches, pounds and gallons are used in the United States. Metric units such as centimeters, kilograms and liters are used in most of the world. A conversion factor links them.",
        "The factor $1\\text{ inch}=2.54\\text{ centimeters}$ says one inch is 2.54 centimeters long. A length is the same size in either unit: the smaller unit needs more of itself, so its number is larger.",
      ],
    ],
    workedExample: {
      prompt:
        "A ribbon is 12 inches long. Use $1\\text{ inch}=2.54\\text{ centimeters}$. How many centimeters is that?",
      steps: [
        "Each inch is 2.54 centimeters, and there are 12 inches.",
        "Multiply: $12\\times2.54=30.48$.",
        "Check the size: a centimeter is smaller than an inch, so the number should be larger than 12.",
      ],
      answer: "$30.48$ centimeters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Multiply or divide?",
        paragraphs: [
          "Going from the unit that is 1 in the factor to the other unit: multiply by the number. Coming back: divide by the number.",
          "For area, use an area factor, such as $1\\text{ square inch}=6.45\\text{ square centimeters}$, and for money use the stated rate in the same way.",
        ],
      },
      {
        stage: "formal",
        title: "Unit factors",
        paragraphs: [
          "If $1\\,A=k\\,B$, then $x\\,A=kx\\,B$ and $y\\,B=\\frac{y}{k}\\,A$. The factor is stated in the problem, so approximate factors give approximate measures.",
        ],
      },
    ],
    pitfalls: [
      "Do not divide when going to the smaller unit.",
      "Use the factor given in the problem, even if you remember a different approximation.",
    ],
    parentGuide:
      "Ask whether 10 pounds is more or less than 10 kilograms, using $1\\text{ pound}=0.45\\text{ kilogram}$.",
  }),
  build({
    id: "integer-multiply-divide",
    title: "Multiply and divide integers",
    summary:
      "Multiply or divide the sizes, then use the sign: same signs positive, different signs negative.",
    templateIds: ["fl-integer-multiply-divide"],
    objectives: [
      "Use the sign rules for products and quotients.",
      "Handle zero and a divisor of $-1$ correctly.",
    ],
    intuition: [
      "Sign rules from repeated groups",
      [
        "You need to multiply and divide positive whole numbers and know negative numbers. An integer is a whole number, its opposite, or 0. $3\\times(-4)$ means 3 groups of $-4$, which is $-12$.",
        "Reversing one sign reverses the product. Reversing both signs reverses it twice, so the product is positive again.",
      ],
    ],
    workedExample: {
      prompt: "Find $(-48)\\div(-6)$.",
      steps: [
        "Ignore the signs: $48\\div6=8$.",
        "The signs are the same, so the quotient is positive.",
        "Check by multiplying: $8\\times(-6)=-48$.",
      ],
      answer: "$8$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Size first, then sign",
        paragraphs: [
          "Multiply or divide the numbers without signs. Same signs make a positive result, different signs a negative result.",
          "Zero times any integer is 0, and 0 divided by a nonzero integer is 0. Dividing by $-1$ changes the sign of the number.",
        ],
      },
      {
        stage: "formal",
        title: "Why two negatives make a positive",
        paragraphs: [
          "$(-a)(-b)=ab$. Since $(-a)b=-ab$, negating this gives $-(-ab)=ab$. Division is the inverse of multiplication, so a quotient follows the same sign rules.",
        ],
      },
    ],
    pitfalls: [
      "A negative times a negative is positive, not negative.",
      "$(-4)\\times(-5)$ is 20; do not subtract.",
    ],
    parentGuide:
      "Ask for $(-6)\\times7$ and $(-6)\\times(-7)$ and why the answers differ.",
  }),
  build({
    id: "vector-dot-product",
    title: "Dot product, angle and projection",
    summary:
      "The dot product multiplies matching components and adds. It is 0 for perpendicular vectors and gives the angle through the cosine.",
    templateIds: ["fl-vector-dot-product", "fl-vector-angle"],
    objectives: [
      "Compute a dot product and use it to test perpendicular vectors.",
      "Find the angle between two vectors and the scalar projection of one on another.",
    ],
    intuition: [
      "How much two vectors point the same way",
      [
        "You need to write a vector in component form $\\langle a,b\\rangle$ and find its length $\\sqrt{a^2+b^2}$. The dot product of two vectors multiplies matching components and adds. It is one number, not a vector.",
        "The dot product is positive when the vectors point roughly the same way, 0 when they are perpendicular and negative when they point roughly opposite ways.",
      ],
    ],
    workedExample: {
      prompt:
        "Find the angle between $\\mathbf{u}=\\langle1,1\\rangle$ and $\\mathbf{v}=\\langle-2,0\\rangle$.",
      steps: [
        "Dot product: $1(-2)+1(0)=-2$.",
        "Lengths: $|\\mathbf{u}|=\\sqrt{2}$ and $|\\mathbf{v}|=2$.",
        "$\\cos\\theta=\\frac{-2}{\\sqrt{2}\\cdot2}=-\\frac{\\sqrt{2}}{2}$.",
        "The angle between $0^\\circ$ and $180^\\circ$ with this cosine is $135^\\circ$.",
      ],
      answer: "$135^\\circ$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Use the dot product three ways",
        paragraphs: [
          "Perpendicular: set $\\mathbf{u}\\cdot\\mathbf{v}=0$ and solve. Angle: compute $\\cos\\theta=\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{u}||\\mathbf{v}|}$. Scalar projection of $\\mathbf{u}$ on $\\mathbf{v}$: $\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{v}|}$.",
          "Parallel vectors: one is a multiple of the other, so $u_1v_2-u_2v_1=0$. The angle is $0^\\circ$ when the dot product is positive and $180^\\circ$ when it is negative.",
        ],
      },
      {
        stage: "formal",
        title: "Dot product and angle",
        paragraphs: [
          "$\\mathbf{u}\\cdot\\mathbf{v}=u_1v_1+u_2v_2=|\\mathbf{u}||\\mathbf{v}|\\cos\\theta$ for $0^\\circ\\le\\theta\\le180^\\circ$. Nonzero vectors are perpendicular exactly when their dot product is 0.",
        ],
      },
    ],
    pitfalls: [
      "The dot product is a number. Do not write the result in angle brackets.",
      "A negative cosine means an angle above $90^\\circ$.",
    ],
    parentGuide:
      "Ask whether $\\langle3,4\\rangle$ and $\\langle-4,3\\rangle$ are perpendicular and how the dot product shows it.",
  }),
  build({
    id: "even-odd-classify",
    title: "Even and odd functions",
    summary:
      "Replace $x$ by $-x$. If nothing changes the function is even; if every sign changes it is odd.",
    templateIds: ["fl-even-odd-classify"],
    objectives: [
      "Compute $f(-x)$ for a polynomial and compare it with $f(x)$ and $-f(x)$.",
      "Classify a function as even, odd or neither.",
    ],
    intuition: [
      "Symmetry in an equation",
      [
        "You need to evaluate a function and simplify powers of negative numbers. A function is even when $f(-x)=f(x)$, so its graph is symmetric about the $y$-axis. It is odd when $f(-x)=-f(x)$, so its graph is symmetric about the origin.",
        "A power $(-x)^n$ keeps its sign when $n$ is even and changes it when $n$ is odd.",
      ],
    ],
    workedExample: {
      prompt: "Classify $f(x)=2x^3-5x$ as even, odd or neither.",
      steps: [
        "Replace $x$ by $-x$: $f(-x)=2(-x)^3-5(-x)=-2x^3+5x$.",
        "Compare with $-f(x)=-(2x^3-5x)=-2x^3+5x$.",
        "$f(-x)=-f(x)$, so $f$ is odd.",
      ],
      answer: "Odd",
    },
    closingSections: [
      {
        stage: "method",
        title: "Compare the negated input with two things",
        paragraphs: [
          "Compute $f(-x)$ and simplify. If it equals $f(x)$, the function is even. If it equals $-f(x)$, it is odd. If it equals neither, the function is neither.",
          "For a polynomial, check the exponents: all even means even, all odd means odd. A constant term counts as an even exponent, so $x^3+1$ is neither.",
        ],
      },
      {
        stage: "formal",
        title: "Definition",
        paragraphs: [
          "$f$ is even if $f(-x)=f(x)$ for all $x$ in its domain, and odd if $f(-x)=-f(x)$ for all $x$ in its domain. The graph of an even function is unchanged by reflection across the $y$-axis. An odd function's graph is unchanged by a half-turn about the origin.",
        ],
      },
    ],
    pitfalls: [
      "A function that is not even is not necessarily odd.",
      "$f(-x)$ negates only the input, not the whole function.",
    ],
    parentGuide:
      "Ask whether $x^2$ and $x^3$ are even or odd, and what $(-2)^2$ and $(-2)^3$ show.",
  }),
  build({
    id: "function-arithmetic",
    title: "Add, subtract, multiply and divide functions",
    summary:
      "Combine the outputs of two functions with the same input. A quotient excludes the inputs where the denominator is 0.",
    templateIds: ["fl-function-arithmetic"],
    objectives: [
      "Write $(f+g)(x)$, $(f-g)(x)$ and $(fg)(x)$ as expressions.",
      "Find the domain and a value of $\\left(\\frac{f}{g}\\right)(x)$.",
    ],
    intuition: [
      "Combine outputs at the same input",
      [
        "You need to evaluate polynomial functions and combine like terms. For functions $f$ and $g$, $(f+g)(x)$ means $f(x)+g(x)$. The other operations work the same way.",
        "A quotient divides by $g(x)$, so it is not defined where $g(x)=0$.",
      ],
    ],
    workedExample: {
      prompt:
        "Let $f(x)=x^2+3x$ and $g(x)=x-2$. Find $(f-g)(x)$ and the domain of $\\left(\\frac{f}{g}\\right)(x)$.",
      steps: [
        "$(f-g)(x)=(x^2+3x)-(x-2)$. Distribute the minus sign: $x^2+3x-x+2$.",
        "Combine like terms: $x^2+2x+2$.",
        "For the quotient, solve $g(x)=0$: $x-2=0$ gives $x=2$.",
        "The domain is all real numbers except 2.",
      ],
      answer: "$(f-g)(x)=x^2+2x+2$; the domain excludes $x=2$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Put each formula in parentheses",
        paragraphs: [
          "Write each function in parentheses when you combine, so a minus sign reaches every term. For a product, multiply each term by each term.",
          "For a quotient, find the zeros of the denominator function and exclude them. To find $\\left(\\frac{f}{g}\\right)(a)$, evaluate $f(a)$ and $g(a)$ and divide.",
        ],
      },
      {
        stage: "formal",
        title: "Domain of a combination",
        paragraphs: [
          "$(f\\pm g)(x)$ and $(fg)(x)$ are defined where both $f$ and $g$ are. $\\left(\\frac{f}{g}\\right)(x)$ also requires $g(x)\\ne0$.",
        ],
      },
    ],
    pitfalls: [
      "$f-g$ changes the sign of every term of $g$.",
      "The domain of a quotient is decided by the denominator function, not the numerator.",
    ],
    parentGuide: "Ask what input is not allowed in $\\frac{x+1}{x-4}$ and why.",
  }),
  build({
    id: "trapezoid-consequences",
    title: "Trapezoid midsegment, angles and diagonals",
    summary:
      "The midsegment is the average of the bases. In an isosceles trapezoid the base angles and the diagonals are equal.",
    templateIds: ["fl-trapezoid-consequences"],
    objectives: [
      "Use the midsegment length to find a base or a variable.",
      "Use the base angles and diagonals of an isosceles trapezoid.",
    ],
    intuition: [
      "Parallel bases and equal legs",
      [
        "You need to know that parallel lines make supplementary angles on the same side of a transversal. A trapezoid has one pair of parallel sides, the bases. The legs are the other two sides. The midsegment joins the midpoints of the legs.",
        "In an isosceles trapezoid the legs are equal, so the figure is symmetric. That makes the angles on each base equal and the two diagonals equal.",
      ],
    ],
    workedExample: {
      prompt:
        "In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$, $AB=8$ and $DC=20$. Find the length of the midsegment.",
      steps: [
        "The midsegment is parallel to the bases and has length equal to the average of the bases.",
        "$\\frac{8+20}{2}=\\frac{28}{2}=14$.",
        "Check: 14 lies between 8 and 20, exactly halfway.",
      ],
      answer: "$14$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choose the theorem",
        paragraphs: [
          "Midsegment given or asked: use $m=\\frac{b_1+b_2}{2}$ and solve for the unknown. Angles in an isosceles trapezoid: equal on the same base, supplementary on the same leg. Diagonals: set them equal.",
          "When the lengths are expressions in $x$, write the equation, solve for $x$, then substitute to find the requested length.",
        ],
      },
      {
        stage: "formal",
        title: "Theorems",
        paragraphs: [
          "The midsegment of a trapezoid is parallel to the bases and has length $\\frac{b_1+b_2}{2}$. The base angles of an isosceles trapezoid are congruent, its diagonals are congruent, and consecutive angles along a leg are supplementary because the bases are parallel.",
        ],
      },
    ],
    pitfalls: [
      "The midsegment is the average of the bases, not their sum.",
      "Angles on the same leg add to $180^\\circ$; do not set them equal.",
    ],
    parentGuide:
      "Ask what the midsegment is when the bases are 6 and 14, and where the answer sits.",
  }),
];
