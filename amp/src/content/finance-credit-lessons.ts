import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const financeCreditMethods: Record<string, ProblemMethod> = {
  "interest-compare-years": {
    goal: "Compare a simple-interest account with a compound-interest account over several years, in exact cents.",
    intuition:
      "Interest is money the bank pays for holding your deposit. Simple interest is calculated on the original deposit only, so the same amount is added every year. Compound interest is calculated on the whole current balance, including interest already earned, so each year's addition is larger than the last.",
    terms: ["principal", "simple-interest", "compound-interest"],
    method: [
      "For simple interest, find one year's interest, principal times the rate, and multiply it by the number of years.",
      "For compound interest, repeat: this year's interest is the rate times the balance at the start of the year, rounded to the cent. Add it to get the new balance.",
      "Compare the balances at the same time, and subtract the smaller from the larger for the gap.",
    ],
    watch:
      "At the same rate, both accounts earn the same interest in year 1 and separate only from year 2, when compound interest starts earning interest on interest. With different rates, compare the actual balances.",
  },
  "loan-total-cost": {
    goal: "From a loan's equal payment and term, find total repaid and the finance charge, or compare terms and rates.",
    intuition:
      "Equal payments make total repaid grow in a straight line: every month adds the same payment. The amount you borrowed is only part of what you hand back. Whatever you pay beyond it is the price of borrowing.",
    terms: [
      "principal",
      ["loan", "The term is how many months or years the loan lasts."],
      "finance-charge",
    ],
    method: [
      "Put the term in months. A loan of $y$ years has $12y$ monthly payments.",
      "Total repaid = payment × number of payments.",
      "Finance charge = total repaid − amount borrowed. To compare two loans of the same amount, compare their totals.",
    ],
    watch:
      "A lower monthly payment can come with a longer term and a larger total cost. Always multiply by the number of months before comparing loans.",
  },
  "loan-compare-options": {
    goal: "Choose the cheaper of two loan offers by total paid, counting any upfront fee, and say by how much.",
    intuition:
      "A loan has two prices: how much you pay each month and how much you pay altogether. They can disagree, because stretching a loan over more months lowers each payment but adds more payments.",
    terms: [
      [
        "loan",
        "A fee is a charge paid at the start of the loan, on top of the payments.",
      ],
      ["loan", "The total cost of a loan is every payment plus any fee."],
    ],
    method: [
      "For each offer, compute payment × months, then add any fee.",
      "The offer with the smaller total costs less. Subtract the totals to say by how much.",
      "Judge a monthly-payment claim separately by comparing the payments themselves.",
    ],
    watch:
      "Do not choose by monthly payment or by interest rate alone: the term and fees change the total.",
  },
  "credit-card-balance": {
    goal: "From a card's balance, APR and payments, find the monthly interest and the balance over a few months, to the cent.",
    intuition:
      "A credit card lets you owe money. The balance is what you owe. APR, the annual percentage rate, is a yearly rate; the card charges one twelfth of it each month on the balance. Interest is added to the balance, so unpaid interest becomes debt that itself earns interest next month.",
    terms: [
      "apr",
      "balance-account",
      [
        "finance-charge",
        "On a credit card, it is the monthly rate times the balance at the start of the month.",
      ],
    ],
    method: [
      "Monthly rate = APR ÷ 12. Convert the percent to a decimal.",
      "Interest = monthly rate × balance at the start of the month. Round to the nearest cent.",
      "New balance = balance + interest − payment. Repeat with the new balance for the next month.",
    ],
    watch:
      "Interest uses the balance at the start of the month, before the payment. Each month's starting balance is different, so each month's interest is different.",
  },
  "credit-cost-concepts": {
    goal: "Turn a credit choice into numbers: rate conversion, interest on the unpaid part, card comparison, credit versus debit, fees.",
    intuition:
      "Credit is borrowed money, so it costs interest unless you repay in time. Debit spends money you already have, so it costs no interest. The numbers in a credit decision are rates, balances and fees, and each one has a plain arithmetic effect.",
    terms: [
      "debit-card",
      "minimum-payment",
      [
        "credit-card",
        "A late fee is a charge added to the balance when a payment arrives after the due date.",
      ],
    ],
    method: [
      "Convert between APR and monthly rate: APR is the monthly rate × 12.",
      "Interest is the monthly rate times the part of the balance left unpaid, rounded to the cent. Paying in full by the due date leaves nothing, so costs no interest here.",
      "Add charges (interest, purchases, fees) to the balance and subtract payments to get the new balance.",
    ],
    watch:
      "An APR is a yearly rate. Using it for one month overstates the interest twelve times.",
  },
  "savings-plan-growth": {
    goal: "From a starting amount and a regular monthly deposit, find a balance, the months to a goal, or the deposit needed.",
    intuition:
      "A saving plan with a regular deposit grows by the same amount every month, so its balance is a straight-line pattern. The starting amount is added once; the deposit is added again each month.",
    terms: [
      "deposit",
      ["balance-account", "The goal is the balance you want to reach."],
    ],
    method: [
      "Balance after $n$ months = starting amount + deposit × $n$.",
      "To reach a goal, divide the amount still needed, goal − start, by the deposit. Round up to a whole month, since deposits happen at month ends.",
      "Two plans are equal when the starting gap is made up: starting gap ÷ difference in deposits.",
    ],
    watch:
      "Count the starting amount once, and count one deposit for each month.",
  },
  "interest-table-type": {
    goal: "From two year-end balance tables, tell simple from compound interest, extend the simple account, or find one year's interest.",
    intuition:
      "A table shows the pattern. Simple interest adds the same amount every year, so the balances rise by equal steps. Compound interest adds more each year, so the steps themselves grow.",
    terms: [
      [
        "interest",
        "A year's interest is the balance at the end of that year minus the balance a year earlier.",
      ],
    ],
    method: [
      "Subtract each balance from the next one to find the yearly increases.",
      "If the increases are all equal, the account earns simple interest; if they grow, it earns compound interest.",
      "For simple interest, balance after $t$ years = principal + $t$ × the yearly increase.",
    ],
    watch:
      "Compare increases, not balances. Both tables start at the same amount and rise, so only the steps tell them apart.",
  },
};

