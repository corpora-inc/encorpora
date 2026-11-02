import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const financeIncomeMethods: Record<string, ProblemMethod> = {
  "profit-cost-breakeven": {
    goal: "Find profit or loss, total cost, the break-even number, or the variable cost from a price and costs.",
    intuition:
      "Revenue is the money a sale brings in. Costs are the money spent. Profit is revenue minus all costs; a negative result is a loss. A fixed cost is paid once no matter how many items are made, such as renting a table. A variable cost is paid again for each item, such as the beads in one bracelet.",
    terms: ["revenue", "fixed-cost", "variable-cost", "break-even-number"],
    method: [
      "Total cost = fixed costs + (making cost per item × number made).",
      "Revenue = price × number sold. Profit = revenue − total cost. A negative profit is a loss.",
      "Break-even: each sale leaves price − making cost to pay the fixed costs, so the break-even number is fixed costs ÷ (price − making cost).",
    ],
    watch:
      "Pay the fixed costs once and the variable cost for every item. Divide the fixed costs by the price minus the making cost, not by the price alone.",
  },
  "tax-kinds-defined": {
    goal: "Name the kind of tax, income, payroll, sales or property, from a description or example.",
    intuition:
      "A tax is money people and businesses pay to a government. The four common kinds are told apart by what the amount is based on and when it is paid.",
    terms: ["income-tax", "payroll-tax", "sales-tax", "property-tax"],
    method: [
      "Find what the amount is based on: earnings over a year, one paycheck, one price, or the value of property.",
      "Find when it is paid: when filing a yearly return, at each paycheck, at each purchase, or each year on what is owned.",
      "Match those two clues to the kind of tax.",
    ],
    watch:
      "Payroll tax and income tax both come from earnings. Payroll tax is taken from each paycheck for specific programs; income tax is figured on the year's income.",
  },
  "tax-bracket-owed": {
    senses: { part: "part" },
    noLink: ["jumps", "whole"],
    goal: "Use a three-bracket tax table to find the tax owed or the tax on part of an income.",
    intuition:
      "An income tax is a tax on what you earn: money paid to the government. A bracket table cuts income into slices called brackets. Each slice has its own rate, a percent taken from only the dollars in that slice. If extra earnings reach a higher bracket, only those new dollars get the higher rate.",
    terms: [
      "tax-bracket",
      "taxable-income",
      [
        "deduction",
        "Here a deduction is an amount subtracted from income before the tax table is used.",
      ],
    ],
    method: [
      "If a deduction (an amount you may subtract) is given, subtract it from earned income. What is left is the taxable income.",
      "Fill the rows in order. Put as much income as fits into the first row, then into the next row, then the rest. Skip rows the income does not reach.",
      "Multiply each slice by its row's rate, written as a decimal (a number with a decimal point, such as 0.12 for 12%). Then add the results.",
    ],
    watch:
      "Do not tax all of the income at the top row's rate. Only the part of income inside a row is taxed at that row's rate.",
  },
  "payroll-property-tax": {
    senses: { unit: "unit", units: "unit" },
    goal: "Find a payroll, sales or property tax, or the pay left after two taxes are taken out.",
    intuition:
      "A tax is money paid to the government. Percent means per hundred, so an 8% tax takes 8 dollars from every 100 dollars. A property tax is often given as dollars for each 100 dollars of value. Then count how many hundreds the value holds and multiply by the rate.",
    terms: [
      [
        "payroll-tax",
        "Withheld means taken out of pay before the worker receives it.",
      ],
      [
        "tax",
        "An exempt item is not taxed; it is still paid for at its price.",
      ],
      [
        "property-tax",
        "An exemption is an amount subtracted from the value before the tax is figured.",
      ],
    ],
    method: [
      "For a percent tax, write the percent as a decimal (a number with a decimal point, such as 0.12) and multiply: 6% of 500 dollars is 0.06 × 500 = 30 dollars.",
      "Net pay is the pay left after taxes: subtract every tax from gross pay, the pay before taxes. For a sales total, tax only the taxable items, then add all prices and the tax.",
      "For property tax, subtract any exemption from the value. Divide by 100 to count the hundreds, then multiply by the rate for each 100.",
    ],
    watch:
      "Read what the rate applies to: only the taxable items, or each 100 dollars of value, not each 1,000.",
  },
  "budget-percent-share": {
    senses: {
      change: "change",
      "more than": "more-than",
      part: "part",
      parts: "part",
      whole: "whole",
    },
    goal: "Find a budget category's percent of the total, its dollar amount, or a missing percent.",
    intuition:
      "A budget is a plan for how to use income, the money that comes in. Percent means per hundred. A category's share is its amount divided by the whole budget, written as a percent. Fixed expenses, such as rent, stay the same each month. Variable expenses, such as food, change. All the shares of a full budget add to 100%.",
    terms: [
      "fixed-cost",
      "variable-cost",
      [
        "percent",
        "A share is one part divided by the whole, written as a percent.",
      ],
    ],
    method: [
      "Share of the budget = category amount ÷ total. Multiply by 100 to write it as a percent.",
      "Write the percent as a decimal (a number with a decimal point, such as 0.12). Dollar amount of a category = that decimal × the total.",
      "To combine categories, add their amounts or percents first. A missing percent is 100% minus the others.",
    ],
    watch:
      "Divide by the whole budget, not by what is left of it. Spending more than income gives a share above 100%.",
  },
  "net-worth-statement": {
    senses: {
      balance: "balance-account",
      change: "change",
      changes: "change",
      sort: "sort",
    },
    noLink: ["side"],
    goal: "Sort assets and liabilities, find net worth, or decide how a purchase or payment changes it.",
    intuition:
      "An asset is something you own that has value, such as savings or a bike. A liability is money you owe, such as a loan. Net worth is what would be left if you sold every asset and paid every liability: assets minus liabilities. It can be below 0.",
    terms: ["asset", "liability", "net-worth"],
    method: [
      "Sort each item as owned or owed. Add up the assets. Separately, add up the liabilities.",
      "Net worth = total assets − total liabilities. If liabilities are larger, the net worth is negative (below 0).",
      "For a purchase or payment, find how much assets change and how much liabilities change. Net worth changes by the asset change minus the liability change.",
    ],
    watch:
      "Subtract debts. Do not add them. Paying a debt from savings lowers both totals by the same amount, so net worth stays the same.",
  },
  "incentive-compare": {
    goal: "Find the lowest final cost among a coupon, percent discount and rebate, or compare stores.",
    intuition:
      "A coupon takes a set number of dollars off. A percent discount takes a percent of the price off; percent means per hundred. A mail-in rebate pays money back after you pay the full price. To compare offers, find the final cost under each one.",
    terms: [
      "coupon",
      "rebate",
      [
        "coupon",
        "The final cost is the price paid after every coupon, rebate or other offer used.",
      ],
    ],
    method: [
      "Turn each offer into a final cost. Percent off saves price × percent ÷ 100.",
      "When two offers are used, apply them in the order given. A percent is taken of the price at that moment.",
      "Compare the final costs. The lowest is the best deal.",
    ],
    watch:
      "A percent taken before a coupon is a different amount from a percent taken after it. Compare final prices, not just the size of the discounts.",
  },
};

