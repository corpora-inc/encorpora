import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const k8StateNumberMethods: Record<string, ProblemMethod> = {
  "divisibility-rule-check": {
    goal: "Choose the number that is divisible by a given number, or the hidden digit that makes a number divisible.",
    intuition:
      "A number is divisible by another when dividing leaves no remainder. Each rule below checks a few digits instead of dividing the whole number.",
    terms: [
      "divisible-by",
      [
        "sum",
        "The digit sum adds all the digits of a number: for 4,512 it is $4 + 5 + 1 + 2 = 12$.",
      ],
    ],
    method: [
      "2: the last digit is 0, 2, 4, 6 or 8. 5: the last digit is 0 or 5. 10: the last digit is 0. 4: the number made by the last two digits is divisible by 4.",
      "3 or 9: find the digit sum. The number is divisible by 3 when the sum is, and by 9 when the sum is divisible by 9.",
      "6: the number must pass both the 2 rule and the 3 rule.",
      "To complete a number with a hidden digit, add the digits you can see, then find the digit that makes the total pass the rule.",
    ],
    watch:
      "A digit sum divisible by 3 only proves divisibility by 3. For 9, the digit sum itself must be divisible by 9. A number ending in 5 is divisible by 5 but not by 10.",
  },
  "prime-composite-sort": {
    goal: "Given four whole numbers, choose the prime one, the composite one, or the one that is neither.",
    intuition:
      "A factor of a number divides it with no remainder. A prime number has exactly two factors, 1 and itself. A composite number has more than two factors. The number 1 has only one factor, so it is neither.",
    terms: ["prime-number", "composite-number", "factor-pair"],
    method: [
      "Look for a factor pair other than 1 and the number. Try dividing by 2, 3, 5, 7 and 11 in turn; for numbers to 144, no prime above 11 is needed.",
      "If one divides evenly, the number is composite. If none does, it is prime.",
      "The number 1 is neither prime nor composite.",
    ],
    watch:
      "Odd numbers are not always prime: 51, 57, 87, 91 and 119 look prime but each has a factor pair, such as $91=7\\times13$.",
  },
  "prime-factorization-exponents": {
    goal: "Choose the prime factorization of a composite number, written with exponents for factors that repeat.",
    intuition:
      "Every composite number is a product of primes. A factor tree splits a number into two factors, then splits any factor that is not prime, until every branch ends in a prime.",
    terms: ["prime-factorization", "exponent", "factor-tree"],
    method: [
      "Split the number into any two factors greater than 1. Split every factor that is not prime.",
      "Stop when every branch ends in a prime. List the primes from least to greatest.",
      "Count how many times each prime appears. Write that count as an exponent, and leave off an exponent of 1.",
      "Check by multiplying the primes. The product must be the starting number.",
    ],
    watch:
      "An exponent counts equal factors; it does not multiply the base. $2^3=8$, not $2\\times3=6$. A product such as $4\\times9$ is a correct split but is not a prime factorization, because 4 and 9 are not prime.",
  },
  "prime-factorization-value": {
    goal: "Evaluate a prime factorization with exponents, find the greatest prime factor of a number, or count the primes in its factorization.",
    intuition:
      "A prime factorization is the number's building blocks. Reading it as a product recovers the number; reading its primes answers questions about the number.",
    terms: [
      [
        "prime-number",
        "A prime factor of a number is a prime that divides it evenly, such as 3 for 12.",
      ],
      "exponent",
    ],
    method: [
      "To evaluate, work out each power, then multiply the results.",
      "To find the greatest prime factor, split the number into primes and compare the different primes.",
      "To count prime factors, write the full product of primes and count every prime, including repeats.",
    ],
    watch:
      "When counting, $2\\times2\\times2\\times3$ has four prime factors, not two. When finding the greatest prime factor, a repeated prime is still one prime.",
  },
  "decimal-money-change": {
    goal: "Given prices and an amount paid in dollars and cents, find the change, the total, the amount still needed, or an unknown cost.",
    intuition:
      "Dollars and cents are a decimal: 3.45 dollars is 3 dollars and 45 hundredths of a dollar. Change is the part of the amount paid that is left after paying the price.",
    terms: ["change-money", "decimal-point"],
    method: [
      "Add the prices of everything bought. For equal items, multiply the price by how many.",
      "Subtract the total from the amount paid, lining up the decimal points so cents are subtracted from cents. Or count up from the price to the next whole dollar, then to the amount paid.",
      "To find an unknown cost, subtract the change from the amount paid. Check that cost plus change equals the amount paid.",
    ],
    watch:
      "Always show two digits after the point, such as 5.30 not 5.3. Line up the decimal points before adding or subtracting.",
  },
  "fewest-coins-change": {
    goal: "Find the fewest bills and coins that make an amount of change.",
    intuition:
      "The fewest pieces come from using big pieces first. With 1-dollar bills, quarters, dimes, nickels and pennies, take the largest piece that fits, then repeat with what is left.",
    terms: ["coin"],
    method: [
      "Write the amount in cents. For dollars and cents, 4.16 dollars is 416 cents.",
      "Take as many 1-dollar bills as fit, then as many quarters as fit in what is left, then dimes, nickels and pennies.",
      "Add the number of pieces used.",
    ],
    watch:
      "Do not start with pennies or dimes because they are easier to count. A quarter replaces 25 pennies, so using it first saves the most pieces.",
  },
  "compare-money-sets": {
    goal: "Read three drawn sets of bills and coins and choose the one worth the most, the least, or an exact amount.",
    intuition:
      "The value of a set depends on which pieces it has, not how many. Two quarters are worth more than five pennies.",
    terms: [
      [
        "dollar",
        "The value of a set of coins and bills is how much money it is worth.",
      ],
    ],
    method: [
      "Find each set's value separately. Count the 1-dollar bills, then the quarters, dimes, nickels and pennies.",
      "Write each value in dollars and cents and compare them place by place, starting with dollars.",
      "Choose the set that matches the question: greatest, least, or exactly the amount named.",
    ],
    watch:
      "A set with more pieces is not always worth more. Count what each piece is worth.",
  },
  "customary-unit-rename": {
    goal: "Rename a length, weight or capacity from a larger customary unit to a smaller one.",
    intuition:
      "A larger unit is made of many smaller ones, so the same amount takes more small units than large ones. To rename a measure in a smaller unit, multiply.",
    terms: ["customary-units", "capacity"],
    method: [
      "Write the fact that links the units, such as 1 foot = 12 inches.",
      "Multiply the number of large units by the number of small units in one large unit.",
      "Name the answer in the small unit. For two measures in different units, rename one so both use the same unit before comparing.",
    ],
    watch:
      "Multiply, do not divide, when changing to a smaller unit. The answer must be a larger number than the starting number.",
  },
  "customary-unit-reverse": {
    goal: "Rename a customary measure as a larger unit, find whole larger units, or convert across two steps.",
    intuition:
      "Going from a smaller unit to a larger one groups the small units. Count how many full groups fit; each group is one larger unit.",
    terms: ["remainder"],
    method: [
      "Write the fact that links the units, such as 1 pound = 16 ounces.",
      "Divide the number of small units by the number in one large unit.",
      "A remainder is a part of the larger unit; it does not add to the whole-unit count.",
      "For two steps, convert to the middle unit first, then to the last unit.",
    ],
    watch:
      "Divide when changing to a larger unit. In two steps, finish the first conversion before starting the second.",
  },
  "customary-mixed-units": {
    goal: "Rename a mixed measure such as 3 ft 8 in as one unit or the reverse, and add or subtract mixed measures.",
    intuition:
      "A mixed measure uses two units together. 3 ft 8 in is 3 feet and 8 more inches. Adding and subtracting works like regrouping in whole numbers, but you regroup by the unit fact, not by 10.",
    terms: ["mixed-measure", "regroup"],
    method: [
      "To write 3 ft 8 in in inches: multiply the feet by 12, then add the 8 inches.",
      "To write inches as feet and inches: divide by 12. The quotient is feet; the remainder is inches.",
      "To add: add the small units, regroup full larger units from them, then add the larger units.",
      "To subtract: if the small units cannot be subtracted, rename 1 larger unit as small units first.",
    ],
    watch:
      "Regroup by the number in the unit fact: 12 inches in a foot, 16 ounces in a pound, 4 quarts in a gallon, 8 fluid ounces in a cup. Do not regroup by 10.",
  },
  "customary-unit-choice": {
    goal: "Choose the customary unit that makes a measure reasonable for an everyday object.",
    intuition:
      "Each unit has a size you can picture. An inch is about the width of a thumb, a foot is a ruler, a yard is a long step, a mile is a 20-minute walk. An ounce is a slice of bread, a pound a loaf of bread, a ton a small car. A cup is a glass of milk, a gallon a jug of milk.",
    terms: [
      ["estimate", "A reasonable measure is close to the object's real size."],
    ],
    method: [
      "Picture the object and compare it with a benchmark you know, such as a ruler or a jug of milk.",
      "Decide whether the number with each unit would be far too large, far too small, or about right.",
      "Choose the unit that is about right. Use a unit of the right kind: length, weight or capacity.",
    ],
    watch:
      "The same number gives very different sizes in different units. 7 inches is a pencil; 7 miles is a long drive.",
  },
  "compatible-number-estimate": {
    goal: "Estimate a quotient or product by changing a number to a compatible number, and estimate a sum by its front-end digits.",
    intuition:
      "An estimate is a close answer that is quick to find. Compatible numbers are numbers close to the real ones that divide or multiply easily in your head. Front-end estimation adds only the leading digits.",
    terms: ["compatible-numbers", "front-end-estimation"],
    method: [
      "For division, list the multiples of the needed number near the dividend and choose the closest. Divide it by the divisor.",
      "For multiplication, change one factor to the closest compatible number, then multiply.",
      "For front-end estimation, keep the first digit of each number and make every other digit zero. Add the results.",
    ],
    watch:
      "Keep the place value. Replace later digits with zeros; do not drop them. An estimate is close to the exact answer, not equal to it.",
  },
  "benchmark-percent-estimate": {
    goal: "Round a price, then use 10%, 5% and 25% to estimate a tip, tax, discount or sale price.",
    intuition:
      "A percent means 'per 100'. 10% is one tenth, 5% is half of that, and 25% is one fourth. With a rounded price these are easy to find in your head.",
    terms: [
      "benchmark-percent",
      "discount",
      [
        "discount",
        "The sale price is the price after the discount: price minus discount.",
      ],
    ],
    method: [
      "Round the price as directed.",
      "Find 10% by dividing by 10. Find 5% by halving 10%. Find 15% by adding 10% and 5%. Find 20% by doubling 10%. Find 25% by dividing by 4.",
      "For a sale price, subtract the discount from the rounded price.",
    ],
    watch:
      "15% is not $15. And a discount is the amount taken off; the sale price is what remains.",
  },
};

