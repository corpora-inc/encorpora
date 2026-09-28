import type { Activity, AttemptEvidence, AttemptInput, Candidate, Grade, LearnerState, Skill, SkillProgress } from './types';
import { getSkill, skills } from './curriculum';
import { gradeAnswer, validateActivity } from './tasks';
export const REVIEW_DAYS = [1,3,7,14,30] as const;
export const DAILY_FLUENCY_LIMIT = 6;
const DAY=86400000;
function timestamp(value:string):number {const n=Date.parse(value);if(!Number.isFinite(n))throw new Error('Use a valid timestamp.');return n;}
export function createLearner(learnerId:string,startGrade:Grade=4):LearnerState {
 if(!learnerId||learnerId.length>100||!['K',1,2,3,4,5,6,7,8].includes(startGrade))throw new Error('Invalid learner profile.');
 return {version:1,learnerId,startGrade,progress:{},attempts:[]};
}
/** Immutable reducer. Persist returned state plus evidence in one native transaction. */
export function recordAttempt(state:LearnerState,activity:Activity,input:AttemptInput):LearnerState {
 if(!input.id||input.id.length>100)throw new Error('Attempt requires a stable ID.');
 if(state.attempts.some(a=>a.id===input.id))return state;
 // A displayed activity is submitted once. Retries need a new activity, not duplicate evidence.
 if(state.attempts.some(a=>a.activityId===activity.id))return state;
 const validation=validateActivity(activity);if(!validation.ok)throw new Error(validation.errors.join(' '));
 const checked=validation.activity, skill=getSkill(checked.skillId)!;
 const result=gradeAnswer(checked,input.answer);
 if(result.error)throw new Error(result.error); // An input parse error is not mathematical failure.
 const at=new Date(timestamp(input.at??new Date().toISOString())).toISOString(); const now=timestamp(at);
 const previous=state.progress[skill.id];
 if(previous&&now<timestamp(previous.lastAttemptAt))throw new Error('Attempt time predates existing evidence.');
 const hintsUsed=input.hintsUsed??0;
 if(!Number.isInteger(hintsUsed)||hintsUsed<0||hintsUsed>100)throw new Error('Invalid hint count.');
 const activeMs=input.activeMs??null;
 if(activeMs!==null&&(!Number.isFinite(activeMs)||activeMs<0||activeMs>3600000))throw new Error('Invalid active response time.');
 if(typeof input.answer!=='string'||input.answer.length>80)throw new Error('Answer is too long.');
 const interrupted=input.interrupted??false;
 const independent=result.correct&&hintsUsed===0;
 const evidence:AttemptEvidence={id:input.id,activityId:checked.id,skillId:skill.id,at,correct:result.correct,
  answer:input.answer,expected:result.expected,task:checked.task,variant:checked.variant,mode:checked.mode,...(checked.choices?{choices:checked.choices}:{}),
  hintsUsed,activeMs,interrupted,independent};
 const attempts=[...state.attempts,evidence];
 const history=attempts.filter(a=>a.skillId===skill.id&&!a.excluded);
 const sinceError=history.slice(history.map(a=>!a.independent).lastIndexOf(true)+1);
 const independentSuccesses=sinceError.length;
 const distinctVariants=[...new Set(sinceError.map(a=>a.variant))];
 const provisional=distinctVariants.length>=3;
 // Fluency is optional and evidence-based: diverse facts, two dates, no hidden/background time.
 const recent=sinceError.filter(a=>a.mode==='fluency'&&!a.choices).slice(-12);
 const timed=recent.length===12&&recent.every(a=>a.mode==='fluency'&&!a.choices&&a.independent&&!a.interrupted&&a.activeMs!==null&&a.activeMs>=250&&a.activeMs<=skill.fluencyTargetMs!);
 const fluent=!!skill.fluencyTargetMs&&timed&&new Set(recent.map(a=>a.variant)).size>=8&&new Set(recent.map(a=>a.at.slice(0,10))).size>=2;
 let reviewStage=previous?.reviewStage??0;
 let retention=previous?.retention??'unconfirmed';
 let nextReviewAt=previous?.nextReviewAt??null;
 if(!independent) {reviewStage=0;retention='unconfirmed';nextReviewAt=new Date(now+DAY).toISOString();}
 else if(provisional) {
  if(previous?.concept==='provisional'&&checked.mode==='review'&&previous.nextReviewAt&&now>=timestamp(previous.nextReviewAt)) {
   reviewStage=Math.min(reviewStage+1,REVIEW_DAYS.length);
   // A single next-day success is encouraging; require the later delayed check too.
   if(reviewStage>=2)retention='retained';
   nextReviewAt=new Date(now+REVIEW_DAYS[Math.min(reviewStage,REVIEW_DAYS.length-1)]*DAY).toISOString();
  } else if(!nextReviewAt||previous?.concept!=='provisional') nextReviewAt=new Date(now+DAY).toISOString();
 }
 const progress:SkillProgress={skillId:skill.id,concept:provisional?'provisional':'developing',
  fluency:skill.fluencyTargetMs?(fluent?'fluent':'developing'):'not-applicable',retention,
  independentSuccesses,distinctVariants,reviewStage,nextReviewAt,lastAttemptAt:at};
 return {...state,attempts,progress:{...state.progress,[skill.id]:progress}};
}
/** Transparent candidate menu for the LLM, not a hidden ability score or forced lesson sequence. */
export function selectCandidates(state:LearnerState,now:string=new Date().toISOString(),limit=12):Candidate[] {
 const time=timestamp(now); if(!Number.isInteger(limit)||limit<1||limit>40)throw new Error('Candidate limit must be 1–40.');
 const candidates:Candidate[]=[]; const added=new Set<string>();
 const add=(id:string,reason:Candidate['reason'])=>{const skill=getSkill(id);if(skill?.coverage==='verified-practice'&&!added.has(id)){added.add(id);candidates.push({skill,reason});}};
 const progress=Object.values(state.progress);
 progress.filter(p=>p.nextReviewAt&&timestamp(p.nextReviewAt)<=time).sort((a,b)=>timestamp(a.nextReviewAt!)-timestamp(b.nextReviewAt!)).forEach(p=>add(p.skillId,'due-review'));
 const validAttempts=state.attempts.filter(a=>!a.excluded);
 const last=validAttempts.at(-1);
 if(last) {
  // A demonstrated prerequisite does not need re-teaching after one slip on a harder skill.
  if(!last.independent)getSkill(last.skillId)?.prerequisites.filter(id=>state.progress[id]?.concept!=='provisional').forEach(id=>add(id,'support'));
  const p=state.progress[last.skillId];
  if(p?.concept!=='provisional')add(last.skillId,'continue');
  skills.filter(s=>state.progress[s.id]?.concept!=='provisional'&&s.prerequisites.includes(last.skillId)&&s.prerequisites.every(id=>state.progress[id]?.concept==='provisional')).forEach(s=>add(s.id,'frontier'));
 }
 progress.filter(p=>p.concept==='developing').forEach(p=>add(p.skillId,'continue'));
 const grade=state.startGrade==='K'?0:state.startGrade;
 // Starting grade is only a placement hint. A learner can demonstrate a higher level directly.
 const untried=skills.filter(s=>s.coverage==='verified-practice'&&!state.progress[s.id]).sort((a,b)=>Math.abs((a.grade==='K'?0:a.grade)-grade)-Math.abs((b.grade==='K'?0:b.grade)-grade));
 const domainCounts=new Map<string,number>();
 for(const a of validAttempts.slice(0,12)){const d=getSkill(a.skillId)?.domain??'';domainCounts.set(d,(domainCounts.get(d)??0)+1);}
 const firstByDomain=new Map<string,typeof skills[number]>();
 for(const s of untried)if(Math.abs((s.grade==='K'?0:s.grade)-grade)<=2&&!firstByDomain.has(s.domain))firstByDomain.set(s.domain,s);
 const placement=[...firstByDomain.values()].sort((a,b)=>(domainCounts.get(a.domain)??0)-(domainCounts.get(b.domain)??0));
 if(validAttempts.length<12) {
  // During the short placement sample, sample new domains before simply drilling a correct skill.
  const previousMenu=candidates.splice(0);added.clear();
  previousMenu.filter(c=>c.reason==='due-review'||c.reason==='support'||!last?.independent&&c.skill.id===last?.skillId).forEach(c=>add(c.skill.id,c.reason));
  placement.forEach(s=>add(s.id,'placement'));
  previousMenu.forEach(c=>add(c.skill.id,c.reason));
 } else placement.forEach(s=>add(s.id,'placement'));
 // Fluency needs evidence across dates. Keep it available without making endless
 // same-day recall the only next step, even when another frontier prerequisite is unseen.
 if(last&&state.progress[last.skillId]?.concept==='provisional'&&state.progress[last.skillId]?.fluency==='developing')add(last.skillId,'continue');
 untried.forEach(s=>add(s.id,'placement'));
 return candidates.slice(0,limit);
}

