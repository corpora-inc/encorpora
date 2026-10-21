/** Exposure budgets are editorial curriculum objectives, independent of graph
 * granularity and generator count. Append micro-skills to an existing objective;
 * adding an objective is an intentional change to the curriculum mix. */
export interface SelectionObjective {
  id: string;
  importance: number;
  /** Relative editorial assessment emphasis, NOT an observed test frequency. */
  assessmentEmphasis: number;
  basis: "editorial";
  skills: readonly string[];
}
export const CURRICULUM_MIX_VERSION = "2026-10-21.1";
// objective | instructional importance | assessment emphasis | member skills
// 6 = central, 3 = regular, 1 = extension; intermediate values are intentional.
const rows = `
counting|6|6|count-to-20,count-to-100,write-numerals,compare-small-groups,compare-numerals,skip-counting,odd-and-even
place-value|6|6|teen-place-value,tens-and-ones,compare-two-digit,hundreds-place-value,compare-three-digit,ten-more-less,large-place-value,powers-of-ten,round-whole-numbers
addition-subtraction|6|6|addition-within-10,subtraction-within-10,number-bonds,make-ten,facts-within-5,addition-within-20,subtraction-within-20,three-addends,add-two-digit,addition-within-100,subtraction-within-100,regroup-hundreds,multiple-addends,addition-facts,number-line-arithmetic,add-subtract-thousands,whole-add-subtract,counting-arithmetic,mental-tens-hundreds
multiplication-division|6|6|arrays,multiplication-meaning,multiplication-facts,division-meaning,division-facts,operation-properties,multiply-tens,whole-multiplication,whole-division,multidigit-products,multidigit-quotients,integer-division
arithmetic-modeling|5|5|addition-stories,two-step-stories,multiplicative-stories,multi-operation-stories,multiplicative-comparison,multistep-whole-stories,rational-stories
fraction-meaning|6|6|halves-and-quarters,thirds-and-partitions,unit-fractions,fraction-model,fractions-number-line,equivalent-fractions,compare-fractions,partition-area,fraction-equivalence,fraction-comparison,mixed-numbers,fraction-as-division
fraction-operations|6|6|like-fraction-addition,fraction-times-whole,fraction-addition,fraction-multiplication,unit-fraction-division,fraction-division,complex-fractions
decimals|6|6|decimal-fractions,compare-decimals,decimal-place-value,decimal-arithmetic,decimal-algorithms
number-structure|3|3|factors-multiples,gcf-lcm,irrational-numbers,approximate-roots,scientific-notation,number-system-closure
signed-numbers|5|5|signed-numbers,absolute-value,signed-addition,signed-multiplication
measurement|4|4|compare-attributes,measure-equal-units,ruler-measurement,mass-volume,unit-conversion,measurement-conversions,units-and-precision
clock-money|3|3|clock-half-hours,clock-five-minutes,money-values,elapsed-time
shape-properties|3|3|name-shapes,compose-shapes,shape-attributes,polygon-properties,quadrilateral-categories,shape-hierarchy,geometric-definitions
area-volume|5|5|rectangle-area,perimeter,area-perimeter-models,volume-cubes,prism-volume,triangle-area,fractional-prism-volume,surface-area,circle-measurement,composite-measurement,curved-solid-volume,solid-volume-models,coordinate-measurement
angles-lines|4|4|angle-measure,lines-symmetry,angle-relationships,triangle-angle-theorems
coordinate-geometry|4|4|coordinate-first-quadrant,coordinate-four-quadrants,coordinate-polygons,coordinate-distance,segment-division
transformations-similarity|4|4|rigid-motions,dilations-similarity,scale-drawings,congruence-criteria,similarity-proofs,dilation-properties,transformation-invariants,polygon-symmetries
geometry-constructions|2|1|triangle-construction,solid-cross-sections,geometric-constructions,triangle-circles,tangent-construction,transformation-constructions,inscribed-polygons,sections-and-revolutions
geometry-proof|3|2|geometric-proof,coordinate-proofs,circle-similarity,line-angle-proofs,triangle-proofs,parallelogram-proofs,measurement-formula-proofs,cavalieri-principle,slope-proofs,similarity-theorems,triangle-law-proofs
geometry-modeling|3|3|geometric-modeling,density-modeling,geometric-design
circles-conics|3|3|circle-theorems,arc-sector-measure,circle-equations,conic-sections,parabola-locus
right-triangles|5|5|pythagorean-theorem,right-triangle-trigonometry,special-right-triangles,complementary-trigonometry
ratios-percent|6|6|ratios,unit-rates,ratio-tables,percentages,rational-unit-rates,proportional-relationships,percent-change
expressions|5|5|numerical-expressions,variable-expressions,expression-properties,linear-expressions,expression-structure
patterns|3|3|arithmetic-patterns,rule-patterns,related-patterns,dependent-variables
linear-equations|6|6|equality,missing-addend,missing-factor,one-step-equations,two-step-equations,linear-equations,formula-rearrangement,symbolic-linear-constraints,equation-reasoning
linear-models|6|6|slope,linear-models,linear-equation-modeling,model-quantities
inequalities|4|4|simple-inequalities,linear-inequalities,inequality-regions,graph-solution-sets
systems|5|5|linear-systems,systems-modeling,elimination-proof
absolute-value-equations|2|2|absolute-value-equations
powers-radicals|4|4|integer-powers,exponent-laws,rational-exponents,radical-equations
polynomials-quadratics|6|6|polynomial-arithmetic,factor-quadratics,quadratic-equations,complete-square,quadratic-formula,polynomial-division,polynomial-zeros,polynomial-identities
rational-algebra|3|3|rational-expression-domain,rational-expressions,rational-equation-one-denominator,rational-equations
nonlinear-systems|2|2|nonlinear-intersection-reading,nonlinear-systems,nonlinear-intersection-count,nonlinear-equation-modeling,graphical-equation-solving
function-meaning|5|5|function-notation,compare-functions,qualitative-graphs,function-domain-range,function-evaluation,piecewise-functions,average-rate-change,cross-representation-comparison
quadratic-functions|5|5|quadratic-graphs,quadratic-minimum
function-operations|3|3|function-transformations,function-composition,inverse-functions,polynomial-behavior,rational-function-behavior
exponential-logarithmic|4|4|exponential-models,logarithms,logarithm-properties,exponential-equations,growth-comparison
sequences|3|3|arithmetic-sequences,geometric-sequences,sequence-sums
trigonometry|3|2|radians-unit-circle,trigonometric-graphs,inverse-trigonometry,trigonometric-identities,trigonometric-equations,oblique-triangles,special-angle-values,trigonometric-symmetry,periodic-modeling,trigonometric-area
complex-numbers|2|1|complex-numbers,complex-plane,complex-conjugates,complex-distance,complex-factorization,fundamental-theorem-algebra
vectors-matrices|1|1|vectors,matrices,vector-modeling,matrix-data,matrix-properties,matrix-inverses,matrix-transformations,matrix-systems
advanced-models|1|1|parametric-models,polar-coordinates,model-validation,binomial-theorem
data-displays|4|4|sort-and-count,categorical-data,line-plots,picture-bar-graphs,scaled-graphs,fraction-line-plots,fraction-plot-arithmetic,fraction-plot-computation,distribution-plots
statistics|4|4|statistical-questions,statistics-mean,mean-median,variability,signed-data-summaries,compare-distributions,normal-distributions,statistical-summary-comparison
bivariate-data|4|4|scatterplots,two-way-tables,residuals-correlation,categorical-association,regression-interpretation
statistical-inference|3|3|sampling,study-design,statistical-inference,simulation-model-checks,sampling-margin-error,randomization-tests,statistical-report-critique,causal-claims
probability|3|3|probability,compound-probability,conditional-probability,independent-events,event-sets,probability-addition,probability-multiplication,permutations-combinations,fair-random-decisions
probability-models|2|1|expected-value,random-variables,theoretical-distributions,empirical-distributions,decision-strategies
`;
export const selectionObjectives: readonly SelectionObjective[] = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, importance, assessmentEmphasis, members] = row.split("|");
    return {
      id: id!,
      importance: Number(importance),
      assessmentEmphasis: Number(assessmentEmphasis),
      basis: "editorial",
      skills: members!.split(","),
    };
  });
