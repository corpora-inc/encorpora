import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveTimer, buildTeachingContext, buildTutorContext, coverageAudit, createLearner, expectedAnswer, formatRational, generatePractice, getSkill, gradeAnswer, parseRational, quarantineActivity, recordAttempt, renderTask, selectCandidates, skills, standards, validateActivity, validateTask } from './index';
import type { Activity, CanonicalTask, LearnerState } from './types';
const date=(day:number)=>new Date(Date.UTC(2026,8,day,12)).toISOString();
const activity=(task:CanonicalTask,skillId='5.NF.A.1',id='test',mode:Activity['mode']='concept'):Activity=>{
 const checked=validateActivity({version:1,id,skillId,mode,task});assert.equal(checked.ok,true,JSON.stringify(checked));if(!checked.ok)throw new Error();return checked.activity;
};
const fractionPractice=(seed:number,mode:Activity['mode']='concept')=>activity({kind:'arithmetic',operation:'add',left:`1/${seed+2}`,right:'1/2'},'5.NF.A.1',`fraction-${seed}`,mode);
const success=(state:LearnerState,a:Activity,id:string,day=1,activeMs=1000,hintsUsed=0)=>recordAttempt(state,a,{id,answer:expectedAnswer(a.task),at:date(day),activeMs,hintsUsed});

