# Money and financial literacy, part 2: per-type concepts

Ten types, from the family design. Each stands on the foundations numbered in that design and names them in one line rather than re-teaching. Where a type is misfiled or badly conceived, that comes first.

---

### Grade 2: money-values (2.MD.C.8)

**`money-left-story` — Count the coins, then spend.** Foundations 1, 2, 4.

**Standard.** 2.MD.C.8, "Solve word problems involving ... quarters, dimes, nickels, and pennies, using ... ¢ symbols appropriately"; 2.OA.A.1, "taking from" with the result unknown. The standard asks for "unknowns in all positions"; the app only ever hides the result (never what was spent, never what she started with). Gap for the alignment list.

**Foundations first.** Before the story: the four coins at true size with their worth shown once as blocks (penny a square, nickel five squares, dime a rod, quarter a quarter of the flat), so the dime, the smallest coin, is seen to be worth more than the nickel. Then the one rule for counting a handful: biggest first, and the total jumps by the coin's worth, never by one. Then the word that runs the story: "left" means money went out; what is left is the rest of what you had, so it is smaller.

**Read.** "Has these coins and buys a pencil for 35¢. How many cents left?" Two jobs: how much is in the hand, then take the price out. "Left" goes gold. At a glance: the answer is in cents, and it is smaller than the coins' total.

**The example.** The app's own coin picture: 1 quarter, 1 dime, 1 nickel, 3 pennies; price 35¢. (1) The coins slide into a row, biggest first, each getting its tag as it lands; the total ticks 25, 35, 40, 41, 42, 43, and each count is a hop on a number line 0 to 50 beneath, a long arc for the quarter, short arcs for the pennies. The hand holds 43¢. (2) Above the line, the money bar from 0 to 43, labeled "43¢". (3) The price: a mark at 35; the part of the bar from 0 to 35 turns rust and slides away. "Left" is the piece from 35 to 43, marked "?". (4) Read the gap by counting up from the price, the way a cashier does: 35 to 40 is a nickel hop, +5; 40 to 43 is three penny hops, +3; 5 and 3 is 8. (5) 8¢.

**Fast.** Count the coins biggest first; then count up from the price to the total. The hops you draw are the answer.

**Sense.** The piece that stays is shorter than the piece that left; 8 is small, and 35 was most of 43.

**Check.** Add back: 8 + 35 = 43, shown as the same hops in the other direction.

**Line.** "Money out: what is left is the gap from the price up to what you had."

**Trap.** Adding the two numbers because there are two (43 + 35 = 78): "left" is gold and the rust piece visibly leaves, so the answer cannot be bigger than 43. And 43 − 35 answered as 12 (taking the small digit from the big one in each column): the count-up never touches columns; it only lands on 40 and then 43.

**Kit.** `money.count` with `line` hops on `numberline`; the story bar drawn on the number line's own scale (its two ends at 0 and at the total) so the price mark cuts the bar and the line at once; `take` for the rust part; count-up arcs from a mark to the total. Nothing new beyond the family's tools except putting the bar and the line on one scale.

**Writer.** A capable cheaper model: one story, one picture, named actions.

---

**`wallet-purchase-chain` — Total first, then take the coupon or the price.** Foundations 3, 4; place value's "line up the point".

**Misfiled.** Filed in grade 2 under 2.MD.C.8; it is dollars and cents with carries and trades: 4.MD.A.2, "Use the four operations to solve word problems involving ... money, including problems involving ... decimals." The grade-2 link should be removed. The answer key stores 47.2 for 47.20; the checker must accept 47.20, since the lesson writes cents with two places and would otherwise contradict the app.

**Foundations first.** A dollar is a hundred cents, so cents are hundredths and always get two places; a whole dollar is written 5.00. Cents under cents, dollars under dollars: the stack with its headers and point line, named once as what place value built. A coupon is money off the total, after the total. Picture: the story bar with its parts.

**Read.** Both stories are "find the total, then take something out of it." The coupon story: two prices join, then "off her total" (gold) leaves. The wallet story: bills and coins are counted into a total, then the price (gold) leaves. At a glance: the answer is less than the total and has two places of cents.

