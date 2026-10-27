import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

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
    terms: [
      [
        "quotient",
        "The number of full groups, the whole-number result of the division.",
      ],
      [
        "remainder",
        "What is left after the full groups are taken out; it is less than the group size.",
      ],
    ],
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
      ["kilometer", "A unit of length equal to 1,000 meters."],
      [
        "regroup",
        "Rewrite a number using bigger units, such as 2,396 meters as 2 kilometers 396 meters.",
      ],
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
      "Simple interest is the principal times the rate times the years; the total is the principal plus the interest.",
    objectives: [
      "Find simple interest from a principal, a yearly percent rate and a number of years.",
      "Add the interest to the principal to find the total.",
    ],
    intuition:
      "Interest is money earned on a deposit or paid on a loan. With simple interest the same amount is earned every year: the rate, a percent of the principal, the amount at the start. Earning 5% of 800 dollars is 40 dollars a year. In 3 years the interest is $3\\times40=120$ dollars. The total is the principal and the interest together: $800+120=920$ dollars.",
    terms: [
      ["principal", "The amount deposited or borrowed at the start."],
      [
        "simple interest",
        "Interest calculated only on the principal, the same amount each year.",
      ],
      ["rate", "The percent of the principal earned or charged each year."],
    ],
    method: [
      "Write the rate as a fraction of 100 and multiply by the principal to get one year of interest.",
      "Multiply by the number of years to get the total interest.",
      "Add the interest to the principal to find the total amount.",
    ],
    watch:
      "Multiply by the number of years and add the principal. One year of interest or the interest alone is not the total.",
    principle:
      "Simple interest is $I=P\\cdot r\\cdot t$ with principal $P$, yearly rate $r$ as a decimal, and time $t$ in years. The total amount is $A=P+I=P(1+rt)$.",
    example: {
      prompt:
        "A deposit of 500 dollars earns 4% simple interest each year for 3 years. Find the interest and the total.",
      steps: [
        "One year: $500\\times\\frac{4}{100}=20$ dollars.",
        "Three years: $20\\times 3=60$ dollars of interest.",
        "Total: $500+60=560$ dollars.",
      ],
      answer: "60 dollars of interest and 560 dollars in all.",
    },
    methodTitle: "One year, then all the years",
    methodText: [
      "Check with the formula: $500\\times0.04\\times3=60$.",
      "The interest grows by the same amount each year, because simple interest is not earned on earlier interest.",
    ],
    formal:
      "$I=Prt$ is linear in $t$, so $A(t)=P+Prt$ is a linear function of time with slope $Pr$, the interest earned per year.",
    pitfalls: [
      "Do not give one year's interest for several years.",
      "Do not forget to add the principal to find the total amount.",
    ],
    parentGuide:
      "Make a small table of year 1, year 2 and year 3 with the interest earned each year and add the rows.",
  },
  {
    id: "loan-offer-compare-blanks",
    title: "Compare two loan offers",
    summary:
      "Find the simple interest of each offer, then compare to see which costs less and by how much.",
    objectives: [
      "Find the interest of two loan offers with different rates and different times.",
      "Subtract the lesser interest from the greater to find the difference.",
    ],
    intuition:
      "A loan's cost is the interest you pay. When two banks lend the same amount at different rates and for different times, a lower rate does not always cost less, because the time also matters. Find each bank's interest from principal times rate times years, then compare the two amounts. The offer with the lesser interest costs less, and the difference tells how much less.",
    terms: [
      ["loan", "Money borrowed that is paid back with interest."],
      [
        "cost of a loan",
        "The interest paid, the amount beyond what was borrowed.",
      ],
    ],
    method: [
      "Find the interest for the first offer: principal $\\times$ rate $\\times$ years.",
      "Find the interest for the second offer the same way.",
      "The lesser interest costs less. Subtract it from the greater to find how much less.",
    ],
    watch:
      "Compare the interest of both offers over their own times. Do not compare the rates alone.",
    principle:
      "With the same principal $P$ the cost of an offer is $I=Prt$. Offer 1 costs less than offer 2 exactly when $r_1t_1<r_2t_2$, and the difference is $P\\,|r_1t_1-r_2t_2|$.",
    example: {
      prompt:
        "A family borrows 1,000 dollars. Bank A charges 6% simple interest for 2 years, and Bank B charges 4% for 4 years. Which costs less, and by how much?",
      steps: [
        "Bank A: $1{,}000\\times\\frac{6}{100}\\times2=120$ dollars.",
        "Bank B: $1{,}000\\times\\frac{4}{100}\\times4=160$ dollars.",
        "Bank A costs less, by $160-120=40$ dollars.",
      ],
      answer: "Bank A, by 40 dollars.",
    },
    methodTitle: "Each offer alone, then compare",
    methodText: [
      "A lower rate over a longer time can cost more, as Bank B shows.",
      "The difference is always positive: subtract the lesser from the greater.",
    ],
    formal:
      "Since $I=Prt$ is increasing in both $r$ and $t$, the comparison depends on the product $rt$, the total rate over the term.",
    pitfalls: [
      "Do not choose the bank with the lower rate without checking the years.",
      "Do not add the two interests instead of subtracting them.",
    ],
    parentGuide:
      "Write the cost of each offer on its own line before comparing, so each result has its own label.",
  },
  {
    id: "scale-factor-effects-blanks",
    title: "How a dilation changes perimeter and area",
    summary:
      "A scale factor $k$ multiplies lengths and so the perimeter by $k$, but it multiplies the area by $k^2$.",
    objectives: [
      "Tell that the perimeter of a dilated figure is multiplied by the scale factor.",
      "Tell that the area is multiplied by the square of the scale factor.",
    ],
    intuition:
      "A dilation by a scale factor $k$ multiplies every length by $k$. A perimeter is a sum of lengths, so it is multiplied by $k$. An area is a length times a length, so it is multiplied by $k$ twice, $k\\times k=k^2$. Doubling the sides of a 2 by 3 rectangle makes a 4 by 6 rectangle: the perimeter goes from 10 to 20, twice as much, and the area from 6 to 24, four times as much.",
    terms: [
      [
        "scale factor",
        "The number by which every length of a figure is multiplied.",
      ],
      [
        "dilation",
        "A transformation that enlarges or reduces a figure by a scale factor.",
      ],
    ],
    method: [
      "Find the sides of the image by multiplying each side by the scale factor.",
      "Compare the new perimeter with the old: the ratio is the scale factor.",
      "Compare the new area with the old: the ratio is the scale factor squared.",
    ],
    watch:
      "Do not use the scale factor for the area. Area is a product of two lengths, so it changes by the square.",
    principle:
      "A dilation by $k>0$ multiplies lengths by $k$, perimeters by $k$ and areas by $k^2$. For a scale factor $\\frac{1}{n}$ the perimeter is multiplied by $\\frac{1}{n}$ and the area by $\\frac{1}{n^2}$.",
    example: {
      prompt:
        "A rectangle 2 units by 5 units is dilated by a scale factor of 3. How do the perimeter and the area change?",
      steps: [
        "The image is 6 units by 15 units.",
        "The perimeter goes from $2(2+5)=14$ to $2(6+15)=42$, which is 3 times as much.",
        "The area goes from $2\\times5=10$ to $6\\times15=90$, which is $3^2=9$ times as much.",
      ],
      answer: "Perimeter: 3 times. Area: 9 times.",
    },
    methodTitle: "Lengths, then squares",
    methodText: [
      "For a reduction with $k=\\frac{1}{2}$, the perimeter is halved and the area is one quarter.",
      "Check with numbers as in the example, not only with the rule.",
    ],
    formal:
      "If a region is mapped by $(x,y)\\to(kx,ky)$ then arc length scales by $k$ and, since the Jacobian determinant is $k^2$, area scales by $k^2$.",
    pitfalls: [
      "Do not multiply the area by the scale factor; the new area is $k^2$ times the old one.",
      "Do not square the factor for the perimeter.",
    ],
    parentGuide:
      "Cut grid paper into a 2 by 3 rectangle and a 4 by 6 rectangle and count the unit squares in each.",
  },
  {
    id: "expected-count-blanks",
    title: "Probability and expected count",
    summary:
      "The probability of a spinner outcome is the favorable sections over all sections; multiply by the spins for the expected count.",
    objectives: [
      "Find the probability of an outcome on a spinner with equal sections.",
      "Predict how often the outcome happens in a number of spins.",
    ],
    intuition:
      "On a spinner with 10 equal sections, each section is equally likely. If 2 sections show 20, the probability of landing on 20 is $\\frac{2}{10}=\\frac{1}{5}$. In 150 spins you would expect about $\\frac{1}{5}$ of the spins to land on 20, which is $\\frac{1}{5}\\times150=30$. The expected count is a prediction, not a guarantee.",
    terms: [
      [
        "probability",
        "How likely an outcome is: favorable outcomes divided by all equally likely outcomes.",
      ],
      [
        "expected count",
        "The number of times you predict an outcome in many trials: probability times the number of trials.",
      ],
    ],
    method: [
      "Count the sections that show the number, and divide by the total number of sections.",
      "Reduce the fraction if you can.",
      "Multiply the probability by the number of spins to find the expected count.",
    ],
    watch:
      "Count only the sections with the number asked for, out of all the sections. Do not use the other sections.",
    principle:
      "For $n$ equally likely outcomes of which $k$ are favorable, $P=\\frac{k}{n}$. In $N$ independent trials the expected number of favorable outcomes is $N\\cdot P$.",
    example: {
      prompt:
        "A spinner has 10 equal sections, and 3 of them show 40. It is spun 80 times. What is the probability of 40, and how many times is it expected?",
      steps: [
        "3 of the 10 equal sections show 40, so $P=\\frac{3}{10}$.",
        "The expected number of times is $\\frac{3}{10}\\times 80=24$.",
      ],
      answer: "Probability $\\frac{3}{10}$; about 24 times.",
    },
    methodTitle: "Count, then scale",
    methodText: [
      "Check that the expected count is less than the number of spins.",
      "The result is only a prediction: an actual run of spins can differ.",
    ],
    formal:
      "By linearity of expectation, if each of $N$ trials has success probability $p$, the expected number of successes is $Np$, whatever the dependence between trials.",
    pitfalls: [
      "Do not use the number of other sections as the favorable count.",
      "Do not divide the number of spins by the probability.",
    ],
    parentGuide:
      "Spin a paper spinner a few times with your learner and compare the results with the prediction.",
  },
  {
    id: "unit-rate-pair-blanks",
    title: "Two unit rates",
    summary:
      "A unit rate is the amount for one unit of time; divide each amount by its own number of minutes.",
    objectives: [
      "Find a unit rate by dividing an amount by a time.",
      "Compute two unit rates from two different totals and times.",
    ],
    intuition:
      "A unit rate says how much for one unit, such as pages for one minute. If a printer prints 36 pages in 8 minutes, then in one minute it prints $36\\div 8=4.5$ pages. When there are two situations, find a rate for each one using its own amount and its own time; do not mix them.",
    terms: [
      [
        "rate",
        "A comparison of two different quantities, such as pages and minutes.",
      ],
      [
        "unit rate",
        "A rate with 1 unit of the second quantity: pages per 1 minute.",
      ],
    ],
    method: [
      "Pair each amount with its own time.",
      "Divide the amount by the time to get the amount per minute.",
      "Do the same for the other situation and write each rate with its unit.",
    ],
    watch:
      "Divide the amount by the time, not the time by the amount, and use each situation's own numbers.",
    principle:
      "If $a$ units of one quantity go with $t$ units of another, the unit rate is $\\frac{a}{t}$ per one unit of the second. Since $t\\cdot\\frac{a}{t}=a$, multiplying the rate by the time returns the amount.",
    example: {
      prompt:
        "A printer prints 36 pages in 8 minutes in black and white and 27 pages in 6 minutes in color. What are the rates?",
      steps: [
        "Black and white: $36\\div 8=4.5$ pages per minute.",
        "Color: $27\\div 6=4.5$ pages per minute.",
        "Check: $8\\times4.5=36$ and $6\\times4.5=27$.",
      ],
      answer: "4.5 pages per minute in both.",
    },
    methodTitle: "Divide each pair",
    methodText: [
      "A rate with decimals is fine: 36 divided by 8 is 4.5.",
      "Check each rate by multiplying it by its time.",
    ],
    formal:
      "A constant rate $r$ means the amount $a=rt$ is proportional to the time $t$, so $r=a/t$ for every pair, and the unit rate is the constant of proportionality.",
    pitfalls: [
      "Do not divide the total of both amounts by the total of both times.",
      "Do not invert the rate: minutes per page is a different rate.",
    ],
    parentGuide:
      "Ask your learner to check that multiplying the rate by the minutes gives back the pages.",
  },
  {
    id: "ratio-pair-blanks",
    title: "A part and the whole from a ratio",
    summary:
      "A ratio gives the parts of a total; find what one part stands for, then the other part and the whole.",
    objectives: [
      "Find the amount one part of a ratio stands for.",
      "Find the other part and the whole from the ratio.",
    ],
    intuition:
      "A ratio of 4 to 3 means that for every 4 blue gumballs there are 3 yellow. Think of each color as a number of equal parts. If 24 gumballs are yellow and yellow is 3 parts, one part is $24\\div3=8$ gumballs. Then blue is 4 parts, $4\\times8=32$, and all together there are $4+3=7$ parts, $7\\times8=56$ gumballs.",
    terms: [
      [
        "ratio",
        "A comparison of two quantities by their parts, such as 4 to 3.",
      ],
      ["part", "One of the equal shares the ratio divides the whole into."],
    ],
    method: [
      "Divide the known amount by its ratio number to find the size of one part.",
      "Multiply the other ratio number by the size of one part.",
      "Add the two amounts, or multiply the total number of parts by the size of one part, to find the whole.",
    ],
    watch:
      "Pair each number of the ratio with the right color. In 4 to 3 the 4 belongs to the first color named.",
    principle:
      "If quantities are in the ratio $a:b$ and the second is $B$, then each part is $B/b$, the first is $aB/b$, and the whole is $(a+b)B/b$.",
    example: {
      prompt:
        "Red and green beads are in the ratio 5 to 2. There are 12 green beads. How many red beads and how many beads in all?",
      steps: [
        "Green is 2 parts, so one part is $12\\div2=6$ beads.",
        "Red is 5 parts: $5\\times6=30$ beads.",
        "In all there are $30+12=42$ beads.",
      ],
      answer: "30 red beads and 42 beads in all.",
    },
    methodTitle: "Size of one part",
    methodText: [
      "Check the ratio: $30:12$ is the same ratio as $5:2$.",
      "The whole is greater than either part.",
    ],
    formal:
      "Equivalent ratios are found by multiplying both terms by the same number $f>0$: $a:b=af:bf$. Here $f=B/b$, and the whole is $af+bf$.",
    pitfalls: [
      "Do not add the ratio numbers to the known amount: 24 + 4 is not the number of blue.",
      "Do not use the wrong color's ratio number for the known amount.",
    ],
    parentGuide:
      "Draw boxes for the parts, put the known amount in its boxes, and work out what each box holds.",
  },
  {
    id: "mean-median-blanks",
    title: "Mean and median of six values",
    summary:
      "The mean is the sum divided by the count; the median of six values is the mean of the two middle ones after sorting.",
    objectives: [
      "Find the mean of six decimal values.",
      "Order the values and find the median of an even number of values.",
    ],
    intuition:
      "The mean is the amount each value would have if they were all equal: add the values and divide by how many there are. The median is the middle value when the list is in order. With six values there are two middle values, so the median is halfway between them, their mean. The median needs the values sorted first, and a list in the order given may have a different middle.",
    terms: [
      ["mean", "The sum of the values divided by the number of values."],
      [
        "median",
        "The middle value of an ordered list; with an even number of values, the mean of the two middle ones.",
      ],
    ],
    method: [
      "Add the values and divide by the number of values to find the mean.",
      "Write the values in order from least to greatest.",
      "Take the mean of the third and fourth values of the sorted list, for the median of six values.",
    ],
    watch:
      "Sort the values before finding the median. The middle of the list as given is not the median.",
    principle:
      "For $x_1\\le\\dots\\le x_n$ the mean is $\\bar{x}=\\frac{1}{n}\\sum x_i$ and the median is $x_{(n+1)/2}$ for odd $n$ and $\\frac{x_{n/2}+x_{n/2+1}}{2}$ for even $n$.",
    example: {
      prompt:
        "Six times in seconds: 10.4, 9.8, 11.2, 10.0, 10.6, 9.8. Find the mean and the median.",
      steps: [
        "The sum is $10.4+9.8+11.2+10.0+10.6+9.8=61.8$, so the mean is $61.8\\div6=10.3$.",
        "In order: 9.8, 9.8, 10.0, 10.4, 10.6, 11.2.",
        "The middle values are 10.0 and 10.4, so the median is $(10.0+10.4)\\div2=10.2$.",
      ],
      answer: "Mean 10.3 seconds; median 10.2 seconds.",
    },
    methodTitle: "Add and divide; sort and split",
    methodText: [
      "Check that the mean is between the least and the greatest value.",
      "A repeated value counts each time in both the sum and the sorted list.",
    ],
    formal:
      "The mean minimizes the sum of squared deviations and the median minimizes the sum of absolute deviations. The two need not agree.",
    pitfalls: [
      "Do not divide the sum by 5 when there are six values.",
      "Do not use the third and fourth values of the unsorted list.",
    ],
    parentGuide:
      "Write each value on a card, sort the cards, and ask your learner to point to the middle two.",
  },
  {
    id: "median-mode-compare-blanks",
    title: "Compare two medians and two modes",
    summary:
      "Sort each list to find its median, find the most frequent value for the mode, and compare.",
    objectives: [
      "Find the median and the mode of a list of seven values.",
      "Compare the medians and the modes of two lists.",
    ],
    intuition:
      "The median is the middle value of a sorted list; the mode is the value that occurs most often. To compare two teams, find these two numbers for each team. Two lists can have the same mode and different medians, or the reverse. Sort each list first, because the median of the unsorted list is not the middle value.",
    terms: [
      ["median", "The middle value of a list in order."],
      ["mode", "The value that occurs most often."],
    ],
    method: [
      "Write each list in order from least to greatest.",
      "Find the middle value (the 4th of 7) for each median, and the most frequent value for each mode.",
      "Compare the two medians and the two modes with the words of the sentence.",
    ],
    watch:
      "Compare the medians with each other and the modes with each other, not a median with a mode.",
    principle:
      "For seven ordered values $x_1\\le\\dots\\le x_7$ the median is $x_4$. The mode is the value with the greatest frequency; a list can have more than one mode.",
    example: {
      prompt:
        "Hawks scored 3, 5, 5, 7, 2, 5, 8 and Owls scored 4, 6, 6, 2, 6, 9, 3. Compare the medians and the modes.",
      steps: [
        "Hawks in order: 2, 3, 5, 5, 5, 7, 8; the median is 5 and the mode is 5.",
        "Owls in order: 2, 3, 4, 6, 6, 6, 9; the median is 6 and the mode is 6.",
        "The Hawks' median is less than the Owls' median, and the modes do not match.",
      ],
      answer: "Less than; the modes do not match.",
    },
    methodTitle: "Two numbers for each team",
    methodText: [
      "Write the median and the mode of each team before comparing.",
      "Equal means exactly the same value, such as 5 and 5.",
    ],
    formal:
      "Medians and modes are measures of center. They are compared as numbers; the median is the 50th percentile and is unique, while the mode is the maximum of the frequency function.",
    pitfalls: [
      "Do not use the middle of the unsorted list.",
      "Do not call the modes equal because both are numbers; they must be the same number.",
    ],
    parentGuide:
      "Ask your learner to cross out one smallest and one largest value at a time until the median is left.",
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
    terms: [
      ["area", "The amount of surface, in square units: length times width."],
      [
        "perimeter",
        "The distance around a shape: for a rectangle, twice the sum of length and width.",
      ],
    ],
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
      "The change in net pay for each hour is the wage; the starting cost is how far below zero the line begins.",
    objectives: [
      "Find an hourly rate from the change in a table.",
      "Find the starting amount of a linear relationship, even when it is negative.",
    ],
    intuition:
      "Net pay is the pay earned minus a one-time cost. Each hour adds the same wage to the net pay, so the wage is the change in net pay for one hour. Before any work the net pay is $-$ the cost, so the cost is how much the pay must rise before it reaches zero. In a table with 2 and 4 hours, divide the change in net pay by 2 to get the wage for one hour.",
    terms: [
      ["net pay", "Pay earned minus what was spent."],
      [
        "rate of change",
        "How much a quantity changes for each step of 1 in the other quantity.",
      ],
    ],
    method: [
      "Find the change in net pay between two columns and divide by the change in hours: that is the wage.",
      "Multiply the wage by the hours of one column to find the pay earned.",
      "Subtract the net pay from the pay earned to find the cost.",
    ],
    watch:
      "Compare the pay earned with the net pay. The cost is the difference between them, and it is not the first net pay.",
    principle:
      "If net pay is $N(h)=wh-c$, then $\\frac{N(h_2)-N(h_1)}{h_2-h_1}=w$ and $c=wh_1-N(h_1)$. The value $N(0)=-c$ is the initial amount.",
    example: {
      prompt:
        "Net pay after 1, 2, 3 and 4 hours is −20, −8, 4 and 16 dollars. Find the wage and the cost.",
      steps: [
        "From 1 to 2 hours the net pay goes from −20 to −8, a change of 12, so the wage is 12 dollars per hour.",
        "After 1 hour the pay earned is 12 dollars and the net pay is −20.",
        "The cost is $12-(-20)=32$ dollars.",
      ],
      answer: "Wage 12 dollars per hour; cost 32 dollars.",
    },
    methodTitle: "Rate first, then start",
    methodText: [
      "Check on another column: after 3 hours the pay earned is 36 and $36-32=4$.",
      "Net pay is negative until the wage earned covers the cost.",
    ],
    formal:
      "A linear function $N(h)=wh+b$ has slope $w$ and value $b=N(0)$. Here $b=-c$ is negative, so the cost is $-b$.",
    pitfalls: [
      "Do not use the net pay after one hour as the wage.",
      "Do not give the cost a minus sign: it is the amount spent.",
    ],
    parentGuide:
      "Ask your learner what the net pay would be at 0 hours, and why that number is negative.",
  },
  {
    id: "percent-amounts-blanks",
    title: "Two percents of a whole",
    summary:
      "A percent of a quantity is the quantity times the percent over 100; compare amounts with limits when asked.",
    objectives: [
      "Find two percents of one quantity.",
      "Compare an amount with a stated limit.",
    ],
    intuition:
      "A percent is a number out of 100, so 35% of 1,500 is $1{,}500\\times\\frac{35}{100}=525$. A set of items can be split by percents: in 40 books, 25% fiction is 10 books. A budget works the same way: rent of 35% of an income of 1,500 dollars is 525 dollars. To check a limit, compare the amount with the limit: an amount that is not more than the limit is within it.",
    terms: [
      ["percent", "A number out of 100, written with %."],
      ["limit", "The greatest amount allowed."],
    ],
    method: [
      "Write each percent as a fraction over 100.",
      "Multiply the whole by the fraction to find the amount.",
      "If there is a limit, compare each amount with its own limit: within means not more than the limit.",
    ],
    watch:
      "Take the percent of the whole, not of the other amount, and compare each amount with its own limit.",
    principle:
      "$p\\%$ of $Q$ is $\\frac{p}{100}\\cdot Q$. An amount $A$ is within a limit $L$ when $A\\le L$ and over when $A>L$.",
    example: {
      prompt:
        "A family earns 2,000 dollars a month. Rent is 30% of it, with a limit of 650 dollars. Is the rent within the limit?",
      steps: [
        "$2{,}000\\times\\frac{30}{100}=600$ dollars.",
        "600 is less than 650, so the rent is within the limit.",
      ],
      answer: "Rent is 600 dollars, within the limit.",
    },
    methodTitle: "Percent of the whole, then compare",
    methodText: [
      "Percents of the same whole add: 25% and 40% of 40 books are 10 and 16 books.",
      "A percent greater than 50% of a whole is more than half of it.",
    ],
    formal:
      "The map $Q\\mapsto \\frac{p}{100}Q$ is linear, so percents of the same whole are proportional to the percents themselves.",
    pitfalls: [
      "Do not multiply by the percent number: 35% means $\\frac{35}{100}$, not 35.",
      "Do not compare an amount with the wrong limit.",
    ],
    parentGuide:
      "Use a hundred-grid: shade 35 of the 100 squares to see what 35% of the whole looks like.",
  },
  {
    id: "check-register-blanks",
    title: "Complete a check register",
    summary:
      "Each balance is the previous balance plus the amount; deposits are positive and withdrawals are negative.",
    objectives: [
      "Find a new balance by adding a signed amount to the previous balance.",
      "Find a missing amount from two balances, including balances below zero.",
    ],
    intuition:
      "A check register records money in and out. A deposit adds money and is written as a positive amount; a withdrawal takes money out and is written as a negative amount. Each new balance is the previous balance plus the amount. If the balance is below zero the account is overdrawn. To find a missing amount, subtract the balance before from the balance after.",
    terms: [
      ["balance", "The amount in the account after a transaction."],
      ["deposit", "Money added to the account: a positive amount."],
      ["withdrawal", "Money taken out: a negative amount."],
    ],
    method: [
      "For a missing balance, add the signed amount to the previous balance.",
      "For a missing amount, subtract the previous balance from the new balance.",
      "Check each line: previous balance plus amount equals the new balance.",
    ],
    watch:
      "Keep the signs. Subtracting a negative balance adds, and a withdrawal lowers the balance.",
    principle:
      "With balances $B_{i}$ and signed amounts $a_i$, $B_i=B_{i-1}+a_i$ and so $a_i=B_i-B_{i-1}$. A balance below zero is a negative number.",
    example: {
      prompt:
        "The balance is 40 dollars. Line 1 is −65 and line 2 brings the balance to 30. Find the balance after line 1 and the amount of line 2.",
      steps: [
        "After line 1: $40+(-65)=-25$.",
        "Line 2 takes the balance from −25 to 30, so its amount is $30-(-25)=55$.",
        "Line 2 is a deposit of 55 dollars.",
      ],
      answer: "−25 after line 1; +55 for line 2.",
    },
    methodTitle: "Previous plus amount",
    methodText: [
      "Check: $-25+55=30$.",
      "A negative balance means the account owes money; its size is the amount owed.",
    ],
    formal:
      "The balance after $n$ transactions is $B_0+\\sum a_i$, so any missing amount is a difference of consecutive balances, and signed arithmetic handles deposits and withdrawals in one rule.",
    pitfalls: [
      "Do not drop the minus sign of a withdrawal.",
      "Do not subtract the new balance from the old one for the amount; subtract the old from the new.",
    ],
    parentGuide:
      "Use a number line: start at the balance, move left for a withdrawal and right for a deposit.",
  },
];

const built = formatLessons(entries);
export const quantityPairBlanksLessons = built.lessons;
export const quantityPairBlanksMethods = built.methods;
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