export const financeCreditPrinciples: Record<string, string> = {
  "interest-compare-years":
    "With principal $P$ and yearly rate $r$ (as a decimal), simple interest gives balance $P(1+rt)$ after $t$ years: linear growth with constant step $Pr$. Compound interest added yearly multiplies the balance by $1+r$ each year: geometric growth $P(1+r)^t$ before cent rounding. At the same rate $r>0$ they agree at $t=1$, and for $t\\ge2$ the compound balance is larger.",
  "loan-total-cost":
    "For $n$ equal payments of size $p$ on a principal $P$, the total repaid is $T=pn$ and the finance charge is $pn-P$. Total repaid is a linear function of the number of payments, with rate $p$ dollars per month.",
  "loan-compare-options":
    "Offers on the same principal are ranked by total cost $pn+f$, where $p$ is the payment, $n$ the number of payments and $f$ any upfront fee. The ranking by payment $p$ and the ranking by total cost can differ.",
  "credit-card-balance":
    "With monthly rate $i=\\text{APR}/12$, starting balance $B$ and payment $p$, one month's interest is $iB$ and the next balance is $B+iB-p$, with interest rounded to the cent. Each month starts from the previous month's balance.",
  "credit-cost-concepts":
    "APR $=12i$ for monthly rate $i$. Interest on an unpaid amount $U$ for one month is $iU$. A balance changes by interest, purchases and fees (increases) and payments (decreases).",
  "savings-plan-growth":
    "With starting amount $S$ and deposit $d$ per month, the balance after $n$ deposits is $S+dn$, a linear function with slope $d$ and initial value $S$. It reaches goal $G$ after $\\lceil (G-S)/d\\rceil$ deposits when $d>0$.",
  "interest-table-type":
    "Simple interest has constant first differences $Pr$ between consecutive balances. Compound interest has growing first differences $P(1+r)^{t-1}r$ before rounding.",
};

