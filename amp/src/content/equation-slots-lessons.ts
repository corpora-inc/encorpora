import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "booth-equation-slots",
    title: "Write an equation for a rate plus a fee",
    summary:
      "Multiply the price for each item by the unknown count. Add a one-time fee or subtract a discount, and set that equal to the total.",
    objectives: [
      "Tell an amount charged for each item from an amount paid only once.",
      "Write an equation such as $12s+30=126$ for a story, and read it from either side.",
    ],
    intuition:
      "An equation says two amounts are equal. Its two sides are the amounts left and right of the equals sign. A letter such as $b$ can stand for an unknown number, and $15b$ means 15 times $b$. Some charges come once for each item, such as 15 dollars for each booth. They grow with the number of items, so multiply them by the count. A fee is paid only once, so it is added a single time. A discount is taken off once, so it is subtracted once. The total is what is paid in all. If a fair charges 15 dollars for each booth plus a fee of 40 dollars, then $b$ booths cost $15b+40$ dollars. If the total was 190 dollars, the equation is $15b+40=190$. The two sides of an equals sign can swap places: $190=15b+40$ says the same thing.",
    terms: ["rate", "fixed-cost", "equation"],
    method: [
      "Name the unknown count with a letter. Multiply the price for each item by that letter.",
      "Decide whether the one-time amount is a fee (add it) or a discount (subtract it).",
      "Set the expression equal to the total paid.",
    ],
    watch:
      "Do not multiply the one-time amount by the count. A fee or a discount is counted once.",
    principle:
      "If each of $n$ items costs $a$, and one amount $c$ is added or subtracted once, the total is $t=an+c$ or $t=an-c$. An equation can be read from either side, because $A=B$ means the same as $B=A$.",
    example: {
      prompt:
        "A fair charges 12 dollars for each stall and a fixed fee of 30 dollars. A group pays 126 dollars for $s$ stalls. Write the equation.",
      steps: [
        "Each stall costs 12 dollars, so $s$ stalls cost 12 times $s$, written $12s$ dollars.",
        "The fixed fee of 30 dollars is paid once, so add it once: $12s+30$.",
        "The group pays 126 dollars in all, so set the cost equal to 126: $12s+30=126$.",
      ],
      answer: "$12s+30=126$.",
    },
    methodTitle: "Price times count, then the one-time amount",
    methodText: [
      "Check the equation with the real count. With $s=8$ stalls, $12\\cdot8+30=96+30=126$. The raised dot means times.",
      "A discount lowers the total, so the equation subtracts it: $12s-30=t$, where $t$ is the total.",
    ],
    formal:
      "The cost $C(n)=an+c$, read “$C$ of $n$”, is a linear function of the count $n$: its graph is a straight line. Its slope, or steepness, is $a$, the cost per item. Its intercept, the starting value, is $c$, the amount paid for zero items. When the price $a$ is more than 0, solving $C(n)=t$ gives $n=\\frac{t-c}{a}$.",
    pitfalls: [
      "Keep the total by itself on one side. It is the value of the whole expression, not one of the numbers being multiplied.",
      "Do not switch the two numbers. The price for each item goes with the unknown, and the fee stands alone.",
    ],
    parentGuide:
      "Ask your learner to say how much one item costs and what is paid only once, and to check the equation with a small count such as 2.",
    senses: { side: "side-of-equation", "more than": "more-than" },
    noLink: ["part"],
  },
  {
    id: "budget-inequality-slots",
    title: "Write an inequality for a money limit",
    summary:
      "Add the unknown amount to the known one. Then pick the sign from the words: at most means no more than, at least means no less than.",
    objectives: [
      "Choose $<$, $\\le$, $>$ or $\\ge$ from the words less than, at most, more than or at least.",
      "Write the inequality for spending within a budget or saving toward a goal.",
    ],
    intuition:
      "An inequality compares two amounts that may not be equal. It uses a sign: $<$ means “is less than”, $>$ means “is greater than”, $\\le$ means “is less than or equal to” and $\\ge$ means “is greater than or equal to”. Suppose Jo has 60 dollars, a ticket costs 24 dollars, and $s$ stands for the money spent on snacks. The ticket plus the snacks, $24+s$, must not be more than 60. “Not more than 60” means 60 or less, so $24+s\\le60$. The words tell you which sign to use. “At most” means less than or equal to, $\\le$. “At least” means greater than or equal to, $\\ge$. “Less than” ($<$) and “more than” ($>$) leave out the equal case.",
    terms: ["at-most", "at-least", "inequality"],
    method: [
      "Write the total of the known amount and the unknown amount, such as $24+s$.",
      "Find the words that compare it with the limit or goal, and choose the sign: at most $\\le$, at least $\\ge$, less than $<$, more than $>$.",
      "Write the sign, and then the limit, after the total.",
    ],
    watch:
      "Check whether the limit itself is allowed. At most and at least include it. Less than and more than do not.",
    principle:
      "The statements $a\\le b$ and $a\\ge b$ include the case $a=b$. The statements $a<b$ and $a>b$ leave it out. A sum $k+s$ that is at most $L$ is written $k+s\\le L$.",
    example: {
      prompt:
        "Rosa has saved 35 dollars and will save $d$ dollars more. She wants to have at least 80 dollars. Write the inequality.",
      steps: [
        "After saving $d$ dollars more, she has $35+d$ dollars.",
        "“At least 80” means 80 or more, so the sign is $\\ge$, greater than or equal to.",
        "The inequality is $35+d\\ge80$.",
      ],
      answer: "$35+d\\ge 80$.",
    },
    methodTitle: "Words to sign",
    methodText: [
      "Test a number to check the direction. If $d=50$, she has $35+50=85$ dollars, which meets the goal, and $85\\ge80$ is true. With $d=40$ she has 75 dollars, which misses it, and $75\\ge80$ is false.",
      "The unknown is added to the known amount. The limit stands alone after the sign.",
    ],
    formal:
      "For real numbers, $a\\le b$ means $a<b$ or $a=b$. The inequality $k+s\\le L$ has solutions, the values of $s$ that make it true. They are all $s\\le L-k$: every number up to and including $L-k$.",
    pitfalls: [
      "Do not use $<$ for at most. Equal amounts are allowed, so the sign needs the line under it, $\\le$.",
      "The limit may come first or last, as long as the sign points the right way: $35+d\\ge80$ and $80\\le35+d$ mean the same thing, but $35+d\\le80$ does not.",
    ],
    parentGuide:
      "Ask what happens if the amounts are exactly equal, and whether the words in the story allow that.",
    senses: { "more than": "more-than", side: "side-of-equation" },
    noLink: ["mean"],
  },
  {
    id: "unit-fraction-division-slots",
    title: "Divide a unit fraction",
    summary:
      "A unit fraction is one equal part of a whole, like $\\frac{1}{4}$. Share it, or count how many fit in a whole number, by dividing.",
    objectives: [
      "Share a unit fraction among equal groups and write the division, such as $\\frac{1}{4}\\div 3=\\frac{1}{12}$.",
      "Count how many unit fractions fit in a whole number and write the division, such as $3\\div\\frac{1}{4}=12$.",
    ],
    intuition:
      "A fraction such as $\\frac{1}{4}$, one fourth, means 1 of 4 equal parts of a whole. The bottom number, 4, is called the denominator: it tells how many equal parts make the whole. A fraction with 1 on top is called a unit fraction. The sign ÷ means divided by. First story, sharing: share $\\frac{1}{4}$ of a pan of brownies equally among 3 people. Cut that fourth into 3 smaller pieces. Every fourth can be cut the same way, so the whole pan has $4\\times 3=12$ small pieces. Each person gets one: $\\frac{1}{4}\\div 3=\\frac{1}{12}$. Second story, counting: how many $\\frac{1}{4}$ mile laps make 3 miles? Each mile holds 4 laps, so 3 miles hold $3\\times 4=12$ laps: $3\\div\\frac{1}{4}=12$.",
    terms: ["unit-fraction", "quotient"],
    method: [
      "Decide which story it is. Sharing: a part is split among groups, so divide the part by the number of groups. Counting: you ask how many small parts fit in an amount, so divide the amount by the small part.",
      "Write the division with the amount first and what you divide by second.",
      "Find the answer. Sharing cuts each part into more pieces: $\\frac{1}{4}\\div 3=\\frac{1}{4\\times 3}=\\frac{1}{12}$. Counting multiplies: $3\\div\\frac{1}{4}=3\\times 4=12$.",
    ],
    watch:
      "Sharing a unit fraction among groups makes each share smaller. Counting unit fractions in a whole number gives a bigger number.",
    principle:
      "For whole numbers $d$, $g$ and $w$ more than 0: $\\frac{1}{d}\\div g=\\frac{1}{d\\times g}$, because each of the $d$ parts is cut into $g$ equal pieces. And $w\\div\\frac{1}{d}=w\\times d$, because each whole holds $d$ pieces of size $\\frac{1}{d}$. So dividing by $\\frac{1}{d}$ is the same as multiplying by $d$.",
    example: {
      prompt:
        "A pie has $\\frac{1}{3}$ left and it is shared equally among 4 people. Write the division and find each share.",
      steps: [
        "The amount shared is $\\frac{1}{3}$ of a pie, and there are 4 people. So the division is $\\frac{1}{3}\\div 4$.",
        "Cut each third of the pie into 4 smaller pieces, so each person can get one. The whole pie then has $3\\times 4=12$ small pieces.",
        "Each person gets one small piece, so each share is $\\frac{1}{12}$ of the pie.",
      ],
      answer: "$\\frac{1}{3}\\div 4=\\frac{1}{12}$.",
    },
    methodTitle: "Cut each part, or count the parts",
    methodText: [
      "Draw the whole as a bar. To share, split the shaded part into as many pieces as there are groups. To count, split each whole into pieces and count the pieces in the larger amount.",
      "Check by multiplying back: $\\frac{1}{12}\\times 4=\\frac{1}{3}$, and $12\\times\\frac{1}{4}=3$.",
    ],
    formal:
      "Dividing by $g$ undoes multiplying by $g$. So $\\frac{1}{d}\\div g=q$ means $q\\times g=\\frac{1}{d}$, which gives $q=\\frac{1}{d\\times g}$. In the same way, $w\\div\\frac{1}{d}=q$ means $q\\times\\frac{1}{d}=w$, so $q=w\\times d$.",
    pitfalls: [
      "When you share $\\frac{1}{3}$ among 4 people, multiply the denominator by 4. Each share is $\\frac{1}{12}$, not $\\frac{1}{7}$ or $\\frac{4}{3}$.",
      "To count $\\frac{1}{4}$ mile laps in 3 miles, multiply: $3\\times 4=12$ laps. The answer is not $\\frac{3}{4}$.",
    ],
    parentGuide:
      "Fold a strip of paper into fourths and shade one fourth. Fold that fourth again to share it. Then count how many of the small pieces fit in the whole strip.",
    senses: { whole: "whole", part: "part" },
  },
  {
    id: "array-division-slots",
    title: "Divide with an array",
    summary:
      "An array is objects in equal rows. Divide its total by the number of rows, or by the number in each row, to find the other number.",
    objectives: [
      "Find the total of an array from its number of rows and the number in each row.",
      "Write the division that finds the number of rows or the number in each row.",
    ],
    intuition:
      "An array is objects set out in equal rows. A row goes across. Say there are 7 rows with 8 counters in each row. The sign × is read “times,” so there are $7\\times 8=56$ counters in all. To divide means to split a total into equal groups, and ÷ is read “divided by.” Division undoes multiplication. If you know the total and the number in each row, $56\\div 8=7$ tells how many rows. If you know the total and the number of rows, $56\\div 7=8$ tells how many are in each row. The answer to a division is called the quotient.",
    terms: ["array", "quotient"],
    method: [
      "Multiply the number of rows by the number in each row to find the total.",
      "Write the total first. Then divide by the number you know: the number in each row, or the number of rows.",
      "The quotient is the other number. Check: the quotient times the number you divided by makes the total.",
    ],
    watch:
      "Put the total first in the division. It is the biggest number, because it counts all the counters.",
    principle:
      "The numbers 6, 9 and 54 make four facts: $6\\times 9=54$, $9\\times 6=54$, $54\\div 9=6$ and $54\\div 6=9$. Four facts made from the same three numbers are called a fact family. In general, if $r\\times c=T$ for whole numbers $r$ and $c$ more than 0, then $T\\div c=r$ and $T\\div r=c$.",
    example: {
      prompt:
        "An array has 6 rows with 9 counters in each row. Write the division that finds the number of rows.",
      steps: [
        "Multiply to find the total: 6 rows of 9 is $6\\times 9=54$ counters.",
        "To find the number of rows, divide the total by the number in each row: $54\\div 9$. This asks how many groups of 9 make 54.",
        "$54\\div 9=6$, because $6\\times 9=54$. That is the number of rows.",
      ],
      answer: "$54\\div 9=6$.",
    },
    methodTitle: "A fact family",
    methodText: [
      "Check by multiplying the quotient by the number you divided by: $6\\times 9=54$.",
      "A fact family is the four facts made from the same three numbers. Divide by the other number to get the other division in the family: $54\\div 6=9$.",
    ],
    formal:
      "Division undoes multiplication: $T\\div c=r$ means exactly that $r\\times c=T$, where $c$ is not 0. The order of the factors, the numbers you multiply, does not change the product, so $c\\times r=T$ too. That gives $T\\div r=c$.",
    pitfalls: [
      "Put the total first. In $54\\div 9$, the total 54 comes before the number you divide by.",
      "Find the total by multiplying, not adding: 6 rows of 9 is $6\\times 9=54$, not $6+9=15$.",
    ],
    parentGuide:
      "Lay out counters in rows. Ask your learner how many there are in all. Then ask which division finds the number of rows, and which finds the number in each row.",
    senses: { factor: "factor-number", product: "product-multiply" },
  },
  {
    id: "story-operations-slots",
    title: "Choose the operations of a story",
    summary:
      "Read how the numbers in a story fit together. Choose × for equal groups, + for extra items and − for items taken away.",
    objectives: [
      "Choose multiplication for equal groups, and addition or subtraction for extra items and items taken away.",
      "Check an equation against the total in the story.",
    ],
    intuition:
      "A story puts numbers together in a few ways. Equal groups are groups that all hold the same number. They are multiplied: 4 bags with 6 balls in each is $4\\times 6$, read “4 times 6.” Extra items are added, and items given away are subtracted. Sometimes there are groups of groups, like 3 courts, each with 4 bags of 6 balls. Then you multiply again: $3\\times 4\\times 6$. An equation is a number sentence with an equals sign, like $4\\times 6+5=29$. Multiply before you add or subtract. That is part of the order of operations, the agreed order for working out a number sentence.",
    terms: ["equal-groups", "order-of-operations"],
    method: [
      "Find the numbers in the story and what each one counts.",
      "Choose an operation for each one: × for equal groups, + for extra items, − for items taken away.",
      "Work it out, multiplying first. Check that you reach the total in the story.",
    ],
    watch:
      "Multiply before you add or subtract. Your choice must give exactly the total shown.",
    principle:
      "4 bags of 6 balls and 5 more make $4\\times 6+5=29$. In general, $n$ groups of $g$ with $e$ extra make $n\\times g+e$, and with $e$ taken away make $n\\times g-e$. Without parentheses, multiplication is done before addition and subtraction.",
    example: {
      prompt:
        "A coach buys 4 bags with 6 balls in each bag and 5 more loose balls. Which operations find the total?",
      steps: [
        "4 bags with 6 balls in each are equal groups, so multiply: $4\\times 6$.",
        "The 5 loose balls are extra, so add them.",
        "Multiply first, then add: $4\\times 6+5=24+5=29$ balls.",
      ],
      answer: "$4\\times 6+5=29$.",
    },
    methodTitle: "Groups first, then extras",
    methodText: [
      "Say each step in words before you choose: groups of, plus, minus.",
      "Multiply first. In $4\\times 6+5$, find $4\\times 6=24$ before you add 5.",
    ],
    formal:
      "Multiplication is a quick way to add equal groups: $4\\times 6=6+6+6+6$. It is done before addition and subtraction, so $n\\times g+e$ means $(n\\times g)+e$. Different choices of operations give different totals. So the total in the story tells you which choice is right.",
    pitfalls: [
      "Do not add the group size to the number of groups. Equal groups are multiplied: 4 bags of 6 is $4\\times 6=24$, not $4+6=10$.",
      "Do not subtract items that are added to the total.",
    ],
    parentGuide:
      "Act the story out with small objects and ask what happens to the pile at each step.",
  },
  {
    id: "delivery-operations-slots",
    title: "Choose the operations for adding and removing",
    summary:
      "Read a story in order. Start with the first amount, add each amount that arrives and subtract each amount that leaves.",
    objectives: [
      "Choose addition for amounts that arrive and subtraction for amounts that leave.",
      "Write one equation for a starting amount with several changes, and find the amount left.",
    ],
    intuition:
      "The starting amount is what you have at the beginning. It changes step by step. Items that arrive are added, and items that leave are subtracted. Write the number sentence in the same order as the story. A shop has 18 tulips. One farm brings 25 more and another brings 14 more. Then 30 are sold: $18+25+14-30$. Work from left to right: $18+25=43$, $43+14=57$, $57-30=27$. An equation is a number sentence with an equals sign: $18+25+14-30=27$. So 27 tulips are left.",
    terms: [
      [
        "change",
        "A delivery is items arriving, a change that makes the amount bigger.",
      ],
    ],
    method: [
      "Write the starting amount first.",
      "Read each change in order. Something arrives: add. Something is sold, lost or given away: subtract.",
      "Work from left to right, one step at a time. Check the result with the story.",
    ],
    watch:
      "Check each number against the story. Flowers that wilt, are sold or are given away are subtracted, even in a sentence about a delivery.",
    principle:
      "Add and subtract from left to right: $18+25-30$ means $(18+25)-30$. With letters, $a+b-c$ means $(a+b)-c$. The result is the start, plus everything that arrived, minus everything that left.",
    example: {
      prompt:
        "A shop has 18 tulips. One farm delivers 25 more, another delivers 14 more, and 30 are sold. How many are left?",
      steps: [
        "Start with 18. The two deliveries arrive, so add them: $18+25+14$.",
        "The 30 sold leave the shop, so subtract them: $18+25+14-30$.",
        "Work from left to right: $18+25=43$, $43+14=57$, $57-30=27$ tulips.",
      ],
      answer: "$18+25+14-30=27$.",
    },
    methodTitle: "Follow the story in order",
    methodText: [
      "Write the equation in the order of the story, then work it out step by step.",
      "A check: the amount left can never be more than the start plus all the arrivals.",
    ],
    formal:
      "Addition and subtraction are done from left to right: $a+b-c=(a+b)-c$. Taking away $c$ undoes adding $c$. So the result is the start $a$, plus every amount that arrived, minus every amount that left.",
    pitfalls: [
      "Add what arrives and subtract what leaves, never the other way around.",
      "Do not skip a change. Each number after the start gets a + or a − in front of it.",
    ],
    parentGuide:
      "Use coins or counters. Move counters onto the table for each arrival and away for each loss. Say plus or minus as you move them.",
    senses: { change: "change", changes: "change" },
  },
  {
    id: "table-equation-slots",
    title: "Find the equation of a table",
    summary:
      "From a table of $x$ and $y$ values, find the number that multiplies $x$ and the number added or subtracted to get $y$.",
    objectives: [
      "Find how much $y$ changes when $x$ goes up by 1, and use it as the multiplier.",
      "Use one pair to find the constant, and write an equation such as $y=4x+3$ or $y=8x-1$.",
    ],
    intuition:
      "A table lists pairs of numbers: an $x$ and the $y$ that goes with it. Some tables follow an equation such as $y=9x+3$, where $9x$ means 9 times $x$. Suppose the table has $x$ = 1, 2, 3 and $y$ = 12, 21, 30. When $x$ goes up by 1, $y$ goes up by 9. That 9 is the multiplier, the number that multiplies $x$. Next find the constant, the number added or subtracted at the end. For $x=1$, the multiplier gives $9\\times1=9$, but $y$ is 12. So add 3, because $12-9=3$. The equation is $y=9x+3$. Always test it with another pair: for $x=3$, $9\\times3+3=30$, which matches.",
    terms: ["multiplier", "constant-term"],
    method: [
      "Find how much $y$ changes for each step of 1 in $x$. If $x$ goes up by 2 at a time, divide the change in $y$ by 2.",
      "Multiply the first $x$ by that number. Compare with the first $y$ to find the constant, and whether to add or subtract it.",
      "Test the equation on another pair in the table.",
    ],
    watch:
      "Do not take the first $y$ as the multiplier or the constant. Test the equation on a second pair.",
    principle:
      "If the pairs fit $y=ax+b$, then $\\frac{y_2-y_1}{x_2-x_1}=a$ for any two different pairs $(x_1,y_1)$ and $(x_2,y_2)$. The small numbers below the letters only label the two pairs. Also $b=y_1-ax_1$. The equation fits the table exactly when it works for every pair.",
    example: {
      prompt:
        "A table has $x$ = 2, 3, 4, 5 and $y$ = 11, 15, 19, 23. Find the equation.",
      steps: [
        "When $x$ goes up by 1, $y$ goes up by 4 (11, 15, 19, 23). So the multiplier is 4.",
        "For $x=2$, the multiplier gives $4\\times2=8$, but $y=11$. The difference is $11-8=3$, so add 3.",
        "The equation is $y=4x+3$. Test another pair, $x=5$: $4\\times5+3=23$, which matches the table.",
      ],
      answer: "$y=4x+3$.",
    },
    methodTitle: "Change first, then constant",
    methodText: [
      "If the multiplier times $x$ is bigger than $y$, the constant is subtracted, as in $y=8x-1$.",
      "When $x$ goes up by 2 at a time, the change in $y$ for one step of 1 is half the change shown.",
    ],
    formal:
      "A relationship with a constant rate of change $a$ (the same change in $y$ for each step of 1 in $x$) has the form $y=ax+b$. The number $b$ is the value of $y$ when $x=0$, and it may be negative.",
    pitfalls: [
      "The first $y$ alone does not give the multiplier. Use the change in $y$ for each step of 1 in $x$.",
      "Do not mix up adding and subtracting the constant. Work out the multiplier times $x$ first, then compare it with $y$.",
    ],
    parentGuide:
      "Ask your learner what happens to $y$ when $x$ goes up by one, and then to test the guess with the last pair.",
    senses: { change: "change", difference: "difference-subtract" },
  },
  {
    id: "rule-table-fill-slots",
    title: "Complete a table from its rule",
    summary:
      "A rule tells how to get each output from its input. Use the rule to find an output, and undo it to find an input.",
    objectives: [
      "Find $y$ for a given $x$ when the rule adds, subtracts or multiplies.",
      "Find $x$ for a given $y$ by undoing the rule with the inverse operation.",
    ],
    intuition:
      "A rule is a set of steps that turns one number into another, like “add 7.” The number you start with is called the input. The number you get is called the output. With “add 7,” input 5 gives output $5+7=12$. We write this rule as $y=x+7$: the letter $x$ stands for the input, and $y$ stands for the output. The rule $y=3x$ means $y$ is 3 times $x$. A table lists the inputs in one row and their outputs in the row below. To fill a missing output, put the input into the rule. To fill a missing input, work backward. If the output is 15 and the rule added 7, the input was $15-7=8$. The inverse operation is the step that undoes another. Adding and subtracting undo each other, and so do multiplying and dividing.",
    terms: ["input", "output", "inverse-operation"],
    method: [
      "For a missing $y$, put the given $x$ into the rule and work it out.",
      "For a missing $x$, undo the rule: subtract if the rule adds, add if it subtracts, divide if it multiplies.",
      "Put each number back into the rule to check it.",
    ],
    watch:
      "To find an input, use the inverse operation. Adding 7 again to an output gives a wrong input.",
    principle:
      "The rule $y=x+7$ gives one output for each input, and subtracting 7 brings you back: $x=y-7$. In general, $kx$ means $k$ times $x$. For $y=x+k$, $y=x-k$ and $y=kx$ (with $k$ not 0), the input comes back as $x=y-k$, $x=y+k$ and $x=y\\div k$.",
    example: {
      prompt: "Use $y=x+7$ to find $y$ when $x=5$ and $x$ when $y=15$.",
      steps: [
        "For $x=5$, put 5 into the rule: $y=5+7=12$.",
        "For $y=15$, undo adding 7 by subtracting 7: $x=15-7=8$.",
        "Check the input in the rule: $8+7=15$. It matches.",
      ],
      answer: "$y=12$ and $x=8$.",
    },
    methodTitle: "Forward and backward",
    methodText: [
      "Find the empty boxes in the table. For each one, decide whether you know its input or its output.",
      "Check each number you found by putting its input into the rule.",
    ],
    formal:
      "A rule that adds $k$, subtracts $k$, or multiplies by $k$ (with $k$ not 0) never sends two different inputs to the same output. So each output comes from exactly one input. You find it with the inverse operation.",
    pitfalls: [
      "Do not use the rule again on an output. That gives a new output, not the input.",
      "Keep the rows straight: the first row is $x$, the input, and the second row is $y$, the output.",
    ],
    parentGuide:
      "Ask your learner to say the rule out loud, such as “add 7.” Then ask how to go back: “take 7 away.”",
    senses: { rule: "rule", rules: "rule" },
  },
  {
    id: "unit-price-sentence-slots",
    title: "Find the price of one",
    summary:
      "To find the price of one item, divide the total cost by the number of items. Every item must cost the same.",
    objectives: [
      "Write total cost $\\div$ number of items $=$ price of one.",
      "Work out a unit price in whole dollars, or in dollars and cents.",
    ],
    intuition:
      "A unit price is the cost of one item. Suppose 4 pairs of gloves cost 68 dollars, and every pair costs the same. Share the 68 dollars equally among the 4 pairs. That gives the price of one pair: $68\\div4=17$ dollars. The total cost is the number being divided. The number of items is the divisor, the number you divide by. Check by multiplying: 4 pairs at 17 dollars each cost $4\\times17=68$ dollars.",
    terms: ["unit-price", "divisor"],
    method: [
      "Find the total cost and the number of items.",
      "Divide the total cost by the number of items.",
      "Write the answer in dollars for each item. Check that the number of items times the price gives the total.",
    ],
    watch: "Divide the cost by the count, not the count by the cost.",
    principle:
      "If $n$ items that all cost the same cost $T$ in all, the price of one is $u=\\frac{T}{n}$, because $n\\times u=T$. A unit price is a rate: an amount for each one unit.",
    example: {
      prompt:
        "6 pairs of socks cost 21 dollars in all. What does one pair cost?",
      steps: [
        "The total cost is 21 dollars and the number of pairs is 6.",
        "Share the total equally: $21\\div6=3.5$. Money is written with two decimal places, the two digits after the point. So one pair costs 3.50 dollars.",
        "Check: $6\\times3.50=21$, the total.",
      ],
      answer: "$21\\div 6=3.50$ dollars per pair.",
    },
    methodTitle: "Total divided by count",
    methodText: [
      "When the answer has cents, write two decimal places: 3.50 dollars.",
      "Check by multiplying the unit price by the count.",
    ],
    formal:
      "A unit rate is a ratio written for 1 of the second amount: $T$ dollars for $n$ items is $\\frac{T}{n}$ dollars for 1 item. Since $n\\times\\frac{T}{n}=T$, the unit price times the number of items gives back the total.",
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
      "A cylinder's volume is $\\pi$ times the radius, times the radius again, times the height. Halve a diameter first to get the radius.",
    objectives: [
      "Use the radius, not the diameter, in $V=\\pi r^2h$.",
      "Fill in the radius twice and the height once in the volume equation.",
    ],
    intuition:
      "A cylinder is a can shape: a circle at the bottom, stacked straight up to a height. Volume is the amount of space inside. It is measured in cubic units, the number of 1-by-1-by-1 cubes that fill it. The center is the point in the middle of the circle. The radius is the distance from the center to the circle itself, and we write it $r$. The diameter is the distance all the way across through the center, so it is twice the radius. Squared means multiplied by itself: $r^2$, read “$r$ squared”, is $r\\times r$. The circle's area is $\\pi r^2$, where $\\pi$ (pi) is a number close to 3.14. The volume is that area times the height: $V=\\pi\\times r\\times r\\times h$. If a problem gives the length across, halve it first to get the radius.",
    terms: ["radius", "diameter", "cylinder"],
    method: [
      "Find the radius. If the length across the circle is given, divide it by 2.",
      "Write $V=\\pi\\times r\\times r\\times h$, with the radius twice and the height once.",
      "Check that each number comes from the right measurement: radius, radius, height.",
    ],
    watch:
      "Check whether the length given is the diameter or the radius before you put it in the equation.",
    principle:
      "The volume of a cylinder with base radius $r$ and height $h$ is $V=\\pi r^2h$: the area $\\pi r^2$ of the circle at its base, times the height. The diameter is $d=2r$.",
    example: {
      prompt:
        "A round tank is 10 feet across and 6 feet high. Write the volume equation.",
      steps: [
        "10 feet across is the diameter, so the radius is half of it: $10\\div2=5$ feet.",
        "The base is a circle of radius 5, so its area is $\\pi\\times5\\times5$.",
        "Multiply the base area by the height, 6 feet: $V=\\pi\\times5\\times5\\times6$ cubic feet.",
      ],
      answer: "$V=\\pi\\times 5\\times 5\\times 6$.",
    },
    methodTitle: "Radius, radius, height",
    methodText: [
      "The radius appears twice because $r^2=r\\times r$.",
      "The units are cubic: feet times feet times feet.",
    ],
    formal:
      "Stacking the same circle up to height $h$ gives a volume of base area times height, just as for a box. Cavalieri's principle says that solids with equal slices at every height have equal volumes. The area of a circle of radius $r$ is $\\pi r^2$, so $V=\\pi r^2h$.",
    pitfalls: [
      "Do not use the diameter as the radius. That makes the volume four times too big.",
      "Do not use the height as one of the radii.",
    ],
    parentGuide:
      "Ask your learner to point to the center of the circle and to the circle itself to find the radius before writing any numbers.",
    senses: {
      square: "square-number",
      center: "center",
      solid: "solid-shape",
      base: "base-shape",
    },
    noLink: ["cubes"],
  },
  {
    id: "dilation-rule-slots",
    title: "Write the rule of a dilation",
    summary:
      "A dilation from the origin multiplies both coordinates by one scale factor. Divide a new coordinate by its old one (not 0) to find it.",
    objectives: [
      "Find the scale factor from a point and the point it moves to.",
      "Write the rule $(x,y)\\to(kx,ky)$, where $k$ is the scale factor.",
    ],
    intuition:
      "A point on a grid is named by two coordinates, $(x,y)$: $x$ steps across and $y$ steps up from the origin, the point $(0,0)$. A dilation makes a figure bigger or smaller from a center point, or leaves it the same size. The moved figure is called the image, and a prime mark names its points: $A'$ (read “$A$ prime”) is where $A$ lands. When the center is the origin, a dilation multiplies both coordinates by the same number $k$, called the scale factor. If the point $(2,3)$ lands on $(8,12)$, then $8\\div2=4$ and $12\\div3=4$, so $k=4$. The rule is written $(x,y)\\to(4x,4y)$. The arrow means “goes to”, and $4x$ means 4 times $x$. A scale factor greater than 1 makes the figure bigger. A scale factor between 0 and 1 makes it smaller.",
    terms: ["dilation", "scale-factor", "image-transformation"],
    method: [
      "Divide the image's $x$-coordinate by the original point's $x$-coordinate.",
      "Divide the $y$-coordinates the same way. Skip a coordinate that is 0 in the original point. The results must all be the same number, $k$.",
      "Write the rule $(x,y)\\to(kx,ky)$, with $k$ in both places.",
    ],
    watch:
      "Divide the image by the original, not the other way round. Dividing the original by the image gives $\\frac{1}{k}$, one over the scale factor.",
    principle:
      "A dilation with center $O$ and scale factor $k>0$ keeps $O$ in place and moves every other point $P$ to the point $P'$ on the ray from $O$ through $P$, with $OP'=k\\cdot OP$. So $P'$ is $k$ times as far from $O$ as $P$ is. With $O$ at the origin, the rule is $(x,y)\\to(kx,ky)$.",
    example: {
      prompt:
        "A dilation centered at the origin takes $A(6,9)$ to $A'(2,3)$. Write its rule.",
      steps: [
        "Divide each image coordinate by the original one: $2\\div6=\\frac{1}{3}$ and $3\\div9=\\frac{1}{3}$. Both give the same number, as they must.",
        "So the scale factor is $k=\\frac{1}{3}$. It is less than 1, so the figure shrinks.",
        "Put $k$ in both places: $(x,y)\\to(\\frac{1}{3}x,\\frac{1}{3}y)$.",
      ],
      answer: "$(x,y)\\to(\\frac{1}{3}x,\\frac{1}{3}y)$.",
    },
    methodTitle: "Image over original",
    methodText: [
      "A scale factor greater than 1 makes a figure bigger, and one between 0 and 1 makes it smaller.",
      "Check the rule on the given point: $\\frac{1}{3}\\times6=2$ and $\\frac{1}{3}\\times9=3$.",
    ],
    formal:
      "In coordinates, the dilation centered at the origin with scale factor $k$ is $D_k(x,y)=(kx,ky)$. For $k>0$, it multiplies every distance by $k$ and keeps every angle the same, so the image has the same shape.",
    pitfalls: [
      "Do not add the same number to both coordinates. A translation, a slide, moves the figure without resizing it.",
      "Do not use different multipliers for $x$ and $y$.",
    ],
    parentGuide:
      "Plot the point and its image on a grid, draw the line from the origin through both, and compare the distances from the origin.",
    senses: { image: "image-transformation", rule: "rule" },
    noLink: ["factor", "prime", "part", "leaves"],
  },
  {
    id: "transformation-rule-slots",
    title: "Match transformations to rules",
    summary:
      "Test one point to match a flip or a turn about the origin with its rule, which says where each point goes.",
    objectives: [
      "Recall the rules for reflections (flips) over the two axes and over the line $y=x$.",
      "Match rotations (turns) of 90 and 180 degrees about the origin to their rules.",
    ],
    intuition:
      "A point on a grid is named $(x,y)$: $x$ across and $y$ up from the origin, $(0,0)$. The $x$-axis is the horizontal number line, and the $y$-axis is the vertical one. A transformation sends each point to a place, which may be new or the same. That place is called the image of the point. A rule tells where each point goes, as in $(x,y)\\to(x,-y)$. The arrow means “goes to”. A reflection flips a figure over a line, like a mirror. Reflecting over the $x$-axis changes the sign of $y$: $(x,-y)$. Reflecting over the $y$-axis changes the sign of $x$: $(-x,y)$. Reflecting over the line $y=x$, the slanted line through the origin, swaps the coordinates: $(y,x)$. A degree is a small unit for measuring turns, and a full turn is 360 degrees. A rotation turns a figure around a point. A half turn, 180 degrees, about the origin changes both signs: $(-x,-y)$. A quarter turn, 90 degrees, counterclockwise (against the way a clock's hands move) sends $(x,y)$ to $(-y,x)$. A test point such as $(2,3)$ shows which rule is which.",
    terms: ["reflection", "rotation", "image-transformation"],
    method: [
      "Choose a test point with two different positive coordinates, such as $(2,3)$.",
      "Picture each transformation on a grid, and find where it sends the test point.",
      "Match each image to the rule that gives it. For example, $(2,-3)$ matches $(x,-y)$.",
    ],
    watch:
      "A quarter turn counterclockwise is $(-y,x)$, and a quarter turn clockwise is $(y,-x)$. Check with the test point.",
    principle:
      "Reflection over the $x$-axis: $(x,y)\\to(x,-y)$. Over the $y$-axis: $(-x,y)$. Over $y=x$: $(y,x)$. Rotation about the origin by 180 degrees: $(-x,-y)$. By 90 degrees counterclockwise: $(-y,x)$. By 90 degrees clockwise: $(y,-x)$.",
    example: {
      prompt:
        "Match a reflection across the $y$-axis and a rotation of 180 degrees about the origin to the rules $(-x,-y)$ and $(-x,y)$.",
      steps: [
        "Test with $(2,3)$. Reflecting over the $y$-axis flips it to the other side, to $(-2,3)$. Only the sign of $x$ changed, so the rule is $(-x,y)$.",
        "A half turn of 180 degrees about the origin sends $(2,3)$ to $(-2,-3)$. Both signs changed, so the rule is $(-x,-y)$.",
        "So each transformation has its own rule.",
      ],
      answer: "Reflection: $(-x,y)$. Rotation: $(-x,-y)$.",
    },
    methodTitle: "One test point",
    methodText: [
      "Use $(2,3)$, or another point with two different positive coordinates, for every row. A point like $(0,0)$ stays put under every rule, so it cannot tell them apart.",
      "Two rules can look alike. In $(-x,y)$ the $x$ changes sign, and in $(x,-y)$ the $y$ changes sign.",
    ],
    formal:
      "Reflections and rotations about the origin are linear maps. Each can be written as a 2-by-2 matrix whose determinant is 1 or $-1$. A reflection reverses orientation: it turns a clockwise order of points into a counterclockwise one. A rotation keeps orientation. All of them keep distances the same.",
    pitfalls: [
      "Do not match a reflection to a rotation rule just because both change signs.",
      "Do not forget the swap: reflecting over $y=x$ swaps the two coordinates.",
    ],
    parentGuide:
      "Cut a small paper triangle and move it on a coordinate grid. Follow one corner with a pencil.",
    senses: {
      image: "image-transformation",
      degree: "degree-angle",
      rule: "rule",
      unit: "unit",
    },
    noLink: ["changes", "quarter", "side"],
  },
  {
    id: "exponent-quotient-slots",
    title: "Divide powers with the same base",
    summary:
      "To divide powers of the same letter, divide the numbers in front, then subtract the exponents: top exponent minus bottom exponent.",
    objectives: [
      "Divide the coefficients (the numbers in front) and subtract the exponents when the letter is the same.",
      "Read a negative exponent that comes from a greater exponent on the bottom.",
    ],
    intuition:
      "An exponent is a small raised number that counts how many times a number is multiplied by itself. So $x^7$ means seven $x$'s multiplied together. The number in front, such as the 12 in $12x^3$, is called the coefficient. It multiplies the power. In a fraction, the top is the numerator and the bottom is the denominator. In $\\frac{x^2}{x^7}$, two $x$'s on top cancel two $x$'s on the bottom, because $\\frac{x}{x}=1$ when $x$ is not 0. That leaves five $x$'s on the bottom: $\\frac{1}{x^5}$. This is also written $x^{-5}$: a negative exponent means one over the power. The shortcut is top exponent minus bottom exponent: $2-7=-5$. The coefficients are divided like ordinary numbers.",
    terms: ["coefficient", "exponent", "negative-exponent"],
    method: [
      "Divide the coefficient on top by the coefficient on the bottom.",
      "Subtract the exponents: top minus bottom.",
      "Write the new coefficient and the letter with the new exponent. Keep the minus sign if the exponent is negative.",
    ],
    watch:
      "Subtract in the right order: top minus bottom. When the exponents differ, reversing the order gives the wrong sign.",
    principle:
      "For $a\\ne0$ ($a$ not 0) and integers $m$ and $n$, $\\frac{a^{m}}{a^{n}}=a^{m-n}$. If $m<n$, the exponent is negative, and $a^{m-n}=\\frac{1}{a^{n-m}}$.",
    example: {
      prompt: "Simplify $\\dfrac{12x^{3}}{4x^{7}}$.",
      steps: [
        "Divide the coefficients: $12\\div4=3$.",
        "Subtract the exponents, top minus bottom: $3-7=-4$. Three $x$'s on top cancel three of the seven on the bottom, leaving four on the bottom.",
        "The result is $3x^{-4}$, which means $\\frac{3}{x^4}$.",
      ],
      answer: "$3x^{-4}$.",
    },
    methodTitle: "Coefficient, then exponent",
    methodText: [
      "Check by cancelling: $\\frac{x^3}{x^7}$ leaves four $x$'s on the bottom.",
      "If the top exponent is greater, the exponent of the result is positive.",
    ],
    formal:
      "For whole-number exponents with $m\\ge n$ and $a$ not 0, $\\frac{a^m}{a^n}=a^{m-n}$, because $n$ of the $a$'s on top cancel all $n$ on the bottom. Defining $a^{-k}=\\frac{1}{a^{k}}$ makes the same subtraction work for every pair of integers $m$ and $n$, as long as $a$ is not 0. For example, $\\frac{2^{-2}}{2^{-3}}=\\frac{1/4}{1/8}=2=2^{-2-(-3)}$.",
    pitfalls: [
      "Do not divide the exponents or add them.",
      "Do not forget to divide the coefficients. Subtract exponents only when both powers repeat the same letter or number, as in $\\frac{2^5}{2^3}=2^2$.",
    ],
    parentGuide:
      "Write out the $x$'s on top and on the bottom and cross out pairs to see what is left.",
    senses: { rule: "rule" },
    noLink: ["factor", "factors", "leaves"],
  },
  {
    id: "square-root-solutions-slots",
    title: "Solve a squared binomial",
    summary:
      "Squared means multiplied by itself. If something squared is a positive number, it is that number's positive or negative square root.",
    objectives: [
      "Take the positive and the negative square root of both sides of an equation such as $(x+2)^2=36$.",
      "Solve the two resulting equations and name the lesser and the greater solution.",
    ],
    intuition:
      "Squared means multiplied by itself: $5^2=5\\times5=25$. A square root undoes squaring: the square root of 25, written $\\sqrt{25}$, is 5. A negative number is a number below 0, like $-5$. And $(-5)^2=(-5)\\times(-5)=25$ too. So if a number squared is 25, the number is 5 or $-5$. “Plus or minus” is how we read the sign $\\pm$, which stands for both. Now look at $(x-3)^2=25$. A binomial is an expression with two terms, the parts joined by plus or minus, like $x-3$. Here the binomial squared is 25, so $x-3=5$ or $x-3=-5$. An equation's two sides are the parts left and right of the equals sign. Add 3 to both sides of each: $x=8$ or $x=-2$. There are two solutions, values of $x$ that make the equation true. Check each one in the original equation.",
    terms: ["binomial", "square-root"],
    method: [
      "Take the square root of both sides. Write $\\pm$ in front of the root on the right, because a positive and a negative number both square to it.",
      "Split into two equations, one with the positive root and one with the negative root. Solve each one.",
      "Check each solution in the original equation. Write them from least to greatest.",
    ],
    watch: "Keep both roots. Using only the positive root loses one solution.",
    principle:
      "For $k>0$, $u^2=k^2$ exactly when $u=k$ or $u=-k$. Putting $u=x-h$, the solutions of $(x-h)^2=k^2$ are $x=h+k$ and $x=h-k$.",
    example: {
      prompt: "Solve $(x+2)^2=36$.",
      steps: [
        "36 is $6\\times6$, and also $(-6)\\times(-6)$. So the binomial $x+2$ is 6 or $-6$: $x+2=6$ or $x+2=-6$.",
        "Subtract 2 from both sides of each equation: $x=4$ or $x=-8$.",
        "Check: $(4+2)^2=6^2=36$ and $(-8+2)^2=(-6)^2=36$. Both work.",
      ],
      answer: "$x=-8$ or $x=4$.",
    },
    methodTitle: "Two equations from one",
    methodText: [
      "The two solutions are the same distance from the number that makes the binomial zero. Here $x+2=0$ when $x=-2$, and 4 and $-8$ are each 6 away from $-2$.",
      "Do not multiply out the square for this method. Taking the square root is simpler.",
    ],
    formal:
      "$u^2=k^2$ is the same as $(u-k)(u+k)=0$. When two numbers multiply to zero, one or both of them must be zero; this is the zero-product property. So $u=k$ or $u=-k$. Putting back $u=x-h$ gives the two solutions.",
    pitfalls: [
      "Watch the sign of the number in the binomial. For $(x+2)^2$, subtract 2 from each square root.",
      "Do not stop at the square roots. The answer is the value of $x$, found from both of them.",
    ],
    parentGuide:
      "Ask your learner to substitute each answer back in and see that both give the number on the right.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      square: "square-number",
      root: "root-radical",
    },
    noLink: ["parts"],
  },
  {
    id: "function-shift-sentence",
    title: "Describe a function shift",
    summary:
      "In $g(x)=f(x-h)+k$, the number inside the brackets moves the graph sideways, against its sign. The number outside moves it up or down.",
    objectives: [
      "Read the sideways shift from the number inside the parentheses.",
      "Read the up-or-down shift from the number added or subtracted outside.",
    ],
    intuition:
      "A function is a rule. An input is a number you put into the function, and an output is the number you get back. A function gives exactly one output for each input. We write $f(x)$, read “$f$ of $x$”, for the output of the function $f$ at input $x$. Its graph is every point $(x,f(x))$: the input across and the output up. A new function $g$ can be built from $f$. In $g(x)=f(x-6)+2$, $g$ first subtracts 6 from the input, then uses $f$, then adds 2. At $x=6$, $g$ gives $f(0)+2$: what $f$ gave at 0, plus 2. So every point of the graph of $f$ moves right 6 and up 2. Inside the parentheses, a minus moves the graph right, against what you might expect. A plus inside, as in $f(x+6)$, moves it left. Outside, a plus moves the graph up and a minus moves it down. A slide like this is called a translation.",
    terms: ["translation", "function-notation"],
    method: [
      "Look inside the parentheses. $x-h$ shifts the graph right by $h$, and $x+h$ shifts it left by $h$.",
      "Look outside. $+k$ shifts it up by $k$, and $-k$ shifts it down by $k$.",
      "Name both shifts with their distances.",
    ],
    watch:
      "Inside the parentheses, the direction is against the sign: $x-6$ moves the graph right.",
    principle:
      "The graph of $g(x)=f(x-h)+k$ is the graph of $f$ slid $h$ units right (left if $h<0$) and $k$ units up (down if $k<0$). A point $(a,b)$ on $f$ moves to $(a+h,b+k)$ on $g$.",
    example: {
      prompt: "Describe the graph of $g(x)=f(x+3)-5$ compared with $f$.",
      steps: [
        "Inside, $x+3$ has a plus, so the graph shifts left by 3. At $x=-3$, $g$ uses $f(0)$.",
        "Outside, 5 is subtracted, so every output drops by 5: the graph shifts down by 5.",
        "Together, the graph of $g$ is the graph of $f$ shifted left 3 and down 5.",
      ],
      answer: "Left 3 units and down 5 units.",
    },
    methodTitle: "Inside against the sign, outside with it",
    methodText: [
      "Check with a point. If $(0,4)$ is on $f$, then $g(-3)=f(0)-5=4-5=-1$, so $(-3,-1)$ is on $g$.",
      "The two shifts do not affect each other: one is sideways, and one is up or down.",
    ],
    formal:
      "If $b=f(a)$, then $g(a+h)=f(a)+k=b+k$. So the point $(a+h,b+k)$ is on the graph of $g$. Every point of $g$ comes from a point of $f$ this way. So $g$ is $f$ slid $h$ units across and $k$ units up.",
    pitfalls: [
      "Do not move the graph left for $x-6$.",
      "Do not use one distance for both shifts.",
    ],
    parentGuide:
      "Plot $y=x^2$ and $y=(x-2)^2$ on one grid and compare the lowest points.",
    senses: { rule: "rule", unit: "unit" },
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