export const financeIncomePrinciples: Record<string, string> = {
  "profit-cost-breakeven":
    "For price $p$, making cost $c$ per item, fixed costs $F$ and $n$ items sold, profit is $P(n)=pn-(F+cn)=(p-c)n-F$. It is zero at $n=F/(p-c)$ when $p>c$, a loss for smaller $n$ and a profit for larger $n$.",
  "tax-kinds-defined":
    "An income tax is figured on income earned over a year. A payroll tax is withheld from wages to fund programs such as Social Security and Medicare. A sales tax is a percent of a purchase price. A property tax is a yearly amount based on the assessed value of real property.",
  "tax-bracket-owed":
    "Let $t_1<t_2$ be where the rows end and $r_1<r_2<r_3$ the rates as decimals. Here $\\min$ picks the smaller number and $\\max$ the larger. The tax on taxable income $I$ is $r_1\\min(I,t_1)+r_2\\max(0,\\min(I,t_2)-t_1)+r_3\\max(0,I-t_2)$. The tax rises with income, with no jumps. Inside each row it rises by that row's rate for each extra dollar.",
  "payroll-property-tax":
    "A tax of $p\\%$ on an amount $A$ is $A\\cdot p/100$, where $\\cdot$ means times. If gross pay $G$ has taxes of $p\\%$ and $q\\%$ withheld, net pay is $G(1-(p+q)/100)$. A property tax of $k$ dollars for each 100 dollars of taxable value $V$ is $kV/100$.",
  "budget-percent-share":
    "For a total $T$ and a part $A$, the share is $100A/T$ percent. A part with a share of $s\\%$ of $T$ is $sT/100$. The shares of all parts of a whole add to $100\\%$. An amount larger than the total it is compared with, such as expenses above income, is more than $100\\%$ of it.",
  "net-worth-statement":
    "Net worth is $N=A-L$ for total assets $A$ and total liabilities $L$. The symbol $\\Delta$ (delta) means change in. A purchase or payment that changes assets by $\\Delta A$ and liabilities by $\\Delta L$ changes net worth by $\\Delta A-\\Delta L$.",
  "incentive-compare":
    "For a price $P$, a coupon of $a$ dollars gives $P-a$. A $p\\%$ discount gives $P(1-p/100)$. A rebate of $b$ dollars gives $P-b$. Used one after the other, percent first then coupon gives $P(1-p/100)-a$, and coupon first then percent gives $(P-a)(1-p/100)$. These differ by $ap/100$.",
};

