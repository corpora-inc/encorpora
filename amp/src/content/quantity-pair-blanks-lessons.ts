import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const entries: FormatLessonEntry[] = [
  {
    id: "quotient-remainder-blanks",
    title: "Full groups and what is left over",
    summary:
      "Divide to find how many full groups fit; the remainder is what is left and is always less than the group size.",
    objectives: [
      "Find the number of full groups and the remainder when a total is divided by a two-digit group size.",
      "Check that the remainder is less than the group size.",
    ],
    intuition:
      "When you pack items into groups of the same size, you fill as many full groups as you can and some items may be left over. Dividing the total by the group size gives the number of full groups, the quotient. Multiplying the quotient by the group size and subtracting from the total gives the leftover, the remainder. The remainder is always less than the group size; if it is not, another full group fits.",
    terms: ["quotient", "remainder"],
    method: [
      "Estimate how many groups fit, using tens: how many tens of groups are in the total?",
      "Multiply the group size by your quotient and subtract from the total to get the leftover.",
      "If the leftover is as large as a group, increase the quotient by one and subtract again. The leftover must be less than the group size.",
    ],
    watch:
      "Check that the leftover is less than the group size. A leftover as big as a group means one more group fits.",
    principle:
      "For positive integers $n$ and $d$ there are unique whole numbers $q$ and $r$ with $n=dq+r$ and $0\\le r<d$. Here $q$ is the number of full groups and $r$ the number left over.",
    example: {
      prompt:
        "A baker packs 500 muffins into trays of 24. How many full trays are there and how many muffins are left over?",
      steps: [
        "Estimate: $24\\times 20=480$, which is less than 500, and $24\\times 21=504$, which is more.",
        "So 20 trays are full, and $500-480=20$ muffins are left over.",
        "The leftover 20 is less than 24, so no other tray can be filled.",
      ],
      answer: "20 full trays and 20 left over.",
    },
    methodTitle: "Divide, multiply back, subtract",
    methodText: [
      "Check with $d\\times q+r$: it must equal the total.",
      "A common slip is to choose the next quotient, 21 here; that needs more muffins than there are.",
    ],
    formal:
      "The division algorithm states that for integers $n\\ge0$ and $d>0$ there exist unique integers $q\\ge 0$ and $0\\le r<d$ with $n=dq+r$; $q=\\lfloor n/d\\rfloor$.",
    pitfalls: [
      "Do not round the quotient up; only full groups count.",
      "Do not give the leftover as the amount missing to fill another group.",
    ],
    parentGuide:
      "Use buttons or coins: make groups of the given size until you cannot make another one, then count what is left.",
  },
  {
    id: "meters-to-kilometers-blanks",
    title: "Add meters and write kilometers and meters",
    summary:
      "Add distances in meters, then split the total into whole kilometers and the meters that remain.",
    objectives: [
      "Add three distances given in meters.",
      "Write a total as kilometers and meters using 1 kilometer = 1,000 meters.",
    ],
    intuition:
      "A kilometer is 1,000 meters, so a total of 2,396 meters is 2 groups of 1,000 meters and 396 meters more: 2 kilometers and 396 meters. First add all the distances in meters. Then see how many thousands the sum holds; that is the number of kilometers, and the three digits that remain are the meters.",
    terms: [
      "kilometer",
      ["regroup", "Here 2,396 meters regroups as 2 kilometers 396 meters."],
    ],
    method: [
      "Add the distances in meters.",
      "Find how many 1,000s are in the sum: that is the number of kilometers.",
      "The meters left are the sum minus the kilometers times 1,000. Write both parts with their units.",
    ],
    watch:
      "Take away 1,000 for each kilometer. Reading the digits of the total as 23 kilometers and 96 meters is wrong.",
    principle:
      "Since $1\\text{ km}=1{,}000\\text{ m}$, a length of $m$ meters is $\\lfloor m/1000\\rfloor$ km and $m-1000\\lfloor m/1000\\rfloor$ m.",
    example: {
      prompt:
        "A path has three parts of 850 meters, 920 meters and 640 meters. Write its length in kilometers and meters.",
      steps: [
        "Add: $850+920+640=2{,}410$ meters.",
        "$2{,}410=2\\times1{,}000+410$.",
        "The path is 2 kilometers and 410 meters long.",
      ],
      answer: "2 kilometers and 410 meters.",
    },
    methodTitle: "Add, then regroup",
    methodText: [
      "Check by converting back: 2 kilometers is 2,000 meters, and $2{,}000+410=2{,}410$.",
      "If the meters part would be 1,000 or more, another kilometer can be made.",
    ],
    formal:
      "Writing $m=1000q+r$ with $0\\le r<1000$ expresses the length as $q$ km $+\\,r$ m; the representation is unique, like the remainder of a division by 1,000.",
    pitfalls: [
      "Do not read the first digits of the total as kilometers.",
      "Do not forget the meters that remain after the kilometers are taken out.",
    ],
    parentGuide:
      "Ask how many 1,000-meter kilometers fit in the total and how much road is left over.",
  },
  {
    id: "simple-interest-blanks",
    title: "Simple interest and the total",
    summary:
      "Interest is extra money paid on savings or a loan. Simple interest is the same amount each year: one year's amount times the years.",
    objectives: [
      "Find simple interest from a starting amount, a yearly percent rate and a number of years.",
      "Add the interest to the starting amount to find the total.",
    ],
    intuition:
      "Interest is extra money. A bank pays it to you when you save money there, and you pay it when you borrow money. The principal is the amount you start with: the money first saved or borrowed. A percent is a number out of 100, so 5% means 5 dollars for every 100 dollars. The rate is the percent of the principal paid each year. With simple interest, the interest is the same every year, because it is always a percent of the principal. For example, take 5% of 800 dollars. There are 8 hundreds in 800, and each hundred earns 5 dollars, so that is $8 \\times 5 = 40$ dollars each year. Multiplying by the fraction $\\frac{5}{100}$ (5 out of 100) does the same thing: $800 \\times \\frac{5}{100} = 40$. In 3 years that is $3 \\times 40 = 120$ dollars of interest. The total amount is the principal and the interest together: $800 + 120 = 920$ dollars.",
    terms: [
      "principal",
      "simple-interest",
      [
        "interest",
        "Here, the rate is the percent of the principal earned or charged each year.",
      ],
    ],
    method: [
      "Write the rate as a fraction with 100 on the bottom: 4% is $\\frac{4}{100}$, 4 out of 100. Multiply the principal by it to get one year of interest.",
      "Multiply one year of interest by the number of years. That gives all the interest.",
      "Add the interest to the principal to get the total amount.",
    ],
    watch:
      "Multiply by every year, then add the principal. One year of interest, or the interest alone, is not the total.",
    principle:
      "Write $P$ for the principal (the starting amount), $r$ for the yearly rate as a decimal (4% is 0.04) and $t$ for the time in years. The simple interest $I$ is $I = P \\times r \\times t$. The total amount $A$ is the principal plus the interest: $A = P + I$.",
    example: {
      prompt:
        "A deposit of 500 dollars earns 4% simple interest each year for 3 years. Find the interest and the total.",
      steps: [
        "Find one year of interest. 4% means 4 out of every 100, so multiply the principal by $\\frac{4}{100}$: $500 \\times \\frac{4}{100} = 20$ dollars.",
        "Simple interest is the same every year, so multiply by the 3 years: $20 \\times 3 = 60$ dollars of interest.",
        "The total is the principal plus the interest: $500 + 60 = 560$ dollars.",
      ],
      answer: "60 dollars of interest and 560 dollars in all.",
    },
    methodTitle: "One year, then all the years",
    methodText: [
      "Check by multiplying the principal, the rate and the years in one line. A hundredth is one of 100 equal parts of 1, and a decimal is a number written with a point, such as 0.04. Since $\\frac{4}{100}$ is 4 hundredths, 4% is the decimal 0.04: $500 \\times 0.04 \\times 3 = 60$.",
      "The interest grows by the same 20 dollars each year. That is because simple interest is always figured on the principal, never on interest already earned.",
    ],
    formal:
      "Write $P$ for the principal, $r$ for the yearly rate as a decimal and $t$ for the number of years. The simple interest $I$ is $I = Prt$, which means $P \\times r \\times t$. The total amount $A$ is the principal plus the interest: $A = P + Prt$. Each extra year adds the same amount, $P \\times r$, to the total.",
    pitfalls: [
      "Multiply one year's interest by the number of years. Do not stop at one year.",
      "Add the principal at the end to get the total amount.",
    ],
    parentGuide:
      "Make a small table with rows for year 1, year 2 and year 3. Write the interest earned in each year, then add the rows and the principal.",
  },
  {
    id: "loan-offer-compare-blanks",
    title: "Compare two loan offers",
    summary:
      "A loan is an amount of money you borrow. Its interest is the extra money paid back. Find each offer's interest: the smaller one costs less.",
    objectives: [
      "Find the interest of two loan offers with different rates and different numbers of years.",
      "Subtract the smaller interest from the larger to find how much less one offer costs.",
    ],
    intuition:
      "A loan is an amount of money you borrow and pay back later. The principal is the amount borrowed. Interest is the extra money you pay for borrowing it, so the interest is what the loan costs. A percent is a number out of 100, so 5% means 5 dollars for every 100 dollars. The rate is the percent of the principal charged each year. With simple interest, each year's interest is the same percent of the principal, the amount first borrowed. So the same amount is charged every year. For example, 5% of 1,000 dollars is 5 dollars for each of the 10 hundreds: $10 \\times 5 = 50$ dollars a year. Over 3 years that is $3 \\times 50 = 150$ dollars. So the interest is the principal, times the rate written as a fraction over 100, times the number of years. For 5%, that fraction is $\\frac{5}{100}$, which means 5 parts out of 100. Two banks can lend the same principal at different rates and for different numbers of years. A lower rate does not always cost less, because more years add more interest. So find each bank's interest first. The bank with less interest costs less. The difference, the larger interest minus the smaller, says how much less.",
    terms: [
      "loan",
      [
        "interest",
        "The cost of a loan is all the interest paid beyond the amount borrowed.",
      ],
    ],
    method: [
      "Find the interest for the first offer. Write the rate as a fraction over 100: 5% is $\\frac{5}{100}$, which means 5 parts out of 100. Multiply the principal by it, then by the number of years.",
      "Find the interest for the second offer the same way, with its own rate and its own years.",
      "The offer with less interest costs less. Subtract the smaller interest from the larger to find by how much.",
    ],
    watch:
      "Compare the interest of both offers, each over its own years. Do not compare the rates alone.",
    principle:
      "A hundredth is one of 100 equal parts of 1, and a decimal is a number written with a point, such as 0.05. Write $P$ for the principal, $r$ for the yearly rate as a decimal (5% is 0.05, or 5 hundredths) and $t$ for the years. An offer's interest $I$ is $I = P \\times r \\times t$. With the same principal, the offer with the smaller rate times years, $r \\times t$, costs less. The difference in cost is the larger interest minus the smaller.",
    example: {
      prompt:
        "A family borrows 1,000 dollars. Harbor Bank charges 6% simple interest for 2 years, and Summit Bank charges 4% for 4 years. Which costs less, and by how much?",
      steps: [
        "Harbor Bank charges 6% a year: 6 dollars for every 100 borrowed. One year costs $1{,}000 \\times \\frac{6}{100} = 60$ dollars, so 2 years cost $60 \\times 2 = 120$ dollars of interest.",
        "Summit Bank charges 4% a year. One year costs $1{,}000 \\times \\frac{4}{100} = 40$ dollars, so 4 years cost $40 \\times 4 = 160$ dollars of interest.",
        "Harbor Bank charges less interest, so it costs less. Subtract to find by how much: $160 - 120 = 40$ dollars.",
      ],
      answer: "Harbor Bank, by 40 dollars.",
    },
    methodTitle: "Each offer alone, then compare",
    methodText: [
      "Summit Bank has the lower rate but costs more. Its loan lasts twice as long, so it charges interest for more years.",
      "To say how much less, subtract the smaller interest from the larger. If the two interests are equal, neither offer costs less.",
    ],
    formal:
      "A hundredth is one of 100 equal parts of 1, and a decimal is a number written with a point, such as 0.06. Write $P$ for the principal, $r$ for the yearly rate as a decimal (6% is 0.06, or 6 hundredths) and $t$ for the years. The interest $I$ of an offer is $P \\times r \\times t$, also written $Prt$. A bigger rate or more years makes the interest bigger. The principal is the same for both offers, so the offer with the smaller $r \\times t$, the rate times the years, has the smaller interest. The difference in cost is $P$ times the difference between the two values of $r \\times t$.",
    pitfalls: [
      "Check the years as well as the rates. The bank with the lower rate is not always cheaper.",
      "Subtract the two interests to find how much less. Do not add them.",
    ],
    parentGuide:
      "Write the cost of each offer on its own line, with the bank's name, before comparing them.",
  },
  {
    id: "scale-factor-effects-blanks",
    title: "How a dilation changes perimeter and area",
    summary:
      "Multiply every length of a shape by 3. The distance around it grows 3 times, but the space inside grows 3 times 3, which is 9 times.",
    objectives: [
      "Explain why the perimeter of a dilated figure is multiplied by the scale factor.",
      "Explain why the area is multiplied by the scale factor times itself.",
    ],
    intuition:
      "A dilation is a change that multiplies every length of a shape by the same number. That number is called the scale factor, and in this lesson it is greater than 0. The result has the same shape, but it can be bigger, smaller or the same size. The new shape is called the image, and the starting shape is called the original. The perimeter is the distance around a shape, so it is found by adding lengths. A right angle is a corner like the corner of a page. A rectangle is a four-sided shape whose corners are all right angles. It has two lengths and two widths, so its perimeter is two lengths plus two widths. If every length is doubled, the total of the lengths is doubled too. The area is the space inside a shape, and for a rectangle it is the length times the width. Both the length and the width are doubled, so the area is multiplied by 2 twice: $2 \\times 2 = 4$. A unit is a fixed length used for measuring, such as 1 centimeter. For example, doubling a rectangle 2 units long and 3 units wide makes one 4 units by 6 units. The perimeter goes from 10 to 20, which is 2 times as much. The area goes from 6 to 24, which is 4 times as much. In general, a scale factor $k$ multiplies the perimeter by $k$ and the area by $k \\times k$. Multiplying a number by itself is called squaring it. So $k \\times k$ is $k$ squared, written $k^2$.",
    terms: ["scale-factor", "dilation"],
    method: [
      "Multiply each side length by the scale factor to get the sides of the image.",
      "The perimeter of the image is the scale factor times the perimeter of the original.",
      "The area of the image is the scale factor squared (the scale factor times itself) times the area of the original.",
    ],
    watch:
      "Use the scale factor squared for the area, not the scale factor. A rectangle's area is its length times its width, and both of them changed.",
    principle:
      "A dilation by a scale factor $k$, where $k$ is greater than 0, multiplies every length by $k$. So it multiplies the perimeter by $k$ and the area by $k^2$, which is $k \\times k$. For example, a scale factor of $\\frac{1}{2}$ halves the perimeter and multiplies the area by $\\frac{1}{4}$.",
    example: {
      prompt:
        "A rectangle 2 units by 5 units is dilated by a scale factor of 3. How do the perimeter and the area change?",
      steps: [
        "Multiply each side by the scale factor 3. The image is $2 \\times 3 = 6$ units by $5 \\times 3 = 15$ units.",
        "The perimeter is two lengths plus two widths, which is 2 times the total of one length and one width. Parentheses are curved marks around a part to work out first. Here they show that the adding is done first. It goes from $2 \\times (2 + 5) = 14$ to $2 \\times (6 + 15) = 42$. Dividing the new perimeter by the old one tells how many times as much it is: $42 \\div 14 = 3$.",
        "The area is the length times the width. It goes from $2 \\times 5 = 10$ to $6 \\times 15 = 90$. Dividing the same way, $90 \\div 10 = 9$, so it is $3^2 = 9$ times as much.",
      ],
      answer: "Perimeter: 3 times. Area: 9 times.",
    },
    methodTitle: "Lengths once, area twice",
    methodText: [
      "A scale factor between 0 and 1 makes the image smaller. With a scale factor of $\\frac{1}{2}$, the perimeter is halved and the area is multiplied by $\\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$.",
      "If you are unsure, check the rule with actual numbers, as in the example.",
    ],
    formal:
      "A dilation by a scale factor $k$ greater than 0 multiplies every length by $k$. A perimeter is found by adding lengths, so it is multiplied by $k$. A rectangle's length and width are both multiplied by $k$, so its area, length times width, is multiplied by $k \\times k = k^2$. Any shape can be covered, as closely as you like, by tiny rectangles. The dilation multiplies the area of each tiny rectangle by $k^2$, so it multiplies their total by $k^2$ too. The smaller the rectangles, the closer their total is to the area of the shape. So the area of every shape is multiplied by $k^2$, not only the area of a rectangle.",
    pitfalls: [
      "Do not multiply the area by the scale factor alone. The new area is $k^2$ times the old one.",
      "Do not square the scale factor for the perimeter. The perimeter is multiplied by $k$ only.",
    ],
    parentGuide:
      "On grid paper, draw a rectangle 2 boxes by 3 boxes and another 4 boxes by 6 boxes. Count the boxes inside each, and compare the counts with the distance around each.",
  },
  {
    id: "expected-count-blanks",
    title: "Probability and expected count",
    summary:
      "An outcome is a result, like landing on 20. Multiply its probability, how likely it is, by the number of spins to predict a count.",
    objectives: [
      "Find the probability of an outcome on a spinner with equal sections.",
      "Predict how many times the outcome happens in a number of spins.",
    ],
    intuition:
      "A spinner is a circle split into sections, with an arrow that spins and stops on one section. An outcome is one result, such as landing on 20. When all the sections are the same size, each one is equally likely. The probability of an outcome is the fraction of the sections that show it: the number of sections showing it over the total number of sections. On a spinner with 10 equal sections, if 2 sections show 20, the probability of landing on 20 is $\\frac{2}{10}$, 2 out of 10. A whole number is one of 0, 1, 2, 3 and so on. Lowest terms means that no whole number bigger than 1 divides both the top and bottom of a fraction evenly. To get there, divide the top and bottom by the same number. That keeps the value. Think of the 10 sections as 5 pairs: the 2 sections showing 20 make 1 of the 5 pairs. So $\\frac{2}{10}$ and $\\frac{1}{5}$ name the same share of the spinner. So the probability is $\\frac{1}{5}$. In 150 spins, you expect about $\\frac{1}{5}$ of the spins to land on 20. One fifth of 150 means: split 150 into 5 groups of the same size and take one. That is $150 \\div 5 = 30$. Multiplying gives the same: $\\frac{1}{5} \\times 150 = 30$ times. This number is called the expected count. It is a prediction, so a real set of spins can land on 20 a few more or fewer times.",
    terms: ["probability", "expected-count"],
    method: [
      "Count the sections that show the number. Divide by the total number of sections to get the probability.",
      "Write the fraction in lowest terms. Divide the top and bottom by a whole number bigger than 1 that divides both, and repeat until none does.",
      "Multiply the probability by the number of spins to get the expected count.",
    ],
    watch:
      "Count only the sections that show the number asked for, out of all the sections.",
    principle:
      "Say a spinner has $n$ equal sections and $k$ of them show the number you want. The probability is $P = \\frac{k}{n}$. Each spin is called a trial. If it is spun $N$ times, the expected count is $N \\times P$. Capital $N$ counts spins and small $n$ counts sections. They can be different numbers.",
    example: {
      prompt:
        "A spinner has 10 equal sections, and 3 of them show 40. It is spun 80 times. What is the probability of 40, and how many times is it expected?",
      steps: [
        "3 of the 10 equal sections show 40, so the probability of landing on 40, written $P$, is $P = \\frac{3}{10}$. No whole number bigger than 1 divides both 3 and 10, so it is already in lowest terms.",
        "Expect 40 on about $\\frac{3}{10}$ of the 80 spins. A tenth is one of 10 equal parts. One tenth of 80 is $80 \\div 10 = 8$, so three tenths is $3 \\times 8 = 24$. Multiplying gives the same: $\\frac{3}{10} \\times 80 = 24$ times.",
      ],
      answer: "Probability $\\frac{3}{10}$; about 24 times.",
    },
    methodTitle: "Count, then scale",
    methodText: [
      "Check: a probability is never greater than 1, so the expected count is never greater than the number of spins.",
      "The expected count is only a prediction. A real run of 80 spins might land on 40 only 22 times, or 27 times.",
    ],
    formal:
      "A trial is one run of something left to chance, such as one spin. Suppose each of $N$ trials gives the wanted outcome with probability $p$. Then the expected number of wanted outcomes is $N \\times p$. Over many repeats of the $N$ spins, the counts go up and down. Their mean, the total of the counts divided by the number of repeats, gets close to $N \\times p$.",
    pitfalls: [
      "Count the sections that show the number asked for, not the other sections.",
      "Multiply the number of spins by the probability. Do not divide the spins by the probability.",
    ],
    parentGuide:
      "Make a paper spinner with 10 equal sections, using a pencil and a paper clip as the arrow. Spin it 20 times with the learner and compare the real count with the prediction.",
  },
  {
    id: "unit-rate-pair-blanks",
    title: "Two unit rates",
    summary:
      "A unit rate is the amount for exactly 1 of something, such as laps in 1 minute. Divide each amount by its own time.",
    objectives: [
      "Find a unit rate by dividing an amount by a time.",
      "Find two unit rates from two different amounts and times.",
    ],
    intuition:
      "A unit is the thing you count or measure, such as a lap, a page or a minute. A rate compares two amounts with different units, such as 36 pages in 8 minutes. A unit rate is the amount that goes with exactly 1 unit. The word per means for each one, so pages per minute means pages for each 1 minute. Constant means staying the same. A constant rate gives the same amount every minute. If the printer prints at a constant rate, split the 36 pages into 8 equal groups, one for each minute. That is division: $36 \\div 8 = 4.5$ pages per minute. When a question gives two situations, find a rate for each one. Use each situation's own amount and its own time, and never mix them.",
    terms: ["rate", "unit-rate"],
    method: [
      "Match each amount with its own time.",
      "Divide the amount by the time to get the amount per minute.",
      "Do the same for the other situation. Write each rate with its units, such as laps per minute.",
    ],
    watch:
      "Divide the amount by the time, not the time by the amount. Use each situation's own two numbers.",
    principle:
      "Say $a$ units of one amount, such as laps, go with $t$ units of another, such as minutes, at a constant rate. If $t$ is not 0, the unit rate is $\\frac{a}{t}$, which means $a \\div t$, per 1 unit of the second. Check by multiplying back: $t$ groups of $\\frac{a}{t}$ make $t \\times \\frac{a}{t} = a$.",
    example: {
      prompt:
        "A printer prints 36 pages in 8 minutes in black and white and 27 pages in 6 minutes in color. Each rate is constant. What are the rates?",
      steps: [
        "Black and white: split the 36 pages into 8 equal groups, one for each minute. $36 \\div 8 = 4.5$ pages per minute.",
        "Color: use its own numbers. Split the 27 pages into 6 equal groups, one for each minute. $27 \\div 6 = 4.5$ pages per minute.",
        "Multiplying back checks the division. 8 minutes at 4.5 pages each minute make $8 \\times 4.5 = 36$ pages. Likewise $6 \\times 4.5 = 27$.",
      ],
      answer: "4.5 pages per minute in both.",
    },
    methodTitle: "Divide each pair",
    methodText: [
      "A unit rate can be a decimal, a number with a decimal point: $36 \\div 8 = 4.5$.",
      "Check each rate by multiplying it by its own time. You should get the amount back.",
    ],
    formal:
      "Write $r$ for the unit rate in pages per minute, $t$ for the minutes and $a$ for the pages printed. At a constant rate each minute adds $r$ pages, so $a = r \\times t$. An equation has two sides: the parts to the left and right of its equals sign. Dividing both sides by $t$ undoes the multiplying by $t$, and both sides stay equal. That gives $r = a \\div t$. The time $t$ cannot be 0, because no number can be divided by 0. So the amount is proportional to the time: multiplying the time by any number multiplies the amount by that same number. The unit rate $r$ is called the constant of proportionality: the fixed number that multiplies the time to give the amount.",
    pitfalls: [
      "Do not add both amounts and divide by both times together. Find each rate on its own.",
      "Do not flip the division. Minutes per page is a different rate from pages per minute.",
    ],
    parentGuide:
      "Ask the learner to multiply each rate by its minutes. The result should give back the pages.",
  },
  {
    id: "ratio-pair-blanks",
    title: "A part and the whole from a ratio",
    summary:
      "A ratio is a comparison of two amounts. 4 to 3 means 4 equal parts of one kind for every 3 of another. Find one part first.",
    objectives: [
      "Find the amount that one part of a ratio stands for.",
      "Find the other amount and the total from the ratio.",
    ],
    intuition:
      "A ratio tells how much of one kind there is for an amount of another kind, in a fixed order. A ratio of yellow to blue gumballs of 4 to 3 means: for every 4 yellow gumballs there are 3 blue ones. Think of the gumballs as 7 equal parts, groups that each hold the same number of gumballs. Yellow fills 4 parts and blue fills 3. The numbers 4 and 3 are the ratio numbers: they count the parts for each color. Say there are 24 yellow gumballs. Yellow is 4 parts, so one part is $24 \\div 4 = 6$ gumballs. Blue is 3 parts, so there are $3 \\times 6 = 18$ blue gumballs. The whole jar is $4 + 3 = 7$ parts, so it holds $7 \\times 6 = 42$ gumballs. Check: $24 + 18 = 42$.",
    terms: [
      "ratio",
      [
        "part",
        "Here a part is one of the equal shares the ratio splits the whole into.",
      ],
    ],
    method: [
      "Divide the known amount by its own ratio number. That gives the size of one part.",
      "Multiply the other ratio number by the size of one part.",
      "Find the total: add the two amounts, or multiply the total number of parts by the size of one part.",
    ],
    watch:
      "Match each ratio number with its color. In yellow to blue of 4 to 3, the 4 goes with yellow, the first color named.",
    principle:
      "If two amounts are in the ratio $a : b$ (read “$a$ to $b$”) and the second amount is $B$, then one part is $B \\div b$. The first amount is $a \\times (B \\div b)$, and the total is $(a + b) \\times (B \\div b)$. Parentheses are the curved marks around $B \\div b$. They mean: work out that part first.",
    example: {
      prompt:
        "Red and green beads are in the ratio 5 to 2. There are 12 green beads. How many red beads and how many beads in all?",
      steps: [
        "Green is 2 parts, and there are 12 green beads. So one part is $12 \\div 2 = 6$ beads.",
        "Red is 5 parts, and each part is 6 beads: $5 \\times 6 = 30$ red beads.",
        "Add red and green to get all the beads: $30 + 12 = 42$. Check with parts: there are $5 + 2 = 7$ parts, and $7 \\times 6 = 42$.",
      ],
      answer: "30 red beads and 42 beads in all.",
    },
    methodTitle: "Size of one part",
    methodText: [
      "Check the ratio: 30 red to 12 green. Each is 6 times its ratio number, $30 = 5 \\times 6$ and $12 = 2 \\times 6$. So 30 to 12 is the same ratio as 5 to 2.",
      "When both amounts are greater than 0, the total is greater than either one, because it includes both.",
    ],
    formal:
      "Equivalent ratios are ratios that describe the same mix, such as 5 to 2 and 30 to 12. The ratio $a$ to $b$ is also written $a : b$, with a colon that is read “to”. Multiplying both numbers by the same number $f$ greater than 0 gives an equivalent ratio, $a \\times f$ to $b \\times f$. The second amount $B$ fills $b$ equal parts, with $b$ greater than 0, so one part holds $f = B \\div b$. The first amount is $a \\times f$, and the total is $a \\times f + b \\times f$.",
    pitfalls: [
      "Do not add a ratio number to the known amount: 24 + 3 is not the number of blue gumballs.",
      "Divide the known amount by its own ratio number, not by the other color's number.",
    ],
    parentGuide:
      "Draw one box for each part of the ratio. Put the known amount into its boxes, and work out what each box holds.",
  },
  {
    id: "mean-median-blanks",
    title: "Mean and median of six values",
    summary:
      "The mean is the total shared equally: add, divide by the count. The median is the middle value in order, or halfway between two middles.",
    objectives: [
      "Find the mean of six decimal values.",
      "Put the values in order and find the median of an even number of values.",
    ],
    intuition:
      "The mean is the value each one would have if the total were shared out equally. It is often called the average. To find it, add all the values to get their sum, the total from adding. Then divide the sum by how many values there are. The median is the middle of the values after they are put in order from least to greatest, or halfway between the two middle ones. An even number, such as 4 or 6, counts things that can be split into two same-size halves without cutting any. An odd number, such as 5 or 7, cannot be split that way. An odd number of values has one value in the middle, and that value is the median. An even number of values has two values in the middle. With six values they are the 3rd and the 4th. Then the median is halfway between them, which is the mean of those two. Adding two numbers and dividing by 2 lands exactly halfway between them. For example, in 2, 4, 6, 10 the middle two are 4 and 6. The median is $(4 + 6) \\div 2 = 5$, where the parentheses mean add first. 5 is 1 more than 4 and 1 less than 6. Always put the values in order first. The middle of the list as it was given is usually not the median.",
    terms: ["mean-average", "median"],
    method: [
      "Add the values and divide by the number of values, here 6, to find the mean.",
      "Write the values in order from least to greatest.",
      "Take the two middle values, the 3rd and 4th, and find their mean. That is the median.",
    ],
    watch:
      "Put the values in order before finding the median. The middle of the list as given may not be the median.",
    principle:
      "The mean of a list is the sum of its values divided by how many values there are. For the median, put the values in order from least to greatest. With an odd number of values (1, 3, 5 and so on), the median is the middle value. With an even number (2, 4, 6 and so on), the median is the mean of the two middle values.",
    example: {
      prompt:
        "Six times in seconds: 10.4, 9.8, 11.2, 10.0, 10.6, 9.8. Find the mean and the median.",
      steps: [
        "Add the six times: $10.4 + 9.8 + 11.2 + 10.0 + 10.6 + 9.8 = 61.8$. Divide by 6, the number of times: $61.8 \\div 6 = 10.3$. That is the mean.",
        "Put the times in order from least to greatest: 9.8, 9.8, 10.0, 10.4, 10.6, 11.2. The repeated 9.8 is written twice.",
        "Six values have two middle values, the 3rd and 4th: 10.0 and 10.4. The median is halfway between them: $(10.0 + 10.4) \\div 2 = 10.2$.",
      ],
      answer: "Mean 10.3 seconds; median 10.2 seconds.",
    },
    methodTitle: "Add and divide, then order and split",
    methodText: [
      "Check: the mean must lie between the least value and the greatest value.",
      "A repeated value counts every time it appears, both in the sum (the total from adding) and in the ordered list.",
    ],
    formal:
      "Say a list has $n$ values. The mean is the sum of the values divided by $n$. For the median, put the values in order from least to greatest. If $n$ is odd, the median is the one middle value. If $n$ is even, the median is the mean of the two middle values. For six values these are the 3rd and 4th, with two values before them and two after. The mean and the median often differ.",
    pitfalls: [
      "Divide the sum by 6 when there are six values, not by 5.",
      "Find the middle values in the ordered list, not in the list as given.",
    ],
    parentGuide:
      "Write each value on a card. Put the cards in order from least to greatest, and ask the learner to point to the middle two.",
  },
  {
    id: "median-mode-compare-blanks",
    title: "Compare two medians and two modes",
    summary:
      "Put each list of 7 in order. The median is the 4th, middle value. The mode is the most common value. Compare each pair.",
    objectives: [
      "Find the median and the mode of a list of seven values.",
      "Compare the medians and the modes of two lists.",
    ],
    intuition:
      "Two lists of numbers can be compared with two numbers that describe each list. The median is the middle value after the list is put in order from least to greatest, or halfway between the two middle values when there are two. A list of 7 values has one middle value, in the 4th place, with 3 values before it and 3 after it. A count that splits into two same-size halves, such as 6, is called even. A list with an even count has two middle values, and its median is halfway between them. The mode is the value that appears most often. In 2, 3, 3, 5, 6, 7, 9 the median is 5 and the mode is 3. To compare two teams, find the median and the mode of each team. Then compare median with median, and mode with mode. Two lists can have the same mode but different medians, or the other way round. Put each list in order first, because the middle of an unordered list may not be the median.",
    terms: ["median", "mode-statistics"],
    method: [
      "Write each list in order from least to greatest.",
      "The median is the middle value, the 4th of 7. The mode is the value that appears most often.",
      "Compare the two medians with each other, and the two modes with each other.",
    ],
    watch:
      "Compare median with median and mode with mode. Never compare a median with a mode.",
    principle:
      "For seven values in order from least to greatest, the median is the 4th value. The mode is the value that appears most often. A list can have two or more modes when values tie for most often.",
    example: {
      prompt:
        "Hawks scored 3, 5, 5, 7, 2, 5, 8 and Owls scored 4, 6, 6, 2, 6, 9, 3. Compare the medians and the modes.",
      steps: [
        "Put the Hawks' scores in order: 2, 3, 5, 5, 5, 7, 8. The 4th value is 5, so the median is 5. The score 5 appears three times, the most of any score, so the mode is 5.",
        "Put the Owls' scores in order: 2, 3, 4, 6, 6, 6, 9. The 4th value is 6, so the median is 6. The score 6 appears three times, the most of any score, so the mode is 6.",
        "Compare like with like. The Hawks' median, 5, is less than the Owls' median, 6. The modes are 5 and 6, so they do not match.",
      ],
      answer: "Less than; the modes do not match.",
    },
    methodTitle: "Two numbers for each team",
    methodText: [
      "Write the median and the mode of each team before you compare.",
      "Match means exactly the same value, such as 5 and 5.",
    ],
    formal:
      "The median and the mode each describe a typical value of a list. A list has exactly one median: half the values or more are at or below it, and half or more are at or above it. So two medians compare as numbers. In these problems each list has one mode, so the two modes compare as numbers too. In other lists, two or more values can tie for most often, and then the list has more than one mode.",
    pitfalls: [
      "Find the middle of the ordered list, not of the list as given.",
      "Modes match only when they are the same number.",
    ],
    parentGuide:
      "Ask the learner to cross out the smallest and the largest value, one pair at a time, until one value is left. That value is the median.",
  },
  {
    id: "rectangle-chain-blanks",
    title: "Length from area, then perimeter",
    summary:
      "Divide the area by the width to find the length, then add the length and the width and double it.",
    objectives: [
      "Find a missing side of a rectangle from its area and the other side.",
      "Find the perimeter from both sides.",
    ],
    intuition:
      "The area of a rectangle is its length times its width, so the length is the area divided by the width. Once both sides are known, the perimeter is the distance around: two lengths and two widths, which is $2\\times(\\text{length}+\\text{width})$. The first step must come first, because the perimeter needs the length.",
    terms: ["area", "perimeter"],
    method: [
      "Divide the area by the width to find the length.",
      "Add the length and the width.",
      "Multiply the sum by 2 to find the perimeter.",
    ],
    watch:
      "The perimeter is a length, not an area. Add the sides; do not multiply them.",
    principle:
      "For a rectangle of length $\\ell$ and width $w$, $A=\\ell w$ and $P=2(\\ell+w)$. If $A$ and $w$ are known, $\\ell=A/w$ and then $P=2(A/w+w)$.",
    example: {
      prompt:
        "A rectangle has an area of 72 square centimeters and a width of 6 centimeters. Find its length and perimeter.",
      steps: [
        "The length is $72\\div6=12$ centimeters.",
        "The sum of length and width is $12+6=18$ centimeters.",
        "The perimeter is $2\\times18=36$ centimeters.",
      ],
      answer: "Length 12 centimeters; perimeter 36 centimeters.",
    },
    methodTitle: "Area to length to perimeter",
    methodText: [
      "Check the length: $12\\times6=72$.",
      "The units of area are square units and of perimeter are plain units.",
    ],
    formal:
      "Area is multiplicative in the two side lengths and perimeter is additive. The step $\\ell=A/w$ uses that division undoes multiplication by $w\\ne0$.",
    pitfalls: [
      "Do not add the area and the width to find the length.",
      "Do not use the area as the perimeter.",
    ],
    parentGuide:
      "Draw the rectangle with its width and ask your learner what number multiplied by the width gives the area.",
  },
  {
    id: "wage-and-cost-blanks",
    title: "Wage and starting cost from a table",
    summary:
      "Net pay is pay earned minus a cost paid first. The wage is how much net pay rises each hour. Use both to find the cost.",
    objectives: [
      "Find an hourly wage from the change in a table.",
      "Find a starting cost from a table whose values begin below zero.",
    ],
    intuition:
      "A worker pays for something before starting, such as a uniform, and then earns money for each hour of work. The wage is the money earned for each hour. Net pay is the pay earned minus the cost of the uniform. Before any work, the net pay is below zero: it is a negative number, the cost with a minus sign. Each hour adds the same wage, so net pay goes up by the same amount every hour. So the change in net pay for 1 hour is the wage. For example, say net pay goes from −8 dollars after 2 hours to 16 dollars after 4 hours. Parentheses are curved marks that keep a number and its minus sign together, as in $(-8)$. Taking away a debt of 8 dollars makes you 8 dollars better off, so subtracting −8 is the same as adding 8. So net pay rose $16 - (-8) = 24$ dollars in 2 hours, so the wage is $24 \\div 2 = 12$ dollars per hour. To find the cost, compare the pay earned with the net pay. After 2 hours the worker earned $2 \\times 12 = 24$ dollars, but the net pay is −8. Net pay is pay earned minus the cost, so the pay earned is the cost plus the net pay. Taking the net pay away from the pay earned gives the cost: $24 - (-8) = 32$ dollars.",
    terms: [
      ["net-pay", "Here it is the pay earned minus what was spent."],
      "rate-of-change",
    ],
    method: [
      "Find the change in net pay between two columns. Divide it by the change in hours. That is the wage.",
      "Multiply the wage by the hours in one column to get the pay earned by then.",
      "Subtract that column's net pay from the pay earned. That is the cost.",
    ],
    watch:
      "The cost is the pay earned minus the net pay. It is not the first net pay in the table.",
    principle:
      "Write $h$ for the hours worked, $w$ for the wage in dollars per hour and $c$ for the cost in dollars. Then the net pay $N$ after $h$ hours is $N = w \\times h - c$. The wage is the change in net pay divided by the change in hours. The cost is $c = w \\times h - N$ for any column. At 0 hours, net pay is $-c$, the cost with a minus sign.",
    example: {
      prompt:
        "Net pay after 1, 2, 3 and 4 hours is −20, −8, 4 and 16 dollars. Find the wage and the cost.",
      steps: [
        "From 1 to 2 hours, net pay goes from −20 to −8. The change is $-8 - (-20) = 12$ dollars for 1 hour, so the wage is 12 dollars per hour.",
        "After 1 hour the worker has earned $12 \\times 1 = 12$ dollars. The table says the net pay then is −20.",
        "The cost is the pay earned minus the net pay: $12 - (-20) = 32$ dollars. Subtracting −20 is the same as adding 20.",
      ],
      answer: "Wage 12 dollars per hour; cost 32 dollars.",
    },
    methodTitle: "Wage first, then the cost",
    methodText: [
      "Check with another column. After 3 hours the pay earned is $3 \\times 12 = 36$ dollars, and $36 - 32 = 4$, the net pay in the table.",
      "Net pay stays below zero until the pay earned covers the cost. Here that happens between 2 and 3 hours.",
    ],
    formal:
      "Write $h$ for the hours, $w$ for the wage and $c$ for the cost. Write $N(h)$, read “$N$ of $h$”, for the net pay after $h$ hours. Then $N(h) = wh - c$, where $wh$ means $w \\times h$. Each hour adds the same $w$, so net pay grows by equal steps. A rule that changes by the same amount for each hour is called linear. The wage $w$ is its rate of change, the change in net pay for each hour. At 0 hours, $N(0) = -c$, the cost with a minus sign in front: a number below zero.",
    pitfalls: [
      "Do not use the net pay after 1 hour as the wage. The wage is the change from one hour to the next.",
      "Give the cost as a positive amount of money spent. Do not write it with a minus sign.",
    ],
    parentGuide:
      "Ask the learner what the net pay would be at 0 hours, and why that number is below zero.",
  },
  {
    id: "percent-amounts-blanks",
    title: "Two percents of a whole",
    summary:
      "A percent is a number out of 100, so 35% means 35 of every 100. Multiply an amount by 35 and divide by 100 to find 35% of it.",
    objectives: [
      "Find two percents of one amount.",
      "Decide whether an amount is within a stated limit or over it.",
    ],
    intuition:
      "A percent is a number out of 100, so 35% means 35 out of every 100. For example, 1,500 dollars holds 15 hundreds, and each hundred gives 35. So 35% of 1,500 dollars is $15 \\times 35 = 525$ dollars. A fraction names equal parts of a whole: $\\frac{35}{100}$, read 35 over 100, means 35 of 100 equal parts. So 35% can be written $\\frac{35}{100}$. Multiplying by $\\frac{35}{100}$ means multiplying by 35 and dividing by 100, which takes 35 for each hundred: $1{,}500 \\times \\frac{35}{100} = 525$. A group of items can be split by percents. On a shelf of 40 books, 25% fiction means $40 \\times \\frac{25}{100} = 10$ fiction books. A budget is a plan for spending money, and it can be split by percents the same way. A limit is the largest amount allowed. An amount is within the limit when it is equal to the limit or less. It is over the limit when it is greater.",
    terms: [
      "percent",
      [
        "at-most",
        "The limit is the greatest amount allowed, so the total must be at most the limit.",
      ],
    ],
    method: [
      "Write each percent as a fraction over 100, such as $\\frac{35}{100}$ for 35%.",
      "Multiply the whole by that fraction to find the amount.",
      "If there is a limit, compare each amount with its own limit. Within means equal to the limit or less.",
    ],
    watch:
      "Take each percent of the whole, not of the other amount. Compare each amount with its own limit.",
    principle:
      "$p\\%$ of a whole $Q$ is $\\frac{p}{100} \\times Q$. An amount $A$ is within a limit $L$ when $A \\le L$, which means $A$ is less than or equal to $L$. It is over the limit when $A > L$, which means $A$ is greater than $L$.",
    example: {
      prompt:
        "A family earns 2,000 dollars a month. Rent is 30% of it, with a limit of 650 dollars. Is the rent within the limit?",
      steps: [
        "Rent is 30% of 2,000 dollars: 30 dollars of every 100. There are 20 hundreds in 2,000, so rent is $20 \\times 30 = 600$ dollars. In one step: $2{,}000 \\times \\frac{30}{100} = 600$ dollars.",
        "Compare with the limit: 600 dollars is less than 650 dollars. So the rent is within the limit.",
      ],
      answer: "Rent is 600 dollars, within the limit.",
    },
    methodTitle: "Percent of the whole, then compare",
    methodText: [
      "Percents of the same whole can be added when no item is in both groups. Say 25% of 40 books are on the top shelf and 40% are on the bottom shelf. That is 10 and 16 books. Each book sits on only one shelf. So 65% of them, $10 + 16 = 26$ books, are on those two shelves.",
      "A percent greater than 50% gives an amount greater than half of the whole.",
    ],
    formal:
      "Write $p$ for the percent, so $p\\%$ means $p$ out of 100. Taking $p\\%$ of a whole multiplies the whole by $\\frac{p}{100}$. Proportional means that multiplying one amount by a number multiplies the other by the same number. So for the same whole, the amounts are proportional to the percents. Twice the percent gives twice the amount.",
    pitfalls: [
      "35% means $\\frac{35}{100}$, not 35. Do not multiply by 35 alone.",
      "Compare each amount with its own limit, not with another one.",
    ],
    parentGuide:
      "Draw a grid of 100 small boxes. Shade 35 of them to see what 35% of a whole looks like.",
  },
  {
    id: "check-register-blanks",
    title: "Complete a check register",
    summary:
      "An account holds money at a bank, and its balance is how much is in it. Each line adds its amount: plus for money in, minus for out.",
    objectives: [
      "Find a new balance by adding a positive or negative amount to the balance before it.",
      "Find a missing amount from two balances, including balances below zero.",
    ],
    intuition:
      "An account is money kept at a bank. Its balance is how much money is in it. A check register is a table that records money going in and out of the account, one line at a time. A positive number is a number greater than zero, and a plus sign may be written in front of it, as in +54. A negative number is a number less than zero, written with a minus sign, as in −73. A deposit is an amount of money put into the account, so it is written as a positive amount. A withdrawal is an amount of money taken out, so it is written as a negative amount. Each new balance is the balance before plus the line's amount. If the balance goes below zero, the account is overdrawn: it owes the bank money, and the balance is a negative number. A line's amount is the change from the balance before to the balance after. So to find a missing amount, subtract the balance before from the balance after. The sign of the answer tells the direction: positive for money in, negative for money out. For example, going from 28 to 17 means the amount was $17 - 28 = -11$, a withdrawal of 11 dollars.",
    terms: ["balance-account", "deposit", "withdrawal"],
    method: [
      "For a missing balance, add the line's amount to the balance before it.",
      "For a missing amount, subtract the balance before from the balance after.",
      "Check each line: the balance before plus the amount equals the balance after.",
    ],
    watch:
      "Keep every minus sign. Subtracting a negative balance means adding, and a withdrawal always lowers the balance.",
    principle:
      "Each new balance is the old balance plus the line's amount. So the amount is the new balance minus the old balance. A deposit is a positive amount, a withdrawal is a negative amount, and a balance below zero is a negative number.",
    example: {
      prompt:
        "The balance is 40 dollars. Line 1 is −65 and line 2 brings the balance to 30. Find the balance after line 1 and the amount of line 2.",
      steps: [
        "Line 1 is a withdrawal of 65 dollars. Parentheses are curved marks that keep a number and its minus sign together, as in $(-65)$. Add the withdrawal to the starting balance. Taking 65 dollars out of 40 dollars uses up the 40, and 25 dollars are still owed: $40 + (-65) = -25$. The balance is below zero, so the account is overdrawn by 25 dollars.",
        "Line 2 takes the balance from −25 to 30. Subtract the balance before from the balance after. Subtracting a negative number is the same as adding the positive number, so $30 - (-25) = 30 + 25 = 55$. A number line is a line with evenly spaced marks for numbers, here 1 dollar apart. Going from −25 up to 30 is 25 dollars up to zero and then 30 more.",
        "The amount is positive, so line 2 is a deposit of 55 dollars.",
      ],
      answer: "−25 after line 1; +55 for line 2.",
    },
    methodTitle: "Balance before plus amount",
    methodText: [
      "Check: $-25 + 55 = 30$, the balance after line 2.",
      "A negative balance means the account owes money. Its size, without the minus sign, is the amount owed.",
    ],
    formal:
      "A small number written low after a letter is called a subscript. Call the starting balance $B_0$, where the subscript 0 means before any line. Call the line amounts $a_1$, $a_2$, $a_3$ and so on, where each subscript is the line number. The balance after line 3 is $B_0 + a_1 + a_2 + a_3$, and the adding goes on the same way for more lines. So each missing amount is one balance minus the balance just before it. Deposits are positive and withdrawals are negative, so the single step of adding the amount handles both.",
    pitfalls: [
      "Keep the minus sign on a withdrawal.",
      "For a missing amount, subtract the old balance from the new one, not the new from the old.",
    ],
    parentGuide:
      "Draw a number line. Start at the balance, move left for a withdrawal and right for a deposit.",
  },
];

