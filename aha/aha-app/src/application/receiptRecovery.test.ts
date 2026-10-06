import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, SdkError } from '@free2z/sdk';
import type { ChatEvent, ChatRequest, ChatStream, Grant, Session } from '@free2z/sdk';
import { Free2zTutor, verifyPaidGrant, type Journal, type PaidAuthorization, type SdkClient, type TutorReply } from '../provider/free2z.ts';
import { OTHER_LEARNER_NOTE, PERSISTENT_MS, PERSISTENT_NOTE, RETRY_BASE_MS, ReceiptRecovery, type RecoveryHooks } from './receiptRecovery.ts';

/**
 * The real provider over a TEST-ONLY fake SDK. A "restart" is a new Free2zTutor over the same journal, exactly as the
 * app builds one at launch. No live service.
 */
const session: Session = {signedIn:true,subject:'adult',generation:'one',grantedScopes:['ai:invoke'],persistence:'persistent'};
const grant = (): Grant => ({sub:'adult',client_id:'aha-client',account_epoch:1n,grant_generation:1n,scopes:['ai:invoke'],spend_cap_2z:100n,cap_period:'month',enforced:true,enforcement_reason:'ok',as_of:new Date().toISOString()});
const done: ChatEvent = {type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}} as ChatEvent;
const batch = {kind:'activities' as const,profileId:'learner-1',allowedSkillIds:['skill-a']};

function world() {
  let value: unknown;
  const chats: {request: ChatRequest; key: string; operationId: string}[] = [];
  const reads: string[] = [];
  const knobs = {
    /** The next chat stream: cut off mid-reply (a restart), complete, or refused before opening. */
    stream: 'complete' as 'complete' | 'cut' | 'refuse',
    offline: false,
    callCharge: 'charged' as 'charged' | 'pending',
  };
  const journal: Journal = {getJournal:async()=>structuredClone(value),putJournal:async(key,v)=>{if(key==='aha-billing-v1')value=structuredClone(v);}};
  const client: SdkClient = {
    session:async()=>session, signIn:async()=>session, signOut:async()=>({revoked:true,generation:'two'}),
    balance:async()=>({available_milli_2z:500000n,held_milli_2z:0n,balance_milli_2z:500000n,debt_milli_2z:0n,as_of:new Date().toISOString()}),
    grant:async()=>{if(knobs.offline)throw new SdkError('unavailable');return grant();},
    models:async()=>({models:[{id:'verified-model',capabilities:{},prices:{}}],catalog_version:1n}) as any,
    estimate:async(request)=>{if(knobs.offline)throw new SdkError('unavailable');return {model:'verified-model',input_tokens:10n,max_output_tokens:request.max_output_tokens??0n,hold_2z:1n,available_milli_2z:500000n,cap_remaining_milli_2z:100000n};},
    preflight(request){return Client.prototype.preflight.call(this as unknown as Client,request);},
    call:async(id)=>{reads.push(id);if(knobs.offline)throw new SdkError('unavailable');
      return {call_id:id,status:'settled',charge:knobs.callCharge==='pending'?{state:'pending'}:{state:'charged',charged2z:2n,receiptId:'receipt'}} as any;},
    chat:async(request,options)=>{
      if(knobs.offline)throw new SdkError('unavailable');
      chats.push({request,key:options.idempotencyKey,operationId:options.operationId});
      if(knobs.stream==='refuse')throw new SdkError('unavailable');
      const events: ChatEvent[] = [{type:'meta',call_id:'call-1',model:'verified-model',hold_2z:1n} as ChatEvent,{type:'delta',text:'{"activities":[]}'},...(knobs.stream==='cut'?[]:[done])];
      const iterator=(async function*(){for(const e of events)yield e;})();
      return Object.assign(iterator,{operationId:options.operationId,idempotencyKey:options.idempotencyKey,callId:'call-1',cancel:async()=>{}}) as ChatStream;
    },
  };
  const authorize = async (): Promise<PaidAuthorization> => {
    const policy = {subject:'adult',clientId:'aha-client'};
    return {...policy,verifiedGrant:await verifyPaidGrant(client,policy)};
  };
  const logs: string[] = [];
  const delivered: TutorReply[] = [];
  const hooks = (tutor: Free2zTutor, profileId = 'learner-1'): RecoveryHooks => ({
    tutor, authorize, profileId:()=>profileId, deliver:async r=>{delivered.push(r);}, log:(level,m)=>logs.push(`${level} ${m}`),
  });
  /** A batch in flight when the app restarted: journaled, sent, never settled locally. */
  async function interruptedBatch(how: 'cut' | 'refuse' = 'cut') {
    const before = new Free2zTutor(client,journal,'adult');
    knobs.stream = how;
    await assert.rejects(before.reply('verified-model','system','LEARNER context',await authorize(),batch,'2600'));
    knobs.stream = 'complete';
    const op = (value as any).operations[0];
    assert.notEqual(op.state,'finalized');
    return op as {id: string; key: string; createdAt: string};
  }
  return {client,journal,knobs,chats,reads,logs,delivered,hooks,authorize,interruptedBatch,
    restart:()=>new Free2zTutor(client,journal,'adult'),
    journalValue:()=>value as any,setJournal:(v:unknown)=>{value=structuredClone(v);}};
}