/** Interleave brief recall from the whole learned frontier, not just the last question.
 * UTC dates match the evidence reducer's multi-day fluency rule. Every timed attempt
 * counts toward the daily practice limit, including errors and interrupted answers.
 */
export function selectFluencySkill(state:LearnerState,now:string=new Date().toISOString()):Skill|undefined {
 // A fresh error or assisted answer needs focused support before unrelated recall.
 if(state.attempts.filter(a=>!a.excluded).at(-1)?.independent===false)return undefined;
 const today=new Date(timestamp(now)).toISOString().slice(0,10);
 const practice=new Map<string,{today:number;last:number}>();
 for(const attempt of state.attempts) {
  if(attempt.excluded||attempt.mode!=='fluency')continue;
  const previous=practice.get(attempt.skillId)??{today:0,last:0};
  const at=timestamp(attempt.at);
  if(new Date(at).toISOString().slice(0,10)===today)previous.today++;
  previous.last=Math.max(previous.last,at);
  practice.set(attempt.skillId,previous);
 }
 return Object.values(state.progress)
  .filter(p=>p.concept==='provisional'&&p.fluency==='developing')
  .map(p=>getSkill(p.skillId))
  .filter((skill):skill is Skill=>!!skill&&skill.coverage==='verified-practice'&&!!skill.fluencyTargetMs&&(practice.get(skill.id)?.today??0)<DAILY_FLUENCY_LIMIT)
  .sort((a,b)=>(practice.get(a.id)?.today??0)-(practice.get(b.id)?.today??0)||
   (practice.get(a.id)?.last??0)-(practice.get(b.id)?.last??0)||a.id.localeCompare(b.id))[0];
}
/** Native/UI calls this only for time accumulated while the task is visible and app foregrounded. */
export class ActiveTimer {
 private accumulated=0; private started:number|null=null; private pausedAfterStart=false;
 resume(now:number) {if(!Number.isFinite(now))throw new Error('Invalid clock.');if(this.started===null)this.started=now;}
 pause(now:number) {if(!Number.isFinite(now))throw new Error('Invalid clock.');if(this.started!==null){this.accumulated+=Math.max(0,now-this.started);this.started=null;this.pausedAfterStart=true;}}
 snapshot(now:number) {return {activeMs:Math.min(3600000,this.accumulated+(this.started===null?0:Math.max(0,now-this.started))),interrupted:this.pausedAfterStart};}
}

