/** Original concise navigation summaries, not replacement standards text.
 * CCSS identifiers and domain ordering checked against the official pages, 2026-09-27.
 * Full requirements, examples and qualifications remain at each sourceUrl.
 */
export interface Standard { id: string; grade: 'K' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; domain: string; summary: string; components: string[]; sourceUrl: string }
// Each row: grade/domain, ordered cluster letters, original summaries by number.
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
const components: Record<string, string> = {
 'K.CC.B.4':'abc','1.NBT.B.2':'abc','2.NBT.A.1':'ab','3.NF.A.2':'ab','3.NF.A.3':'abcd',
 '3.MD.C.5':'ab','3.MD.C.7':'abcd','4.NF.B.3':'abcd','4.NF.B.4':'abc','4.MD.C.5':'ab',
 '5.NBT.A.3':'ab','5.NF.B.4':'ab','5.NF.B.5':'ab','5.NF.B.7':'abc','5.MD.C.3':'ab','5.MD.C.5':'abc',
 '6.RP.A.3':'abcd','6.NS.C.6':'abc','6.NS.C.7':'abcd','6.EE.A.2':'abc','6.SP.B.5':'abcd',
 '7.RP.A.2':'abcd','7.NS.A.1':'abcd','7.NS.A.2':'abcd','7.EE.B.4':'ab','7.SP.C.7':'ab','7.SP.C.8':'abc',
 '8.EE.C.7':'ab','8.EE.C.8':'abc','8.G.A.1':'abc',
};
export const standards: Standard[] = rows.flatMap(([path, clusters, text]) => {
 const [grade, domain] = path.split('/');
 const summaries = text.split('|');
 if (summaries.length !== clusters.length) throw new Error(`Invalid standards row: ${path}`);
 return summaries.map((summary, i) => {
  const id = `${grade}.${domain}.${clusters[i]}.${i + 1}`;
  return { id, grade: grade === 'K' ? 'K' : Number(grade) as Standard['grade'], domain, summary,
   components: [...(components[id] ?? '')].map(letter => `${id}.${letter}`),
   sourceUrl: `https://www.thecorestandards.org/Math/Content/${path}/` };
 });
});
export const standardsVersion = 'ccss-math-k8-aha-2026-09-27';
