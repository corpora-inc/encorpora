# Circles, part 1: ten problem-type concepts

From the family design. Source for every variant: the output of `film/facts.ts`. Each concept names the foundations it stands on by number (§1 of the design) and the motions by name (§2).

**Said first, about the types as they stand.**
- `arc-length-coefficient`, `sector-area-coefficient`, `geo-arc-length-rounded` and `arc-sector-derivation` are linked to 7.G.B.4, which has no arcs or sectors in it. All four serve HSG.C.B.5. The concepts below quote that standard.
- `circle-angles` holds two tangent-Pythagoras items that are `tangent-circle-computation`'s. Until they move, the lesson gives them one quick case at the end (marked below) so a learner is not ambushed; the day they move, that case goes.
- `circle-estimate-blanks` is two fill-ins from two other types (`pi-as-ratio` and the 3.14 case of `circle-area-coefficient`), and `facts.ts` prints only the slot keys. The generator must print the sentence; the concept below assumes the plainest reading of it.
- `circle-circumference-coefficient` and `circle-area-coefficient` have no multiple choice; the `dim` beat is omitted, and "Sense" carries the whole rule-out habit.

**The shared opening of every grade 7 film (about twenty seconds, drawn live).** A teal ring; a dot at the center, O; one teal radius drawn from O to the rim and labeled r: "a circle is every point one radius from the center" (foundation 1). The radius turns through a half turn, sweeping a second radius on the far side; the two together are the diameter, labeled d = 2r. The rim lights rust: "the distance around is the circumference." Each grade 7 lesson then adds only what its problem uses (the unroll, the wedges).

---

## Circle measurement (grade 7, 7.G.B.4)

### `mcas-circle-radius-distance` — The distance from the center to a point on the circle

**Standard.** 7.G.B.4, "know the formulas for the area and circumference of a circle and use them to solve problems", practiced as C = πd read backward; mostly it is foundation 1 itself, the definition of a circle.

**Foundations first.** The shared opening, then one more beat: P is a dot that glides all the way around the rim while the teal segment O–P stays drawn and its length label never changes. "Wherever P is on the circle, O to P *is* the radius." Then the unroll, once, on the same circle: the rim peels off and lays flat; the diameter is laid along it three times and a bit: "around is a bit more than three diameters; the exact number is π, so C = πd" (foundation 2). No area here.

**Read.** "What is the distance from O to P" (gold) is "what is the radius." The problem gives one of three things: the radius itself (done), the diameter (halve it), or the circumference (it is π diameters, so the number in front of π is the diameter; halve it). At a glance: the answer is a radius, so it is smaller than any diameter or circumference mentioned, and if a circumference is given as aπ, the diameter is a.

**The example.** "A circle with center O has a circumference of 6π cm. Point P is on the circle. What is the distance from O to P?" Choices 5, 18, 6, 3. (1) The sketch: circle, O, P on the rim, the teal segment O–P with a "?" label; the rim labeled 6π. (2) At a glance: O to P is the radius. (3) Unroll the rim: a rust line labeled 6π; the diameter laid along it fits π times, so d = 6 (board: `C = \pi d`, `6\pi = \pi \cdot 6`, `d = 6`). (4) The diameter folds in half at O: `r = 3`. (5) 3 cm.
*Quick second case (a different given):* "diameter of 60 cm": the diameter is drawn, O marks its middle, half is 30. One beat: `r = 60 \div 2 = 30`.

**Fast.** Radius given: that is it. Diameter: halve. Circumference aπ: a is the diameter; halve it.

**Sense.** Around is three diameters and a bit; 6π is about 19, so the diameter is about 6 and the radius about 3. The answer is the smallest length in the problem.

**Check.** Build back up: 3 doubled is 6, and 6 diameters of π is 6π. The segment O–P on the figure is visibly half the drawn diameter.

**Rule out.** Anything not smaller than the given diameter or circumference dims at once: 18 (a wrong multiplication of 6 by 3) and 6 (the diameter, not the radius) dim together; 5 is neither half of 6 nor anything in the picture. For the diameter variant, 60 (the diameter itself) and 120 (doubled) dim together; for the radius variant, 100, 5 and 20 are all things done to a number the question already gave as the answer.

**Line.** "O to any point on the circle is the radius."

**Trap.** Answering the diameter (6 for 6π, 60 for 60 cm): the student finds the number the circle is "labeled with" and stops. The lesson's figure draws the diameter in two teal halves and the question's segment O–P is visibly one half; the board writes `r =` on its own line every time.

**Kit.** `unroll` and `lay` (family design 4.2), `dim`, a point that glides on a circle with a live length label on O–P (exists: `glide` on a circle point, `dim`/`label`).