**The example (coupon).** "Student F buys a puzzle for 18.55 dollars and a card game for 37.75 dollars. Coupon 8.95 off her total. How much does Student F pay?" (1) Bar: two teal parts, 18.55 and 37.75, bracketed "total ?". (2) Stack, headers dollars | cents, unit $: 18.55 + 37.75; hundredths 5 + 5 = 10, write 0 carry 1; tenths 5 + 7 + 1 = 13, write 3 carry 1; ones 8 + 7 + 1 = 16; tens 1 + 3 + 1 = 5: 56.30. The bracket reads 56.30. (3) The coupon: a rust part 8.95 at the right end turns and slides off; the rest is "?". (4) Stack 56.30 − 8.95 with trades across the point: 0 − 5, trade a tenth, 10 − 5 = 5; 2 − 9, trade a one, 12 − 9 = 3; 5 − 8, trade a ten, 15 − 8 = 7; 4: 47.35. (5) She pays 47.35.

**Second example (wallet), a different act: counting worth and a cent total past a dollar.** "Student H's wallet: 2 five-dollar bills, 4 one-dollar bills, 3 quarters, 5 dimes, 6 nickels. Buys a book for 7.15. How much left?" Bills first: 5, 10, 11, 12, 13, 14 dollars. Coins biggest first: 25, 50, 75; 85, 95, 105, 115, 125; 130 ... 155 cents. A hundred cents becomes a dollar on the word: 155¢ = $1.55. Wallet 14 + 1.55 = 15.55. The price slides off; 15.55 − 7.15 = 8.40, stacked; 8.40, not 8.4, said once.

**Fast.** Total first; then take. Line up the point; a whole dollar gets .00.

**Sense.** About 19 + 38 = 57, less about 9: around 48. Wallet about 15 and a half, less 7: about 8 and a half.

**Check.** Add back: 47.35 + 8.95 = 56.30; 8.40 + 7.15 = 15.55.

**Line.** "Total first. Then money off comes out of the total."

**Trap.** Adding the coupon because it is a third number: the rust part leaves the bar before the stack is written. Lining a whole-dollar coupon ("1 dollar off") under the cents: it is written 1.00 under the headers. In the wallet, 155 cents written as 15.5 or 1.5: the rename shows the hundred cents becoming the dollars digit and the two cent places staying.

**Kit.** `stack` with `unit: "$"` and whole-dollar padding on `zeros`; `money.count` for bills and coins with the total crossing 100¢ and `unit` rename; the story bar's join and `take`.

**Writer.** Strongest writer: two stories whose pictures must be staged, not described, and a rename across the dollar that is easy to fumble.

---

**`fixed-variable-expense-table` — Same amount every month, or not.** Foundation 6.

**Misfiled.** No Common Core standard; it is Texas's personal financial literacy strand (TEKS 4.10A, fixed and variable expenses; the text-extraction job should confirm the clause). It sits in the grade-2 skill `money-values`; move it to the proposed "earning, spending and saving" skill.

**Foundations first.** An expense is money going out each month. Fixed: the amount is agreed ahead, the same every month (rent, a phone plan, a car payment). Variable: the amount depends on how much you use or buy (groceries, electricity, gas for the car). Build the table live: months across, expenses down, a family's records filled cell by cell. Then the picture: one row becomes a row of bars to scale beside the table; equal amounts make bars of one height with a flat line across their tops; "fixed" looks flat. Any bar off the line and the row varies.

**Read.** "Mark each expense as one that varies or one that stays the same." With amounts: read across each row. Without amounts: ask of each, could the family know next month's amount today? At a glance: a row with any two different numbers varies; there is no "almost the same".

**The example (with amounts).** Rent 850, 850, 850, 850; Groceries 212, 240, 198, 231; Phone plan 45, 45, 45, 45; Gas for the car 64, 81, 58, 72. Row by row: the row's bars rise beside the table; Rent's four bars take one flat line: stays the same; Groceries' bars are ragged: varies; Phone plan flat: same; Gas ragged: varies. Each mark is set as its row is judged.

