import { floridaGapTemplateIds } from "./src/math/florida-gaps-practice";
import { generateProblem } from "./src/math/engine";
const rules: [RegExp, string][] = [
  [/(?<![\d./−-])\b1 (?!is\b|was\b|has\b|plus\b|minus\b|times\b|and\b|more\b|less\b|of\b|or\b)[a-z]+s\b/,"plural noun after 1"],
  [/\b[Tt]here (are|were) 1\b/, "plural verb before 1"],
  [/(?<![\d./−+×÷=*-]\s?)\b1 (were|are|have)\b/,"plural verb directly after 1"],
  [/\([a-z]*s\)|[a-z]\(s\)/, "(s)"],
  [/(?:^|[=:] )(-?[\d/.]+) = \1(?=[.,;]?$|[.,;] |\s[a-z])/,"x = x"],
  [/(?<![A-Za-z\d)}])\(\d[\d/.]*\)/, "positive in parens"],
  [/\b1 [a-z]+ (contain|use|have|are|make|remain|hold|become|give)\b/,"plural verb after 1"],
];
const issues=new Map<string,string>();
for (const id of floridaGapTemplateIds) for (let s=0;s<300;s++){ const p=generateProblem(id,`grammar-${s}`);
 for (const text of [p.public.prompt,...p.explanation,p.hint]) for (const [re,n] of rules) if(re.test(text)&&!issues.has(id+n)) issues.set(id+n, text);}
console.log([...issues].join("\n"));
console.log(/(?<![A-Za-z\d)}])\(\d[\d/.]*\)/.test("$-36+(64)=28$"), generateProblem("fl-vector-dot-product","look:11").explanation);
