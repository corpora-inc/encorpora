import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearner, expectedAnswer, generatePractice, recordAttempt } from '../learning';
import { learningCheckpoint } from './checkpoint';
import { restoreLearning } from './recovery';

test('growing practice history never inflates a native checkpoint to its record limit', () => {
  const question = generatePractice('3.OA.A.1', 4);
  const state = recordAttempt(createLearner('learner', 3), question, {id:'attempt',answer:expectedAnswer(question.task)});
  const short = learningCheckpoint(state);
  state.attempts = Array.from({length:50_000}, (_,i)=>({...state.attempts[0],id:`attempt-${i}`}));
  state.progress[question.skillId].distinctVariants = Array.from({length:50_000}, (_,i)=>`variant-${i}`);
  const checkpoint = learningCheckpoint(state);
  assert.deepEqual(checkpoint, short);
  assert.ok(Buffer.byteLength(JSON.stringify(checkpoint)) < 4096);
  assert.equal(state.attempts.length, 50_000, 'compaction never mutates the live evidence');
});

test('compact snapshots and presentation-only sessions rebuild all authoritative evidence', () => {
  let state = createLearner('learner', 3);
  const attempts = [];
  for(let i=0;i<4;i++) {
    const activity = {...generatePractice('3.OA.A.1',i),id:`question-${i}`};
    state = recordAttempt(state,activity,{id:`answer-${i}`,answer:expectedAnswer(activity.task),at:new Date(1_790_000_000_000+i).toISOString()});
    const evidence = state.attempts.at(-1)!;
    attempts.push({id:evidence.id,activityId:activity.id,sessionId:'session',createdAt:evidence.at,data:evidence});
  }
  const session = {id:'session',updatedAt:new Date().toISOString(),data:{sessionId:'session',activity:null,hintsUsed:0,completed:4}};
  const restored = restoreLearning({id:'learner',grade:3},learningCheckpoint(state),session,attempts,[]);
  assert.deepEqual(restored.learner,state);
  assert.equal(restored.completed,4);
});
