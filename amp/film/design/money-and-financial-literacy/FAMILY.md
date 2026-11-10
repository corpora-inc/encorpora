# Money and financial literacy, grades 2 to 7: family design

Three skills, 21 problem types, plus the arrivals other designs have already sent this way: `money-decimal-story` (split), `budget-category-balance`, `gross-net-pay`, `gross-net-sentence`, `price-count-chain`, `lifetime-income-salary` from place value, and `loan-total-cost`, `loan-compare-options` from family 14. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts`, snapshot 2026-11-09. This design covers the idea, the ladder, the pictures, the tools, the seam, the fixes, the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Money is an amount, not a pile of things. A dime is one coin and ten cents; a dollar is one bill and a hundred cents; a tax is a share of a paycheck. Once the child counts by worth instead of by piece, every question in this family, from a handful of coins to a net-worth statement, is the same running total: **what came in, what went out, what is left.** The words change with the grade (price, change, expense, cost, tax, discount, liability) and the arithmetic grows (counting, subtraction, multiplication, percent, signed numbers), but the picture a child sketches never does: one bar for what you have, a part that leaves, the rest labeled.

Nine foundations, in the order they are built. Each later lesson names the one it stands on in one line; none re-teaches it.

1. **A coin is worth a count, not one.** (Grade 2; from family 1's skip counting and family 2's unitizing.) Five coins and the dollar are named by what children really use to tell them apart (the penny's copper color, the dime's small size and ridged edge, the nickel's thick smooth edge, the quarter's size) and each is given its worth as a picture at one scale: penny a square, nickel five squares in a row, dime a rod, quarter a quarter of the flat, dollar the flat. The dime is the smallest coin and worth more than the nickel: the picture of worth decides, never the metal.

2. **Biggest first, running total.** (Grade 2; family 6's counting on.) Sort by worth, count the quarters by 25, then dimes by 10, nickels by 5, pennies by 1. The total changes by the coin's worth each time, never by one. Big hops first, little hops to land exactly.

3. **A dollar is a hundred cents; cents are hundredths of a dollar.** (The fact in grade 2, the notation in grade 4; family 2's foundation 9.) 45¢ and $0.45 name one amount; ¢ follows the number, $ leads it. Cents always get two places: two dollars and six cents is 2.06, never 2.6. Every hundred cents becomes a dollar: 128¢ is $1.28. "How many more make a dollar" is the empty part of the flat (family 6's missing part).

4. **Money in, money out, what is left.** (Grade 2, used to grade 7; family 8's bar.) Every story here is one bar. In: income, a gift, a deposit, money taken in, what you own. Out: a price, an expense, a withdrawal, a cost, a tax, a discount, what you owe. Change is the part of the payment that comes back. "How much more is needed" is the gap between two bars. Credit is the item in now and a debt bar beside it until it is paid. The sense check is always a direction: what is left is less than what you had; a total is more than any part; change is less than the payment.

5. **Fewest coins: nothing left to trade up.** (Grades 2 to 4; family 2's foundation 3, the fuse.) Five pennies trade for a nickel, two nickels for a dime, two dimes and a nickel for a quarter, four quarters for a dollar; every trade keeps the amount and drops the count. A set with no trade left is the fewest, and it is exactly what "biggest coin that fits, first" builds. Counting up from the cost to the payment the way a cashier does gives the change and its coins in one motion, and the same count.

6. **Once, or per item.** (Grades 4 to 5; family 7's equal groups.) A fixed expense or cost is the same every month, or however many you make; a variable one changes with how much. Revenue is price × count; variable cost is cost-each × count; total cost is fixed + variable; profit is revenue − total cost, a loss when it is negative; break-even is the count where the two bars are equal (family 14's two plans meeting, met early with a count). Pay per month × months, pay per year × years, and a loan's total paid are the same multiplication.

7. **A percent of money is a share of the bar.** (Grade 7; family 10.) Tax, discount, payroll, a budget category: p% of an amount is p hundredths of it. What remains after p% off is (100 − p)%. Two percents of the same whole add. "1.25 dollars per 100 dollars" is hundredths said another way. A bar can run past 100%: expenses of 805 against an income of 700 stick out to 115%.

8. **Each rate on its own slice.** (Grade 7.) Bracket tax cuts the income at fixed boundaries; each slice pays its own rate; the tax is the sum of the slices. The whole never pays the top rate.

9. **Own minus owe.** (Grade 7; family 3's signed line.) Assets − liabilities = net worth, negative when you owe more than you own. Money that changes form (cash into a thing of equal value, cash that pays off a debt, a thing bought on credit) leaves net worth alone; money that enters or leaves the person's total moves it. Track both sides.

What this family gives back: the bar as a budget to family 10 and 14, cents-as-hundredths to family 2, percent-of-pay to family 16 (interest), signed net worth to family 3.

---

## 2. The visual language

Four pictures, all already in the curriculum's ten: the coins and their worth (P2), the number line with coin hops (P3), the money bar (P4), and the table. Column arithmetic is the stack with the point line, as place value built it. Every picture is to scale, labeled, and one a child can sketch.

### The coins and bills, and their worth

Coins and bills are drawn as the app draws them, at true relative size (penny 19 mm, nickel 21, dime 18, quarter 24; a bill 156 × 66), copper for the penny, ridged edges on the dime and quarter, the real numeral on a bill and never a numeral invented on a coin face. A value tag (25¢) appears beside a coin at the moment it is counted, not before, so the face is recognized and the worth is read.

Worth is drawn in the place-value blocks, at the blocks' scale:

| Coin | Worth picture | Why that shape |
|---|---|---|
| penny | one square | one cent |
| nickel | five squares in a row (half a rod) | two nickels are a dime |
| dime | a rod | ten pennies; a tenth of a dollar |
| quarter | a 5 × 5 block, a quarter of the flat | four quarters tile the dollar |
| dollar | the flat | a hundred cents, the whole |

The sketch: the coins written as numbers in order, largest first, with the running total: 25, 50, 60, 70, 75, 76.

### The number line with coin hops

The place-value `numberline`: two labeled ends, ticks, the step on an arc. Here each hop is a coin: an arc labeled +25¢, +10¢, +5¢, +1¢, drawn to the hop's length, so a quarter is visibly a long hop and a penny a short one. Counting a set is hops from 0, biggest first. Counting change is hops from the cost up to the payment, cents first; when the hops become dollars the line zooms out and keeps the point fixed. Making a dollar is the hop from the coins' total to 100.

### The money bar

Family 8's part-whole bar, to scale, parts labeled, a bracket for the total, "?" for the unknown, two bars aligned on a common start when two amounts are compared. In this family it has six shapes, all the same object:

- **Have / spend / left.** One bar; the price part turns rust and slides away; the rest is labeled.
- **Payment and change.** The payment bar; the cost part; the change is the rest.
- **Have against need.** Two aligned bars; the gap is "how much more".
- **Once and per item.** A fixed-cost bar sits once; a variable-cost piece stacks on for each item made while a count ticks; a revenue bar grows beside it by the price per item. Where they are equal is break-even; beyond it the gap is profit, before it loss.
- **The percent bar.** Family 10's bar: 0% to 100% above, dollars below, the same positions (the kit's `bar` with its double scale). A percent off is a rust share that slides off and the remainder is read; a coupon is a fixed length on the dollar scale taken after. Two taxes from one gross are two rust shares; net is what is left. A second bar on the same scale can run past 100%.
- **The bracket bar.** A dollar line from 0 with the bracket boundaries as fixed cuts and the rate written in each stretch; the income bar laid along it is cut where it crosses the boundaries; each slice is labeled with its length and its tax; the tax is the sum.

Assets and liabilities are two aligned bars (own in teal, owe in rust); the overshoot is net worth, labeled with its sign, and when the rust bar is the longer one the overshoot is negative and the line under it shows 0 and the negative value. Supply and demand are two aligned bars too (for sale against wanting to buy); the overhang says which way the price goes. Monthly expenses from a table become a row of bars; a fixed expense is a row of equal heights with one flat line across their tops.

The sketch: a bar with a line through it, the parts labeled, "?" on the unknown.

### The table

Months across, expenses down; count, cost, revenue, profit down; the bracket table; the budget with its percents; the net-worth statement in two columns with totals; two stores side by side. Cells fill on the word that names them; a row can become bars; two equal cells light together. The kit's `table` from `independence-test` with small additions (section 4).

### Color means one thing each

- **teal**: money you have, money coming in, what you own, revenue, the set being counted.
- **rust**: money going out or owed: a price, a tax, a discount, a cost, a liability, coins traded in.
- **gold**: the one thing being looked at now: the cue word in the problem, the coin being counted, the slice in question, the column where two numbers differ. One gold thing at a time.
- **blue, violet**: a second and third option being compared (Set B and C, Store B, the second plan). Never for in or out.
- **muted**: choices ruled out, empty parts, placeholder zeros.

### The motions, and what each one proves

- **Count** (largest first): coins slide one at a time from a scattered pile into a sorted row, each getting its tag as it lands, the total ticking by that worth, a hop drawn on the line beneath. Foundation 2: the total jumps by 25 for one coin.
- **Worth**: a coin morphs into its blocks beside it, once per lesson that needs it; every coin's worth tiles onto one flat, so the empty cells are what is missing to make a dollar. Foundations 1 and 3.
- **Trade up**: five pennies slide together and fuse into a nickel; two dimes and a nickel into a quarter; four quarters into a dollar. The total label never changes; the piece count drops by one each time. Foundation 5.
- **Count up**: from the cost, a coin appears with each hop to the next round mark (pennies to a 5 or 10, a nickel or dime to a quarter mark, quarters to a dollar, bills to the payment); the change lands in its own row with its total. Change as the gap, and its fewest coins, in one picture.
- **Rename**: every tag rewrites between cents and dollars on the word (128¢ becomes $1.28; the hundred cents become the 1). Foundation 3.
- **Take**: a part of the bar turns rust and slides off; the rest is labeled. **Fill**: the "?" part of a bar or flat fills and shows its value. **Compare**: two bars align and the gap is bracketed. Foundation 4.
- **Grow**: a variable piece stacks on per item as the count ticks, a revenue bar grows beside it; the frame where they match is held. Foundation 6.
- **Share**: a percent of the bar shades, the dollars read under it; **off** slides the share away and reads the rest. Foundation 7.
- **Slice**: the income bar is cut at the fixed boundaries; each slice's tax is written under it; the slices are summed. Foundation 8.
- **Weigh**: the liabilities bar lays over the assets bar from the same start; the overshoot is net worth with its sign. Foundation 9.
- **Dim**: ruled-out choices fade together in one beat with the one reason said aloud.

---

## 3. How lessons in this family go

Most of these types are **mixed**: one name over several stories (change, total, still needed, unknown cost; profit, total cost, break-even, variable cost; payroll, sales, property). The lesson teaches reading, as AUTHORING says: one example per kind, the picture acting out the story, the recap naming each kind by what happens, never a recipe recited across kinds.

Every film builds the five habits in this family's terms:

1. **Read.** The problem exactly as the app shows it, with its choices. The cue word goes gold and is turned into plain words about money: "in all" and "total" (in, together), "left" and "change" and "still needs" (out, the rest, the gap), "each" (per item, multiply), "fewest" (trade up), "off" (out, a share), "net" (what is left after everything is taken out), "owe" (rust). One beat says what the answer must look like: cents, or dollars with two places; a count of coins; a name; a percent.
2. **At a glance.** Pennies set the ones digit, so a set for 45¢ needs exactly 0 or 5 pennies; a set with a bill beats any set of coins; a quarter is more than two dimes; change is under the payment; net is under gross; the final cost with a discount is under the price; a bracket slice is shorter than the income; a share is less than the whole; net worth is negative when owe is longer.
3. **The sure fast way.** Biggest first, running total. Count up from the cost. Pad to two places and stack on the point. Fixed once, variable × count, then subtract. Percent of the bar, or keep the remaining percent; follow the order the problem states; two percents of one gross add. Per-100 rate: divide the value by 100, then multiply. Slice first, then rates. Own minus owe. Never a shortcut that sometimes fails: "the set with more coins is worth more" and "30% off beats $15 off" are both false, and the lesson says so where the child would reach for them.
4. **Sense.** Always a direction, before the answer is boxed: less than what you had; more than each part; under the payment; under gross; under the price; under the income; the right sign.
5. **Check.** The inverse: recount from the smallest coin; change + cost = payment; left + price = had; coins' total against the price for "exactly"; cost × count against the table; slices sum to the income; deductions added back to net recover gross; assets = liabilities + net worth; final costs of both stores recomputed. For a choice, read the chosen statement aloud and ask if it is true in the story.

**Ruling out.** Direction first: any change larger than the payment, any "left" larger than what was had, any net larger than gross, any final cost above the price, any slice larger than the income, dims in one beat. Then form: a value with no ¢ or $, ¢ before the number, a dollar amount with one place, the percent given as dollars. The remaining decoys are the misconceptions (47 dollars is fixed + 3; 564 is 47 × 12; 15,368.50 is the whole income at the top rate; 73.50 is the coupon taken first; 5,550 is the negative subtracted as if positive): name each as the mistake it is while it dims.

**Realistic misconceptions, and the picture that ends each.** These are what children actually do, not slots filled.

- *Grade 2.* Counting coins as ones (four coins, four cents): the tag and the total jumping by 25. Thinking the nickel is worth more than the dime because it is bigger: the worth blocks beside both coins. Carrying on by the old coin's count after the coin changes (25, 50, 75, 100 for three quarters and a dime): one hop per coin, labeled by that coin. Writing ¢25 or $25 for a quarter, 1.5 for a dollar and five cents: the rename motion with two places always. Answering the coins' total when asked how many more make a dollar: the empty cells of the flat are the answer. Adding the price when the story says "left" because two numbers are there to add: the take motion.
- *Grade 4.* Lining up 5 and 1.15 by the last digit: the stack's headers and the point line; a bill is written 5.00. Giving change for one item when two were bought: total first, then change, on the payment bar. Adding a coupon: it is a rust part that leaves. In fewest coins, using two dimes and a nickel for a quarter, or forgetting to count the bills: the trade-up fuse and the count-up that lands on the dollars.
- *Grade 5.* Profit as the money taken in: the cost bar beside the revenue bar. Fixed cost multiplied by the count, or variable cost added once: the grow motion stacks the variable piece per item while the fixed bar sits still. "Groceries are fixed because we buy them every month": fixed means the same amount, shown by the flat line across equal bars. Credit as a debit card or paying cash: the item comes home and a rust debt bar appears beside it. The price going up when more is for sale: the overhang on the supply bar is unsold items. Sales and income tax confused because both are "a percent": the tax is named by what it is on (a purchase, a paycheck, a building), gold on that word.
- *Grade 7.* The whole income at the top rate, or only the top slice: the bracket bar with the slices summed. Answering the amount withheld when asked the net; taking 13% of the pay after 5% was removed: two rust shares of one gross on one bar, then the rest. Forgetting the exemption; "per 100" read as per 1 or per 1,000: the value bar loses its exemption first, then the double number line 100 → 1.25, 1,000 → 12.50, 10,000 → 125. Coupon before percent when the problem says percent first; 30% read as $30: the percent bar shrinks by a share, then by a fixed piece, in the stated order. Dividing the wrong way for "expenses as a percent of income", or answering the excess (15%) for the total (115%): the expenses bar running past the income bar's 100% mark. Adding liabilities, or subtracting a negative net worth as if positive: the weigh motion, with assets = liabilities + net worth read off the bars.

**Lines to remember.** "Count by worth, not by coin." "Biggest first." "A dollar is a hundred cents; cents get two places." "Money in, money out, what is left." "Change: count up from the cost." "Fewest coins: nothing left to trade up." "Fixed happens once; variable happens per item." "Percent off: take the share, keep the rest." "Each rate on its own slice." "Own minus owe."

**Voice.** Grade 2 lessons say "cents" and "dollars", never "decimal"; nothing is struck out; the problem is read slowly with the coins in view. Grade 7 lessons may use the cast where a real first wrong thought drives the lesson (the student says "forty-four thousand times twenty-five percent" and the teacher cuts the bar); otherwise one voice.

---

## 4. Tools to build

**Exists.** `stack` with headers and the point line (`decimal-sum-difference`); `blocks` (`tenths-as-hundredths`); the percent `bar` with its double scale, partition, shade and marks (`percent-amounts-blanks`); `table` with show, highlight and `given` (`independence-test`); the board, `watch`, `recap`; the app's `coins` figure through `scene`. **Specified by place value, needed here, specified separately:** `numberline` (drop, arcs, half, zoom), `dim`, and `money` (4.4, a sketch). **Coming from family 8 before this family's turn:** the part-whole bar (labeled unequal parts, bracket, "?", `take`, two bars aligned with a gap).

**New or extended for this family.**

### 4.1 `money`: coins and bills to scale with a running count

```json
{ "money": { "id": "m", "items": [ {"coin":"quarter","n":2}, {"coin":"dime","n":1}, {"coin":"nickel","n":1}, {"coin":"penny","n":3}, {"bill":1,"n":1} ],
  "layout": "scattered", "unit": "cents", "total": true, "title": "\\text{Set A}" } }
