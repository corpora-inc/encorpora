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
counting-arithmetic|1|operations|Connect counting forward and backward to addition and subtraction|count-to-100,addition-within-20|1.OA.C.5
mental-tens-hundreds|2|operations|Mentally add or subtract ten or one hundred within one thousand|hundreds-place-value|2.NBT.B.8
fraction-plot-arithmetic|4|data|Solve addition and subtraction questions from fractional measurement plots|fraction-line-plots,like-fraction-addition|4.MD.B.4
measurement-conversions|5|measurement|Convert measurements within one system in multistep problems|unit-conversion,decimal-arithmetic|5.MD.A.1
fraction-plot-computation|5|data|Use fraction operations to solve problems from measurement line plots|fraction-plot-arithmetic,fraction-addition|5.MD.B.2
complex-conjugates|precalculus|number|Use conjugates to compute complex quotients and moduli|complex-numbers|
complex-distance|precalculus|number|Find complex-plane distances and midpoints using differences and averages|complex-plane|
complex-factorization|precalculus|algebra|Extend factorization identities to complex coefficients|complex-numbers,polynomial-arithmetic|
fundamental-theorem-algebra|precalculus|algebra|Explain polynomial root existence and verify the quadratic case|complex-factorization|
model-quantities|algebra-1|modeling|Define measurable quantities and their roles before constructing a model|units-and-precision|
number-system-closure|algebra-2|reasoning|Justify rational and irrational sums and products including nonzero restrictions|irrational-numbers|
vector-modeling|precalculus|modeling|Resolve and combine velocity or force quantities with vectors|vectors|
matrix-data|precalculus|number|Organize quantities in matrices and interpret rows columns and entries|two-way-tables|
matrix-properties|precalculus|reasoning|Demonstrate matrix noncommutativity and justify associative and distributive operations|matrices|
matrix-inverses|precalculus|algebra|Use identity matrices and determinants to determine and compute inverses|matrices|
matrix-transformations|precalculus|geometry|Apply matrices to vectors and connect determinants with area changes|matrices,vectors|
polynomial-identities|algebra-2|reasoning|Prove polynomial identities and use them to establish numerical relationships|polynomial-arithmetic|
binomial-theorem|precalculus|algebra|Expand integer powers of binomials using combinatorial coefficients|polynomial-arithmetic|
nonlinear-equation-modeling|algebra-2|modeling|Construct quadratic rational and exponential constraints with valid contextual domains|quadratic-equations,rational-equations,exponential-models|
equation-reasoning|algebra-1|reasoning|Justify each equation transformation by equality-preserving operations|linear-equations|
symbolic-linear-constraints|algebra-1|algebra|Solve linear equations and inequalities with literal coefficients and state exceptional cases|linear-equations,linear-inequalities|
elimination-proof|algebra-1|reasoning|Prove that elimination preserves a linear system's solution set|linear-systems,equation-reasoning|
matrix-systems|precalculus|algebra|Represent systems as matrix equations and solve using inverses where possible|matrix-inverses,linear-systems|
graph-solution-sets|algebra-1|algebra|Interpret equation graphs as all ordered pairs satisfying the equation|coordinate-four-quadrants,linear-equations|
graphical-equation-solving|algebra-2|algebra|Approximate intersections using graphs tables and successive refinement|graph-solution-sets,quadratic-graphs|
inequality-regions|algebra-1|algebra|Graph intersecting half-planes with correct boundary inclusion|linear-inequalities,slope|
average-rate-change|algebra-1|functions|Calculate and interpret interval-average rates from graphs tables and formulas|slope,function-evaluation|
cross-representation-comparison|algebra-2|functions|Compare nonlinear functions given by different representations|compare-functions,quadratic-graphs|
growth-comparison|algebra-2|functions|Justify linear versus exponential growth and compare eventual polynomial growth|exponential-models,polynomial-zeros|
special-angle-values|precalculus|trigonometry|Derive exact special-angle values and related quadrant values geometrically|special-right-triangles,radians-unit-circle|
trigonometric-symmetry|precalculus|trigonometry|Explain odd even and periodic trigonometric relationships using the unit circle|radians-unit-circle|
periodic-modeling|algebra-2|modeling|Choose trigonometric models with appropriate amplitude frequency and midline|trigonometric-graphs|
circle-similarity|geometry|reasoning|Prove circle similarity using translations and dilation|similarity-proofs|
triangle-circles|geometry|geometry|Construct triangle incircles and circumcircles and prove cyclic angle properties|geometric-constructions,circle-theorems|
tangent-construction|geometry|geometry|Construct tangents from an exterior point and justify perpendicular radii|geometric-constructions,circle-theorems|
transformation-invariants|geometry|geometry|Define plane motions and compare distance and angle preservation|rigid-motions,geometric-definitions|
polygon-symmetries|geometry|geometry|Describe rotations and reflections preserving a polygon|rigid-motions|
transformation-constructions|geometry|geometry|Construct transformed figures and describe compositions carrying one figure to another|transformation-invariants|
line-angle-proofs|geometry|reasoning|Prove vertical-angle parallel-line and perpendicular-bisector relationships|geometric-proof|
triangle-proofs|geometry|reasoning|Prove triangle-angle base-angle midsegment and median relationships|geometric-proof,congruence-criteria|
parallelogram-proofs|geometry|reasoning|Prove parallelogram and rectangle side angle and diagonal properties|geometric-proof,congruence-criteria|
inscribed-polygons|geometry|geometry|Construct equilateral triangles squares and regular hexagons in circles|geometric-constructions|
measurement-formula-proofs|geometry|reasoning|Justify circle cylinder cone and pyramid formulas using dissection and comparison|geometric-proof,circle-measurement,prism-volume|
cavalieri-principle|geometry|reasoning|Use equal cross-sectional areas to justify solid volumes including spheres|measurement-formula-proofs|
solid-volume-models|geometry|modeling|Solve contextual cylinder pyramid cone and sphere volume problems|curved-solid-volume,surface-area|
sections-and-revolutions|geometry|geometry|Relate plane slices and rotations of plane figures to three-dimensional solids|solid-cross-sections|
parabola-locus|geometry|geometry|Derive a parabola equation from equal focus and directrix distances|coordinate-distance,quadratic-graphs|
slope-proofs|geometry|reasoning|Prove parallel and perpendicular slope criteria and construct corresponding lines|coordinate-proofs|
segment-division|geometry|geometry|Find a directed segment's internal or external proportional division point|coordinate-four-quadrants,ratios|
coordinate-measurement|geometry|geometry|Use coordinates to compute polygon perimeters and areas|coordinate-distance,triangle-area|
density-modeling|geometry|modeling|Model density using area or volume with consistent units|units-and-precision,geometric-modeling|
geometric-design|geometry|modeling|Construct and compare geometric designs under stated constraints|geometric-modeling,systems-modeling|
dilation-properties|geometry|geometry|Investigate how dilation changes lengths lines and parallelism|dilations-similarity|
similarity-theorems|geometry|reasoning|Prove proportional-side and Pythagorean results using triangle similarity|similarity-proofs|
complementary-trigonometry|geometry|trigonometry|Explain and use sine cosine relationships for complementary angles|right-triangle-trigonometry|
trigonometric-area|precalculus|trigonometry|Derive and apply the two-sides-and-included-angle triangle area formula|right-triangle-trigonometry,triangle-area|
triangle-law-proofs|precalculus|reasoning|Derive sine and cosine laws and justify their applicability|trigonometric-area,pythagorean-theorem|
event-sets|geometry|probability|Represent unions intersections and complements within a sample space|compound-probability|
probability-addition|geometry|probability|Calculate unions using addition with an overlap correction|event-sets|
probability-multiplication|precalculus|probability|Apply conditional product rules and interpret joint-event probabilities|conditional-probability|
permutations-combinations|precalculus|probability|Count ordered and unordered selections to compute compound probabilities|compound-probability|
simulation-model-checks|algebra-2|data|Simulate a proposed random process and assess consistency with observations|probability,sampling|
sampling-margin-error|algebra-2|data|Estimate population means or proportions and simulate sampling margins of error|statistical-inference,simulation-model-checks|
randomization-tests|algebra-2|data|Use randomization simulations to compare treatments and assess observed differences|study-design,simulation-model-checks|
statistical-report-critique|algebra-2|reasoning|Evaluate reports for sampling bias uncertainty and unsupported causal claims|statistical-inference,study-design|
statistical-summary-comparison|algebra-1|data|Compare distribution shapes center IQR and standard deviation with outlier context|compare-distributions|
categorical-association|algebra-1|data|Interpret joint marginal and conditional relative frequencies in two-way tables|two-way-tables|
regression-interpretation|algebra-1|data|Interpret fitted slopes and intercepts using quantities and units in context|linear-models,scatterplots|
causal-claims|algebra-1|reasoning|Distinguish association from evidence that supports a causal explanation|study-design,residuals-correlation|
random-variables|precalculus|probability|Define a numerical random variable and graph its probability distribution|compound-probability,distribution-plots|
theoretical-distributions|precalculus|probability|Construct theoretical discrete distributions and compute their expectations|random-variables,expected-value|
empirical-distributions|precalculus|probability|Estimate distributions from observed frequencies and compute expectations|random-variables,expected-value|
fair-random-decisions|precalculus|probability|Design random selection procedures and justify fairness|probability|
decision-strategies|precalculus|modeling|Compare uncertain strategies using probabilities payoffs and model assumptions|expected-value,conditional-probability|
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

