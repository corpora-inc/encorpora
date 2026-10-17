import type { GradeBand, Skill, Standard } from './types.js';

// Original K–8 summaries from the Corpora catalog; identifiers reviewed 2026-09-27.
const rows: [string, string, string][] = [
 ['K/CC','AAABBCC','Count by ones and tens|Continue counting from a given number|Connect written numerals and quantities|Connect counting order to group size|Count arranged and scattered collections|Compare group sizes by matching|Order written numbers through ten'],
 ['K/OA','AAAAA','Represent joining and separating|Solve small addition and subtraction situations|Split small quantities in several ways|Find a partner to make ten|Recall addition and subtraction through five'],
 ['K/NBT','A','Build teen numbers from ten and extras'],
 ['K/MD','AAB','Describe measurable object properties|Compare objects by shared attributes|Sort objects and count categories'],
 ['K/G','AAABBB','Name shapes and describe their positions|Recognize shapes across sizes and orientations|Distinguish flat shapes from solids|Compare shape parts and properties|Construct shapes using everyday materials|Join simple shapes into larger shapes'],
 ['1/OA','AABBCCDD','Model addition and subtraction stories|Combine three small quantities|Use operation structure to simplify calculations|Connect subtraction with a missing addend|Connect counting steps with arithmetic|Develop strategies for small-number arithmetic|Interpret equality in varied equations|Find missing entries in arithmetic equations'],
 ['1/NBT','ABBCCC','Read and count numbers through 120|Compose tens and remaining ones|Compare two-digit quantities|Add using tens and ones|Find ten more or ten less|Subtract quantities of whole tens'],
 ['1/MD','AABC','Order and indirectly compare lengths|Measure by repeating an equal unit|Read hour and half-hour times|Organize and question small categorical datasets'],
 ['1/G','AAA','Separate defining from incidental shape attributes|Compose shapes and solids from pieces|Partition wholes into halves and quarters'],
 ['2/OA','ABCC','Solve one-step and two-step quantity stories|Recall small addition and subtraction facts|Recognize odd and even group sizes|Count equal rows using repeated addition'],
 ['2/NBT','AAAABBBBB','Compose hundreds tens and ones|Skip-count within one thousand|Read expanded and written three-digit numbers|Compare three-digit quantities|Calculate sums and differences through 100|Combine several two-digit addends|Regroup sums and differences through 1000|Mentally change hundreds and tens|Explain arithmetic through place-value structure'],
 ['2/MD','AAAABBCCDD','Choose tools for measuring length|Connect unit size with measurement count|Estimate lengths in familiar units|Find differences between measured lengths|Model length problems with arithmetic|Represent arithmetic on a number line|Read five-minute clock intervals|Calculate values using bills and coins|Display measured lengths in dot plots|Build and interpret categorical graphs'],
 ['2/G','AAA','Identify figures by sides angles and faces|Tile rectangles with equal square rows|Partition wholes into halves thirds quarters'],
 ['3/OA','AAAABBCDD','Interpret multiplication as equal groups|Interpret division as grouping or sharing|Model equal-group stories with operations|Find missing factors and quotients|Use multiplication structure to calculate|Connect division with missing factors|Recall multiplication and division facts|Model two-step stories and check plausibility|Explain regularities in arithmetic patterns'],
 ['3/NBT','AAA','Round quantities to tens and hundreds|Calculate sums and differences through 1000|Multiply small numbers by whole tens'],
 ['3/NF','AAA','Interpret numerator and denominator through parts|Locate fractions along a number line|Explain equivalence and compare fractional quantities'],
 ['3/MD','AABBCCCD','Calculate elapsed time in minutes|Measure and calculate mass and capacity|Interpret scaled categorical graphs|Plot fractional length measurements|Interpret area through unit-square coverage|Count square units to measure area|Connect rectangular area with multiplication|Find perimeters and compare rectangle dimensions'],
 ['3/G','AA','Organize quadrilaterals by shared properties|Describe equal-area pieces with fractions'],
 ['4/OA','AAABC','Interpret multiplicative comparisons|Model multiplicative comparison stories|Solve multistep stories with remainder meaning|Investigate divisors multiples and primality|Extend rules and explain emerging patterns'],
 ['4/NBT','AAABBB','Connect neighboring place-value positions|Represent and compare large whole numbers|Round large quantities to chosen places|Use algorithms for whole-number sums differences|Multiply larger whole numbers with representations|Divide larger whole numbers with remainders'],
 ['4/NF','AABBCCC','Explain equivalent fractional representations|Compare fractions with differing denominators|Compose and decompose like-denominator fractions|Multiply fractions by whole quantities|Connect tenths and hundredths additively|Connect decimal and fractional representations|Compare decimal quantities through hundredths'],
 ['4/MD','AAABCCC','Convert between related measurement units|Solve measurement stories with conversions|Use rectangle area and perimeter relationships|Interpret plots of fractional measurements|Interpret angles through rotations and degrees|Measure and sketch specified angles|Combine and subtract adjacent angle measures'],
 ['4/G','AAA','Identify lines rays and angle relationships|Classify figures through line and angle properties|Identify and draw reflection symmetry'],
 ['5/OA','AAB','Evaluate expressions with grouping symbols|Translate calculation descriptions into expressions|Connect paired patterns with coordinate graphs'],
 ['5/NBT','AAAABBB','Explain tenfold and tenth place-value changes|Connect decimal shifts with powers of ten|Represent and compare thousandth-place decimals|Round decimal quantities to chosen places|Multiply whole numbers using algorithms|Divide whole numbers by two-digit divisors|Calculate decimal sums differences products quotients'],
 ['5/NF','AABBBBB','Calculate sums and differences across denominators|Solve fractional addition and subtraction stories|Interpret a fraction as division|Multiply fractions using quantity and area models|Interpret multiplication as scaling|Solve fractional multiplication situations|Divide unit fractions and whole quantities'],
 ['5/MD','ABCCC','Convert measurements within a unit system|Plot fractional measurements and solve problems|Interpret volume through cubic-unit filling|Count cubes in rectangular prisms|Connect prism volume with multiplication and addition'],
 ['5/G','AABB','Locate points using coordinate axes|Interpret first-quadrant coordinates in situations|Connect inherited properties of shape classes|Organize shapes into classification hierarchies'],
 ['6/RP','AAA','Describe relative quantities using ratios|Interpret rates per single unit|Use ratios for tables percentages conversions'],
 ['6/NS','ABBBCCCC','Divide fractions and model their quotients|Divide whole numbers using algorithms|Calculate with decimals using algorithms|Find common divisors and common multiples|Interpret signed quantities in context|Locate signed numbers and coordinate points|Compare signed values and interpret absolute value|Solve coordinate problems including aligned distances'],
 ['6/EE','AAAABBBBC','Evaluate whole-number powers|Build interpret and evaluate variable expressions|Transform expressions using operation properties|Recognize equivalent expressions|Interpret solutions as values making statements true|Use variables to represent unknown quantities|Solve single-operation equations|Represent inequalities and their solution sets|Connect dependent quantities across representations'],
 ['6/G','AAAA','Find polygon areas by decomposition|Compute prism volume with fractional edges|Use coordinates to determine polygon lengths|Use nets to calculate surface area'],
 ['6/SP','AAABB','Distinguish questions that anticipate variation|Describe dataset center spread and shape|Distinguish center from measures of variability|Represent numerical distributions in varied plots|Summarize data with context and numerical measures'],
 ['7/RP','AAA','Calculate unit rates involving fractions|Represent and recognize proportional relationships|Solve percentage and ratio applications'],
 ['7/NS','AAA','Add and subtract signed rational quantities|Multiply divide and convert signed rationals|Solve contextual rational-number calculations'],
 ['7/EE','AABB','Rewrite linear expressions using algebraic structure|Interpret equivalent forms in context|Solve multistep rational-number situations|Construct and solve equations and inequalities'],
 ['7/G','AAABBB','Calculate measurements from scale drawings|Construct figures and investigate triangle uniqueness|Describe cross-sections of solids|Relate circle radius circumference and area|Use angle relationships to solve unknowns|Measure compound figures and right prisms'],
 ['7/SP','AABBCCCC','Use representative samples for population questions|Estimate population quantities and sampling variation|Compare distributions relative to their variability|Draw population comparisons from sample summaries|Interpret probability on a zero-to-one scale|Compare experimental frequencies with probability predictions|Build and assess event probability models|Organize and simulate compound event outcomes'],
 ['8/NS','AA','Distinguish rational and irrational expansions|Locate irrational values using rational approximations'],
 ['8/EE','AAAABBCC','Use integer exponent relationships|Evaluate roots and interpret root equations|Estimate quantities using powers of ten|Calculate and interpret scientific notation|Connect proportional rates with graph slope|Derive linear equations through slope relationships|Solve and classify single-variable linear equations|Solve simultaneous linear systems'],
 ['8/F','AAABB','Interpret functions as unique output assignments|Compare functions across representations|Distinguish linear from nonlinear functions|Model linear change and interpret parameters|Describe change from graphs and situations'],
 ['8/G','AAAAABBBC','Investigate properties preserved by rigid motions|Describe congruence through sequences of motions|Track coordinates through geometric transformations|Describe similarity through motions and dilation|Reason about triangle angles and parallel lines|Explain the right-triangle square relationship|Apply the right-triangle relationship to lengths|Calculate distances between coordinate points|Compute volumes of cones cylinders spheres'],
 ['8/SP','AAAA','Interpret associations in paired numerical data|Fit informal lines to scatter plots|Interpret linear-model slopes and intercepts|Investigate association with two-way frequency tables'],
];