**Second case, quick: no amounts.** Car payment, Electricity, Movie tickets, Internet plan. The question is the agreement: a car payment and an internet plan are set ahead, the same each month; electricity depends on use, movie tickets on how often you go. Three or four beats.

**Fast.** Scan the row: one different number means it varies. No numbers: known ahead means fixed.

**Sense.** Fixed rows read like one number repeated; variable rows read like a list.

**Check.** Read each fixed row aloud: the same number every month. All four rows marked.

**Line.** "Fixed is flat: the same amount every month."

**Trap.** "Groceries are fixed, we buy them every month": fixed is about the amount, not the habit; the ragged bars decide. And calling 64, 81, 58, 72 "about the same": the bars are visibly different heights, and the line across their tops cannot be drawn.

**Kit.** `table` with `bars` for a row (equal heights get the flat line); the mark column filled on the word. Nothing else.

**Writer.** A capable cheaper model.

---

### Grade 5 skill, grade 4 content: financial-literacy-elementary

**`profit-cost-breakeven` — Fixed once, variable per item.** Foundation 6; family 7's equal groups; family 14's two plans meeting, met early.

**Misfiled.** Linked to 5.NBT.B.7 but whole dollars throughout; it serves 4.OA.A.3, "Solve multistep word problems posed with whole numbers ... including problems in which remainders must be interpreted," and TEKS 4.10B (profit). The generator never poses a break-even that does not divide evenly; the lesson gives that case one beat because the learner will meet it.

**Foundations first.** A mixed type: four questions under one name. Define in front of the learner, with the picture building as each word is said: a fixed cost happens once, however many you make (a cost bar, rust, that sits still); a variable cost happens per item (a small rust piece stacks onto the cost bar each time the count ticks); revenue is what comes in, price × number sold (a teal bar that grows by the price on the same tick); profit is revenue minus total cost (the overhang of teal past rust), a loss when the cost bar is the longer one; break-even is the count at which the two bars are equal. Beside the bars, a table: count | revenue | total cost | profit, filled as the count ticks 0, 1, 2 ... The grow motion is the whole lesson; every question is a reading of it.

**Read.** Four cue phrases, each gold when it appears: "total cost of making 12" (cost bar only, at count 12); "if 7 are made and all sold, what is the result" (both bars at 7, which is longer); "which cost is a variable cost" (the one that says "for each one made"); "how many more to reach the break-even number" (the count where the bars match, minus what is already sold). At a glance: total cost is more than the fixed costs alone; profit is less than revenue; a loss when the count is small.

**The example (result).** "Lemonade, 6 dollars each. Fixed: 16 for the stand, 18 for the sign. Each cup costs 4 to make. 7 cups made and sold: what is the result?" Choices: Profit of 8 | Profit of 20 | Loss of 20 | Profit of 14. (1) Fixed bar 16 + 18 = 34, placed once. (2) The count ticks 1 to 7; each tick stacks a 4 on the cost bar and grows the revenue bar by 6; the table fills row by row. At 7: revenue 42, cost 34 + 28 = 62. (3) The cost bar is the longer one by 20: loss of 20. Rule out, each named as the error it is: 8 is revenue minus the fixed costs, forgetting the cups cost money; 14 is 7 × (6 − 4), forgetting the fixed costs; 20 profit has the bars the wrong way round. Check: 62 − 42 = 20 on the table row.

**Quick cases, each on its own screen with the same picture.** Total cost: muffins, fixed 22 + 22 = 44, 3 each, 12 made: 44 + 36 = 80; decoys 564 (47 × 12, the fixed costs charged per muffin), 36 (variable only), 47 (the variable cost added once). Break-even: price 7, making cost 2, fixed 90, 7 sold so far: each muffin closes the gap by 7 − 2 = 5 (the two bars grow 7 and 2 on each tick; the gap bracket shrinks by 5); 90 ÷ 5 = 18 muffins to break even; 18 − 7 = 11 more; decoys 18 (the break-even count, not "more"), 25 (18 + 7), 7. One beat: if the fixed costs were 92, 92 ÷ 5 = 18.4, and you cannot sell part of a muffin; 18 still loses, so 19. Which is variable: "4 dollars for each one made" gold; the other three happen once; three beats.