**Writer.** Cheaper model: one method, one picture, the sense check does the ruling out.

---

### `pi-as-ratio` — Around divided by across is one number

**Standard.** 7.G.B.4, "know the formulas for … circumference", practiced as the meaning of π: C ÷ d for any circle. This is the family's foundation film (foundation 2); if it is not beautiful nothing after it will be.

**Foundations first.** The shared opening, then the unroll in full and slowly: the rust rim peels off from the bottom of the circle and lays flat as a line exactly as long as the rim. The teal diameter lifts and is laid along it: "one, two, three", and a short stub remains. "Every circle: three diameters and a bit. The bit is always the same bit, about 0.14 of a diameter. Three and that bit is a number we call pi, about 3.14. So around ÷ across = π, which is the same as around = π × across: C = πd." Then, on a circle twice as wide beside it, the same unroll and lay: three and the same bit. "Every circle is every other circle, scaled; the rim scales with the diameter, so the ratio does not move."

**Read.** The type asks one question four ways. "Circumference divided by diameter" (gold) from two measurements: find d (double the radius if that is what is given), divide, round. "What happens to the ratio" when the diameter grows: nothing. "Which ratio equals π": the one with circumference on top and diameter underneath. At a glance: any C ÷ d a student computes must come out near 3.14; anything else means the wrong two numbers were divided.

**The example** (the computation; the other two are read straight off the opening). "A circular lid has a radius of 2.5 cm and a circumference of 15.7 cm. What is the circumference divided by the diameter, rounded to the nearest hundredth?" Choices 6.28, 0.32, 3, 3.14. (1) The sketch: the lid, O, r = 2.5. (2) "Divided by the *diameter*", gold: `d = 2 \times 2.5 = 5`. (3) Unroll the rim: 15.7 long. Lay the diameter: 5, 10, 15; the stub is 0.7. (4) The stub as a fraction of a diameter: `0.7 \div 5 = 0.14` (seven tenths split five ways is fourteen hundredths). (5) `15.7 \div 5 = 3.14`. Three and the bit.
*Quick beat on the second lid wording:* diameter 7, rim 22: three sevens are 21, the stub is 1; one seventh of a diameter is 0.142…, which is 0.14 to the nearest hundredth. "Measured circles give slightly different bits because measuring is rough; every one rounds to about 3.14."
*Quick beat, the ×10 question:* the big circle from the opening: "ten times across, ten times around; still three and a bit. It stays the same."
*Quick beat, the definition question:* the board writes `\pi = \dfrac{\text{circumference}}{\text{diameter}}` under the unrolled picture, around on top.

**Fast.** d first (double a radius); C ÷ d; round. Or lay it out: how many diameters fit, and what fraction of a diameter is left.

**Sense.** The answer is three and a bit. Anything twice that divided by the radius; anything under one is upside down.

**Check.** Multiply back: 3.14 × 5 = 15.7.

**Rule out.** 6.28 is twice π (circumference ÷ radius), 0.32 is less than one (diameter ÷ circumference, upside down): both dim with "not three and a bit". 3 is the whole diameters with the bit thrown away, and the question says "nearest hundredth". For the ×10 question, the three choices that say the ratio changes dim together: "every circle unrolls to three and a bit." For the definition, diameter ÷ circumference is under one, circumference ÷ radius is about 6.28, and area ÷ diameter changes from circle to circle (a radius of 1 gives π/2, a radius of 2 gives 2π).

**Line.** "Around is three diameters and a bit. The bit is the same for every circle."

**Trap.** Dividing by the radius when the radius is what was given (6.28). The gold word "diameter" and the `d =` line on the board come before the division, and the lay motion lays the whole diameter, visibly two radii, along the rim.

**Kit.** `unroll`; `lay` with a live count and the stub labeled as a fraction of the laid segment; `dilate` or a second circle drawn to twice the scale; `dim`.

**Writer.** Strongest writer: the insight is the unroll-and-lay motion done twice, and it carries the whole family's sense check.

---

### `circle-circumference-coefficient` — The circumference as aπ

**Standard.** 7.G.B.4, "know the formulas for … circumference of a circle and use them to solve problems."

**Foundations first.** The shared opening and the unroll with the diameter laid three times and a bit, ending on the line `C = \pi d`: "the circumference is π diameters." One more beat: "so when a circumference is written aπ, the number a is the diameter; nothing to compute but the diameter."

**Read.** "Its circumference is aπ cm. What is a?" (gold on aπ and a). The answer is the diameter as a plain number or fraction, no π, no unit. At a glance: if the problem gives a diameter, a is already there; if it gives a radius, a is twice it. Fractions are just fractions: 9/2 doubles to 9, 5/2 stays 5/2.