```

- Items at true relative size, the app's faces, copper penny, ridged dime and quarter, the printed numeral on bills, never a numeral on a coin face. Parts: `m.item.3`, `m.quarters` (every item of one kind), `m.tag.3` (an item's value tag), `m.total`, `m.count` (number of pieces). Several `money` parts side by side with titles are the three sets of a comparison.
- `unit`: `cents` (25¢, 76¢) or `dollars` ($0.25, $1.76). `{"do":"unit","to":"dollars"}` rewrites every tag and total on the word.
- `{"do":"count","order":"largest","n":1,"at":"fifty"}`: the next item slides into the sorted row, its tag appears, the total ticks by its worth; with `"line":"nl"` the same hop is drawn on a `numberline` part. One count per spoken number is the pattern. `"order":"given"` keeps the pictured order (for a set the child must count as drawn).
- `{"do":"worth","target":"m.item.2"}`: the item's blocks appear beside it at the blocks' scale (square, half-rod, rod, 5 × 5 block, flat). `{"do":"worth","target":"m","on":"F"}` tiles every item's worth onto a flat part `F`; the unfilled cells are what makes a dollar.
- `{"do":"trade","target":"m.pennies","into":"nickel"}` and `{"do":"trade","target":["m.item.4","m.item.5","m.item.6"],"into":"quarter"}`: the named items turn rust, slide together and fuse into one coin; `m.total` does not change; `m.count` drops.
- `{"do":"pay","target":"m.item.9","to":"P"}`: items slide to a point. `{"do":"change","from":1.15,"to":5.00,"line":"nl","at":"dime"}`: one hop per word; each hop makes the coin or bill that spans it appear and land in a change row with its own total; the line zooms out, point fixed, when hops become dollars.

### 4.2 `bar` additions (on top of family 8's story bar)

- `grow`: `{"do":"grow","target":"cost","by":3,"n":1,"at":"one"}` stacks one variable piece and ticks a count label; a second bar grows on the same word by its own step; `{"do":"hold","when":"equal"}` is simply the author pausing at the matching count. Parts: `cost.fixed`, `cost.var.4`, `rev.4`, `gap`.
- `off`: `{"do":"off","target":"b","share":0.30,"at":"thirty"}` shades the share rust and slides it off; the remainder's label rewrites; `{"do":"take","target":"b","amount":15}` removes a fixed length on the dollar scale. Two `off` shares from one whole stay anchored to the original 100%.
- A second bar on a shared percent scale may exceed 1 (`"over": true`), with marks past 100%.
- The bracket bar: `"cuts": [ {"at":10000,"rate":"10\\%"}, {"at":40000,"rate":"25\\%"} ]` draws fixed boundary ticks and the rate in each stretch of the line; `{"do":"slice","target":"b"}` cuts the bar at the boundaries it crosses and labels each slice with its length; `{"do":"tax","target":"b.slice.2","at":"seven"}` writes slice × rate under it.
- `weigh`: two aligned bars; `{"do":"weigh","targets":["own","owe"]}` brackets the overshoot with its signed value.

### 4.3 `table` additions

`{"do":"fill","target":"t.cell.2.3","text":"80","at":"eighty"}` writes a value into an empty cell on the word; `{"do":"bars","target":"t.row.1","at":"B"}` draws the row's numbers as bars beside the table to scale (equal heights get a flat line across); `{"do":"equal","target":["t.cell.4.2","t.cell.4.3"]}` lights two matching cells together.

### 4.4 Small ones

`numberline` arcs take a coin label (`"coin":"quarter"` draws +25¢ on the arc, to the hop's length). `stack` gains `"unit":"$"` (the sign before each row) and pads whole-dollar rows to two places on `zeros`. `dim` as specified in place value.

**Build order.** (1) `money`, `numberline` hops, `dim`: the nine grade-2 coin types and fewest coins. (2) Confirm family 8's story bar covers take, fill and compare for the dollars-and-cents stories; add `grow`. (3) `table.fill` and `bars`: fixed/variable, profit, budgets, net worth. (4) `off`, over-100%, the bracket bar, `weigh`: grade 7. The family's only large new piece is `money`; everything else is an action on a picture another family owns.

---

## 5. Which lessons need the strongest writer

**Strongest writer.** The mixed and reasoning types, where the lesson is the choice of example and the staging of a story, and a weak author describes the motion instead of acting it: `decimal-money-change` (four stories), `wallet-purchase-chain` (two), `early-money-decisions` (vocabulary plus a two-step cost), `staar-money-vocabulary` (credit defined by what happens), `fewest-coins-change` (count up and trade up in one lesson), `profit-cost-breakeven` (four questions, the grow motion, decoys that are each a real error), `tax-bracket-owed` (the slice insight), `payroll-property-tax` (three taxes, three pictures), `incentive-compare` (order of operations on a bar, and a comparison), `budget-percent-share` (three directions including past 100%), `net-worth-statement` (sign reasoning and "how does this change it", which needs `facts.ts` read closely for how the generator values a purchase), and the arrivals that are stories (`budget-category-balance`, `price-count-chain`, loans).

**A capable cheaper model from a finished concept, once the kit is complete.** One method, one picture, named actions, slips caught by `--dry`: `coin-name-and-cent-value`, `coin-total`, `money-total-dollars`, `make-a-dollar`, `pay-exact-coins`, `money-left-story`, `compare-money-sets`, `fixed-variable-expense-table`, `tax-kinds-defined`, `supply-price-choice`, `gross-net-pay`, `gross-net-sentence`, `lifetime-income-salary`. Require a complete concept, a fitting kit, and independent instructional review of every first-wave lesson.

---

## 6. What looks misfiled, badly conceived, or off grade; and what the standards ask that the problems never practice

**Misfiled, with a proposal.**

- `money-values` (grade 2, 2.MD.C.8) holds three strata. Keep the nine coin types in grade 2. Move `decimal-money-change`, `wallet-purchase-chain` and `fewest-coins-change` (a $5 bill against $1.15 is dollars and cents, 4.MD.A.2) into a grade-4 skill "dollars and cents stories", and merge the split `money-decimal-story` (totals and change; equal shares) into it. Move `staar-money-vocabulary`, `early-money-decisions` and `fixed-variable-expense-table` into a grade 3 to 4 skill "earning, spending and saving": they serve Texas's personal financial literacy strand (TEKS 3.9 credit and scarcity, 4.10 fixed and variable expenses and profit), not 2.MD.C.8, and the catalog should say so; the text extraction job should confirm the TEKS clauses.
- `financial-literacy-elementary` is linked to 5.NBT.B.7 but has no decimals: `profit-cost-breakeven` is whole dollars (4.OA.A.3; TEKS 4.10B), `tax-kinds-defined` and `supply-price-choice` are vocabulary (TEKS 5.10A, 3.9B). Link them to what they serve.
- `financial-literacy-middle` is 7.RP.A.3 and 7.NS.A.3 in part; the catalog should add TEKS 7.13 (A tax, B budget percents, C net worth, F incentives).
- `coin-name-and-cent-value` is a grade K to 1 prerequisite that 2.MD.C.8 assumes; fine to keep as a type, label it so.
- `early-money-decisions` is two types in one: a vocabulary sort (income, gift, saving, deposit, withdrawal) and a two-step cost with equal groups (3 × 12¢ + 9¢, 3.OA.D.8). Split them.
- `payroll-property-tax` names sales tax but the sample variants show only payroll and property; make sure the generator does produce the sales case, or drop the word.

**Badly chosen numbers.** `incentive-compare`'s store comparison lists the same jacket at 180 and 80 before any discount: the answer is known before any work, so the lesson cannot teach the comparison. Variants should keep the two final costs within reach so the discount decides. `supply-price-choice` only ever shows a clear surplus or shortage; fine, but say so in the template.

**Grade leaks already noted in the curriculum plan** (decimals in a grade-2 skill; the wallet chain) are covered by the regrouping above.

**Clauses the problems never practice.**

- 2.MD.C.8, "using $ and ¢ symbols appropriately": the ¢ symbol is asked (`coin-name-and-cent-value`); the $ symbol never is. Every dollar answer is entered as a bare decimal. A type that asks the learner to write an amount with $ (choices $1.28, 1.28¢, 128$) is missing.
- 2.OA.A.1, "unknowns in all positions": `money-left-story` only ever asks for the result. What was spent, and what she had, are never asked.
- 3.OA.D.8 and 4.OA.A.3, "equations with a letter standing for the unknown quantity" and "assess the reasonableness of answers using ... rounding": never asked; the lessons will do the estimate anyway. 4.OA.A.3, "remainders must be interpreted": break-even with a count that does not divide evenly (round up to not lose money) is the natural case and the type never poses it.
- 4.MD.A.2, "represent measurement quantities using diagrams such as number line diagrams": never asked of the learner.
- 5.NBT.B.7, "multiply, and divide decimals": the family only adds and subtracts money (and 2 × 0.55). Division of money appears only in the equal-shares story arriving from place value. "Explain the reasoning used" is never assessed.
- 6.RP.A.3c, "find the whole, given a part and the percent": `budget-percent-share` asks the part and the percent but never the whole (66 dollars is 15% of what income?). Check the same clause in `percent-amounts-blanks`.
- 7.RP.A.3, "simple interest ... gratuities and commissions, fees, percent increase and decrease, percent error": no type in this family computes interest, though the family's own blurb promises it and TEKS 7.13E asks for simple and compound interest. The arriving `loan-total-cost` gives total paid; interest as total paid minus amount borrowed, and I = P × r × t, are a missing type. Gratuities and commissions are missing (they may be in family 10's percent-change; check).
- 7.NS.A.1a to d: `net-worth-statement` uses signed subtraction (c) in one direction; opposites summing to zero (a) and the number-line representation (b) are never used here. Fine; family 3 owns them.

---

## 7. The pilot: five problem types to build first

The pilot covers the whole arc in one sitting: every foundation, every new tool, each grade band, mixed and one-method types, open answers and choices.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `coin-total` | 2 | The picture is born here: coins to scale, the worth blocks shown once, biggest first with the running total and the hops. The example puts every coin in play and crosses a ten on a nickel. If this is not beautiful nothing after it is. Exercises `money.count`, `worth`, the hop arcs. |
| 2 | `fewest-coins-change` | 4 | Count up from the cost like a cashier, bills landing as the line zooms out, then the trade-up test that proves the count is fewest; two-place notation on the word. Exercises `change`, `trade`, `numberline.zoom`. Strongest writer. |
| 3 | `decimal-money-change` | 4 | A reading lesson: four stories, each acted out on the bar (take, fill, compare), the stack with the point, sense as direction, change + cost = payment. Exercises the story bar and `stack` with `$`. |
| 4 | `profit-cost-breakeven` | 5 | Fixed once, variable per item: the grow motion and the table filling to break-even; the four decoys named as the four real errors. Exercises `grow`, `table.fill`, `equal`, `dim`. |
| 5 | `tax-bracket-owed` | 7 | The slice insight on the bracket bar, against the exact misconception the tests target (the whole income at the top rate), with the choices dimmed by what each one is. Exercises `cuts`, `slice`, `tax`. |

If the five land, the next wave is `incentive-compare` (`off` and `take` in order, two stores compared), `net-worth-statement` (`weigh` and the sign), `fixed-variable-expense-table` (`table.bars`), and `pay-exact-coins` (the pennies-first glance), which complete the tool set and give the cheaper-writer seam its first test in this family.