test('launch with an unsettled batch: recovered automatically with its original key, then AI resumes', async () => {
  const w = world();
  const op = await w.interruptedBatch('refuse');
  const tutor = w.restart();
  await assert.rejects(tutor.reply('verified-model','s','LEARNER c',await w.authorize(),batch,'2600'),{code:'settlement_pending'},'blocked before recovery');
  const chatsBefore = w.chats.length;
  const outcome = await new ReceiptRecovery().run('launch', w.hooks(tutor), {force:true});
  assert.equal(outcome.state,'clear');
  assert.equal(outcome.authorized,true);
  assert.equal(outcome.note,undefined,'no note when recovery works');
  assert.equal(w.chats.length,chatsBefore+1,'exactly one same-key resend');
  assert.equal(w.chats.at(-1)!.key,op.key,'the original Idempotency-Key');
  assert.equal(w.chats.at(-1)!.operationId,op.id,'the original operation');
  assert.deepEqual(w.chats.at(-1)!.request,w.chats[0].request,'the identical body');
  assert.equal(w.delivered.length,1,'the recovered batch is delivered to the learner');
  assert.equal(w.delivered[0].context?.kind,'activities');
  assert.ok(w.logs.some(l=>/launch: every earlier AI request is settled/.test(l)));
  // The block is cleared by the settled journal, not by the recovery: the next batch goes out.
  await tutor.acknowledgeReply(w.delivered[0].operationId);
  const next = await tutor.reply('verified-model','s','LEARNER c',await w.authorize(),batch,'2600');
  assert.ok(next.text,'AI resumes with no manual step');
});

test('an interrupted call that reached the gateway settles from its receipt; no request is resent', async () => {
  const w = world();
  const op = await w.interruptedBatch('cut');
  const tutor = w.restart();
  const chatsBefore = w.chats.length;
  const outcome = await new ReceiptRecovery().run('launch', w.hooks(tutor), {force:true});
  assert.equal(outcome.state,'clear');
  assert.deepEqual(w.reads,['call-1'],'GET /v1/calls/{id} for the original call');
  assert.equal(w.chats.length,chatsBefore,'no chat at all: the settled record was enough');
  assert.equal(w.journalValue().operations.find((o:any)=>o.id===op.id).charge.charged2z,'2','charged once, on the record');
});

test('a receipt still pending at the gateway falls back to same-key recovery, never a new key', async () => {
  const w = world();
  const op = await w.interruptedBatch('cut');
  const tutor = w.restart();
  w.knobs.callCharge = 'pending';
  const outcome = await new ReceiptRecovery().run('resume', w.hooks(tutor), {force:true});
  assert.equal(outcome.state,'clear');
  assert.ok(w.chats.slice(1).every(c=>c.key===op.key&&c.operationId===op.id),'every resend carries the original key');
  assert.equal(new Set(w.chats.map(c=>c.key)).size,1,'no fresh key was ever minted for recovery');
});

