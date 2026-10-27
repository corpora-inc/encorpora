/** Skill-to-skill links: from|to|kind|explanation|template of either skill. Navigation only, never prerequisites. */
export const denseConnectionTable = `
write-numerals|teen-place-value|extension|A teen numeral writes one ten as the digit 1 and the extra ones as the second digit, so 14 is written as 1 ten and 4 ones.|teen-frame-compose
write-numerals|tens-and-ones|extension|Writing a numeral for a quantity extends to two digits: the left digit counts tens and the right digit counts ones.|tens-ones-model
write-numerals|picture-bar-graphs|application|The count in each category is written as a numeral, and that numeral names how tall its bar is.|bar-chart-total
write-numerals|count-to-100|related|Counting forward writes each next numeral in a fixed pattern, so the missing numeral in a count sequence is the one the pattern requires.|count-sequence-missing
compare-small-groups|picture-bar-graphs|application|Comparing two bars is comparing two groups: the taller bar stands for the group with more.|bar-chart-difference
compare-small-groups|categorical-data|application|Deciding which category has more or fewer uses the same group comparison, applied to counts in a picture graph.|categorical-summary
compare-numerals|money-values|application|Deciding which of two money amounts is greater compares the numbers of cents or dollars.|compare-money-sets
compare-numerals|measure-equal-units|application|Lengths measured in the same unit are numbers, so the greater numeral is the longer object.|order-lengths
addition-within-10|count-to-100|related|Counting on from any number adds one each time, so the next number in a count sequence is the previous number plus 1.|count-sequence-missing
addition-within-10|measure-equal-units|application|Joining two pieces measured in the same unit gives a total length that is the sum of their unit counts.|measure-with-units
addition-within-10|categorical-data|application|The total of two categories in a picture graph is found by joining their counts.|categorical-summary
subtraction-within-10|compare-small-groups|application|How many more one group has is found by taking the smaller count away from the larger: 7 is 3 more than 4 because 7 - 4 = 3.|compare-groups
subtraction-within-10|picture-bar-graphs|application|The difference between two bars is the subtraction of their counts.|bar-chart-difference
subtraction-within-10|missing-addend|related|Subtraction and addition undo each other: 5 - 2 = 3 tells you that 2 + 3 = 5, so an unknown addend is found by subtracting.|unknown-addend-story
number-bonds|missing-addend|extension|A number bond shows a whole and its two parts. When one part is unknown, the missing addend is the whole minus the known part.|unknown-addend-story
number-bonds|addition-facts|extension|Each number bond gives a fact family: if 3 and 4 make 7, then 3 + 4, 4 + 3, 7 - 3 and 7 - 4 all describe the same bond.|related-subtraction
number-bonds|facts-within-5|related|The bonds of 5 are the pairs 0 and 5, 1 and 4, and 2 and 3, which are exactly the facts within 5.|number-bond-missing
number-bonds|operation-properties|related|Splitting a number into two parts is the same move as splitting an array into two smaller arrays whose totals add.|split-array-part
number-bonds|whole-multiplication|extension|Breaking a factor into parts, like 23 into 20 and 3, gives the partial products an area model adds up.|area-model-product
make-ten|money-values|application|Pairs that make ten give pairs of coins that make a dime, and pairs that make 100 cents give a dollar.|make-a-dollar
facts-within-5|arrays|application|The total in a small array is found by adding its rows, and the sums stay within the facts to 5.|small-array-total
facts-within-5|three-addends|application|Adding three small numbers combines facts already known: add two first, then the third.|three-addend-story
teen-place-value|counting-arithmetic|related|Teen numbers count on from ten, the same way a count-on strategy begins at a number and moves forward one at a time.|count-on-back
teen-place-value|addition-within-20|application|Adding 8 + 5 by filling a ten leaves 3 more ones, which is the teen number 13 made of one ten and three ones.|make-ten-remainder
teen-place-value|ten-more-less|extension|A teen is ten plus ones, so ten more than 14 changes the tens and leaves the ones, which is the same idea as for larger numbers.|ten-more-or-less
compare-attributes|categorical-data|application|Sorting objects by a measurable attribute like length or weight makes the categories that a picture graph counts.|categorical-summary
compare-attributes|shape-attributes|related|Both skills describe an object by an attribute: length, weight or capacity for measuring, and sides or corners for shapes.|defining-attribute
compare-attributes|mass-volume|extension|Comparing which of two objects is heavier or holds more becomes measuring with a balance or reading a liquid volume.|balance-mass
compare-attributes|name-shapes|related|Both sort things by an attribute. Comparing sorts by length, weight or capacity, and naming shapes sorts by sides and corners.|find-named-shape
name-shapes|sort-and-count|application|To sort shapes into groups and count each group, you must name or recognise each shape.|sort-shapes-count
sort-and-count|two-way-tables|extension|Sorting by one attribute and counting each group extends to sorting by two attributes at once, which fills the cells of a two-way table.|two-way-missing
sort-and-count|event-sets|application|Counting the objects in a sorted category is counting the members of a set, which is how outcomes of an event are counted.|event-set-count
sort-and-count|compare-small-groups|application|After sorting, the counts of two piles are compared to see which has more.|compare-groups
compose-shapes|composite-measurement|extension|Putting simple shapes together to build a bigger one is reversed when a composite figure is split into simple shapes to find its area.|composite-area
compose-shapes|triangle-area|application|Cutting a polygon into rectangles and triangles uses the same decomposing idea as taking a shape apart into smaller shapes.|polygon-area-decompose
compare-small-groups|line-plots|related|Comparing the number of dots stacked at two values on a line plot is the same group comparison, with each stack standing for a group.|staar-dot-plot-threshold
subtraction-within-10|subtraction-within-20|extension|Take-away facts within 10 extend to within 20 by subtracting through ten: take away enough to reach 10, then take away the rest.|subtract-through-ten
addition-stories|multiplicative-stories|extension|Choosing the operation from a story begins with joining and separating. Later stories add equal groups, where the story still decides whether to add, subtract, multiply or divide.|story-operation-choice
addition-stories|financial-literacy-elementary|application|Profit stories join and separate money amounts: income is added, cost is taken away, and the difference tells whether there is a gain or a loss.|profit-cost-breakeven
addition-stories|rational-stories|extension|Stories about joining and separating extend to gains and losses, where the amounts can be negative or fractional.|signed-story
three-addends|statistics-mean|application|The mean begins by adding all the data values, which is adding more than two addends.|mean-data
three-addends|perimeter|application|The distance around a shape is the sum of its side lengths, so a triangle needs three addends.|rectangle-border-length
three-addends|operation-properties|related|Adding three numbers in a different grouping gives the same total, which is the associative idea behind regrouping any product or sum.|nested-bag-total
equality|numerical-expressions|extension|The equal sign says two sides have the same value, which is how equal grouped expressions such as 2 x (3 + 4) and 14 are recognised as equal.|fl-equation-truth-grouped
equality|expression-properties|extension|Equal expressions have the same value whatever number replaces the letter, which extends the equal sign from numbers to expressions.|equivalent-expressions-check
equality|equation-reasoning|related|Each step in solving an equation must keep both sides equal, which is the balance idea of the equal sign.|equation-step-property
number-bonds|equality|application|A number bond says the parts add to the whole, and writing 3 + 4 = 7 uses the equal sign to say both sides are the same amount.|balanced-addition
missing-addend|missing-factor|extension|An unknown addend is the whole minus the known part. An unknown factor is the product divided by the known factor.|missing-factor-fact
missing-addend|two-step-stories|application|Finding how many were there at the start of a story is an unknown addend: start plus change equals end.|two-step-change
missing-addend|elapsed-time|application|Start time plus elapsed time equals end time, so an unknown elapsed time or start time is an unknown addend.|clock-elapsed-minutes
compare-two-digit|compare-decimals|extension|Comparing two-digit numbers by the tens digit then the ones digit extends to decimals, where the tenths digit is compared before the hundredths.|compare-decimals-hundredths
compare-two-digit|money-values|application|Two prices compare the same way as two-digit numbers, by comparing the tens place first.|compare-money-sets
compare-two-digit|round-whole-numbers|related|Placing a number between two tens on a number line is the first step of rounding: it rounds to the closer ten.|round-to-ten
add-two-digit|decimal-arithmetic|extension|Adding decimals lines up place values and regroups, exactly like adding two-digit numbers, with the decimal point staying in line.|decimal-addition
add-two-digit|perimeter|application|Adding side lengths of two digits finds the distance around a shape.|rectangle-border-length
add-two-digit|financial-literacy-elementary|application|Adding two-digit prices and costs finds the amount spent, and subtracting it from income finds profit.|profit-cost-breakeven
ten-more-less|scientific-notation|extension|Ten times more moves every digit one place left, and repeating that many times is what the power of ten in scientific notation records.|scientific-times-larger
ten-more-less|large-place-value|extension|Each place is ten times the place to its right, which is the idea behind ten more or ten less, applied to larger numbers.|multidigit-digit-value
ten-more-less|decimal-place-value|extension|Each place is one tenth of the place to its left, so ten less at one place and one tenth of the next place use the same pattern.|decimal-digit-value
ten-more-less|skip-counting|related|Counting by tens is repeating ten more: 10, 20, 30, 40.|skip-count-missing
ten-more-less|addition-within-100|application|Adding a number of tens to a two-digit number changes only the tens digit, which gives a quick way to add within 100.|add-two-digit-regroup
measure-equal-units|unit-conversion|extension|Measuring with a smaller unit takes more of them. Converting units uses this fact with standard units.|unit-relative-size
measure-equal-units|perimeter|application|Perimeter measures every side with the same unit and adds the lengths.|rectangle-border-length
measure-equal-units|rectangle-area|application|Area covers a rectangle with equal unit squares, so counting rows of equal squares gives the area.|area-tiling-distributive
halves-and-quarters|clock-half-hours|application|Half past the hour is half of an hour, and a quarter hour is a quarter of an hour.|match-clock-half-hour
clock-half-hours|unit-fractions|extension|A half hour is one of two equal parts of an hour, and a quarter hour is one of four equal parts, so the clock shows unit fractions.|unit-piece-size
clock-half-hours|fractions-number-line|related|Marking half hours on a timeline places 1/2 between 0 and 1 hour, the same way fractions are placed on a number line.|fraction-line-position
clock-half-hours|equivalent-fractions|related|One half hour and two quarter hours are the same 30 minutes, so 1/2 equals 2/4 of an hour.|fraction-whole-as-parts
halves-and-quarters|percentages|application|One half is 50 percent and one quarter is 25 percent, which a percent grid shows by shading equal parts.|percent-grid-model
halves-and-quarters|probability|application|When a spinner is split into equal parts, the chance of landing on a half or a quarter is that fraction of the whole.|simple-probability
compare-small-groups|halves-and-quarters|related|Two shares are equal when neither group has more, which is the check for halves and quarters.|larger-share
counting-arithmetic|skip-counting|extension|Counting on by ones extends to counting on by twos, fives and tens, which is skip counting.|skip-count-missing
counting-arithmetic|multiplication-facts|extension|Counting on by the same number several times builds a multiplication fact: three groups of four is counting by 4 three times.|multiply-facts
count-to-100|hundreds-place-value|extension|Counting past 100 continues the tens and ones pattern into hundreds, which is how a three-digit number is built.|open-number-line-to-1000
skip-counting|odd-and-even|related|Counting by twos lands only on even numbers, so skip counting by 2 shows which numbers are even.|pairing-leftover
compare-three-digit|round-whole-numbers|related|Rounding to the nearest hundred compares a number with the halfway point between two hundreds.|round-to-hundred
compare-three-digit|decimal-place-value|extension|Comparing three-digit numbers digit by digit from the left extends to comparing decimals to thousandths.|compare-decimals-thousandths
regroup-hundreds|decimal-arithmetic|extension|Regrouping across tens and hundreds is the same move as regrouping when adding or subtracting decimals.|decimal-addition
regroup-hundreds|polynomial-arithmetic|related|Adding with regrouping combines each place separately, as adding polynomials combines each power separately.|polynomial-addition
regroup-hundreds|signed-numbers|application|A running balance adds and subtracts three-digit amounts, and regrouping gives the new balance even when it falls below zero.|check-register-balance
multiple-addends|mean-median|application|The mean of a dot plot adds several values before dividing.|dot-plot-mean
multiple-addends|perimeter|application|The perimeter of a polygon with many sides adds several lengths.|rectangle-border-length
two-step-stories|two-step-equations|extension|A two-step story becomes a two-step equation when the unknown is the start or the amount in each group.|two-step-word-problem
two-step-stories|financial-literacy-elementary|application|Costs and incomes in two steps give the amount left or the profit.|two-step-change
addition-facts|multiplication-facts|extension|Multiplication facts are repeated addition facts, so 4 + 4 + 4 shows 3 x 4.|multiply-facts
addition-facts|arithmetic-patterns|application|Each next multiple in a times table adds the same number, a pattern found with addition facts.|neighbor-product-change
arrays|coordinate-first-quadrant|related|Points on a grid sit in rows and columns like the objects of an array, and a pair of numbers names the row and column.|first-quadrant-locate
arrays|matrix-data|related|A table of rows and columns is an array of numbers, and its entries are read by row and column.|matrix-data-reading
ruler-measurement|scale-drawings|application|A scale drawing is measured with a ruler and the measured length is scaled to the real length.|scale-drawing
number-line-arithmetic|ruler-measurement|related|A ruler is a number line: the length of an object is the distance between two marks, found as a difference.|shifted-ruler-length
clock-five-minutes|unit-conversion|extension|A clock converts 60 minutes into one hour, which is the same renaming of units used for other measures.|customary-unit-rename
clock-five-minutes|angle-measure|application|The minute hand turns 30 degrees every five minutes, so clock positions give angle measures.|turn-degrees
clock-five-minutes|radians-unit-circle|extension|A clock hand sweeps a full turn in 60 minutes, which is the idea behind angular velocity and measuring a turn in radians.|angular-velocity-problem
money-values|decimal-fractions|extension|A cent is one hundredth of a dollar, so 25 cents is 0.25 dollar, a decimal with hundredths.|decimal-grid-read
money-values|percentages|application|A quarter is 25 percent of a dollar, so coin values name percents of a dollar.|make-a-dollar
money-values|unit-rates|application|The price of one item is found by dividing the total cost, which compares prices per unit.|better-buy
line-plots|mean-median|application|The mean of data on a line plot adds each value as many times as its dots.|dot-plot-mean
picture-bar-graphs|distribution-plots|extension|A bar graph of categories becomes a histogram when the bars show how many values fall in each interval.|histogram-read
picture-bar-graphs|percentages|extension|The share of each bar in the total is a percent, and a circle graph shows those percents as parts of a whole.|circle-graph-read
thirds-and-partitions|probability|application|Equal parts of a spinner give equal chances, so each third has chance 1/3.|simple-probability
thirds-and-partitions|arc-sector-measure|extension|Equal parts of a circle are sectors, and a sector is a fraction of the whole circle.|sector-area-coefficient
thirds-and-partitions|division-meaning|related|Sharing a whole into equal parts is partitioning, and division finds the size of each equal share.|share-whole-items
polygon-properties|geometric-definitions|extension|Counting the sides and angles of a polygon becomes defining it precisely by what it must contain.|precise-geometric-definitions
compose-shapes|polygon-properties|extension|A shape built from smaller shapes is itself a polygon whose sides and angles can be counted and named.|name-polygon
missing-factor|unit-rates|application|Finding how many items are in each group is an unknown factor, and the unit rate is the same quantity: the total divided by the number of groups.|unit-rate
missing-factor|formula-rearrangement|extension|An unknown factor is found by dividing the product by the other factor. Solving a formula for one variable divides by the other factors in the same way.|formula-isolate
missing-factor|area-perimeter-models|application|The unknown side of a rectangle with a known area is a missing factor.|rectangle-missing-area-side
operation-properties|expression-properties|extension|Splitting an array into two parts to multiply is the distributive property. With a letter in place of a number it shows two expressions are equivalent.|distributive-expression-choice
multi-operation-stories|linear-models|application|A story with a starting amount and a repeated change is a linear model: start plus rate times number of steps.|purchase-change
multi-operation-stories|financial-literacy-elementary|application|Buying, selling and paying costs are several operations in order, and the result is profit or what is left.|purchase-change
arithmetic-patterns|arithmetic-sequences|extension|A pattern that adds the same number each time is an arithmetic sequence, written with a first term and a common difference.|arithmetic-term
arithmetic-patterns|geometric-sequences|related|A multiplication table pattern adds the same amount each step; a pattern that multiplies by the same amount each step is a geometric sequence.|geometric-sequence
arithmetic-patterns|dependent-variables|application|A table pairing a situation's two quantities shows how the output depends on the input, which an equation then writes down.|situation-pair-table
add-subtract-thousands|decimal-algorithms|extension|Adding and subtracting thousands by place value extends to decimal sums, where like places are added and regrouped.|multidigit-decimal-sum
add-subtract-thousands|financial-literacy-middle|application|A net worth statement adds assets and subtracts debts in the thousands.|net-worth-statement
multiply-tens|powers-of-ten|extension|Multiplying by 10, 100 or 1000 shifts each digit left by that many places, which is the multiplication by powers of ten.|multiply-power-of-ten
multiply-tens|scientific-notation|application|Scientific notation multiplies a number by a power of ten, so its value is found with the same place shifts.|scientific-operations
fraction-model|probability|application|The probability of an outcome is the fraction of equally likely outcomes that match, a part of a whole.|simple-probability
fraction-model|percentages|extension|A percent is a fraction with denominator 100, so a fraction model with 100 equal parts shows a percent.|percent-grid-model
fraction-model|ratios|related|A part-to-whole ratio is a fraction of the whole, while a ratio can also compare two parts.|ratio-missing
sort-and-count|fraction-model|related|Sorting a group and counting one category gives a part and a whole, which a fraction names: 3 of 8 shapes are red.|fraction-model
fractions-number-line|decimal-fractions|extension|A fraction with denominator 10 or 100 has a decimal name, and both name the same point on the number line.|decimal-line-point
fractions-number-line|absolute-value|extension|Distance between two points on a number line is found by counting units, and the same idea measures distance from zero in both directions.|number-line-distance
fractions-number-line|approximate-roots|application|A square root is placed on the number line between two whole numbers by comparing its square with the squares of those whole numbers.|root-between-integers
equivalent-fractions|percentages|application|A fraction is renamed as a percent by finding an equivalent fraction with denominator 100.|percent-forms-and-parts
compare-fractions|probability|application|Which event is more likely is decided by comparing the fractions that give their probabilities.|simple-probability
compare-fractions|ratios|related|Comparing fractions with the same denominator or numerator is the same reasoning as comparing ratios of equal parts.|compare-like-denominators
elapsed-time|rational-unit-rates|application|A speed in miles per hour divides a distance by elapsed time, so elapsed time of a fraction of an hour gives a fractional unit rate.|fraction-unit-rate
elapsed-time|average-rate-change|extension|Average rate of change divides the change in a quantity by the time elapsed, which generalises distance divided by elapsed time.|average-rate-formula
mass-volume|density-modeling|application|Density compares the mass of a material with its volume, both measured with the tools used for mass and volume.|density-context
mass-volume|curved-solid-volume|application|The volume of liquid that fills a cylinder is found with the cylinder volume formula and read in liquid-volume units.|cylinder-volume
scaled-graphs|scatterplots|extension|Reading a scaled bar graph means reading the scale on the axis, as a scatterplot uses a scale on each axis to place points.|trend-line-predict
scaled-graphs|coordinate-first-quadrant|related|A scale on the axis tells how much each step stands for; plotting a point in the first quadrant needs the same scale on both axes.|coordinate-context-points
fraction-line-plots|mean-median|application|The mean of data with fractional measurements adds the values on the line plot, counting each by its number of dots.|dot-plot-mean
fraction-line-plots|variability|application|How spread out the fractional measurements are is described by the mean absolute deviation or IQR of the dots.|dot-plot-mad
perimeter|scale-drawings|application|Scaling a figure by a factor scales its perimeter by the same factor.|scale-drawing
quadrilateral-categories|polygon-symmetries|related|Which quadrilateral a shape is determines its lines and rotations of symmetry, such as the four lines of a square.|polygon-symmetry-counts
quadrilateral-categories|coordinate-proofs|application|Proving that a quadrilateral drawn on a grid is a rectangle or parallelogram uses its category definitions.|coordinate-quadrilateral-claims
partition-area|probability|application|The probability of landing in a region is the fraction of the total area that the region covers.|simple-probability
partition-area|arc-sector-measure|extension|Dividing a region into equal-area parts extends to a sector that is a fraction of a whole circle.|sector-area-coefficient
multiplicative-comparison|proportional-relationships|extension|Saying one amount is n times another is a constant of proportionality: all pairs of amounts keep the same ratio.|variation-constant
multiplicative-comparison|scale-drawings|application|A scale factor says one length is a number of times another, which is a multiplicative comparison.|scale-drawing
multistep-whole-stories|linear-equation-modeling|application|A multistep story with an unknown total is written as a linear equation whose coefficients are rates and whose constant is a starting amount.|linear-model-equation
multistep-whole-stories|systems-modeling|application|Two multistep stories about the same unknown are written together as a system of equations.|system-model-value
factors-multiples|fraction-equivalence|application|Dividing the numerator and denominator by a common factor gives an equivalent fraction in lower terms.|equivalent-numerator
rule-patterns|geometric-sequences|extension|A rule that multiplies by the same number each step gives a geometric sequence rather than one that adds.|geometric-sequence-rule
rule-patterns|function-notation|extension|A rule that takes each input to one output is a function, and function notation writes the rule as f(x).|relation-function-choice
large-place-value|logarithms|extension|A number with n digits is between 10 to the power n - 1 and 10 to the power n, so counting digits estimates its base-10 logarithm.|logarithm-integer
whole-add-subtract|signed-addition|extension|Adding and subtracting large numbers extends to adding and subtracting signed numbers, where the sign decides whether to add or subtract the sizes.|integer-addition
whole-add-subtract|matrices|related|Adding two matrices adds entries in the same position, the same column-by-column addition used for large numbers.|matrix-operations
whole-division|fraction-as-division|extension|A remainder in a division is a fraction of the divisor, so 17 divided by 5 is 3 and 2/5.|whole-sharing-fraction
whole-division|unit-rates|application|A unit rate divides the total by the number of units, which is whole-number division when the quotient is exact.|unit-rate
fraction-comparison|compare-functions|application|Comparing rates of change of two functions compares the fractions that give their slopes.|compare-function-rates
mixed-numbers|fraction-addition|application|Adding mixed numbers adds the whole parts and the fractional parts, regrouping when the fractional sum exceeds 1.|add-fractions
mixed-numbers|polynomial-division|related|An improper fraction splits into a whole number and a fraction, as a polynomial quotient splits into a quotient and a remainder over the divisor.|polynomial-quotient
fraction-times-whole|percentages|application|A percent of a quantity is a fraction of the quantity, so 25 percent of 40 is 1/4 of 40.|percent-of
fraction-times-whole|probability|application|The expected number of times an event happens is its probability times the number of trials.|experimental-probability-predict
decimal-fractions|irrational-numbers|related|Every fraction has a decimal name that ends or repeats, and a repeating decimal is converted back to a fraction.|repeating-decimal-to-fraction
compare-decimals|approximate-roots|application|Comparing the decimal approximations of two roots decides which is greater.|compare-irrational-values
compare-decimals|scientific-notation|extension|Comparing numbers in scientific notation compares the powers of ten first, then compares the decimal parts as in comparing decimals.|scientific-times-larger
area-perimeter-models|geometric-design|application|A fixed amount of fence gives a rectangle whose area is found from one side length, a design constraint with a greatest area.|geometric-design-constraint
area-perimeter-models|nonlinear-equation-modeling|extension|Fixing the perimeter of a rectangle makes its area a quadratic function of one side.|quadratic-context-model
lines-symmetry|polygon-symmetries|extension|A line of symmetry is a reflection that maps a polygon onto itself, so counting lines of symmetry counts some of its symmetries.|polygon-symmetry-counts
lines-symmetry|function-transformations|related|A graph symmetric about the y-axis has a line of symmetry, and this is what makes a function even.|fl-even-odd-classify
categorical-data|categorical-association|extension|Counting each category in a picture graph extends to relative frequencies, which compare the share of each category within a group.|relative-frequency-percent
shape-attributes|triangle-construction|application|Whether three side lengths make a triangle depends on a defining attribute of triangles: the two shorter sides together must exceed the longest.|triangle-conditions
powers-of-ten|scientific-notation|extension|Multiplying and dividing by powers of ten shifts digits, and scientific notation writes any number as a digit string times one power of ten.|standard-to-scientific
powers-of-ten|exponent-laws|extension|Multiplying 10 to the power a by 10 to the power b gives 10 to the power a + b, the first exponent law, shown with place value.|product-of-powers-exponent
decimal-place-value|irrational-numbers|related|A rational number has a decimal that ends or repeats, and irrational numbers have decimals that do neither, which place value helps classify.|classify-real-number
decimal-place-value|percentages|extension|A percent is hundredths, so a decimal to the hundredths place is read as a percent.|percent-forms-and-parts
multidigit-products|polynomial-arithmetic|related|Multiplying multi-digit numbers multiplies each pair of place values, the way multiplying polynomials multiplies each pair of terms.|polynomial-multiplication
multidigit-quotients|proportional-relationships|application|A unit price is a quotient: dividing the total price by the number of items gives the constant of proportionality.|unit-price
unit-fraction-division|rational-unit-rates|application|Dividing by a unit fraction counts how many such pieces fit, which gives rates such as miles per hour for a quarter of an hour.|fraction-unit-rate
unit-fraction-division|complex-fractions|extension|Dividing a whole by a unit fraction is a fraction with a fraction in the denominator, which a complex fraction writes.|complex-fraction
numerical-expressions|expression-structure|extension|The order of operations in a numerical expression decides which part is a sum or a product, and structure of an algebraic expression is read the same way.|structure-meaning
numerical-expressions|formula-rearrangement|application|Evaluating a formula by substituting numbers follows the order of operations.|formula-value
related-patterns|proportional-relationships|extension|Two patterns whose terms always have the same ratio form a proportional relationship.|proportional-match-table
related-patterns|scatterplots|related|Pairs of numbers that follow a rule lie on a line when plotted, and a scatterplot shows how closely real data follow a rule.|scatter-association-choice
volume-cubes|fractional-prism-volume|extension|Counting unit cubes extends to packing a prism with cubes of fractional edge length.|unit-fraction-cube-packing
volume-cubes|cavalieri-principle|related|Stacking layers of unit cubes is the idea behind Cavalieri: solids with equal layers at each height have equal volume.|cavalieri-volume-reasoning
shape-hierarchy|geometric-definitions|extension|A shape belongs to a class when it meets the definition, so a square is a rectangle because it has all the required properties.|precise-geometric-definitions
shape-hierarchy|signed-numbers|related|Nested classes of shapes work like nested sets of numbers: every integer is a rational number, as every square is a rectangle.|number-set-venn
unit-rates|linear-models|extension|A unit rate is the slope of a linear model, the change in output per one unit of input.|inline-linear-features
ratio-tables|slope|extension|Equal steps in a ratio table give a constant ratio of change, which is the slope of the line through its points.|line-slope
integer-division|gcf-lcm|related|Repeated division with remainders finds the greatest common factor of two numbers.|greatest-common-factor
decimal-algorithms|percent-change|application|Finding a final price after a percent change multiplies decimals.|percent-change-final
decimal-algorithms|financial-literacy-middle|application|Payroll and property tax work multiply and divide decimal amounts.|payroll-property-tax
gcf-lcm|rational-expressions|application|Adding rational expressions uses the least common multiple of the denominators, and simplifying uses the greatest common factor.|rational-expression-operation
gcf-lcm|fraction-addition|application|The least common multiple of two denominators is the least common denominator for adding unlike fractions.|add-fractions
expression-properties|polynomial-identities|extension|Equivalent expressions have equal values for every input, and a polynomial identity is such an equivalence.|polynomial-identity-use
one-step-equations|percent-change|application|Finding the original amount before a percent change is a one-step equation with an unknown factor.|percent-change-original
simple-inequalities|function-domain-range|application|The inputs a situation allows are described by an inequality, which gives the domain.|context-domain-range
simple-inequalities|systems-modeling|application|A set of limits in a situation is a system of inequalities, and a solution satisfies all of them.|constraint-feasible
dependent-variables|linear-equation-modeling|extension|Naming the independent and dependent variable sets up a linear equation whose slope and intercept have meaning in the situation.|interpret-linear-parameters
fractional-prism-volume|solid-volume-models|application|Volumes of prisms with fractional edges are used to find volumes of composite solids in a modeling situation.|solid-volume-context
fractional-prism-volume|density-modeling|application|Mass is density times volume, and volume of a prism with fractional edges gives the mass of a block.|density-context
coordinate-polygons|coordinate-distance|extension|Horizontal and vertical side lengths are found by counting units, and slanted sides use the Pythagorean theorem.|coordinate-distance
coordinate-polygons|coordinate-proofs|application|Side lengths and vertices of a polygon on a grid are used to prove claims about its shape.|coordinate-quadrilateral-claims
statistical-questions|causal-claims|related|A question that expects variability can ask about an effect, and a study design decides whether the answer supports a cause.|study-design-choice
statistical-questions|statistical-report-critique|application|Reading a report starts with its question: whether it expects variability and whether the data can answer it.|report-flaw-critique
statistics-mean|normal-distributions|extension|The mean is the center of a data set, and a normal model is described by its mean and standard deviation.|normal-model-rule
statistics-mean|sampling-margin-error|application|The mean of a sample estimates the mean of the population, and the margin of error says how far it may be.|sample-size-margin
mean-median|statistical-summary-comparison|extension|The mean moves toward an outlier and the median does not, which decides which center to report.|outlier-center-shift
distribution-plots|normal-distributions|extension|A histogram of many values that is symmetric and bell-shaped is described by a normal distribution.|normal-model-rule
variability|statistical-summary-comparison|extension|The mean absolute deviation extends to the standard deviation, which compares the spread of two data sets.|standard-deviation-compare
rational-unit-rates|linear-models|extension|A unit rate with fractions is the slope of a linear model, such as miles per hour.|predict-linear-output
rational-unit-rates|average-rate-change|extension|Average rate of change is a unit rate: change in output per one unit of input over an interval.|average-rate-display
proportional-relationships|growth-comparison|related|A proportional relationship adds the same amount per unit, while exponential growth multiplies by the same factor, so growth-comparison contrasts them.|linear-or-exponential
percent-change|geometric-sequences|extension|Repeated percent growth multiplies by the same factor each time, which makes a geometric sequence.|geometric-sequence-rule
financial-literacy-elementary|linear-models|application|Saving or paying a fixed amount each week is a linear model with a starting amount and a rate.|savings-plan-growth
financial-literacy-elementary|exponential-models|extension|Money that earns interest grows by a percent of what is there, so unlike fixed saving it follows an exponential model.|interest-compare-years
financial-literacy-middle|exponential-models|application|Compound interest on a loan or savings is an exponential model with a growth factor each period.|compound-growth
financial-literacy-middle|decision-strategies|application|Choosing between incentives or plans compares expected values, which is a decision strategy.|strategy-expected-value
rational-stories|two-step-equations|application|A story with gains and losses becomes a two-step equation with signed numbers.|two-step-word-problem
rational-stories|financial-literacy-middle|application|A net worth statement adds assets and subtracts debts, which are signed amounts.|net-worth-statement
complex-fractions|rational-unit-rates|application|A rate with fractions of units, such as half a mile in a quarter hour, is a complex fraction.|fraction-unit-rate
complex-fractions|rational-equation-one-denominator|extension|A fraction in a denominator is cleared by multiplying by its denominator, the same step used to solve a rational equation.|rational-equation-one-denominator
absolute-value-equations|function-transformations|extension|The graph of an absolute value equation is a V-shape shifted by the transformation of the expression inside.|transform-equation
absolute-value-equations|complex-distance|related|Absolute value is distance, and the modulus of a difference of two complex numbers is the distance between them in the plane.|complex-distance-midpoint
scale-drawings|segment-division|related|A point a fraction of the way along a segment is found by scaling the displacement, as a scale drawing scales distances.|segment-partition
scale-drawings|vectors|related|Scaling a drawing multiplies each length by the scale factor, as multiplying a vector by a number scales its components.|vector-components
triangle-construction|oblique-triangles|application|Three sides can form a triangle only if the triangle inequality holds, which a solver of oblique triangles checks first.|triangle-conditions
triangle-construction|vector-modeling|related|Two vectors and their sum form a triangle, so the length of the sum must obey the triangle inequality.|vector-resultant
solid-cross-sections|cavalieri-principle|extension|Slicing a solid gives cross-sections at every height, and equal cross-sections at every height give equal volumes.|cross-section-area
solid-cross-sections|conic-sections|application|Slicing a cone with a plane gives a circle, an ellipse, a parabola or a hyperbola, the conic sections.|cone-section-name
angle-relationships|line-angle-proofs|extension|Angle pair facts are used as reasons in proofs about lines cut by a transversal.|line-angle-proof-reasons
composite-measurement|solid-volume-models|application|The volume of a composite solid adds the volumes of simpler solids and is used to model real objects.|composite-face-prism-volume
composite-measurement|coordinate-measurement|application|A composite shape on a grid has its area found by splitting it into pieces whose sides are read from coordinates.|coordinate-polygon
signed-data-summaries|compare-distributions|extension|Median and interquartile range are used to compare two data sets by their centers and spreads.|double-box-compare
signed-data-summaries|sampling|application|The median of a sample estimates the center of a population, and the sample spread shows how variable that estimate is.|sample-estimates-plot
sampling|probability|related|The proportion in a representative sample estimates the probability that a random member has a given trait.|sample-proportion-estimate
compare-distributions|randomization-tests|extension|Comparing two groups by their means in units of spread extends to asking whether a difference could arise by chance in a randomization test.|randomization-test-decision
irrational-numbers|complex-numbers|extension|Adding irrational numbers to the rationals gives the real numbers, and complex numbers extend them again to solve x squared = -1.|complex-parts
scientific-notation|exponential-models|application|Quantities that change by factors of ten, such as populations or decay, are written on a scale with powers of ten.|exponential-time-scale
compare-functions|growth-comparison|extension|Comparing rates of change of two functions extends to comparing linear and exponential growth over long times.|linear-or-exponential
qualitative-graphs|trigonometric-graphs|extension|A graph that rises and falls repeatedly describes a periodic situation, and the sinusoid parameters measure that pattern.|sinusoid-parameters
qualitative-graphs|average-rate-change|extension|Reading where a graph increases or decreases becomes measuring how fast, with the average rate over an interval.|average-rate-display
triangle-angle-theorems|circle-theorems|application|Angle sums in triangles are used to find angles in circles, such as in isosceles triangles made of two radii.|circle-radii-triangle
triangle-angle-theorems|inscribed-polygons|application|Angles of a polygon in a circle are found by splitting it into triangles whose angles sum to 180 degrees.|inscribed-polygon-reasoning
curved-solid-volume|sections-and-revolutions|extension|Volumes of cylinders, cones and spheres are explained as solids of revolution.|section-revolution-solid
scatterplots|model-validation|extension|A trend line on a scatterplot is a model, and model validation checks how well it fits the data.|model-residual-conclusion
units-and-precision|sampling-margin-error|related|A measurement has an error bound, as a sample estimate has a margin of error, and each says how far the true value may be.|measurement-error-bound
expression-structure|polynomial-identities|application|Seeing the structure of an expression, such as a difference of squares, reveals identities.|structure-rewrite
expression-structure|rational-expressions|application|Reading the structure of a numerator and denominator shows which factors cancel when simplifying.|structure-rewrite
formula-rearrangement|logarithms|application|Solving an exponential formula for the exponent rewrites it as a logarithm.|log-exponential-form
linear-equation-modeling|parametric-models|application|Position at constant velocity is a linear model in time, which parametric equations write for each coordinate.|parametric-linear-motion
systems-modeling|nonlinear-systems|extension|Setting up a system from a situation extends to systems with a curve, where solutions are intersection points.|nonlinear-system-solve
systems-modeling|matrix-systems|extension|A system from a situation is written as a matrix equation whose solution is found with an inverse.|matrix-linear-system
piecewise-functions|inverse-functions|related|A function that is not one-to-one has an inverse only on a restricted piece of its domain.|inverse-value
piecewise-functions|rational-function-behavior|related|A function may act differently on each side of a point, as a rational function approaches different values from the left and right.|one-sided-behavior-choice
arithmetic-sequences|parametric-models|application|Position after equal steps is a first term plus a number of common differences, as a parametric equation moves at constant velocity.|parametric-linear-motion
geometric-sequences|exponential-equations|application|Finding which term of a geometric sequence reaches a value solves an exponential equation.|same-base-equation
quadratic-formula|polynomial-zeros|extension|The quadratic formula gives zeros of a degree-two polynomial, and the discriminant tells whether a zero repeats.|zero-multiplicity
quadratic-minimum|geometric-design|application|The greatest or least value of a quadratic gives the best design, such as the largest fenced area.|geometric-design-constraint
quadratic-minimum|polynomial-behavior|extension|The minimum of a parabola is a turning point, and higher degree polynomials may have several turning points.|polynomial-graph-match
residuals-correlation|regression-interpretation|extension|Residuals and correlation are used to judge a fitted line and to interpret its coefficients.|residual-function-fit
residuals-correlation|model-validation|extension|Residuals show whether a model fits the data, and model validation uses them to decide whether to keep or change a model.|model-residual-conclusion
congruence-criteria|triangle-law-proofs|application|The measurements that determine a triangle by congruence criteria are the measurements the laws of sines and cosines can solve for.|triangle-law-reasoning
special-right-triangles|complex-plane|application|The point 1 + i forms a 45-45-90 triangle with the axes, so its modulus is the square root of 2 and its angle is 45 degrees.|complex-plane-forms
circle-theorems|radians-unit-circle|extension|Central angles and arcs correspond, and radians measure a central angle as arc length divided by radius.|radian-arc-ratio
arc-sector-measure|geometric-modeling|application|Sector and arc measures model curved shapes such as a pie slice or a curved fence.|geometric-model-choice
arc-sector-measure|trigonometric-area|application|The area of a circular segment is the sector area minus the triangle area, which combines sector and trigonometric area.|trig-triangle-area
circle-equations|complex-plane|related|The equation of a circle x squared + y squared = r squared is the set of complex numbers with modulus r.|complex-plane-forms
circle-equations|polar-coordinates|related|A circle centered at the origin has polar equation r = constant.|polar-graph-identify
coordinate-proofs|vectors|related|Vectors prove geometric claims in coordinates: a quadrilateral is a parallelogram when opposite side vectors are equal.|vector-components
coordinate-proofs|segment-division|extension|Coordinate proofs use midpoints, and a point dividing a segment in a given ratio extends the midpoint.|segment-partition
geometric-modeling|nonlinear-equation-modeling|extension|Choosing a geometric model of a situation leads to an equation, often quadratic when area is involved.|quadratic-context-model
independent-events|categorical-association|related|Independent events have no association: the probability of one does not change given the other, as a two-way table with no association shows.|conditional-frequency-choice
independent-events|simulation-model-checks|application|A simulation of repeated independent trials is checked against the probabilities the independent model predicts.|simulation-consistency-check
rational-exponents|exponential-equations|application|Solving an equation with a fractional exponent raises both sides to the reciprocal power, as same-base exponential equations equate exponents.|same-base-equation
rational-exponents|inverse-functions|related|The power function x to the 1/n is the inverse of x to the n, so rational exponents give inverses of power functions.|inverse-expression
square-root-equations|function-transformations|related|The graph of a square root equation is the root function shifted and stretched, so solving it reads where the shifted graph meets a line.|graph-sqrt-points
square-root-equations|coordinate-distance|application|The distance formula contains a square root, so finding a point at a given distance solves a square root equation.|coordinate-distance-exact
radical-equations|nonlinear-systems|application|Solving a radical equation is finding the intersection of a root curve with another curve, and extraneous solutions are points that do not lie on both.|nonlinear-system-solve
radical-equations|graphical-equation-solving|related|Extraneous roots appear when squaring an equation, and a graph shows which solutions are real intersections.|graphical-solution-table
polynomial-division|rational-expressions|application|Simplifying a rational expression divides the numerator polynomial by a factor of the denominator.|rational-expression-simplify
polynomial-division|rational-function-behavior|extension|Dividing the numerator by the denominator shows the long-run behavior of a rational function, such as a slant asymptote.|rational-function-features
polynomial-zeros|rational-expression-domain|application|The zeros of the denominator polynomial are the values excluded from the domain of a rational expression.|rational-expression-domain
rational-expression-domain|logarithms|related|A rational expression excludes zeros of the denominator and a logarithm excludes nonpositive inputs, both domain restrictions read from the expression.|function-graph-features
rational-expressions|permutations-combinations|application|The number of combinations is a ratio of factorials that simplifies by canceling common factors.|combination-count
rational-equation-one-denominator|rational-function-behavior|application|Solving a rational equation finds where the graph of a rational function takes a value.|rational-function-features
rational-equation-one-denominator|linear-equation-modeling|application|Two workers' rates combine as reciprocals of times, so finding a shared time solves a rational equation.|rate-combination-model
rational-equations|cross-representation-comparison|application|A rational model is compared through its equation, table and graph.|rational-function-representation
rational-equations|graphical-equation-solving|related|Solutions of a rational equation are the x-values where two rational graphs meet.|graphical-solution-table
nonlinear-systems|conic-sections|application|Finding where a line meets a circle or other conic solves a nonlinear system.|conic-standard-form
nonlinear-systems|nonlinear-equation-modeling|application|The break-even point of a quadratic and a linear model is the solution of a nonlinear system.|quadratic-context-model
nonlinear-intersection-count|tangent-construction|application|A line that meets a circle in exactly one point is tangent to it, which the count of intersections detects.|tangent-circle-computation
nonlinear-intersection-count|fundamental-theorem-algebra|related|Counting intersections of a curve and a line counts roots of a polynomial, which the fundamental theorem bounds by its degree.|polynomial-root-count
function-transformations|logarithms|application|The graph of a logarithm is shifted, stretched and reflected by the same transformations.|function-graph-features
function-transformations|matrix-transformations|related|Shifts, stretches and reflections of a graph are transformations, and matrices carry out such transformations on points.|matrix-transformation
function-composition|matrices|related|Applying one transformation after another is composition, and the matching matrices are multiplied in the same order.|matrix-operations
inverse-functions|matrix-inverses|related|An inverse function undoes a function, as an inverse matrix undoes the matrix transformation.|matrix-inverse-determinant
logarithms|growth-comparison|application|The time at which an exponential overtakes another quantity is found by taking a logarithm.|exponential-overtakes
logarithm-properties|growth-comparison|application|Log properties turn the equation that compares two exponentials into a linear equation in the unknown time.|exponential-overtakes
logarithm-properties|sequence-sums|application|The number of terms of a geometric series needed to reach a total is found by taking a logarithm.|geometric-series-sum
exponential-equations|trigonometric-equations|related|Solving for an unknown exponent and solving for an unknown angle both apply an inverse function to isolate the variable.|trig-equation-solutions
sequence-sums|binomial-theorem|related|Sigma notation writes a sum of terms, and the binomial theorem is a sum whose terms use binomial coefficients.|binomial-coefficient
sequence-sums|expected-value|application|An expected value is a sum of each value times its probability, written in sigma notation.|expected-value
trigonometric-graphs|polar-coordinates|extension|Graphing the radius against the angle gives curves such as circles and roses.|polar-graph-identify
normal-distributions|sampling-margin-error|extension|Sample means vary in a roughly normal pattern, so the normal rule gives the margin of error for a sample size.|sample-size-margin
normal-distributions|theoretical-distributions|extension|A normal distribution is a theoretical distribution with a mean and standard deviation, as a discrete distribution has an expected value.|theoretical-distribution-expectation
polynomial-behavior|growth-comparison|related|A polynomial grows slower than any exponential in the long run, which growth comparison shows.|exponential-overtakes
rational-function-behavior|conic-sections|related|The function y = 1/x is a hyperbola with the axes as asymptotes, a conic section.|conic-standard-form
rational-function-behavior|cross-representation-comparison|application|Features of a rational function are compared in its equation, table and graph.|rational-function-representation
inverse-trigonometry|complex-plane|application|The angle of a complex number is found with an inverse trigonometric function of its parts.|complex-plane-forms
inverse-trigonometry|vectors|application|The direction angle of a vector is found by applying an inverse tangent to its components.|fl-vector-angle
trigonometric-identities|parametric-models|application|The identity cos squared + sin squared = 1 turns x = cos t, y = sin t into the equation of a circle.|parametric-rectangular-convert
trigonometric-identities|complex-plane|application|The identity cos squared + sin squared = 1 shows the complex number cos t + i sin t has modulus 1.|complex-plane-forms
trigonometric-equations|oblique-triangles|application|Finding an angle of a triangle from the law of sines solves an equation in the sine, which can have two solutions.|oblique-triangle-solve
complex-plane|vectors|related|A complex number is a point and also a vector, and adding complex numbers adds the vectors.|vector-components
conic-sections|polar-coordinates|related|Conics have polar equations with a focus at the origin, so the same curve has Cartesian and polar forms.|polar-cartesian-conversion
conic-sections|vectors|related|A conic is defined by distances from foci, which are lengths of vectors from the foci to the point.|conic-foci
parametric-models|trigonometric-graphs|application|Each coordinate of a circular parametric motion is a sine or cosine of the parameter, with amplitude and period.|sinusoid-parameters
polar-coordinates|vectors|related|The magnitude and direction of a vector are its polar coordinates r and theta.|vector-components
polar-coordinates|matrix-transformations|related|Adding an angle to theta rotates a point about the origin, which a rotation matrix does to the coordinates.|matrix-transformation
model-validation|randomization-tests|related|Asking whether a model's pattern could come from chance uses the same logic as a randomization test.|randomization-test-decision
model-validation|simulation-model-checks|related|A model is checked by simulating it and comparing the simulated outcomes with the data.|simulation-consistency-check
mental-tens-hundreds|multidigit-products|application|Multiplying by 10 or 100 mentally shifts digits and is the first partial product in a multi-digit multiplication.|multiply-multidigit
mental-tens-hundreds|unit-conversion|application|Converting between metric units multiplies or divides by 10, 100 or 1000, which is mental tens and hundreds.|metric-length-rename
fraction-plot-arithmetic|mean-median|application|The mean of fractional data adds fractions on the line plot and divides by the number of points.|dot-plot-mean
fraction-plot-arithmetic|fraction-multiplication|application|Finding a fraction of a plotted amount multiplies a fraction by a measure.|fraction-of-quantity
measurement-conversions|rational-unit-rates|application|A rate such as miles per hour is converted by changing one unit at a time, and the unit rate may be a fraction.|fraction-unit-rate
measurement-conversions|scale-drawings|application|A scale drawing with a scale in different units needs a unit conversion before lengths compare.|scale-drawing
fraction-plot-computation|complex-fractions|application|Sharing a fractional total among equal parts is a fraction divided by a number, a complex fraction.|complex-fraction
fraction-plot-computation|rational-unit-rates|application|A rate such as a fraction of a pound per person is a unit rate with fractions.|fraction-unit-rate
complex-conjugates|rational-exponents|related|Multiplying a complex quotient by the conjugate of the denominator parallels rationalizing a radical denominator with its conjugate.|rationalize-radical-denominator
complex-conjugates|polynomial-zeros|application|Nonreal zeros of a polynomial with real coefficients come in conjugate pairs.|zeros-from-factors
complex-distance|vectors|related|The distance between complex numbers is the length of the vector between their points.|vector-components
complex-distance|segment-division|related|The midpoint of two complex numbers is their average, the same as the midpoint of a segment.|complex-distance-midpoint
complex-factorization|polynomial-zeros|application|Writing a polynomial as a product of complex linear factors shows each zero and its multiplicity.|zero-multiplicity
complex-factorization|polynomial-identities|extension|The difference of squares identity extends to a sum of squares over the complex numbers: x squared + 1 = (x + i)(x - i).|polynomial-identity-use
fundamental-theorem-algebra|polynomial-zeros|extension|A polynomial of degree n has n complex zeros counted with multiplicity, which is used to count and find zeros.|polynomial-root-count
fundamental-theorem-algebra|rational-function-behavior|application|The number of zeros of the numerator and denominator gives the x-intercepts and vertical asymptotes of a rational function.|rational-function-features
model-quantities|systems-modeling|application|A system of equations for a situation needs each quantity defined first, with a variable and a unit for each.|system-equation-choice
model-quantities|geometric-modeling|application|A geometric model of a situation needs defined quantities such as length, area and their units.|geometric-model-choice
number-system-closure|complex-numbers|extension|Real numbers are not closed under the square root, and the complex numbers extend them so that every number has one.|complex-parts
number-system-closure|matrix-properties|related|Closure and properties are checked for matrices as for numbers: matrices add and multiply, but multiplication is not commutative.|matrix-laws
vector-modeling|complex-plane|related|Adding force or velocity vectors is the same as adding complex numbers as points in the plane.|complex-plane-operations
vector-modeling|matrices|related|A vector is written as a column matrix, and matrices act on vectors by multiplication.|matrix-operations
matrix-data|matrix-systems|extension|Data stored in a matrix are combined by multiplying matrices, and unknowns are found by solving the matrix system.|matrix-linear-system
matrix-data|matrix-transformations|related|Points stored as the columns of a matrix are transformed all at once by multiplying with another matrix.|matrix-transformation
matrix-properties|function-composition|related|Matrix multiplication and function composition both depend on order: AB differs from BA, and f of g differs from g of f.|composition-order-choice
matrix-properties|matrix-transformations|application|Matrix laws such as order of multiplication decide how a sequence of transformations composes.|matrix-transformation
matrix-inverses|matrix-transformations|application|The inverse of a transformation matrix undoes the transformation.|matrix-transformation
matrix-transformations|complex-plane|related|Multiplying by i rotates a point 90 degrees, as a rotation matrix does to the coordinates.|complex-plane-operations
polynomial-identities|trigonometric-identities|related|Algebraic identities such as the difference of squares are used to prove trigonometric identities.|trig-identity-value
binomial-theorem|probability-multiplication|application|The probability of exactly k successes in n independent trials multiplies the success probabilities and a binomial coefficient.|multiplication-rule-probability
nonlinear-equation-modeling|periodic-modeling|related|Choosing a model for a situation includes choosing between a quadratic, exponential and sinusoid.|sinusoid-model
nonlinear-equation-modeling|decision-strategies|application|Finding the best choice often means finding the best value of a model, such as the maximum of a quadratic.|strategy-expected-value
equation-reasoning|trigonometric-identities|application|Proving a trigonometric identity is a chain of equal expressions, each step justified by a property.|trig-identity-value
equation-reasoning|polynomial-identities|application|A polynomial identity is shown by a chain of steps that each keep the expression equal.|polynomial-identity-use
symbolic-linear-constraints|nonlinear-intersection-count|related|A parameter in an equation changes the number of solutions, as it changes the number of intersection points of two curves.|nonlinear-system-count
symbolic-linear-constraints|quadratic-formula|application|Choosing a parameter so that an equation has a given root or double root uses the discriminant.|quadratic-parameter-root
elimination-proof|matrix-inverses|related|Elimination steps that keep a system equivalent are the row operations used to find an inverse matrix.|matrix-inverse-determinant
elimination-proof|nonlinear-systems|extension|Eliminating a variable from two equations works for a system with a curve, leaving one equation in the remaining variable.|nonlinear-system-solve
matrix-systems|vector-modeling|application|Finding components of vectors that add to a given resultant solves a linear system.|vector-resultant
matrix-systems|regression-interpretation|application|Fitting a line through data solves a linear system for the slope and intercept.|regression-line-predict
graphical-equation-solving|nonlinear-intersection-count|extension|Solving an equation graphically extends to counting how many times two graphs meet.|nonlinear-system-count
graphical-equation-solving|trigonometric-equations|application|The solutions of a trigonometric equation are the points where the sine graph meets a horizontal line, so there are many of them.|trig-equation-solutions
inequality-regions|polynomial-zeros|extension|A polynomial inequality is solved by the signs between zeros, as a half-plane is found by testing a point on each side of a line.|polynomial-inequality-solve
inequality-regions|rational-expressions|extension|A rational inequality is solved by testing signs on each side of the zeros and excluded values.|rational-inequality-solve
average-rate-change|regression-interpretation|application|The slope of a fitted line is the average rate of change of the response per unit of the explanatory variable.|regression-coefficient-meaning
average-rate-change|periodic-modeling|application|The average rate of change of a periodic model over an interval measures how fast it rises or falls on average.|sinusoid-model
cross-representation-comparison|periodic-modeling|application|A periodic model can be given as a table, graph or equation, and its amplitude and period are read from any of them.|sinusoid-model
growth-comparison|sequence-sums|application|The total of an exponentially growing quantity over equal steps is a geometric series.|geometric-series-sum
growth-comparison|nonlinear-systems|application|Where a linear and an exponential model are equal is a solution of a system with a curve.|nonlinear-system-solve
special-angle-values|vectors|application|The components of a vector at 30, 45 or 60 degrees use exact values of the special angles.|vector-components
trigonometric-symmetry|trigonometric-equations|application|Symmetry of the unit circle gives a second solution of a trigonometric equation in each period.|trig-equation-solutions
trigonometric-symmetry|polar-coordinates|related|Symmetry of sine and cosine shows in polar curves, such as symmetry across the axes.|polar-graph-identify
periodic-modeling|regression-interpretation|related|Fitting a sinusoid to data is a nonlinear regression, and a line fit is the linear case.|nonlinear-data-model
periodic-modeling|vector-modeling|related|The position of a point moving around a circle is a vector whose components are a cosine and a sine of time.|vector-resultant
periodic-modeling|matrix-transformations|related|A rotation matrix with entries cosine and sine turns each point by an angle, the same periodic pattern as a sinusoid.|matrix-transformation
nonlinear-intersection-reading|conic-sections|application|Reading where a line crosses a circle or ellipse counts and locates the solutions of a system with a conic.|nonlinear-system-read
exponential-equations|nonlinear-equation-modeling|application|When the unknown is a time or count in an exponent, solving the model equation uses logarithms or equal bases.|exponential-log-solution
polynomial-behavior|regression-interpretation|application|Choosing a polynomial to fit nonlinear data uses its end behavior and number of turns to judge which degree fits.|nonlinear-data-model
trigonometric-equations|complex-plane|application|Finding the angles whose cosine and sine match the parts of a complex number solves a trigonometric equation.|complex-plane-forms
oblique-triangles|vectors|application|The magnitude and direction of a sum of two vectors are found by solving the triangle they form with the law of cosines and sines.|fl-vector-angle
oblique-triangles|triangle-circles|application|In any triangle the law of sines gives a over sin A equal to the diameter of the circumscribed circle.|triangle-circle-centers
parametric-models|matrix-transformations|application|A parametric circle is rotated or stretched by applying a matrix to the coordinate pair at each parameter value.|matrix-transformation
polynomial-identities|rational-expressions|application|Identities such as the difference of squares factor a numerator or denominator so that a rational expression simplifies.|rational-expression-simplify
binomial-theorem|expected-value|application|The expected number of successes in n independent trials is n times the success probability, the mean of the binomial distribution.|expected-value
cross-representation-comparison|regression-interpretation|application|Comparing a table, a graph and an equation of a fitted model shows how well it represents the data.|nonlinear-data-model
matrix-inverses|transformation-invariants|related|The inverse of a rigid motion is a rigid motion, and its matrix undoes the original matrix, so invariants such as length are preserved by both.|transformation-invariant-claims
matrix-transformations|dilation-properties|related|A scale matrix is a dilation about the origin, which multiplies every length by the scale factor and every area by its square.|dilation-measure
circle-similarity|radians-unit-circle|extension|All circles are similar, so arc length divided by radius is the same for a given central angle, and that ratio is the angle in radians.|radian-arc-ratio
circle-similarity|circle-equations|application|Every circle is a dilation of the unit circle, so x squared + y squared = r squared is the unit circle scaled by r.|circle-equation
triangle-circles|circle-equations|application|The circle through three points has its center where the perpendicular bisectors meet, and its equation uses that center and radius.|circle-equation
triangle-circles|parabola-locus|related|The circumcenter is the locus of points equally far from the three vertices, as a parabola is the locus of points equally far from a focus and a line.|parabola-focus-directrix
tangent-construction|conic-sections|extension|A tangent to a conic touches it at one point, extending the tangent to a circle to ellipses, parabolas and hyperbolas.|conic-standard-form
tangent-construction|vectors|application|A tangent is perpendicular to the radius, which is a dot product of zero between the tangent vector and the radius vector.|fl-vector-dot-product
transformation-invariants|matrix-transformations|application|Matrices that carry out rigid motions keep lengths and angles, the invariants of the motions.|matrix-transformation
transformation-invariants|dilation-properties|related|Dilations keep angles and ratios of lengths but not lengths, a different set of invariants from rigid motions.|dilation-measure
polygon-symmetries|complex-plane|application|The n-th roots of unity are the vertices of a regular n-gon, whose rotations are multiplications by those roots.|complex-plane-forms
polygon-symmetries|trigonometric-symmetry|related|The symmetries of a regular polygon and of the unit circle explain why sine and cosine values repeat and reflect.|trig-symmetry-value
transformation-constructions|function-transformations|related|A sequence of translations, reflections and dilations carries one figure to another, as a sequence of shifts, reflections and stretches carries one graph to another.|transform-point
transformation-constructions|dilation-properties|related|A construction that maps one figure to another by a sequence including a dilation uses the dilation's scale factor and center.|dilation-measure
line-angle-proofs|circle-theorems|application|Angle relations from parallel lines and transversals are reasons in proofs of circle angle theorems.|circle-angles
triangle-proofs|triangle-law-proofs|application|The altitude and congruence reasoning in triangle proofs is used to derive the laws of sines and cosines.|triangle-law-reasoning
triangle-proofs|vectors|related|A midsegment of a triangle is half the vector of the side it is parallel to.|triangle-theorem-consequences
parallelogram-proofs|vectors|related|Opposite sides of a parallelogram are equal vectors, so the diagonals are the sum and difference of two adjacent side vectors.|parallelogram-property-consequences
parallelogram-proofs|matrix-transformations|application|A matrix maps the unit square to a parallelogram, and the area of that parallelogram is the determinant.|matrix-transformation
inscribed-polygons|trigonometric-area|application|A regular polygon inscribed in a circle splits into congruent triangles whose area uses the sine of the central angle.|rg-triangle-area-sas
inscribed-polygons|complex-plane|application|The vertices of a regular polygon in a circle are complex numbers of equal modulus separated by equal angles.|complex-plane-forms
measurement-formula-proofs|geometric-modeling|application|Justified area and volume formulas are used to model objects, such as a regular polygon whose area splits into triangles.|regular-polygon-area
measurement-formula-proofs|trigonometric-area|extension|The area formula one half base times height becomes one half ab sin C when the height is written with a sine.|trig-triangle-area
cavalieri-principle|curved-solid-volume|application|Equal cross-sections explain why the volume of a cone and a sphere follow from simple comparisons.|cone-sphere-volume
cavalieri-principle|density-modeling|application|Solids with equal cross-sections have equal volumes, so a slanted and a straight block of the same material have equal mass.|density-context
solid-volume-models|geometric-design|application|A design with a required volume leads to a constraint on its dimensions, such as the volume of a container.|geometric-design-constraint
solid-volume-models|nonlinear-equation-modeling|application|A volume formula in one unknown dimension gives a polynomial equation, often quadratic after a ratio of dimensions is fixed.|quadratic-context-model
sections-and-revolutions|cavalieri-principle|related|A solid of revolution is built from circular cross-sections, and Cavalieri compares solids by their cross-sections.|cavalieri-volume-reasoning
sections-and-revolutions|conic-sections|related|Rotating a parabola about its axis gives a paraboloid, and slicing a cone gives the conic curves.|cone-section-name
parabola-locus|parametric-models|application|The path of an object with constant horizontal speed and constant vertical acceleration is a parabola written with a parameter.|parametric-rectangular-convert
parabola-locus|function-transformations|related|A parabola with its focus and directrix moved is the same locus, shifted, which the transformations of y = x squared describe.|transform-equation
slope-proofs|vectors|related|Two lines are perpendicular exactly when their direction vectors have dot product zero, which is the same as slopes whose product is -1.|fl-vector-dot-product
slope-proofs|linear-equation-modeling|application|Parallel and perpendicular lines have equations with equal or negative reciprocal slopes, used to write the equation of a line.|line-relationship-equations
segment-division|parametric-models|extension|The point a fraction t of the way from A to B is A + t(B - A), which is a parametric line.|parametric-linear-motion
segment-division|expected-value|related|A point dividing a segment in ratio p to q is a weighted average of the endpoints, as an expected value weights each outcome by its probability.|expected-value
coordinate-measurement|matrices|application|The area of a parallelogram or triangle with vertices on a grid is found from a determinant of the side vectors.|matrix-operations
coordinate-measurement|vectors|related|The side lengths of a polygon on a grid are the lengths of the vectors between its vertices.|vector-components
density-modeling|systems-modeling|application|Mixing two materials of known densities to get a given total mass and volume is solved with a system of equations.|system-model-value
density-modeling|linear-models|application|A graph of mass against volume is a line whose slope is the density.|inline-linear-features
geometric-design|decision-strategies|application|Choosing the best design among options compares their values, as a decision strategy compares expected values.|strategy-expected-value
geometric-design|polynomial-behavior|application|The volume of a box cut from a sheet is a cubic in the cut size, whose graph shows the greatest volume.|polynomial-graph-match
dilation-properties|vectors|related|A dilation multiplies each position vector by the scale factor, as a scalar multiple scales a vector.|vector-components
similarity-theorems|complementary-trigonometry|extension|The altitude to the hypotenuse makes two right triangles similar to the original, which shows the sine of one acute angle is the cosine of the other.|complementary-trig
similarity-theorems|slope-proofs|application|Similar right triangles on two perpendicular lines show their slopes are negative reciprocals.|perpendicular-slopes
complementary-trigonometry|trigonometric-symmetry|extension|The cofunction relation sin(90 - x) = cos x is one of the symmetries of the sine and cosine on the unit circle.|trig-symmetry-value
complementary-trigonometry|trigonometric-identities|extension|Cofunction relations are identities that hold for every angle and are used to rewrite expressions.|trig-identity-value
trigonometric-area|vectors|related|The area of a triangle with sides a and b and included angle C is half the magnitude of the cross product, one half ab sin C.|trig-triangle-area
trigonometric-area|geometric-modeling|application|The area of a regular polygon is found by adding the areas of congruent triangles with sine area.|regular-polygon-area
triangle-law-proofs|vectors|related|The law of cosines is the source of the dot product formula for the angle between two vectors.|fl-vector-angle
triangle-law-proofs|polar-coordinates|application|The distance between two points given in polar coordinates is found with the law of cosines.|polar-cartesian-conversion
event-sets|conditional-probability|extension|Conditional probability restricts the sample space to one event set, then counts the part of another set inside it.|conditional-probability-value
event-sets|random-variables|extension|A random variable assigns a number to each outcome, so its values are described by event sets of outcomes.|random-variable-distribution
probability-addition|random-variables|application|The probabilities of all values of a random variable add to 1 because the events are disjoint and cover the sample space.|random-variable-distribution
probability-addition|empirical-distributions|application|Relative frequencies of disjoint results add to 1, as the addition rule requires for probabilities.|empirical-distribution-expectation
probability-multiplication|simulation-model-checks|application|A simulation of repeated independent trials is compared with the product of probabilities.|simulation-consistency-check
probability-multiplication|theoretical-distributions|extension|Multiplying the probabilities along a sequence of trials gives the probabilities in a theoretical distribution.|theoretical-distribution-expectation
permutations-combinations|fair-random-decisions|application|A fair random choice among arrangements or groups gives each of the counted outcomes the same probability.|fair-selection-procedure
simulation-model-checks|causal-claims|application|Simulating random assignment shows how large a difference can arise by chance before a causal claim is made.|causal-claim-choice
sampling-margin-error|empirical-distributions|extension|Repeating a sample many times builds an empirical distribution of sample estimates, whose spread is the margin of error.|empirical-distribution-expectation
sampling-margin-error|random-variables|related|A sample mean varies from sample to sample, so it is a random variable with its own distribution.|random-variable-distribution
randomization-tests|causal-claims|application|A significant randomization test from random assignment supports a causal conclusion.|study-design-choice
randomization-tests|empirical-distributions|related|The results of reshuffled data form an empirical distribution against which the observed result is compared.|empirical-distribution-expectation
statistical-report-critique|decision-strategies|application|A decision rests on the evidence reported, so a report is critiqued for flaws before it is used.|report-flaw-critique
statistical-report-critique|statistical-summary-comparison|related|A report that gives only a mean can hide skew or outliers, which a comparison of summaries reveals.|outlier-center-shift
statistical-summary-comparison|normal-distributions|extension|Standard deviations compare spread, and the normal rule uses them to say what fraction of values lie within them.|normal-model-rule
statistical-summary-comparison|regression-interpretation|related|An outlier changes a mean, and it can also change a fitted line, so both are judged with outliers in mind.|outlier-center-shift
categorical-association|causal-claims|related|A strong association in a two-way table does not show that one variable causes the other.|causal-claim-choice
categorical-association|statistical-report-critique|application|Reports that state percents from a table are checked by comparing the right conditional frequencies.|conditional-frequency-choice
regression-interpretation|model-validation|extension|Residuals from a regression line are used to decide whether the model should be kept or revised.|residual-function-fit
causal-claims|fair-random-decisions|related|Random assignment is a fair random procedure that gives every subject the same chance of each treatment.|study-design-choice
causal-claims|empirical-distributions|related|Reshuffling treatment labels many times builds an empirical distribution of differences, against which an observed difference supporting a causal claim is judged.|causal-claim-choice
random-variables|normal-distributions|extension|A continuous random variable with a bell-shaped distribution is described by a mean and standard deviation.|normal-model-rule
theoretical-distributions|statistical-inference|extension|A theoretical distribution of sample means gives the margin of error used in statistical inference.|sample-mean-estimate
theoretical-distributions|fair-random-decisions|related|A fair procedure has a theoretical distribution in which every outcome is equally likely.|fair-selection-procedure
empirical-distributions|statistical-inference|extension|The distribution of many simulated sample statistics estimates the sampling variability used in statistical inference.|sample-mean-estimate
empirical-distributions|model-validation|related|An empirical distribution of results is compared with the model's theoretical distribution to check the model.|model-residual-conclusion
fair-random-decisions|randomization-tests|application|A fair random shuffle of group labels is the procedure a randomization test repeats.|randomization-test-decision
fair-random-decisions|study-design|application|Random selection and random assignment are fair procedures that justify the scope of an inference.|scope-of-inference-choice
decision-strategies|empirical-distributions|application|When expected value is hard to compute, a decision strategy is evaluated by simulating it and averaging the simulated results.|strategy-expected-value
decision-strategies|fair-random-decisions|related|A decision that picks among options by a random device needs the device to be fair.|fair-selection-procedure
sort-and-count|write-numerals|related|After sorting a group into categories, the count of each category is recorded with a numeral.|numeral-for-quantity
sort-and-count|addition-within-10|application|Joining the counts of two sorted groups finds how many there are in all.|join-within-10
compare-numerals|subtraction-within-10|application|How much greater one numeral is than another is a subtraction: 7 is 3 more than 4 because 7 - 4 = 3.|take-away-within-10
sort-and-count|number-bonds|related|A group split into two sorted parts is a number bond: 8 shapes are 5 red and 3 blue.|number-bond-missing
count-to-100|make-ten|related|Counting on from a number until reaching ten shows how many more make ten.|ten-frame-complement
compare-attributes|compose-shapes|related|Composing a shape from pieces needs edges that match in length, which is a comparison of an attribute.|complete-the-shape
categorical-data|addition-stories|application|Questions about a picture graph, such as how many in all, are addition stories about the categories.|story-equation-choice
shape-attributes|thirds-and-partitions|related|Equal parts of a shape are partitions that depend on its attributes, such as sides of equal length.|same-share-different-shape
mental-tens-hundreds|add-subtract-thousands|application|Adding or subtracting tens and hundreds mentally is the first step in adding and subtracting three-digit numbers.|add-three-digit
compare-numerals|compare-fractions|related|Fractions with the same denominator are compared by comparing their numerators, as whole numbers of the same unit are compared.|compare-like-denominators
compose-shapes|quadrilateral-categories|related|Putting two triangles together along a side makes a quadrilateral, and which quadrilateral depends on the triangles.|find-quadrilateral
compare-small-groups|multiplicative-comparison|extension|Comparing groups as more or fewer extends to comparing as times as many.|comparison-factor
fractions-number-line|mixed-numbers|application|A mixed number is a point on a number line between two whole numbers, a whole part and a fraction of the next unit.|improper-whole-part
halves-and-quarters|lines-symmetry|related|A line of symmetry splits a shape into two equal halves that match.|symmetry-line-check
equivalent-fractions|unit-fraction-division|related|Finding how many fourths fit in 1 uses equivalent fractions: 1 equals 4/4, so there are 4 fourths.|whole-unit-groups
measure-equal-units|volume-cubes|extension|Measuring with equal units extends from length to area to volume, where the unit is a cube.|unit-cube-volume
lines-symmetry|shape-hierarchy|related|The number of lines of symmetry separates shapes in the hierarchy: a square has four and a rectangle has two.|hierarchy-statement
multiplicative-comparison|ratio-tables|extension|Saying one amount is a number of times another is the multiplier in a ratio table that scales both amounts.|ratio-table-missing
missing-factor|integer-division|extension|Long division finds the unknown factor that multiplies the divisor to give the dividend.|long-division-quotient
arithmetic-patterns|integer-powers|extension|A pattern that doubles each time is repeated multiplication, which a power writes with an exponent.|power-doubling-story
rectangle-area|coordinate-polygons|application|The area of a rectangle drawn on a grid is its width times its height, read from the coordinates of the vertices.|coordinate-rectangle-measure
picture-bar-graphs|statistical-questions|related|A graph of data shows variation, which is what a statistical question expects.|statistical-question-choice
polygon-properties|solid-cross-sections|application|A cross-section of a solid is a polygon, named by its sides and angles.|cross-section-shape
arrays|compound-probability|application|The rows and columns of an array count the outcomes of two choices, which is the counting principle.|counting-principle
scaled-graphs|qualitative-graphs|extension|Reading values on a scaled graph extends to reading what the shape of a graph says about a story.|story-graph-match
lines-symmetry|rigid-motions|related|Reflecting a shape across its line of symmetry is a rigid motion that maps the shape onto itself.|identify-rigid-motion
triangle-construction|triangle-angle-theorems|related|Three angles can form a triangle only if they total 180 degrees, the angle sum theorem.|triangle-angle-sum
expression-structure|complete-square|application|Seeing x squared + 2ax as part of a squared binomial is the structure used to complete the square.|complete-square-term
complete-square|quadratic-minimum|application|Completing the square writes a quadratic in vertex form, which shows its minimum or maximum value.|quadratic-vertex
variability|residuals-correlation|related|A residual is the deviation of a data point from a line, as a deviation is the distance of a data value from the mean.|residual-value
coordinate-distance|special-right-triangles|application|The distance from (0, 0) to (1, 1) is the square root of 2, which is the hypotenuse of a 45-45-90 triangle.|special-right-triangle
fraction-multiplication|independent-events|application|The probability of two independent events is the product of their probabilities, a product of fractions.|independent-events-probability
rational-exponents|logarithm-properties|related|Logarithm rules restate exponent rules, and changing the base uses powers with rational exponents.|change-of-base
polynomial-identities|complex-conjugates|application|The difference of squares identity gives (a + bi)(a - bi) = a squared + b squared, the product of a number and its conjugate.|complex-conjugate-division
dependent-variables|model-quantities|extension|Naming the independent and dependent variable begins modeling, and each modeled quantity also needs a unit.|model-quantity-roles
signed-numbers|number-system-closure|extension|Sorting numbers into whole, integer and rational sets begins checking whether each set is closed under an operation.|number-system-closure-classify
dilation-properties|similarity-theorems|application|A dilation keeps ratios of lengths, which makes corresponding sides of similar triangles proportional.|similarity-theorem-length
fraction-addition|probability-addition|application|The probability of one event or another adds their probabilities, which are fractions.|addition-rule-probability
`;