export const standards: Standard[] = rows.flatMap(([path, clusters, text]) => {
  const [grade, domain] = path.split('/');
  const descriptions = text.split('|');
  if (descriptions.length !== clusters.length) throw new Error(`Invalid standards row: ${path}`);
  return descriptions.map((description, i) => ({
    id: `${grade}.${domain}.${clusters[i]}.${i + 1}`, framework: 'CCSS' as const,
    description, scope: 'standard' as const, sourceReviewedAt: '2026-09-27',
    sourceUrl: `https://www.thecorestandards.org/Math/Content/${path}/`,
  }));
});

// High-school category and SAT domain references are deliberately broad, not numbered-standard certification.
const domains: [string, string, string][] = [
 ['HSN', 'Number systems, quantities, complex numbers, vectors and matrices', 'https://www.thecorestandards.org/Math/Content/HSN/'],
 ['HSA', 'Expressions, equations, inequalities and polynomial structure', 'https://www.thecorestandards.org/Math/Content/HSA/'],
 ['HSF', 'Function representations, transformations, models and trigonometry', 'https://www.thecorestandards.org/Math/Content/HSF/'],
 ['HSG', 'Geometric reasoning, transformations, measurement and coordinates', 'https://www.thecorestandards.org/Math/Content/HSG/'],
 ['HSS', 'Data, inference, probability and statistical decisions', 'https://www.thecorestandards.org/Math/Content/HSS/'],
 ['HSM', 'Formulate, analyze, validate and communicate mathematical models', 'https://www.thecorestandards.org/Math/Content/HSM/'],
 ['SAT.algebra', 'Linear equations, functions, systems and inequalities', 'https://satsuite.collegeboard.org/k12-educators/about/alignment/math'],
 ['SAT.advanced-math', 'Equivalent expressions and nonlinear equations and functions', 'https://satsuite.collegeboard.org/k12-educators/about/alignment/math'],
 ['SAT.data', 'Ratios, data, probability, samples and study design', 'https://satsuite.collegeboard.org/k12-educators/about/alignment/math'],
 ['SAT.geometry', 'Measurement, angles, triangles, circles and trigonometry', 'https://satsuite.collegeboard.org/k12-educators/about/alignment/math'],
];
standards.push(...domains.map(([id, description, sourceUrl]) => ({ id, description, sourceUrl,
  framework: id.startsWith('SAT.') ? 'SAT' as const : 'CCSS' as const,
  sourceReviewedAt: '2026-10-16', scope: 'domain' as const })));