export const k8StateNumberPrinciples: Record<string, string> = {
  "divisibility-rule-check":
    "Since $10\\equiv1\\pmod 9$ and $\\pmod 3$, a whole number leaves the same remainder as its digit sum when divided by 3 or 9. Since 100 is a multiple of 4, only the last two digits affect divisibility by 4. A number is divisible by 6 exactly when it is divisible by both 2 and 3.",
  "prime-composite-sort":
    "A prime has exactly two positive factors. A composite $n>1$ has a factor pair $a\\times b=n$ with $1<a\\le b<n$, and then $a\\le\\sqrt n$. So testing the primes up to $\\sqrt n$ decides whether $n$ is prime.",
  "prime-factorization-exponents":
    "Every whole number greater than 1 is a product of primes, and the product is unique except for order. Writing repeated primes with exponents gives the factorization $p_1^{e_1}p_2^{e_2}\\cdots p_k^{e_k}$ with $p_1<p_2<\\cdots<p_k$.",
  "prime-factorization-value":
    "For primes $p_1<\\cdots<p_k$ and positive exponents $e_i$, the number $p_1^{e_1}\\cdots p_k^{e_k}$ has $e_1+\\cdots+e_k$ prime factors counting repeats and $k$ different prime factors. The greatest prime factor is $p_k$.",
  "decimal-money-change":
    "A dollar is 100 cents, so $a$ dollars and $b$ cents is $a+b/100$ dollars. Change equals amount paid minus total cost, and cost plus change equals amount paid. Decimal addition and subtraction combine equal place values.",
  "fewest-coins-change":
    "With denominations 100, 25, 10, 5 and 1 cents, taking the largest denomination that fits at every step uses the fewest pieces. This greedy method is not valid for every set of denominations; it is valid for this one.",
  "compare-money-sets":
    "The value of a set is the sum of the values of its pieces: dollars, quarters (25 cents), dimes (10 cents), nickels (5 cents) and pennies (1 cent). Sets are compared by value, not by number of pieces.",
  "customary-unit-rename":
    "A conversion fact such as 1 foot = 12 inches means a measure of $n$ feet equals $12n$ inches. To rename a measure in a smaller unit, multiply by the number of small units in one large unit.",
  "customary-unit-reverse":
    "If one large unit equals $k$ small units, then $m$ small units make $\\lfloor m/k\\rfloor$ whole large units with remainder $m-k\\lfloor m/k\\rfloor$ small units. A two-step conversion multiplies the two conversion factors.",
  "customary-mixed-units":
    "If one large unit equals $k$ small units, the mixed measure $a$ large and $b$ small equals $ak+b$ small units. Sums and differences are computed in small units or by regrouping with $k$, keeping $0\\le b<k$.",
  "customary-unit-choice":
    "A measure is reasonable when its size, expressed in a unit you can picture, matches the object. Units of different kinds, such as capacity and length, cannot measure the same attribute.",
  "compatible-number-estimate":
    "An estimate replaces numbers by nearby numbers that make the calculation easy. Replacing $a$ by a multiple of the divisor $d$ makes $a\\div d$ a whole number; front-end estimation keeps the leading digit and place value of each addend.",
  "benchmark-percent-estimate":
    "For a base $B$, $10\\%$ of $B$ is $B/10$, $5\\%$ is $B/20$, $25\\%$ is $B/4$ and $50\\%$ is $B/2$. Other percents are sums or multiples of these. A discount of $p\\%$ leaves $(100-p)\\%$ of the price.",
};