**Fast.** Fixed once; variable × count; revenue = price × count; profit = revenue − total cost. Break-even: fixed ÷ (price − making cost), rounded up.

**Sense.** The cost bar always starts ahead by the fixed costs; a small count is a loss. Revenue 42 against fixed 34 plus 7 cups at 4: more than 42, so a loss before any arithmetic.

**Check.** Recompute the table row; break-even: 18 × 7 = 126 and 90 + 18 × 2 = 126, the two bars equal.

**Line.** "Fixed happens once. Variable happens per item."

**Trap.** All four decoy families are the real errors: fixed costs multiplied by the count; the variable cost added once; profit read as revenue; fixed costs forgotten at break-even. The grow motion makes them impossible: the fixed bar never moves while the small pieces stack.

**Kit.** `bar.grow` for two bars on one tick with a live gap bracket; `table.fill` and `equal`; `dim`.

**Writer.** Strongest writer: the staging of the grow motion and the decoys named as errors are the lesson.

---

**`tax-kinds-defined` — What is this tax a share of?**

**Misfiled.** Vocabulary, no Common Core standard; TEKS 5.10A (define income, payroll, sales and property tax; clause to be confirmed). Keep it short.

**Foundations first.** A tax is a share of some amount of money, paid to the government. Four kinds, each named by what it is a share of, drawn as four small bars with a rust slice: a year of pay (income tax, worked out on the whole year and reported on a return, even if some is taken from each paycheck); one paycheck, for set programs, Social Security and Medicare (payroll tax, withheld each payday); a price at the register (sales tax, added to what you pay); the value of land or a building you own (property tax, billed each year). The one question to ask of any description: what is this money a share of, and when is it taken?

**Read.** A description or an example; the words that give the base go gold: "year", "return"; "paycheck", "Social Security"; "receipt", "register", "price"; "land", "building", "owner", "value".

**The example.** "A book costs 20.00 dollars, and the receipt shows 21.60 because of an added percent of the price." The price bar 20.00; a rust slice 1.60 added at its end at the register; a share of a price, paid when buying: sales tax. Rule out: the three choices whose base is wrong dim together (no paycheck, no year of pay, no building). Three quick reads, one each: the pay stub with Social Security and Medicare withheld each paycheck (payroll); "earned 30,000 over the year and pays a share when filing a return" (income); "a yearly amount, based on its value, paid by the owner of land or a building" (property). Recap as a four-row table: kind | what it is a share of | when.

**Fast.** Find the base; the base names the tax.

**Check.** Read the chosen kind with its base aloud: "a share of the price, at the register: sales tax."

**Line.** "A tax is named by what it is a share of."

**Trap.** Payroll and income confused, since both come out of pay: payroll is a set share of each paycheck for Social Security and Medicare; income tax is on the whole year, settled on a return. The gold clue words decide.

**Kit.** Nothing new: four bars with slices, a table.

**Writer.** A capable cheaper model.

---

**`supply-price-choice` — Fewer than wanted, or more than wanted.**

**Misfiled.** Vocabulary and reasoning, no Common Core standard; TEKS 3.9B (scarcity and cost; clause to be confirmed). Note a template fault: one variant's fourth choice is cut off ("...people who wan"); the choice text or its pill must be fixed.

**Foundations first.** Supply is how many are for sale; demand is how many people want one. Two aligned bars to scale, "for sale" in teal and "want to buy" in blue, from a common start. Scarce: the want bar sticks out past the for-sale bar; those people go without, and some would pay more to get one, so the price goes up. Plentiful: the for-sale bar sticks out; those items sit unsold, and the seller drops the price to move them, so the price goes down. The overhang is the reason.

**Read.** Two numbers and a question with a reason. At a glance: which number is bigger? The answer is a direction and a reason that match.