const lesson = (
  l: Omit<Lesson, "sections" | "pitfalls" | "parentGuide"> & {
    titles: [string, string, string];
    intuition: string[];
    method: string[];
    formal: string[];
    pitfalls: string[];
    parentGuide: string;
  },
): Lesson => ({
  id: l.id,
  title: l.title,
  summary: l.summary,
  templateIds: l.templateIds,
  objectives: l.objectives,
  sections: [
    { stage: "intuition", title: l.titles[0], paragraphs: l.intuition },
  ],
  workedExample: l.workedExample,
  closingSections: [
    { stage: "method", title: l.titles[1], paragraphs: l.method },
    { stage: "formal", title: l.titles[2], paragraphs: l.formal },
  ],
  pitfalls: l.pitfalls,
  parentGuide: l.parentGuide,
});

export const financeCreditLessons: Lesson[] = [
  lesson({
    id: "interest-compare-years",
    titles: [
      "Interest on the deposit or on the balance",
      "Compute each balance, then compare",
      "Linear and exponential growth of a balance",
    ],
    title: "Simple and compound interest side by side",
    summary:
      "Simple interest adds the same amount each year; compound interest adds more each year because it also earns interest on earlier interest.",
    templateIds: ["interest-compare-years"],
    objectives: [
      "Find the balance of a simple-interest account and a compound-interest account after several years.",
      "State which account holds more and the exact gap, rounding each year's interest to the cent.",
      "Read a table of year-end balances to tell the two kinds apart.",
    ],
    intuition: [
      "Interest is money an account pays you for keeping your deposit there. The principal is your original deposit. With simple interest, each year's interest is the yearly rate times the principal, so the same amount is added every year, and the balance rises in equal steps.",
      "With compound interest, each year's interest is added to the balance, and the next year's interest is figured on that larger balance. The steps get bigger each year. In year 1 the two accounts are equal; they separate after that.",
    ],
    workedExample: {
      prompt:
        "Two accounts each start with 1,000 dollars at 4% a year. Account S pays simple interest. Account C pays compound interest, with each year's interest rounded to the nearest cent. After 3 years, how much more does Account C hold?",
      steps: [
        "Account S earns 4% of 1,000 = 40 dollars each year, so after 3 years it holds 1,000 + 3 × 40 = 1,120 dollars.",
        "Account C, year 1: 4% of 1,000 = 40, balance 1,040. Year 2: 4% of 1,040 = 41.60, balance 1,081.60.",
        "Year 3: 4% of 1,081.60 = 43.264, which rounds to 43.26, so the balance is 1,124.86 dollars.",
        "The gap is 1,124.86 − 1,120 = 4.86 dollars.",
        "Check: the gap is the interest earned on interest: 1.60 in year 2 and 3.26 in year 3 (43.26 instead of 40), which together is 4.86.",
      ],
      answer: "4.86 dollars",
    },
    method: [
      "Simple interest: yearly interest = rate × principal. Balance = principal + years × yearly interest.",
      "Compound interest: repeat for each year. Interest = rate × the balance at the start of that year, rounded to the cent; new balance = old balance + interest.",
      "Compare the balances for the same number of years. Subtract for the gap. In a table, equal yearly increases mean simple interest and growing increases mean compound.",
    ],
    formal: [
      "With principal $P$ and yearly rate $r$ written as a decimal, simple interest gives the balance $P(1+rt)$ after $t$ years: a linear function of $t$ with constant yearly step $Pr$. Compound interest added yearly multiplies by $1+r$ each year, giving $P(1+r)^t$ before rounding to cents: an exponential function of $t$. At the same rate, both equal $P(1+r)$ at $t=1$, and for $t\\ge2$ and $r>0$ the compound balance is larger.",
    ],
    pitfalls: [
      "Do not use the original principal for every year of compound interest; use the current balance.",
      "A higher simple rate can beat a lower compound rate for a few years, so compute both balances for the years asked.",
      "A gap in balances equals the gap in interest earned only when both accounts start with the same principal.",
    ],
    parentGuide:
      "Ask the learner to say which account's yearly interest changes and why, then to find the interest each account earns in year 2.",
  }),
  lesson({
    id: "loan-total-cost",
    titles: [
      "What you hand back beyond what you borrowed",
      "From payments to finance charge",
      "Total repaid as a linear function",
    ],
    title: "The total cost of a loan",
    summary:
      "Total repaid is the monthly payment times the number of months; the finance charge is what is paid beyond the amount borrowed.",
    templateIds: ["loan-total-cost"],
    objectives: [
      "Find total repaid and the finance charge from a payment and a term.",
      "Compare two terms or two rates by their totals.",
      "Convert a term in years to monthly payments.",
    ],
    intuition: [
      "When you borrow, you get the principal, the amount borrowed, now and pay it back in equal monthly payments. Each payment adds the same amount to the total you have repaid, so total repaid is the payment times the number of payments.",
      "The finance charge is the total repaid minus the principal. It is the price of borrowing. Raising the rate raises the payment; stretching the term lowers the payment but adds more payments.",
    ],
    workedExample: {
      prompt:
        "A loan of 8,000 dollars is repaid with 48 monthly payments of 188 dollars. How much is the finance charge?",
      steps: [
        "Total repaid = 48 × 188 = 9,024 dollars.",
        "Finance charge = total repaid − principal = 9,024 − 8,000 = 1,024 dollars.",
        "Check: 48 × 188 = 48 × 200 − 48 × 12 = 9,600 − 576 = 9,024.",
      ],
      answer: "1,024 dollars",
    },
    method: [
      "Find the number of payments. For a term in years, multiply by 12.",
      "Total repaid = payment × number of payments.",
      "Finance charge = total repaid − principal. For two loans of the same principal, the difference in finance charges equals the difference in totals repaid.",
      "To find a missing payment, divide principal plus finance charge by the number of payments.",
    ],
    formal: [
      "For $n$ equal payments of $p$ on principal $P$, total repaid is $T=pn$ and the finance charge is $pn-P$. $T$ is a linear function of $n$ whose rate of change is $p$ dollars per month.",
    ],
    pitfalls: [
      "A longer loan has a lower payment but usually a larger total. Compare totals.",
      "Count payments, not years: monthly payments over $y$ years are $12y$.",
      "The finance charge excludes the principal. Subtract it.",
    ],
    parentGuide:
      "Ask: if the payment is smaller but the loan is twice as long, is the total cost smaller? Have the learner check with real numbers.",
  }),
  lesson({
    id: "loan-compare-options",
    titles: [
      "Monthly payment versus total cost",
      "Rank offers by total",
      "Why the two rankings can differ",
    ],
    title: "Choosing between two loans",
    summary:
      "Compare loan offers by total cost, payment times months plus any fee, not by monthly payment or rate alone.",
    templateIds: ["loan-compare-options"],
    objectives: [
      "Compute each offer's total and choose the cheaper one.",
      "Include an upfront fee in the total.",
      "Tell the lower monthly payment apart from the lower total cost.",
    ],
    intuition: [
      "Two loan offers for the same amount can look different in three ways: the monthly payment, the number of months, and a fee paid at the start. Each of these changes what you pay. The total cost adds them into one number you can compare.",
      "The offer with the smaller monthly payment is often the one with more months. More payments can add up to more money, even when each payment is smaller.",
    ],
    workedExample: {
      prompt:
        "Both offers lend 10,000 dollars. Offer 1 is 36 monthly payments of 310 dollars. Offer 2 is 60 monthly payments of 200 dollars. Which costs less in total, and by how much?",
      steps: [
        "Offer 1: 36 × 310 = 11,160 dollars.",
        "Offer 2: 60 × 200 = 12,000 dollars.",
        "Offer 1 costs 12,000 − 11,160 = 840 dollars less, even though Offer 2 has the lower monthly payment.",
      ],
      answer: "Offer 1, by 840 dollars",
    },
    method: [
      "For each offer, total = payment × number of months, plus any fee.",
      "Compare totals. The smaller total is the cheaper offer; the difference is how much cheaper.",
      "To judge payments, compare the monthly amounts alone. A claim about both needs both comparisons.",
    ],
    formal: [
      "For offers on the same principal, rank by total cost $pn+f$, where $p$ is the payment, $n$ the number of payments and $f$ any fee. Rankings by $p$ and by $pn+f$ can differ because $n$ and $f$ differ between offers.",
    ],
    pitfalls: [
      "A fee paid at the start is part of the cost. Add it once.",
      "Do not subtract monthly payments to find how much cheaper a loan is. Subtract totals.",
      "The lower interest rate does not guarantee the lower total if its term is longer.",
    ],
    parentGuide:
      "Ask the learner to compute both totals themselves and say what would have to change for the other offer to win.",
  }),
  lesson({
    id: "credit-card-balance",
    titles: [
      "Interest is charged on what you still owe",
      "Month by month from the APR",
      "Balance recurrence",
    ],
    title: "How a credit card balance changes",
    summary:
      "Each month a card adds interest on the balance at the start of the month; payments then reduce it.",
    templateIds: ["credit-card-balance"],
    objectives: [
      "Find a month's interest from an APR and a balance, rounded to the cent.",
      "Find the balance after a payment, and after two or three months.",
      "Find how much of a payment reduces the debt.",
    ],
    intuition: [
      "A credit card balance is the amount you owe. The card states an APR, an annual percentage rate. It charges one twelfth of the APR each month on the balance. If you only pay part, the unpaid amount and the interest stay on the balance, and next month's interest is figured on that.",
      "Part of each payment goes to the month's interest first. Only the rest reduces the debt, so a small payment on a large balance may barely lower it.",
    ],
    workedExample: {
      prompt:
        "A card has an APR of 18%. The balance at the start is 1,200.00 dollars and the owner pays 50 dollars at the end of each of two months, with no purchases. Interest is rounded to the nearest cent. What is the balance after the second payment?",
      steps: [
        "Monthly rate: 18% ÷ 12 = 1.5%.",
        "Month 1: interest = 1.5% of 1,200.00 = 18.00. Balance = 1,200.00 + 18.00 − 50 = 1,168.00.",
        "Month 2: interest = 1.5% of 1,168.00 = 17.52. Balance = 1,168.00 + 17.52 − 50 = 1,135.52.",
        "Check: the balance fell by 64.48 in two months, less than the 100 dollars paid, because 35.52 of the payments went to interest.",
      ],
      answer: "1,135.52 dollars",
    },
    method: [
      "Monthly rate = APR ÷ 12, as a decimal.",
      "Interest = monthly rate × balance at the start of the month, rounded to the nearest cent.",
      "New balance = starting balance + interest − payment. Use it as the next month's starting balance.",
      "The part of a payment that reduces debt = payment − interest.",
    ],
    formal: [
      "With monthly rate $i=\\text{APR}/12$, starting balance $B$ and payment $p$, interest is $iB$ rounded to the cent, and the next balance is $B+iB-p$. This is repeated month by month; the sequence of balances is not linear because $i B$ changes with $B$.",
    ],
    pitfalls: [
      "Do not use the APR as the monthly rate. Divide by 12 first.",
      "Interest is charged on the starting balance, before this month's payment.",
      "Each month's interest uses a new balance, so do not repeat the first month's interest.",
    ],
    parentGuide:
      "Ask the learner to find how much of the first payment went to interest and how much reduced the debt.",
  }),
  lesson({
    id: "credit-cost-concepts",
    titles: [
      "Credit costs interest on the unpaid part",
      "Turn a credit choice into numbers",
      "Rates, charges and payments",
    ],
    title: "What credit costs",
    summary:
      "Credit costs interest on what stays unpaid, plus fees; debit costs no interest. Each has an exact numeric effect.",
    templateIds: ["credit-cost-concepts"],
    objectives: [
      "Convert between an APR and a monthly rate.",
      "Find the interest from paying only a minimum, and the gap between two cards.",
      "Find the extra cost of credit over debit and a new balance with fees.",
    ],
    intuition: [
      "Credit means the card company pays now and you repay later, usually with interest. A debit card takes money straight from your own account, so there is no interest. If you pay a credit statement in full by its due date, this lesson treats the interest as zero. Interest applies only to the part left unpaid.",
      "The APR is a yearly rate. A card's monthly rate is the APR divided by 12, so the APR is 12 times the monthly rate.",
    ],
    workedExample: {
      prompt:
        "A statement balance is 800.00 dollars at an APR of 24%. Paying in full costs no interest. If the owner pays only the 25 dollar minimum, interest is charged for the month on the unpaid part, rounded to the nearest cent. How much more interest is that than paying in full?",
      steps: [
        "Monthly rate: 24% ÷ 12 = 2%.",
        "Unpaid part: 800.00 − 25 = 775.00 dollars.",
        "Interest: 2% of 775.00 = 15.50 dollars.",
        "Paying in full costs 0, so paying only the minimum costs 15.50 dollars more.",
      ],
      answer: "15.50 dollars",
    },
    method: [
      "APR is the monthly rate × 12; the monthly rate is APR ÷ 12.",
      "Interest = monthly rate × the part of the balance left unpaid, rounded to the nearest cent.",
      "To compare two cards, find each month's interest to the cent and subtract.",
      "New balance = balance + interest + purchases + fees − payments.",
    ],
    formal: [
      "If the monthly rate is $i$, APR $=12i$ in this simple convention. Interest on an unpaid amount $U$ for one month is $iU$. A balance is increased by interest, purchases and fees and decreased by payments.",
    ],
    pitfalls: [
      "Use the monthly rate for a monthly charge, never the yearly APR.",
      "Interest applies to the unpaid part, not the whole statement and not the payment.",
      "A fee is a charge: it increases the balance.",
    ],
    parentGuide:
      "Ask the learner to say, in numbers, how much more an item costs when bought on a card whose balance is carried for a month.",
  }),
  lesson({
    id: "savings-plan-growth",
    titles: [
      "Equal deposits make a straight-line balance",
      "Balance, time and deposit",
      "Savings balance as a linear function",
    ],
    title: "Saving toward a goal",
    summary:
      "A starting amount plus the same deposit each month grows in a straight line; use it to find a balance, a time or a deposit.",
    templateIds: ["savings-plan-growth"],
    objectives: [
      "Find a balance from a starting amount and monthly deposits.",
      "Find the months to a goal or the deposit needed.",
      "Compare two plans and find when they are equal.",
    ],
    intuition: [
      "A savings plan with a regular deposit adds the same amount every month. The starting amount is counted once. The balance after $n$ deposits is the starting amount plus $n$ times the deposit, so equal months add equal amounts: a straight-line pattern.",
      "This lesson counts no interest, so you can see how deposits alone build a balance.",
    ],
    workedExample: {
      prompt:
        "A plan starts with 150 dollars and adds 40 dollars at the end of each month. In how many whole months does the balance first reach at least 1,000 dollars?",
      steps: [
        "Still needed: 1,000 − 150 = 850 dollars.",
        "850 ÷ 40 = 21.25. After 21 deposits the balance is 150 + 840 = 990 dollars, which is less than 1,000.",
        "After 22 deposits it is 150 + 880 = 1,030 dollars, which is at least 1,000.",
      ],
      answer: "22 months",
    },
    method: [
      "Balance after $n$ deposits = start + deposit × $n$.",
      "Months to a goal: divide (goal − start) by the deposit and round up to a whole month.",
      "Deposit needed for $n$ months: (goal − start) ÷ $n$.",
      "Two plans are equal when the starting gap is made up: starting gap ÷ difference in monthly deposits.",
    ],
    formal: [
      "With starting amount $S$ and monthly deposit $d$, the balance after $n$ deposits is $B(n)=S+dn$, a linear function with initial value $S$ and rate $d$ dollars per month. For $d>0$ it first reaches the goal $G\\ge S$ at $n=\\lceil (G-S)/d\\rceil$.",
    ],
    pitfalls: [
      "Subtract the starting amount before dividing by the deposit.",
      "Round months up, never down: the goal is not reached until the next deposit.",
      "Count the starting amount once, not once per month.",
    ],
    parentGuide:
      "Ask the learner to make a goal for something they want and find out how many months a weekly or monthly amount would take.",
  }),
  lesson({
    id: "interest-table-type",
    titles: [
      "Look at the yearly increases",
      "Classify, extend, and read one year",
      "Differences of simple and compound balances",
    ],
    title: "Simple or compound? Read the table",
    summary:
      "Subtract neighbouring balances. Equal differences mean simple interest; growing differences mean compound interest.",
    templateIds: ["interest-table-type"],
    objectives: [
      "Tell simple from compound interest in a balance table.",
      "Extend the simple-interest account to a later year.",
      "Find the interest an account earns in one year.",
    ],
    intuition: [
      "A year's interest is how much the balance rises during that year: the balance at the end of the year minus the balance at the end of the year before.",
      "Simple interest rises by the same amount every year. Compound interest rises by more each year, because the interest is figured on a growing balance.",
    ],
    workedExample: {
      prompt:
        "Two accounts start with 1,000 dollars at the same rate, one simple and one compound. Year-end balances for years 0 to 3 are: Account A 1,000, 1,040, 1,080, 1,120; Account B 1,000, 1,040, 1,081.60, 1,124.86. Which account is simple, and what will it hold after 10 years?",
      steps: [
        "Account A rises 40, 40, 40: equal steps, so it pays simple interest.",
        "Account B rises 40, 41.60, 43.26: growing steps, so it pays compound interest.",
        "After 10 years Account A has earned 10 × 40 = 400 dollars, so it holds 1,000 + 400 = 1,400 dollars.",
      ],
      answer: "Account A, 1,400 dollars",
    },
    method: [
      "Subtract each balance from the next to find the yearly increases.",
      "Equal increases: simple. Growing increases: compound.",
      "Simple interest: balance after $t$ years = principal + $t$ × the yearly increase.",
      "A year's interest = the balance at its end minus the balance at the end of the previous year.",
    ],
    formal: [
      "Simple interest has constant first differences $Pr$ between consecutive balances. Compound interest has first differences $P(1+r)^{t-1}r$, which increase with $t$ when $r>0$. Cent rounding can change the last digit.",
    ],
    pitfalls: [
      "A balance is not the interest. Subtract to find the increase.",
      "Extending a simple account from year 3 to year 10 needs 7 more years of interest, or 10 years from the start; do not mix them.",
      "Compare steps, not totals: both accounts start equal and both rise.",
    ],
    parentGuide:
      "Ask the learner to write the yearly increases for each account and explain why one list stays the same and the other grows.",
  }),
];