/** How each lesson and its practice screen read ambiguous words. */
const glossary: Record<string, Pick<ProblemMethod, "senses" | "noLink">> = {
  "loan-offer-compare-blanks": {
    senses: {
      difference: "difference-subtract",
      product: "product-multiply",
      part: "part",
    },
  },
  "scale-factor-effects-blanks": {
    senses: {
      image: "image-transformation",
      side: "side",
      squared: "square-number",
      unit: "unit",
      product: "product-multiply",
      change: "change",
      part: "part",
    },
    noLink: ["squares", "scales", "rule", "one quarter"],
  },
  "expected-count-blanks": {
    senses: { trials: "trial", mean: "mean-average" },
  },
  "unit-rate-pair-blanks": {
    senses: { unit: "unit", side: "side-of-equation", part: "part" },
  },
  "ratio-pair-blanks": {
    senses: { part: "part", whole: "whole" },
    noLink: ["terms", "mean"],
  },
  "mean-median-blanks": {
    senses: { mean: "mean-average", "more than": "more-than" },
    noLink: ["third", "fourth", "sort", "sorting", "squared"],
  },
  "median-mode-compare-blanks": {
    senses: { mode: "mode-statistics", "more than": "more-than" },
    noLink: ["sort", "center"],
  },
  "wage-and-cost-blanks": {
    senses: { change: "change", difference: "difference-subtract" },
    noLink: ["rule"],
  },
  "percent-amounts-blanks": {
    senses: { "more than": "more-than", part: "part", whole: "whole" },
    noLink: ["squares"],
  },
  "check-register-blanks": {
    senses: {
      balance: "balance-account",
      difference: "difference-subtract",
      change: "change",
    },
    noLink: ["rule"],
  },
};