const objectiveBySkill = new Map<string, SelectionObjective>();
for (const objective of selectionObjectives) {
  for (const skillId of objective.skills) {
    if (objectiveBySkill.has(skillId))
      throw new Error(`Duplicate selection skill: ${skillId}`);
    objectiveBySkill.set(skillId, objective);
  }
}
/** Relative weight WITHIN the objective. A new graph step shares its budget.
 * Equal defaults are provisional, not a claim of equal test prevalence. */
export const skillEmphasis: Readonly<Record<string, number>> = {
  "rational-equation-one-denominator": 3,
  "rational-equations": 2,
  "nonlinear-systems": 3,
  "nonlinear-intersection-reading": 1,
  "nonlinear-intersection-count": 1,
  "linear-equations": 3,
  "one-step-equations": 3,
  "two-step-equations": 3,
  "symbolic-linear-constraints": 1,
  "equation-reasoning": 1,
};
/** Family weights are relative only within their skill, separate from difficulty.
 * These overrides emphasize ordinary solving over special-case classification. */
export const familyEmphasis: Readonly<Record<string, number>> = {
  "linear-equation": 3,
  "grouped-linear-equation": 2,
  "negative-coefficient-equation": 2,
  "rational-coefficient-equation": 2,
  "both-sides-linear-equation": 3,
  "check-equation-candidate": 1,
  "equation-solution-count": 1,
};
export function objectiveForSkill(
  skillId: string,
): SelectionObjective | undefined {
  return objectiveBySkill.get(skillId);
}
export function auditSelectionCatalog(
  skillIds: readonly string[],
  templateIds: readonly string[],
): string[] {
  const knownSkills = new Set(skillIds);
  const knownTemplates = new Set(templateIds);
  return [
    ...skillIds
      .filter((id) => !objectiveBySkill.has(id))
      .map((id) => `Unbudgeted skill: ${id}`),
    ...[...objectiveBySkill.keys()]
      .filter((id) => !knownSkills.has(id))
      .map((id) => `Unknown budget skill: ${id}`),
    ...Object.keys(skillEmphasis)
      .filter((id) => !knownSkills.has(id))
      .map((id) => `Unknown weighted skill: ${id}`),
    ...Object.keys(familyEmphasis)
      .filter((id) => !knownTemplates.has(id))
      .map((id) => `Unknown weighted family: ${id}`),
  ];
}
