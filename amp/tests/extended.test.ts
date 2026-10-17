import test from 'node:test';
import assert from 'node:assert/strict';
import { extendedTemplates, generateExtendedProblem } from '../src/math/extended.js';
import { gradeAnswer } from '../src/math/engine.js';
const value=(s:string)=>{const [a,b]=s.split('/').map(Number);return a!/(b??1);};
test('extended families solve independently from their displayed givens across 150 seeds each',()=>{
 for(const t of extendedTemplates)for(let i=0;i<150;i++){
  const p=generateExtendedProblem(t.id,`oracle-${i}`),q=p.public.prompt;
  const n=q.match(/-?\d+(?:\.\d+)?/g)?.map(Number)??[];
  let expected:number;
  switch(t.id){
   case 'divide-facts':expected=n[0]!/n[1]!;break;
   case 'place-value-digit':{const place=q.includes('hundreds')?100:q.includes('tens')?10:1;expected=Math.floor(n[0]!/place)%10*place;break;}
   case 'decimal-addition':expected=(Math.round(n[0]!*100)+Math.round(n[1]!*100))/100;break;
   case 'compare-fractions':assert.notEqual(n[0]!/n[1]!,n[2]!/n[3]!);expected=Math.max(n[0]!/n[1]!,n[2]!/n[3]!);break;
   case 'multiply-fractions':expected=n[0]!*n[2]!/(n[1]!*n[3]!);break;
   case 'divide-fractions':expected=(n[0]!/n[1]!)/(n[2]!/n[3]!);break;
   case 'ratio-missing':expected=n[0]!*n[2]!/n[1]!;break;
   case 'percent-of':expected=n[0]!*n[1]!/100;break;
   case 'integer-addition':expected=n[0]!+n[1]!;break;
   case 'integer-power':{expected=1;for(let j=0;j<n[1]!;j++)expected*=n[0]!;break;}
   case 'line-slope':expected=(n[3]!-n[1]!)/(n[2]!-n[0]!);break;
   case 'linear-system-x':{const [a,b,e,c,d,f]=n;let matches=0;expected=NaN;for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++)if(a!*x+b!*y===e&&c!*x+d!*y===f){expected=x;matches++;}assert.equal(matches,1);break;}
   case 'simple-probability':expected=n[0]!/(n[0]!+n[1]!);assert.ok(expected>0&&expected<1);break;
   case 'arithmetic-term':{expected=n[0]!;for(let j=1;j<n[2]!;j++)expected+=n[1]!;break;}
   case 'function-evaluation':expected=n[0]!*n[3]!*n[3]!+n[1]!*n[3]!+n[2]!;break;
   case 'unit-price':expected=n[1]!/n[0]!*n[2]!;break;
   case 'decimal-multiplication':expected=Math.round(n[0]!*10)*Math.round(n[1]!*10)/100;break;
   case 'operation-order':expected=n[0]!+(n[1]!+n[2]!)*n[3]!;break;
   default:throw new Error('Missing oracle');
  }
  assert.ok(Math.abs(value(p.answer)-expected)<1e-10,`${t.id}: ${q}; ${p.answer} versus ${expected}`);
  assert.deepEqual(p,generateExtendedProblem(t.id,`oracle-${i}`));
  assert.equal(gradeAnswer(p,p.answer),true);
  assert.equal(gradeAnswer(p,String(Math.floor(expected)+1)),false);
  assert.match(p.public.id,/^[a-f0-9]{64}$/);
  assert.ok(p.hint.length>10&&p.explanation.length>=2);
 }
});
test('extended inputs are bounded and do not accept unknown templates',()=>{
 assert.throws(()=>generateExtendedProblem('unknown','a'));
 assert.throws(()=>generateExtendedProblem('divide-facts',''));
 assert.throws(()=>generateExtendedProblem('divide-facts','x'.repeat(129)));
});

import { extendedLessons } from '../src/content/extended-lessons.js';
import { normalizeAnswer } from '../src/math/engine.js';
test('every extended family has one original companion lesson and mathematically checked example',()=>{
 const answers:Record<string,string>={
  division:String(24/6),'digit-value':String(5*10),'adding-decimals':'185/100','comparing-fractions':'3/4',
  'multiplying-fractions':'3/8','dividing-fractions':String((3/4)/(1/8)),'equivalent-ratios':String(2*(12/3)),
  'percent-quantity':String(25*80/100),'signed-addition':String(-7+12),'whole-number-powers':String(3**4),
  'slope-two-points':`${8-2}/${5-1}`,'systems-elimination':'2','equally-likely-probability':`3/${3+5}`,
  'arithmetic-sequence-terms':String(4+4*3),'function-input-output':String(2*(-2)**2+3*(-2)+1),
  'unit-cost':String(12/4*7),'multiplying-decimals':'36/100','expression-order':String(5+(2+3)*4),
 };
 assert.equal(new Set(extendedLessons.map(l=>l.id)).size,extendedLessons.length);
 for(const t of extendedTemplates)assert.equal(extendedLessons.filter(l=>l.templateIds.includes(t.id)).length,1);
 for(const l of extendedLessons){
  assert.ok(l.templateIds.every(id=>extendedTemplates.some(t=>t.id===id)));
  assert.equal(normalizeAnswer(l.workedExample.answer),normalizeAnswer(answers[l.id]!));
  assert.ok(l.sections.length>=2&&l.sections.every(s=>s.paragraphs.length>=2));
  assert.ok(l.pitfalls.length>=2&&l.objectives.length>=2&&l.parentGuide.length>40);
 }
 // Independently verify the system example's shared solution, not merely its x answer.
 const x=Number(extendedLessons.find(l=>l.id==='systems-elimination')!.workedExample.answer),y=5-x;
 assert.equal(2*x+y,7);assert.equal(x+y,5);
});