**The example.** "A circle has a radius of 9/2 cm. Its circumference is aπ cm. What is a?" (1) The sketch: circle, O, the radius labeled 9/2. (2) "The circumference is π diameters, so I need the diameter": the radius sweeps the half turn; the two radii are the diameter; `d = 2 \times \frac{9}{2} = 9`. (3) Unroll the rim and lay the diameter: 9, 18, 27, and the bit: "π nines." `C = \pi d = 9\pi`. (4) `a = 9`.
*Quick second case (a diameter given, the fraction stays):* "diameter of 5/2 cm": `d = \frac{5}{2}`, so `C = \frac{5}{2}\pi`, `a = \frac{5}{2}`. One beat: "the diameter is already the answer; do not double it, a diameter is already two radii."

**Fast.** a is the diameter. Given a radius, double it; given a diameter, write it down.

**Sense.** The circumference is a bit more than three diameters: 9π is about 28, and three 9s are 27.

**Check.** a halved is the radius the problem gave: 9 ÷ 2 = 9/2.

**Line.** "The circumference is π diameters. The number in front of π is the diameter."

**Trap.** Writing the radius as a (a = 9/2) because the formula remembered is "2πr" and the 2 is forgotten, or doubling a given diameter (a = 5 for d = 5/2) because the formula has a 2 in it. The lesson teaches "π diameters" instead of 2πr, draws the diameter as two teal halves, and the board's first line is always `d =`.

**Kit.** `unroll`, `lay`. Nothing new.

**Writer.** Cheaper model: one method, the diameter line, the lay motion.

---

### `circle-area-coefficient` — The area as aπ, and the wedge derivation

**Standard.** 7.G.B.4 in full: "know the formulas for the area … of a circle and use them to solve problems; give an informal derivation of the relationship between the circumference and area of a circle." The derivation clause is practiced by no item in the app (design §6); this lesson teaches it anyway, because it is what makes πr² a thing seen rather than a thing recalled.