**The example.** "A store has 20 bike helmets. 120 people want one." Bars 20 and 120, the want bar six times longer; the overhang bracketed "100 go without". Price goes up, because fewer are for sale than wanted. Rule out: "stays the same, does not depend" dims first, it is the belief the picture refutes; then the two whose reason says "more for sale than people" dim together, the bars show the opposite. Quick second case, the other direction: 80 pumpkins, 10 buyers; 70 unsold on the overhang; down.

**Fast.** Compare the two numbers. Smaller supply: up. Bigger supply: down. The reason is the comparison said in words.

**Check.** Read the chosen sentence aloud against the bars: direction and reason both true.

**Line.** "Fewer than wanted: price up. More than wanted: price down."

**Trap.** "More for sale means the price goes up, because they have more to sell": the overhang on the for-sale bar is unsold stock, and unsold stock gets marked down. The lesson says so at the pumpkins.

**Kit.** Two aligned bars with a bracketed overhang (family 8's compare). Nothing new.

**Writer.** A capable cheaper model.

---

### Grade 7: financial-literacy-middle (7.RP.A.3, 7.NS.A.3)

**`tax-bracket-owed` — Each rate on its own slice.** Foundations 7, 8.

**Standard.** 7.RP.A.3, "Use proportional relationships to solve multistep ratio and percent problems. Examples: ... tax"; 6.RP.A.3c, "find a percent of a quantity as a rate per 100."

**Foundations first.** A bracket table: rows are stretches of income, each with its own rate, and "each rate applies only to the part of the income that lies inside its row." Taxable income is what is left after a deduction. Build the picture live: a dollar line from 0 with the row boundaries as fixed cuts and the rate written in each stretch (the bracket bar); the table beside it, each row lighting as its stretch is drawn. Lay an income bar along the line: it is cut where it crosses the boundaries; each slice pays its own rate; the tax is the sum. Say the consequence once: a person earning 43,910 pays exactly the same on their first 10,000 as someone who earned 10,000. The whole income never pays the top rate.

**Read.** Five questions on one picture; the cue goes gold: "how much tax is owed" (sum the slices); "how many dollars taxed at the middle rate" (the length of the middle slice); "takes a deduction" (shorten the bar first); "exactly 16,000" (the bar ends on a cut; nothing spills into the next row); "a raise, still in the same row, how much more tax" (only the slice it lands in grows). At a glance: the tax is between the lowest rate and the highest rate taken on the whole; a slice is never longer than its row.

**The example (tax owed).** Table: up to 10,000 at 8%; 10,000 to 40,000 at 15%; over 40,000 at 35%. "Taxable income 43,910. How much tax is owed?" Choices: 1,368.50 | 5,768.50 | 6,668.50 | 15,368.50. (1) The income bar laid along the bracket line, cut at 10,000 and 40,000: slices 10,000, 30,000, 3,910, labeled; they sum to 43,910. (2) Under each slice its tax: 10,000 × 0.08 = 800; 30,000 × 0.15 = 4,500; 3,910 × 0.35 = 1,368.50 (stacked). (3) Add: 6,668.50. Rule out, named: 15,368.50 is the whole income at 35%, the misconception the tests target; 1,368.50 is the top slice alone; 5,768.50 has a slice at the wrong row's rate. Check: slices sum to the income; 6,668.50 is about 15% of 43,910, between 8% and 35%.

**Quick cases.** Middle slice: income 44,930 fills the whole middle row, so 30,000 are taxed at 15% (the slice is the row's width, not income minus the lower cut). Deduction first: earned 27,940, deduction 14,000: the bar loses 14,000 (rust, slides off) before it is laid on the line; 13,940 is cut into 10,000 and 3,940. Raise within a row: 700 more inside the 15% row grows only that slice: 700 × 0.15 = 105 more tax. One beat: an income of exactly 40,000 ends on the cut and the top row gets nothing.

**Fast.** Deduction first. Cut at the boundaries; slice × rate; add. A raise within a row: raise × that row's rate, always, since no other slice changes.

**Sense.** Between the lowest and highest rate on the whole; here between about 3,500 and 15,400.

**Check.** The slices add back to the income; each product recomputed.

**Line.** "Each rate on its own slice. The whole never pays the top rate."

**Trap.** The whole income at the top rate; only the top slice; the middle slice taken as income minus the lower cut; the deduction forgotten. The bar cut at fixed boundaries, with each slice labeled, ends all four.

**Kit.** `bar` with `cuts`, `slice`, `tax`; `take` for the deduction before slicing; the bracket `table` with rows that light as their slice is cut; `dim`. A cast is worth trying here: the student's "forty-three thousand nine hundred ten times thirty-five percent" is the real first thought, and the teacher cuts the bar.

**Writer.** Strongest writer: the slice insight must be staged against the exact misconception.

---

**`payroll-property-tax` — A percent of money is a share of the bar.** Foundation 7.

**Standard.** 7.RP.A.3, "multistep ratio and percent problems ... tax"; 6.RP.A.3c. The design worried the sales case might not be generated; it is (the jacket and groceries), so the goal's wording stands.

**Foundations first.** A mixed type: payroll tax, net pay after two taxes, property tax per 100, sales tax on taxable items only. Define on the percent bar (0 to 100% above, dollars below): a percent of money is that many hundredths of it; 1% is the amount divided by 100, and the rest is multiples of that. Gross pay is before taxes; net pay is what is left after every tax is taken out. "Per 100 dollars" is hundredths said another way. An exemption is a part of the value that is not taxed. Taxable items are the ones the tax applies to. The opening example is the plainest share: 4% of 850 gross: 1% is 8.50, 4% is 34.00 withheld (decoys 3.40 and 3,400 have the point in the wrong place; 816 is what is left, not the tax).

**Read.** The cue decides the story: "withheld" (the share); "net pay" (gross minus every share); "for each 100 dollars" and "exemption" (shorten, then count hundreds); "applies to clothing but not to groceries" (tax one item, then add everything). At a glance: a tax is a small part of the amount; net is under gross; the total with tax is a little over the prices.

**The example (net pay).** "Gross pay 440. Payroll tax 5% and income tax 13% of gross pay are withheld. What is the net pay?" Choices: 79.20 | 382.80 | 360.80 | 418.00. (1) The bar of 440. (2) Two rust shares of the same whole, both anchored to the original 100%: 5% = 22.00; 13% = 57.20; together 18% = 79.20 withheld. (3) The rest, 82%: 440 − 79.20 = 360.80, stacked; or 0.82 × 440 = 360.80, said as the same thing. Rule out, named: 79.20 is what was withheld, not what is left; 418.00 and 382.80 each took out only one tax. Check: 22.00 + 57.20 + 360.80 = 440.

**Quick cases.** Property: home 170,000, exemption 10,000: the value bar loses 10,000, leaving 160,000; a double number line, 100 → 1.25, 1,000 → 12.50, 10,000 → 125, 160,000 → 2,000; decoys 2,125 (no exemption), 200 and 200,000 (the point in the wrong place, per 1,000 or per 1). Sales: jacket 68, groceries 25, 6% on clothing only: 1% of 68 is 0.68, 6% is 4.08; total 68 + 25 + 4.08 = 97.08; decoys 98.58 (groceries taxed), 72.08 (groceries forgotten), 93 (no tax).

**Fast.** One percent first, then multiply. Two percents of one gross add; net is the remaining percent. Per 100: divide by 100, then multiply by the rate. Tax only what is taxable, then add everything.

**Sense.** 18% of 440 is about a fifth, about 90 off: net near 350. Property tax at 1.25 per 100 is about 1%: near 1,600. Tax on a 68 jacket is a few dollars.

**Check.** Taxes added back to net recover gross; 2,000 ÷ 1,600 = 1.25; 97.08 − 4.08 = 93 = 68 + 25.

**Line.** "A percent of money is a share of the bar. Net is what is left after every share."

**Trap.** Taking 13% of the pay left after the 5% (the problem says "of gross pay"; both shares are cut from the whole bar). The exemption forgotten; "per 100" read as a multiplier on the whole. The groceries taxed. The two anchored shares, the shortened value bar and the gold "clothing but not groceries" end them.

**Kit.** `bar.off` with two shares anchored to the original 100%; `take` for the exemption; the double number line (place value's `numberline` with two scales); `stack` with `$`; `dim`.

**Writer.** Strongest writer: three different pictures under one name.

---

**`budget-percent-share` — A category is a share of the income.** Foundation 7; family 10's percent bar.

**Standard.** 6.RP.A.3c, "Find a percent of a quantity as a rate per 100"; the reverse direction (what percent a part is of the whole) is ratio reasoning under 6.RP.A.3; TEKS 7.13B (budget percents). The clause "find the whole, given a part and the percent" is never practiced (gap already noted).

**Foundations first.** A budget splits one income into categories; drawn as the percent bar: 0 to 100% above, 0 to the income in dollars below, the same positions, so a category is a part of the bar read on either scale. The percents of a whole budget add to 100. Two directions and one check live on the bar: from percent to dollars (10% of the income is the income divided by 10; build the rest from tens and fives), from dollars to percent (part divided by whole, times 100), and the fact that a bar can run past 100%: expenses longer than the income stick out past the 100% mark.

**Read.** The cue decides the direction: "how many dollars go to" (percent to dollars); "what percent of the budget is" (dollars to percent); "expenses are what percent of the income" (expenses ÷ income, may pass 100%); "what percent goes to fixed expenses" (add the fixed categories first, then divide). At a glance: a category is less than the income; a percent under 100 unless the part is bigger than the whole; the complement (the rest) is not the part asked.

**The example (dollars to percent).** "A monthly budget of 740 dollars is planned as shown. What percent is Savings?" Savings 259. Choices: 65% | 35% | 15% | 54%. (1) The bar of 740 with its categories; Savings is the gold part, 259 on the dollar scale. (2) 10% of 740 is 74; 259 is 3 and a half of those: 30% is 222, 5% is 37, 222 + 37 = 259: the share scale reads 35%. (3) The sure way beside it: 259 ÷ 740 = 0.35 = 35%. Rule out: 65% is the rest of the bar, not Savings; 15% and 54% are not where 259 sits (check 15% of 740 is 111). Check: 0.35 × 740 = 259.

**Quick cases.** Percent to dollars: Fun is 15% of 440: 10% is 44, 5% is 22, 66 dollars; decoys 374 (the other 85%), 660 and 15 (the point in the wrong place; the percent written as dollars). Past 100%: expenses 805 against income 700: 700 is 100%, 70 is 10%, 35 is 5%; 805 is 115%; the expenses bar runs past the income's 100% mark by 15%; decoys 15% (only the overshoot), 85% (divided the wrong way), 1.1% (the decimal 1.15 misread). Fixed expenses of 820: add the fixed categories first (the table marks them, or the learner names them by the fixed-variable idea; read `facts.ts` for which), 328, then 328 ÷ 820 = 40%.

**Fast.** 10% first: divide by 10. Part ÷ whole for a percent. Combine categories before dividing.

**Sense.** 259 is about a third of 740, so about 33%; 66 is a bit over a tenth of 440; expenses bigger than income must be over 100%.

**Check.** The percent of the income recomputed gives the part; all the budget's percents add to 100.

**Line.** "Ten percent first. A part over the whole is its percent."

**Trap.** Dividing the wrong way (whole ÷ part); answering the overshoot (15%) when the question is the whole expenses (115%); the complement; the percent number read as dollars. The bar with both scales, and the second bar running past 100%, end them.

**Kit.** `bar` double scale with `over: true` for a second bar; the budget `table`; `dim`. Nothing new.

**Writer.** Strongest writer for the first wave (three directions, one past 100%); a cheaper model afterward from this concept, since every case is one bar with named marks.

---

**`net-worth-statement` — Own minus owe.** Foundation 9; family 3's signed line.

**Standard.** 7.NS.A.3, "Solve real-world ... problems involving the four operations with rational numbers"; 7.NS.A.1c, "subtraction of rational numbers as adding the additive inverse" when net worth is negative. TEKS 7.13C.

**Foundations first.** An asset is something owned that has value (cash, savings, a car, a bicycle); a liability is money owed (a car loan balance, a credit card balance, a student loan). Net worth is own minus owe. Build the statement live: a two-column table, assets and liabilities, each with its total. Then the weigh picture: the assets bar (teal) and the liabilities bar (rust) from one start; the overshoot is the net worth, with its sign; when the rust bar is the longer one, the overshoot is negative, and the line under the bars shows 0 and the negative value. Say the consequence: assets = liabilities + net worth, read straight off the bars. Then the second idea: money that changes form (cash into a thing worth the same, cash that pays off a debt, a thing bought on credit) leaves net worth alone, since both bars or one bar's parts move together; money that leaves the person's total (spent on something used up) lowers it.

**Read.** Cues: "what is the net worth" (own minus owe); "net worth is −300, total assets 5,850, what are the liabilities" (the rust bar is 300 longer); "how does the net worth change" (did value leave, or change form?); "which item is an asset" (a thing, not the money owed on it). At a glance: net worth is less than total assets; negative means owe is longer; a thing bought for its value is a swap.

**The example (net worth).** The statement: Assets: cash 450, savings 1,200, bicycle 300, laptop 1,000, total 2,950; Liabilities: credit card 800, phone loan 500, loan from a friend 1,200, total 2,500. Choices: 1,700 | −450 | 450 | 2,950. (1) Cells fill as read; a car loan balance would sit in the rust column though "car" is in the teal one, said once. (2) Totals: 2,950 and 2,500. (3) The bars from one start; the teal bar overshoots by 450: net worth 450. Rule out, named: 2,950 is the assets alone, liabilities forgotten; −450 has the sign backwards (own is longer); 1,700 puts an item on the wrong side. Check: 2,500 + 450 = 2,950.

**Second example, a different act: solving backwards with a negative.** "Total assets 5,850, net worth −300. What are the total liabilities?" Choices: 6,150 | 5,550 | 300 | −6,150. Bars: own 5,850; net worth negative means the owe bar is the longer one, by 300: liabilities 5,850 + 300 = 6,150. Written as assets = liabilities + net worth: 5,850 = L + (−300), L = 6,150. Rule out: 5,550 subtracted 300 as if the net worth were positive (then own would be longer); 300 is the gap, not the debt; a debt total is a positive amount, never −6,150.

**Quick cases.** Spends 650 from savings on concert tickets that are used up: the teal bar loses 650 and nothing replaces it; down 650. Buys a bicycle worth 250 with savings: 250 slides from "savings" to "bicycle" inside the teal bar; no change. Asset or liability: a car is a thing owned; a car loan balance is money owed on it.

**Fast.** Own minus owe. Backwards: liabilities = assets − net worth (a negative net worth adds). A change: what the assets gain or lose, minus what the liabilities gain or lose; a swap of equal value is zero.

**Sense.** Net worth under total assets; negative only when owe is longer; liabilities bigger than assets whenever net worth is negative.

**Check.** Liabilities + net worth = assets, both examples; a change recomputed on both bars.

**Line.** "Own minus owe. A swap of equal value changes nothing."

**Trap.** Adding liabilities instead of subtracting; subtracting a negative net worth as if it were positive (5,550); "any spending lowers net worth" (the bicycle); the car loan sorted as an asset because "car" is in it. The two bars from one start, and the piece sliding within the teal bar, end them.

**Kit.** `bar.weigh` with the signed overshoot and the 0 mark; a piece that slides between labeled parts of one bar; the two-column `table` with totals (`totals: true` exists). The generator values a purchased item at its price; if any variant values it lower, the lesson's "swap" beat must say so; the writer reads `facts.ts` for this.

**Writer.** Strongest writer: the sign reasoning and the "how does it change" cases are staged on the bars or they are nothing.