// id | grade band | strand | learning objective | prerequisites | source references
// Each objective is a planned assessable facet; decomposition and crosswalk review continue before publication.
const outline = `
count-to-20|K|number|Count objects with one count per object and state the total||K.CC.B.4,K.CC.B.5
count-to-100|K|number|Continue the counting sequence by ones and tens|count-to-20|K.CC.A.1,K.CC.A.2
write-numerals|K|number|Match numerals from zero through twenty to quantities|count-to-20|K.CC.A.3
compare-small-groups|K|number|Compare two groups by pairing their objects|count-to-20|K.CC.C.6
compare-numerals|K|number|Order two written numbers through ten|write-numerals|K.CC.C.7
addition-within-10|K|operations|Represent joining and solve sums within ten|count-to-20|K.OA.A.1,K.OA.A.2
subtraction-within-10|K|operations|Represent separating and solve differences within ten|addition-within-10|K.OA.A.1,K.OA.A.2
number-bonds|K|operations|Decompose quantities through ten in multiple ways|addition-within-10|K.OA.A.3
make-ten|K|operations|Find the missing part that completes ten|number-bonds|K.OA.A.4
facts-within-5|K|operations|Recall addition and subtraction facts through five|subtraction-within-10|K.OA.A.5
teen-place-value|K|number|Compose teen numbers from a ten and extra ones|make-ten|K.NBT.A.1
compare-attributes|K|measurement|Compare objects by length weight or capacity||K.MD.A.1,K.MD.A.2
sort-and-count|K|data|Sort objects by an attribute and count each category|count-to-20|K.MD.B.3
name-shapes|K|geometry|Identify flat and solid shapes across orientations||K.G.A.1,K.G.A.2,K.G.A.3
compose-shapes|K|geometry|Build and describe shapes using smaller shapes|name-shapes|K.G.B.4,K.G.B.5,K.G.B.6
addition-within-20|1|operations|Add through twenty using decomposition and making ten|make-ten|1.OA.C.6
subtraction-within-20|1|operations|Subtract through twenty using related addition facts|addition-within-20|1.OA.B.4,1.OA.C.6
addition-stories|1|modeling|Choose an equation for joining comparing or part-whole stories|addition-within-20|1.OA.A.1
three-addends|1|operations|Combine three quantities using useful grouping|addition-within-20|1.OA.A.2,1.OA.B.3
equality|1|algebra|Decide whether both sides of an equation have equal value|addition-within-20|1.OA.D.7
missing-addend|1|algebra|Find an unknown in an addition or subtraction equation|equality,subtraction-within-20|1.OA.D.8
tens-and-ones|1|number|Read write and decompose two-digit quantities|teen-place-value|1.NBT.A.1,1.NBT.B.2
compare-two-digit|1|number|Compare two-digit values using tens and ones|tens-and-ones|1.NBT.B.3
add-two-digit|1|operations|Add a two-digit number using tens and ones|tens-and-ones,addition-within-20|1.NBT.C.4
ten-more-less|1|operations|Find ten more or less without recounting|tens-and-ones|1.NBT.C.5,1.NBT.C.6
measure-equal-units|1|measurement|Measure length with repeated equal units without gaps|compare-attributes|1.MD.A.1,1.MD.A.2
clock-half-hours|1|measurement|Read clocks to the hour and half hour|count-to-100|1.MD.B.3
categorical-data|1|data|Compare category counts and answer questions about a display|sort-and-count|1.MD.C.4
halves-and-quarters|1|fractions|Partition a whole into equal halves and quarters|compose-shapes|1.G.A.3
shape-attributes|1|geometry|Classify shapes by defining attributes|name-shapes|1.G.A.1,1.G.A.2
hundreds-place-value|2|number|Compose and read hundreds tens and ones|tens-and-ones|2.NBT.A.1,2.NBT.A.3
skip-counting|2|number|Count by fives tens and hundreds|count-to-100|2.NBT.A.2
compare-three-digit|2|number|Compare three-digit numbers using place value|hundreds-place-value|2.NBT.A.4
addition-within-100|2|operations|Add within one hundred with regrouping|add-two-digit|2.NBT.B.5
subtraction-within-100|2|operations|Subtract within one hundred with regrouping|addition-within-100,subtraction-within-20|2.NBT.B.5
regroup-hundreds|2|operations|Add and subtract through one thousand using place value|hundreds-place-value,subtraction-within-100|2.NBT.B.7,2.NBT.B.9
multiple-addends|2|operations|Combine several two-digit addends|addition-within-100|2.NBT.B.6
two-step-stories|2|modeling|Represent and solve two-step addition and subtraction stories|addition-stories,subtraction-within-100|2.OA.A.1
addition-facts|2|operations|Recall addition and subtraction facts within twenty|subtraction-within-20|2.OA.B.2
odd-and-even|2|number|Determine parity by pairing or grouping|count-to-20|2.OA.C.3
arrays|2|operations|Count rectangular arrays using equal rows|skip-counting|2.OA.C.4,2.G.A.2
ruler-measurement|2|measurement|Measure and estimate lengths with appropriate units and tools|measure-equal-units|2.MD.A.1,2.MD.A.2,2.MD.A.3,2.MD.A.4
number-line-arithmetic|2|number|Represent sums and differences as number-line moves|subtraction-within-100|2.MD.B.5,2.MD.B.6
clock-five-minutes|2|measurement|Read analog and digital clocks in five-minute intervals|clock-half-hours,skip-counting|2.MD.C.7
money-values|2|measurement|Calculate amounts with common coins and bills|addition-within-100|2.MD.C.8
line-plots|2|data|Display measured lengths on a line plot|ruler-measurement|2.MD.D.9
picture-bar-graphs|2|data|Build and interpret picture and bar graphs|categorical-data|2.MD.D.10
thirds-and-partitions|2|fractions|Recognize equal halves thirds and quarters in varied wholes|halves-and-quarters|2.G.A.3
polygon-properties|2|geometry|Identify polygons and solids by sides angles and faces|shape-attributes|2.G.A.1
multiplication-meaning|3|operations|Represent equal groups with multiplication|arrays|3.OA.A.1
multiplication-facts|3|operations|Recall products of one-digit factors|multiplication-meaning|3.OA.C.7
division-meaning|3|operations|Interpret division as equal sharing and grouping|multiplication-meaning|3.OA.A.2
division-facts|3|operations|Use related multiplication facts to find quotients|division-meaning,multiplication-facts|3.OA.B.6,3.OA.C.7
missing-factor|3|algebra|Find missing factors and quotients|division-facts|3.OA.A.4
operation-properties|3|operations|Use associative commutative and distributive structure|multiplication-meaning|3.OA.B.5
multiplicative-stories|3|modeling|Select multiplication or division to model a story|division-meaning|3.OA.A.3
multi-operation-stories|3|modeling|Solve two-step stories and assess reasonableness|multiplicative-stories,two-step-stories|3.OA.D.8
arithmetic-patterns|3|algebra|Explain patterns in arithmetic tables|multiplication-facts|3.OA.D.9
round-whole-numbers|3|number|Round whole numbers to nearby tens and hundreds|hundreds-place-value|3.NBT.A.1
add-subtract-thousands|3|operations|Add and subtract through one thousand efficiently|regroup-hundreds|3.NBT.A.2
multiply-tens|3|operations|Multiply a one-digit factor by a multiple of ten|multiplication-facts,tens-and-ones|3.NBT.A.3
unit-fractions|3|fractions|Interpret a unit fraction as one equal part of a whole|thirds-and-partitions|3.NF.A.1
fraction-model|3|fractions|Identify the fraction represented by equal shaded parts|unit-fractions|3.NF.A.1
fractions-number-line|3|fractions|Locate fractions on a number line|unit-fractions,number-line-arithmetic|3.NF.A.2
equivalent-fractions|3|fractions|Recognize and justify equivalent fractions|fractions-number-line|3.NF.A.3
compare-fractions|3|fractions|Compare fractions with a common numerator or denominator|equivalent-fractions|3.NF.A.3
elapsed-time|3|measurement|Solve elapsed-time problems to the nearest minute|clock-five-minutes|3.MD.A.1
mass-volume|3|measurement|Solve measurement problems involving mass and liquid volume|multiplicative-stories|3.MD.A.2
scaled-graphs|3|data|Read scaled picture and bar graphs|picture-bar-graphs,multiplication-facts|3.MD.B.3
fraction-line-plots|3|data|Display and interpret fractional length measurements|line-plots,unit-fractions|3.MD.B.4
rectangle-area|3|geometry|Find rectangular area by counting unit squares or multiplying sides|arrays,multiplication-facts|3.MD.C.5,3.MD.C.6,3.MD.C.7
perimeter|3|geometry|Find perimeter and missing side lengths|addition-within-100|3.MD.D.8
quadrilateral-categories|3|geometry|Classify quadrilaterals by shared attributes|polygon-properties|3.G.A.1
partition-area|3|fractions|Relate equal-area partitions to fractions of a whole|rectangle-area,unit-fractions|3.G.A.2
multiplicative-comparison|4|modeling|Distinguish additive and multiplicative comparisons|multiplicative-stories|4.OA.A.1,4.OA.A.2
multistep-whole-stories|4|modeling|Solve multistep stories with remainders and estimates|multi-operation-stories,round-whole-numbers|4.OA.A.3
factors-multiples|4|number|Identify factor pairs multiples primes and composites|division-facts|4.OA.B.4
rule-patterns|4|algebra|Generate and describe number or shape patterns from a rule|arithmetic-patterns|4.OA.C.5
large-place-value|4|number|Read compare and round multidigit whole numbers|round-whole-numbers|4.NBT.A.1,4.NBT.A.2,4.NBT.A.3
whole-add-subtract|4|operations|Use place-value algorithms to add and subtract multidigit numbers|add-subtract-thousands|4.NBT.B.4
whole-multiplication|4|operations|Multiply multidigit values using partial products|multiply-tens,operation-properties|4.NBT.B.5
whole-division|4|operations|Divide multidigit values by a one-digit divisor|division-facts,large-place-value|4.NBT.B.6
fraction-equivalence|4|fractions|Generate equivalent fractions by scaling numerator and denominator|equivalent-fractions,multiplication-facts|4.NF.A.1
fraction-comparison|4|fractions|Compare fractions using benchmarks or common units|fraction-equivalence|4.NF.A.2
like-fraction-addition|4|fractions|Add and subtract fractions with a shared denominator|unit-fractions,addition-within-20|4.NF.B.3
mixed-numbers|4|fractions|Compose decompose and operate on mixed numbers with like denominators|like-fraction-addition|4.NF.B.3
fraction-times-whole|4|fractions|Multiply a fraction by a whole number|multiplication-meaning,unit-fractions|4.NF.B.4
decimal-fractions|4|decimals|Connect tenths hundredths fractions and decimal notation|fraction-equivalence|4.NF.C.5,4.NF.C.6
compare-decimals|4|decimals|Compare decimals through hundredths|decimal-fractions|4.NF.C.7
unit-conversion|4|measurement|Convert larger measurement units to smaller units|whole-multiplication|4.MD.A.1,4.MD.A.2
area-perimeter-models|4|geometry|Use rectangle area and perimeter formulas in context|rectangle-area,perimeter|4.MD.A.3
angle-measure|4|geometry|Measure angles and find sums of adjacent angles|polygon-properties|4.MD.C.5,4.MD.C.6,4.MD.C.7
lines-symmetry|4|geometry|Identify parallel perpendicular and symmetric features|shape-attributes|4.G.A.1,4.G.A.2,4.G.A.3
powers-of-ten|5|number|Explain place-value shifts when multiplying by powers of ten|large-place-value,decimal-fractions|5.NBT.A.1,5.NBT.A.2
decimal-place-value|5|decimals|Read compare and round decimals through thousandths|compare-decimals,round-whole-numbers|5.NBT.A.3,5.NBT.A.4
multidigit-products|5|operations|Multiply multidigit whole numbers using a standard algorithm|whole-multiplication|5.NBT.B.5
multidigit-quotients|5|operations|Divide whole numbers with two-digit divisors|whole-division,multidigit-products|5.NBT.B.6
decimal-arithmetic|5|decimals|Add subtract multiply and divide decimals through hundredths|decimal-place-value,multidigit-quotients|5.NBT.B.7
fraction-addition|5|fractions|Add and subtract unlike-denominator fractions|fraction-equivalence,like-fraction-addition|5.NF.A.1,5.NF.A.2
fraction-as-division|5|fractions|Interpret a fraction as the quotient of two whole numbers|division-meaning,unit-fractions|5.NF.B.3
fraction-multiplication|5|fractions|Multiply fractions and interpret scaling|fraction-times-whole,fraction-equivalence|5.NF.B.4,5.NF.B.5,5.NF.B.6
unit-fraction-division|5|fractions|Divide unit fractions by whole numbers and whole numbers by unit fractions|fraction-as-division|5.NF.B.7
numerical-expressions|5|algebra|Interpret and evaluate grouped numerical expressions|operation-properties|5.OA.A.1,5.OA.A.2
coordinate-first-quadrant|5|geometry|Plot ordered pairs and interpret first-quadrant graphs|number-line-arithmetic|5.G.A.1,5.G.A.2
related-patterns|5|algebra|Compare two numerical patterns using tables and coordinate pairs|rule-patterns,coordinate-first-quadrant|5.OA.B.3
volume-cubes|5|geometry|Interpret volume as a count of unit cubes|rectangle-area|5.MD.C.3,5.MD.C.4
prism-volume|5|geometry|Calculate volume of rectangular prisms and composite solids|volume-cubes,multidigit-products|5.MD.C.5
shape-hierarchy|5|geometry|Organize shapes into categories and subcategories|quadrilateral-categories|5.G.B.3,5.G.B.4
ratios|6|ratio|Represent a ratio and explain the quantities being compared|fraction-as-division|6.RP.A.1
unit-rates|6|ratio|Compute and interpret a unit rate|ratios|6.RP.A.2
ratio-tables|6|ratio|Solve equivalent-ratio problems using tables and double number lines|unit-rates|6.RP.A.3
percentages|6|ratio|Find a percentage of a quantity and recover a missing part or whole|ratio-tables|6.RP.A.3
fraction-division|6|fractions|Divide fractions and interpret quotients in context|fraction-multiplication,unit-fraction-division|6.NS.A.1
integer-division|6|operations|Divide multidigit whole numbers efficiently|multidigit-quotients|6.NS.B.2
decimal-algorithms|6|decimals|Compute accurately with multidigit decimal operations|decimal-arithmetic|6.NS.B.3
gcf-lcm|6|number|Find greatest common factors and least common multiples|factors-multiples|6.NS.B.4
signed-numbers|6|number|Use signed numbers to represent opposite quantities|number-line-arithmetic|6.NS.C.5,6.NS.C.6
absolute-value|6|number|Order signed values and interpret absolute value|signed-numbers|6.NS.C.7
coordinate-four-quadrants|6|geometry|Plot signed coordinate pairs and find aligned distances|signed-numbers,coordinate-first-quadrant|6.NS.C.6,6.NS.C.8
integer-powers|6|algebra|Evaluate whole-number powers|powers-of-ten|6.EE.A.1
variable-expressions|6|algebra|Translate and evaluate expressions with variables|numerical-expressions,integer-powers|6.EE.A.2
expression-properties|6|algebra|Generate equivalent expressions using algebraic properties|variable-expressions|6.EE.A.3,6.EE.A.4
one-step-equations|6|algebra|Solve one-operation equations and check the solution|missing-addend,variable-expressions|6.EE.B.5,6.EE.B.6,6.EE.B.7
simple-inequalities|6|algebra|Represent inequality solutions on a number line|signed-numbers,one-step-equations|6.EE.B.8
dependent-variables|6|algebra|Connect two related quantities in equations tables and graphs|coordinate-first-quadrant,variable-expressions|6.EE.C.9
triangle-area|6|geometry|Find triangle and polygon areas by decomposition|rectangle-area,fraction-multiplication|6.G.A.1
fractional-prism-volume|6|geometry|Calculate prism volume with fractional side lengths|prism-volume,fraction-multiplication|6.G.A.2
coordinate-polygons|6|geometry|Find polygon side lengths from coordinates|coordinate-four-quadrants|6.G.A.3
surface-area|6|geometry|Use nets to calculate surface area of prisms and pyramids|triangle-area,prism-volume|6.G.A.4
statistical-questions|6|data|Identify statistical questions and sources of variation|categorical-data|6.SP.A.1,6.SP.A.2
statistics-mean|6|data|Calculate the arithmetic mean of a finite dataset|decimal-arithmetic|6.SP.B.5
mean-median|6|data|Calculate and interpret mean median and range|decimal-arithmetic|6.SP.A.3,6.SP.B.5
distribution-plots|6|data|Interpret dot plots histograms and box plots|line-plots,mean-median|6.SP.B.4
variability|6|data|Describe spread shape outliers and appropriate summaries|distribution-plots|6.SP.B.5
rational-unit-rates|7|ratio|Calculate unit rates involving fractional quantities|unit-rates,fraction-division|7.RP.A.1
proportional-relationships|7|ratio|Identify and represent proportional relationships|ratio-tables,dependent-variables|7.RP.A.2
percent-change|7|ratio|Solve percent increase decrease markup and interest problems|percentages|7.RP.A.3
signed-addition|7|number|Add and subtract signed rational numbers|signed-numbers,fraction-addition|7.NS.A.1
signed-multiplication|7|number|Multiply and divide signed rational numbers|signed-addition,fraction-division|7.NS.A.2
rational-stories|7|modeling|Solve contextual problems using signed rational arithmetic|signed-multiplication|7.NS.A.3,7.EE.B.3
linear-expressions|7|algebra|Expand and factor linear expressions with rational coefficients|expression-properties,signed-multiplication|7.EE.A.1,7.EE.A.2
two-step-equations|7|algebra|Construct and solve two-step equations|one-step-equations,signed-addition|7.EE.B.4
linear-inequalities|7|algebra|Solve inequalities and interpret direction changes|simple-inequalities,signed-multiplication|7.EE.B.4
scale-drawings|7|geometry|Use scale factors to recover lengths and areas|proportional-relationships,triangle-area|7.G.A.1
triangle-construction|7|geometry|Determine whether side and angle conditions define a triangle|angle-measure|7.G.A.2
solid-cross-sections|7|geometry|Identify plane cross-sections of solids|surface-area|7.G.A.3
circle-measurement|7|geometry|Calculate circle area and circumference|decimal-arithmetic,integer-powers|7.G.B.4
angle-relationships|7|geometry|Solve unknown angles using supplementary vertical and adjacent relationships|angle-measure,two-step-equations|7.G.B.5
composite-measurement|7|geometry|Find area surface area and volume of compound figures|surface-area,fractional-prism-volume|7.G.B.6
sampling|7|data|Explain why sample selection affects population conclusions|statistical-questions|7.SP.A.1,7.SP.A.2
compare-distributions|7|data|Compare centers and spread of two distributions|variability|7.SP.B.3,7.SP.B.4
probability|7|probability|Calculate simple event probabilities and compare observed frequencies|ratios|7.SP.C.5,7.SP.C.6,7.SP.C.7
compound-probability|7|probability|Enumerate compound outcomes with tables trees and simulations|probability|7.SP.C.8
irrational-numbers|8|number|Distinguish rational numbers from irrational numbers|fraction-as-division,decimal-algorithms|8.NS.A.1
approximate-roots|8|number|Approximate roots and compare irrational values|irrational-numbers,integer-powers|8.NS.A.2,8.EE.A.2
exponent-laws|8|algebra|Simplify expressions with integer exponents|integer-powers,signed-multiplication|8.EE.A.1
scientific-notation|8|number|Represent compare and calculate very large or small quantities|exponent-laws|8.EE.A.3,8.EE.A.4
slope|8|algebra|Find and interpret slope from points tables and graphs|proportional-relationships,coordinate-four-quadrants|8.EE.B.5,8.EE.B.6
linear-equations|8|algebra|Solve linear equations with variables on both sides|two-step-equations,linear-expressions|8.EE.C.7
linear-systems|8|algebra|Solve a pair of linear equations and interpret intersections|linear-equations,slope|8.EE.C.8
function-notation|8|functions|Determine whether a relation assigns one output per input|dependent-variables|8.F.A.1
compare-functions|8|functions|Compare function behavior across tables graphs and equations|function-notation,slope|8.F.A.2,8.F.A.3
linear-models|8|modeling|Construct a linear function and interpret its rate and initial value|slope,compare-functions|8.F.B.4
qualitative-graphs|8|functions|Describe increase decrease and linearity in graphs|function-notation|8.F.B.5
rigid-motions|8|geometry|Describe translations rotations and reflections on coordinates|coordinate-four-quadrants|8.G.A.1,8.G.A.2,8.G.A.3
dilations-similarity|8|geometry|Use dilations and rigid motions to establish similarity|rigid-motions,scale-drawings|8.G.A.4
triangle-angle-theorems|8|geometry|Reason about triangle sums exterior angles and parallel lines|angle-relationships|8.G.A.5
pythagorean-theorem|8|geometry|Explain and apply the Pythagorean relationship|approximate-roots,triangle-area|8.G.B.6,8.G.B.7
coordinate-distance|8|geometry|Find distance between two coordinate points|pythagorean-theorem,coordinate-four-quadrants|8.G.B.8
curved-solid-volume|8|geometry|Find volumes of cylinders cones and spheres|circle-measurement,prism-volume|8.G.C.9
scatterplots|8|data|Interpret associations and fit an informal trend line|coordinate-four-quadrants,linear-models|8.SP.A.1,8.SP.A.2,8.SP.A.3
two-way-tables|8|data|Use relative frequencies to investigate association|probability|8.SP.A.4
units-and-precision|algebra-1|modeling|Choose units and justify precision in quantitative models|unit-conversion,scientific-notation|HSN,HSM,SAT.data
expression-structure|algebra-1|algebra|Interpret terms factors and equivalent forms in context|linear-expressions|HSA,SAT.advanced-math
formula-rearrangement|algebra-1|algebra|Rearrange formulas to isolate a chosen variable|linear-equations|HSA,SAT.algebra
linear-equation-modeling|algebra-1|modeling|Construct linear equations from constraints and explain solutions|linear-models,linear-equations|HSA,HSM,SAT.algebra
systems-modeling|algebra-1|modeling|Model simultaneous constraints with equations and inequalities|linear-systems,linear-inequalities|HSA,SAT.algebra
function-domain-range|algebra-1|functions|Identify valid inputs and outputs including contextual restrictions|function-notation|HSF
function-evaluation|algebra-1|functions|Evaluate and interpret function notation|variable-expressions,function-notation|HSF,SAT.algebra
piecewise-functions|algebra-1|functions|Interpret piecewise and absolute-value functions|function-domain-range,function-evaluation|HSF,SAT.advanced-math
arithmetic-sequences|algebra-1|functions|Translate arithmetic sequences between recursive and explicit rules|related-patterns,linear-models|HSF
geometric-sequences|algebra-1|functions|Translate geometric sequences between recursive and explicit rules|exponent-laws|HSF
polynomial-arithmetic|algebra-1|algebra|Add subtract and multiply polynomials|expression-properties,exponent-laws|HSA,SAT.advanced-math
factor-quadratics|algebra-1|algebra|Factor quadratic expressions using structure and products|polynomial-arithmetic|HSA,SAT.advanced-math
quadratic-equations|algebra-1|algebra|Solve quadratic equations and check their real solutions|factor-quadratics,approximate-roots|HSA,SAT.advanced-math
complete-square|algebra-1|algebra|Rewrite quadratics by completing the square|quadratic-equations|HSA,SAT.advanced-math
quadratic-formula|algebra-1|algebra|Use the quadratic formula and interpret the discriminant|complete-square|HSA,SAT.advanced-math
quadratic-graphs|algebra-1|functions|Relate zeros vertex symmetry and intercepts to quadratic forms|quadratic-equations,function-domain-range|HSF,SAT.advanced-math
quadratic-minimum|algebra-1|functions|Find the minimum value of an upward-opening quadratic|quadratic-graphs|HSF,SAT.advanced-math
exponential-models|algebra-1|functions|Build exponential models and compare them with linear models|geometric-sequences,percent-change|HSF,SAT.advanced-math
residuals-correlation|algebra-1|data|Interpret residuals association and limits of correlation|scatterplots|HSS,SAT.data
geometric-definitions|geometry|geometry|Use precise definitions of geometric objects and relations|lines-symmetry|HSG
geometric-proof|geometry|reasoning|Construct and critique deductive geometric arguments|geometric-definitions,triangle-angle-theorems|HSG
congruence-criteria|geometry|geometry|Justify triangle congruence with transformations and criteria|rigid-motions,geometric-proof|HSG
similarity-proofs|geometry|geometry|Justify triangle similarity and proportional side relationships|dilations-similarity,geometric-proof|HSG,SAT.geometry
geometric-constructions|geometry|geometry|Construct bisectors perpendiculars and parallel lines with justified steps|geometric-definitions|HSG
right-triangle-trigonometry|geometry|trigonometry|Use sine cosine and tangent ratios to solve right triangles|similarity-proofs,pythagorean-theorem|HSG,SAT.geometry
special-right-triangles|geometry|trigonometry|Derive and use special right-triangle side ratios|right-triangle-trigonometry|HSG,SAT.geometry
circle-theorems|geometry|geometry|Relate chords tangents arcs and inscribed angles|angle-relationships,geometric-proof|HSG,SAT.geometry
arc-sector-measure|geometry|geometry|Calculate arc length and sector area|circle-measurement,percentages|HSG,SAT.geometry
circle-equations|geometry|geometry|Interpret and construct coordinate equations of circles|coordinate-distance,complete-square|HSG,SAT.geometry
coordinate-proofs|geometry|geometry|Use slopes distances and midpoints to prove geometric claims|slope,coordinate-distance,geometric-proof|HSG
geometric-modeling|geometry|modeling|Choose geometric models for design density and measurement problems|composite-measurement,curved-solid-volume|HSG,HSM
conditional-probability|geometry|probability|Calculate conditional probabilities from tables and sample spaces|compound-probability,two-way-tables|HSS,SAT.data
independent-events|geometry|probability|Distinguish independence from mutually exclusive outcomes|conditional-probability|HSS,SAT.data
rational-exponents|algebra-2|algebra|Connect rational exponents and radicals|exponent-laws,approximate-roots|HSN,SAT.advanced-math
radical-equations|algebra-2|algebra|Solve radical equations and reject extraneous candidates|rational-exponents,quadratic-equations|HSA,SAT.advanced-math
complex-numbers|algebra-2|number|Calculate with complex numbers and solve quadratics over them|quadratic-formula|HSN
polynomial-division|algebra-2|algebra|Divide polynomials and interpret quotient and remainder|polynomial-arithmetic|HSA
polynomial-zeros|algebra-2|algebra|Connect factors zeros and polynomial graphs|polynomial-division,complex-numbers|HSA,HSF,SAT.advanced-math
rational-expressions|algebra-2|algebra|Operate on rational expressions while retaining domain restrictions|factor-quadratics,fraction-division|HSA,SAT.advanced-math
rational-equations|algebra-2|algebra|Solve rational equations and check excluded values|rational-expressions|HSA,SAT.advanced-math
nonlinear-systems|algebra-2|algebra|Solve systems involving linear and nonlinear relations|linear-systems,quadratic-equations|HSA,SAT.advanced-math
function-transformations|algebra-2|functions|Describe shifts scales reflections and symmetry of functions|quadratic-graphs,piecewise-functions|HSF,SAT.advanced-math
function-composition|algebra-2|functions|Compose functions and determine valid inputs|function-domain-range,function-evaluation|HSF
inverse-functions|algebra-2|functions|Find inverses and restrict domains where needed|function-composition|HSF
logarithms|algebra-2|functions|Use logarithms as inverses of exponential functions|exponential-models,inverse-functions|HSF
exponential-equations|algebra-2|algebra|Solve exponential and logarithmic equations with domain checks|logarithms|HSF
sequence-sums|algebra-2|functions|Calculate finite geometric sums and interpret them in context|geometric-sequences|HSA
radians-unit-circle|algebra-2|trigonometry|Connect radians arc length and unit-circle coordinates|arc-sector-measure,special-right-triangles|HSF,SAT.geometry
trigonometric-graphs|algebra-2|trigonometry|Interpret period amplitude phase and midline|radians-unit-circle,function-transformations|HSF
normal-distributions|algebra-2|data|Use mean and standard deviation to interpret normal models|variability|HSS
study-design|algebra-2|data|Distinguish observational studies experiments and sampling designs|sampling|HSS,SAT.data
statistical-inference|algebra-2|data|Interpret sampling variability margin of error and supported claims|study-design,compare-distributions|HSS,SAT.data
expected-value|algebra-2|probability|Use weighted outcomes to compare decisions|conditional-probability|HSS
polynomial-behavior|precalculus|functions|Analyze polynomial end behavior multiplicities and turning behavior|polynomial-zeros|HSF
rational-function-behavior|precalculus|functions|Analyze holes asymptotes intercepts and domain of rational functions|rational-expressions,function-domain-range|HSF
inverse-trigonometry|precalculus|trigonometry|Interpret inverse trigonometric functions with restricted domains|inverse-functions,trigonometric-graphs|HSF
trigonometric-identities|precalculus|trigonometry|Establish and use Pythagorean and angle-sum identities|radians-unit-circle,geometric-proof|HSF
trigonometric-equations|precalculus|trigonometry|Solve trigonometric equations on specified intervals|inverse-trigonometry,trigonometric-identities|HSF
oblique-triangles|precalculus|trigonometry|Use the laws of sines and cosines with ambiguity checks|right-triangle-trigonometry|HSG
vectors|precalculus|number|Represent add and scale vectors and interpret components|coordinate-distance,right-triangle-trigonometry|HSN
matrices|precalculus|number|Perform matrix operations and represent linear transformations|linear-systems,vectors|HSN
complex-plane|precalculus|number|Represent complex values geometrically and interpret operations|complex-numbers,radians-unit-circle|HSN
conic-sections|precalculus|geometry|Connect conic equations to geometric definitions|circle-equations,complete-square|HSG
parametric-models|precalculus|modeling|Describe motion using paired functions of a parameter|function-composition,vectors|HSM
polar-coordinates|precalculus|trigonometry|Translate between polar and Cartesian coordinates|radians-unit-circle,coordinate-distance|
model-validation|precalculus|modeling|Compare model predictions to evidence and communicate limitations|exponential-models,statistical-inference|HSM
`;

export const skills: Skill[] = outline.trim().split('\n').map(line => {
  const parts = line.split('|');
  if (parts.length !== 6) throw new Error(`Invalid skill row: ${line}`);
  const [id, gradeBand, strand, description, dependencies, references] = parts as [string, GradeBand, string, string, string, string];
  return {
    id, title: id.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' '),
    description, gradeBand, strand, prerequisites: dependencies ? dependencies.split(',') : [],
    prerequisiteBasis: 'editorial', status: 'planned', lessonId: `lesson.${id}`,
    alignments: references ? references.split(',').map(standardId => ({ standardId, facet: description, basis: 'editorial' as const })) : [],
    facets: [{ id: `${id}.core`, description, status: 'planned' }],
  };
});