**Foundations first.** The shared opening with `C = \pi d = 2\pi r` on the board. Then the wedges (foundation 3), slowly: the disk is cut into 8 gold wedges; alternate wedges lift, turn over and interleave into a bumpy strip beside the circle; cut to 16, then 32, and the strip settles into a rectangle. A teal bracket on its side reads "r"; a rust bracket along its top reads "half the rim: πr" (the top edge is the rim's pieces, half of them pointing up). "A rectangle's area is width times height: πr × r = πr². The area of a circle is π times the radius squared: a bit more than three squares on the radius." On the circle, a teal square r by r is drawn on the radius; three copies tile most of the disk with a sliver left: "three and a bit squares on the radius."

**Read.** "Its area is aπ square centimeters. What is a?" (gold). a is r², a plain number or fraction. At a glance: if a radius is given, square it; if a diameter is given, halve first, then square, so a will be a fraction over 4 when the diameter is odd. A separate wording says "use 3.14 for π" and asks for the area itself: then a × 3.14, a decimal.

**The example.** "A circle has a diameter of 19 cm. Its area is aπ square centimeters. What is a?" (1) The sketch: circle, O, the diameter 19 drawn in two teal halves. (2) "Area needs the radius; the diameter is two radii": `r = \frac{19}{2}`. The square on the radius is drawn, 19/2 by 19/2. (3) `r^2 = \left(\frac{19}{2}\right)^2 = \frac{19 \times 19}{2 \times 2} = \frac{361}{4}` (top squared over bottom squared). (4) `A = \pi r^2 = \frac{361}{4}\pi`; `a = \frac{361}{4}`.
*Second worked example (a different answer form, the arithmetic is the new thing):* "A circle has a radius of 4 cm. Use 3.14 for π. What is its area, in square centimeters?" `r^2 = 16`; `A \approx 3.14 \times 16`; `314 \times 16 = 5{,}024`, two decimal places: `50.24`. Three beats.

**Fast.** Radius first; square it. Given a diameter, a = d²/4 (halving then squaring is the same as squaring then dividing by four; both always work). "Use 3.14": multiply a by 3.14.

**Sense.** Three and a bit squares on the radius. 19/2 is 9.5; 9.5 × 9.5 is about 90; the disk is about 3 × 90, about 280, and 361/4 is 90.25, so 90.25π is about 283. For the second: 3 × 16 = 48 and a bit: 50.24.

**Check.** 4 × 361/4 = 361 = 19², the diameter squared; or the square root of a is the radius given.

**Line.** "Area: half the rim times the radius. A bit more than three squares on the radius."

**Trap.** Squaring the diameter (a = 361): the number in the problem gets squared without the halving. Also doubling instead of squaring (a = 19, which is the circumference's a). The wedge rectangle's teal side *is* a radius, and the board's first line is `r =`; the square on the radius sits visibly inside the circle, where a square on the diameter would not fit.

**Kit.** `wedges` and `rearrange` with `dim` brackets on `c.strip.h` and `c.strip.top` (family design 4.3); a square drawn on the radius and copied (`poly` with `turn`/`slide`, exists); the decimal product uses `stack` as in `decimal-multiplication`.

**Writer.** Strongest writer for the first one, which carries the wedge derivation as a reusable shot; after it exists, a cheaper model can write the method part.

---

### `circle-estimate-blanks` — Fill the estimating sentence

**Said first.** This type is two halves of two other types: "estimate π from C and d" is `pi-as-ratio`'s computation, and "estimate the area of a 4-foot sign with 3.14" is `circle-area-coefficient`'s second case. `facts.ts` prints `{"top":"a","bottom":"b","pi":"a"}` and `{"radius":"c","area":"a"}` with no sentence; the generator must print the exact sentence or the lesson cannot show the problem as the learner sees it. Until it does, the concept assumes the sentences read "π ≈ circumference ÷ diameter = [top] ÷ [bottom] ≈ [pi]" and "The radius is [radius] feet, so the area is about 3.14 × [radius] × [radius] = [area] square feet." The type should become one fill-in attached to each of the two parent types; this concept is written so that its lesson is those two parents in fill-in form, short.

**Standard.** 7.G.B.4, "know the formulas … and use them to solve problems", in estimate form.

**Foundations first.** The shared opening; the unroll with three and a bit (π ≈ 3.14 is the estimate of that number); and, from the area lesson, one line, not re-derived: "area is π times the square on the radius."

**Read.** "Complete the sentence" (gold on the blanks). The first sentence wants the two measurements in the right order and their quotient; "across" means the diameter. The second wants the radius (half of "across") and 3.14 × r × r. At a glance: the first blank pair must divide to about 3.14; the area must be about three squares on the radius.

**The example.** "A circle has a circumference of 44 centimeters and a diameter of 14 centimeters. Complete the sentence about estimating π." (1) The sketch: circle, diameter 14, rim 44. (2) "Around divided by across": top 44, bottom 14. (3) Lay 14 along the unrolled 44: 14, 28, 42, stub 2; two fourteenths is one seventh, about 0.14: `44 \div 14 \approx 3.14`.
*Second example (the other sentence, different work):* "A circular sign is 4 feet across. Use 3.14 for π to estimate its area." "Across is the diameter": `r = 2`; `3.14 \times 2 \times 2 = 3.14 \times 4 = 12.56` square feet. Three beats.

**Fast.** π: circumference on top, diameter underneath. Area: halve "across", then 3.14 × r × r.

**Sense.** 44 ÷ 14 is three and a bit; a sign 4 feet across has about three squares of 2 by 2 in it, about 12.

**Check.** 3.14 × 14 ≈ 44; 12.56 ÷ 3.14 = 4 = 2².

**Line.** "Around over across; three and a bit."

**Trap.** Using 4 as the radius (3.14 × 16 = 50.24) because "across" was not read as the diameter. The figure draws the 4 feet across O as two 2-foot radii before any multiplication.

**Kit.** A fill-in `problem` card with labeled blanks that fill on the word (the board has `problem` and `write`; blanks that light and fill are a small addition).

**Writer.** Cheaper model, once the sentence is printed.

---

## Arc and sector measure (Geometry, HSG.C.B.5)

**The shared opening of these four films (about thirty seconds).** The circle with O and r. The gold fan opens from the radius at three o'clock, counterclockwise, with the degree readout counting, all the way around to 360: "a full turn is 360 degrees." It closes to the angle of the problem and stops; the fraction appears beside it, reduced. The rim it covers lights rust: "the arc is this fraction of the rim; an arc is a *length*." The wedge pulses: "the sector is the same fraction of the disk; a sector is an *area*" (foundation 4). The board writes the two wholes: `\text{rim} = 2\pi r`, `\text{disk} = \pi r^2`. Then "fraction first, then of the whole."

### `arc-length-coefficient` — An arc as aπ

**Standard.** HSG.C.B.5, "the length of the arc intercepted by an angle is proportional to the radius" (the fraction-of-the-turn computation that proportionality licenses). Not 7.G.B.4.

**Foundations first.** The shared opening with the fan, the fraction, the rust arc. One more beat: the rim unrolls into a rust line 2πr long, and the arc's share of it is the same fraction of that line. "An arc is a piece of the circumference, so its whole is 2πr, which is πd."

**Read.** "An arc corresponds to a central angle of θ degrees. Its length is aπ cm. What is a?" (gold on "length", "aπ", "a"). a is the fraction θ/360 times 2r (which is d), a plain number or fraction. At a glance: if θ is under 180 the arc is under half the rim, so a is less than r; a diameter given needs no doubling.

**The example.** "A circle has a radius of 11 cm. An arc corresponds to a central angle of 150 degrees. Its length is aπ cm. What is a?" (1) The sketch: circle, O, r = 11, the gold fan to 150 with the readout; the rust arc. (2) The fraction: `\frac{150}{360} = \frac{5}{12}` (divide top and bottom by 30). (3) The whole: `2\pi r = 22\pi`; the rim unrolls, 22π long, and 5/12 of it is rust. (4) `\frac{5}{12} \cdot 22\pi = \frac{110}{12}\pi = \frac{55}{6}\pi`. (5) `a = \frac{55}{6}`.
*Quick second case (a diameter given, more than half a turn):* "diameter of 4 cm, 210 degrees": the fan passes the half turn; `\frac{210}{360} = \frac{7}{12}`; the rim is `\pi d = 4\pi`; `\frac{7}{12} \cdot 4 = \frac{7}{3}`. Three beats; the arc is visibly more than half the rim and 7/3 is more than 2.

**Fast.** Reduce θ/360; multiply by the diameter (2r if a radius was given). That is a.

**Sense.** 150 is less than half a turn, so the arc is less than half the rim, 11π; 55/6 is about 9.2, under 11. An arc of 210 is more than half of 4π, and 7/3 is more than 2.

**Check.** a ÷ d is the fraction: 55/6 ÷ 22 = 55/132 = 5/12.

**Line.** "Fraction of the turn, times the whole rim. An arc is a length."

**Trap.** Multiplying the fraction by r instead of 2r (55/12), or by r² (the sector, 605/12): the two formulas are a blur. The opening lights the arc rust as a piece of the rim and unrolls the rim as the whole being cut; the board writes `2\pi r` as the whole before the fraction touches it.

**Kit.** `sector`/`fan` with `deg` and `frac` readouts, `arc` part (family design 4.1), `unroll` of the whole rim with the arc's share marked.

**Writer.** Cheaper model.

---

### `sector-area-coefficient` — A sector as aπ

**Standard.** HSG.C.B.5, "derive the formula for the area of a sector", practiced as fraction of the turn times πr². Not 7.G.B.4.

**Foundations first.** The shared opening with the fan, the fraction, the gold wedge pulsing: "the sector is a piece of the disk, so its whole is πr²." One beat of the wedge rectangle from grade 7, not re-derived: "πr² is three and a bit squares on the radius."

**Read.** "A sector has a central angle of θ degrees. Its area is aπ square centimeters. What is a?" (gold on "area", "square", "a"). a is θ/360 times r². At a glance: θ over 180 means more than half the disk, so a is more than r²/2; a diameter given must be halved before squaring.

**The example.** "A circle has a radius of 12 cm. A sector has a central angle of 225 degrees. Its area is aπ square centimeters. What is a?" (1) The sketch: circle, O, r = 12; the fan opens past the half turn to 225, readout; the wedge gold. (2) The fraction: `\frac{225}{360} = \frac{5}{8}` (divide by 45). "More than half: 5/8 of the disk." (3) The whole: `\pi r^2 = 144\pi`. (4) `\frac{5}{8} \cdot 144\pi = 90\pi`. (5) `a = 90`.
*Quick second case (a diameter, a fraction that stays a fraction):* "diameter of 22 cm, 60 degrees": `r = 11`; `\frac{60}{360} = \frac{1}{6}`; `\frac{1}{6} \cdot 121 = \frac{121}{6}`. "121 does not divide by 6; a is a fraction, and that is fine." Three beats.

**Fast.** Radius first; square it; reduce θ/360; multiply.

**Sense.** 225 is more than half a turn, so the sector is more than half of 144 (72) and less than all of it: 90 fits. 60 is a sixth of a turn; a sixth of 121 is about 20.

**Check.** a ÷ r² is the fraction: 90/144 = 5/8 = 225/360.

**Line.** "Fraction of the turn, times the whole disk. A sector is an area."

**Trap.** Multiplying the fraction by 2r instead of r² (5/8 × 24 = 15, the arc's a), or squaring the diameter (484/6). The gold wedge pulsing as the thing asked, the word "square centimeters" gold, and the `r =` line before anything is squared.

**Kit.** `sector`/`fan`, `frac`. Nothing beyond 4.1.

**Writer.** Cheaper model.

---

### `geo-arc-length-rounded` — An arc to the nearest unit or tenth

**Standard.** HSG.C.B.5, arc length proportional to the radius, with an unfriendly angle and a decimal answer.

**Foundations first.** The shared opening. One more beat: "when the answer is a decimal, keep π as a letter through every step and press the π key once, at the end; rounding in the middle moves the answer."

**Read.** "A central angle of θ° intercepts an arc. Find the arc length to the nearest whole unit / tenth" (gold on "arc length" and the rounding place). Fraction of the turn times 2πr, then a calculator. At a glance: θ over 180 means more than half the rim; the rim is about 3.14 × d.

**The example.** "A circle has a diameter of 36 centimeters. A central angle of 250° intercepts an arc. Find the arc length to the nearest whole unit." (1) The sketch: circle, O, d = 36 in two halves, `r = 18`; the fan to 250, past the half turn; the rust arc. (2) The fraction: `\frac{250}{360} = \frac{25}{36}`. (3) The whole: `2\pi r = 36\pi` (the rim is π diameters: 36π). (4) `\frac{25}{36} \cdot 36\pi = 25\pi`: the 36s cancel; exact so far. (5) Now the calculator, once: `25\pi \approx 78.54`; to the nearest whole unit, `79`.
*Second worked example (the fraction does not cancel, so rounding early can bite):* "radius of 20 meters, 200°, nearest tenth." `\frac{200}{360} = \frac{5}{9}`; `2\pi r = 40\pi`; `\frac{5}{9} \cdot 40\pi = \frac{200\pi}{9}`; calculator: `200\pi \div 9 \approx 69.81`, so `69.8`. Then the `watch` card: "5/9 rounded to 0.56 first gives 0.56 × 125.66 ≈ 70.4; wrong in the tenths. Round only at the end."

**Fast.** Radius (or go straight from the diameter: the rim is πd); reduce the fraction; write fraction × rim with π still a letter; one calculator step; round to the place asked.

**Sense.** The rim is 36π ≈ 113; 250° is more than half, less than all: between 57 and 113, and 79 is. For the second: 40π ≈ 126, more than half, 69.8.

**Check.** The arc divided by the rim is the fraction: 78.54 ÷ 113.1 ≈ 0.694 ≈ 25/36.

**Line.** "Keep π to the end; press the key once."

**Trap.** Rounding the fraction or π early and landing one tenth off; and doubling a given diameter (2π × 36 ≈ 226 for the rim). The `watch` card shows the early-rounding miss in numbers, and the board writes the rim as `\pi d` or `2\pi r` from the `r =` line.

**Kit.** `sector`/`fan`, `arc`; a board line of the form `25\pi \approx 78.54` that the math check accepts as an approximation (a small check extension). Nothing new to draw.

**Writer.** Cheaper model.

---

### `arc-sector-derivation` — Arc over radius: the angle itself

**Said first.** Three kinds under one name, all multiple choice: (A) arc length scales with the radius between circles of the same angle (as an equation to choose, or as a number); (B) the radian: angle = arc ÷ radius, and arc = angle × radius; (C) a sector's area with the angle in radians, θr²/2. They are one idea read three ways, so one lesson, with one built foundation and three examples. Not 7.G.B.4.

**Standard.** HSG.C.B.5, all three clauses: "Derive using similarity the fact that the length of the arc intercepted by an angle is proportional to the radius, and define the radian measure of the angle as the constant of proportionality; derive the formula for the area of a sector."

**Foundations first.** Two circles with the same center O, radii 4 and 8, drawn to scale; one gold fan at O covers both. "The big circle is the small one scaled by two from O" (foundation 10, one line). The small arc lights rust and is labeled 4; "scaled by two, the arc doubles": the big arc lights, 8. The board: `\frac{4}{4} = 1`, `\frac{8}{8} = 1`. "Arc divided by radius comes out the same on every circle. That number belongs to the angle alone: it is the angle's measure in radians." Lay the radius along the arc (foundation 11): on the small circle the radius fits exactly once; on the big one, its radius fits exactly once. "This angle is one radian: one radius of arc, about 57°." Then `\theta = \frac{s}{r}`, `s = r\theta`. Then the full rim: the radius laid around the small circle six times and a bit: "2π radii in a turn, so a full turn is 2π radians" (the π is the same bit as in grade 7). Last, the sector: the fan's wedge is cut into thin wedges that rearrange into a near-rectangle of height r and width half the arc: `\text{sector} = \frac{1}{2} \cdot s \cdot r = \frac{1}{2} r \theta \cdot r = \frac{1}{2}\theta r^2`. The board also shows the route the problem's own text names: `\frac{\theta}{2\pi} \cdot \pi r^2 = \frac{1}{2}\theta r^2`, "the π cancels."

**Read.** Three shapes of question. "Because circles are similar, arc length is proportional to radius. Which equation finds x?": the equation that says *arc over its own radius is the same on both circles*. "What is the measure of the angle in radians?": arc ÷ radius. "Length of the arc" from radians: angle × radius. "The sector is the fraction θ/2π of the disk": half of θ times r². At a glance: a bigger circle has a longer arc; an arc longer than the radius is more than one radian; a sector's area in radians has no π in it.

**Example A.** "Two circles have the same central angle. In the circle of radius 4 the angle cuts off an arc of length 4. In the circle of radius 8 it cuts off an arc of length x… Which equation finds x?" Choices `4\cdot 4 = x\cdot 8`, `4+4 = x+8`, `\frac{4}{8} = \frac{x}{4}`, `\frac{4}{4} = \frac{x}{8}`. The foundation's figure is the problem's figure. "Arc over radius, same on both": `\frac{4}{4} = \frac{x}{8}`, so `x = 8`, and the laid radius fits once on each arc. Rule out: the other three all give x = 2 or x = 0, an arc *shorter* on the bigger circle; dim together. (The wording "radius 4 cm, 50°, arc 4 cm; radius 8 cm?" is this same case as a number: double the radius, double the arc, 8 cm; one beat.)

**Example B.** "A central angle of a circle with radius 6 cm cuts off an arc 11 cm long. What is the measure of the angle in radians?" Choices `\frac{11}{12\pi}`, `\frac{11}{6}`, `5`, `\frac{6}{11}`. Circle r = 6, the rust arc 11; lay the radius: once (6), and five sixths of another: `\theta = \frac{s}{r} = \frac{11}{6}` radians, a little under two radians, about 105°; the fan confirms. Rule out: 6/11 is under one radian but the arc is longer than the radius; 5 is 11 − 6 and nothing here subtracts; 11/(12π) is the arc over the whole rim, the fraction of a turn, not an angle. Dim together. (The reverse, "1/3 radian in a circle of radius 3": a third of a radius laid along the arc, `s = r\theta = 1` cm; one beat; the decoy `\frac{1\pi}{180}` is a degrees conversion of nothing.)

**Example C.** "A sector has central angle 3 radians in a circle of radius 9 cm. The sector is the fraction θ/2π of the disk of area πr². What is its area?" Choices 243, 27, 13.5, 121.5. The fan opens three radii of arc (past a quarter turn, under a half); `\frac{3}{2\pi} \cdot 81\pi = \frac{243}{2} = 121.5` square centimeters. The second route agrees: the arc is 3 × 9 = 27, half of it is 13.5, times the height 9 is 121.5. Rule out: 243 forgot the half; 27 is the arc, a length; 13.5 is half the arc. (The variant "1 radian, radius 6" has the decoy 18π: "π cancelled; an angle in radians brings no π.")

**Fast.** Arc ÷ radius is the angle; angle × radius is the arc; sector = half of angle × r². Between circles: arc/radius equal on both.

**Sense.** Three radians is a bit under half a turn (π ≈ 3.14), so the sector is a bit under half the disk, 81π ≈ 254; 121.5 fits. 11/6 radians is under 2, under a third of a turn.

**Check.** 121.5 ÷ 81 = 1.5 = 3/2 = θ/2. 11/6 × 6 = 11. 8/8 = 4/4.

**Line.** "A radian is one radius of arc. Arc over radius is the angle; it belongs to no particular circle."

**Trap.** Reading the fraction θ/2π as a reason to keep π in the answer (18π for 18), and pairing an arc with the other circle's radius (4/8 = x/4). The π is cancelled on the board in its own beat, and the laid radius makes "arc over its *own* radius" a picture: the same radius is what gets laid along each arc.

**Kit.** `sector`/`fan` spanning two concentric circles at once; `lay` along an arc with a fractional last copy; `wedges`/`rearrange` taking a sector as its target (so the strip has width s/2, not πr); `@ang` readout in radians; `dim`.

**Writer.** Strongest writer: the lesson is the derivation itself, three sub-kinds must stay one idea, and the decoys are subtle.

---

## Circle theorems (Geometry, HSG.C.A.2)

### `circle-angles` — Inscribed and central angles on the same arc

**Said first.** The two tangent items (PT = 8, OP = 10; r = 3, OP = 5) are `tangent-circle-computation`'s and serve 8.G.B.7; the design asks that they move. Until they do, a quick case at the end (marked) keeps the learner safe. The rest is HSG.C.A.2.

**Standard.** HSG.C.A.2: "the relationship between central, inscribed, and circumscribed angles; inscribed angles on a diameter are right angles" (and, while the tangent items remain, "the radius of a circle is perpendicular to the tangent where the radius intersects the circle" with 8.G.B.7).

**Foundations first.** The circle with O and radius. Two points A and B on the rim; the gold fan at O between OA and OB with its readout: "a *central angle*: its corner is at the center. The rust piece of rim it opens onto is its *arc*, AB." A point C elsewhere on the rim, with the smaller gold fan at C between CA and CB, readout: "an *inscribed angle*: its corner is on the circle, and it opens onto the same arc." Then the slide (foundation 7): C glides along the rest of the rim; the fan at C changes shape while its readout never leaves half of O's. "From the rim, the arc looks half as wide as from the center." C stops where CB passes through O. Triangle O–C–A: two radii, equal ticks, equal base angles marked x (foundation 5). The angle AOB is the exterior angle of that triangle at O, so it equals the two far angles: `\angle AOB = x + x = 2x`. "Proved: the central angle is twice the inscribed angle on the same arc." Two consequences, one beat each on the same figure: slide A and B apart until AB is a diameter; the fan at O reads 180 and the fan at C reads 90: "an angle in a semicircle is a right angle." Slide C to a second point D on the same side of AB: both readouts match: "angles on the same arc are equal."

**Read.** Which angle is at the center, which is on the rim, and are they on the same arc? Inscribed from central: halve. Central from inscribed: double. "AB is a diameter" means the angle at the third point is 90, and then the triangle's angles add to 180. "C and D on the same side of chord AB": equal. At a glance: the inscribed one is always the smaller; the asked angle is gold, not the one the problem mentions.

**The example.** "In circle O, inscribed angle ACB measures 36°. What is the measure of central angle AOB, in degrees, on the same arc AB?" (1) The sketch: circle, O, A, B, C; the fan at C reads 36; the rust arc AB. (2) Asked: the fan at O, gold, "?". (3) At a glance: from the center the arc looks twice as wide: bigger. (4) `\angle AOB = 2 \times 36 = 72`. The fan at O opens to 72 and the slide replays with C's readout fixed at 36 all the way around. (5) 72.
*Quick cases (each a different reading):* "central angle AOB = 88°, C on the circle but not on arc AB": the inscribed one is the smaller, `88 \div 2 = 44` (one beat on "not on arc AB": a C placed on the arc itself would open onto the rest of the circle, 272, and read 136; the problem says where C is so the arc is the short one). "AB is a diameter, ∠CAB = 36°, find ∠CBA": the right angle mark at C, 90; `180 - 90 - 36 = 54`; the asked corner B is gold. "C and D on the same side of chord AB, ∠ACB = 51°, find ∠ADB": D's fan reads 51 as C's did: 51.
*Until the tangent items move:* "PT tangent at T, PT = 8, OP = 10, radius?": the blue line touches at T, the radius to T with the right-angle mark at T; OP is the hypotenuse (it is the longest, center to outside point); `r^2 + 8^2 = 10^2`, `r = 6`; check 36 + 64 = 100.

**Fast.** Half or double; the inscribed one is smaller. Diameter: 90 at the rim point, then 180 for the triangle. Same arc: equal.

**Sense.** 72 is bigger than 36 and under 180; 44 is smaller than 88; 54 and 36 with a right angle make a triangle.

**Check.** Halve back: 72 ÷ 2 = 36. For the semicircle: 36 + 54 + 90 = 180.

**Line.** "From the rim, the arc looks half as wide as from the center."

**Trap.** Halving when the central angle was asked, or doubling when the inscribed one was (the two words blur, so the student just does "the thing with 2"). The two fans on screen, the one at the rim visibly narrower, and the line "the inscribed one is smaller" said before any arithmetic. In the semicircle case, answering 90 (the angle at C) or 144 (180 − 36 with the right angle forgotten) instead of 54: the right-angle mark sits at C, the asked corner B is gold, and the board writes the triangle sum with all three corners named.

**Kit.** An inscribed `sector` at a rim point with an `@ang` readout that updates as its points glide (family design 4.1); the central fan's readout held fixed during the slide; equal-length ticks on the radii and an exterior-angle mark (exist: `seg.ticks`, `angle`); `tangent`/`touch` only for the misfiled case.

**Writer.** Strongest writer: the insight is a motion that proves (the vertex that slides while the readout holds), and the type reads four ways.
