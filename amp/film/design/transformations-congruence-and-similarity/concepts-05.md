## Similarity theorems (`similarity-theorems`, Geometry)

**Before the concept, three things about the type as the app has it.**

- The skill is linked to HSG.SRT.B.4 (prove theorems), but this type applies the theorem (B.5), as the family design already says. It does, though, practice B.4's *converse* clause ("and conversely") in its second kind, which is rare in the app and worth keeping.
- The step format locks one route: step 1 is the ratio AE ÷ AD, step 2 is EC, step 3 (when the whole side is asked) is AC. The route is sound (it is the theorem's proportion AD/AE = DB/EC turned round) and gives a whole number on every seed, so the lesson teaches exactly those steps and names step 1 so the learner knows what number the app wants. The template should label the first slot "side ratio", as the filled-in variants already reveal it.
- The generated ratios of 3 and 5 make AC three or five times AB, a sliver no card can draw to scale. The lesson's example uses a ratio-2 seed (AD = 2, DB = 6, AE = 4), and the generator should favor ratios 2 and 3 wherever a figure is drawn.

### `parallel-segment-steps` — A parallel cut is the same fraction down both sides.

Foundations 9 and 5 (the dilation from a corner), 7 (which piece matches which).

**Standard.** HSG.SRT.B.5, "Use congruence and similarity criteria for triangles to solve problems", applying the theorem in HSG.SRT.B.4, "a line parallel to one side of a triangle divides the other two proportionally, and conversely." No type asks for the proof, so this lesson gives it once, in the foundation, in one motion.

**Foundations first.** (1) Triangle ABC drawn true to the numbers; D on AB, E on AC, DE drawn; parallel marks on DE and BC; "parallel: the same direction, so they never meet" in one line. The three given pieces written on the pieces they measure. (2) Why the parallel matters: rays from A through D and through E are drawn past B and C; the small triangle ADE lifts and grows from A along the rays until D lands on B. Because DE runs the same direction as BC, the grown DE lands on BC, so E lands exactly on C. The small triangle is a copy of the big one from corner A. Said plainly, with gold ticks: D is the same fraction of the way down AB as E is down AC. (3) The side ratio: side AC turns about A and lies down beside side AB, so the two sides sit as two to-scale bars aligned at A, each cut at D and at E, pieces labeled. The right bar is twice as long as the left at the top pieces (4 against 2), so twice as long over the whole, so twice as long in what is left below the cut. "The side ratio is the long side compared to the short, AE over AD, and it is the same at every level: top pieces, bottom pieces, whole sides." Ratio card: AE/AD, EC/DB, AC/AB, all the same way up.

**Read.** "DE ∥ BC. Find the length of AC. Enter each step." Gold on "AC" and on "each step": three numbers are wanted, a ratio, then EC, then AC. At a glance: AE is longer than AD, so AC is the long side; EC must be longer than DB, and AC longer than AE. When "some steps are filled in", the filled step is the route written down and the check of your own.

**The example.** AD = 2, DB = 6, AE = 4, DE ∥ BC, find AC. (1) The figure to scale, angle A about 70°; the givens on their pieces; EC marked "?" and AC bracketed "?". (2) Step 1, the side ratio: AE ÷ AD = 4 ÷ 2 = 2. The right side is twice the left. The bars: the top pieces, 4 against 2. Enter 2. (3) Step 2: EC = 2 × DB = 2 × 6 = 12. The bottom pieces on the bars, 12 against 6, the right one visibly twice the left. The "?" on EC becomes 12 on the triangle too. Enter 12. (4) Step 3: AC = AE + EC = 4 + 12 = 16. The bracket on the whole side fills in. Enter 16. (5) Both sides read together: AD/AB = 2/8, AE/AC = 4/16, a quarter of the way down each; and AC = 2 × AB = 16, the whole sides in the same ratio as the top pieces.

**Second case, quick: the converse.** "AD = 3, DB = 6, AE = 6. What must EC be so that DE ∥ BC?" (a ratio-2 seed; the generator's 3, 9, 9 is the same question with a sliver). Here C is not yet placed: it slides out along the ray from A through E while BC swings, and BC is parallel to DE only when C stops where AC is three times AE, just as AB is three times AD: that is the copy from A (foundation 5 lands D on B and E on C, and lines go to parallel lines). Steps: side ratio 6 ÷ 3 = 2; EC = 2 × 6 = 12. Two slots, not three. The converse in one sentence: the same fraction down both sides forces the parallel.

**Fast.** Divide the two top pieces, long over short; multiply the other bottom piece by it; add the top piece if the whole side is asked. One ratio, one product, one sum. If the ratio is not whole, keep it as a fraction; it still works.

**Sense.** The long top piece belongs to the long side, so that side is longer at every level: EC bigger than DB, AC bigger than AB, by the same factor.

**Check.** AD/AB and AE/AC are the same fraction (2/8 and 4/16); or EC ÷ DB gives the side ratio back (12 ÷ 6 = 2).

**Rule out.** None; a steps answer. A filled step is the app's own check of the route.

**Line.** "Same fraction down both sides: the long side is the same number of times the short, top piece, bottom piece and whole."

**Trap.** Two real ones. Adding instead of multiplying: "AE is 2 more than AD, so EC is 2 more than DB: 8." The bars make it impossible: the right bar is twice as long, not two longer, and the grown triangle multiplies every length. Pairing a whole with a piece: AB/AD = 4, then EC = 4 × 6 = 24. The aligned bars put partner with partner, top with top, bottom with bottom, whole with whole, so a whole never meets a piece in one fraction. Stopping at EC when AC was asked is caught by step 3's bracket and by rereading "AC" in gold before the last entry.

**Kit.** A steps answer card: several slots filled one per beat in the app's order, the last boxed as the answer (`--dry` now refuses a second answer on a screen). A side that turns about A and lies down as a to-scale bar with its points and labels riding (the open "labels ride turned parts" wish), landing as two aligned `bar`s cut at the same fraction. A point that glides along a ray from A with the segment BC following it, and parallel marks that appear on the word when it lands. `rays` from the family list and the ratio card. Nothing else.

**Writer.** The strongest writer for this pilot lesson: the grow, the lay-down into bars and the glide to parallel are the proof, and this is the concept lesson for `geo-parallel-segment-length`, `geo-parallel-perimeter` and the other parallel-cut types. Once it exists, those siblings can go to a capable cheaper model from this concept, as the seam section says.