/** Recompute projections from non-quarantined facts; keep the complete original audit trail. */
export function rebuildProgress(state:LearnerState):LearnerState {
 let rebuilt=createLearner(state.learnerId,state.startGrade);
 for(const e of state.attempts.filter(a=>!a.excluded).slice().sort((a,b)=>timestamp(a.at)-timestamp(b.at))) {
  const checked=validateActivity({version:1,id:e.activityId,skillId:e.skillId,mode:e.mode,task:e.task,...(e.choices?{choices:e.choices}:{})});
  if(!checked.ok)throw new Error(`Cannot rebuild invalid evidence ${e.id}.`);
  rebuilt=recordAttempt(rebuilt,checked.activity,{id:e.id,answer:e.answer,at:e.at,hintsUsed:e.hintsUsed,activeMs:e.activeMs,interrupted:e.interrupted});
 }
 return {...state,progress:rebuilt.progress};
}
export function quarantineActivity(state:LearnerState,activityId:string,reason:string,at=new Date().toISOString()):LearnerState {
 if(!reason.trim()||reason.length>500)throw new Error('Supply a concise dispute reason.');
 const when=new Date(timestamp(at)).toISOString();
 const attempts=state.attempts.map(a=>a.activityId===activityId&&!a.excluded?{...a,excluded:{reason,at:when}}:a);
 return rebuildProgress({...state,attempts});
}
