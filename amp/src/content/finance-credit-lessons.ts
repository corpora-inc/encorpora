import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const financeCreditMethods: Record<string, ProblemMethod> = {
  "interest-compare-years": {
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["whole"],
    goal: "Compare a simple-interest account with a compound-interest account over several years, in exact cents.",
    intuition:
      "Interest is the money a bank pays you for keeping your money there. The principal is the money you first put in. Simple interest is figured on the principal only, so the same amount is added every year. Compound interest is figured on the balance, the amount now in the account, including interest already earned. So each year adds more than the last.",
    terms: ["principal", "simple-interest", "compound-interest"],
    method: [
      "Simple interest: find one year's interest, the rate times the principal. Multiply it by the number of years and add the principal.",
      "Compound interest: for each year, find the rate times the balance at the start of that year, rounded to the cent. Add it to get the new balance.",
      "Compare the two balances after the same number of years. Subtract the smaller from the larger to find the gap.",
    ],
    watch:
      "With the same starting deposit and the same rate, both accounts earn the same interest in year 1. They separate from year 2 on. With different rates, work out both balances and compare.",
  },
  "loan-total-cost": {
    senses: { difference: "difference-subtract", "more than": "more-than" },
    goal: "From a loan's equal payment and length, find the total repaid and the finance charge, or compare loans.",
    intuition:
      "A loan is an amount of money you borrow and pay back later. The principal is the amount borrowed. With equal monthly payments, every month adds the same payment to the total you have repaid. Whatever you pay beyond the principal is called the finance charge: the price of borrowing.",
    terms: [
      "principal",
      ["loan", "The term is how many months or years the loan lasts."],
      "finance-charge",
    ],
    method: [
      "Count the payments. A loan of $y$ years has $12y$ monthly payments, 12 for each year.",
      "Total repaid = payment × number of payments.",
      "Finance charge = total repaid − amount borrowed. For two loans of the same amount, compare their totals.",
    ],
    watch:
      "A lower monthly payment can come with more months and a larger total. Always multiply by the number of months before comparing loans.",
  },
  "loan-compare-options": {
    senses: { change: "change" },
    goal: "Choose the cheaper of two loan offers by total paid, counting any upfront fee, and say by how much.",
    intuition:
      "A loan is an amount of money you borrow and pay back in monthly payments. It has two prices: the payment each month and the total you pay altogether. They can disagree. Spreading a loan over more months lowers each payment but adds more payments. An upfront fee is a charge paid once at the start.",
    terms: [
      [
        "loan",
        "A fee is a charge paid at the start of the loan, on top of the payments.",
      ],
      ["loan", "The total cost of a loan is every payment plus any fee."],
    ],
    method: [
      "For each offer, multiply the payment by the number of months. Then add any fee.",
      "The offer with the smaller total costs less. Subtract the two totals to say by how much.",
      "If a claim is about monthly payments, compare the payments themselves, separately.",
    ],
    watch:
      "Do not choose by the monthly payment or the interest rate alone. The number of months and any fee change the total.",
  },
  "credit-card-balance": {
    senses: { balance: "balance-account" },
    goal: "From a card's balance, APR and payments, find the monthly interest and the balance over a few months, to the cent.",
    intuition:
      "A credit card lets you buy now and pay later. The balance is the amount you owe. APR is short for annual percentage rate. It is a yearly interest rate. Each month the card charges one twelfth of it on the balance. That interest is added to what you owe, so next month's interest is figured on a bigger balance.",
    terms: [
      "apr",
      "balance-account",
      [
        "finance-charge",
        "Here the month's finance charge is its interest: the monthly rate times the balance at the start of the month.",
      ],
    ],
    method: [
      "Monthly rate = APR ÷ 12. Write the percent as a decimal.",
      "Interest = monthly rate × balance at the start of the month. Round to the nearest cent.",
      "New balance = balance + interest − payment. Use the new balance to start the next month.",
    ],
    watch:
      "Interest uses the balance at the start of the month, before the payment. Each month starts with a new balance, so each month's interest is usually different.",
  },
  "credit-cost-concepts": {
    senses: {
      balance: "balance-account",
      change: "change",
      difference: "difference-subtract",
      part: "part",
    },
    noLink: ["leaves", "whole"],
    goal: "Turn a credit choice into numbers: change the rate, find interest on the unpaid part, compare cards, and count fees.",
    intuition:
      "Credit is borrowed money: the card company pays now, and you pay it back later. It costs interest on any part you do not repay in time. A debit card is a card that spends money you already have, so it costs no interest. The balance is the amount you owe on a credit card. APR is a yearly rate, and the monthly rate is APR ÷ 12.",
    terms: [
      "debit-card",
      "minimum-payment",
      [
        "credit-card",
        "A late fee is a charge added to the balance when the minimum payment is not paid by the due date.",
      ],
    ],
    method: [
      "Switch between yearly and monthly rates. The APR is the monthly rate times 12. The monthly rate is the APR divided by 12.",
      "Interest = monthly rate × the part of the balance left unpaid, rounded to the cent. Paying in full by the due date leaves nothing unpaid, so no interest.",
      "Add charges (interest, purchases, fees) to the balance. Subtract payments. That gives the new balance.",
    ],
    watch:
      "An APR is a yearly rate. Using it for one month makes the interest twelve times too big.",
  },
  "savings-plan-growth": {
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["whole"],
    goal: "From a starting amount and a regular monthly deposit, find a balance, the months to a goal, or the deposit needed.",
    intuition:
      "A deposit is money you put into an account. The balance is how much the account holds. With the same deposit every month, the balance grows by the same amount each month. The starting amount is counted once. The deposit is added again every month.",
    terms: [
      "deposit",
      ["balance-account", "The goal is the balance you want to reach."],
    ],
    method: [
      "Balance after $n$ months = starting amount + deposit × $n$. Here $n$ stands for the number of months.",
      "To reach a goal, divide the amount still needed, goal − start, by the deposit. Round up to a whole month, because deposits come at the end of each month.",
      "The starting gap is how much more one plan starts with. If the other plan deposits more each month, it catches up after starting gap ÷ difference in deposits months.",
    ],
    watch:
      "Count the starting amount once, and count one deposit for each month.",
  },
  "interest-table-type": {
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      changes: "change",
    },
    goal: "From two year-end balance tables, tell simple from compound interest, extend the simple account, or find one year's interest.",
    intuition:
      "Interest is the money an account pays you, and the balance is how much the account holds. Simple interest adds the same amount every year, so the balances rise by equal steps. Compound interest adds more each year, because it pays interest on earlier interest too. So its steps grow.",
    terms: [
      [
        "interest",
        "A year's interest is the balance at the end of that year minus the balance a year earlier.",
      ],
    ],
    method: [
      "Subtract each balance from the next one. That gives the rise in each year.",
      "If the rises are all equal, the account earns simple interest. If they grow, it earns compound interest.",
      "For simple interest, balance after $t$ years = principal + $t$ × the yearly rise. Here $t$ stands for the number of years.",
    ],
    watch:
      "Compare the yearly rises, not the balances. Both tables start at the same amount and both go up, so only the rises tell them apart.",
  },
};

