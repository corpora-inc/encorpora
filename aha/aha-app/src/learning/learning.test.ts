import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveTimer, answerCanBeNegative, buildTeachingContext, buildTutorContext, coverageAudit, createLearner, expectedAnswer, formatRational, generatePractice, generateFreshPractice, recentStreak, workedExampleHint, teachTask, getSkill, gradeAnswer, parseRational, quarantineActivity, recordAttempt, renderTask, selectCandidates, selectFluencySkill, skills, standards, validateActivity, validateTask } from './index';
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

test('a failed early placement gets support or a fresh retry before a new domain',()=>{
 const task=generatePractice('K.CC.A.2',6);
 const learner=recordAttempt(createLearner('a'),task,{id:'wrong',answer:'-999',at:date(1)});
 assert.equal(selectCandidates(learner,date(1))[0].skill.id,task.skillId);
 assert.equal(selectCandidates(learner,date(1))[0].reason,'continue');
});

test('conceptual frontier advances without waiting days for arithmetic fluency',()=>{
 let learner=createLearner('a');
 for(let i=1;i<=12;i++)learner=success(learner,generateFreshPractice('K.OA.A.5',learner,i),`fact-${i}`);
 assert.equal(learner.progress['K.OA.A.5'].concept,'provisional');
 assert.equal(learner.progress['K.OA.A.5'].fluency,'developing');
 const menu=selectCandidates(learner,date(1));
 assert.equal(menu[0].reason,'frontier');
 assert.ok(menu.find(c=>c.skill.id==='K.OA.A.5'&&c.reason==='continue'));
});

test('interleaved fluency revisits learned facts after unrelated concepts, pauses daily, and completes across days',()=>{
 let learner=createLearner('a',3);
 for(let i=0;i<3;i++)learner=success(learner,generateFreshPractice('3.OA.C.7',learner,i+10),`concept-${i}`);
 learner=success(learner,generatePractice('4.NF.B.3',80),'unrelated');
 assert.equal(selectFluencySkill(learner,date(1))?.id,'3.OA.C.7');
 for(let day=1;day<=2;day++) {
  for(let i=0;i<6;i++) {
   const skill=selectFluencySkill(learner,date(day));assert.equal(skill?.id,'3.OA.C.7');
   const task=generateFreshPractice(skill!.id,learner,day*100+i,'fluency');
   learner=success(learner,{...task,id:`recall-${day}-${i}`},`recall-${day}-${i}`,day);
  }
  assert.equal(selectFluencySkill(learner,date(day)),undefined,'Six timed answers end that day’s short practice');
  if(day===1)assert.equal(learner.progress['3.OA.C.7'].fluency,'developing');
 }
 assert.equal(learner.progress['3.OA.C.7'].fluency,'fluent');
 assert.equal(selectFluencySkill(learner,date(3)),undefined,'Established fluency does not keep drilling');
 assert.equal(learner.attempts.filter(a=>a.mode==='fluency').length,12);
 assert.ok(new Set(learner.attempts.filter(a=>a.mode==='fluency').map(a=>a.variant)).size>=8);
});

test('fluency rotates among eligible skills instead of repeatedly selecting one fact family',()=>{
 let learner=createLearner('a');
 for(const skillId of ['1.OA.C.6','3.OA.C.7'])for(let i=0;i<3;i++){
  const task=generateFreshPractice(skillId,learner,i+20);
  learner=success(learner,{...task,id:`${skillId}-${i}`},`${skillId}-${i}`);
 }
 const first=selectFluencySkill(learner,date(1))!;
 learner=success(learner,generateFreshPractice(first.id,learner,50,'fluency'),'timed');
 const next=selectFluencySkill(learner,date(1))!;
 assert.notEqual(next.id,first.id);
 // With no practice today, prefer the skill least recently timed rather than lexical order.
 assert.equal(selectFluencySkill(learner,date(2))?.id,next.id);
});