const built = formatLessons(entries);
export const quantityPairBlanksLessons: Lesson[] = built.lessons.map((l) => ({
  ...l,
  ...glossary[l.id],
}));
export const quantityPairBlanksMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    Object.entries(built.methods).map(([id, m]) => [
      id,
      { ...m, ...glossary[id] },
    ]),
  );
export const quantityPairBlanksPrinciples = built.principles;

const partial = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const quantityPairBlanksFacetMappings: readonly FacetMapping[] = [
  partial(
    "quotient-remainder-blanks",
    "multidigit-quotients.two-digit-divisor",
    "Choose the number of full groups and the number left over for a total below 1,000 and a two-digit group size, in a bags, boxes or rows story. Does not assess dividends of four or more digits, interpreting a remainder by rounding up, or the written long division.",
  ),
  partial(
    "meters-to-kilometers-blanks",
    "measurement-conversions.core",
    "Add three distances of 300 to 990 meters and choose the whole kilometers and the meters left, for totals of 1,000 to 3,000 meters. Does not assess other units, subtracting lengths, or totals with decimals.",
  ),
  partial(
    "simple-interest-blanks",
    "percent-change.core",
    "Find the simple interest and the total for whole-dollar amounts, a whole-percent yearly rate and two to six years, by choosing both. Does not assess compound interest, fractional years, or solving for the rate or time.",
  ),
  partial(
    "loan-offer-compare-blanks",
    "percent-change.core",
    "Compare the simple interest of two offers with different rates and times and choose the cheaper bank and the difference. Does not assess compound interest, monthly payments, or fees.",
  ),
  partial(
    "scale-factor-effects-blanks",
    "dilations-similarity.core",
    "Choose the factors that multiply the perimeter and the area of a rectangle under a whole-number or unit-fraction dilation. Does not assess volume, non-rectangular figures, or deriving why the area changes by the square.",
  ),
  partial(
    "expected-count-blanks",
    "probability.core",
    "Choose the probability and the expected count for a spinner of ten equal sections with one to four sections of the stated number and 50 to 200 spins. Does not assess compound events, experimental results, or spinners with unequal sections.",
  ),
  partial(
    "unit-rate-pair-blanks",
    "unit-rates.whole-quantity-unit-rates",
    "Choose two decimal unit rates from two whole-number amounts and times of 2, 4, 5, 8 or 10 minutes. Does not assess comparing the rates, rates with fractions of a minute, or unit prices.",
  ),
  partial(
    "ratio-pair-blanks",
    "ratios.core",
    "Choose the count of one color and the total from a two-part ratio of reduced whole numbers and the count of the other color. Does not assess three-part ratios, ratios as fractions, or ratio tables.",
  ),
  partial(
    "mean-median-blanks",
    "statistics-mean.core",
    "Choose the mean and the median of six decimal values with tenths, listed out of order, with an exact mean. Does not assess the mode or range, outliers, or data in a table or graph.",
  ),
  partial(
    "median-mode-compare-blanks",
    "compare-distributions.core",
    "Complete a sentence comparing the medians and the modes of two lists of seven whole numbers from 1 to 9, each with one mode. Does not assess comparing means or spread, lists in a graph, or an explanation of the comparison.",
  ),
  partial(
    "rectangle-chain-blanks",
    "area-perimeter-models.core",
    "Choose the length from an area and a width, then the perimeter, for whole-number rectangles in centimeters, meters or feet. Does not assess composite figures, drawn models, or fractional sides.",
  ),
  partial(
    "wage-and-cost-blanks",
    "linear-models.initial-value-in-context",
    "Choose the hourly wage and the starting cost from a table of four net pay values that begins below zero, with consecutive or every-other hours. Does not assess writing the equation, graphs, or interpreting the intercept in a sentence.",
  ),
  partial(
    "percent-amounts-blanks",
    "percentages.core",
    "Choose two percents of a whole as counts of books, or as dollar amounts each compared with its limit as within or over. Does not assess percent change, finding the whole from a part, or drawing a graph of the budget.",
  ),
  partial(
    "check-register-blanks",
    "rational-stories.signed-decimal-stories",
    "Choose two balances and two amounts of a four-line check register of whole dollars with deposits and withdrawals, including balances below zero. Does not assess decimal cents, finding the total of a month, or errors in the register.",
  ),
];
