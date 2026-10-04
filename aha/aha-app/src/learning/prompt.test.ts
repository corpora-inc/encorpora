import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorContext } from './prompt';
import { createLearner, recordAttempt, selectCandidates } from './engine';
import { generateFreshPractice } from './practice';
import { expectedAnswer, validateActivity } from './tasks';
import type { Activity, LearnerState } from './types';

const now='2026-09-28T12:00:00.000Z';
function practice(state:LearnerState,skillId:string,seed:number,mode:Activity['mode']='concept',answer?:string):LearnerState {
 const activity={...generateFreshPractice(skillId,state,seed,mode),id:`question-${state.attempts.length}`};
 return recordAttempt(state,activity,{id:`answer-${state.attempts.length}`,answer:answer??expectedAnswer(activity.task),at:now,activeMs:1000});
}
function frontier() {
 let state=createLearner('PRIVATE_LOCAL_PROFILE',4);
 for(let i=0;i<3;i++)state=practice(state,'3.OA.C.7',10+i);
 for(let i=0;i<9;i++)state=practice(state,'5.NF.A.1',30+i);
 return state;
}

test('live tutor receives an eligible older fact skill after moving to another concept',()=>{
 const state=frontier();
 assert.ok(!selectCandidates(state,now,8).some(c=>c.skill.id==='3.OA.C.7'));
 const prompt=buildTutorContext(state,now,8),context=JSON.parse(prompt.context);
 assert.deepEqual(context.fluencyOpportunity,{skillId:'3.OA.C.7',mode:'fluency'});
 assert.equal(prompt.candidates.length,8);
 const task=generateFreshPractice('3.OA.C.7',state,200,'fluency');
 assert.equal(validateActivity(task,prompt.candidates.map(c=>c.skill.id)).ok,true);
 assert.match(prompt.system,/optional practice opportunity/);
 assert.ok(prompt.context.length<16000);
 assert.ok(!prompt.context.includes('PRIVATE_LOCAL_PROFILE'));
});

test('the live fluency opportunity pauses after the daily allowance without blocking conceptual candidates',()=>{
 let state=frontier();
 for(let i=0;i<6;i++)state=practice(state,'3.OA.C.7',80+i,'fluency');
 state=practice(state,'5.NF.A.1',150);
 const prompt=buildTutorContext(state,now);
 assert.equal(JSON.parse(prompt.context).fluencyOpportunity,undefined);
 assert.ok(prompt.candidates.length>0);
 assert.equal(state.progress['3.OA.C.7'].fluency,'developing');
});

test('fluency injection never evicts a due review or immediate prerequisite support',()=>{
 const state=frontier();
 const tomorrow='2026-09-29T12:00:00.000Z';
 const reviews=selectCandidates(state,tomorrow,2);
 assert.ok(reviews.every(c=>c.reason==='due-review'));
 const reviewPrompt=buildTutorContext(state,tomorrow,2);
 assert.deepEqual(reviewPrompt.candidates,reviews);
 assert.equal(JSON.parse(reviewPrompt.context).fluencyOpportunity,undefined);
 // One miss is retried; support follows a confirmed difficulty and a brief success elsewhere.
 let struggling=state;
 for(let i=0;i<3;i++)struggling=practice(struggling,'4.NBT.B.5',200+i,'concept','-999');
 const pause=selectCandidates(struggling,now,1)[0];
 assert.equal(pause.reason,'confidence');
 struggling=practice(struggling,pause.skill.id,210);
 const support=selectCandidates(struggling,now,1);
 assert.equal(support[0].reason,'support');
 const supportPrompt=buildTutorContext(struggling,now,1);
 assert.deepEqual(supportPrompt.candidates,support);
 assert.equal(JSON.parse(supportPrompt.context).fluencyOpportunity,undefined);
});
