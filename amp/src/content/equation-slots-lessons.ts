import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "booth-equation-slots",
    title: "Write an equation for a rate plus a fee",
    summary:
      "Multiply the rate by the unknown count, then add the one-time fee or subtract the discount, and set it equal to the total.",
    objectives: [
      "Tell an amount charged for each item from an amount paid once.",
      "Write $an+c=t$ or $an-c=t$ for a story and read it either way round.",
    ],
    intuition:
      "A charge for each item grows with the number of items, so it is multiplied by the unknown count. A fee or a discount is paid once, so it is added or subtracted a single time. The total is what the group pays in all. If a fair charges 15 dollars for each booth and a fee of 40 dollars, then $b$ booths cost $15b+40$ dollars. Because equal things can be written on either side, $15b+40=190$ and $190=15b+40$ say the same thing.",
    terms: ["rate", "fixed-cost", "equation"],
    method: [
      "Name the unknown count with a letter. Multiply the amount charged for each item by that letter.",
      "Decide whether the one-time amount is a fee (add it) or a discount (subtract it).",
      "Set the expression equal to the total paid.",
    ],
    watch:
      "Do not multiply the one-time amount by the count: a fixed fee or discount is counted once.",
    principle:
      "If each of $n$ items costs $a$ and a single amount $c$ is added or subtracted, the total is $t=an+c$ or $t=an-c$. An equation can be read from either side, since $A=B$ means $B=A$.",
    example: {
      prompt:
        "A fair charges 12 dollars for each stall and a fixed fee of 30 dollars. A group pays 126 dollars for $s$ stalls. Write the equation.",
      steps: [
        "Each stall costs 12 dollars, so $s$ stalls cost $12s$ dollars.",
        "The fixed fee of 30 dollars is paid once, so it is added: $12s+30$.",
        "The group pays 126 dollars in all, so $12s+30=126$.",
      ],
      answer: "$12s+30=126$.",
    },
    methodTitle: "Rate times count, then the one-time amount",
    methodText: [
      "Check the equation with the answer: with $s=8$ stalls, $12\\cdot 8+30=126$.",
      "A discount lowers the total, so the equation subtracts it: $12s-30=t$.",
    ],
    formal:
      "The cost function $C(n)=an+c$ is linear in $n$ with slope $a$, the cost per item, and intercept $c$, the amount paid with no items. Solving $C(n)=t$ gives $n=(t-c)/a$.",
    pitfalls: [
      "Do not put the total on the left of the multiplication: the total is the value of the whole expression.",
      "Do not switch the two numbers: the rate goes with the unknown, the fee stands alone.",
    ],
    parentGuide:
      "Ask your learner to say how much one item costs and what is paid only once, and to check the equation with a small count such as 2.",
  },
  {
    id: "budget-inequality-slots",
    title: "Write an inequality for a money limit",
    summary:
      "Add the unknown amount to the known one, then choose the symbol that matches the words about the limit.",
    objectives: [
      "Choose $<$, $\\le$, $>$ or $\\ge$ from the words less than, at most, more than or at least.",
      "Write the inequality for spending within a budget or saving toward a goal.",
    ],
    intuition:
      "An inequality compares two amounts that need not be equal. If Jo has 60 dollars and a ticket costs 24 dollars, the ticket plus the snacks, $24+s$, must not be more than 60. Words say which symbol to use: at most means less than or equal to, and at least means greater than or equal to. Less than and more than leave out the equal case.",
    terms: ["at-most", "at-least", "inequality"],
    method: [
      "Write the total of the known amount and the unknown amount, such as $24+s$.",
      "Find the words that compare it with the limit or goal and choose the symbol: at most $\\le$, at least $\\ge$, less than $<$, more than $>$.",
      "Write the symbol and the limit after the total.",
    ],
    watch:
      "Check whether the limit itself is allowed. At most and at least include it; less than and more than do not.",
    principle:
      "The statements $a\\le b$ and $a\\ge b$ include the case $a=b$, while $a<b$ and $a>b$ exclude it. An inequality that says a sum $k+s$ is at most $L$ is written $k+s\\le L$.",
    example: {
      prompt:
        "Rosa has saved 35 dollars and will save $d$ dollars more. She wants to have at least 80 dollars. Write the inequality.",
      steps: [
        "After saving more she has $35+d$ dollars.",
        "At least 80 means 80 or more, so the symbol is $\\ge$.",
        "The inequality is $35+d\\ge 80$.",
      ],
      answer: "$35+d\\ge 80$.",
    },
    methodTitle: "Words to symbol",
    methodText: [
      "Test a value to check the direction: if $d=45$ then $35+45=80$, which meets the goal of at least 80.",
      "The unknown is added to the known amount; the limit stands alone on the other side.",
    ],
    formal:
      "Over the real numbers $a\\le b$ means $a<b$ or $a=b$. The solution set of $k+s\\le L$ is $s\\le L-k$, a half-line that includes its endpoint.",
    pitfalls: [
      "Do not use $<$ for at most. Equal amounts are allowed, so the symbol needs the line under it.",
      "Do not swap the two numbers: the limit goes after the symbol.",
    ],
    parentGuide:
      "Ask what happens if the amounts are exactly equal, and whether that is allowed by the words in the story.",
  },
  {
    id: "unit-fraction-division-slots",
    title: "Divide a unit fraction",
    summary:
      "Share a unit fraction among equal groups, or count unit fractions in a whole number, and write the division.",
    objectives: [
      "Write $\\frac{1}{d}\\div g$ for sharing a unit fraction equally and find $\\frac{1}{dg}$.",
      "Write $w\\div\\frac{1}{d}$ for counting unit fractions in a whole number and find $w\\times d$.",
    ],
    intuition:
      "A unit fraction names one of $d$ equal parts of a whole, like $\\frac{1}{4}$. If you share $\\frac{1}{4}$ of a pan equally among 3 people, each part of the pan is cut into 3 smaller pieces, so a whole pan has $4\\times 3=12$ of the small pieces, and each share is $\\frac{1}{12}$. If you ask how many $\\frac{1}{4}$ mile laps make 3 miles, each mile holds 4 laps, so 3 miles hold $3\\times 4=12$ laps.",
    terms: ["unit-fraction", "quotient"],
    method: [
      "Decide which story it is: sharing an amount among groups (the amount is divided by the number of groups), or counting how many small pieces fit in a larger amount (the larger amount is divided by the piece).",
      "Write the division with the amount first and what it is divided by second.",
      "Find the quotient: $\\frac{1}{d}\\div g=\\frac{1}{dg}$, and $w\\div\\frac{1}{d}=w\\times d$.",
    ],
    watch:
      "Dividing a unit fraction by a whole number makes it smaller; dividing a whole number by a unit fraction makes it larger.",
    principle:
      "For positive integers, $\\frac{1}{d}\\div g=\\frac{1}{dg}$ because each of the $d$ parts is cut into $g$ equal pieces, and $w\\div\\frac{1}{d}=wd$ because each whole contains $d$ pieces of size $\\frac{1}{d}$. Division by $\\frac{1}{d}$ is multiplication by $d$.",
    example: {
      prompt:
        "A pie has $\\frac{1}{3}$ left and it is shared equally among 4 people. Write the division and find each share.",
      steps: [
        "The amount shared is $\\frac{1}{3}$ and the number of people is 4, so the division is $\\frac{1}{3}\\div 4$.",
        "Each third is cut into 4 smaller parts, so the whole pie has $3\\times 4=12$ of them.",
        "Each share is $\\frac{1}{12}$ of the pie.",
      ],
      answer: "$\\frac{1}{3}\\div 4=\\frac{1}{12}$.",
    },
    methodTitle: "Cut each part, or count the parts",
    methodText: [
      "Draw a whole as a bar. For sharing, split the shaded part into the number of groups; for counting, split each whole into pieces and count the pieces in the larger amount.",
      "Check by multiplying: $\\frac{1}{12}\\times 4=\\frac{1}{3}$ and $12\\times\\frac{1}{4}=3$.",
    ],
    formal:
      "Division by $g$ is the inverse of multiplication by $g$: $\\frac{1}{d}\\div g=q$ means $q\\cdot g=\\frac{1}{d}$, which gives $q=\\frac{1}{dg}$. Likewise $w\\div\\frac{1}{d}=q$ means $q\\cdot\\frac{1}{d}=w$, so $q=wd$.",
    pitfalls: [
      "Do not multiply the denominator when the number of groups is not a divisor: sharing among 4 people multiplies the denominator by 4.",
      "Do not give $\\frac{w}{d}$ for the number of laps; laps are counted by multiplying by $d$.",
    ],
    parentGuide:
      "Fold a strip of paper into fourths, shade one fourth, and fold that fourth again to share it; count the folded pieces in the whole strip.",
  },
  {
    id: "array-division-slots",
    title: "Divide with an array",
    summary:
      "An array of equal rows has a total; dividing the total by the rows or by the number in a row gives the other factor.",
    objectives: [
      "Find the total of an array from its rows and the number in each row.",
      "Write the division that finds either the number of rows or the number in each row.",
    ],
    intuition:
      "An array is objects arranged in equal rows. If there are 7 rows with 8 counters in each, there are $7\\times 8=56$ counters. Division undoes multiplication: if you know the total and the number in each row, $56\\div 8$ tells how many rows. If you know the total and the number of rows, $56\\div 7$ tells how many are in each row.",
    terms: ["array", "sum"],
    method: [
      "Multiply the number of rows by the number in each row to find the total.",
      "Write the total first, then divide by the known number: the number in a row, or the number of rows.",
      "Write the quotient: it is the other factor.",
    ],
    watch:
      "The total goes first in the division. Dividing by the total gives a number less than 1, not a count.",
    principle:
      "If $r\\times c=T$ with $r$ and $c$ positive whole numbers, then $T\\div c=r$ and $T\\div r=c$. These two divisions and the two multiplications $r\\times c$ and $c\\times r$ are a fact family.",
    example: {
      prompt:
        "An array has 6 rows with 9 counters in each row. Write the division that finds the number of rows.",
      steps: [
        "The total is $6\\times 9=54$ counters.",
        "To find the number of rows, divide the total by the number in each row: $54\\div 9$.",
        "$54\\div 9=6$, which is the number of rows.",
      ],
      answer: "$54\\div 9=6$.",
    },
    methodTitle: "A fact family",
    methodText: [
      "Check by multiplying the quotient by the divisor: $6\\times 9=54$.",
      "Switching which factor you divide by gives the other division in the fact family: $54\\div 6=9$.",
    ],
    formal:
      "In the multiplication fact $r\\times c=T$, division is defined by $T\\div c=r$ exactly when $r\\times c=T$, for $c\\ne0$. Multiplication is commutative, so $c\\times r=T$ also, giving $T\\div r=c$.",
    pitfalls: [
      "Do not divide a number that is smaller than the divisor: the total is the greatest number in the equation.",
      "Do not use the sum of the rows and columns for the total.",
    ],
    parentGuide:
      "Lay out counters in rows and ask your learner to cover one row and say how many counters would be left to share into rows.",
  },
  {
    id: "story-operations-slots",
    title: "Choose the operations of a story",
    summary:
      "Read how the quantities in a story combine and choose multiplication, addition or subtraction for each step.",
    objectives: [
      "Choose multiplication for equal groups and addition or subtraction for extras and amounts removed.",
      "Check an equation with the total in the story.",
    ],
    intuition:
      "A story combines quantities in a few ways. Equal groups are multiplied: 4 bags with 6 balls in each is $4\\times 6$. Extra items are added, and items given away are subtracted. When groups are made of groups, such as courts with bags with balls, the sizes multiply again. Read the story in order and decide what each number does to the total.",
    terms: ["equal-groups", "order-of-operations"],
    method: [
      "Find the numbers in the story and what each one counts.",
      "For each pair, choose the operation: multiply for equal groups, add for more, subtract for fewer.",
      "Compute with the order of operations and check that you reach the total in the story.",
    ],
    watch:
      "Multiply before you add or subtract. Test your choice: it must give exactly the total shown.",
    principle:
      "A total made of $n$ groups of $g$ and $e$ extra is $ng+e$, and of $n$ groups of $g$ with $e$ removed is $ng-e$. In an expression without parentheses, multiplication is done before addition and subtraction.",
    example: {
      prompt:
        "A coach buys 4 bags with 6 balls in each bag and 5 more loose balls. Which operations find the total?",
      steps: [
        "4 bags with 6 balls in each is an equal-groups story: $4\\times 6$.",
        "The 5 loose balls are extra, so they are added.",
        "$4\\times 6+5=24+5=29$ balls.",
      ],
      answer: "$4\\times 6+5=29$.",
    },
    methodTitle: "Groups first, then extras",
    methodText: [
      "Say each step in words before choosing: groups of, plus, minus.",
      "Check with the order of operations: in $4\\times 6+5$ the product is done first.",
    ],
    formal:
      "Multiplication is repeated addition of equal groups, and it binds more tightly than addition and subtraction, so $ng+e$ is $(ng)+e$. Different choices of operations give different totals, so the total identifies the choice.",
    pitfalls: [
      "Do not add the group size to the number of groups; equal groups are multiplied.",
      "Do not subtract when items are added to the total.",
    ],
    parentGuide:
      "Act the story out with small objects and ask what happens to the pile at each step.",
  },
  {
    id: "delivery-operations-slots",
    title: "Choose the operations for adding and removing",
    summary:
      "Read a story in order and choose addition or subtraction for each change to the starting amount.",
    objectives: [
      "Choose addition for amounts that arrive and subtraction for amounts that leave.",
      "Write a one-line equation for a start amount with several changes and find the amount left.",
    ],
    intuition:
      "A starting amount changes step by step. Items that arrive are added to what you have, and items that leave are subtracted. Reading the story in order gives the equation in order: 18 tulips, plus 25 from one farm, plus 14 from another, minus 30 sold. The amount left is the result of those steps.",
    terms: [
      [
        "change",
        "A delivery is items arriving, a change that increases the amount.",
      ],
      "change",
    ],
    method: [
      "Write the starting amount first.",
      "Read each change in order: arrival means add, leaving or loss means subtract.",
      "Compute from left to right and check the result with the story.",
    ],
    watch:
      "Check each change against the story: a number that wilts, sells or is given away is subtracted, even if the sentence is about a delivery.",
    principle:
      "Adding and subtracting are done from left to right, so $a+b-c$ means $(a+b)-c$. The result is the net change applied to $a$: the sum of arrivals minus the sum of losses.",
    example: {
      prompt:
        "A shop has 18 tulips. One farm delivers 25 more, another delivers 14 more, and 30 are sold. How many are left?",
      steps: [
        "Start with 18. The two deliveries are added: $18+25+14$.",
        "The 30 sold are subtracted: $18+25+14-30$.",
        "$18+25=43$, $43+14=57$, $57-30=27$ tulips.",
      ],
      answer: "$18+25+14-30=27$.",
    },
    methodTitle: "Follow the story in order",
    methodText: [
      "Write the equation in the order of the story, then compute step by step.",
      "A check: the amount left cannot be greater than the start plus all arrivals.",
    ],
    formal:
      "Integer addition and subtraction are performed left to right: $a\\pm b\\pm c=((a\\pm b)\\pm c)$. Subtracting $c$ is adding $-c$, so the result equals $a$ plus the sum of the signed changes.",
    pitfalls: [
      "Do not subtract an arrival or add a loss.",
      "Do not skip a change: each number in the story has an operation in front of it.",
    ],
    parentGuide:
      "Use coins or counters: move counters onto the table for each arrival and away for each loss, saying the operation as you move.",
  },
  {
    id: "table-equation-slots",
    title: "Find the equation of a table",
    summary:
      "From a table of $x$ and $y$ values, find the number multiplied by $x$ and the number added or subtracted.",
    objectives: [
      "Find how much $y$ changes when $x$ goes up by 1 and use it as the multiplier.",
      "Use one pair to find the constant and write $y=ax+b$ or $y=ax-b$.",
    ],
    intuition:
      "A table can follow an equation such as $y=9x+3$. When $x$ goes up by 1, $y$ goes up by 9, the number multiplied by $x$. After you multiply $x$ by that number, the rest is the number you add or subtract to reach $y$: for $x=1$, $9\\cdot1=9$ and $y=12$, so you add 3. Always test the equation with another pair.",
    terms: ["multiplier", "constant-term"],
    method: [
      "Find the change in $y$ for each change of 1 in $x$. If $x$ changes by 2, divide the change in $y$ by 2.",
      "Multiply the first $x$ by that number and compare with the first $y$ to find the constant and whether to add or subtract.",
      "Test the equation on another pair of the table.",
    ],
    watch:
      "Do not take the first $y$ for the multiplier or the constant. Test the equation on a second pair.",
    principle:
      "If the pairs $(x,y)$ lie on $y=ax+b$, then $\\dfrac{y_2-y_1}{x_2-x_1}=a$ for any two pairs, and $b=y_1-ax_1$. The equation fits the table exactly when it holds for every pair.",
    example: {
      prompt:
        "A table has $x$ = 2, 3, 4, 5 and $y$ = 11, 15, 19, 23. Find the equation.",
      steps: [
        "When $x$ goes up by 1, $y$ goes up by 4, so the multiplier is 4.",
        "For $x=2$: $4\\cdot 2=8$ and $y=11$, so the constant is $11-8=3$, added.",
        "The equation is $y=4x+3$. Test $x=5$: $4\\cdot 5+3=23$.",
      ],
      answer: "$y=4x+3$.",
    },
    methodTitle: "Change first, then constant",
    methodText: [
      "If the constant is negative the equation subtracts it: $y=8x-1$.",
      "With $x$ steps of 2, the change in $y$ for one step of $x$ is half the change shown.",
    ],
    formal:
      "A relation between two quantities that has a constant rate of change $a$ has the form $y=ax+b$. The value $b$ is the value of $y$ when $x=0$ and may be negative.",
    pitfalls: [
      "Do not use the first $y$ or the gap between two $y$ values as the multiplier unless $x$ goes up by 1.",
      "Do not mix up adding and subtracting the constant: compute $ax$ first and compare with $y$.",
    ],
    parentGuide:
      "Ask your learner what happens to $y$ when $x$ goes up by one, and then to test the guess with the last pair.",
  },
  {
    id: "rule-table-fill-slots",
    title: "Complete a table from its rule",
    summary:
      "Use a rule to find an output from an input, and undo the rule to find an input from an output.",
    objectives: [
      "Find $y$ for a given $x$ in a rule that adds, subtracts or multiplies.",
      "Find $x$ for a given $y$ by undoing the rule with the opposite operation.",
    ],
    intuition:
      "A rule such as $y=x+7$ tells how to get the output $y$ from the input $x$: add 7. To fill a missing output, put the input into the rule. To fill a missing input, work backward: if $y=15$ and the rule added 7, then $x$ was $15-7=8$. Addition and subtraction undo each other, and so do multiplication and division.",
    terms: ["input", "output", "inverse-operation"],
    method: [
      "For a missing $y$, replace $x$ in the rule by the given number and compute.",
      "For a missing $x$, undo the rule: subtract if the rule adds, add if it subtracts, divide if it multiplies.",
      "Put each value back into the rule to check it.",
    ],
    watch:
      "To find an input, do the opposite operation. Adding 7 again to a given $y$ gives the wrong input.",
    principle:
      "A rule $y=f(x)$ pairs each input with one output. For $y=x+k$, $y=x-k$ and $y=kx$, the inputs are recovered from the outputs by $x=y-k$, $x=y+k$ and $x=y/k$.",
    example: {
      prompt: "Use $y=x+7$ to find $y$ when $x=5$ and $x$ when $y=15$.",
      steps: [
        "For $x=5$: $y=5+7=12$.",
        "For $y=15$: undo adding 7 by subtracting, $x=15-7=8$.",
        "Check: $8+7=15$.",
      ],
      answer: "$y=12$ and $x=8$.",
    },
    methodTitle: "Forward and backward",
    methodText: [
      "Mark the table cells you must fill, then label each one as 'input known' or 'output known'.",
      "Check each missing value by putting the input into the rule.",
    ],
    formal:
      "The functions $x\\mapsto x+k$, $x\\mapsto x-k$ and $x\\mapsto kx$ (with $k\\ne0$) are one-to-one, so each output comes from exactly one input, found by applying the inverse function.",
    pitfalls: [
      "Do not apply the rule again to an output; that gives the next output, not the input.",
      "Do not mix up the rows: the first row is $x$ and the second row is $y$.",
    ],
    parentGuide:
      "Ask your learner to say the rule as 'add 7' and then 'to go back, take 7 away'.",
  },
  {
    id: "unit-price-sentence-slots",
    title: "Find the price of one",
    summary:
      "Divide the total cost by the number of items to get the price of one item.",
    objectives: [
      "Write total cost $\\div$ number of items $=$ price of one.",
      "Compute a unit price in whole dollars or dollars and cents.",
    ],
    intuition:
      "A unit price is the cost of one item. If 4 pairs of gloves cost 68 dollars and every pair costs the same, sharing the 68 dollars equally among the 4 pairs gives the price of one: $68\\div 4=17$ dollars. The total is divided, and the number of items is the divisor.",
    terms: ["unit-price", "divisor"],
    method: [
      "Identify the total cost and the number of items.",
      "Divide the total cost by the number of items.",
      "Write the answer with its unit, dollars per item, and check that the number of items times the price is the total.",
    ],
    watch: "Divide the cost by the count, not the count by the cost.",
    principle:
      "If $n$ identical items cost $T$ in all, the price of one is $u=T/n$, because $n\\cdot u=T$. A unit price is a rate: a quantity per one unit.",
    example: {
      prompt:
        "6 pairs of socks cost 21 dollars in all. What does one pair cost?",
      steps: [
        "The total cost is 21 dollars and the number of pairs is 6.",
        "$21\\div 6=3.5$, so one pair costs 3.50 dollars.",
        "Check: $6\\times 3.50=21$.",
      ],
      answer: "$21\\div 6=3.50$ dollars per pair.",
    },
    methodTitle: "Total divided by count",
    methodText: [
      "When the answer has cents, write two decimal places: 3.50 dollars.",
      "Check by multiplying the unit price by the count.",
    ],
    formal:
      "A unit rate is the ratio $T:n$ expressed with denominator 1, $\\frac{T}{n}$. Since $n\\cdot\\frac{T}{n}=T$, the unit price multiplied by the number of items returns the total.",
    pitfalls: [
      "Do not divide the number of items by the total cost.",
      "Do not add the count and the cost.",
    ],
    parentGuide:
      "Ask your learner to check the answer by buying the items at that price in their head.",
  },
  {
    id: "cylinder-volume-slots",
    title: "Write the volume of a cylinder",
    summary:
      "The volume of a cylinder is $\\pi$ times the radius, times the radius, times the height; a diameter must be halved first.",
    objectives: [
      "Use the radius, not the diameter, in $V=\\pi r^2h$.",
      "Fill in the radius twice and the height in the volume equation.",
    ],
    intuition:
      "A cylinder is a circle stretched up by its height. The circle has area $\\pi r^2$, which is $\\pi\\times r\\times r$, with $r$ the radius, the distance from the center to the edge. The volume is that area times the height. A length across a round pool through the center is the diameter, which is twice the radius, so it must be halved first.",
    terms: ["radius", "diameter", "cylinder"],
    method: [
      "Find the radius: if the length across the circle is given, divide it by 2.",
      "Write $V=\\pi\\times r\\times r\\times h$ with the radius twice and the height once.",
      "Check that each number comes from the right measurement: radius, radius, height.",
    ],
    watch:
      "Check whether the length given is the diameter or the radius before you put it in the equation.",
    principle:
      "The volume of a cylinder with base radius $r$ and height $h$ is $V=\\pi r^2h$: the area $\\pi r^2$ of the base times the height. The diameter is $d=2r$.",
    example: {
      prompt:
        "A round tank is 10 feet across and 6 feet high. Write the volume equation.",
      steps: [
        "10 feet is the distance across, the diameter, so the radius is $10\\div 2=5$ feet.",
        "The base area is $\\pi\\times 5\\times 5$.",
        "The volume is $V=\\pi\\times 5\\times 5\\times 6$ cubic feet.",
      ],
      answer: "$V=\\pi\\times 5\\times 5\\times 6$.",
    },
    methodTitle: "Radius, radius, height",
    methodText: [
      "The radius appears twice because $r^2=r\\times r$.",
      "The units are cubic: feet times feet times feet.",
    ],
    formal:
      "By Cavalieri's principle a cylinder has the volume of a prism with the same base area and height. The base area of a circle of radius $r$ is $\\pi r^2$, so $V=\\pi r^2h$.",
    pitfalls: [
      "Do not use the diameter as the radius: that makes the volume four times too big.",
      "Do not use the depth as one of the radii.",
    ],
    parentGuide:
      "Ask your learner to point to the center and the edge of the circle to find the radius before writing any numbers.",
  },
  {
    id: "dilation-rule-slots",
    title: "Write the rule of a dilation",
    summary:
      "A dilation centered at the origin multiplies both coordinates by one scale factor; find it by dividing image by original.",
    objectives: [
      "Find the scale factor from a point and its image.",
      "Write $(x,y)\\to(kx,ky)$.",
    ],
    intuition:
      "A dilation stretches or shrinks a figure from a center. When the center is the origin, every point moves along the line through the origin and its distance from the origin is multiplied by the scale factor $k$. Each coordinate is multiplied by $k$. If the point $(2,3)$ goes to $(8,12)$, then $8\\div2=4$ and $12\\div3=4$, so $k=4$ and the rule is $(x,y)\\to(4x,4y)$. A scale factor less than 1 shrinks the figure.",
    terms: ["dilation", "scale-factor", "image-transformation"],
    method: [
      "Divide the $x$-coordinate of the image by the $x$-coordinate of the original point.",
      "Divide the $y$-coordinates the same way. Both quotients must give the same number $k$.",
      "Write the rule $(x,y)\\to(kx,ky)$ with $k$ in both places.",
    ],
    watch:
      "Divide the image by the original, not the other way round: dividing the original by the image gives $\\frac{1}{k}$.",
    principle:
      "A dilation with center $O$ and scale factor $k>0$ maps $P$ to the point $P'$ on ray $OP$ with $OP'=k\\cdot OP$. With $O$ the origin, $(x,y)\\to(kx,ky)$.",
    example: {
      prompt:
        "A dilation centered at the origin takes $A(6,9)$ to $A'(2,3)$. Write its rule.",
      steps: [
        "$2\\div6=\\frac{1}{3}$ and $3\\div 9=\\frac{1}{3}$.",
        "The scale factor is $k=\\frac{1}{3}$, so the figure shrinks.",
        "The rule is $(x,y)\\to(\\frac{1}{3}x,\\frac{1}{3}y)$.",
      ],
      answer: "$(x,y)\\to(\\frac{1}{3}x,\\frac{1}{3}y)$.",
    },
    methodTitle: "Image over original",
    methodText: [
      "A scale factor greater than 1 enlarges, and one between 0 and 1 reduces.",
      "Check the rule on the given point: $\\frac{1}{3}\\cdot6=2$ and $\\frac{1}{3}\\cdot9=3$.",
    ],
    formal:
      "In coordinates, the dilation with center the origin and scale factor $k$ is the map $D_k(x,y)=(kx,ky)$. It multiplies every distance from the origin by $k$ and preserves angles.",
    pitfalls: [
      "Do not add the same number to both coordinates; that is a translation.",
      "Do not use different multipliers for $x$ and $y$.",
    ],
    parentGuide:
      "Plot the point and its image on a grid, draw the line from the origin through both, and compare the distances from the origin.",
  },
  {
    id: "transformation-rule-slots",
    title: "Match transformations to rules",
    summary:
      "Test a point to match a reflection or rotation about the origin with its coordinate rule.",
    objectives: [
      "Recall the rules of reflections across the axes and the line $y=x$.",
      "Match rotations of 90 and 180 degrees about the origin to their rules.",
    ],
    intuition:
      "Each transformation sends a point $(x,y)$ to an image. Reflecting across the $x$-axis flips the sign of $y$: $(x,-y)$. Reflecting across the $y$-axis flips the sign of $x$: $(-x,y)$. A rotation of 180 degrees about the origin flips both signs. A reflection across the line $y=x$ swaps the coordinates. A 90 degree turn counterclockwise sends $(x,y)$ to $(-y,x)$. A test point such as $(2,3)$ shows each rule quickly.",
    terms: ["reflection", "rotation", "image-transformation"],
    method: [
      "Choose a test point with different positive coordinates, such as $(2,3)$.",
      "Find where each transformation sends it by picturing it on a coordinate plane.",
      "Match the image to the rule that produces it, such as $(2,-3)$ to $(x,-y)$.",
    ],
    watch:
      "A 90 degree counterclockwise turn is $(-y,x)$ and a clockwise one is $(y,-x)$. Check with the test point.",
    principle:
      "Reflection across the $x$-axis: $(x,y)\\to(x,-y)$; across the $y$-axis: $(-x,y)$; across $y=x$: $(y,x)$. Rotation about the origin by 180 degrees: $(-x,-y)$; by 90 degrees counterclockwise: $(-y,x)$; by 90 degrees clockwise: $(y,-x)$.",
    example: {
      prompt:
        "Match a reflection across the $y$-axis and a rotation of 180 degrees about the origin to the rules $(-x,-y)$ and $(-x,y)$.",
      steps: [
        "Test $(2,3)$. A reflection across the $y$-axis moves it to $(-2,3)$, which is $(-x,y)$.",
        "A rotation of 180 degrees sends $(2,3)$ to $(-2,-3)$, which is $(-x,-y)$.",
        "Each transformation has its own rule.",
      ],
      answer: "Reflection: $(-x,y)$. Rotation: $(-x,-y)$.",
    },
    methodTitle: "One test point",
    methodText: [
      "Use the same test point for every row so that images can be compared.",
      "Two rules can look alike: $(-x,y)$ and $(x,-y)$ differ in which coordinate changes sign.",
    ],
    formal:
      "Reflections and rotations about the origin are linear maps with matrices of determinant $\\pm1$. A reflection reverses orientation; a rotation preserves it. All of them preserve distances.",
    pitfalls: [
      "Do not match a reflection to a rotation rule because both change signs.",
      "Do not forget the swap: reflecting across $y=x$ exchanges the coordinates.",
    ],
    parentGuide:
      "Cut a small paper triangle and move it on a coordinate grid; follow one vertex with a pencil.",
  },
  {
    id: "exponent-quotient-slots",
    title: "Divide powers with the same base",
    summary:
      "Divide the coefficients and subtract the exponents, bottom from top, to simplify a quotient of powers.",
    objectives: [
      "Divide the coefficients and subtract the exponents of a quotient with the same base.",
      "Interpret a negative exponent that comes from a greater exponent in the denominator.",
    ],
    intuition:
      "A power such as $x^7$ means $x$ multiplied by itself 7 times. In $\\frac{x^2}{x^7}$, two of the factors in the numerator cancel two in the denominator, leaving five factors of $x$ in the denominator, which is written $x^{-5}$. The exponent is the exponent on top minus the exponent on the bottom: $2-7=-5$. The coefficients are divided like ordinary numbers.",
    terms: ["coefficient", "exponent", "negative-exponent"],
    method: [
      "Divide the coefficient in the numerator by the coefficient in the denominator.",
      "Subtract the exponents: numerator minus denominator.",
      "Write the coefficient and the variable with the exponent, keeping a negative sign if the result is negative.",
    ],
    watch:
      "Subtract in the right order: top minus bottom. Reversing the order gives the wrong sign.",
    principle:
      "For $a\\ne0$ and integers $m$ and $n$, $\\dfrac{a^{m}}{a^{n}}=a^{m-n}$. If $m<n$ the exponent is negative and $a^{m-n}=\\dfrac{1}{a^{n-m}}$.",
    example: {
      prompt: "Simplify $\\dfrac{12x^{3}}{4x^{7}}$.",
      steps: [
        "Divide the coefficients: $12\\div 4=3$.",
        "Subtract the exponents, top minus bottom: $3-7=-4$.",
        "The quotient is $3x^{-4}$, which equals $\\dfrac{3}{x^{4}}$.",
      ],
      answer: "$3x^{-4}$.",
    },
    methodTitle: "Coefficient, then exponent",
    methodText: [
      "Check by cancelling: $\\frac{x^3}{x^7}$ leaves 4 factors of $x$ in the denominator.",
      "If the exponent on top is greater, the exponent of the result is positive.",
    ],
    formal:
      "For $m\\ge n$, $\\frac{a^m}{a^n}=a^{m-n}$ by cancelling $n$ factors. Defining $a^{-k}=\\frac{1}{a^{k}}$ extends the rule to every integer $m$ and $n$.",
    pitfalls: [
      "Do not divide the exponents or add them.",
      "Do not forget to divide the coefficients; the exponent rule applies to the variable only.",
    ],
    parentGuide:
      "Write out the factors of $x$ on top and on bottom and cross out pairs to see what is left.",
  },
  {
    id: "square-root-solutions-slots",
    title: "Solve a squared binomial",
    summary:
      "If a squared binomial equals a positive number, take both square roots and solve for $x$ each way.",
    objectives: [
      "Take the positive and negative square root of both sides of $(x\\pm h)^2=k^2$.",
      "Solve the two linear equations and name the lesser and greater solution.",
    ],
    intuition:
      "If a number squared is 25, the number is 5 or $-5$, because both square to 25. So $(x-3)^2=25$ means $x-3=5$ or $x-3=-5$, which gives $x=8$ or $x=-2$. Solve each equation separately; there are two solutions. Check each in the original equation.",
    terms: ["binomial", "square-root"],
    method: [
      "Take the square root of both sides, writing $\\pm$ before the root of the right side.",
      "Solve $x\\pm h=k$ and $x\\pm h=-k$ separately.",
      "Check each solution in the original equation and order them from least to greatest.",
    ],
    watch: "Keep both roots. Using only the positive root loses one solution.",
    principle:
      "For $k>0$, $u^2=k^2$ exactly when $u=k$ or $u=-k$. With $u=x-h$ the solutions of $(x-h)^2=k^2$ are $x=h+k$ and $x=h-k$.",
    example: {
      prompt: "Solve $(x+2)^2=36$.",
      steps: [
        "Take both square roots: $x+2=6$ or $x+2=-6$.",
        "Solve each: $x=4$ or $x=-8$.",
        "Check: $(4+2)^2=36$ and $(-8+2)^2=36$.",
      ],
      answer: "$x=-8$ or $x=4$.",
    },
    methodTitle: "Two equations from one",
    methodText: [
      "The two solutions are the same distance from the number that makes the binomial zero.",
      "Do not expand the square for this method; the root is simpler.",
    ],
    formal:
      "$u^2=k^2$ is equivalent to $(u-k)(u+k)=0$, so by the zero product property $u=k$ or $u=-k$. Substituting $u=x\\mp h$ gives the two solutions.",
    pitfalls: [
      "Do not change the sign of $h$ incorrectly: for $(x+2)^2$, subtract 2 from each root.",
      "Do not give $k^2$ or $\\sqrt{k}$ as a solution.",
    ],
    parentGuide:
      "Ask your learner to substitute each answer back in and see that both give the number on the right.",
  },
  {
    id: "function-shift-sentence",
    title: "Describe a function shift",
    summary:
      "In $g(x)=f(x-h)+k$, the inside number moves the graph opposite to its sign and the outside number moves it with its sign.",
    objectives: [
      "Read the horizontal shift from the number inside the parentheses.",
      "Read the vertical shift from the number added or subtracted outside.",
    ],
    intuition:
      "The graph of $f$ is every point $(x,f(x))$. In $g(x)=f(x-6)+2$, the output is the value of $f$ at $x-6$, so $g$ at $x=6$ has the value $f$ had at $0$: the graph has moved to the right by 6. Adding 2 outside raises every output by 2. So the graph of $g$ is the graph of $f$ shifted right 6 and up 2. A plus sign inside, $f(x+6)$, moves it left.",
    terms: ["translation", "function-notation"],
    method: [
      "Look inside the parentheses: $x-h$ shifts right by $h$, $x+h$ shifts left by $h$.",
      "Look outside: $+k$ shifts up by $k$, $-k$ shifts down by $k$.",
      "Name both shifts with their distances.",
    ],
    watch:
      "Inside the parentheses the direction is opposite to the sign: $x-6$ moves right.",
    principle:
      "The graph of $g(x)=f(x-h)+k$ is the graph of $f$ translated by $h$ units to the right (left if $h<0$) and $k$ units up (down if $k<0$): $(a,b)$ on $f$ corresponds to $(a+h,b+k)$ on $g$.",
    example: {
      prompt: "Describe the graph of $g(x)=f(x+3)-5$ compared with $f$.",
      steps: [
        "Inside, $x+3$ means a shift left by 3.",
        "Outside, $-5$ means a shift down by 5.",
        "Together, the graph is shifted left 3 and down 5.",
      ],
      answer: "Left 3 units and down 5 units.",
    },
    methodTitle: "Inside opposite, outside same",
    methodText: [
      "Check with a point: if $(0,4)$ is on $f$ then $g$ has the point $(-3,-1)$.",
      "Two shifts are independent: one sideways, one up or down.",
    ],
    formal:
      "If $(a,b)$ satisfies $b=f(a)$ then $g(a+h)=f(a)+k=b+k$, so $(a+h,b+k)$ is on the graph of $g$. Every point of $g$ arises this way, so $g$ is the translation of $f$ by the vector $(h,k)$.",
    pitfalls: [
      "Do not move the graph left for $x-6$.",
      "Do not use one distance for both shifts.",
    ],
    parentGuide:
      "Plot $y=x^2$ and $y=(x-2)^2$ on one grid and compare the lowest points.",
  },
];

