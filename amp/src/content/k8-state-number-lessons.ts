import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const k8StateNumberMethods: Record<string, ProblemMethod> = {
  "divisibility-rule-check": {
    goal: "Choose the number that is divisible by a given number, or the hidden digit that makes a number divisible.",
    intuition:
      "A digit is one of the symbols 0 to 9 we use to write numbers. A whole number is one of the numbers 0, 1, 2, 3 and so on. When you divide, the amount left over is called the remainder. A number is divisible by another when dividing leaves no remainder. 12 is divisible by 4, because 12 ÷ 4 = 3 with nothing left over. A divisibility rule is a quick check that looks at a few digits instead of dividing the whole number. Some rules use the digit sum: add up all the digits. For 4,512 the digit sum is 4 + 5 + 1 + 2 = 12. This works because each ten or hundred is a group of 9s with 1 left over. A multiple of 9 is 9 times a whole number: 0, 9, 18, 27 and so on. The box ▢ stands for a hidden digit.",
    terms: [
      "divisible-by",
      [
        "sum",
        "The digit sum adds all the digits of a number: for 4,512 it is $4 + 5 + 1 + 2 = 12$.",
      ],
    ],
    senses: { multiple: "multiple" },
    noLink: ["rule", "rules", "leaves"],
    method: [
      "Rules that look at the end: for 2, the last digit is 0, 2, 4, 6 or 8. For 5, it is 0 or 5. For 10, it is 0. For 4, the number made by the last two digits is divisible by 4.",
      "Rules that use the digit sum: for 3, the digit sum is divisible by 3. For 9, the digit sum is divisible by 9.",
      "For 6, the number must pass both the rule for 2 and the rule for 3.",
      "To find a hidden digit, add the digits you can see. Then find the digit that makes the total pass the rule.",
    ],
    watch:
      "A digit sum divisible by 3 only shows the number is divisible by 3. For 9, the digit sum itself must be divisible by 9. A number ending in 5 is divisible by 5 but not by 10.",
  },
  "prime-composite-sort": {
    goal: "Given four whole numbers, choose the prime one, the composite one, or the one that is neither.",
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. A factor of a number is a number that divides it with nothing left over. The factors of 6 are 1, 2, 3 and 6. A factor pair is two factors that multiply to make the number, like 2 × 3 = 6. A prime number has exactly two factors, 1 and itself: 7 is prime. A composite number is a whole number bigger than 1 with more than two factors: 6 is composite. The number 1 has only one factor, itself, so it is neither prime nor composite.",
    terms: ["prime-number", "composite-number", "factor-pair"],
    senses: { factor: "factor-number", "more than": "more-than" },
    method: [
      "Look for a factor pair other than 1 and the number. Try dividing by 2, 3, 5, 7 and 11 in turn, but only by primes smaller than the number. For numbers up to 144, you never need a prime bigger than 11.",
      "If one of them divides with nothing left over, the number is composite. If none does, and the number is bigger than 1, it is prime.",
      "The number 1 is neither prime nor composite.",
    ],
    watch:
      "An odd number is not always prime. 51, 57, 87, 91 and 119 look prime, but each has a factor pair, such as $91=7\\times13$.",
  },
  "prime-factorization-exponents": {
    goal: "Choose the prime factorization of a composite number, written with exponents for factors that repeat.",
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. A factor is a number you multiply to make another number: 2 × 6 = 12, so 2 and 6 are factors of 12. The answer to a multiplication is called the product. A prime number has exactly two factors, 1 and itself, like 2, 3, 5 and 7. A composite number is a whole number bigger than 1 with more than two factors. Every composite number can be written as primes multiplied together. That is its prime factorization: 12 = 2 × 2 × 3. A factor tree finds it. Split the number into two factors, then split any factor that is not prime, until every branch ends in a prime. A repeated prime can be written with an exponent: 2 × 2 × 2 is $2^3$, read “2 to the third power.” The small 3 is the exponent. It counts how many 2s are multiplied.",
    terms: ["prime-factorization", "exponent", "factor-tree"],
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      base: "base-exponent",
      "more than": "more-than",
    },
    noLink: ["change", "third"],
    method: [
      "Split the number into any two factors bigger than 1. Split every factor that is not prime.",
      "Stop when every branch ends in a prime. List the primes from least to greatest.",
      "Count how many times each prime appears, and write that count as an exponent. A prime that appears once gets no exponent.",
      "Check by multiplying the primes. The product, the answer to the multiplication, must be the starting number.",
    ],
    watch:
      "An exponent counts equal factors. It does not multiply the base, the big number. $2^3=2\\times2\\times2=8$, not $2\\times3=6$. Also, $4\\times9$ splits 36 correctly but is not a prime factorization, because 4 and 9 are not prime.",
  },
  "prime-factorization-value": {
    goal: "Evaluate a prime factorization with exponents, find the greatest prime factor of a number, or count the primes in its factorization.",
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. A factor of a number is a number that divides it with nothing left over. The answer to a multiplication is called the product. A prime number has exactly two factors, 1 and itself, like 2, 3, 5 and 7. A number's prime factorization writes it as primes multiplied together: 12 = 2 × 2 × 3. A repeated prime can be written with an exponent: $2^3$, read “2 to the third power,” means 2 × 2 × 2 = 8. The small 3 is the exponent. It counts how many 2s are multiplied. To evaluate a factorization means to multiply it out and find the number. A prime factor of a number is a prime that divides it with nothing left over.",
    terms: [
      [
        "prime-number",
        "A prime factor of a number is a prime that divides it evenly, such as 3 for 12.",
      ],
      "exponent",
    ],
    senses: { factor: "factor-number", product: "product-multiply" },
    noLink: ["third"],
    method: [
      "To evaluate, work out each power first, like $2^3=8$. Then multiply the results.",
      "To find the greatest prime factor, split the number into primes. Then compare the different primes.",
      "To count the prime factors, write out the full product of primes, the primes multiplied together. Count every prime, including repeats.",
    ],
    watch:
      "When counting, $2\\times2\\times2\\times3$ has four prime factors, not two. When finding the greatest prime factor, a repeated prime is still just one prime.",
  },
  "decimal-money-change": {
    goal: "Given prices and an amount paid in dollars and cents, find the change, the total, the amount still needed, or an unknown cost.",
    intuition:
      "A cent is the smallest amount of US money, and 1 dollar is 100 cents. We write 3 dollars and 45 cents as 3.45 dollars. The dot is called the decimal point. A digit is one of the symbols 0 to 9, and the two digits after the point are the cents. The total is all the prices added together. Change is the money you get back. It is the amount you paid minus the cost. Minus means take away. For 2 things at 40 cents each, 2 × 0.40 means 0.40 + 0.40. The sign × means times: equal amounts added together.",
    terms: ["change-money", "decimal-point"],
    senses: { change: "change-money", difference: "difference-subtract" },
    method: [
      "Add the prices of everything bought. For items that cost the same, multiply the price by how many.",
      "Subtract, or take away, the total from the amount paid. Write one amount under the other with the decimal points lined up, so cents are under cents. Or count up from the cost to the amount paid.",
      "To find a cost you do not know, subtract the change from the amount paid. Check: cost plus change is the amount paid.",
    ],
    watch:
      "Always write two digits after the point, such as 5.30, not 5.3. Line up the decimal points before you add or subtract.",
  },
  "fewest-coins-change": {
    goal: "Find the fewest bills and coins that make an amount of change.",
    intuition:
      "Change is the money you get back after you pay. A coin is a round metal piece of money, and a cent is the smallest amount of US money. A 1-dollar bill is 100 cents. A quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent. 4.16 dollars means 4 dollars and 16 cents, which is 416 cents. To use the fewest pieces, take the piece worth the most that is not more than what is left. Then do it again with what is left.",
    terms: ["coin"],
    senses: { change: "change-money" },
    noLink: ["quarter", "quarters", "one quarter"],
    method: [
      "Write the amount in cents. 4.16 dollars is 416 cents.",
      "The question says which pieces you may use: 1-dollar bills and the four coins, or just the coins. Take as many of the biggest piece as fit, then as many quarters as fit in what is left. Then dimes, nickels and pennies.",
      "Add up how many pieces you used.",
    ],
    watch:
      "Start with the biggest piece that fits, not with pennies. One quarter does the job of 25 pennies.",
  },
  "compare-money-sets": {
    goal: "Read three drawn sets of bills and coins and choose the one worth the most, the least, or an exact amount.",
    intuition:
      "A set is a group of bills and coins. A coin is a round metal piece of money, and a cent is the smallest amount of US money. A set's value is how much money it is worth. We write 87 cents as 0.87 dollars: the 0 means no whole dollars, and the two digits after the dot are the cents. A 1-dollar bill is 100 cents. A quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent. The value depends on what each piece is worth, not just on how many pieces there are. Two quarters, 50 cents, are worth more than five pennies, 5 cents.",
    terms: [
      [
        "dollar",
        "The value of a set of coins and bills is how much money it is worth.",
      ],
    ],
    senses: { "more than": "more-than" },
    noLink: ["quarter", "quarters"],
    method: [
      "Find each set's value on its own. Count the 1-dollar bills, then the quarters, dimes, nickels and pennies.",
      "Write each value in dollars and cents. The set with more whole dollars is worth more. If the dollars match, the set with more cents is worth more.",
      "Choose the set the question asks for: worth the most, the least, or exactly the amount named.",
    ],
    watch:
      "A set with more pieces is not always worth more. Count what each piece is worth.",
  },
  "customary-unit-rename": {
    goal: "Rename a length, weight or capacity from a larger customary unit to a smaller one.",
    intuition:
      "A unit is a fixed amount we measure with, like an inch or a cup. Customary units are the units used in the United States. Capacity is how much a container holds. A big unit is made of many small units: 1 foot is 12 inches. So the same amount takes more small units than big ones. To rename a measure, or write it another way, in a smaller unit, multiply.",
    terms: ["customary-units", "capacity"],
    senses: { unit: "unit", rename: "rename", "more than": "more-than" },
    noLink: ["change"],
    method: [
      "Write the fact that links the units, such as 1 foot = 12 inches.",
      "Multiply the number of big units by the number of small units in one big unit.",
      "Name the answer in the small unit. To compare two measures in different units, first rename one so both use the same unit.",
    ],
    watch:
      "Multiply, do not divide, when you change to a smaller unit. For any amount more than 0, the answer is a bigger number than the one you started with.",
  },
  "customary-unit-reverse": {
    goal: "Rename a customary measure as a larger unit, find whole larger units, or convert across two steps.",
    intuition:
      "A unit is a fixed amount we measure with, like an ounce or a pound. Customary units are the units used in the United States. Going from a small unit to a big one groups the small units: 16 ounces make 1 pound. Count how many full groups fit by dividing. Each full group is one big unit. What is left over is called the remainder. To convert means to change a measure to another unit.",
    terms: ["remainder"],
    senses: { unit: "unit", rename: "rename" },
    noLink: ["whole", "change"],
    method: [
      "Write the fact that links the units, such as 1 pound = 16 ounces.",
      "Divide the number of small units by the number in one big unit.",
      "A remainder is less than one big unit. It does not count as another whole unit.",
      "For two steps, convert to the middle unit first, then to the last unit.",
    ],
    watch:
      "Divide when you change to a larger unit. In two steps, finish the first change before you start the second.",
  },
  "customary-mixed-units": {
    goal: "Rename a mixed measure such as 3 ft 8 in as one unit or the reverse, and add or subtract mixed measures.",
    intuition:
      "A unit is a fixed amount we measure with, like a foot or an inch. A mixed measure is a measure that uses two units together. 3 ft 8 in means 3 feet and 8 more inches. Short forms: ft is feet, in is inches, lb is pounds, oz is ounces, gal is gallons and qt is quarts. 1 foot is 12 inches, so 3 feet is 3 × 12 = 36 inches, and 3 ft 8 in is 36 + 8 = 44 inches. The fact that links two units, like 1 foot = 12 inches, is called the unit fact. To regroup means to trade one big unit for small units, or small units for one big unit. You regroup by the unit fact, not by 10. The sum is the answer when you add, and the difference is the answer when you subtract. The sign < means is less than.",
    terms: [
      "mixed-measure",
      [
        "regroup",
        "With measures, trade by the unit fact, such as 1 foot for 12 inches, not by 10.",
      ],
    ],
    senses: {
      unit: "unit",
      rename: "rename",
      difference: "difference-subtract",
      part: "part",
    },
    method: [
      "To write 3 ft 8 in in inches, multiply the feet by 12. Then add the 8 inches.",
      "To write inches as feet and inches, divide by 12. The answer is the feet, and the remainder, what is left over, is the inches.",
      "To add, add the small units first. Trade each full group of small units for 1 big unit. Then add the big units.",
      "To subtract, if there are not enough small units, first trade 1 big unit for small units.",
    ],
    watch:
      "Regroup by the number in the unit fact: 12 inches in a foot, 16 ounces in a pound, 4 quarts in a gallon, 8 fluid ounces in a cup. Do not regroup by 10.",
  },
  "customary-unit-choice": {
    goal: "Choose the customary unit that makes a measure reasonable for an everyday object.",
    intuition:
      "A unit is a fixed amount we measure with. Each unit has a size you can picture. Length: an inch is about the width of a thumb, a foot is a ruler, a yard is a long step, and a mile is about a 20-minute walk. Weight: an ounce is a slice of bread, a pound is a loaf of bread, and a ton is a small car. Capacity, how much a container holds: a cup is a glass of milk, and a gallon is a big jug of milk. A measure is reasonable when it is close to the object's real size.",
    terms: [
      ["estimate", "A reasonable measure is close to the object's real size."],
    ],
    senses: { unit: "unit" },
    method: [
      "Picture the object. Compare it with a size you know, such as a ruler or a jug of milk.",
      "Decide whether each choice would be far too big, far too small or about right.",
      "Choose the one that is about right. Use a unit of the right kind: length, weight or capacity.",
    ],
    watch:
      "The same number gives very different sizes in different units. 7 inches is a pencil, but 7 miles is a long drive.",
  },
  "compatible-number-estimate": {
    goal: "Estimate a quotient or product by changing a number to a compatible number, and estimate a sum by its front-end digits.",
    intuition:
      "An estimate is a close answer that is quick to find. Compatible numbers are numbers close to the real ones that are easy to divide or multiply in your head. For 347 ÷ 6, use 360 instead of 347. 360 is 36 tens, and 36 tens ÷ 6 = 6 tens, so 360 ÷ 6 = 60. A digit is one of the symbols 0 to 9 we use to write numbers. Front-end estimation keeps only the first digit of each number and makes the other digits zeros. For 347 + 285, add 300 + 200 = 500. The zeros keep each digit in its place, so the 3 still means 300. A whole number is one of the numbers 0, 1, 2, 3 and so on. The answer when you divide is called the quotient, and the answer when you multiply is called the product. The answer when you add is the sum.",
    terms: ["compatible-numbers", "front-end-estimation"],
    senses: {
      multiple: "multiple",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["change", "scale"],
    method: [
      "For division, the question names a number, like 60. Its multiples are 60 times a whole number: 300, 360 and so on. Choose the multiple closest to the number being divided, then divide.",
      "For multiplication, change the number to the closest multiple the question names. Then multiply.",
      "For front-end estimation, keep the first digit of each number and make every other digit zero. Then add.",
    ],
    watch:
      "Replace the later digits with zeros. Do not drop them, or the place values change. An estimate is a close answer. It is usually not the exact answer.",
  },
  "benchmark-percent-estimate": {
    goal: "Round a price, then use 10%, 5% and 25% to estimate a tip, tax, discount or sale price.",
    intuition:
      "A percent means “per 100”: 10% is 10 out of every 100, which is one tenth, so divide by 10. 5% is half of 10%, and 25% is one fourth, so divide by 4. A discount is the amount taken off a price. Round the price first so these are easy to do in your head.",
    terms: [
      "benchmark-percent",
      "discount",
      [
        "discount",
        "The sale price is the price after the discount: price minus discount.",
      ],
    ],
    senses: {
      "one fourth": "fourth",
      multiples: "multiple",
      estimate: "estimate",
    },
    noLink: ["base", "leaves", "half", "fourth", "tenth"],
    method: [
      "Round the price as the question says.",
      "Find 10% by dividing by 10. Find 5% by halving 10%. Find 15% by adding 10% and 5%. Find 20% by doubling 10%. Find 25% by dividing by 4.",
      "For a sale price, subtract the discount from the rounded price.",
    ],
    watch:
      "15% is not 15 dollars. A discount is the amount taken off, and the sale price is what remains.",
  },
};