test('a mistake does not send a learner back to an already demonstrated prerequisite',()=>{
 let learner=createLearner('a');
 for(let i=1;i<=12;i++)learner=success(learner,generateFreshPractice('K.OA.A.5',learner,i),`fact-${i}`);
 const task=generatePractice('1.OA.B.4',1);
 learner=recordAttempt(learner,task,{id:'missing-error',answer:'-999',at:date(1)});
 const menu=selectCandidates(learner,date(1));
 assert.equal(menu[0].skill.id,'1.OA.B.4');
 assert.ok(!menu.some(c=>c.skill.id==='K.OA.A.5'&&c.reason==='support'));
});

test('fresh practice avoids recent facts without changing the skill or mode',()=>{
 let learner=createLearner('a');const variants=new Set<string>();
 for(let i=0;i<12;i++){
  // Even a repeated random seed must not repeat recent content when variety exists.
  const task=generateFreshPractice('3.OA.C.7',learner,7,'fluency');
  assert.ok(!variants.has(task.variant));variants.add(task.variant);
  assert.equal(task.skillId,'3.OA.C.7');assert.equal(task.mode,'fluency');
  learner=success(learner,{...task,id:`fresh-${i}`},`answer-${i}`);
 }
});

test('small practice sets remain usable after every variant has been seen',()=>{
 let learner=createLearner('a');
 for(let i=0;i<20;i++){
  const task=generateFreshPractice('1.G.A.3',learner,9);
  assert.equal(validateActivity(task).ok,true);
  learner=success(learner,{...task,id:`small-${i}`},`small-answer-${i}`);
 }
 assert.equal(learner.attempts.length,20);
});

test('an already demonstrated successor is not offered as a new conceptual frontier',()=>{
 let learner=createLearner('a');
 for(const skillId of ['K.OA.A.5','1.OA.B.4'])for(let i=1;i<=6;i++){
  const task=generateFreshPractice(skillId,learner,i);
  learner=success(learner,{...task,id:`${skillId}-${i}`},`${skillId}-${i}`);
 }
 learner=success(learner,{...generatePractice('K.OA.A.5',99),id:'revisit'},'revisit');
 assert.equal(learner.progress['1.OA.B.4'].concept,'provisional');
 assert.ok(!selectCandidates(learner,date(1)).some(c=>c.skill.id==='1.OA.B.4'&&c.reason==='frontier'));
});

