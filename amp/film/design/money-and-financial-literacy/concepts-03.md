### Grade 7: financial-literacy-middle

**`incentive-compare` — Coupons, percent discounts, rebates, and two stores.** Three kinds of question under one name: two offers on one price in a stated order; one offer at each of two stores; one of three offers. One idea covers all three: **every offer becomes a final cost, and only final costs are compared.**

Badly chosen numbers first: the store variant lists the same jacket at 180 and 80. Store B wins before any offer is read, so the question cannot teach the comparison; "by how much" is all that is left. The generator should keep the two stickers within reach of each other so the offer decides (the lesson's example below uses such numbers). The decoy "by 7.00 dollars" (27 − 20, the difference of the savings) is a realistic error and should stay.

Standard: 7.RP.A.3, "multistep ... percent problems ... markdowns ... percent ... decrease." Also TEKS 7.13F (compare monetary incentives: sales, rebates, coupons), which the catalog should name. 7.NS.A.3 only nominally; nothing here is negative.

**Foundations first.** Four words, defined on one bar before any example. The picture is family 10's percent bar: 0% to 100% above, dollars below, the same positions, drawn to scale. *Price*: what the tag says; the whole bar is 100% of it. *Percent off*: a share of the bar leaves; "30% off" is 30 of every 100 dollars; what you keep is the rest, 70%. *Coupon*: a fixed number of dollars leaves, read on the dollar scale, whatever the price. *Rebate*: you pay the full price at the counter and money comes back later; the final cost is what left your pocket minus what came back. *Final cost*: the bar after everything.

Then the one fact the type turns on, built with clean numbers. A 100-dollar bar. 10% off: a 10% share shades rust, reads 10 dollars beneath, slides off; 90 left. A 10-dollar coupon: a 10-dollar length leaves; 80. Now the same two offers the other way: coupon first, 90 left; and here the percent scale **redraws over the 90**, because the 90 is now the price; 10% of 90 is 9, not 10; 81 left. Same offers, different order, a dollar apart, and the dollar is 10% of the coupon. "A percent is of the price at that moment. Follow the order the problem gives." One more beat, for the comparisons: 10 dollars off and 10% off tie at 100, but on a 60-dollar jacket the percent is only 6 and on a 150-dollar jacket it is 15. "Judge the deal by the final cost, never by the size of the offer."

**Read.** The cue words go gold. "Both ... first ... then": one price, two offers, an order; the answer is under the price and under either offer alone. "Which store charges less, and by how much": two final costs and their difference; the sticker does not decide. "Only one offer ... lowest final cost": one final cost per offer, and the rebate counts even though the full price is paid. At a glance, for the two-offer kind: the choices equal to price − coupon and to price × (1 − r) are single offers; the two left differ by r × coupon, and the stated order picks: percent first gives the smaller.

**Example A (two offers, stated order).** "A jacket costs 120 dollars ... 30% discount first, then the 15 dollars coupon." (1) Bar 120 = 100%. (2) The 30% share shades: three tens of 120 is 36, read under it; it slides off: 120 − 36 = 84 on the board, and beside it the fast form 120 × 0.70 = 84. (3) The 15-dollar length leaves on the dollar scale: 84 − 15 = 69. (4) Sense: under 84 and under 105, since two discounts beat one. (5) 69.00 dollars. Rule out: 105 (coupon only) and 84 (percent only) dim together; 73.50 is the coupon first, the percent of 105, and the problem said percent first, so the smaller of the two remaining. Check: add back in reverse: 69 + 15 = 84, and 84 is seventy hundredths of 120.

**Example B (two stores), a different case: two prices, one offer each.** Store A: 100 dollars, 20% off. Store B: 90 dollars, 8-dollar coupon. Two bars aligned on one dollar scale, each with its own percent scale (A's 100% is 100, B's is 90). A: 20 leaves, 80. B: 8 leaves, 82. The lower sticker loses: Store A, by 2.00 dollars, the gap bracketed between the two final costs. Rule out: the store with the longer final bar cannot "charge less"; "by 12" is 20 − 8, savings, not costs. Check: both final costs recomputed, then subtracted.

**Example C (one of three, with a rebate), quick.** 120 dollars. Coupon 10 off: 110. 5% off: 5 of every 100 is 6: 114. Rebate: the whole bar goes out rust, then a 25-dollar piece comes back teal: 120 − 25 = 95. The rebate, 95.00. "All three cost the same" dims because three different numbers are on the board.

**Fast.** Percent off: multiply by what you keep (×0.70 for 30% off). Then a coupon: subtract. Coupon first: subtract, then multiply the rest. Percent of a dollar amount in the head: 10% is divide by ten; 5% is half that; 15% is 10% plus 5%; 30% is three tens. Stores or offers: one final cost each, then compare.

**Sense.** A final cost is under the price; two discounts land under either alone; percent first lands under coupon first by r × coupon; the bigger "off" is not the bigger saving until the final costs say so.

**Check.** Add back in reverse order to recover the price. For comparisons, recompute both final costs and subtract.

**Rule out.** Anything at or above the price; single-offer costs when "both" was said; the wrong store; a difference of savings for a difference of costs; "all the same" when the numbers differ.

**Line.** "A percent is of the price at that moment. Judge the deal by the final cost."

**Trap.** Taking the percent of the original price whatever the order (73.50; 36.00): the percent scale redrawing over the remainder makes it impossible. Comparing offers instead of costs (bigger percent wins, lower sticker wins, "by 7"): two bars on one dollar scale, the gap bracketed between final costs. Ignoring the rebate because the full price is paid: out, then back, on the bar.

**Kit.** `bar.off` and `bar.take` as specified for the family; new: `rebase` (the percent scale re-anchors to the current remainder, the old 100% left ghosted: the picture of "at that moment"); `back` (the whole bar out in rust, a labeled piece returns in teal, the net read); two or three bars aligned on a shared dollar scale, each with its own percent scale, with family 8's gap bracket; `dim`.

**Writer.** Strongest writer: three cases, an order-of-operations motion that must be staged, decoys that are each a named misconception, and variant numbers that must be fixed before the lesson can be true to the app.