export const k8StateNumberPrinciples: Record<string, string> = {
  "divisibility-rule-check":
    "10 is 9 + 1, and 100 is 99 + 1. So each ten and each hundred leaves 1 over when you split it into 9s, or into 3s. That is why a number leaves the same remainder as its digit sum when you divide by 9 or by 3. 100 is 25 fours, so only the last two digits matter for 4. A number is divisible by 6 exactly when it is divisible by both 2 and 3.",
  "prime-composite-sort":
    "A prime has exactly two factors, 1 and itself. A composite number has a factor pair other than 1 and itself. To test a number, try dividing by the primes in order. You can stop once a prime times itself is bigger than the number, because a factor pair always has one factor no bigger than that.",
  "prime-factorization-exponents":
    "Every whole number bigger than 1 can be written as primes multiplied together. Every factor tree for a number ends in the same primes; only their order can change. Writing each repeated prime with an exponent, from the least prime to the greatest, gives one answer: $72 = 2^3 \\times 3^2$.",
  "prime-factorization-value":
    "In $2^3\\times3^2$ the exponents count the primes: there are $3+2=5$ prime factors, counting repeats, and 2 different primes. Its value is $8\\times9=72$, and its greatest prime factor is the biggest prime in it, 3.",
  "decimal-money-change":
    "A dollar is 100 cents, so 3 dollars and 45 cents is 3.45 dollars. Change is the amount paid minus the total cost, so the cost plus the change is the amount paid. To add or subtract dollars and cents, line up the decimal points so each place lines up with the same place.",
  "fewest-coins-change":
    "With pieces worth 100, 25, 10, 5 and 1 cents, taking the biggest piece that fits each time gives the fewest pieces. This works for these coins. It does not work for every set of coin values.",
  "compare-money-sets":
    "The value of a set is all its pieces' values added together: 100 cents for a 1-dollar bill, 25 for a quarter, 10 for a dime, 5 for a nickel and 1 for a penny. Sets are compared by value, not by how many pieces they have.",
  "customary-unit-rename":
    "A fact such as 1 foot = 12 inches means every foot is 12 inches, so 3 feet is 3 × 12 = 36 inches. To rename a measure in a smaller unit, multiply by the number of small units in one big unit.",
  "customary-unit-reverse":
    "If one big unit is 16 small units, divide the small units by 16. The answer is the number of whole big units, and the remainder is the small units left over: 50 ounces is 3 pounds and 2 ounces. A two-step change does one change after the other.",
  "customary-mixed-units":
    "If one big unit is 12 small units, then 3 big units and 8 small units is 3 × 12 + 8 = 44 small units. Add and subtract the small units first, regrouping by 12 instead of 10. In the answer, keep fewer small units than make one big unit.",
  "customary-unit-choice":
    "A measure is reasonable when its number and unit match the object's real size. A unit must measure the right thing: capacity units, like gallons, cannot measure length or weight.",
  "compatible-number-estimate":
    "An estimate swaps the numbers for close numbers that are easy to work with. Changing 347 to 360, a multiple of 6, makes 360 ÷ 6 easy. Front-end estimation keeps the first digit and its place value in each number you add.",
  "benchmark-percent-estimate":
    "For a base amount $B$, $10\\%$ of $B$ is $B \\div 10$, $5\\%$ is $B \\div 20$, $25\\%$ is $B \\div 4$ and $50\\%$ is $B \\div 2$. Other percents are built by adding or doubling these. A discount of $p\\%$ leaves $(100 - p)\\%$ of the price.",
};