test('every local task has concise specific teaching that survives activity validation',()=>{
 for(const skill of skills.filter(s=>s.coverage==='verified-practice'))for(let seed=1;seed<=10;seed++){
  const task=generatePractice(skill.id,seed);
  assert.ok(task.hint&&task.hint.length<=300,skill.id);
  assert.ok(task.explanation&&task.explanation.length<=600,skill.id);
  const validation=validateActivity(task);assert.equal(validation.ok,true);
  if(validation.ok){assert.equal(validation.activity.hint,task.hint);assert.equal(validation.activity.explanation,task.explanation);}
 }
 assert.equal(teachTask({kind:'arithmetic',operation:'add',left:'1/3',right:'1/2'}).explanation,'2/6 + 3/6 = 5/6. Simplify the fraction if you can.');
 assert.equal(teachTask({kind:'arithmetic',operation:'divide',left:'2/3',right:'4/5'}).explanation,'2/3 × 5/4 = 5/6.');
 assert.ok(!teachTask({kind:'arithmetic',operation:'multiply',left:'6',right:'0'}).explanation.includes('÷ 0'));
 assert.equal(teachTask({kind:'linear',a:'3',b:'2',c:'14'}).explanation,'Subtract 2 from both sides: 3 × x = 12. Divide by 3: x = 4.');
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

test('fact interleaving cannot displace focused support after a fifth-answer mistake',()=>{
 let state=createLearner('a',3);
 for(let i=0;i<3;i++)state=success(state,activity({kind:'arithmetic',operation:'multiply',left:'7',right:String(3+i)},'3.OA.C.7',`multiply-${i}`),`multiply-${i}`,1);
 const extra=generateFreshPractice('1.G.A.3',state,17);state=success(state,extra,'extra',1);
 const miss=generateFreshPractice('K.CC.A.2',state,18);
 state=recordAttempt(state,miss,{id:'miss',answer:'-1',at:date(1)});
 assert.equal(state.attempts.length,5);
 assert.equal(selectCandidates(state,date(1))[0].skill.id,'K.CC.A.2');
 assert.equal(selectFluencySkill(state,date(1)),undefined);
});
test('sign key appears only where the answer domain can be negative',()=>{
 const sign=(task:CanonicalTask,skillId:string)=>answerCanBeNegative(activity(task,skillId).task,getSkill(skillId));
 assert.equal(sign({kind:'arithmetic',operation:'multiply',left:'3',right:'4'},'3.OA.C.7'),false,'K–3 multiplication never needs a sign');
 assert.equal(sign({kind:'arithmetic',operation:'subtract',left:'15',right:'8'},'1.OA.C.6'),false);
 assert.equal(sign({kind:'arithmetic',operation:'add',left:'-3',right:'5'},'7.NS.A.1'),true);
 assert.equal(sign({kind:'arithmetic',operation:'add',left:'3',right:'5'},'7.NS.A.1'),true,'domain, not this answer: positive answers must not hide the key');
 assert.equal(sign({kind:'pythagorean',a:3,b:4},'8.G.B.7'),false);
 assert.equal(sign({kind:'arithmetic',operation:'divide',left:'3/4',right:'1/2'},'6.NS.A.1'),false,'6.NS operands stay nonnegative');
 assert.equal(answerCanBeNegative({kind:'arithmetic',operation:'subtract',left:'1',right:'2'}),true,'unknown skill stays permissive');
 // Every generated task with a negative answer must offer the key; K–5 never does.
 for(const s of skills.filter(s=>s.coverage==='verified-practice'))for(let seed=1;seed<=60;seed++){
  const a=generatePractice(s.id,seed),expected=expectedAnswer(a.task),negative=a.task.kind!=='compare'&&parseRational(expected).n<0n;
  if(negative)assert.equal(answerCanBeNegative(a.task,s),true,`${s.id} ${expected}`);
  if(s.grade==='K'||s.grade<=5){assert.equal(answerCanBeNegative(a.task,s),false,s.id);assert.ok(!['statistics','evaluate'].includes(a.task.kind),`${s.id}: K–5 nonnegativity check skips array fields`);}
 }
});

// ---- Forgiving retry (#857): one ledger attempt per activity; first-try correctness stays the evidence. ----
test('a correct retry after one miss is one assisted attempt that keeps the first answer',()=>{
 let state=createLearner('a');
 for(let i=1;i<=2;i++)state=success(state,fractionPractice(i),String(i));
 const a=fractionPractice(3),expected=expectedAnswer(a.task);
 state=recordAttempt(state,a,{id:'retry',answer:expected,firstAnswer:'9/9',at:date(1),hintsUsed:1});
 const e=state.attempts.at(-1)!;
 assert.equal(state.attempts.length,3);assert.equal(e.correct,true);assert.equal(e.independent,false);assert.equal(e.firstAnswer,'9/9');
 assert.equal(state.progress['5.NF.A.1'].concept,'developing','A retry never completes provisional evidence');
 assert.equal(state.progress['5.NF.A.1'].independentSuccesses,0);
 // Engine owns the meaning: a first miss makes the attempt assisted even without a hint count.
 const b=generatePractice('3.OA.C.7',3);
 assert.equal(recordAttempt(createLearner('b'),b,{id:'x',answer:expectedAnswer(b.task),firstAnswer:'-1',at:date(1)}).attempts[0].independent,false);
 assert.equal(recordAttempt(state,a,{id:'again',answer:expected,at:date(1)}),state,'Still one attempt per activity');
});
test('the first answer must be a gradable miss and survives rebuilds',()=>{
 const a=generatePractice('3.OA.C.7',4),expected=expectedAnswer(a.task);
 assert.throws(()=>recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:expected}),/first answer/i);
 assert.throws(()=>recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:'hello'}));
 assert.throws(()=>recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:'1'.repeat(81)}));
 let state=recordAttempt(createLearner('a'),a,{id:'x',answer:'-1',firstAnswer:'-2',at:date(1),hintsUsed:1});
 assert.equal(state.attempts[0].correct,false);
 state=success(state,{...generatePractice('3.OA.C.7',5),id:'other'},'other');
 const rebuilt=quarantineActivity(state,'other','test',date(2));
 assert.equal(rebuilt.attempts[0].firstAnswer,'-2');assert.deepEqual(rebuilt.progress,recordAttempt(createLearner('a'),a,{id:'x',answer:'-1',firstAnswer:'-2',at:date(1),hintsUsed:1}).progress);
});