const built = formatLessons(entries);
export const equationSlotsLessons = built.lessons;
export const equationSlotsMethods = built.methods;
export const equationSlotsPrinciples = built.principles;

export const equationSlotsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "booth-equation-slots",
    facetId: "two-step-equations.story-equation",
    extent: "partial",
    rationale:
      "Complete $an+c=t$ or $an-c=t$ for a story with a rate and a one-time fee or discount by choosing the rate, the operation, the one-time amount and the total, in either order. Does not assess solving the equation, equations with parentheses, or building the equation by dragging.",
  },
  {
    templateId: "budget-inequality-slots",
    facetId: "simple-inequalities.context-inequality",
    extent: "partial",
    rationale:
      "Complete $k+s \; \\square \; L$ for spending within a budget or saving toward a goal by choosing the known amount, one of the four symbols from at-most, less-than, at-least or more-than wording, and the limit. Does not assess solving or graphing the inequality, or negative coefficients.",
  },
  {
    templateId: "unit-fraction-division-slots",
    facetId: "unit-fraction-division.core",
    extent: "partial",
    rationale:
      "Complete the division of a unit fraction by a whole number, of a whole number by a unit fraction, or the denominator of a shared unit fraction, by choosing numbers of the equation. Does not assess non-unit fractions, mixed numbers, or drawing a model.",
  },
  {
    templateId: "array-division-slots",
    facetId: "division-facts.related-facts",
    extent: "partial",
    rationale:
      "Complete a division equation for an array of at most 12 rows and 9 columns, finding either the number of rows or the number in a row. Does not assess arrays shown as drawings, remainders, or division beyond 100.",
  },
  {
    templateId: "story-operations-slots",
    facetId: "multiplicative-stories.operation-model",
    extent: "partial",
    rationale:
      "Choose the two operations of an equation for equal groups plus extras, equal groups with some removed, or three factors, with one choice of operations giving the total. Does not assess division stories with remainders, solving unknown-factor equations, or building the equation by dragging.",
  },
  {
    templateId: "delivery-operations-slots",
    facetId: "multi-operation-stories.core",
    extent: "partial",
    rationale:
      "Choose three operations for a start amount with two additions and a removal, or one addition and two removals, or a removal followed by two additions, with a unique choice giving the total. Does not assess writing the equation without a given order of numbers, or reasonableness checks.",
  },
  {
    templateId: "table-equation-slots",
    facetId: "dependent-variables.equation-from-table-graph",
    extent: "partial",
    rationale:
      "Complete $y=ax\\pm b$ for a table of four or five pairs by choosing the multiplier, the sign and the constant. Does not assess equations from graphs, tables with fractions, or choosing which variable depends on the other.",
  },
  {
    templateId: "rule-table-fill-slots",
    facetId: "rule-patterns.number-rule-terms",
    extent: "partial",
    rationale:
      "Choose two outputs and two inputs of a table for $y=x+k$, $y=x-k$ or $y=kx$ with whole numbers. Does not assess two-operation rules, fractional rules, or describing the pattern in words.",
  },
  {
    templateId: "unit-price-sentence-slots",
    facetId: "unit-rates.whole-quantity-unit-rates",
    extent: "partial",
    rationale:
      "Complete the sentence total cost divided by number of pairs equals price per pair by choosing three numbers, in whole dollars or dollars and cents. Does not assess comparing two unit prices, unit rates with fractions, or other units of measure.",
  },
  {
    templateId: "cylinder-volume-slots",
    facetId: "curved-solid-volume.cylinder-volume",
    extent: "partial",
    rationale:
      "Complete $V=\\pi\\times r\\times r\\times h$ by choosing the radius twice and the height for a pool given by diameter or radius. Does not assess evaluating the volume, cones and spheres, or unit conversions.",
  },
  {
    templateId: "dilation-rule-slots",
    facetId: "dilations-similarity.origin-dilations",
    extent: "partial",
    rationale:
      "Complete $(x,y)\\to(kx,ky)$ from a vertex and its image under a dilation centered at the origin, for scale factors 2 to 5 and $\\frac{1}{2}$ to $\\frac{1}{4}$, by choosing both multipliers. Does not assess dilations with another center, negative scale factors, or drawing the image.",
  },
  {
    templateId: "transformation-rule-slots",
    facetId: "rigid-motions.coordinate-images",
    extent: "partial",
    rationale:
      "Match two or three of six transformations about the origin (three reflections, three rotations) to coordinate rules from a bank of five. Does not assess translations, composition of transformations, or finding the image of a given figure.",
  },
  {
    templateId: "exponent-quotient-slots",
    facetId: "exponent-laws.same-base-quotient",
    extent: "partial",
    rationale:
      "Choose the coefficient and the exponent of a quotient of two terms with the same base, with a negative or positive result. Does not assess several bases, powers of powers, or writing the result with positive exponents.",
  },
  {
    templateId: "square-root-solutions-slots",
    facetId: "quadratic-equations.core",
    extent: "partial",
    rationale:
      "Choose the lesser and the greater solution of $(x\\pm h)^2=k^2$ for a perfect square $k^2$. Does not assess irrational solutions, equations that need expanding first, or complex solutions.",
  },
  {
    templateId: "function-shift-sentence",
    facetId: "quadratic-graphs.translations",
    extent: "partial",
    rationale:
      "Complete a sentence that describes $g(x)=f(x\\mp h)\\pm k$ by choosing the horizontal and vertical directions and distances. Does not assess drawing the translated graph, stretches or reflections, or a specific parent function.",
  },
];