test('complete K–8 identifiers and components have explicit official provenance',()=>{
 assert.equal(standards.length,229);assert.equal(standards.reduce((n,s)=>n+s.components.length,0),88);
 assert.deepEqual(Object.fromEntries(['K',1,2,3,4,5,6,7,8].map(g=>[g,standards.filter(s=>s.grade===g).length])),{K:22,1:21,2:26,3:25,4:28,5:26,6:29,7:24,8:28});
 assert.equal(new Set(standards.flatMap(s=>[s.id,...s.components])).size,317);
 for(const s of standards){assert.match(s.sourceUrl,/^https:\/\/www.thecorestandards.org\/Math\/Content\//);assert.ok(s.summary.length>10);}
 assert.equal(coverageAudit().verifiedPractice.length,90);assert.equal(coverageAudit().guidedOnly.length,139);
 assert.ok(buildTeachingContext(createLearner('a'),'8.G.A.3').includes('guided-only'));
});
test('inferred graph is referentially valid and acyclic',()=>{
 const done=new Set<string>(),active=new Set<string>();
 const visit=(id:string)=>{assert.ok(!active.has(id),id);if(done.has(id))return;const s=getSkill(id);assert.ok(s);assert.equal(s.prerequisiteBasis,'aha-inferred');active.add(id);for(const p of s.prerequisites)visit(p);active.delete(id);done.add(id);};skills.forEach(s=>visit(s.id));
});
test('exact rational input accepts equivalent fractions decimals and mixed numbers',()=>{
 for(const [input,expected] of [['0.1','1/10'],['2/4','1/2'],['-1 1/2','-3/2'],['.25','1/4'],['3/-6','-1/2'],['−0.5','-1/2']])assert.equal(formatRational(parseRational(input)),expected);
 for(const input of ['1/0','NaN','Infinity','1e5','2+2','<script>','1 3/2','1'.repeat(100)])assert.throws(()=>parseRational(input));
});
test('task families have independently enumerated answers',()=>{
 const pairs:[CanonicalTask,string][]=[
 [{kind:'arithmetic',operation:'add',left:'0.1',right:'0.2'},'3/10'],
 [{kind:'arithmetic',operation:'divide',left:'3/4',right:'2/3'},'9/8'],
 [{kind:'compare',left:'-1/3',right:'-0.3'},'<'],
 [{kind:'missing',operation:'subtract',left:'12',result:'5'},'7'],
 [{kind:'missing',operation:'divide',left:'12',result:'3'},'4'],
 [{kind:'fraction',numerator:6,denominator:8},'3/4'],
 [{kind:'placeValue',value:907,place:1},'0'],
 [{kind:'round',value:'-1.25',place:'1/10'},'-13/10'],
 [{kind:'sequence',start:'2',step:'3',count:4},'14'],
 [{kind:'measure',shape:'rectangle',measure:'perimeter',width:'3',height:'4'},'14'],
 [{kind:'measure',shape:'triangle',measure:'area',width:'3',height:'5'},'15/2'],
 [{kind:'measure',shape:'cuboid',measure:'surfaceArea',width:'2',height:'3',depth:'4'},'52'],
 [{kind:'measure',shape:'cuboid',measure:'volume',width:'1/2',height:'3',depth:'4'},'6'],
 [{kind:'linear',a:'2/3',b:'-1',c:'3'},'6'],
 [{kind:'power',base:'-2',exponent:-3},'-1/8'],
 [{kind:'factors',operation:'gcd',left:18,right:24},'6'],
 [{kind:'factors',operation:'lcm',left:12,right:18},'36'],
 [{kind:'statistics',operation:'mean',values:['1','2','7']},'10/3'],
 [{kind:'statistics',operation:'median',values:['9','1','2','4']},'3'],
 [{kind:'statistics',operation:'range',values:['-2','7']},'9'],
 [{kind:'percent',percent:'12.5',whole:'80'},'10'],
 [{kind:'rate',quantity:'3/2',units:'1/4'},'6'],
 [{kind:'probability',favorable:2,total:6},'1/3'],
 [{kind:'slope',x1:'1',y1:'2',x2:'4',y2:'8'},'2'],
 [{kind:'pythagorean',a:5,b:12},'13'],
 [{kind:'evaluate',coefficients:['2','3','1'],x:'4'},'30'],
 ];for(const [task,expected]of pairs){assert.equal(expectedAnswer(validateTask(task)),expected);assert.ok(renderTask(task).length>5);}
});
test('validation rejects dangerous or undefined task shapes before scoring',()=>{
 for(const task of [
 {kind:'arithmetic',operation:'divide',left:'1',right:'0'},
 {kind:'linear',a:'0',b:'1',c:'1'},
 {kind:'missing',operation:'multiply',left:'0',result:'0'},
 {kind:'power',base:'0',exponent:0},
 {kind:'power',base:'2',exponent:1000000},
 {kind:'statistics',operation:'mean',values:[]},
 {kind:'fraction',numerator:4,denominator:3},
 {kind:'pythagorean',a:2,b:3},
 {kind:'slope',x1:'1',y1:'1',x2:'1',y2:'2'},
 {kind:'arithmetic',operation:'add',left:'1',right:'2',javascript:'alert(1)'},
 ])assert.throws(()=>validateTask(task),JSON.stringify(task));
});
test('the scored question and visual come from task, not model prose or answer keys',()=>{
 const checked=validateActivity({version:1,id:'x',skillId:'3.OA.C.7',mode:'concept',task:{kind:'arithmetic',operation:'multiply',left:'7',right:'8'},prompt:'What is 2 + 2?',expectedAnswer:'4',visual:{kind:'array',rows:2,columns:2}});
 assert.ok(checked.ok);if(!checked.ok)return;assert.equal(checked.activity.prompt,'7 × 8 = ?');assert.deepEqual(checked.activity.visual,{kind:'array',rows:7,columns:8});assert.equal(gradeAnswer(checked.activity,'56').correct,true);assert.equal(gradeAnswer(checked.activity,'4').correct,false);
});
test('skill/task mismatches and artificial advanced-task credit are rejected',()=>{
 const raw={version:1,id:'x',mode:'concept',skillId:'2.OA.B.2',task:{kind:'arithmetic',operation:'multiply',left:'2',right:'3'}};
 assert.equal(validateActivity(raw).ok,false);
 assert.equal(validateActivity({...raw,skillId:'8.G.A.3'}).ok,false);
 assert.equal(validateActivity({...raw,skillId:'3.OA.C.7'},['5.NF.A.1']).ok,false);
 assert.equal(validateActivity({...raw,skillId:'4.NF.A.2',task:{kind:'compare',left:'1',right:'2'}}).ok,false);
 assert.equal(validateActivity({...raw,skillId:'5.NF.B.7',task:{kind:'arithmetic',operation:'divide',left:'2/3',right:'4/5'}}).ok,false);
 assert.equal(validateActivity({...raw,skillId:'4.NF.B.3',task:{kind:'arithmetic',operation:'add',left:'1/2',right:'1/3'}}).ok,false);
});
test('choices are exact unique values and fluency never uses multiple-choice guessing',()=>{
 const a=generatePractice('3.OA.C.7',14);const expected=expectedAnswer(a.task);
 assert.equal(validateActivity({...a,choices:[expected,'-999']}).ok,true);
 assert.equal(validateActivity({...a,choices:['1/2','0.5']}).ok,false);
 assert.equal(validateActivity({...a,mode:'fluency',choices:[expected,'-999']}).ok,false);
});
test('all verified generators produce bounded valid varied tasks and independently correct integer arithmetic',()=>{
 for(const skill of skills.filter(s=>s.taskKinds.length)){
  const variants=new Set<string>();
  for(let seed=1;seed<=100;seed++){
   const a=generatePractice(skill.id,seed);assert.equal(validateActivity(a).ok,true,skill.id);assert.equal(a.source,'local');variants.add(a.variant);
   const t=a.task;if(t.kind==='arithmetic'&&/^\d+$/.test(t.left)&&/^\d+$/.test(t.right)){
    const l=BigInt(t.left),r=BigInt(t.right);
    if(t.operation==='add')assert.equal(expectedAnswer(t),String(l+r));
    if(t.operation==='multiply')assert.equal(expectedAnswer(t),String(l*r));
    if(t.operation==='subtract')assert.equal(expectedAnswer(t),String(l-r));
    if(t.operation==='divide'&&r!==0n&&l%r===0n)assert.equal(expectedAnswer(t),String(l/r));
   }
  }assert.ok(variants.size>=3,`${skill.id}: ${variants.size} variants`);
 }
});
test('repeating a task cannot masquerade as varied conceptual evidence',()=>{
 let state=createLearner('a');const a=generatePractice('3.OA.C.7',11);
 for(let i=0;i<6;i++)state=success(state,{...a,id:`repeat${i}`},`attempt${i}`);
 assert.equal(state.progress[a.skillId].concept,'developing');assert.equal(state.progress[a.skillId].distinctVariants.length,1);
});
test('hints never count as independent and slow answers do not negate concept success',()=>{
 let state=createLearner('a');
 for(let i=1;i<=3;i++)state=success(state,fractionPractice(i),String(i),1,300000);
 assert.equal(state.progress['5.NF.A.1'].concept,'provisional');assert.equal(state.progress['5.NF.A.1'].retention,'unconfirmed');
 state=success(state,generatePractice('5.NF.A.1',99),'hint',1,1000,1);assert.equal(state.progress['5.NF.A.1'].concept,'developing');assert.equal(state.attempts.at(-1)?.independent,false);
});
test('delayed reviews confirm retention and repeated same-day wins do not',()=>{
 let state=createLearner('a');for(let seed=1;seed<=3;seed++)state=success(state,fractionPractice(seed),String(seed));
 assert.equal(state.progress['5.NF.A.1'].nextReviewAt,date(2));
 state=success(state,generatePractice('5.NF.A.1',50,'review'),'same-day',1);assert.equal(state.progress['5.NF.A.1'].reviewStage,0);
 state=success(state,generatePractice('5.NF.A.1',51,'review'),'day2',2);assert.equal(state.progress['5.NF.A.1'].reviewStage,1);assert.equal(state.progress['5.NF.A.1'].nextReviewAt,date(5));assert.equal(state.progress['5.NF.A.1'].retention,'unconfirmed');
 state=success(state,generatePractice('5.NF.A.1',52,'review'),'day5',5);assert.equal(state.progress['5.NF.A.1'].retention,'retained');assert.equal(state.progress['5.NF.A.1'].nextReviewAt,date(12));
 assert.ok(selectCandidates(state,date(12)).some(c=>c.skill.id==='5.NF.A.1'&&c.reason==='due-review'));
});
test('duplicate attempts, duplicate activity submission and malformed input do not add evidence',()=>{
 const a=generatePractice('2.OA.B.2',1);let state=success(createLearner('a'),a,'a');
 assert.equal(recordAttempt(state,a,{id:'a',answer:'0'}),state);assert.equal(recordAttempt(state,a,{id:'b',answer:'0'}),state);
 assert.throws(()=>recordAttempt(state,generatePractice('2.OA.B.2',2),{id:'b',answer:'hello'}));assert.equal(state.attempts.length,1);
});
test('quarantining an activity preserves its audit trail and removes its mastery contribution',()=>{
 let state=createLearner('a');for(let seed=1;seed<=3;seed++)state=success(state,fractionPractice(seed),String(seed));
 assert.equal(state.progress['5.NF.A.1'].concept,'provisional');
 state=quarantineActivity(state,state.attempts[0].activityId,'Misleading explanation',date(2));
 assert.equal(state.attempts.length,3);assert.ok(state.attempts[0].excluded);assert.equal(state.progress['5.NF.A.1'].concept,'developing');assert.equal(state.progress['5.NF.A.1'].independentSuccesses,2);
 assert.ok(!buildTutorContext(state,date(2)).context.includes('Misleading explanation'));
});
test('initial placement spans domains and the model receives bounded pseudonymous evidence',()=>{
 const state=createLearner('private-local-profile',4);const menu=selectCandidates(state,date(1),8);
 assert.ok(new Set(menu.map(c=>c.skill.domain)).size>=6);assert.ok(menu.some(c=>c.skill.domain==='NF'));
 const context=buildTutorContext(state,date(1));assert.ok(context.context.length<16000);assert.ok(!context.context.includes('private-local-profile'));
});
test('foreground timer excludes background time and marks interrupted timing',()=>{
 const timer=new ActiveTimer();timer.resume(0);timer.pause(1000);timer.resume(301000);assert.deepEqual(timer.snapshot(302000),{activeMs:2000,interrupted:true});
});

test('whole-number exercises cannot earn fraction evidence',()=>{
 for(const skillId of ['4.NF.B.3','4.NF.C.5'])assert.equal(validateActivity({version:1,id:'bad-fraction',skillId,mode:'concept',task:{kind:'arithmetic',operation:'add',left:'2',right:'3'}}).ok,false);
});
test('fluency requires recall-only diverse fast successes across dates',()=>{
 const make=(i:number,mode:Activity['mode'])=>activity({kind:'arithmetic',operation:'multiply',left:String(2+Math.floor(i/8)),right:String(2+i%8)},'3.OA.C.7',`fact-${mode}-${i}`,mode);
 let recall=createLearner('a'),choice=createLearner('b'),interrupted=createLearner('c');
 for(let i=0;i<12;i++){
  const day=i<6?1:2;
  recall=success(recall,make(i,'fluency'),String(i),day);
  const question=make(i,'concept');question.choices=[expectedAnswer(question.task),'-100'];
  choice=success(choice,question,String(i),day);
  const q=make(i,'fluency');interrupted=recordAttempt(interrupted,q,{id:String(i),answer:expectedAnswer(q.task),at:date(day),activeMs:1000,interrupted:i===11});
 }
 assert.equal(recall.progress['3.OA.C.7'].fluency,'fluent');
 assert.equal(choice.progress['3.OA.C.7'].fluency,'developing');
 assert.equal(interrupted.progress['3.OA.C.7'].fluency,'developing');
 recall=success(recall,make(13,'concept'),'later-concept',2,8000);
 assert.equal(recall.progress['3.OA.C.7'].fluency,'fluent','Untimed successful teaching must not erase established recall evidence.');
 recall=recordAttempt(recall,make(14,'concept'),{id:'later-wrong',answer:'-100',at:date(2)});
 assert.equal(recall.progress['3.OA.C.7'].fluency,'developing','New error requires fresh recall evidence.');
});

test('every admitted task has an answer representable by the bounded student grammar',()=>{
 for(const task of [
  {kind:'evaluate',coefficients:['0','0','0','1000000'],x:'1000000'},
  {kind:'measure',shape:'cuboid',measure:'volume',width:'1000000',height:'1000000',depth:'1000000'},
  {kind:'power',base:'1/999983',exponent:6},
 ])assert.throws(()=>validateTask(task));
});

 test('prompt context stays compact when varied practice history grows',()=>{
 let state=createLearner('private-local-profile',5);
 state=success(state,fractionPractice(1),'long-history');
 state.progress['5.NF.A.1'].distinctVariants=Array.from({length:20000},(_,i)=>`private-variant-${i}`);
 const context=buildTutorContext(state,date(2)).context;
 assert.ok(context.length<16000);assert.ok(!context.includes('private-variant'));
 assert.ok(buildTeachingContext(state,'5.NF.A.1').length<4000);
 });