// ---- Error loops (#860): selection policy only; evidence rules above stay unchanged. ----
type Step={skillId:string;grade:number;reason:string;approach?:string;correct:boolean};
const gradeOf=(id:string)=>{const g=getSkill(id)!.grade;return g==='K'?0:g;};
const wrongAnswer=(expected:string)=>['<','>','='].includes(expected)?(expected==='<'?'>':'<'):'-999';
/** Mirrors the controller's local path: candidates[0], worked examples recorded as assisted. */
function simulate(startGrade:LearnerState['startGrade'],answersCorrectly:(i:number)=>boolean,items=24):Step[] {
 let state=createLearner('sim',startGrade);const trace:Step[]=[];
 for(let i=0;i<items;i++){
  const at=new Date(Date.UTC(2026,8,1,12,0,i)).toISOString();
  const chosen=selectCandidates(state,at)[0];
  const task={...generateFreshPractice(chosen.skill.id,state,1000+i,chosen.reason==='due-review'?'review':'concept'),id:`sim-${i}`};
  const correct=answersCorrectly(i),expected=expectedAnswer(task.task);
  state=recordAttempt(state,task,{id:`sim-answer-${i}`,answer:correct?expected:wrongAnswer(expected),at,hintsUsed:chosen.approach==='worked-example'?1:0});
  trace.push({skillId:chosen.skill.id,grade:gradeOf(chosen.skill.id),reason:chosen.reason,...(chosen.approach?{approach:chosen.approach}:{}),correct});
 }
 return trace;
}
const longestRun=(trace:Step[])=>trace.reduce((r,s,i)=>{const run=i&&trace[i-1].skillId===s.skillId?r.run+1:1;return {run,max:Math.max(r.max,run)};},{run:0,max:0}).max;

test('recentStreak reports trailing misses, successes and same-skill presentations',()=>{
 let state=createLearner('a');
 const miss=(id:string,seed:number)=>{const t={...generatePractice(id,seed),id:`m-${id}-${seed}`};state=recordAttempt(state,t,{id:`am-${id}-${seed}`,answer:wrongAnswer(expectedAnswer(t.task)),at:date(1)});};
 miss('3.OA.A.1',1);miss('3.OA.A.1',2);
 assert.deepEqual(recentStreak(state.attempts,'3.OA.A.1'),{misses:2,successes:0,presentedWithoutSuccess:2});
 state=success(state,{...generatePractice('1.G.A.3',3),id:'other'},'other');
 assert.deepEqual(recentStreak(state.attempts,'3.OA.A.1'),{misses:2,successes:0,presentedWithoutSuccess:0},'An interleaved item ends the run but not the miss streak');
 state=success(state,{...generatePractice('3.OA.A.1',4),id:'win'},'win');
 assert.deepEqual(recentStreak(state.attempts,'3.OA.A.1'),{misses:0,successes:1,presentedWithoutSuccess:0});
 assert.deepEqual(recentStreak(state.attempts,'K.CC.A.2'),{misses:0,successes:0,presentedWithoutSuccess:0});
});

test('a learner who keeps missing gets a changed approach and variety, never a long same-skill loop',()=>{
 for(const grade of ['K',3,4] as const){
  const trace=simulate(grade,()=>false);
  assert.ok(longestRun(trace)<=3,`grade ${grade}: ${trace.map(s=>s.skillId).join(' ')}`);
  // Only four Kindergarten skills are verified; older starts also have easier grades to visit.
  assert.ok(new Set(trace.map(s=>s.skillId)).size>=(grade==='K'?4:6),`grade ${grade} variety`);
  assert.equal(trace[1].skillId,trace[0].skillId,'One miss is retried once with a fresh task');
  assert.equal(trace[2].skillId,trace[0].skillId);assert.equal(trace[2].approach,'worked-example','Two misses change the approach');
  assert.notEqual(trace[3].skillId,trace[0].skillId,'A third miss switches to something easier or already successful');
  assert.ok(trace.filter(s=>s.approach==='worked-example').length>=4);
 }
});