export const k8StateNumberLessons: Lesson[] = [
  {
    id: "divisibility-rules",
    title: "Divisibility rules",
    summary:
      "A number is divisible by another when dividing leaves no remainder. Short digit checks decide this for 2, 3, 4, 5, 6, 9 and 10.",
    templateIds: ["divisibility-rule-check"],
    objectives: [
      "Use the rules for 2, 3, 4, 5, 6, 9 and 10 to decide whether a whole number is divisible.",
      "Find the digit that makes a number with one hidden digit divisible.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Check a few digits, not the whole division",
        paragraphs: [
          "A number is divisible by $d$ when dividing it by $d$ leaves remainder 0. Long division always shows this, but each of these numbers has a shortcut that looks at only some digits.",
          "2, 5 and 10 look at the last digit. 4 looks at the last two digits. 3 and 9 look at the digit sum, the total of all the digits. 6 needs both the 2 rule and the 3 rule.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is 4,512 divisible by 4? Is it divisible by 9?",
      steps: [
        "For 4, look at the last two digits: 12. Since $12=4\\times3$, the number is divisible by 4.",
        "For 9, add the digits: $4+5+1+2=12$. A number is divisible by 9 when its digit sum is, and 12 is not a multiple of 9.",
        "Check: $4,512\\div4=1,128$ with no remainder, and $4,512\\div9=501$ with remainder 3.",
      ],
      answer: "4,512 is divisible by 4 but not by 9.",
    },
    closingSections: [
      {
        stage: "method",
        title: "The rules and a hidden digit",
        paragraphs: [
          "2: last digit 0, 2, 4, 6 or 8. 5: last digit 0 or 5. 10: last digit 0. 4: last two digits divisible by 4. 3: digit sum divisible by 3. 9: digit sum divisible by 9. 6: even and divisible by 3.",
          "To find a hidden digit, add the visible digits. For 18▢ to be divisible by 9, the digit sum $1+8+{\\square}$ must be a multiple of 9. The visible digits add to 9, so the hidden digit must make the total 9 or 18: it is 0 or 9.",
        ],
      },
      {
        stage: "formal",
        title: "Why digit sums work",
        paragraphs: [
          "Each place value $10^k$ leaves remainder 1 when divided by 9, and also by 3. So a number leaves the same remainder as its digit sum. That is why the digit sum decides divisibility by 3 and by 9. 100 is a multiple of 4, so only the last two digits can change divisibility by 4.",
        ],
      },
    ],
    pitfalls: [
      "A digit sum divisible by 3 does not make a number divisible by 9; the sum must be divisible by 9.",
      "A number ending in 5 is divisible by 5 but not by 10.",
      "For 6, check both 2 and 3.",
    ],
    parentGuide:
      "Ask the learner to test 4,512 for 3, 4 and 9 and explain which digits each rule uses.",
  },
  {
    id: "prime-composite-factorization",
    title: "Prime numbers and prime factorization",
    summary:
      "A prime has exactly two factors. Every composite number is a product of primes, which a factor tree finds.",
    templateIds: [
      "prime-composite-sort",
      "prime-factorization-exponents",
      "prime-factorization-value",
    ],
    objectives: [
      "Decide whether a whole number to 144 is prime, composite or neither.",
      "Build a factor tree and write the prime factorization with exponents.",
      "Evaluate a factorization and find its greatest prime factor and number of prime factors.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Primes are the building blocks",
        paragraphs: [
          "A factor of a number divides it with no remainder. A prime number has exactly two factors, 1 and itself: 2, 3, 5, 7, 11 and 13 are prime. A composite number has more than two factors, such as 12. The number 1 has only one factor, so it is neither.",
          "Every composite number is a product of primes. A factor tree finds them: split the number into two factors, then split any factor that is not prime, until every branch ends in a prime.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Write the prime factorization of 72, using exponents for repeated factors.",
      steps: [
        "Split 72 into $8\\times9$. Neither 8 nor 9 is prime.",
        "Split 8 into $2\\times4$ and 4 into $2\\times2$, so $8=2\\times2\\times2$. Split 9 into $3\\times3$.",
        "Every branch now ends in a prime: $72=2\\times2\\times2\\times3\\times3$.",
        "The prime 2 appears three times and 3 appears twice, so $72=2^3\\times3^2$. Check: $8\\times9=72$.",
      ],
      answer: "$2^3\\times3^2$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Test for primes, then count the repeats",
        paragraphs: [
          "To test a number, look for a factor pair other than 1 and itself. Try dividing by 2, 3, 5, 7 and 11. If one divides evenly, the number is composite. 91 looks prime but $91=7\\times13$.",
          "To write a factorization, list the primes from least to greatest, count how many times each appears, and write the count as an exponent. Leave off an exponent of 1. The exponent $3$ in $2^3$ means three factors of 2, not $2\\times3$.",
          "Reading a factorization: $2^3\\times3^2=8\\times9=72$. It has $3+2=5$ prime factors counting repeats, and its greatest prime factor is 3.",
        ],
      },
      {
        stage: "formal",
        title: "Unique factorization",
        paragraphs: [
          "Every whole number greater than 1 is a product of primes, and the primes and how many times each appears are the same whatever factor tree you use. Only the order can change. To decide whether $n$ is prime, it is enough to test the primes up to $\\sqrt n$, because a factor pair has one factor no greater than $\\sqrt n$.",
        ],
      },
    ],
    pitfalls: [
      "A product like $4\\times9$ is a correct split of 36 but not a prime factorization; keep splitting until every factor is prime.",
      "An exponent counts repeated factors: $2^3=8$, not 6.",
      "1 is neither prime nor composite.",
    ],
    parentGuide:
      "Ask the learner to draw two different factor trees for 36 and show they end in the same primes.",
  },
  {
    id: "decimal-money-change",
    title: "Change and cost in dollars and cents",
    summary:
      "Money in dollars and cents is a decimal. Change is the amount paid minus the cost, and the fewest coins come from taking the largest piece first.",
    templateIds: ["decimal-money-change", "fewest-coins-change"],
    objectives: [
      "Find change, totals and unknown costs with decimal dollar amounts.",
      "Make change with the fewest bills and coins.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Dollars and cents are one decimal number",
        paragraphs: [
          "A dollar is 100 cents. An amount such as 3.45 dollars means 3 dollars and 45 cents; the two digits after the decimal point are the cents. Change is the money you get back: the amount paid minus the cost.",
          "One way to find change is to count up. From the price, count up to the next whole dollar, then up to the amount paid. The pieces you counted are the change.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A notebook costs 3.45 dollars. You pay with a 5-dollar bill. What is the change, and what is the fewest number of bills and coins for it?",
      steps: [
        "Count up from the price: $3.45+0.55=4.00$, then $4.00+1.00=5.00$.",
        "The change is $0.55+1.00=1.55$ dollars. Check by subtracting: $5.00-3.45=1.55$.",
        "Make 155 cents with the largest pieces first: one 1-dollar bill is 100 cents, leaving 55.",
        "Two quarters are 50 cents, leaving 5. One nickel makes 5. That is $1+2+1=4$ pieces.",
      ],
      answer:
        "1.55 dollars, made with 4 pieces: one 1-dollar bill, two quarters and one nickel.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Line up the cents and take the largest piece",
        paragraphs: [
          "Add the prices to get the total; for equal items, multiply the price by how many. Subtract the total from the amount paid, lining up the decimal points. To find an unknown cost, subtract the change from the amount paid.",
          "For the fewest pieces, take as many 1-dollar bills as fit, then quarters, dimes, nickels and pennies, each time the largest piece that fits in what is left. Using 25 pennies instead of one quarter wastes 24 pieces.",
        ],
      },
      {
        stage: "formal",
        title: "Why largest first works here",
        paragraphs: [
          "Cost plus change equals the amount paid. The value of $a$ dollars and $b$ cents is $a+b/100$ dollars. For the pieces worth 100, 25, 10, 5 and 1 cents, taking the largest piece that fits at every step gives the fewest pieces. This is true for these values; it is not true for every set of coin values.",
        ],
      },
    ],
    pitfalls: [
      "Write two digits for the cents: 5.30, not 5.3.",
      "Line up decimal points before subtracting.",
      "Start with the largest piece when making change, not the smallest.",
    ],
    parentGuide:
      "At a store, ask the learner to find the change from a bill, then say which bills and coins make it with the fewest pieces.",
  },
  {
    id: "compare-money-sets",
    title: "Compare sets of bills and coins",
    summary:
      "The value of a set depends on which pieces it has. Find each set's value in dollars and cents, then compare.",
    templateIds: ["compare-money-sets"],
    objectives: [
      "Find the value of a set of 1-dollar bills and coins.",
      "Compare sets by value, not by number of pieces.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count what each piece is worth",
        paragraphs: [
          "A 1-dollar bill is 100 cents, a quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent. A set with many pennies can be worth less than a set with a few quarters.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Set A has 1 dollar bill, 2 dimes and 3 pennies. Set B has 4 quarters and 1 nickel. Which is worth more?",
      steps: [
        "Set A: $100+20+3=123$ cents, which is 1.23 dollars.",
        "Set B: $4\\times25=100$, and $100+5=105$ cents, which is 1.05 dollars.",
        "Compare 1.23 and 1.05. The dollars are the same, and 23 hundredths is more than 5 hundredths.",
      ],
      answer: "Set A is worth more.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Value first, then compare",
        paragraphs: [
          "Count the bills first, then the coins from the largest to the smallest. Write each value in dollars and cents and compare dollars, then tenths, then hundredths. For an exact amount, find the set whose value matches it.",
        ],
      },
      {
        stage: "formal",
        title: "Value of a set",
        paragraphs: [
          "The value of a set is the sum of the values of its pieces: 100 cents for a 1-dollar bill, 25 for a quarter, 10 for a dime, 5 for a nickel and 1 for a penny. Two sets are compared by value, never by the number of pieces. Dollars and cents are written as a decimal, where $a$ dollars and $b$ cents is $a+b/100$ dollars.",
        ],
      },
    ],
    pitfalls: [
      "More pieces does not mean more money.",
      "Count each coin by its value, not by its size.",
    ],
    parentGuide:
      "Spill a handful of coins and ask the learner to find the total and say how they counted.",
  },
  {
    id: "customary-unit-conversion",
    title: "Customary units: rename and choose",
    summary:
      "Customary units measure length, weight and capacity. Rename larger units as smaller ones by multiplying, smaller as larger by dividing, and choose the unit that fits the object.",
    templateIds: [
      "customary-unit-rename",
      "customary-unit-reverse",
      "customary-unit-choice",
    ],
    objectives: [
      "Rename lengths, weights and capacities between customary units.",
      "Choose a reasonable customary unit for an object.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Bigger units, fewer of them",
        paragraphs: [
          "Customary units are the units used in the United States. For length: 12 inches make 1 foot, 3 feet make 1 yard, and 5,280 feet make 1 mile. For weight: 16 ounces make 1 pound, and 2,000 pounds make 1 ton. For capacity, how much a container holds: 8 fluid ounces make 1 cup, 2 cups make 1 pint, 2 pints make 1 quart, and 4 quarts make 1 gallon.",
          "The same amount takes more small units than large units. Renaming a measure as a smaller unit makes the number larger, so multiply. Renaming it as a larger unit makes the number smaller, so divide.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "How many cups are in 3 quarts? Use 1 quart = 2 pints and 1 pint = 2 cups.",
      steps: [
        "Rename quarts as pints: $3\\times2=6$ pints.",
        "Rename pints as cups: $6\\times2=12$ cups.",
        "Check by going back: $12\\div2=6$ pints and $6\\div2=3$ quarts.",
      ],
      answer: "12 cups",
    },
    closingSections: [
      {
        stage: "method",
        title: "Multiply to go smaller, divide to go larger",
        paragraphs: [
          "Write the fact that links the units. To go to a smaller unit, multiply by the number in one larger unit. To go to a larger unit, divide; the remainder is what is left over, not another whole unit. For two steps, finish one conversion before starting the next. To compare two measures, put both in the same unit.",
          "To choose a unit, picture the object: an inch is a thumb width, a foot is a ruler, a mile is a 20-minute walk; an ounce is a slice of bread, a pound is a loaf, a ton is a small car; a cup is a glass of milk, a gallon is a jug of milk. Pick the unit that makes the number about right.",
        ],
      },
      {
        stage: "formal",
        title: "Conversion facts",
        paragraphs: [
          "If one large unit equals $k$ small units, then $n$ large units equal $kn$ small units, and $m$ small units make $\\lfloor m/k\\rfloor$ whole large units with remainder $m-k\\lfloor m/k\\rfloor$ small units. Two conversions multiply their factors: 1 gallon = 4 quarts = 4 × 2 pints = 8 pints.",
        ],
      },
    ],
    pitfalls: [
      "Multiply to go to a smaller unit; divide to go to a larger one.",
      "Compare measures only after renaming them in one unit.",
      "Capacity units such as gallons cannot measure length or weight.",
    ],
    parentGuide:
      "In the kitchen, ask how many cups are in a quart and how they know.",
  },
  {
    id: "customary-mixed-units",
    title: "Mixed customary measures",
    summary:
      "A measure such as 3 ft 8 in uses two units. Rename it as one unit, rename inches as feet and inches, and add or subtract by regrouping with the unit fact.",
    templateIds: ["customary-mixed-units"],
    objectives: [
      "Rename a mixed measure as one unit and the reverse.",
      "Add and subtract mixed measures, regrouping by the unit fact.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two units in one measure",
        paragraphs: [
          "A mixed measure uses two units together. 3 ft 8 in is 3 feet plus 8 more inches. Because 1 foot is 12 inches, 3 feet is 36 inches, and 3 ft 8 in is 44 inches.",
          "Adding and subtracting works like regrouping with place value, except you regroup by the unit fact: 12 inches for a foot, 16 ounces for a pound, 4 quarts for a gallon, 8 fluid ounces for a cup, 3 feet for a yard.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Add 2 lb 9 oz and 1 lb 12 oz. Write the sum with fewer than 16 ounces.",
      steps: [
        "Add the ounces: $9+12=21$ oz.",
        "Since 16 oz make 1 lb, $21$ oz $=1$ lb $5$ oz.",
        "Add the pounds, including the regrouped pound: $2+1+1=4$ lb.",
        "The sum is 4 lb 5 oz. Check in ounces: $41+28=69$ and $4\\times16+5=69$.",
      ],
      answer: "4 lb 5 oz",
    },
    closingSections: [
      {
        stage: "method",
        title: "Regroup by the unit fact",
        paragraphs: [
          "To write feet and inches as inches: multiply the feet by 12, then add the inches. To write inches as feet and inches: divide by 12; the quotient is feet and the remainder is inches.",
          "To add: add the small units, regroup full larger units, then add the larger units. To subtract: if the small units cannot be subtracted, rename 1 larger unit as small units first. Example: 5 ft 3 in − 2 ft 8 in. Rename 5 ft 3 in as 4 ft 15 in, then subtract: 2 ft 7 in.",
        ],
      },
      {
        stage: "formal",
        title: "Why regrouping uses the unit fact",
        paragraphs: [
          "If one large unit equals $k$ small units, the mixed measure $a$ large and $b$ small equals $ak+b$ small units, where $0\\le b<k$. Dividing $m$ small units by $k$ gives the large units as the quotient and the small units as the remainder. Adding and subtracting regroup by $k$, the way whole-number arithmetic regroups by 10.",
        ],
      },
    ],
    pitfalls: [
      "Regroup by the unit fact, not by 10.",
      "After regrouping to subtract, reduce the larger unit by 1.",
      "Write the sum with the small unit less than one larger unit.",
    ],
    parentGuide:
      "Measure a table with a tape measure in feet and inches and ask the learner to write it in inches only.",
  },
  {
    id: "compatible-number-estimate",
    title: "Estimate with compatible and front-end numbers",
    summary:
      "An estimate is a close answer that is quick to find. Compatible numbers divide and multiply easily; front-end estimation adds the leading digits.",
    templateIds: ["compatible-number-estimate"],
    objectives: [
      "Estimate a quotient or product with compatible numbers.",
      "Estimate a sum by its front-end digits.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Change a number to make it easy",
        paragraphs: [
          "An estimate is close to the exact answer but easier to find. Compatible numbers are numbers near the real ones that are easy to compute with. To estimate $347\\div6$, change 347 to 360, because $360\\div6=60$. The estimate 60 is close to the exact answer, 57.8.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Estimate $347\\div6$ with compatible numbers: change 347 to the closest multiple of 60, then divide by 6.",
      steps: [
        "The multiples of 60 near 347 are 300 and 360. 347 is 13 from 360 and 47 from 300, so 360 is closer.",
        "Divide: $360\\div6=60$, since $6\\times60=360$.",
        "Check: $6\\times58=348$, close to 347, so an answer near 60 makes sense.",
      ],
      answer: "About 60",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three estimating moves",
        paragraphs: [
          "Division: list the multiples of the needed number near the dividend and choose the closest. Multiplication: change one factor to the closest number that makes the product easy, such as a multiple of 4 when multiplying by 25.",
          "Front-end estimation keeps the first digit of each number and replaces the other digits with zeros. For $8,071+7,193+8,248$ it adds $8,000+7,000+8,000=23,000$. The exact sum is 23,512.",
        ],
      },
      {
        stage: "formal",
        title: "What an estimate promises",
        paragraphs: [
          "An estimate replaces numbers by nearby numbers that make the calculation easy. Replacing the dividend by a multiple of the divisor $d$ makes the quotient a whole number. Front-end estimation keeps the leading digit and place value of each addend, so it never overestimates a sum of positive numbers. Estimates are close to the exact answer, and are not equal to it.",
        ],
      },
    ],
    pitfalls: [
      "Keep zeros so each number keeps its place value.",
      "An estimate is not the exact answer; it only needs to be close.",
    ],
    parentGuide:
      "At a store, ask the learner to estimate the total of three prices by keeping only the first digit of each.",
  },
  {
    id: "benchmark-percent-estimate",
    title: "Estimate a percent with benchmarks",
    summary:
      "10%, 5% and 25% are easy to find in your head. Round the price, then build tips, taxes and discounts from them.",
    templateIds: ["benchmark-percent-estimate"],
    objectives: [
      "Estimate a tip, tax or discount by rounding and using 10%, 5% and 25%.",
      "Estimate a sale price.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Percents from tenths and halves",
        paragraphs: [
          "A percent means per 100. 10% is one tenth, so divide by 10. 5% is half of 10%. 25% is one fourth, so divide by 4. Rounding the price first makes these easy.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A meal costs 38.40 dollars. Round to the nearest 10 dollars and estimate a 15% tip.",
      steps: [
        "38.40 dollars rounds to 40 dollars.",
        "10% of 40 is $40\\div10=4$. 5% is half of that: $4\\div2=2$.",
        "15% is 10% plus 5%: $4+2=6$.",
      ],
      answer: "About 6 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Build from the benchmarks",
        paragraphs: [
          "10%: divide by 10. 5%: half of 10%. 15%: 10% plus 5%. 20%: twice 10%. 25%: divide by 4. 50%: divide by 2.",
          "A discount is the amount taken off. The sale price is the price minus the discount. For 25% off 80 dollars, the discount is $80\\div4=20$ and the sale price is $80-20=60$ dollars.",
        ],
      },
      {
        stage: "formal",
        title: "Benchmarks from the base",
        paragraphs: [
          "For a base $B$, $10\\%$ of $B$ is $B/10$, $5\\%$ is $B/20$, $25\\%$ is $B/4$ and $50\\%$ is $B/2$. Other percents are sums or multiples of these, such as $15\\%=10\\%+5\\%$. A discount of $p\\%$ takes off $p\\%$ of the price and leaves $(100-p)\\%$ of it.",
        ],
      },
    ],
    pitfalls: [
      "15% is not 15 dollars. It is 15 out of every 100.",
      "Subtract the discount to get the sale price.",
    ],
    parentGuide:
      "At a restaurant, ask the learner to estimate a 10% tip, then double it for 20%.",
  },
];
