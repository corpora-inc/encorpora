# Transformations, congruence and similarity: per-type concepts, part 3

Ten types across `congruence-criteria`, `similarity-proofs`, `dilation-properties`. Each stands on the family design's foundations (numbered as there) and uses its pictures: figures drawn true to their givens, marks by count, the names card, the ratio card, the proof card, pull-apart-and-stand, the swing, rays and the L from a center, the grown cube. Where a type's figure lives only in the app (every proof type, `similarity-by-transformation`), `facts.ts` must expose it before the screenplay is written; the examples below say what the figure must contain.

---

### `triangle-congruence-criteria` — Which givens force the triangle?

**Standard.** HSG.CO.B.8: "Explain how the criteria for triangle congruence (ASA, SAS, and SSS) follow from the definition of congruence in terms of rigid motions." The app only applies the criteria (HSG.SRT.B.5, "use congruence ... criteria for triangles to solve problems"); the lesson gives the explanation, because the explanation is what makes the choices readable. AAS is not in the standard's list; it is ASA with the third angle forced, and the lesson says so.
**Check first.** Every SSA variant is answered "not sufficient". That is right only when the swinging side can hit the ray twice. Confirm the generator never produces two sides and a right angle not between them (hypotenuse-leg, which does fix the triangle), or a swinging side longer than its neighbor (one hit). Either would make the app's answer wrong.