test('support descent needs a confirmed miss, steps gradually and brackets placement grades',()=>{
 for(const grade of [3,4,6] as const){
  const trace=simulate(grade,()=>false);
  assert.ok(trace.slice(0,3).every(s=>s.grade===trace[0].grade),'No descent before the second miss and worked example');
  const drops=trace.filter((s,i)=>i>0&&s.grade<trace[i-1].grade);
  assert.ok(drops.length<=Math.ceil(trace.length/3),`grade ${grade}: ${drops.length} drops`);
  for(let i=1;i<trace.length;i++)assert.ok(trace[i-1].grade-trace[i].grade<=Math.ceil(trace[i-1].grade/2),`grade ${grade}: bracketed step at ${i}`);
  assert.ok(trace.slice(0,6).every(s=>s.grade>0),`grade ${grade}: K is not reached within six items`);
 }
});

test('one slip followed by success does not cascade to easier skills',()=>{
 for(const grade of [3,4] as const){
  const trace=simulate(grade,i=>i!==0,16);
  assert.equal(trace[1].skillId,trace[0].skillId,'Retry the missed skill rather than stepping down');
  assert.ok(trace.every(s=>s.reason!=='support'),`grade ${grade}: ${trace.map(s=>`${s.skillId}:${s.reason}`).join(' ')}`);
  assert.ok(trace.every(s=>s.grade>=Math.min(...trace.slice(0,1).map(t=>t.grade))-2));
 }
});

test('after repeated misses a demonstrated skill is interleaved before returning one bracket lower',()=>{
 let state=createLearner('a',3);
 for(let i=0;i<3;i++)state=success(state,{...generateFreshPractice('K.OA.A.5',state,40+i),id:`known-${i}`},`known-${i}`);
 for(let i=0;i<3;i++){
  const t={...generateFreshPractice('3.OA.A.1',state,60+i),id:`hard-${i}`};
  state=recordAttempt(state,t,{id:`hard-answer-${i}`,answer:'-999',at:date(1),hintsUsed:i===2?1:0});
 }
 const pause=selectCandidates(state,date(1))[0];
 assert.equal(pause.skill.id,'K.OA.A.5');assert.equal(pause.reason,'confidence');
 state=success(state,{...generateFreshPractice('K.OA.A.5',state,70),id:'confidence'},'confidence');
 const back=selectCandidates(state,date(1))[0];
 assert.equal(back.reason,'support');assert.equal(back.skill.id,'2.OA.C.4','Return between the demonstrated grade and the missed grade');
 assert.equal(state.progress['3.OA.A.1'].concept,'developing','Selection does not alter evidence');
});

test('placement probes back up after succeeding below a confirmed miss',()=>{
 let state=createLearner('a',4);
 for(let i=0;i<3;i++){const t={...generateFreshPractice('4.OA.C.5',state,80+i),id:`seq-${i}`};state=recordAttempt(state,t,{id:`seq-answer-${i}`,answer:'-999',at:date(1)});}
 const down=selectCandidates(state,date(1))[0];
 assert.equal(down.reason,'support');assert.equal(down.skill.grade,2,'Halve the grade gap instead of walking every prerequisite');
 state=success(state,{...generateFreshPractice(down.skill.id,state,90),id:'probe'},'probe');
 const up=selectCandidates(state,date(1))[0];
 assert.ok(['support','placement'].includes(up.reason));assert.equal(up.skill.grade,3,'Probe the middle of the remaining gap');
 // After a demonstrated-skill interlude, the same bracket still closes upward.
 state=success(state,{...generateFreshPractice(up.skill.id,state,91),id:'probe-up'},'probe-up');
 assert.ok(selectCandidates(state,date(1))[0].skill.grade!==2,'A bracketed success does not fall back below it');
});