test('offline: blocked with backoff, no paid call of any kind, and the block stays', async () => {
  const w = world();
  const op = await w.interruptedBatch('refuse');
  const tutor = w.restart();
  w.knobs.offline = true;
  let now = Date.parse(op.createdAt) + 1000;
  const recovery = new ReceiptRecovery(()=>now);
  const chatsBefore = w.chats.length;
  const first = await recovery.run('launch', w.hooks(tutor), {force:true});
  assert.equal(first.state,'blocked');
  assert.equal(first.retryInMs,RETRY_BASE_MS);
  assert.equal(first.note,undefined,'a transient outage is not a Settings note');
  assert.equal(w.chats.length,chatsBefore,'nothing was sent');
  // Automatic triggers inside the backoff do nothing at all.
  now += 1000;
  const early = await recovery.run('resume', w.hooks(tutor));
  assert.equal(early.state,'deferred');
  assert.equal(early.retryInMs,RETRY_BASE_MS-1000);
  now += RETRY_BASE_MS;
  const second = await recovery.run('retry', w.hooks(tutor));
  assert.equal(second.state,'blocked');
  assert.equal(second.retryInMs,RETRY_BASE_MS*2,'the backoff doubles');
  assert.equal(w.chats.length,chatsBefore);
  w.knobs.offline = false;
  await assert.rejects(tutor.reply('verified-model','s','LEARNER c',await w.authorize(),batch,'2600'),{code:'settlement_pending'},'still blocked: never a new paid call while unsettled');
  assert.equal(w.chats.length,chatsBefore);
  assert.ok(w.logs.some(l=>/still unsettled .*unavailable.*retrying in 15 s/.test(l)),'each attempt is logged');
  // Back online: the next due attempt recovers.
  now += RETRY_BASE_MS*2;
  assert.equal((await recovery.run('retry', w.hooks(tutor))).state,'clear');
  assert.equal(w.chats.at(-1)!.key,op.key);
  assert.equal(recovery.failedAttempts,0);
});

test('persistent failure: unsettled for a day, or a definitive error, produces the Settings note', async () => {
  const w = world();
  const op = await w.interruptedBatch('cut');
  w.knobs.offline = true;
  const late = new ReceiptRecovery(()=>Date.parse(op.createdAt)+PERSISTENT_MS+1);
  const outcome = await late.run('resume', w.hooks(w.restart()), {force:true});
  assert.equal(outcome.state,'blocked');
  assert.equal(outcome.note,PERSISTENT_NOTE);
  assert.ok(w.logs.some(l=>/^warn .*still unsettled/.test(l)),'a persistent failure is logged as a warning');

  // Past the same-key window with no call id: nothing automatic can settle it.
  const v = world();
  const stuck = await v.interruptedBatch('refuse');
  const journal = v.journalValue();
  journal.operations[0].createdAt = new Date(Date.parse(stuck.createdAt)-PERSISTENT_MS-1000).toISOString();
  v.setJournal(journal);
  const expired = await new ReceiptRecovery().run('launch', v.hooks(v.restart()), {force:true});
  assert.equal(expired.state,'blocked');
  assert.equal(expired.note,PERSISTENT_NOTE);
});

test('an operation of another learner waits for that learner; nothing is resent for it', async () => {
  const w = world();
  await w.interruptedBatch('refuse');
  const chatsBefore = w.chats.length;
  const outcome = await new ReceiptRecovery().run('launch', w.hooks(w.restart(), 'learner-2'), {force:true});
  assert.equal(outcome.state,'blocked');
  assert.equal(outcome.note,OTHER_LEARNER_NOTE);
  assert.equal(w.chats.length,chatsBefore);
});

test('the note is kept while deferred, and selecting the learner makes their request due at once', async () => {
  const w = world();
  const op = await w.interruptedBatch('refuse');
  const tutor = w.restart();
  let learner = 'learner-2';
  const hooks = {...w.hooks(tutor), profileId:()=>learner};
  const recovery = new ReceiptRecovery();
  assert.equal((await recovery.run('launch', hooks, {force:true})).note,OTHER_LEARNER_NOTE);
  const deferred = await recovery.run('resume', hooks);
  assert.equal(deferred.state,'deferred');
  assert.equal(deferred.note,OTHER_LEARNER_NOTE,'no flicker while deferred');
  learner = 'learner-1';
  recovery.learnerChanged();
  const outcome = await recovery.run('resume', hooks);
  assert.equal(outcome.state,'clear');
  assert.equal(w.chats.at(-1)!.key,op.key);
});

test('nothing pending: clear without any service call or log noise', async () => {
  const w = world();
  const outcome = await new ReceiptRecovery().run('resume', w.hooks(w.restart()));
  assert.deepEqual(outcome,{state:'clear',pending:0,attempted:false,authorized:false});
  assert.equal(w.chats.length,0);
  assert.equal(w.reads.length,0);
  assert.deepEqual(w.logs,[]);
});

test('concurrent triggers share one attempt (one resend at most)', async () => {
  const w = world();
  await w.interruptedBatch('refuse');
  const tutor = w.restart();
  const recovery = new ReceiptRecovery();
  const chatsBefore = w.chats.length;
  const [a, b] = await Promise.all([recovery.run('launch', w.hooks(tutor), {force:true}), recovery.run('resume', w.hooks(tutor))]);
  assert.equal(a, b);
  assert.equal(a.state,'clear');
  assert.equal(w.chats.length,chatsBefore+1);
});