export const k8StateNumberLessons: Lesson[] = [
  {
    id: "divisibility-rules",
    title: "Divisibility rules",
    summary:
      "When you divide, the amount left over is called the remainder. “Divisible by 4” means dividing by 4 leaves no remainder. 12 is divisible by 4, because 12 ÷ 4 = 3 exactly. A digit is one of the symbols 0 to 9. Quick checks on a few digits tell you this for 2, 3, 4, 5, 6, 9 and 10 without dividing.",
    templateIds: ["divisibility-rule-check"],
    noLink: ["rule", "rules"],
    senses: { multiple: "multiple", multiples: "multiple" },
    objectives: [
      "Use the rules for 2, 3, 4, 5, 6, 9 and 10 to decide whether a whole number is divisible.",
      "Find the digit that makes a number with one hidden digit divisible.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Check a few digits, not the whole division",
        paragraphs: [
          "A digit is one of the symbols 0 to 9 we use to write numbers. You can always divide to check for a remainder. But each of these numbers has a shortcut, called a divisibility rule, that uses the digits instead. Some rules look at the last digits. Others add up all the digits.",
          "For 2, 5 and 10, look at the last digit. For 4, look at the number made by the last two digits.",
          "For 3 and 9, find the digit sum: add up all the digits. For 6, the number must pass both the rule for 2 and the rule for 3.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is 4,512 divisible by 4? Is it divisible by 9?",
      steps: [
        "For 4, look at the number made by the last two digits: 12. Since $12=4\\times3$, 12 is divisible by 4, so 4,512 is too.",
        "For 9, add the digits: $4+5+1+2=12$. A number is divisible by 9 only when its digit sum is. 12 is not a multiple of 9, a number you get from 9 times a whole number: 0, 9, 18, 27 and so on. So 4,512 is not divisible by 9.",
        "Check by dividing: $4{,}512\\div4=1{,}128$ with no remainder. But $4{,}512\\div9$ gives 501 with remainder 3, because $9\\times501+3=4{,}512$.",
      ],
      answer: "4,512 is divisible by 4 but not by 9.",
    },
    closingSections: [
      {
        stage: "method",
        title: "The rules and a hidden digit",
        paragraphs: [
          "2: the last digit is 0, 2, 4, 6 or 8. 5: the last digit is 0 or 5. 10: the last digit is 0. 4: the last two digits make a number divisible by 4.",
          "3: the digit sum is divisible by 3. 9: the digit sum is divisible by 9. 6: the number is even, ending in 0, 2, 4, 6 or 8, and it is divisible by 3.",
          "To find a hidden digit, add the digits you can see. In 18▢ the box stands for one hidden digit, 0 to 9. For 18▢ to be divisible by 9, the digit sum $1+8+{\\square}$ must be a multiple of 9. The digits you can see add to 9, so the total can be anything from 9 to 18. Only 9 and 18 are multiples of 9 there. So the hidden digit is 0 or 9.",
        ],
      },
      {
        stage: "formal",
        title: "Why digit sums work",
        paragraphs: [
          "10 is 9 + 1, and 100 is 99 + 1. So each ten and each hundred is a group of 9s with 1 left over. That means a number leaves the same remainder as its digit sum when you divide by 9. The same is true for 3, because 9 is made of 3s.",
          "100 is 25 fours, so the hundreds and everything bigger always divide by 4. Only the last two digits can change whether a number is divisible by 4.",
        ],
      },
    ],
    pitfalls: [
      "A digit sum divisible by 3 does not make a number divisible by 9. The sum must be divisible by 9.",
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
      "A factor of a number is a number that divides it with nothing left over. A prime number has exactly two factors, 1 and itself. Every other whole number bigger than 1 can be built by multiplying primes. A factor tree is a drawing that finds those primes.",
    templateIds: [
      "prime-composite-sort",
      "prime-factorization-exponents",
      "prime-factorization-value",
    ],
    senses: {
      factor: "factor-number",
      product: "product-multiply",
    },
    objectives: [
      "Decide whether a whole number up to 144 is prime, composite or neither.",
      "Build a factor tree and write the prime factorization with exponents.",
      "Evaluate a factorization and find its greatest prime factor and number of prime factors.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Primes are the building blocks",
        paragraphs: [
          "A factor of a number divides it with nothing left over. The factors of 12 are 1, 2, 3, 4, 6 and 12. Two factors that multiply to make the number are a factor pair, like 3 × 4 = 12.",
          "A prime number has exactly two factors, 1 and itself: 2, 3, 5, 7, 11 and 13 are prime. A composite number is a whole number bigger than 1 with more than two factors, like 12. The number 1 has only one factor, so it is neither prime nor composite.",
          "Every composite number can be written as primes multiplied together. This is called its prime factorization. A factor tree finds it. Split the number into two factors. Then split any factor that is not prime, until every branch ends in a prime.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Write the prime factorization of 72, using exponents for repeated factors.",
      steps: [
        "Split 72 into two factors: $8\\times9$. Neither 8 nor 9 is prime, so keep splitting.",
        "Split 8 into $2\\times4$ and 4 into $2\\times2$, so $8=2\\times2\\times2$. Split 9 into $3\\times3$.",
        "Every branch now ends in a prime: $72=2\\times2\\times2\\times3\\times3$.",
        "An exponent counts how many times a prime repeats. 2 appears three times and 3 appears twice, so $72=2^3\\times3^2$. Check: $8\\times9=72$.",
      ],
      answer: "$2^3\\times3^2$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Test for primes, then count the repeats",
        paragraphs: [
          "To test a whole number from 2 to 144, look for a factor pair other than 1 and itself. Try dividing by the primes 2, 3, 5, 7 and 11 that are smaller than the number. If one divides with nothing left over, the number is composite. If none does, it is prime. 91 looks prime, but $91=7\\times13$.",
          "To write a factorization, list the primes from least to greatest. Count how many times each appears, and write the count as a small raised number called an exponent. $2^3$, read “2 to the third power,” means $2\\times2\\times2$, not $2\\times3$. A prime that appears once gets no exponent.",
          "Reading a factorization: $2^3\\times3^2=8\\times9=72$. It has $3+2=5$ prime factors counting repeats, and its greatest prime factor is 3.",
        ],
      },
      {
        stage: "formal",
        title: "Every tree ends the same way",
        paragraphs: [
          "Every whole number bigger than 1 is a prime or a product of primes. Whatever factor tree you draw, you end with the same primes, each the same number of times. Only the order can change.",
          "To test whether a number is prime, try the primes in order. You can stop once a prime times itself is bigger than the number. Suppose the number has a factor pair with both factors bigger than 1. The smaller factor times itself is no bigger than the number. That factor is a prime, or a prime divides it, so testing the primes finds one before you stop.",
        ],
      },
    ],
    pitfalls: [
      "$4\\times9$ splits 36 correctly, but it is not a prime factorization. Keep splitting until every factor is prime.",
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
      "A cent is the smallest amount of US money, and 1 dollar is 100 cents. We write 3 dollars and 45 cents as 3.45 dollars. Change is the money you get back when you pay. It is the amount you paid minus the cost.",
    templateIds: ["decimal-money-change", "fewest-coins-change"],
    senses: { change: "change-money" },
    noLink: ["quarter", "quarters"],
    objectives: [
      "Find change, totals and unknown costs in dollars and cents.",
      "Make change with the fewest bills and coins.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Dollars and cents in one number",
        paragraphs: [
          "In 3.45 dollars, the dot is called the decimal point. The number before it is the dollars. A digit is one of the symbols 0 to 9, and the two digits after the point are the cents. A coin is a round metal piece of money. A quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent.",
          "Change is the money you get back. It is the amount paid minus the cost.",
          "You can find change by counting up. Start at the cost. Count up to the next whole dollar, an amount with no cents, like 4.00. Then count up to the amount paid. What you counted is the change.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A notebook costs 3.45 dollars. You pay with a 5-dollar bill. What is the change? What is the fewest number of pieces that make it, using 1-dollar bills, quarters, dimes, nickels and pennies?",
      steps: [
        "Count up from the cost. 45 cents and 55 cents make 100 cents, a whole dollar, so $3.45+0.55=4.00$. Then 1 more dollar reaches 5: $4.00+1.00=5.00$.",
        "Add what you counted: $0.55+1.00=1.55$ dollars. Check by subtracting: $5.00-3.45=1.55$.",
        "1.55 dollars is 155 cents. Use the piece worth the most that is not more than what is left. One 1-dollar bill is 100 cents. That leaves 55 cents.",
        "Two quarters are 25 + 25 = 50 cents. A third quarter would be too much. That leaves 5 cents, and one nickel is 5 cents. That is $1+2+1=4$ pieces.",
      ],
      answer:
        "1.55 dollars, made with 4 pieces: one 1-dollar bill, two quarters and one nickel.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Line up the cents and take the largest piece",
        paragraphs: [
          "The total is the cost of everything together, so add the prices. For items that cost the same, multiply the price by how many. That is the same as adding the price that many times.",
          "Subtract the total from the amount paid. Line up the decimal points first. To find a cost you do not know, subtract the change from the amount paid.",
          "For the fewest pieces when you have only 1-dollar bills and coins, use the piece worth the most that is not more than what is left. A quarter is 25 cents, a dime is 10 cents, a nickel is 5 cents and a penny is 1 cent. Using 25 pennies instead of 1 quarter uses 24 extra pieces.",
        ],
      },
      {
        stage: "formal",
        title: "Why largest first works here",
        paragraphs: [
          "Cost plus change is the amount paid. So change is the amount paid minus the cost.",
          "With pieces worth 100, 25, 10, 5 and 1 cents, taking the biggest piece that fits gives the fewest pieces. This works for these coins. It does not work for every set of coins.",
        ],
      },
    ],
    pitfalls: [
      "Write two digits for the cents: 5.30, not 5.3.",
      "Line up the decimal points before you subtract.",
      "Start with the biggest piece when you make change, not the smallest.",
    ],
    parentGuide:
      "At a store, ask the learner to find the change from a bill. Then ask which bills and coins make it with the fewest pieces.",
  },
  {
    id: "compare-money-sets",
    title: "Compare sets of bills and coins",
    summary:
      "A set is a group of bills and coins. A coin is a round metal piece of money, and a cent is the smallest amount. A set's value is how much money it is worth. Find each set's value. Then compare: find which set is worth more, which is worth less, or if they are the same.",
    templateIds: ["compare-money-sets"],
    noLink: ["quarter", "quarters"],
    objectives: [
      "Find the value of a set of 1-dollar bills and coins.",
      "Compare sets by value, not by how many pieces they have.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count what each piece is worth",
        paragraphs: [
          "A 1-dollar bill is 100 cents. A quarter is 25 cents. A dime is 10 cents. A nickel is 5 cents. A penny is 1 cent.",
          "Count what each piece is worth, not how many pieces there are. A set with many pennies can be worth less than a set with a few quarters.",
          "We write 1 dollar and 23 cents as 1.23 dollars. The dot is called the decimal point. A digit is one of the symbols 0 to 9, and the two digits after the point are the cents.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Set A has 1 dollar bill, 2 dimes and 3 pennies. Set B has 4 quarters and 1 nickel. Which is worth more?",
      steps: [
        "Set A: the bill is 100 cents. The 2 dimes are 10 + 10 = 20 cents. The 3 pennies are 1 + 1 + 1 = 3 cents. Add them: $100+20+3=123$ cents, which is 1 dollar and 23 cents, or 1.23 dollars.",
        "Set B: 4 quarters are 25 + 25 + 25 + 25 = 100 cents. Add the nickel: $100+5=105$ cents. That is 1 dollar and 5 cents. Cents always get two digits, so we write 1.05 dollars.",
        "Compare 1.23 and 1.05. Both have 1 whole dollar, so look at the cents. 23 cents is more than 5 cents.",
      ],
      answer: "Set A is worth more.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Value first, then compare",
        paragraphs: [
          "Count the bills first. Then count the coins, starting with the one worth the most: quarters, dimes, nickels, then pennies.",
          "Write each value in dollars and cents. The set with more whole dollars is worth more. If the dollars match, compare the cents. For an exact amount, find the set whose value matches it.",
        ],
      },
      {
        stage: "formal",
        title: "Value of a set",
        paragraphs: [
          "The value of a set is all its pieces' values added together. A 1-dollar bill is 100 cents, a quarter 25, a dime 10, a nickel 5 and a penny 1.",
          "Two sets are compared by value, never by how many pieces they have.",
        ],
      },
    ],
    pitfalls: [
      "More pieces does not mean more money.",
      "Count each coin by its value, not by its size. A dime is smaller than a nickel, but it is worth more.",
    ],
    parentGuide:
      "Spill a handful of coins and ask the learner to find the total and say how they counted.",
  },
  {
    id: "customary-unit-conversion",
    title: "Customary units: rename and choose",
    summary:
      "A unit is a fixed amount we measure with, like an inch or a cup. Customary units are the units used in the United States. To rename a measure means to write the same amount in another unit. Multiply to go to a smaller unit. Divide to go to a larger unit.",
    templateIds: [
      "customary-unit-rename",
      "customary-unit-reverse",
      "customary-unit-choice",
    ],
    senses: { unit: "unit", rename: "rename" },
    noLink: ["whole"],
    objectives: [
      "Rename lengths, weights and capacities between customary units.",
      "Choose a reasonable customary unit for an object.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Bigger units, fewer of them",
        paragraphs: [
          "Length: 12 inches make 1 foot, 3 feet make 1 yard, and 5,280 feet make 1 mile. Weight: 16 ounces make 1 pound, and 2,000 pounds make 1 ton.",
          "Capacity is how much a container holds. 8 fluid ounces make 1 cup, 2 cups make 1 pint, 2 pints make 1 quart, and 4 quarts make 1 gallon.",
          "The same amount takes more small units than big units. So renaming a measure in a smaller unit makes the number bigger: multiply. Renaming it in a larger unit makes the number smaller: divide.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "How many cups are in 3 quarts? Use 1 quart = 2 pints and 1 pint = 2 cups.",
      steps: [
        "A pint is smaller than a quart, so multiply. Each quart is 2 pints: $3\\times2=6$ pints.",
        "A cup is smaller than a pint, so multiply again. Each pint is 2 cups: $6\\times2=12$ cups.",
        "Check by going back: $12\\div2=6$ pints, and $6\\div2=3$ quarts.",
      ],
      answer: "12 cups",
    },
    closingSections: [
      {
        stage: "method",
        title: "Multiply to go smaller, divide to go larger",
        paragraphs: [
          "Write the fact that links the units. To go to a smaller unit, multiply by the number in one bigger unit. To go to a larger unit, divide. The remainder, what is left over, is less than one more big unit.",
          "For two steps, finish one change before you start the next. To compare two measures, put both in the same unit first.",
          "To choose a unit, picture the object. An inch is a thumb width, a foot is a ruler, and a mile is about a 20-minute walk. An ounce is a slice of bread, a pound is a loaf, and a ton is a small car. A cup is a glass of milk, and a gallon is a big jug. Pick the unit that makes the number about right.",
        ],
      },
      {
        stage: "formal",
        title: "Conversion facts",
        paragraphs: [
          "If 1 big unit is 12 small units, then 3 big units are 3 × 12 = 36 small units. Going back, 40 small units make 3 whole big units, with 4 small units left over.",
          "Two changes in a row multiply: 1 gallon = 4 quarts = 4 × 2 pints = 8 pints.",
        ],
      },
    ],
    pitfalls: [
      "Multiply to go to a smaller unit. Divide to go to a larger one.",
      "Compare two measures only after writing them in the same unit.",
      "Capacity units, such as gallons, cannot measure length or weight.",
    ],
    parentGuide:
      "In the kitchen, ask how many cups are in a quart and how they know.",
  },
  {
    id: "customary-mixed-units",
    title: "Mixed customary measures",
    summary:
      "A unit is a fixed amount we measure with, like a foot or an inch. A mixed measure is a measure with two units together, like 3 ft 8 in: 3 feet and 8 inches. You can write it in one unit, or add and subtract two of them. You regroup with the unit fact, like 12 inches in a foot, not with 10.",
    templateIds: ["customary-mixed-units"],
    senses: {
      unit: "unit",
      rename: "rename",
      difference: "difference-subtract",
    },
    objectives: [
      "Rename a mixed measure as one unit and the reverse.",
      "Add and subtract mixed measures, regrouping by the unit fact.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two units in one measure",
        paragraphs: [
          "A unit is a fixed amount we measure with, like a foot or an inch. A mixed measure is a measure that uses two units together. 3 ft 8 in means 3 feet plus 8 more inches. The short forms are ft for feet, in for inches, lb for pounds and oz for ounces.",
          "The unit fact links the two units: 1 foot is 12 inches. So 3 feet is 36 inches, and 3 ft 8 in is 36 + 8 = 44 inches.",
          "Adding and subtracting work like regrouping in place value, where 10 ones make a ten. To regroup a measure means to trade 1 big unit for small units, or small units for 1 big unit. Use the unit fact: 12 inches for a foot, 16 ounces for a pound, 4 quarts for a gallon, 8 fluid ounces for a cup, 3 feet for a yard.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Add 2 lb 9 oz and 1 lb 12 oz. Write the sum with fewer than 16 ounces.",
      steps: [
        "Add the small units first, to see if they make another pound: $9+12=21$ oz.",
        "16 oz make 1 lb, so trade 16 of the ounces for 1 pound: $21$ oz $=1$ lb $5$ oz.",
        "Add the pounds, including the traded pound: $2+1+1=4$ lb.",
        "The sum is 4 lb 5 oz. Check in ounces: 2 lb 9 oz is $2\\times16+9=41$ oz, and 1 lb 12 oz is $16+12=28$ oz. $41+28=69$, and $4\\times16+5=69$.",
      ],
      answer: "4 lb 5 oz",
    },
    closingSections: [
      {
        stage: "method",
        title: "Regroup by the unit fact",
        paragraphs: [
          "To write feet and inches as inches, multiply the feet by 12. Then add the inches. To write inches as feet and inches, count the whole groups of 12. For 44 inches, 3 groups of 12 use 36 inches, and 8 inches are left over. So 44 inches is 3 ft 8 in.",
          "To add, add the small units first. Trade each full group for 1 big unit, then add the big units.",
          "To subtract, check the small units first. If there are not enough, trade 1 big unit for small units. Example: 5 ft 3 in − 2 ft 8 in. You cannot take 8 inches from 3 inches. So trade 1 foot for 12 inches: 5 ft 3 in is 4 ft 15 in. Then subtract inches from inches, 15 − 8 = 7, and feet from feet, 4 − 2 = 2. The answer is 2 ft 7 in.",
        ],
      },
      {
        stage: "formal",
        title: "Why regrouping uses the unit fact",
        paragraphs: [
          "If 1 big unit is 12 small units, then 3 big units and 8 small units is 3 × 12 + 8 = 44 small units. Dividing 44 by 12 goes back: 3 big units, with 8 small units left over.",
          "Adding and subtracting regroup by 12 here, the way place value regroups by 10. In the answer, keep fewer small units than make 1 big unit.",
        ],
      },
    ],
    pitfalls: [
      "Regroup by the unit fact, not by 10.",
      "After trading 1 big unit to subtract, the big units go down by 1.",
      "Write the answer with fewer small units than make 1 big unit.",
    ],
    parentGuide:
      "Measure a table with a tape measure in feet and inches. Ask the learner to write it in inches only.",
  },
  {
    id: "compatible-number-estimate",
    title: "Estimate with compatible and front-end numbers",
    summary:
      "An estimate is a close answer that is quick to find. Compatible numbers are close numbers that are easy to divide or multiply in your head. Front-end estimation keeps the first digit of each number and makes the other digits zeros, then adds: 347 + 285 becomes 300 + 200 = 500.",
    templateIds: ["compatible-number-estimate"],
    senses: {
      multiple: "multiple",
      multiples: "multiple",
      factor: "factor-number",
      product: "product-multiply",
    },
    objectives: [
      "Estimate a quotient or product with compatible numbers.",
      "Estimate a sum by its front-end digits.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Change a number to make it easy",
        paragraphs: [
          "An estimate is close to the exact answer but easier to find. Compatible numbers are numbers near the real ones that are easy to work with. A digit is one of the symbols 0 to 9 we use to write numbers.",
          "To estimate $347\\div6$, change 347 to 360. A whole number is one of the numbers 0, 1, 2, 3 and so on. A multiple of 6 is 6 times a whole number, and 360 is a multiple of 6. 360 is 36 tens, and 36 tens ÷ 6 = 6 tens. So $360\\div6=60$. The estimate, 60, is close to the exact answer, which is a bit less than 58.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Estimate $347\\div6$ with compatible numbers: change 347 to the closest multiple of 60, then divide by 6.",
      steps: [
        "60 is 6 × 10, so every multiple of 60 divides easily by 6. The multiples of 60 near 347 are 300 and 360. 347 is 13 away from 360 and 47 away from 300, so 360 is closer.",
        "Divide: $360\\div6=60$, because $6\\times60=360$.",
        "Check: $6\\times58=348$, which is close to 347. So an answer near 60 makes sense.",
      ],
      answer: "About 60",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three estimating moves",
        paragraphs: [
          "Division: the question names a number, like 60. Find its multiples near the number being divided, and choose the closest. Multiplication: change one number to a close number that is easy to multiply, such as a multiple of 4 when you multiply by 25.",
          "Front-end estimation keeps the first digit of each number and changes the other digits to zeros. For $8{,}071+7{,}193+8{,}248$ it adds $8{,}000+7{,}000+8{,}000=23{,}000$. The exact sum, the answer when you add, is 23,512.",
        ],
      },
      {
        stage: "formal",
        title: "What an estimate promises",
        paragraphs: [
          "An estimate swaps the numbers for close numbers that are easy to work with. Changing the number being divided to a multiple of the divisor, the number you divide by, makes the division come out even.",
          "Front-end estimation keeps the first digit and its place value in each number. It only drops amounts, so for adding whole numbers it never gives more than the exact sum. An estimate aims to be close to the exact answer. Sometimes it is exactly right, but usually it is not.",
        ],
      },
    ],
    pitfalls: [
      "Keep the zeros, so each digit stays in its place.",
      "Do not expect an estimate to be the exact answer. It only needs to be close.",
    ],
    parentGuide:
      "At a store, ask the learner to estimate the total of three prices by keeping only the first digit of each.",
  },
  {
    id: "benchmark-percent-estimate",
    title: "Estimate a percent with benchmarks",
    summary:
      "A percent is a number out of 100: 15% means 15 out of every 100. Some percents, called benchmarks, are easy to find in your head. 10% is one tenth, so divide by 10. 5% is half of 10%. 25% is one fourth, so divide by 4. Round the price first, then build a tip, a tax or a discount from these.",
    templateIds: ["benchmark-percent-estimate"],
    senses: {
      "one fourth": "fourth",
      multiples: "multiple",
      whole: "whole",
      estimate: "estimate",
    },
    noLink: ["base", "leaves", "half", "fourth", "tenth"],
    objectives: [
      "Estimate a tip, tax or discount by rounding the price and using 10%, 5% and 25%.",
      "Estimate a sale price, the price after a discount is taken off.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Percents from tenths and halves",
        paragraphs: [
          "A percent means “per 100”, and the sign % stands for it. So 10% means 10 out of every 100, which is one tenth of the whole amount. To find 10% of a price, divide by 10: 10% of 40 dollars is 4 dollars.",
          "5% is half of 10%, so halve it: 5% of 40 dollars is 2 dollars. 25% is 25 out of 100, which is one fourth, so divide by 4: 25% of 40 dollars is 10 dollars.",
          "An estimate is a number close to the exact answer, found quickly. Rounding the price first, such as 38.40 dollars to 40 dollars, makes these steps easy to do in your head.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A meal costs 38.40 dollars. Round to the nearest 10 dollars and estimate a 15% tip.",
      steps: [
        "Round first so the arithmetic is easy: 38.40 dollars is closest to 40 dollars.",
        "Find 10% by dividing by 10: $40 \\div 10 = 4$ dollars. Find 5% by halving that: $4 \\div 2 = 2$ dollars.",
        "15% is 10% plus 5%, so add them: $4 + 2 = 6$ dollars. The tip is about 6 dollars.",
      ],
      answer: "About 6 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Build from the benchmarks",
        paragraphs: [
          "10%: divide by 10. 5%: half of 10%. 15%: 10% plus 5%. 20%: twice 10%. 25%: divide by 4. 50%: divide by 2, because 50 out of 100 is one half.",
          "A discount is the amount taken off. The sale price is the price minus the discount. For 25% off 80 dollars, the discount is $80\\div4=20$ and the sale price is $80-20=60$ dollars.",
        ],
      },
      {
        stage: "formal",
        title: "Benchmarks from the base",
        paragraphs: [
          "Call the starting amount $B$, the base. Then $10\\%$ of $B$ is $B \\div 10$, $5\\%$ is $B \\div 20$, $25\\%$ is $B \\div 4$ and $50\\%$ is $B \\div 2$. Other percents are built by adding or doubling these, such as $15\\% = 10\\% + 5\\%$ and $20\\% = 2 \\times 10\\%$. A discount of $p\\%$ takes off $p\\%$ of the price and leaves $(100 - p)\\%$ of it.",
        ],
      },
    ],
    pitfalls: [
      "15% is not 15 dollars. It is 15 out of every 100 dollars, so 15% of 40 dollars is 6 dollars.",
      "A discount is the amount taken off. Subtract it from the price to get the sale price.",
    ],
    parentGuide:
      "At a restaurant, ask the learner to estimate a 10% tip, then double it for 20%.",
  },
];