test('a worked example never solves the displayed task, even reordered or inverted',()=>{
 const learner=createLearner('a');
 const numbers=(a:Activity)=>[...Object.values(a.task).flat().filter(v=>typeof v==='string'||typeof v==='number').map(String).filter(v=>/^-?\d/.test(v)),expectedAnswer(a.task)].sort().join(',');
 for(const skillId of ['K.CC.A.2','K.OA.A.5','1.OA.B.4','1.OA.C.6','2.OA.C.4','3.OA.A.1','3.OA.A.2','3.OA.C.7','5.NF.A.1'])for(let seed=1;seed<=300;seed++){
  const item=generateFreshPractice(skillId,learner,seed);
  const example=workedExampleHint(item,learner,seed);
  assert.ok(example.length<=1200);
  assert.ok(!example.includes(item.prompt),`${skillId}: must not restate the displayed task`);
  const match=/worked out first: (.*)\n\n/.exec(example);
  if(!match)continue; // A generic hint when no safe sibling task exists.
  const shown=generateFreshPractice(skillId,learner,seed);
  const sibling=[...Array(400).keys()].map(i=>generatePractice(skillId,i)).find(a=>a.prompt===match[1]);
  if(!sibling)continue;
  assert.notEqual(expectedAnswer(sibling.task),expectedAnswer(shown.task),`${skillId} seed ${seed}: same result`);
  assert.notEqual(numbers(sibling),numbers(shown),`${skillId} seed ${seed}: same quantities`);
 }
 assert.match(workedExampleHint(generatePractice('3.OA.C.7',5),learner,5),/worked/i);
});

test('assisted successes do not loop one skill either',()=>{
 for(const grade of [3,4] as const){
  let state=createLearner('hinted',grade);const ids:string[]=[];
  for(let i=0;i<16;i++){
   const at=new Date(Date.UTC(2026,8,1,12,0,i)).toISOString();
   const chosen=selectCandidates(state,at)[0];
   const task={...generateFreshPractice(chosen.skill.id,state,2000+i),id:`hinted-${i}`};
   // Taps a hint every time and then answers correctly.
   state=recordAttempt(state,task,{id:`hinted-answer-${i}`,answer:expectedAnswer(task.task),at,hintsUsed:1});ids.push(chosen.skill.id);
  }
  const run=ids.reduce((r,id,i)=>{const n=i&&ids[i-1]===id?r.n+1:1;return {n,max:Math.max(r.max,n)};},{n:0,max:0}).max;
  assert.ok(run<=4,`grade ${grade}: ${ids.join(' ')}`);
 }
});

test('a miss rescued by the forgiving retry still counts toward changing the approach',()=>{
 let state=createLearner('rescued',3);const trace:{id:string;approach?:string}[]=[];
 for(let i=0;i<12;i++){
  const at=new Date(Date.UTC(2026,8,1,12,0,i)).toISOString();
  const chosen=selectCandidates(state,at)[0];
  const task={...generateFreshPractice(chosen.skill.id,state,3000+i),id:`rescued-${i}`},expected=expectedAnswer(task.task);
  // Always wrong first, then right after the nudge (a two-choice guesser always is).
  state=recordAttempt(state,task,{id:`rescued-answer-${i}`,answer:expected,firstAnswer:wrongAnswer(expected),at,hintsUsed:1+(chosen.approach?1:0)});
  trace.push({id:chosen.skill.id,...(chosen.approach?{approach:chosen.approach}:{})});
 }
 assert.deepEqual(recentStreak(state.attempts,trace.at(-1)!.id).successes,0);
 assert.equal(trace[1].id,trace[0].id);assert.equal(trace[2].approach,'worked-example','Two rescued misses change the approach');
 assert.ok(longestRun(trace.map(t=>({skillId:t.id})) as Step[])<=3);
});
test('replaying stored evidence never throws on a first answer that a later grader accepts',()=>{
 const a=generatePractice('3.OA.C.7',4),expected=expectedAnswer(a.task);
 assert.throws(()=>recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:expected}),/first answer/i);
 const replayed=recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:expected,at:date(1)},{replay:true});
 assert.equal(replayed.attempts[0].independent,false,'Still assisted, never laundered');
 assert.throws(()=>recordAttempt(createLearner('a'),a,{id:'x',answer:expected,firstAnswer:'1'.repeat(81)},{replay:true}));
});