export const financeIncomeLessons: Lesson[] = [
  {
    id: "profit-cost-breakeven",
    title: "Profit, cost and break-even",
    summary:
      "Profit is revenue minus total cost. Fixed costs are paid once; variable costs are paid for each item.",
    templateIds: ["profit-cost-breakeven"],
    objectives: [
      "Find total cost from fixed and variable costs.",
      "Find profit or loss, and the break-even number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Money in, money out",
        paragraphs: [
          "Revenue is the money a sale brings in: the price times the number sold. Costs are the money spent to make and sell. Profit is revenue minus total cost. If the result is below zero, it is a loss.",
          "A fixed cost is paid once, however many items are made, such as renting a table. A variable cost is paid again for each item, such as the beads in one bracelet. Total cost is the fixed costs plus the variable cost times the number made.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A club sells bracelets for 6 dollars each. The fixed costs are 12 dollars for a table and 8 dollars for a banner. Beads for each bracelet cost 2 dollars. How many bracelets must be sold to break even?",
      steps: [
        "Each bracelet sold brings in 6 dollars and costs 2 dollars in beads, so $6-2=4$ dollars of each sale is left to pay the fixed costs.",
        "The fixed costs total $12+8=20$ dollars.",
        "Break-even is where those leftovers cover the fixed costs: $20\\div4=5$ bracelets.",
        "Check: revenue is $5\\times6=30$ dollars and total cost is $20+5\\times2=30$ dollars, so profit is 0.",
      ],
      answer: "5",
      answerUnit: "bracelets",
    },
    closingSections: [
      {
        stage: "method",
        title: "From break-even to profit",
        paragraphs: [
          "Below the break-even number there is a loss; above it, a profit. After 5 sales, each extra bracelet adds 4 dollars of profit. Selling 8 gives revenue $8\\times6=48$ and cost $20+8\\times2=36$, a profit of $48-36=12$ dollars, which is also $(8-5)\\times4$.",
          "To find a profit or loss directly, find revenue, find total cost, then subtract. Name the result a profit when it is positive, a loss when negative.",
        ],
      },
      {
        stage: "formal",
        title: "Profit as a linear function",
        paragraphs: [
          "With price $p$, making cost $c$, fixed costs $F$ and $n$ items sold, profit is $P(n)=(p-c)n-F$. It equals zero at $n=F/(p-c)$ when $p>c$. If $p\\le c$, no number sold ever covers the fixed costs.",
        ],
      },
    ],
    pitfalls: [
      "Pay the fixed costs once, not for each item.",
      "Divide the fixed costs by the price minus the making cost, not by the price.",
      "A negative profit is a loss; name it as a loss.",
    ],
    parentGuide:
      "Ask the learner to plan a small stand: list one fixed cost and one variable cost, then find how many sales cover the fixed cost.",
  },
  {
    id: "tax-kinds-defined",
    title: "Kinds of taxes",
    summary:
      "Income, payroll, sales and property taxes differ in what they are based on and when they are paid.",
    templateIds: ["tax-kinds-defined"],
    objectives: [
      "Tell income, payroll, sales and property taxes apart.",
      "Use what a tax is based on and when it is paid to name its kind.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What the amount is based on",
        paragraphs: [
          "A tax is money people and businesses pay to a government. Four common kinds are told apart by what the amount is based on and when it is paid.",
          "An income tax is a share of what a person earns in a year, reported once a year. A payroll tax is taken out of each paycheck to pay for programs such as Social Security and Medicare. A sales tax is a percent of a price, added when something is bought. A property tax is a yearly amount based on the value of land and buildings a person owns.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A receipt shows 25.00 dollars for a shirt and 1.75 dollars added at the register. Which kind of tax is the 1.75 dollars?",
      steps: [
        "It is added when something is bought, so it is based on a purchase, not on earnings or on property.",
        "Compare with the price: $1.75\\div25.00=0.07$, which is 7% of the price.",
        "A percent of a price, added at the register, is a sales tax.",
      ],
      answer: "Sales tax",
    },
    closingSections: [
      {
        stage: "method",
        title: "Two clues",
        paragraphs: [
          "Ask two questions. What is the amount based on: a year of earnings, one paycheck, one price, or what a person owns? When is it paid: with a yearly return, at each paycheck, at each purchase, or each year? The two answers point to one kind.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "Income tax: a tax on income earned during a year. Payroll tax: a tax withheld from wages to fund programs such as Social Security and Medicare. Sales tax: a tax on the price of goods or services bought. Property tax: a recurring tax on the value of real property.",
        ],
      },
    ],
    pitfalls: [
      "Payroll tax and income tax both come from earnings; payroll tax is taken from each paycheck for specific programs.",
      "A tax added at the register is a sales tax even though it is a percent of the price.",
    ],
    parentGuide:
      "Look at a pay stub and a store receipt together and ask which lines are payroll tax and sales tax and what each is based on.",
  },
  {
    id: "tax-bracket-owed",
    senses: { term: "term-expression" },
    noLink: ["edge", "jumps"],
    title: "Income tax from a bracket table",
    summary:
      "An income tax is a tax on what you earn: money paid to the government. A tax table cuts income into slices called brackets. Each slice has its own rate, a percent taken from only the dollars in that slice. To find the tax, work out the tax on each slice, then add them.",
    templateIds: ["tax-bracket-owed"],
    objectives: [
      "Split an income into the slices, or brackets, of a tax table.",
      "Find the tax owed, in dollars and cents.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Rates apply to slices",
        paragraphs: [
          "Percent means per hundred, so a rate of 10% takes 10 dollars from every 100 dollars. An income tax table cuts income into slices called brackets. Each bracket has a rate.",
          "Income inside the first bracket is taxed at the first rate. Income inside the second bracket is taxed at the second rate, and so on. For example, if the first 10,000 dollars is taxed at 10%, that slice costs 10,000 × 0.10 = 1,000 dollars, whatever else you earn.",
          "If extra earnings reach a higher bracket, only those new dollars are taxed at the higher rate. The dollars below are taxed exactly as before.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A table taxes the first 10,000 dollars of taxable income at 10%, the next 30,000 dollars (from 10,000 to 40,000) at 12%, and income above 40,000 dollars at 22%. How much tax is owed on 50,000 dollars?",
      steps: [
        "Split 50,000 into the table's slices. The first row holds 10,000. The second holds 30,000, up to 40,000. The rest is $50{,}000-40{,}000=10{,}000$.",
        "Tax each slice at its own rate, written as a decimal: $10{,}000\\times0.10=1{,}000$, $30{,}000\\times0.12=3{,}600$, and $10{,}000\\times0.22=2{,}200$.",
        "Add the three slices' taxes: $1{,}000+3{,}600+2{,}200=6{,}800$ dollars.",
        "Check: taxing all 50,000 dollars at 22% would give 11,000 dollars. That is far too much, because only 10,000 dollars is in the 22% row.",
      ],
      answer: "6,800.00",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Deductions and raises",
        paragraphs: [
          "A deduction is an amount you are allowed to subtract from your income before tax. If one is allowed, subtract it from earned income first. The table applies to what is left, called taxable income. A person earning 62,000 dollars with a 12,000-dollar deduction has 62,000 − 12,000 = 50,000 dollars of taxable income.",
          "A raise that stays inside one row is taxed at that row's rate. A 1,000-dollar raise in the 12% row adds $1{,}000\\times0.12=120$ dollars of tax. Income exactly at the top edge of a row belongs to that row.",
        ],
      },
      {
        stage: "formal",
        title: "The tax function",
        paragraphs: [
          "Let $t_1$ and $t_2$ be where the rows end, with $t_1<t_2$, and let $r_1$, $r_2$ and $r_3$ be the rates as decimals. Here $\\min(a,b)$ means the smaller of $a$ and $b$, and $\\max(a,b)$ means the larger.",
          "The tax on taxable income $I$ is $r_1\\min(I,t_1)+r_2\\max(0,\\min(I,t_2)-t_1)+r_3\\max(0,I-t_2)$. Each term is one slice times its rate. The tax always rises as income rises, with no jumps. Inside each row it rises by that row's rate for each extra dollar.",
        ],
      },
    ],
    pitfalls: [
      "Tax each slice at its own rate. Do not tax all of the income at the top row's rate.",
      "The first slice is taxed too, at the first rate.",
      "Subtract a deduction from the income before using the table, not from the tax.",
    ],
    parentGuide:
      "Make a two-row tax table with the learner. Find the tax on an income that reaches the second row. Then ask why one rate does not apply to all of it.",
  },
  {
    id: "payroll-property-tax",
    senses: { unit: "unit", units: "unit" },
    noLink: ["rule"],
    title: "Payroll, sales and property tax amounts",
    summary:
      "A tax is money paid to the government. Percent means per hundred, so an 8% tax takes 8 dollars from every 100 dollars. A payroll tax is a tax taken out of a paycheck. A sales tax is added to a price. A property tax, on land and buildings, is often a set number of dollars for each 100 dollars of value.",
    templateIds: ["payroll-property-tax"],
    objectives: [
      "Find a percent tax, the pay left after two taxes are taken out, and a sales total that includes an untaxed item.",
      "Find a property tax from a rate for each 100 dollars of value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A tax is a part of an amount",
        paragraphs: [
          "A tax of 8% takes 8 hundredths of an amount. On 400 dollars of pay, that is 400 × 0.08 = 32 dollars.",
          "A payroll tax is withheld from pay. Withheld means taken out before the worker receives the money. Gross pay is the pay before any tax is taken out. Net pay is what is left after.",
          "A sales tax is added to the price of something you buy. An item that is exempt is not taxed, but you still pay its price.",
          "A property tax is often stated per 100 dollars of value, for example 1.20 dollars for every 100 dollars. To use it, count how many hundreds the value holds. Then multiply by the rate.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A county charges 1.20 dollars of property tax for each 100 dollars of taxable value. A home has a taxable value of 150,000 dollars. What is the yearly tax?",
      steps: [
        "The rate is for each 100 dollars, so count the 100-dollar units: $150{,}000\\div100=1{,}500$.",
        "Charge 1.20 dollars for each unit: $1{,}500\\times1.20=1{,}800$.",
        "Check with a percent. 1.20 dollars for every 100 dollars is 1.2%, and $150{,}000\\times0.012=1{,}800$.",
      ],
      answer: "1,800.00",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Other cases",
        paragraphs: [
          "Net pay with two taxes withheld: subtract both taxes from gross pay. Or multiply gross pay by 1 minus the two percents, each written as a decimal (a number with a decimal point, such as 0.12). With 8% and 12% withheld from 400 dollars, the taxes add to 20%, so net pay is $400\\times(1-0.20)=320$ dollars.",
          "Sales tax on one taxable item: tax only that item's price. Then add every price and the tax.",
          "An exemption is an amount subtracted from a property's value before the tax is figured. Subtract it first, then count the hundreds.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "A tax of $p\\%$ on an amount $A$ is $Ap/100$, meaning $A$ times $p$ divided by 100. A property tax of $k$ dollars for each 100 dollars of taxable value $V$ is $kV/100$. The rates here are for practice. Real rates differ by place and year.",
        ],
      },
    ],
    pitfalls: [
      "Divide a percent by 100 before multiplying.",
      "Tax only what the rule taxes. Exempt items are still paid for.",
      "A property tax for each 100 dollars is not the same as for each 1,000 dollars.",
    ],
    parentGuide:
      "Use a real receipt or pay stub. Ask the learner to work out one tax line again from its stated rate.",
  },
  {
    id: "budget-percent-share",
    senses: {
      change: "change",
      "more than": "more-than",
      part: "part",
      parts: "part",
      whole: "whole",
    },
    title: "Budget shares as percents",
    summary:
      "A budget is a plan for how to use the money that comes in. Each part of the plan, such as rent or food, is a category. Percent means per hundred. A category's share is its amount divided by the whole budget, written as a percent. For example, 320 dollars of an 800-dollar budget is 320 ÷ 800 = 0.40, which is 40%.",
    templateIds: ["budget-percent-share"],
    objectives: [
      "Find a category's percent of a budget, and a dollar amount from a percent.",
      "Combine fixed expenses, variable expenses and savings.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Parts of one whole",
        paragraphs: [
          "A budget plans how income, the money that comes in, is used. An expense is the money spent on something. Fixed expenses stay the same each month, such as rent. Variable expenses can change, such as food or fun. Savings is money set aside.",
          "A category's share is its part divided by the whole budget. Writing it per hundred makes it a percent. For example, 80 dollars of an 800-dollar budget is 80 ÷ 800 = 0.10, which is 10%.",
          "In a complete budget every dollar is planned. So all the shares add to 100%.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A monthly budget of 800 dollars plans 320 dollars for rent, 160 for food, 80 for transport, 80 for fun and 160 for savings. What percent of the budget is rent?",
      steps: [
        "The whole is the full budget, 800 dollars. The part is rent, 320 dollars.",
        "Divide the part by the whole: $320\\div800=0.40$.",
        "Write 0.40 per hundred: 0.40 = 40 hundredths, which is 40%.",
        "Check: $0.40\\times800=320$. The other shares are 20%, 10%, 10% and 20%. With 40% they add to 100%.",
      ],
      answer: "40%",
    },
    closingSections: [
      {
        stage: "method",
        title: "Groups, missing shares and deficits",
        paragraphs: [
          "To find a group's share, such as all fixed expenses, add their amounts first. Then divide by the total. To find a dollar amount from a percent, multiply the total by the percent written as a decimal (a number with a decimal point, such as 0.12). A missing share is 100% minus the others.",
          "A deficit means spending more than comes in. Then expenses are more than 100% of income. Expenses of 440 dollars on an income of 400 dollars are $440\\div400=1.10$, which is 110% of income.",
        ],
      },
      {
        stage: "formal",
        title: "Share of a whole",
        paragraphs: [
          "The share of a part $A$ in a total $T$, with $T$ greater than 0, is $100A/T$ percent. A part with a share of $s\\%$ is $sT/100$. The shares of all parts of a whole add to 100%.",
        ],
      },
    ],
    pitfalls: [
      "Divide by the whole budget, not by what is left of it.",
      "Add up a group before dividing.",
      "Expenses larger than income are more than 100% of income.",
    ],
    parentGuide:
      "List monthly spending in three groups: fixed, variable and saved. Find what percent of the total each group is.",
  },
  {
    id: "net-worth-statement",
    senses: {
      change: "change",
      changes: "change",
      "more than": "more-than",
      sort: "sort",
    },
    title: "Assets, liabilities and net worth",
    summary:
      "An asset is something you own that has value, such as savings or a bike. A liability is money you owe, such as a loan. Net worth is assets minus liabilities: what you would have left after paying everything you owe. If you owe more than you own, net worth is negative, below 0.",
    templateIds: ["net-worth-statement"],
    objectives: [
      "Sort items into assets (owned) and liabilities (owed).",
      "Find net worth, and decide how a purchase or payment changes it.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Owned and owed",
        paragraphs: [
          "An asset is something a person owns that has value, such as savings or a bicycle. A liability is money the person owes, such as a loan or a bill not yet paid.",
          "Net worth is what would be left if every asset were turned into money and every liability were paid. So net worth = total assets − total liabilities. Someone who owns 1,000 dollars of things and owes 480 dollars has a net worth of 1,000 − 480 = 520 dollars.",
          "If a person owes more than they own, net worth is negative, a number below 0.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A person has a savings account of 600 dollars, a bicycle worth 150 dollars, a phone worth 250 dollars, a loan from family of 400 dollars and an unpaid phone bill of 80 dollars. What is the net worth?",
      steps: [
        "Add up the assets, the things owned: $600+150+250=1{,}000$ dollars.",
        "Add up the liabilities, the money owed: $400+80=480$ dollars.",
        "Subtract what is owed from what is owned: net worth = $1{,}000-480=520$ dollars.",
      ],
      answer: "520",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Purchases and payments",
        paragraphs: [
          "To see how a purchase or payment changes net worth, find its effect on assets and on liabilities.",
          "Paying 100 dollars from savings toward a loan lowers assets by 100 and liabilities by 100. So net worth does not change: $(1{,}000-100)-(480-100)=900-380=520$.",
          "Spending 100 dollars on something that gets used up lowers assets by 100. Liabilities stay the same, so net worth falls by 100.",
          "Working backward: if total assets are 900 dollars and net worth is −200 dollars, liabilities are $900-(-200)=1{,}100$ dollars.",
        ],
      },
      {
        stage: "formal",
        title: "Relationship",
        paragraphs: [
          "Net worth is $N=A-L$, for total assets $A$ and total liabilities $L$. The symbol $\\Delta$ (delta) means change in. A purchase or payment that changes assets by $\\Delta A$ and liabilities by $\\Delta L$ changes net worth by $\\Delta A-\\Delta L$.",
        ],
      },
    ],
    pitfalls: [
      "Subtract liabilities. Do not add them.",
      "A negative net worth means liabilities are larger than assets.",
      "Using savings to pay a debt does not change net worth.",
    ],
    parentGuide:
      "Have the learner list what they own and what they owe, and find the net worth. Then ask what happens to it when they buy something with savings.",
  },
  {
    id: "incentive-compare",
    title: "Compare coupons, discounts and rebates",
    summary:
      "Stores offer different ways to save. A coupon takes a set number of dollars off. A percent discount takes a percent of the price off. A rebate pays money back after you pay full price. To compare offers, find the final cost under each one, the amount you really pay. The lowest final cost is the best deal.",
    templateIds: ["incentive-compare"],
    objectives: [
      "Compare a coupon, a percent discount and a rebate by their final costs.",
      "Apply a percent discount and a coupon in a given order.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three ways to save",
        paragraphs: [
          "A coupon takes a set number of dollars off, such as 10 dollars off. A percent discount takes a percent of the price off. Percent means per hundred, so 20% off an 80-dollar jacket takes off 80 × 0.20 = 16 dollars.",
          "A mail-in rebate gives money back after the purchase. You pay the full price first, then get the rebate later.",
          "The offers save money in different ways, so compare the final cost of each: what you really pay after the offer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A jacket costs 80 dollars. Offer A is a coupon for 10 dollars off. Offer B is 20% off. Offer C is a rebate of 12 dollars after paying full price. Which offer gives the lowest final cost?",
      steps: [
        "Coupon: take 10 dollars off the price. $80-10=70$ dollars.",
        "Percent discount: 20% of 80 is $80\\times0.20=16$ dollars. So the cost is $80-16=64$ dollars.",
        "Rebate: pay 80, then get 12 back. $80-12=68$ dollars.",
        "Compare the three final costs: 70, 64 and 68. The lowest is 64 dollars, from the percent discount.",
      ],
      answer: "The percent discount, 64 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Two offers in a stated order",
        paragraphs: [
          "A percent is taken of the price at the moment it is used, so the order matters.",
          "With the 20% discount first and then the 10-dollar coupon: $80-16=64$, then $64-10=54$ dollars. With the coupon first and then the discount: $80-10=70$. 20% of 70 is 14, so the cost is $70-14=56$ dollars.",
          "To compare two stores, find each store's final price. Then subtract the lower from the higher.",
        ],
      },
      {
        stage: "formal",
        title: "Final cost formulas",
        paragraphs: [
          "Let $P$ be the price. A coupon of $a$ dollars gives $P-a$. A discount of $p\\%$ gives $P(1-p/100)$, meaning $P$ times $(1-p/100)$. A rebate of $b$ dollars gives $P-b$.",
          "Percent first and then coupon gives $P(1-p/100)-a$. Coupon first and then percent gives $(P-a)(1-p/100)$. The two results differ by $ap/100$ dollars. With the jacket, $10\\times20/100=2$, and 56 − 54 = 2.",
        ],
      },
    ],
    pitfalls: [
      "Compare final costs, not just the size of each discount.",
      "A rebate comes after you pay the full price.",
      "Follow the given order when a percent and a coupon are combined.",
    ],
    parentGuide:
      "At a store or on a flyer, ask the learner to work out the final price under two different offers and say which is lower.",
  },
];
