# Rational exponents (Algebra 2): two more concepts

Both types are correctly filed. Each stands on the family's foundations 11 and 12 (a fraction exponent is a root because the laws demand it; radicals are powers and obey the laws), which the pilot lesson `rational-power` builds in full. These lessons name those foundations in one short beat each and show the owned picture, then spend their time on the one thing each type asks.

---

### `combine-unlike-radicals` — Simplify one root, add the like roots, keep the different one.

**Flags first.** Well conceived. Every variant has the same shape: three terms, two of them square-free roots that differ (one may carry a coefficient), and one big root in disguise that simplifies to a multiple of one of the two. The decoys are real mistakes in every variant but one: the `√6 + 2√3 + √12` variant offers `5√9`, an unsimplified root nobody would write (√9 is 3); replace it with `3√3 + √6`-style dropped-factor decoys like the other variants have. The type never writes a rational exponent; it practices the radical half of the standard through the product property.

**Standard.** HSN.RN.A.2: "Rewrite expressions involving radicals ... using the properties of exponents." The property used is the power of a product at exponent one half, √(16 · 3) = √16 · √3, and then like terms (family 12).

**Foundations first** (built live, about forty seconds). (1) A square root is a side: √48 is the side of a square whose area is 48. It is one number, between 6 and 7 because 36 < 48 < 49 (family 3's line, one beat). The number under the sign is the *radicand*. (2) The square array: a square of area 48 is drawn to scale, then cut into a 4-by-4 array of squares of area 3 (16 · 3 = 48). Its side is four sides of the small square: √48 = 4√3. That is the law √(ab) = √a · √b at exponent one half, shown rather than stated; the board writes √(16 · 3) = √16 · √3 = 4 · √3. "A square factor comes out as its root." A root is *simplified* when no square factor is left under it: 3 and 5 are prime, so √3 and √5 are finished. (3) Sticks: √3 is a stick about 1.73 long; 5√3 is five of them end to end under a bracket; √5 is a stick of a different length, about 2.24. Sticks of the same length are *like radicals* and are counted together, like terms; a stick of another length is counted on its own line. √3 + √5 is two sticks of two lengths, about 3.97; it is not √8, which is about 2.83.

**Read.** "Which expression is **equivalent** to √5 + 5√3 + 2√48?" Equivalent means the same amount with every root finished and like roots gathered. At a glance: 3 and 5 are square-free, 48 is not, so 48 is the disguise, and 48 = 16 · 3 means it hides a √3. The answer has exactly two terms, a √3 term and a √5 term; any one-term choice is gone before any work.

**The example.** √5 + 5√3 + 2√48, choices 7√3 + √5 | 13√3 + √5 | 14√8 | 14√3. Chosen because the big root carries a coefficient (so the multiplication step shows), its largest square factor is 16 and not 4 (so "keep going until it is finished" has teeth), and √3 and √5 are visibly different lengths.
1. The problem card; "equivalent" gold. The three radicands: 5 prime, 3 prime, 48 not. Find the largest square that divides 48: 4 does, 16 does, 25 does not. 48 = 16 · 3.
2. The array: the 48-square cut 4-by-4 into 3-squares, side bracketed 4√3. Board: √48 = √16 · √3 = 4√3. One beat on why 16 and not 4: a 2-by-2 array of 12-squares still has square factors inside each 12-square; the lines keep going until every small square is a 3. Taking out 4 gives 2√12, which is not finished.
3. So 2√48 = 2 · 4√3 = 8√3. Eight √3-sticks appear in a row.
4. Rewrite: √5 + 5√3 + 8√3. The eight sticks slide onto the row of five; the bracket rewrites 5 + 8 = 13: 13√3. The √5 stick stays on its own line, a different length.
5. Answer: 13√3 + √5.

**Fast.** Find the big root; pull out the largest square factor as its root; multiply by the number already in front; add the like roots' numbers; leave the other root alone.

**Sense.** 2√48 is about 2 · 6.9 = 13.9 and 8√3 is about 8 · 1.73 = 13.9: the rewrite kept the size. The whole: 2.2 + 8.7 + 13.9 ≈ 24.8, and 13√3 + √5 ≈ 22.5 + 2.2 ≈ 24.7.

**Check.** Square the piece that was rewritten: (8√3)² = 64 · 3 = 192 and (2√48)² = 4 · 48 = 192. Same.

**Rule out.** 14√3 and 14√8 are one term: the √5 cannot join a √3, so both dim together; 14√8 also added radicands. 7√3 + √5 has 7 = 5 + 2: it forgot the 4 that came out of the 16. 13√3 + √5 remains; prove it.

**Line.** "A square factor comes out as its root. Like roots add like like terms; different roots stay apart."

**Trap.** Three, all seen in the decoys. Dropping the factor's root (2√48 → 2√3, giving 7√3): the array shows four small sides along one big side, so the 4 is there to be multiplied. Adding radicands (√3 + √5 = √8): the two stick lengths and the number line, 3.97 against 2.83, on a `watch` card that stays. Taking the square out whole (√48 = 16√3): 16√3 is about 28, four times too big against √48 ≈ 6.9; the side of the 16-array is 4.

**Kit.** The family's `squares` helper with k = 4 and area 3 (the design shows k = 2; make k any small integer), with its `gather` motion; `sticks` for two lengths, plus one action, `join` (a second row of sticks slides onto the first and the bracket count rewrites 5 + 8 = 13); `dim` for choices; `axes` as a number line for the 3.97-against-2.83 beat. Nothing else.

**Writer.** A capable cheaper model: one method, every variant the same case, two named components, decoys named by their mistake, and the math check catches every slip.

---

### `rational-exponent-product` — Roots as powers; the laws do the rest.

**Flags first.** Correctly filed and the decoys are the real errors (a cube root read as a cube; the denominator's exponent added; the bare letter's 1 dropped). Two fixes to the app, both already noted in the family design: the card renders `2x¹∛(27x¹)` and should read `2x∛(27x)`; a negative exponent is written `a^{\frac{-7}{6}}` and should read `a^{-\frac{7}{6}}`. The type holds two shapes under one method, a quotient of powers of `a` (five of six wordings) and a coefficient times a cube root of a product; both are worked.

**Standard.** HSN.RN.A.2: "Rewrite expressions involving radicals and rational exponents using the properties of exponents." It leans on HSN.RN.A.1's meaning, "we define 5^(1/3) to be the cube root of 5 because we want (5^(1/3))³ = 5^(1/3 · 3) to hold", which the lesson restates in one beat.

**Foundations first** (about fifty seconds). (1) The split ladder, named not re-taught: between 8⁰ = 1 and 8¹ = 8 three equal steps each multiply by ∛8 = 2, so 8^(1/3) is the cube root; three of those steps make one. The same ladder with the letter: a^(1/3) is ∛a, one third of a step up from 1 to a. Words in passing: *radical*, *radicand*, *index* (the small 3), *rational exponent*. "Where a > 0" means every root here is one positive number; nothing more to do with it. (2) The laws, with the strip for one beat: a³ · a² is five factors, so multiply means add; divide means subtract, top minus bottom. They hold for fractions because a^(1/3) was defined exactly so that they would. (3) The arithmetic the lesson needs, in one line: to add 1/3 + 3, write 3 as 9/3 (family 9).

**Read.** "Which expression is **equivalent** to (∛a · a³)/a^(1/2)?" Every choice is a to one power, so the whole job is one exponent. At a glance: multiply means add, the bar means subtract, a cube root is a small step up (one third), never three steps. The answer is a little under a³: a bit more from the root, a bigger bit less from the square root. a^(11/2) is too big before any work.

**The example.** (∛a · a³)/a^(1/2), choices a^(11/2) | a^(17/6) | a^(5/2) | a^(23/6). Chosen because the cube root stands beside a cube, so the most common misreading (∛a as a³) is on screen against the truth, and the fractions need a common denominator.
1. Problem card, "equivalent" gold. Rewrite the root: ∛a = a^(1/3); the third rung of the ladder lights. Board: a^(1/3) · a³ / a^(1/2).
2. Top, multiply: add. 1/3 + 3 = 1/3 + 9/3 = 10/3. Board: a^(10/3) / a^(1/2).
3. Divide: subtract, top minus bottom. 10/3 − 1/2: sixths: 20/6 − 3/6 = 17/6.
4. Answer: a^(17/6).

**Quick second case** (the subtraction goes past zero; three or four beats): (∛a · a^(1/2))/a²: 1/3 + 1/2 = 5/6; 5/6 − 2 = 5/6 − 12/6 = −7/6. A negative exponent is a flip: a^(−7/6) = 1/a^(7/6). At a glance here: taking away two whole steps from less than one must land below zero, so a^(17/6) and a^(3/2) dim together.

**Second full example** (a different case: a root of a product with a number inside, and a coefficient). 2x∛(27x), choices 54x^(4/3) | 6x^(1/3) | 6x⁴ | 6x^(4/3).
1. A root of a product is the product of the roots, the power of a product at exponent one third: ∛(27x) = ∛27 · ∛x. ∛27 = 3 because 3 · 3 · 3 = 27 (three cells fold into 3³). So ∛(27x) = 3x^(1/3).
2. 2x · 3x^(1/3): numbers with numbers, 2 · 3 = 6. Letters with letters: the bare x is x¹; 1 + 1/3 = 4/3.
3. Answer: 6x^(4/3).
Sense: 2x times something a little more than 3x^(1/3)... the product is less than 2x · 3x = 6x², so the exponent is under 2; 6x⁴ is gone at a glance. Check: x = 8: 2 · 8 · ∛216 = 16 · 6 = 96, and 6 · 8^(4/3) = 6 · 16 = 96. Rule out: 54x^(4/3) took 27 out whole (a cube factor comes out as its cube root, 3); 6x⁴ read the cube root as a cube; 6x^(1/3) forgot the bare x is x¹.

**Fast.** Write every root as a power (index on the bottom). Multiply: add exponents. Divide: subtract, top minus bottom, even past zero. Numbers with numbers. Then it is adding fractions.

**Sense.** 17/6 is about 2.8: just under a³, as the glance said.

**Check.** Let a = 64, where every piece is a power of 2: ∛64 = 4 = 2², 64³ = 2¹⁸, √64 = 8 = 2³; the whole-number ladder gives 2 + 18 − 3 = 17, and 64^(17/6) = (64^(1/6))^17 = 2^17. The fraction laws agree with the whole-number laws, which is the point of foundation 11, said in one line.

**Rule out.** Dividing by a^(1/2) must land below 10/3; a^(23/6) (added the bottom's exponent) and a^(11/2) (read the root as a cube) are above it and dim together. a^(5/2) dropped the root entirely. a^(17/6) remains; prove it.

**Line.** "Write every root as a power; then multiply means add, divide means subtract."

**Trap.** Three realistic ones, each a decoy. The cube root read as a cube (∛a → a³): the ladder shows a^(1/3) one third of a step up, and a³ three whole steps; they are on screen together in the first example. The denominator's exponent added instead of subtracted: the quotient law is said as "top minus bottom" and the size check (the answer must be smaller than the top) catches it. 1/3 + 3 written as 4/3 (adding to the numerator only): the 3 is rewritten as 9/3 on the board before adding. In the second example, 27 taken out whole and the bare x's exponent dropped, both named when their decoys dim.

**Kit.** The family's `ladder` extended to a symbolic base (`base: "a"`, columns exponent | power only, no value column, `split` into thirds); `factors` fold for 3 · 3 · 3 → 3³; `dim`; fraction exponents in problem cards and choices. The app's two notation fixes above, so the film can match the problem the learner sees.

**Writer.** A capable cheaper model, once `rational-power` (pilot 5) is approved to copy the ladder beat from: one method, two named cases fixed by the concept, decoys named, and `--dry` verifies every exponent line. The cheaper writer must stage the ladder, not describe it; that beat is twenty seconds and the pilot lesson shows exactly how.