/** Numbered high-school inventory, checked against each official category page on 2026-10-16.
 * Short labels describe planned facets; the linked source owns all qualifications and components.
 */
const highSchoolRows: [string, string, string, boolean][] = [
  ["HSN.CN.A.1", "Complex number representation", "complex-numbers", false],
  ["HSN.CN.A.2", "Complex arithmetic", "complex-numbers", false],
  ["HSN.CN.A.3", "Conjugates moduli and quotients", "complex-conjugates", true],
  ["HSN.CN.B.4", "Rectangular and polar forms", "complex-plane", true],
  ["HSN.CN.B.5", "Geometric complex arithmetic", "complex-plane", true],
  ["HSN.CN.B.6", "Complex distance and midpoint", "complex-distance", true],
  ["HSN.CN.C.7", "Nonreal quadratic roots", "complex-numbers", false],
  ["HSN.CN.C.8", "Complex polynomial identities", "complex-factorization", true],
  ["HSN.CN.C.9", "Polynomial root existence", "fundamental-theorem-algebra", true],
  ["HSN.Q.A.1", "Units scales and origins", "units-and-precision", false],
  ["HSN.Q.A.2", "Choose modeling quantities", "model-quantities", false],
  ["HSN.Q.A.3", "Measurement precision", "units-and-precision", false],
  ["HSN.RN.A.1", "Justify rational powers", "rational-exponents", false],
  ["HSN.RN.A.2", "Rewrite radicals and powers", "rational-exponents", false],
  ["HSN.RN.B.3", "Rational irrational closure", "number-system-closure", false],
  ["HSN.VM.A.1", "Vector magnitude and direction", "vectors", true],
  ["HSN.VM.A.2", "Coordinate vector components", "vectors", true],
  ["HSN.VM.A.3", "Vector quantity models", "vector-modeling", true],
  ["HSN.VM.B.4", "Vector sums and differences", "vectors", true],
  ["HSN.VM.B.5", "Scalar vector products", "vectors", true],
  ["HSN.VM.C.6", "Matrix data representations", "matrix-data", true],
  ["HSN.VM.C.7", "Scalar matrix products", "matrices", true],
  ["HSN.VM.C.8", "Matrix sums and products", "matrices", true],
  ["HSN.VM.C.9", "Matrix operation laws", "matrix-properties", true],
  ["HSN.VM.C.10", "Identities inverses and determinants", "matrix-inverses", true],
  ["HSN.VM.C.11", "Matrix vector transformations", "matrix-transformations", true],
  ["HSN.VM.C.12", "Determinants and transformed area", "matrix-transformations", true],
  ["HSA.APR.A.1", "Polynomial operations and closure", "polynomial-arithmetic", false],
  ["HSA.APR.B.2", "Remainders and factor theorem", "polynomial-division", false],
  ["HSA.APR.B.3", "Zeros and graph sketches", "polynomial-zeros", false],
  ["HSA.APR.C.4", "Prove polynomial identities", "polynomial-identities", false],
  ["HSA.APR.C.5", "Binomial expansion", "binomial-theorem", true],
  ["HSA.APR.D.6", "Polynomial quotient remainder forms", "polynomial-division", false],
  ["HSA.APR.D.7", "Rational expression arithmetic", "rational-expressions", true],
  ["HSA.CED.A.1", "Model single-variable constraints", "linear-equation-modeling,nonlinear-equation-modeling", false],
  ["HSA.CED.A.2", "Model related quantities graphically", "linear-equation-modeling,nonlinear-equation-modeling", false],
  ["HSA.CED.A.3", "Interpret feasible constraints", "systems-modeling", false],
  ["HSA.CED.A.4", "Isolate formula variables", "formula-rearrangement", false],
  ["HSA.REI.A.1", "Justify equation transformations", "equation-reasoning", false],
  ["HSA.REI.A.2", "Detect extraneous solutions", "radical-equations,rational-equations", false],
  ["HSA.REI.B.3", "Solve symbolic linear constraints", "symbolic-linear-constraints", false],
  ["HSA.REI.B.4", "Solve and justify quadratics", "quadratic-equations,complete-square,quadratic-formula,complex-numbers", false],
  ["HSA.REI.C.5", "Justify elimination equivalence", "elimination-proof", false],
  ["HSA.REI.C.6", "Exact approximate linear systems", "linear-systems", false],
  ["HSA.REI.C.7", "Linear quadratic intersections", "nonlinear-systems", false],
  ["HSA.REI.C.8", "Matrix system representation", "matrix-systems", true],
  ["HSA.REI.C.9", "Inverse matrix solutions", "matrix-systems", true],
  ["HSA.REI.D.10", "Graphs as solution sets", "graph-solution-sets", false],
  ["HSA.REI.D.11", "Approximate graph intersections", "graphical-equation-solving", false],
  ["HSA.REI.D.12", "Half-plane solution regions", "inequality-regions", false],
  ["HSA.SSE.A.1", "Interpret expression parts", "expression-structure", false],
  ["HSA.SSE.A.2", "Rewrite through structural recognition", "expression-structure,factor-quadratics", false],
  ["HSA.SSE.B.3", "Reveal properties through equivalence", "factor-quadratics,complete-square,quadratic-minimum,exponential-models", false],
  ["HSA.SSE.B.4", "Derive geometric series sums", "sequence-sums", false],
  ["HSF.BF.A.1", "Build and combine functions", "function-composition,nonlinear-equation-modeling", false],
  ["HSF.BF.A.2", "Recursive explicit sequence models", "arithmetic-sequences,geometric-sequences", false],
  ["HSF.BF.B.3", "Function changes and symmetry", "function-transformations", false],
  ["HSF.BF.B.4", "Verify and restrict inverses", "inverse-functions", false],
  ["HSF.BF.B.5", "Exponential logarithmic inverses", "logarithms,exponential-equations", true],
  ["HSF.IF.A.1", "Unique outputs and domains", "function-domain-range", false],
  ["HSF.IF.A.2", "Evaluate contextual function notation", "function-evaluation", false],
  ["HSF.IF.A.3", "Sequences as discrete functions", "arithmetic-sequences,geometric-sequences", false],
  ["HSF.IF.B.4", "Interpret contextual graph features", "quadratic-graphs,rational-function-behavior,polynomial-behavior,trigonometric-graphs", false],
  ["HSF.IF.B.5", "Contextual domain restrictions", "function-domain-range", false],
  ["HSF.IF.B.6", "Average rates of change", "average-rate-change", false],
  ["HSF.IF.C.7", "Graph diverse function families", "piecewise-functions,quadratic-graphs,rational-function-behavior,polynomial-behavior,trigonometric-graphs,logarithms", false],
  ["HSF.IF.C.8", "Equivalent function representations", "quadratic-graphs,exponential-models", false],
  ["HSF.IF.C.9", "Compare varied function representations", "cross-representation-comparison", false],
  ["HSF.LE.A.1", "Distinguish growth mechanisms", "growth-comparison", false],
  ["HSF.LE.A.2", "Construct growth models", "exponential-models,arithmetic-sequences,geometric-sequences", false],
  ["HSF.LE.A.3", "Compare eventual growth", "growth-comparison", false],
  ["HSF.LE.A.4", "Logarithmic exponential solutions", "exponential-equations", false],
  ["HSF.LE.B.5", "Interpret model parameters", "exponential-models,linear-equation-modeling", false],
  ["HSF.TF.A.1", "Radians from unit arcs", "radians-unit-circle", false],
  ["HSF.TF.A.2", "Extend circle-based trigonometry", "radians-unit-circle", false],
  ["HSF.TF.A.3", "Special-angle circle values", "special-angle-values", true],
  ["HSF.TF.A.4", "Trigonometric parity and periodicity", "trigonometric-symmetry", true],
  ["HSF.TF.B.5", "Periodic function models", "periodic-modeling", false],
  ["HSF.TF.B.6", "Restricted trigonometric inverses", "inverse-trigonometry", true],
  ["HSF.TF.B.7", "Contextual inverse trigonometry", "trigonometric-equations", true],
  ["HSF.TF.C.8", "Prove Pythagorean identity", "trigonometric-identities", false],
  ["HSF.TF.C.9", "Derive angle-sum identities", "trigonometric-identities", true],
  ["HSG.C.A.1", "Circle similarity proof", "circle-similarity", false],
  ["HSG.C.A.2", "Chord tangent arc relationships", "circle-theorems", false],
  ["HSG.C.A.3", "Circle constructions cyclic quadrilaterals", "triangle-circles", false],
  ["HSG.C.A.4", "External tangent construction", "tangent-construction", true],
  ["HSG.C.B.5", "Derive arc sector formulas", "arc-sector-measure", false],
  ["HSG.CO.A.1", "Foundational geometric definitions", "geometric-definitions", false],
  ["HSG.CO.A.2", "Compare transformation invariants", "transformation-invariants", false],
  ["HSG.CO.A.3", "Polygon symmetries", "polygon-symmetries", false],
  ["HSG.CO.A.4", "Define plane motions", "transformation-invariants", false],
  ["HSG.CO.A.5", "Construct composed motions", "transformation-constructions", false],
  ["HSG.CO.B.6", "Congruence through rigid motions", "congruence-criteria", false],
  ["HSG.CO.B.7", "Triangle congruence correspondence", "congruence-criteria", false],
  ["HSG.CO.B.8", "Derive triangle congruence criteria", "congruence-criteria", false],
  ["HSG.CO.C.9", "Prove line angle theorems", "line-angle-proofs", false],
  ["HSG.CO.C.10", "Prove triangle theorems", "triangle-proofs", false],
  ["HSG.CO.C.11", "Prove parallelogram theorems", "parallelogram-proofs", false],
  ["HSG.CO.D.12", "Justified geometric constructions", "geometric-constructions", false],
  ["HSG.CO.D.13", "Construct inscribed regular polygons", "inscribed-polygons", false],
  ["HSG.GMD.A.1", "Justify measurement formulas", "measurement-formula-proofs", false],
  ["HSG.GMD.A.2", "Cavalieri volume reasoning", "cavalieri-principle", true],
  ["HSG.GMD.A.3", "Apply solid volume formulas", "solid-volume-models", false],
  ["HSG.GMD.B.4", "Sections and rotational solids", "sections-and-revolutions", false],
  ["HSG.GPE.A.1", "Derive coordinate circles", "circle-equations", false],
  ["HSG.GPE.A.2", "Focus directrix parabolas", "parabola-locus", false],
  ["HSG.GPE.A.3", "Ellipse hyperbola focal definitions", "conic-sections", true],
  ["HSG.GPE.B.4", "Algebraic geometric proofs", "coordinate-proofs", false],
  ["HSG.GPE.B.5", "Prove perpendicular parallel slopes", "slope-proofs", false],
  ["HSG.GPE.B.6", "Directed segment partitions", "segment-division", false],
  ["HSG.GPE.B.7", "Coordinate perimeter and area", "coordinate-measurement", false],
  ["HSG.MG.A.1", "Choose geometric object models", "geometric-modeling", false],
  ["HSG.MG.A.2", "Area volume density models", "density-modeling", false],
  ["HSG.MG.A.3", "Constrained geometric design", "geometric-design", false],
  ["HSG.SRT.A.1", "Investigate dilation properties", "dilation-properties", false],
  ["HSG.SRT.A.2", "Similarity through transformations", "similarity-proofs", false],
  ["HSG.SRT.A.3", "Derive angle-angle similarity", "similarity-proofs", false],
  ["HSG.SRT.B.4", "Prove proportional triangle theorems", "similarity-theorems", false],
  ["HSG.SRT.B.5", "Apply similarity and congruence", "similarity-proofs,congruence-criteria", false],
  ["HSG.SRT.C.6", "Define ratios through similarity", "right-triangle-trigonometry", false],
  ["HSG.SRT.C.7", "Complementary trigonometric relationships", "complementary-trigonometry", false],
  ["HSG.SRT.C.8", "Applied right-triangle solutions", "right-triangle-trigonometry,special-right-triangles", false],
  ["HSG.SRT.D.9", "Derive trigonometric area", "trigonometric-area", true],
  ["HSG.SRT.D.10", "Prove sine cosine laws", "triangle-law-proofs", true],
  ["HSG.SRT.D.11", "Apply oblique triangle laws", "oblique-triangles", true],
  ["HSS.CP.A.1", "Event set operations", "event-sets", false],
  ["HSS.CP.A.2", "Independence product criterion", "independent-events", false],
  ["HSS.CP.A.3", "Conditioning and independence", "conditional-probability,independent-events", false],
  ["HSS.CP.A.4", "Table-based conditional probabilities", "conditional-probability", false],
  ["HSS.CP.A.5", "Explain everyday conditioning", "conditional-probability", false],
  ["HSS.CP.B.6", "Conditional event fractions", "conditional-probability", false],
  ["HSS.CP.B.7", "Overlapping event addition", "probability-addition", false],
  ["HSS.CP.B.8", "Conditional product rule", "probability-multiplication", true],
  ["HSS.CP.B.9", "Counting-based compound probability", "permutations-combinations", true],
  ["HSS.IC.A.1", "Random-sample population inference", "statistical-inference", false],
  ["HSS.IC.A.2", "Simulate model consistency", "simulation-model-checks", false],
  ["HSS.IC.B.3", "Randomization and study types", "study-design", false],
  ["HSS.IC.B.4", "Simulated sampling error", "sampling-margin-error", false],
  ["HSS.IC.B.5", "Randomized treatment comparisons", "randomization-tests", false],
  ["HSS.IC.B.6", "Critique statistical reports", "statistical-report-critique", false],
  ["HSS.ID.A.1", "Plot numerical distributions", "distribution-plots", false],
  ["HSS.ID.A.2", "Compare appropriate summary statistics", "statistical-summary-comparison", false],
  ["HSS.ID.A.3", "Interpret distributions and outliers", "statistical-summary-comparison", false],
  ["HSS.ID.A.4", "Assess normal-model fit", "normal-distributions", false],
  ["HSS.ID.B.5", "Interpret joint marginal frequencies", "categorical-association", false],
  ["HSS.ID.B.6", "Bivariate models and residuals", "residuals-correlation", false],
  ["HSS.ID.C.7", "Contextual regression coefficients", "regression-interpretation", false],
  ["HSS.ID.C.8", "Compute interpret correlation", "residuals-correlation", false],
  ["HSS.ID.C.9", "Association versus causation", "causal-claims", false],
  ["HSS.MD.A.1", "Random variables and distributions", "random-variables", true],
  ["HSS.MD.A.2", "Expected distribution values", "expected-value", true],
  ["HSS.MD.A.3", "Theoretical probability distributions", "theoretical-distributions", true],
  ["HSS.MD.A.4", "Empirical probability distributions", "empirical-distributions", true],
  ["HSS.MD.B.5", "Expected payoff decisions", "expected-value", true],
  ["HSS.MD.B.6", "Randomized fair decisions", "fair-random-decisions", true],
  ["HSS.MD.B.7", "Analyze probabilistic strategies", "decision-strategies", true],
];