export const financeCreditPrinciples: Record<string, string> = {
  "interest-compare-years":
    "Let $P$ be the principal and $r$ the yearly rate as a decimal. Simple interest gives the balance $P(1+rt)$ after $t$ years: it grows by the same step $Pr$ each year. Compound interest added yearly multiplies the balance by $1+r$ each year, giving $P(1+r)^t$ before rounding to cents. Here $(1+r)^t$ means $t$ copies of $(1+r)$ multiplied together. At the same rate $r>0$ the two agree at $t=1$, and for $t\\ge2$ the compound balance is larger.",
  "loan-total-cost":
    "For $n$ equal payments of $p$ dollars on a principal of $P$ dollars, the total repaid is $T=pn$ and the finance charge is $pn-P$. The total repaid grows by $p$ dollars with each monthly payment.",
  "loan-compare-options":
    "Offers that lend the same amount are ranked by total cost $pn+f$, where $p$ is the payment, $n$ the number of payments and $f$ any upfront fee. Ranking by payment $p$ and ranking by total cost can give different winners.",
  "credit-card-balance":
    "Let the monthly rate be $i=\\text{APR}/12$, the starting balance $B$ and the payment $p$. One month's interest is $iB$, rounded to the cent, and the next balance is $B+iB-p$. Each month starts from the previous month's balance.",
  "credit-cost-concepts":
    "For a monthly rate $i$, the APR is $12i$. Interest on an unpaid amount $U$ for one month is $iU$. Interest, purchases and fees raise a balance, and payments lower it.",
  "savings-plan-growth":
    "With starting amount $S$ and a deposit of $d$ each month, the balance after $n$ deposits is $S+dn$. It grows by $d$ each month from the starting value $S$. When $d>0$ and the goal $G$ is more than $S$, it first reaches $G$ after $(G-S)/d$ deposits, rounded up if it is not an exact count.",
  "interest-table-type":
    "Simple interest rises by the same amount $Pr$ between neighbouring year-end balances. Compound interest rises by $P(1+r)^{t-1}r$ in year $t$, before rounding, which grows each year when $r>0$.",
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
  ...(l.senses ? { senses: l.senses } : {}),
  ...(l.noLink ? { noLink: l.noLink } : {}),
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
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      changes: "change",
    },
    noLink: ["mean", "whole"],
    titles: [
      "Interest on the deposit or on the balance",
      "Compute each balance, then compare",
      "Straight-line and multiplying growth of a balance",
    ],
    title: "Simple and compound interest side by side",
    summary:
      "Interest is the money a bank pays you for keeping your money there. The principal is the money you first put in. Simple interest pays on the principal only, so it adds the same amount every year. Compound interest pays on the whole balance, the amount now in the account, including interest already earned. So it adds a little more each year.",
    templateIds: ["interest-compare-years"],
    objectives: [
      "Find the balance, the amount in the account, for a simple-interest account and a compound-interest account after several years.",
      "Say which account holds more and by exactly how much, rounding each year's interest to the cent.",
      "Read a table of year-end balances to tell the two kinds of interest apart.",
    ],
    intuition: [
      "Put 1,000 dollars in an account that pays 4% a year. Percent means per hundred, so 4% of 1,000 is 4 for every 100, which is 40 dollars. That 40 dollars is interest: money the account pays you for keeping your money there. The 1,000 dollars you first put in is called the principal. The balance is how much the account holds.",
      "With simple interest, each year's interest is the yearly rate times the principal. So the same 40 dollars is added every year, and the balance rises in equal steps: 1,040, 1,080, 1,120.",
      "With compound interest, each year's interest is added to the balance. Next year's interest is then figured on that larger balance. So the steps grow: 40, then 41.60, then 43.26. In year 1 the two accounts earn the same. After that, compound interest pulls ahead.",
    ],
    workedExample: {
      prompt:
        "Two accounts each start with 1,000 dollars at 4% a year. Account S pays simple interest. Account C pays compound interest, with each year's interest rounded to the nearest cent. After 3 years, how much more does Account C hold?",
      steps: [
        "Account S earns interest on the principal only: 4% of 1,000 = 40 dollars each year. After 3 years it holds 1,000 + 3 × 40 = 1,120 dollars.",
        "Account C earns interest on its current balance. Year 1: 4% of 1,000 = 40, so the balance is 1,040. Year 2: 4% of 1,040 = 41.60, so the balance is 1,081.60.",
        "Year 3: 4% of 1,081.60 = 43.264. Round to the nearest cent: 43.26. So the balance is 1,081.60 + 43.26 = 1,124.86 dollars.",
        "Subtract to find the gap: 1,124.86 − 1,120 = 4.86 dollars.",
        "Check: the gap is the interest earned on earlier interest. That is 1.60 in year 2 and 3.26 in year 3 (43.26 instead of 40), and 1.60 + 3.26 = 4.86.",
      ],
      answer: "4.86 dollars",
    },
    method: [
      "Simple interest: yearly interest = rate × principal. Balance = principal + number of years × yearly interest.",
      "Compound interest: repeat for each year. Interest = rate × the balance at the start of that year, rounded to the cent. New balance = old balance + interest.",
      "Compare the balances after the same number of years, and subtract for the gap. In a table, equal yearly rises mean simple interest, and growing rises mean compound interest.",
    ],
    formal: [
      "Let $P$ be the principal and $r$ the yearly rate written as a decimal, so 4% is $r=0.04$. Simple interest gives the balance $P(1+rt)$ after $t$ years. It grows in a straight line, by the same step $Pr$ each year.",
      "Compound interest added yearly multiplies the balance by $1+r$ each year. That gives $P(1+r)^t$ before rounding to cents, where $(1+r)^t$ means $t$ copies of $(1+r)$ multiplied together. This is called exponential growth. At the same rate, both equal $P(1+r)$ at $t=1$. For $t\\ge2$ (2 or more years) and $r>0$, the compound balance is larger.",
    ],
    pitfalls: [
      "For compound interest, do not use the principal every year. Use the current balance.",
      "A higher simple rate can beat a lower compound rate for a few years. Work out both balances for the years asked.",
      "The gap in balances equals the gap in interest earned only when both accounts start with the same principal.",
    ],
    parentGuide:
      "Ask the learner which account's yearly interest changes, and why. Then ask them to find the interest each account earns in year 2.",
  }),
  lesson({
    id: "loan-total-cost",
    senses: {
      change: "change",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["term", "terms"],
    titles: [
      "What you pay back beyond what you borrowed",
      "From payments to finance charge",
      "Total repaid as a straight-line pattern",
    ],
    title: "The total cost of a loan",
    summary:
      "A loan is an amount of money you borrow now and pay back later. The principal is the amount you borrow. If you pay the same amount every month, the total you pay back is the payment times the number of months. The finance charge is the extra you pay beyond the principal. It is the price of borrowing.",
    templateIds: ["loan-total-cost"],
    objectives: [
      "Find the total repaid and the finance charge from a monthly payment and a term, the length of the loan.",
      "Compare two terms or two interest rates by their totals.",
      "Change a term in years into a number of monthly payments.",
    ],
    intuition: [
      "Suppose you borrow 1,000 dollars and pay back 100 dollars a month for 12 months. You pay back 12 × 100 = 1,200 dollars in all. That is 200 dollars more than you borrowed.",
      "The amount you borrow is called the principal. You pay it back in equal monthly payments. Each payment adds the same amount to the total you have repaid. So the total repaid is the payment times the number of payments.",
      "The finance charge is the total repaid minus the principal, here 1,200 − 1,000 = 200 dollars. It is the price of borrowing. Interest is the extra money a lender charges for a loan. For the same amount borrowed, a higher interest rate raises the payment. At the same rate, a longer term, the length of the loan, lowers the payment but adds more payments.",
    ],
    workedExample: {
      prompt:
        "A loan of 8,000 dollars is repaid with 48 monthly payments of 188 dollars. How much is the finance charge?",
      steps: [
        "Find the total repaid. There are 48 equal payments, so multiply: 48 × 188 = 9,024 dollars.",
        "The finance charge is what was paid beyond the amount borrowed: 9,024 − 8,000 = 1,024 dollars.",
        "Check the answer another way: 48 × 188 = 48 × 200 − 48 × 12 = 9,600 − 576 = 9,024.",
      ],
      answer: "1,024 dollars",
    },
    method: [
      "Find the number of payments. For a term in years, multiply by 12, since a year has 12 monthly payments.",
      "Total repaid = payment × number of payments.",
      "Finance charge = total repaid − principal. For two loans of the same principal, the difference in finance charges equals the difference in totals repaid.",
      "To find a missing payment, add the principal and the finance charge. Then divide by the number of payments.",
    ],
    formal: [
      "For $n$ equal payments of $p$ dollars on a principal of $P$ dollars, the total repaid is $T=pn$, meaning $p$ times $n$. The finance charge is $pn-P$. The total $T$ grows in a straight line: each extra payment adds $p$ dollars.",
    ],
    pitfalls: [
      "A longer loan has a lower payment but usually a larger total. Compare totals.",
      "Count payments, not years. Monthly payments over $y$ years number $12y$, 12 for each year.",
      "The finance charge does not include the principal. Subtract the principal.",
    ],
    parentGuide:
      "Ask: if the payment is smaller but the loan is twice as long, is the total cost smaller? Have the learner check with real numbers.",
  }),
  lesson({
    id: "loan-compare-options",
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      part: "part",
    },
    titles: [
      "Monthly payment versus total cost",
      "Rank offers by total",
      "Why the two rankings can differ",
    ],
    title: "Choosing between two loans",
    summary:
      "A loan is an amount of money you borrow and pay back in monthly payments. To compare two loan offers, find the total cost of each: the payment times the number of months, plus any fee. A fee is an extra charge. The smaller total is the cheaper loan, even if its monthly payment is bigger.",
    templateIds: ["loan-compare-options"],
    objectives: [
      "Work out each offer's total cost and choose the cheaper one.",
      "Include an upfront fee, a charge paid once at the start, in the total.",
      "Tell the lower monthly payment apart from the lower total cost.",
    ],
    intuition: [
      "Two loan offers lend the same amount. They can differ in three ways: the monthly payment, the number of months, and a fee paid once at the start. Each of these changes what you pay. The total cost adds them into one number you can compare.",
      "The offer with the smaller monthly payment is often the one with more months. More payments can add up to more money, even when each payment is smaller. For example, 12 payments of 100 dollars is 1,200 dollars, but 24 payments of 60 dollars is 1,440 dollars.",
    ],
    workedExample: {
      prompt:
        "Both offers lend 10,000 dollars. Offer 1 is 36 monthly payments of 310 dollars. Offer 2 is 60 monthly payments of 200 dollars. Which costs less in total, and by how much?",
      steps: [
        "Offer 1 has 36 equal payments, so its total is 36 × 310 = 11,160 dollars.",
        "Offer 2 has 60 equal payments, so its total is 60 × 200 = 12,000 dollars.",
        "Offer 1 has the smaller total. Subtract to find by how much: 12,000 − 11,160 = 840 dollars less, even though Offer 2 has the lower monthly payment.",
      ],
      answer: "Offer 1, by 840 dollars",
    },
    method: [
      "For each offer, total = payment × number of months, plus any fee.",
      "Compare the totals. The smaller total is the cheaper offer. The difference between the totals is how much cheaper.",
      "To judge monthly payments, compare the monthly amounts alone. A claim about both payment and total needs both comparisons.",
    ],
    formal: [
      "For offers that lend the same amount, rank them by total cost $pn+f$. Here $p$ is the payment, $n$ is the number of payments, $pn$ means $p$ times $n$, and $f$ is any fee. Ranking by $p$ and ranking by $pn+f$ can give different winners, because $n$ and $f$ differ between offers.",
    ],
    pitfalls: [
      "A fee paid at the start is part of the cost. Add it once.",
      "To find how much cheaper a loan is, subtract the totals, not the monthly payments.",
      "The lower interest rate does not promise the lower total if its loan lasts longer.",
    ],
    parentGuide:
      "Ask the learner to work out both totals themselves. Then ask what would have to change for the other offer to win.",
  }),
  lesson({
    id: "credit-card-balance",
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      changes: "change",
      "more than": "more-than",
      part: "part",
    },
    titles: [
      "Interest is charged on what you still owe",
      "Month by month from the APR",
      "The balance rule, month after month",
    ],
    title: "How a credit card balance changes",
    summary:
      "A credit card lets you buy now and pay later. The balance is the amount you owe. Each month the card adds interest, a charge for borrowing, on the balance at the start of the month. Then your payment lowers the balance. Next month's interest is figured on the new balance.",
    templateIds: ["credit-card-balance"],
    objectives: [
      "Find a month's interest from an APR (a yearly interest rate) and a balance, rounded to the cent.",
      "Find the balance after a payment, and after two or three months.",
      "Find how much of a payment actually lowers the debt.",
    ],
    intuition: [
      "A credit card balance is the amount you owe on the card. An interest rate is the percent charged for borrowing. Each card has a yearly interest rate called the APR, short for annual percentage rate. Annual means yearly, so the APR is a yearly interest rate. Each month the card charges one twelfth of the APR on the balance. An APR of 18% means 18% ÷ 12 = 1.5% each month.",
      "If you pay only part of what you owe, the rest stays on the balance, and so does the interest. Next month's interest is figured on that balance.",
      "Part of each payment covers the month's interest first. Only the rest lowers the debt. So a small payment on a large balance may barely lower it.",
    ],
    workedExample: {
      prompt:
        "A card has an APR of 18%. The balance at the start is 1,200.00 dollars and the owner pays 50 dollars at the end of each of two months, with no purchases. Interest is rounded to the nearest cent. What is the balance after the second payment?",
      steps: [
        "Find the monthly rate. The APR is yearly, so divide by 12: 18% ÷ 12 = 1.5%.",
        "Month 1: interest = 1.5% of 1,200.00 = 18.00. Add the interest and subtract the payment: 1,200.00 + 18.00 − 50 = 1,168.00.",
        "Month 2 starts from the new balance: interest = 1.5% of 1,168.00 = 17.52. Balance = 1,168.00 + 17.52 − 50 = 1,135.52.",
        "Check: the balance fell by 1,200.00 − 1,135.52 = 64.48 in two months. That is less than the 100 dollars paid, because 18.00 + 17.52 = 35.52 of the payments went to interest.",
      ],
      answer: "1,135.52 dollars",
    },
    method: [
      "Monthly rate = APR ÷ 12, written as a decimal.",
      "Interest = monthly rate × balance at the start of the month, rounded to the nearest cent.",
      "New balance = starting balance + interest − payment. Use it as the next month's starting balance.",
      "When the payment is more than the interest, the part of the payment that lowers the debt = payment − interest.",
    ],
    formal: [
      "Let the monthly rate be $i=\\text{APR}/12$, the starting balance $B$ and the payment $p$. The month's interest is $iB$, meaning $i$ times $B$, rounded to the cent. The next balance is $B+iB-p$.",
      "This repeats month after month. The balances do not fall by equal steps, because the interest $iB$ changes as $B$ changes.",
    ],
    pitfalls: [
      "Do not use the APR as the monthly rate. Divide it by 12 first.",
      "Interest is charged on the starting balance, before this month's payment.",
      "Each month's interest uses a new balance. Do not repeat the first month's interest.",
    ],
    parentGuide:
      "Ask the learner how much of the first payment went to interest and how much lowered the debt.",
  }),
  lesson({
    id: "credit-cost-concepts",
    senses: {
      balance: "balance-account",
      change: "change",
      difference: "difference-subtract",
      part: "part",
    },
    noLink: ["rule", "whole"],
    titles: [
      "Credit costs interest on the unpaid part",
      "Turn a credit choice into numbers",
      "Rates, charges and payments",
    ],
    title: "What credit costs",
    summary:
      "Credit is borrowed money: the card company pays now and you pay it back later. If you leave part unpaid, you pay interest, a charge for borrowing, on that part. Fees add to the cost. A debit card spends your own money, so it costs no interest. Each of these has an exact effect you can work out.",
    templateIds: ["credit-cost-concepts"],
    objectives: [
      "Change an APR (a yearly interest rate) into a monthly rate, and back.",
      "Find the interest from paying only the minimum, and the difference between two cards.",
      "Find the extra cost of credit compared with debit, and a new balance that includes fees.",
    ],
    intuition: [
      "With a credit card, the card company pays the store now, and you pay the company later. A debit card takes money straight from your own bank account, so there is nothing to borrow and no interest.",
      "Each month a credit card sends a statement, a bill showing what you owe. The amount you owe is called the balance. If you pay it in full by its due date, this lesson counts the interest as 0. Interest is charged only on the part left unpaid.",
      "An interest rate is the percent charged for borrowing. APR is short for annual percentage rate, the card's yearly interest rate. The monthly rate is the APR divided by 12. So an APR of 24% is 2% a month, and the APR is 12 times the monthly rate.",
    ],
    workedExample: {
      prompt:
        "A statement balance is 800.00 dollars at an APR of 24%. Paying in full costs no interest. If the owner pays only the 25 dollar minimum, interest is charged for the month on the unpaid part, rounded to the nearest cent. How much more interest is that than paying in full?",
      steps: [
        "Find the monthly rate. The APR is yearly, so divide by 12: 24% ÷ 12 = 2%.",
        "Find the part left unpaid after the minimum payment: 800.00 − 25 = 775.00 dollars.",
        "Interest is charged on that unpaid part: 2% of 775.00 = 0.02 × 775.00 = 15.50 dollars.",
        "Paying in full costs 0 interest. So paying only the minimum costs 15.50 − 0 = 15.50 dollars more.",
      ],
      answer: "15.50 dollars",
    },
    method: [
      "The APR is the monthly rate times 12. The monthly rate is the APR divided by 12.",
      "Interest = monthly rate × the part of the balance left unpaid, rounded to the nearest cent.",
      "To compare two cards, find each card's interest for the month to the cent, then subtract.",
      "New balance = balance + interest + purchases + fees − payments.",
    ],
    formal: [
      "If the monthly rate is $i$, then the APR is $12i$ in this simple rule. Interest on an unpaid amount $U$ for one month is $iU$, meaning $i$ times $U$. Interest, purchases and fees raise a balance. Payments lower it.",
    ],
    pitfalls: [
      "For a monthly charge, use the monthly rate, never the yearly APR.",
      "Interest is charged on the unpaid part, not on the whole statement and not on the payment.",
      "A fee is a charge, so it raises the balance.",
    ],
    parentGuide:
      "Ask the learner to say, in numbers, how much more an item costs when it is bought on a card and the balance is left unpaid for a month.",
  }),
  lesson({
    id: "savings-plan-growth",
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      difference: "difference-subtract",
    },
    noLink: ["whole"],
    titles: [
      "Equal deposits make a straight-line balance",
      "Balance, time and deposit",
      "Savings balance as a straight-line pattern",
    ],
    title: "Saving toward a goal",
    summary:
      "A deposit is money you put into an account, and the balance is how much the account holds. If you start with some money and add the same deposit every month, the balance grows by the same amount each month. Use that pattern to find a balance, the months to reach a goal, or the deposit you need.",
    templateIds: ["savings-plan-growth"],
    objectives: [
      "Find a balance from a starting amount and monthly deposits.",
      "Find the number of months to reach a goal, or the deposit needed.",
      "Compare two plans and find when their balances are equal.",
    ],
    intuition: [
      "Start with 150 dollars and add 40 dollars at the end of every month. After 1 month you have 190 dollars, after 2 months 230 dollars, after 3 months 270 dollars. Each month adds the same 40 dollars.",
      "The starting amount is counted once. The deposit is counted once for each month. So the balance after $n$ months, where $n$ stands for the number of deposits, is the starting amount plus $n$ times the deposit. On a graph, these balances lie on a straight line.",
      "This lesson counts no interest, so you can see how deposits alone build a balance.",
    ],
    workedExample: {
      prompt:
        "A plan starts with 150 dollars and adds 40 dollars at the end of each month. In how many whole months does the balance first reach at least 1,000 dollars?",
      steps: [
        "Find how much the deposits must add. The plan already has 150, so it still needs 1,000 − 150 = 850 dollars.",
        "Divide by the deposit to count months: 850 ÷ 40 = 21.25. That is not a whole month, so check 21 and 22. After 21 deposits the balance is 150 + 21 × 40 = 150 + 840 = 990 dollars, which is less than 1,000.",
        "After 22 deposits it is 150 + 22 × 40 = 150 + 880 = 1,030 dollars, which is at least 1,000. So round up to 22 months.",
      ],
      answer: "22 months",
    },
    method: [
      "Balance after $n$ deposits = start + deposit × $n$.",
      "Months to a goal: divide (goal − start) by the deposit, then round up to a whole month.",
      "Deposit needed for $n$ months: (goal − start) ÷ $n$.",
      "The starting gap is how much more one plan starts with. If the other plan deposits more each month, the balances are equal after starting gap ÷ difference in monthly deposits months. If that is not an exact count of months, round up.",
    ],
    formal: [
      "Let $S$ be the starting amount and $d$ the monthly deposit. The balance after $n$ deposits is $B(n)=S+dn$, read “$B$ of $n$ equals $S$ plus $d$ times $n$”. It starts at $S$ and rises by $d$ dollars each month, so its graph is a straight line.",
      "For $d>0$ and a goal $G$ that is at least $S$, the balance first reaches $G$ after $(G-S)/d$ deposits, rounded up if it is not an exact count.",
    ],
    pitfalls: [
      "Subtract the starting amount before dividing by the deposit.",
      "Round months up, never down. The goal is not reached until the next deposit.",
      "Count the starting amount once, not once each month.",
    ],
    parentGuide:
      "Ask the learner to pick something they want to save for. Then find how many months a set monthly amount would take.",
  }),
  lesson({
    id: "interest-table-type",
    senses: {
      balance: "balance-account",
      balances: "balance-account",
      change: "change",
    },
    noLink: ["mean", "whole"],
    titles: [
      "Look at the yearly increases",
      "Classify, extend, and read one year",
      "Yearly rises of simple and compound balances",
    ],
    title: "Simple or compound? Read the table",
    summary:
      "Interest is the money an account pays you, and the balance is how much the account holds. To tell the kind of interest from a table, subtract each balance from the next one. That gives each year's rise. If the rises are equal, it is simple interest. If they grow, it is compound interest, which pays interest on earlier interest.",
    templateIds: ["interest-table-type"],
    objectives: [
      "Tell simple interest from compound interest in a table of balances.",
      "Extend the simple-interest account to a later year.",
      "Find the interest an account earns in one year.",
    ],
    intuition: [
      "A year's interest is how much the balance rises during that year. It is the balance at the end of the year minus the balance at the end of the year before. For balances of 1,000 and then 1,040, that year's interest is 1,040 − 1,000 = 40 dollars.",
      "Simple interest is figured on the first deposit, the principal, only. So it rises by the same amount every year. Compound interest is figured on the whole balance, which keeps growing. So it rises by more each year.",
    ],
    workedExample: {
      prompt:
        "Two accounts start with 1,000 dollars at the same rate, one simple and one compound. Year-end balances for years 0 to 3 are: Account A 1,000, 1,040, 1,080, 1,120; Account B 1,000, 1,040, 1,081.60, 1,124.86. Which account is simple, and what will it hold after 10 years?",
      steps: [
        "Subtract neighbouring balances for Account A: it rises 40, 40, 40. The steps are equal, so it pays simple interest.",
        "Do the same for Account B: it rises 40, 41.60, 43.26. The steps grow, so it pays compound interest.",
        "Account A earns 40 dollars every year. After 10 years it has earned 10 × 40 = 400 dollars, so it holds 1,000 + 400 = 1,400 dollars.",
      ],
      answer: "Account A, 1,400 dollars",
    },
    method: [
      "Subtract each balance from the next to find the yearly rises.",
      "Equal rises mean simple interest. Growing rises mean compound interest.",
      "Simple interest: balance after $t$ years = principal + $t$ × the yearly rise, where $t$ is the number of years.",
      "A year's interest = the balance at the end of that year minus the balance at the end of the year before.",
    ],
    formal: [
      "Let $P$ be the principal and $r$ the yearly rate written as a decimal (a number with a decimal point, such as 0.12). With simple interest, neighbouring year-end balances always differ by the same amount, $Pr$.",
      "With compound interest, the rise in year $t$ is $P(1+r)^{t-1}r$, where $(1+r)^{t-1}$ means $t-1$ copies of $(1+r)$ multiplied together. When $r>0$, these rises grow each year. Rounding to cents can change the last digit.",
    ],
    pitfalls: [
      "A balance is not the interest. Subtract to find the rise.",
      "Going from year 3 to year 10 needs 7 more years of interest, or 10 years counted from the start. Do not mix the two.",
      "Compare the rises, not the balances. Both accounts start equal and both go up.",
    ],
    parentGuide:
      "Ask the learner to write the yearly rises for each account. Then ask them to explain why one list stays the same and the other grows.",
  }),
];