**Foundations first.** Congruent: a slide, turn or flip lands one triangle exactly on the other (foundation 4). A triangle has six parts, three sides and three angles; a criterion is a set of three that leaves the other three no choice. Then the motion that proves each, on one base BC drawn and fixed, twenty seconds apiece: **SSS**, arcs of the two remaining lengths from B and from C cross at exactly one point above the base. **SAS**, the angle at B is drawn and the second side laid along it; its far end is the third corner, nowhere else. **ASA**, two rays leave B and C at the given angles and cross once. **AAS**, two angles make the third (180°), so it is ASA wearing a different side. **SSA**, the angle at B and side BA are drawn, and side AC swings from A on a compass arc: it hits ray BC twice; two different triangles, both fitting every given. **AAA**, three angles: the triangle dilates from B and every size fits. Then the words: *included* ("between": the angle whose corner is the letter the two sides share; the side whose two letters are the two angle corners"). Finally the habit: mark the givens on the figure, nothing else, because "unmarked features supply no facts".

**Read.** The correspondence is always A↔D, B↔E, C↔F, so every pair is a letter test. Gold on the question's shape: "which criterion or limitation" or "which additional fact completes AAS". At a glance count the pairs: one side and two angles means ASA or AAS; two sides and one angle means SAS or SSA; three sides SSS; three angles never.

**The example.** "AB = DE = 21 cm; CA = FD = 15 cm; m∠B = m∠E = 45°." (1) Two triangles drawn true (B = 45°, BA = 21, CA = 15), one tick on AB and DE, two on CA and FD, one arc at B and E. (2) Count: two sides, one angle; SAS or SSA. (3) Where does the angle sit? The two sides share the letter A; the angle is at B. Not between. (4) The swing: BA fixed at 45°, CA swings from A and crosses ray BC at two points, about 12.7 and 17.0 from B; both triangles draw and stay, each with its 21, 15 and 45°. (5) The choice "Not sufficient: these two sides and a non-included angle allow different triangles."
**Second example (a different question).** "Given m∠A = m∠D; m∠B = m∠E = 45°. Which additional fact completes AAS using exactly the stated pairs?" Two angles at A and B. AAS wants a side that is not AB (that would be ASA): BC = EF. The choices ∠A = ∠D and ∠B = ∠E restate givens; ∠C = ∠F makes three angles, which fixes shape only. Quick case on the same figure: with the same two angles, AB = DE is ASA, BC = EF is AAS; the only difference is whether the side's two letters are the angle letters.

**Fast.** Count sides and angles. One side, two angles: the side's letters both angle letters means ASA, else AAS. Two sides, one angle: the angle's letter is the letter the sides share means SAS, else SSA. Three sides SSS. Three angles not sufficient.
**Sense.** A positive criterion has at least one side; a "not sufficient" answer is either three angles or an angle outside its sides.
**Check.** Say the criterion's letters in the order they sit on the figure, pointing: side, angle, side.
**Rule out.** Any choice naming SSS when an angle is given, or ASA when there is only one angle; any "completes" choice that restates a given; "three matching angles" when a side is given. Dim together, then prove the survivor on the marked figure.
**Line.** "Three parts with a side fix the triangle, unless the angle is not between the sides."
**Trap.** SSA accepted as SAS: "two sides and an angle, so it works." The lesson draws both triangles from the same givens and leaves them on screen; the letter test (does the angle's letter belong to both sides?) is the scratch-paper version.
**Kit.** `meet` points (two circles; a circle and a ray with `pick`), a segment to a gliding point for the swing, angle `marks` by count. Nothing beyond the family's list.
**Writer.** Strongest: the swing and the crossings are the content, and the sentence choices are arguments.

---

### `two-column-congruence-proof` — A reason for every line

**Standard.** HSG.SRT.B.5, "use congruence ... criteria for triangles ... to prove relationships in geometric figures"; HSG.CO.B.7 for the last line of the CPCTC variants ("corresponding pairs of sides ... are congruent").
**Check first.** Answers are option ids ("sh", "ra"). The concept below names each reason in words; the screenplay must use the app's exact option texts and its chosen route (the bow tie is proved by two alternate-interior pairs and the given side, ASA, not by vertical angles). Expose the options and the figure from `facts.ts`.

**Foundations first.** A proof is a chain: each line is forced by lines above it, and the reason says which fact forced it. The shape here is always the same four stages: the givens; one line per matching pair; the criterion; and, when the goal is a side, one more line. The reasons in this type are few, and each is a mark on the figure: Given; definition of midpoint (two equal ticks); perpendicular lines form right angles (a box); right angles are congruent; vertical angles are congruent (the X); alternate interior angles are congruent when the lines are parallel (the Z, drawn: a transversal crossing two parallels, the two angles inside and on opposite sides); reflexive, a side both triangles share (ticked once, counted once for each); then SAS, ASA, AAS or SSS; then "corresponding parts of congruent triangles are congruent". Marking as each line is written is the scratch-paper habit.

**Read.** Gold on "Prove": the two triangle names, letters in matching order, tell which three pairs to hunt (S↔I, M↔L, E↔E). At a glance: the givens are the first lines; the goal is the last; the criterion is the line before the goal unless the goal is the congruence itself.

**The example.** "Given: SM ∥ IL and SM ≅ IL. Prove: △SME ≅ △ILE." Figure: SM above, IL below, SI and ML crossing at E; the names card S M E over I L E. (1) Row 1, SM ∥ IL, Given; arrows on the two segments. Row 2, SM ≅ IL, Given; one tick each. (2) The Z along transversal SI lights: ∠MSE ≅ ∠LIE, alternate interior angles; one arc at S and I; column S|I lights. (3) The Z along ML: ∠SME ≅ ∠ILE, alternate interior angles; two arcs; column M|L. (4) The marked figure now shows angle, side, angle on each triangle, with the side SM between its two angles: △SME ≅ △ILE by ASA, the letters read down the card. (5) Land: the traced copy of SME half-turns about E and settles on ILE.
**Second example (different reasons, a shared side).** "Given: LM ⊥ JK and M is the midpoint of JK. Prove: △JML ≅ △KML." Rows: the two givens; JM ≅ KM, definition of midpoint; ∠JML and ∠KML are right angles, perpendicular lines form right angles; ∠JML ≅ ∠KML, all right angles are congruent; ML ≅ ML, reflexive; SAS (the right angle sits between JM and ML). The shared side is one segment used twice: the tick is drawn once and the copy flips over ML onto its twin.
**Quick third beat.** When the goal is a segment (prove JN ≅ LN), the congruence is one line from the end and the last line is CPCTC; the two letters must sit in the same column.
**The other two question shapes** (fill the reasons; order the lines) are the same proof read: a line may only use lines above it, so givens first, pairs next, the criterion, then the part asked for.

**Fast.** Write the two names stacked. Hunt three pairs in the givens' marks; a parallel pair gives an angle pair per transversal, a midpoint a side pair, a perpendicular a right-angle pair, a crossing a vertical pair, a shared side a pair for free. Name the criterion from where the pairs sit.
**Sense.** Exactly three pairs before the criterion; every reason names a mark that is on the figure.
**Check.** Read each pair down the columns of the names card; the criterion's letters match the order the marks sit in.
**Line.** "Givens, then pairs, then the test, then what you wanted."
**Trap.** The shared side forgotten (only two pairs, so the student grabs an angle that "looks equal" from the picture), and the conclusion's letters in picture order instead of matching order. The reflexive tick and the names card.
**Kit.** `proof` card with `marks` that light figure parts per row; option texts from `facts.ts`.
**Writer.** Strongest: every reason must be right, in order, and in the app's words.

---

### `similarity-by-transformation` — Does a dilation and a move land it?

**Standard.** HSG.SRT.A.2: "Given two figures, use the definition of similarity in terms of similarity transformations to decide if they are similar"; 8.G.A.4: "describe a sequence that exhibits the similarity between them." Mixed, three kinds: yes with the sequence; no because the factors differ; which sequence in order.
**Check first.** The coordinates live in the figure; `facts.ts` must expose them. Both triangles in every variant have horizontal and vertical legs; the concept relies on that.

**Foundations first.** Similar: a dilation, then slides, turns or flips, lands one figure on the other (foundation 6). The dilation is about the origin here: multiply both coordinates by k. k is new over old, and it must be the same for every pair of matching sides; two different factors means no dilation did it. Rigid motions change where, never how big, so position and size are never reasons against similarity; the only reason against is a factor that will not agree.

**Read.** The arrows A→D, B→E, C→F name who lands on whom. "About the origin" and "in the order listed" go gold. At a glance: is DEF bigger or smaller (k above or below 1); do the letters go round the same way (a flip in the chain or not); which quadrant did DEF land in.

**The example.** (Written for a seed like A(1, 1), B(3, 1), C(1, 2) and D(4, −1), E(10, −1), F(4, −4); the writer takes the real seed's coordinates.) "Are ABC and DEF similar, and why?" (1) Horizontal legs: AB = 2, DE = 6; k = 6/2 = 3 on the ratio card. Vertical legs: AC = 1, DF = 3: 3 again. One factor; a dilation exists. (2) Orientation: A→B→C goes counterclockwise, D→E→F clockwise: a flip is in the chain. (3) Trace: the copy dilates by 3 about the origin (rays shoot, each corner slides out to three times as far), ghost stays: A at (3, 3). (4) Flip over the x-axis: (3, −3). (5) What is left to reach D(4, −1): right 1, up 2: translate (x + 1, y + 2). Confirm B: (9, 3) → (9, −3) → (10, −1) = E. (6) Land: the copy settles on DEF and pulses. "Yes: dilate by 3, reflect over the x-axis, translate (x + 1, y + 2)."
**Second example (the "no" case, a different kind).** Horizontal legs 3 and 9, vertical 2 and 4: factors 3 and 2 on the ratio card side by side; the copy dilated by 3 overshoots in height, by 2 falls short in width; no landing. "No: the horizontal legs scale by 3 but the vertical legs scale by 2." The decoy "both are right triangles, so similar" is one angle pair; AA needs two.
**Quick third.** "Which sequence": the same work on one vertex in the written order; the reordered decoy (translate first, then dilate) is tried for one beat and the point lands elsewhere, because the dilation stretches the shift too.

**Fast.** k from one leg pair, confirmed on the other; dilate one vertex; compare with its partner: y's sign flipped means a flip over the x-axis, x's means the y-axis, both means a half turn; the leftover difference is the translation; confirm a second vertex.
**Sense.** DEF three times as long in every direction; the copy lands.
**Check.** Undo backward from D: subtract the shift, flip back, divide by 3: A.
**Rule out.** "No" because of position or size: never (that is congruence, not similarity). A "Yes" whose k is not the leg ratio. A sequence that puts the translation before the dilation when the figure's shift is not k times a lattice shift. Dim together, prove the survivor by landing.
**Line.** "One k for every pair, or no dilation did it. Where it sits never matters."
**Trap.** "Different sizes, so not similar" (congruence and similarity confused), and k found by subtracting. The grown copy that lands, and the ratio card reading new over old.
**Kit.** `copy`, `dilate` about the origin, `reflect`, `translate`, ghosts at each landing, `land` with the gap shown on a miss, `rays`.
**Writer.** Strongest: mixed, and the choices are claims to judge.

---

### `aa-similarity` — Two angles fix the shape

**Standard.** HSG.SRT.B.5 ("use ... similarity criteria for triangles to solve problems"), with HSG.SRT.A.3 underneath ("establish the AA criterion"), which the foundation gives. Mixed, four kinds: the third angle; is it AA, yes or no; name the correspondence; the proportion from a statement.

**Foundations first.** Why two angles are enough, in twenty seconds: two triangles that share two angle measures are set corner on corner at one equal angle; the opposite sides are then parallel (the other angles match), so the small one is the big one dilated from that corner (foundation 9): the same shape. The third angle was never free: 180° minus the other two. So "two angles given" always means all three known. Pairing: corners with equal measures land on each other, and the statement writes them in the same position (foundation 7). Words: AA, ~, "the same shape".

**Read.** For a yes/no: compute the third angle of each before judging anything. For a correspondence: pair by measure, not by alphabet. For a proportion: stack the names. At a glance: one shared measure is not two.

**The example.** "△ABC has ∠A = 36°, ∠C = 88°. △DEF has ∠D = 88°, ∠F = 56°. Similar by AA? If so, name the correspondence." (1) B = 180 − 36 − 88 = 56; E = 180 − 88 − 56 = 36; both triangles drawn true, the second a different size and turned. (2) Pair by measure: 36 is A and E, 88 is C and D, 56 is B and F; equal arcs mark each pair. (3) Names card: A B C over E F D, built one letter at a time as each pair is said. (4) The small copy dilates and turns onto the big one; the arcs coincide. "Similar by AA: △ABC ~ △EFD."
**Second example (not similar).** "∠A = 63°, ∠C = 72°; ∠D = 72°, ∠F = 58°." B = 45, E = 50. Only 72 matches; one pair. "Not similar: only one pair of angles is equal, and AA needs two." The decoy "not similar: only two angles given" dies at step one; "similar: both have 72°" is one pair.
**Quick third.** "△ABC ~ △FDE: which proportion?" Stack A B C over F D E; AB sits over FD, BC over DE: AB/FD = BC/DE. A choice pairing BC with FE pairs non-neighboring columns.

**Fast.** Third angle by subtraction; pair by equal measure; stack the names; read sides as neighboring columns.
**Sense.** Three pairs, all matching, both sums 180.
**Check.** Read the statement letter by letter: under A is a corner with A's measure.
**Rule out.** For a correspondence: A's measure is 36, so the letter under A must be the 36° corner; every choice with another letter first dims at once. For a proportion: any fraction pairing two sides that are not matching columns.
**Line.** "Two angles fix the shape. The third was never free."
**Trap.** Writing △ABC ~ △DEF by alphabet whatever the angles say. The names card is built from the measures, never from the order the triangles are named in the problem.
**Kit.** `names` card with `pair`, angle `marks` by count.
**Writer.** Strongest for the lesson as a whole (mixed; the yes/no decoys are reasoning). The proportion kind on its own is a cheaper job.

---

### `similar-triangle-side` — Find k, then what k does

**Misfiled.** The goal says "a missing length", but the variants are five problems: a side from a similarity statement (HSG.SRT.B.5); the parallel cut (owned by `parallel-segment-steps`); a shadow problem (indirect measurement, its own type); a perimeter and an area of similar triangles (owned by `scale-factor-effects-blanks`). Split it. Until then the lesson teaches reading with one idea for all: find k, then ask what k does to the thing asked.

**Standard.** HSG.SRT.B.5, "use ... similarity criteria for triangles to solve problems."
**Foundations first.** Similar triangles: every side of one is k times its match (foundation 6); k is new over old from one pair that is fully known; angles copy. Matching sides come from the statement (names card) or from equal angles. k acts once on lengths and perimeters, twice on areas: the grown square, k = 5, is 25 cells (foundation 11).

**Read.** Gold on the asked thing: a side, a perimeter, an area, a height. At a glance: which triangle is bigger, so whether the answer is bigger or smaller than its match; for an area the jump is k², far bigger than k.

**The example.** "△ABC ~ △DEF, A, B, C matching D, E, F. AB = 7, BC = 8, CA = 3, DE = 14. What is EF?" (1) Two triangles drawn true (7, 8, 3 and 14, 16, 6), names card A B C over D E F. (2) The pair with both known: AB and DE, column A|B lights, both sides gold; k = 14/7 = 2 on the ratio card, new over old. (3) EF matches BC (columns B|C): 2 × 8 = 16. (4) The small copy dilates by 2 and lands. 16.
**Quick cases, one each, because the reading differs.** Fractions: BC = 7, EF = 7/2, so k = 7 ÷ 7/2 = 2 the other way (ABC is the bigger); CA = 2 × FD = 9. Perimeter: sides 4 and 11, k = 11/4; perimeter 32 × 11/4 = 88 (a perimeter is lengths added, so it scales like a length). Area: sides 2 and 10, k = 5; the grown square shows 25; 44 × 25 = 1,100. Shadow: the person and the tree each make a right triangle with the sun's angle, the same shape; height over shadow is one k for both: 6/4 = tree/24, tree = 36. Parallel cut: DE ∥ BC makes △ADE a dilation of △ABC from A (foundation 9), k = AD/AB = 6/10, DE = 6 × 6/10 = 18/5; the fraction AD/DB = 6/4 is part over part, a different number, and the rays from A show why.

**Fast.** Stack the names (or pair by equal angles); k from the one full pair, new over old; lengths and perimeters × k, areas × k².
**Sense.** Bigger triangle, bigger answer; the area answer is enormous compared with the side answer.
**Check.** Compute a second pair's ratio when two are known (16/8 = 14/7); for an area, k² back: 1,100/44 = 25 = 5².
**Line.** "Find k from the one pair you fully know. Sides times k, areas times k squared."
**Trap.** Area multiplied by k (220 instead of 1,100), and the parallel cut's part over part (6/4). The grown square, and the rays from A.
**Kit.** `names` and ratio cards, `rays` on a plain figure, the grown square; two right triangles with the sun's angle marked for the shadow.
**Writer.** Strongest while it is mixed; after the split, the statement kind is a cheaper job from this concept.

---

### `corresponding-angle-transfer` — Angles copy

**Standard.** HSG.SRT.B.5; HSG.CO.B.7 for the congruent variants ("corresponding pairs of angles are congruent"). One method.
**Foundations first.** The statement names who lands on whom (foundation 7): △JKL ≅ △DEF puts J on D, K on E, L on F. A rigid motion copies every angle; a dilation copies every angle too, only sides scale (foundations 2, 5). A triangle's angles make 180°; in a right triangle the two acute angles make 90°. So the asked angle is a copy of its match, and its match is either given or 180 minus the other two.

**Read.** Gold on the asked angle (∠D) and the relation (≅ or ~ with k). At a glance: the answer is the matching corner's measure, so it is one of the given angles or the third one; under a right angle every other angle is under 90.

**The example.** "△JKL ≅ △DEF. ∠K is a right angle, ∠L = 43°. What is ∠D?" (1) Names card J K L over D E F; D sits under J. (2) J is not given: the third angle, 180 − 90 − 43 = 47; or, the two acute angles of a right triangle make 90, so 90 − 43 = 47. (3) Both triangles drawn true (90, 43, 47), the second a turned copy; the arc at J and at D light together as the copy lands. 47°.
**Quick second.** "△ABC ~ △IGH, every side of IGH 2 times as long, ∠A = 23°. ∠I?" I under A; the copy dilates by 2: sides double, the arc at I is the same 23°. The choice 46° is the planted trap: angles copy, sides scale.

**Fast.** Stack; find the column; copy the angle; if missing, 180 minus the other two (90 minus the other acute angle).
**Sense.** In a right triangle the asked acute angle is under 90; the three measures sum to 180.
**Check.** Add the three angles of the second triangle: 47 + 90 + 43 = 180.
**Rule out.** In a right-triangle variant, 133° and 137° are over 90 and die together; the other given angle (43°) is at L, not J. In the similar variant, anything k times or 180 minus the angle.
**Line.** "Angles copy; sides scale."
**Trap.** Multiplying by k (46°), and copying the nearest given angle instead of finding the third. Pull-apart-and-stand lays the dilated triangle's corner on the original's: the arcs coincide while the sides do not.
**Kit.** `names` card, angle `marks`.
**Writer.** Cheaper model, from this concept and the names card.

---

### `crossing-segment-similarity` — The bow tie

**Standard.** HSG.SRT.B.5, "use ... similarity criteria for triangles to solve problems." Two givens produce the same figure: AC ∥ BD, or ∠CAE = ∠DBE stated.
**Foundations first.** Two segments AB and CD crossing at E make two triangles, ACE and BDE, point to point at E. The angles at E are vertical angles, equal (family 23): one pair for free. The second pair comes from the given: either stated, or from AC ∥ BD, where AB is a transversal and the Z gives ∠CAE = ∠DBE (alternate interior). Two pairs: AA. Who lands on whom: E on itself, A on B (the equal pair), C on D (what is left): △ACE ~ △BDE. The picture that makes the proportion readable: pull the small triangle out, half-turn it about E and set the two side by side the same way up, matching angles in the same corners (foundation 9's bow tie). Then matching sides sit in the same place and the ratio card reads across.

**Read.** Gold on which length is asked and whether it is a piece from E (AE, BE, CE, DE) or a far side (AC, BD). At a glance: which triangle is bigger (one full pair tells), so whether the answer is bigger or smaller than its match.

**The example.** "AB and CD intersect at E. ∠CAE = ∠DBE. AE = 8, CE = 4, DE = 5. BE?" (1) The bow tie drawn true, one arc at A and at B, the vertical angles at E marked with two arcs. (2) Names card A C E over B D E. (3) Pull apart and stand: △BDE turns a half turn about E and slides beside △ACE, the one-arc corners both at the left. (4) The pair fully known: CE and DE, k = 5/4, BDE is the bigger; BE matches AE: 8 × 5/4 = 10. On the board as the proportion the app expects: AE/BE = CE/DE, 8/BE = 4/5, cross-multiply, 4·BE = 40, BE = 10.
**Second example (the parallel given, a far side asked).** "AC ∥ BD. AE = 16, BE = 12, AC = 4. BD?" The Z along AB lights: ∠CAE = ∠DBE; AA; stand. k = BE/AE = 12/16 = 3/4, BDE is the smaller; BD = 4 × 3/4 = 3. Brief: the only new thing is where the second angle pair comes from.

**Fast.** E matches E; the two equal-angle corners match; the rest match. Stand them; k from the full pair; the unknown is k times its match.
**Sense.** The bigger triangle has every side bigger: 10 > 8 and 5 > 4 agree.
**Check.** Cross-multiply back: 8 × 5 = 4 × 10.
**Line.** "The crossing matches itself; the equal angles match; stand the two the same way up."
**Trap.** Matching A with D because the two triangles point opposite ways (the small one is upside down), so AE is paired with DE. The half turn that stands them the same way up puts AE and BE in the same place.
**Kit.** `copy` with `rotate` and `slide` for the stand, angle `marks`, `names` and ratio cards.
**Writer.** Strongest: the correspondence comes from two different givens and the stand is the explanation.

---

### `similarity-proof-aa` — Two angles, then the proportion

**Standard.** HSG.SRT.B.5 ("prove relationships in geometric figures"); HSG.SRT.B.4 for the parallel figure, which proves "a line parallel to one side of a triangle divides the other two proportionally" word for word.
**Check first.** Option ids only; expose the texts and the figure from `facts.ts`, and match the app's reason wording.

**Foundations first.** The proof's shape, always: givens; two angle pairs; the similarity by AA with letters in matching order; the proportion, read from the statement. The two pairs come from two sources in this type: a parallel pair gives corresponding angles (the F: a transversal crossing two parallels, the two angles in the same position at each crossing), or two perpendiculars give two right angles, congruent; and the angle at the top corner belongs to both triangles, reflexive, a pair for free. Why the small triangle is the big one: it is the big one dilated from the shared corner (foundation 9), which is also why the proportion compares the pieces from that corner to the whole sides.

**Read.** Gold on "Prove": a proportion, so the last line is "corresponding sides of similar triangles are proportional" and the line before it is the similarity. The givens are the first lines. At a glance: the shared corner is the one both triangle names start with.

**The example.** "Given: MN ∥ KL. Prove: JM/JK = JN/JL." Figure: triangle JKL with M on JK, N on JL, MN ∥ KL. (1) Row 1: MN ∥ KL, Given; arrows on both. (2) The F along JK lights: ∠JMN ≅ ∠JKL, corresponding angles of parallel lines; one arc each. (3) ∠J ≅ ∠J, reflexive; the corner marked once, named for both triangles. (4) △JMN ~ △JKL, AA; names card J M N over J K L; the rays from J show the small triangle as the dilation of the big one. (5) JM/JK = JN/JL, corresponding sides of similar triangles are proportional; the fractions read down the columns J|M over J|K and J|N over J|L.
**Second example (the perpendicular figure, different reasons).** "Given: AB ⊥ BC and AB ⊥ DE. Prove: AD/AB = DE/BC." Two givens; ∠ADE and ∠ABC are right angles, perpendicular lines form right angles; ∠ADE ≅ ∠ABC, all right angles are congruent; ∠A ≅ ∠A, reflexive; △ADE ~ △ABC, AA; the proportion. Brief.
**The other shapes** (fill the reasons; order the lines) are the same chain read: a line may only use lines above it.

**Fast.** Givens; the pair the given hands you (F or right angles); the shared corner; AA with the shared corner first in both names; the proportion straight from the columns.
**Sense.** Exactly two angle pairs before AA; every fraction is small over big the same way.
**Check.** Each fraction's letters are neighboring columns of the stacked names.
**Line.** "Two angles, AA, then read the sides from the names."
**Trap.** The shared angle not counted as a pair (so the student hunts for a third mark on the picture), and "alternate interior" written for the F (the angles here are on the same side of the transversal, in matching positions: corresponding). The F drawn and lit, and the corner marked once for both.
**Kit.** `proof` card, `names` card, `rays`.
**Writer.** Strongest.

---

### `dilation-measure` — From the center, k times as far

**Standard.** HSG.SRT.A.1b, "The dilation of a line segment is longer or shorter in the ratio given by the scale factor"; 8.G.A.3 for the image point ("the effect of dilations ... using coordinates"); the angle variant practices what A.1a implies (lines go to parallel lines, so angles are kept). Mixed, three kinds: a factor or a length; an image point from a named center; an angle.

**Foundations first.** A dilation has a center and a factor k; every point goes along the ray from the center through it, to k times as far (foundation 5). The rays drawn from the center through every corner, each image corner sliding out along its ray, the image sides parallel to the originals. Consequences, one beat each: every length × k (new over old is k); the L from the center to a point grows k times, arm by arm; k above 1 pushes out, k below 1 pulls in; angles unchanged, because the sides stay parallel.

**Read.** Gold on the center's coordinates when it is not the origin, on k as a number (3/2 enlarges, 1/2 shrinks), on what is asked (factor, length, a coordinate, a degree). At a glance: for a point, the image is farther out along the ray from C than P when k > 1; for a factor, new over old.

**The example.** "Center C(3, 1), scale factor 3/2, maps P(5, −3) to P′. The y-coordinate of P′?" (1) Plane; C blue, P teal; the ray from C through P drawn past P. (2) The L from C to P: over 2, down 4, arms labeled. (3) Each arm times 3/2: over 3, down 6; the L grows along the ray. (4) Back from C: (3 + 3, 1 − 6) = (6, −5); P′ lands in rust with its readout. y = −5. (5) On the board, the rule card: P − C = (2, −4); × 3/2 = (3, −6); + C = (6, −5).
**Quick cases.** Factor from lengths: 5 to 15, k = 15/5 = 3; 5 to 5/2, k = 1/2 and the segment pulled in toward the center. A length from k: 5 × 3/2 = 15/2. The angle: △ABC with ∠B = 23° dilated by 2; rays from the center, the image twice as long, sides parallel, the arc at B′ the same 23°.

**Fast.** Factor: new over old. Length: × k. Point: from C write the L, multiply both arms by k, add C back; from the origin that is multiply both coordinates. Angle: copy.
**Sense.** With k = 3/2 the image is farther from C than P, on the same side; a shrink lands between C and P.
**Check.** Undo: from C the L to P′ is (3, −6); divide by 3/2: (2, −4), which is P. For a factor: 5 × 3 = 15.
**Line.** "Dilate: from the center, k times as far. From the origin, that is multiply both."
**Trap.** Treating C as the origin: 3/2 × (5, −3) = (7.5, −4.5), y = −4.5, the planted decoy. The L is drawn from C, never from the origin, and the rays make it impossible to put the image anywhere else. Also k = 15 − 5 = 10 by subtracting: the ratio card reads new over old.
**Kit.** `rays`, `ell` from any center, `dilate` with `center`, readout at the landed point.
**Writer.** Strongest: mixed, and the center-not-origin L is the hardest idea in the family's grade-8 half.

---

### `similar-solid-volume` — k, k squared, k cubed

**Standing.** No Common Core standard; state-standard material (Texas G.10B and the like). It stands on this family's k (foundation 11), not on HSG.SRT.A.1 where it is filed. Keep it and mark it so. One method with a direction to read.

**Foundations first.** Similar solids: one is the other dilated by k, so every edge is × k. The grown cube, built live from the app's cube solids: a unit cube dilated by 3 is an edge of 3, each face 3 by 3 = 9 squares, and 3 layers of 9 = 27 unit cubes. So edges × k, surface areas × k², volumes × k³. Read backward: a surface-area ratio is k², so k is its square root; a volume ratio is k³, so k is its cube root. Every quantity in the problem names its own power.

**Read.** Gold on which pair is given (edges, surface areas, volumes) and which kind is asked. At a glance: a volume ratio is a big number whose cube root is small (27 → 3); the asked surface area grows far less than the volume did.

**The example.** "Two similar solids. The smaller has surface area 11 cm² and volume 70 cm³. The larger has volume 1,890 cm³. The larger's surface area?" (1) The volume pair: 1,890 ÷ 70 = 27; that ratio is k³. (2) k = ∛27 = 3, because 3 × 3 × 3 = 27; the small cube grows by 3 on screen, 27 cubes counted by layers. (3) Surface areas go by k² = 9: one face of the grown cube, 9 squares. (4) 11 × 9 = 99 cm². On the board, three lines under three headers: lengths × 3, areas × 9, volumes × 27, with the given and the asked lit.
**Quick cases.** Edges 6 and 30: k = 5, volume 19 × 125 = 2,375. Surface areas 36 and 576: ratio 16, k = √16 = 4, volume 27 × 64 = 1,728. Volumes 76 and 9,500: ratio 125, k = 5, edge 6 × 5 = 30.

**Fast.** Divide the given pair, larger over smaller; undo its power to get k (√ for areas, ∛ for volumes); raise k to the asked power; multiply.
**Sense.** 1,890 is 27 times 70, so the surface area grows by less than 27 and more than 3: 99 fits; a volume answer is the big jump, a surface-area answer the middle one, an edge the small one.
**Check.** 3³ = 27 recovers the given ratio; 99 ÷ 11 = 9 = 3².
**Line.** "Lengths times k, areas times k squared, volumes times k cubed. Find k first."
**Trap.** Using the volume ratio on the surface area (11 × 27 = 297), or taking k itself as 27. The three headers with the grown cube under them make 27 a count of cubes, 9 a count of squares, 3 a length.
**Kit.** The cube solids through `scene` with a grow motion (one cube to k³ by layers); otherwise the board.
**Writer.** Cheaper model, from this concept, once the grown cube exists.