const editorialDomains = new Set(['HSN', 'HSA', 'HSF', 'HSG', 'HSS']);
for (const skill of skills) skill.alignments = skill.alignments.filter(a => !editorialDomains.has(a.standardId));
for (const [id, description, skillIds, advanced] of highSchoolRows) {
  standards.push({ id, description, framework: 'CCSS', scope: 'standard',
    sourceUrl: `https://www.thecorestandards.org/Math/Content/${id.replaceAll('.', '/')}/`,
    sourceReviewedAt: '2026-10-16', advanced });
  for (const skillId of skillIds.split(',')) {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) throw new Error(`Missing crosswalk skill ${skillId}`);
    skill.alignments.push({ standardId: id, facet: description, basis: 'editorial' });
    skill.facets.push({ id: `${skillId}.${id}`, description, status: 'planned' });
  }
}

/** Independent numbered cluster ranges catch accidental omissions, additions and wrong cluster letters. */
export const highSchoolInventory = {
  HSN: 'CN.A:1-3 CN.B:4-6 CN.C:7-9 Q.A:1-3 RN.A:1-2 RN.B:3 VM.A:1-3 VM.B:4-5 VM.C:6-12',
  HSA: 'APR.A:1 APR.B:2-3 APR.C:4-5 APR.D:6-7 CED.A:1-4 REI.A:1-2 REI.B:3-4 REI.C:5-9 REI.D:10-12 SSE.A:1-2 SSE.B:3-4',
  HSF: 'BF.A:1-2 BF.B:3-5 IF.A:1-3 IF.B:4-6 IF.C:7-9 LE.A:1-4 LE.B:5 TF.A:1-4 TF.B:5-7 TF.C:8-9',
  HSG: 'C.A:1-4 C.B:5 CO.A:1-5 CO.B:6-8 CO.C:9-11 CO.D:12-13 GMD.A:1-3 GMD.B:4 GPE.A:1-3 GPE.B:4-7 MG.A:1-3 SRT.A:1-3 SRT.B:4-5 SRT.C:6-8 SRT.D:9-11',
  HSS: 'CP.A:1-5 CP.B:6-9 IC.A:1-2 IC.B:3-6 ID.A:1-4 ID.B:5-6 ID.C:7-9 MD.A:1-4 MD.B:5-7',
} as const;
export const expectedHighSchoolStandardIds = Object.entries(highSchoolInventory).flatMap(([category, clusters]) =>
  clusters.split(' ').flatMap(cluster => {
    const [prefix, range] = cluster.split(':') as [string, string];
    const [first, last = first] = range.split('-').map(Number) as [number, number?];
    return Array.from({ length: last - first + 1 }, (_, i) => `${category}.${prefix}.${first + i}`);
  }));
