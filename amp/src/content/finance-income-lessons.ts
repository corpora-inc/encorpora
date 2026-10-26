import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const financeIncomeMethods: Record<string, ProblemMethod> = {
  "profit-cost-breakeven": {
    goal: "Find profit or loss, total cost, the break-even number, or the variable cost from a price and costs.",
    intuition:
      "Revenue is the money a sale brings in. Costs are the money spent. Profit is revenue minus all costs; a negative result is a loss. A fixed cost is paid once no matter how many items are made, such as renting a table. A variable cost is paid again for each item, such as the beads in one bracelet.",
    terms: [
      ["revenue", "Money received from sales: price times the number sold."],
      ["fixed cost", "A cost that stays the same however many items are made."],
      [
        "variable cost",
        "A cost that is paid for each item made, so it grows with the number made.",
      ],
      [
        "break-even number",
        "The number sold at which revenue equals total cost, so profit is zero.",
      ],
    ],
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
    terms: [
      ["income tax", "A share of the money a person earns in a year."],
      [
        "payroll tax",
        "An amount taken out of each paycheck to pay for programs such as Social Security and Medicare.",
      ],
      [
        "sales tax",
        "A percent of the price, added at the register when something is bought.",
      ],
      [
        "property tax",
        "A yearly amount based on the value of land and buildings that a person owns.",
      ],
    ],
    method: [
      "Find what the amount is based on: earnings over a year, one paycheck, one price, or the value of property.",
      "Find when it is paid: when filing a yearly return, at each paycheck, at each purchase, or each year on what is owned.",
      "Match those two clues to the kind of tax.",
    ],
    watch:
      "Payroll tax and income tax both come from earnings. Payroll tax is taken from each paycheck for specific programs; income tax is figured on the year's income.",
  },
  "tax-bracket-owed": {
    goal: "Use a three-bracket tax table to find the tax owed or the tax on part of an income.",
    intuition:
      "In a bracket table, income is cut into slices. Each slice has its own rate, and a rate applies only to the dollars in its own slice. Earning more moves only the new dollars into a higher rate; it never raises the rate on the dollars below.",
    terms: [
      ["bracket", "A slice of income with one tax rate."],
      [
        "taxable income",
        "Income left after subtractions such as a standard deduction; the table applies to this amount.",
      ],
      [
        "deduction",
        "An amount subtracted from income before the tax table is used.",
      ],
    ],
    method: [
      "If a deduction is given, subtract it from earned income to get taxable income.",
      "Split taxable income by row: the first row's full width, then the next rows' widths, then the rest. Skip rows the income does not reach.",
      "Multiply each slice by its row's rate, writing the percent as hundredths, then add the results.",
    ],
    watch:
      "Do not tax all of the income at the rate of its top row. Only the part of income inside a row is taxed at that row's rate.",
  },
  "payroll-property-tax": {
    goal: "Find a payroll, sales or property tax, or net pay after two withholdings.",
    intuition:
      "A percent tax takes that many hundredths of an amount. A property tax is often stated as dollars for each 100 dollars of value, so count how many hundreds the taxable value holds and multiply by the rate.",
    terms: [
      ["withheld", "Taken out of pay before the worker receives it."],
      ["exempt", "Not taxed; the item is still paid for at its price."],
      [
        "exemption",
        "An amount of value subtracted before property tax is figured.",
      ],
    ],
    method: [
      "For a percent tax, write the percent as hundredths and multiply: 6% of 500 dollars is 0.06 × 500.",
      "For net pay, subtract every tax from gross pay. For a sales total, tax only the taxable items, then add all prices and the tax.",
      "For property tax, subtract any exemption from the value, divide by 100 to count the hundreds, and multiply by the rate per hundred.",
    ],
    watch:
      "Read what the rate applies to: the taxable items only, or each 100 dollars of value, not each 1,000.",
  },
  "budget-percent-share": {
    goal: "Find a budget category's percent of the total, its dollar amount, or a missing percent.",
    intuition:
      "A budget plans how income is spent. A category's share is its part divided by the whole, written as a percent. Fixed expenses stay the same each month, such as rent; variable expenses change, such as food or fun; savings is money set aside. All the shares of a complete budget add to 100%.",
    terms: [
      ["fixed expense", "An expense that is the same amount each month."],
      ["variable expense", "An expense that can change from month to month."],
      ["share", "A part divided by the whole, written as a percent."],
    ],
    method: [
      "Share of the budget = category amount ÷ total, written as a percent.",
      "Dollar amount of a category = its percent (as hundredths) × the total.",
      "To combine categories, add their amounts or percents first. A missing percent is 100% minus the others. Expenses above income give a percent above 100%.",
    ],
    watch:
      "The whole is the total of the budget, not the rest of it. A deficit means expenses are more than 100% of income.",
  },
  "net-worth-statement": {
    goal: "Classify assets and liabilities, find net worth, or decide how a transaction changes it.",
    intuition:
      "An asset is something a person owns that has value. A liability is money the person owes. Net worth is what would be left if every asset were sold and every liability paid: assets minus liabilities. It can be negative.",
    terms: [
      [
        "asset",
        "Something owned that has value, such as savings or a bicycle.",
      ],
      ["liability", "Money owed, such as a loan or a credit card debt."],
      ["net worth", "Total assets minus total liabilities."],
    ],
    method: [
      "Sort each item as owned or owed. Add the assets and, separately, the liabilities.",
      "Net worth = total assets − total liabilities. If liabilities are larger, the net worth is negative.",
      "For a transaction, find the change in assets and the change in liabilities. Net worth changes by the change in assets minus the change in liabilities.",
    ],
    watch:
      "Debts are subtracted, not added. Paying a debt from savings lowers both totals equally, so net worth stays the same.",
  },
  "incentive-compare": {
    goal: "Find the lowest final cost among a coupon, percent discount and rebate, or compare stores.",
    intuition:
      "Different offers save money in different ways. A coupon takes dollars off. A percent discount takes a share of the price off. A mail-in rebate is paid back after the full price is paid. To compare, find the dollars each one saves, or the final cost.",
    terms: [
      ["coupon", "A stated number of dollars off the price."],
      ["rebate", "Money returned after the purchase."],
      ["final cost", "The price paid after all offers that are used."],
    ],
    method: [
      "Turn each offer into dollars saved or a final cost: percent off saves price × percent ÷ 100.",
      "When two offers are used, apply them in the stated order. A percent is taken from the price it is applied to.",
      "Compare the final costs; the lowest is the best deal.",
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
    "For thresholds $t_1<t_2$ and rates $r_1<r_2<r_3$, tax on taxable income $I$ is $r_1\\min(I,t_1)+r_2\\max(0,\\min(I,t_2)-t_1)+r_3\\max(0,I-t_2)$, with rates written as hundredths. The tax is a continuous, increasing function of $I$; its slope on each row is that row's rate.",
  "payroll-property-tax":
    "A tax of $p\\%$ on amount $A$ is $A\\cdot p/100$. If gross pay $G$ has withholdings of $p\\%$ and $q\\%$, net pay is $G(1-(p+q)/100)$. A property tax of $k$ dollars per 100 dollars of taxable value $V$ is $kV/100$.",
  "budget-percent-share":
    "For total $T$ and part $A$, the share is $100A/T$ percent. A part with share $s\\%$ of $T$ is $sT/100$. The shares of all parts of a whole sum to $100\\%$, and a part larger than the reference total has a share above $100\\%$.",
  "net-worth-statement":
    "Net worth is $N=A-L$ for total assets $A$ and total liabilities $L$. A transaction that changes assets by $\\Delta A$ and liabilities by $\\Delta L$ changes net worth by $\\Delta A-\\Delta L$.",
  "incentive-compare":
    "For price $P$, a coupon of $a$ dollars gives $P-a$; a $p\\%$ discount gives $P(1-p/100)$; a rebate of $b$ dollars gives $P-b$. Applied in sequence, percent first then coupon gives $P(1-p/100)-a$, and coupon first then percent gives $(P-a)(1-p/100)$; these differ by $ap/100$.",
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
    title: "Income tax from a bracket table",
    summary:
      "Each rate applies only to the part of income inside its own bracket. Tax each slice, then add.",
    templateIds: ["tax-bracket-owed"],
    objectives: [
      "Split income into the slices of a bracket table.",
      "Find the tax owed, with dollars and cents.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Rates apply to slices",
        paragraphs: [
          "An income tax table cuts income into slices called brackets. Each bracket has a rate, a percent of the dollars in that slice. Income inside the first bracket is taxed at the first rate, income inside the second at the second rate, and so on.",
          "Earning more moves only the new dollars into a higher rate. The dollars below are taxed exactly as before.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A table taxes the first 10,000 dollars of taxable income at 10%, the next 30,000 dollars (from 10,000 to 40,000) at 12%, and income above 40,000 dollars at 22%. How much tax is owed on 50,000 dollars?",
      steps: [
        "Split 50,000 into slices: the first row holds 10,000, the second holds 30,000 (up to 40,000), and the rest is $50{,}000-40{,}000=10{,}000$.",
        "Tax each slice: $10{,}000\\times0.10=1{,}000$, $30{,}000\\times0.12=3{,}600$, and $10{,}000\\times0.22=2{,}200$.",
        "Add: $1{,}000+3{,}600+2{,}200=6{,}800$ dollars.",
        "Check: taxing all 50,000 dollars at 22% would give 11,000 dollars, far too much, because only 10,000 dollars is in the 22% row.",
      ],
      answer: "6,800.00",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Deductions and raises",
        paragraphs: [
          "If a deduction is allowed, subtract it from earned income first. The table applies to what is left, called taxable income. A person earning 62,000 dollars with a 12,000-dollar deduction has 50,000 dollars of taxable income.",
          "A raise that stays in one row is taxed at that row's rate: a 1,000-dollar raise in the 12% row adds $1{,}000\\times0.12=120$ dollars of tax. Dollars of income exactly at a row's upper boundary belong to that row.",
        ],
      },
      {
        stage: "formal",
        title: "The tax function",
        paragraphs: [
          "For thresholds $t_1<t_2$ and rates $r_1,r_2,r_3$ written as hundredths, tax on income $I$ is $r_1\\min(I,t_1)+r_2\\max(0,\\min(I,t_2)-t_1)+r_3\\max(0,I-t_2)$. This is increasing and continuous in $I$: on each row its slope is that row's rate.",
        ],
      },
    ],
    pitfalls: [
      "Tax each slice at its own rate; do not tax all income at the top row's rate.",
      "The first slice is taxed too, at the first rate.",
      "Subtract a deduction from income before using the table, not from the tax.",
    ],
    parentGuide:
      "Make a two-row table with the learner and find the tax on an income that reaches the second row, then ask why one rate does not apply to all of it.",
  },
  {
    id: "payroll-property-tax",
    title: "Payroll, sales and property tax amounts",
    summary:
      "A percent tax takes that many hundredths of an amount; property tax often charges a rate for each 100 dollars of value.",
    templateIds: ["payroll-property-tax"],
    objectives: [
      "Find a percent tax, net pay after two withholdings and a sales total with an exempt item.",
      "Find a property tax from a rate per 100 dollars of value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A tax is a part of an amount",
        paragraphs: [
          "A tax of 8% takes 8 hundredths of an amount. Withheld means taken out of pay before the worker receives it. An item that is exempt is not taxed, but it is still paid for at its price.",
          "A property tax is often stated per 100 dollars of value: for example, 1.20 dollars for every 100 dollars. To use it, count how many hundreds the taxable value holds, then multiply by the rate.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A county charges 1.20 dollars of property tax for each 100 dollars of taxable value. A home has a taxable value of 150,000 dollars. What is the yearly tax?",
      steps: [
        "Count the 100-dollar units: $150{,}000\\div100=1{,}500$.",
        "Charge 1.20 dollars for each: $1{,}500\\times1.20=1{,}800$.",
        "Check by percent: 1.20 per 100 is 1.2%, and $150{,}000\\times0.012=1{,}800$.",
      ],
      answer: "1,800.00",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Other cases",
        paragraphs: [
          "Net pay with two withholdings: subtract both taxes from gross pay, or multiply gross pay by 1 minus the two percents as hundredths. With 8% and 12% withheld from 400 dollars, net pay is $400\\times(1-0.20)=320$ dollars.",
          "A sales tax on one taxable item: tax only that item's price, then add every price and the tax. An exemption lowers taxable property value first: subtract it before counting hundreds.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas",
        paragraphs: [
          "A tax of $p\\%$ on amount $A$ is $Ap/100$. A property tax of $k$ dollars per 100 dollars on taxable value $V$ is $kV/100$. The stated percents and rates here are for practice; real rates differ by place and year.",
        ],
      },
    ],
    pitfalls: [
      "Divide a percent by 100 before multiplying.",
      "Tax only what the rule taxes; exempt items are still paid for.",
      "Property tax per 100 dollars is not per 1,000 dollars.",
    ],
    parentGuide:
      "Use a real receipt and pay stub: ask the learner to recompute one tax line from its stated rate.",
  },
  {
    id: "budget-percent-share",
    title: "Budget shares as percents",
    summary:
      "A category's share of a budget is its part divided by the whole, written as a percent.",
    templateIds: ["budget-percent-share"],
    objectives: [
      "Find a category's percent of a budget, and a dollar amount from a percent.",
      "Combine fixed and variable expenses and savings.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Parts of one whole",
        paragraphs: [
          "A budget plans how income is used. Fixed expenses stay the same each month, such as rent. Variable expenses can change, such as food or fun. Savings is money set aside. A category's share is its part divided by the whole budget, written as a percent.",
          "In a complete budget every dollar is planned, so the shares add to 100%.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A monthly budget of 800 dollars plans 320 dollars for rent, 160 for food, 80 for transport, 80 for fun and 160 for savings. What percent of the budget is rent?",
      steps: [
        "The whole is 800 dollars and the part is 320 dollars.",
        "Divide the part by the whole: $320\\div800=0.40$.",
        "Write 0.40 as a percent: 40%.",
        "Check: $0.40\\times800=320$. The other shares are 20%, 10%, 10% and 20%; with 40% they add to 100%.",
      ],
      answer: "40%",
    },
    closingSections: [
      {
        stage: "method",
        title: "Groups, missing shares and deficits",
        paragraphs: [
          "To find a group's share, such as all fixed expenses, add their amounts first, then divide by the total. To find a dollar amount from a percent, multiply the total by the percent as hundredths. A missing share is 100% minus the others.",
          "If expenses are more than income, they are more than 100% of income. Expenses of 440 dollars on an income of 400 dollars are $440\\div400=1.10$, or 110% of income.",
        ],
      },
      {
        stage: "formal",
        title: "Share of a whole",
        paragraphs: [
          "The share of part $A$ in total $T>0$ is $100A/T$ percent. A part with share $s\\%$ is $sT/100$. Shares of all parts of a whole sum to 100%.",
        ],
      },
    ],
    pitfalls: [
      "Divide by the whole budget, not by the rest of it.",
      "Add the group before dividing.",
      "Expenses larger than income are more than 100% of income.",
    ],
    parentGuide:
      "List the family's or learner's monthly spending in three groups (fixed, variable, saved) and find what percent each group is.",
  },
  {
    id: "net-worth-statement",
    title: "Assets, liabilities and net worth",
    summary:
      "Net worth is total assets minus total liabilities, and it can be negative.",
    templateIds: ["net-worth-statement"],
    objectives: [
      "Sort items into assets and liabilities.",
      "Find net worth and decide how a transaction changes it.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Owned and owed",
        paragraphs: [
          "An asset is something a person owns that has value, such as savings or a bicycle. A liability is money the person owes, such as a loan or a bill not yet paid.",
          "Net worth is what would remain if every asset were turned into money and every liability paid: total assets minus total liabilities. If a person owes more than they own, net worth is negative.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A person has a savings account of 600 dollars, a bicycle worth 150 dollars, a phone worth 250 dollars, a loan from family of 400 dollars and an unpaid phone bill of 80 dollars. What is the net worth?",
      steps: [
        "Assets are what is owned: $600+150+250=1{,}000$ dollars.",
        "Liabilities are what is owed: $400+80=480$ dollars.",
        "Net worth = assets − liabilities = $1{,}000-480=520$ dollars.",
      ],
      answer: "520",
      answerUnit: "dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Transactions",
        paragraphs: [
          "To see how a transaction changes net worth, find its effect on assets and on liabilities. Paying 100 dollars from savings toward a loan lowers assets by 100 and liabilities by 100, so net worth is unchanged: $520-100-(480-100)=520$. Spending 100 dollars on something used up lowers assets by 100 with no change in liabilities, so net worth falls by 100.",
          "If total assets are 900 dollars and net worth is −200 dollars, liabilities are $900-(-200)=1{,}100$ dollars.",
        ],
      },
      {
        stage: "formal",
        title: "Relationship",
        paragraphs: [
          "Net worth $N=A-L$. A transaction changing assets by $\\Delta A$ and liabilities by $\\Delta L$ changes net worth by $\\Delta A-\\Delta L$.",
        ],
      },
    ],
    pitfalls: [
      "Subtract liabilities; do not add them.",
      "A negative net worth means liabilities are larger than assets.",
      "Using savings to pay a debt does not change net worth.",
    ],
    parentGuide:
      "Have the learner list what they own and owe, find the net worth, and then say what happens to it when they buy something with savings.",
  },
  {
    id: "incentive-compare",
    title: "Compare coupons, discounts and rebates",
    summary:
      "Find the final cost under each offer, using stated order for combined offers, and compare.",
    templateIds: ["incentive-compare"],
    objectives: [
      "Compare a coupon, a percent discount and a rebate by final cost.",
      "Apply a percent discount and a coupon in a stated order.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three ways to save",
        paragraphs: [
          "A coupon takes a stated number of dollars off. A percent discount takes a share of the price off. A mail-in rebate returns money after the purchase; the full price is paid first. To compare, find each offer's final cost.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A jacket costs 80 dollars. Offer A is a coupon for 10 dollars off. Offer B is 20% off. Offer C is a rebate of 12 dollars after paying full price. Which offer gives the lowest final cost?",
      steps: [
        "Coupon: $80-10=70$ dollars.",
        "Percent discount: 20% of 80 is $80\\times0.20=16$, so the cost is $80-16=64$ dollars.",
        "Rebate: $80-12=68$ dollars.",
        "The lowest final cost is 64 dollars, from the percent discount.",
      ],
      answer: "The percent discount, 64 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Two offers in a stated order",
        paragraphs: [
          "A percent is taken from the price it is applied to, so the order matters. With the 20% discount first, then the 10-dollar coupon: $80-16=64$, then $64-10=54$ dollars. With the coupon first, then the discount: $80-10=70$, and 20% of 70 is 14, so $70-14=56$ dollars.",
          "To compare two stores, find each store's final price, then subtract the lower from the higher.",
        ],
      },
      {
        stage: "formal",
        title: "Final cost formulas",
        paragraphs: [
          "For price $P$: coupon $a$ gives $P-a$; $p\\%$ off gives $P(1-p/100)$; rebate $b$ gives $P-b$. Percent first then coupon gives $P(1-p/100)-a$; coupon first then percent gives $(P-a)(1-p/100)$. They differ by $ap/100$.",
        ],
      },
    ],
    pitfalls: [
      "Compare final costs, not just the size of each discount.",
      "A rebate is received after paying the full price.",
      "Follow the stated order when a percent and a coupon are combined.",
    ],
    parentGuide:
      "At a store or on a flyer, ask the learner to compute the final price under two different offers and say which is lower.",
  },
];
