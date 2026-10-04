import test from 'node:test';
import assert from 'node:assert/strict';
import { SdkError } from '@free2z/sdk';
import type { ChatEvent, ChatRequest, ChatStream, Session } from '@free2z/sdk';
import { Free2zTutor, format2z, verifyTestGrant, type Journal, type SdkClient } from './free2z.ts';
const session: Session = {signedIn:true,subject:'adult',generation:'one',grantedScopes:['ai:invoke'],persistence:'persistent'};
function fixture(events: ChatEvent[] = [{type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}]) {
  let value: unknown; const calls: {request:ChatRequest; options:any}[] = []; let activeSession = session;
  let cap: bigint | null = 500000n; let cancelled = 0;
  const journal: Journal = {getJournal:async()=>structuredClone(value),putJournal:async(key,v)=>{if(key==='aha-billing-v1')value=structuredClone(v);}};
  const client: SdkClient = {
    session:async()=>activeSession, signIn:async()=>session, signOut:async()=>({revoked:true,generation:'two'}),
    balance:async()=>({available_milli_2z:500000n,held_milli_2z:0n,balance_milli_2z:500000n,debt_milli_2z:0n,as_of:new Date().toISOString()}),
    grant:async()=>({sub:'adult',client_id:'aha-client',account_epoch:1n,grant_generation:1n,scopes:['ai:invoke'],spend_cap_2z:500n,cap_period:'total',enforced:true,as_of:new Date().toISOString()}),
    models:async()=>({models:[{id:'verified-model'}],catalog_version:1n}),
    estimate:async()=>({model:'verified-model',input_tokens:10n,max_output_tokens:1800n,hold_2z:1n,cap_remaining_milli_2z:cap}),
    call:async(id)=>({call_id:id,status:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}),
    chat:async(request,options)=>{
      assert.ok((value as any).operations.length, 'journal must precede potentially billable invocation');
      calls.push({request,options});
      const iterator=(async function*(){yield {type:'meta',call_id:'call',model:'verified-model',hold_2z:1n} as ChatEvent; yield {type:'delta',text:'{"activity":true}'} as ChatEvent;for(const e of events)yield e;})();
      return Object.assign(iterator,{operationId:options.operationId,idempotencyKey:options.idempotencyKey,callId:'call',cancel:async()=>{cancelled++;}}) as ChatStream;
    }
  };
  return {client,journal,tutor:new Free2zTutor(client,journal,'adult'),calls,authorization:{subject:'adult',clientId:'aha-client',maximum2z:500n,verifiedGrant:{subject:'adult',clientId:'aha-client',sessionGeneration:'one',asOf:new Date().toISOString(),checkedAt:Date.now(),period:'total' as const,limit2z:500n}},setCap:(v:bigint|null)=>{cap=v;},setSession:(v:Session)=>{activeSession=v;},getValue:()=>value as any,cancelled:()=>cancelled};
}
test('formats balances without losing integer precision',()=>{assert.equal(format2z(9007199254740993123n),'9007199254740993.123 2Z');assert.equal(format2z(-1500n),'-1.5 2Z');});
test('journals before invocation and persists finalized output and exact receipt',async()=>{const f=fixture();const r=await f.tutor.reply('verified-model','policy','context',f.authorization);assert.equal(r.text,'{"activity":true}');assert.equal(f.getValue().operations[0].charge.charged2z,'2');assert.equal(f.getValue().operations[0].state,'finalized');});
test('estimate is not a cap; absent or excessive grant caps block any paid call',async()=>{for(const cap of [null,501000n]){const f=fixture();f.setCap(cap);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_cap_required'});assert.equal(f.calls.length,0);}});
test('a partial stream remains uncertain and blocks another paid call',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'interrupted'});assert.equal(f.getValue().operations[0].state,'interrupted');await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'settlement_pending'});assert.equal(f.calls.length,1);const summary=await f.tutor.reconcile();assert.equal(summary.pending,0);assert.equal(summary.spent2z,2n);});
test('charged failures retain receipts and never automatically retry',async()=>{const f=fixture([{type:'error',code:'provider_error',partial:true,settlement:'settled',charge:{state:'charged',charged2z:3n,receiptId:'r'}}]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'provider_error'});assert.equal(f.calls.length,1);assert.equal(f.getValue().operations[0].charge.charged2z,'3');});
test('account mismatch prevents billable work',async()=>{const f=fixture();f.setSession({...session,subject:'another'});await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'account_changed'});assert.equal(f.calls.length,0);});
test('same-operation recovery preserves request and key; never starts a fresh operation',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const op=f.getValue().operations[0];await assert.rejects(f.tutor.recover(op.id,f.authorization));assert.deepEqual(f.calls[0],f.calls[1]);});
test('concurrent generation cannot double charge on duplicate taps',async()=>{const f=fixture();const first=f.tutor.reply('verified-model','p','c',f.authorization);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'busy'});await first;assert.equal(f.calls.length,1);});
test('remaining authorization includes finalized charges, not only current call estimate',async()=>{const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_cap_required'});assert.equal(f.calls.length,1);f.setCap(498000n);await f.tutor.reply('verified-model','p','c',f.authorization);assert.equal(f.calls.length,2);});

test('unverified or periodic grant metadata cannot authorize paid tests',async()=>{const f=fixture();await assert.rejects(f.tutor.reply('verified-model','p','c',{subject:'adult',clientId:'aha-client',maximum2z:500n} as any),{code:'grant_verification_required'});assert.equal(f.calls.length,0);});
test('cancel during opening journal write prevents invocation',async()=>{const f=fixture();const original=f.journal.putJournal;f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')await f.tutor.cancel();};await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'cancelled'});assert.equal(f.calls.length,0);});
test('account change during opening journal write prevents invocation',async()=>{const f=fixture();const original=f.journal.putJournal;f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')f.setSession({...session,generation:'new'});};await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'cancelled'});assert.equal(f.calls.length,0);});
test('disk full while streaming cannot skip native cancellation',async()=>{const f=fixture();const original=f.journal.putJournal;f.journal.putJournal=async(k,v)=>{if(['streaming','interrupted'].includes(v.operations?.at(-1)?.state))throw new Error('disk full');await original(k,v);};await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'journal_write_failed'});assert.ok(f.cancelled()>0);assert.equal(f.getValue().operations[0].state,'opening');});

test('corrupt journals cannot erase spending or permit another invocation',async()=>{
  const mutations = [
    (op:any)=>{delete op.charge;}, (op:any)=>{op.charge={state:'pending'};},
    (op:any)=>{op.charge.charged2z='-2';}, (op:any)=>{op.charge.charged2z='02';},
    (op:any)=>{op.charge.charged2z=2;}, (op:any)=>{op.charge.state='unknown';},
    (op:any)=>{delete op.charge.receiptId;}, (op:any)=>{op.charge={state:'released',charged2z:'2'};},
    (op:any)=>{op.generation='';}, (op:any)=>{op.subject='';}, (op:any)=>{op.key='';},
    (op:any)=>{op.createdAt='yesterday';}, (op:any)=>{op.createdAt='9999-01-01T00:00:00.000Z';},
    (op:any)=>{op.request.model='';}, (op:any)=>{op.request.maxOutputTokens='999999999';},
    (op:any)=>{op.request.messages[0].role='assistant';},
    (op:any)=>{op.request.messages[1].content[0]={type:'image',url:'unsafe'};},
    (op:any)=>{op.request.tools=[];}, (op:any)=>{op.callId='';},
  ];
  for (const mutate of mutations) {
    const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization);
    mutate(f.getValue().operations[0]);f.setCap(498000n);
    await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'journal_invalid'});
    await assert.rejects(f.tutor.inspectPending(),{code:'journal_invalid'});
    assert.equal(f.calls.length,1);
  }
});
test('duplicate operation identities fail closed',async()=>{
  const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization);
  f.getValue().operations.push(structuredClone(f.getValue().operations[0]));
  await assert.rejects(f.tutor.reconcile(),{code:'journal_invalid'});
});
test('pending inspection exposes metadata without changing or retrying usage',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','secret policy','private context',f.authorization));
  const before=structuredClone(f.getValue());const pending=await f.tutor.inspectPending();
  assert.equal(pending.length,1);assert.equal(pending[0].canReconcile,true);assert.equal(pending[0].canRecover,true);
  assert.deepEqual(Object.keys(pending[0]).sort(),['operationId','createdAt','state','canReconcile','canRecover'].sort());
  assert.deepEqual(f.getValue(),before);assert.equal(f.calls.length,1);
  f.getValue().operations[0].createdAt=new Date(Date.now()-25*60*60*1000).toISOString();
  assert.equal((await f.tutor.inspectPending())[0].canRecover,false);
  await assert.rejects(f.tutor.recover(pending[0].operationId,f.authorization),{code:'recovery_expired'});assert.equal(f.calls.length,1);
  await f.tutor.reconcile();assert.deepEqual(await f.tutor.inspectPending(),[]);
});
test('empty archived requests are valid only for settled operations',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  f.getValue().operations[0].request.messages=[];f.getValue().operations[0].text='';
  await assert.rejects(f.tutor.recover(f.getValue().operations[0].id,f.authorization),{code:'journal_invalid'});
});
test('inspection fences account transitions and rejects foreign journals',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  f.getValue().operations[0].subject='foreign';
  await assert.rejects(f.tutor.inspectPending(),{code:'account_mismatch'});
  await assert.rejects(f.tutor.recover(f.getValue().operations[0].id,f.authorization),{code:'account_mismatch'});
  f.getValue().operations[0].subject='adult';
  const read=f.journal.getJournal;f.journal.getJournal=async key=>{const value=await read(key);f.setSession({...session,generation:'changed'});return value;};
  await assert.rejects(f.tutor.inspectPending(),{code:'account_changed'});
});
test('pending settlement can be explicitly recovered with the original identity',async()=>{
  const f=fixture([{type:'done',finish_reason:'stop',settlement:'pending',charge:{state:'pending'}} as any]);
  await f.tutor.reply('verified-model','p','c',f.authorization);
  const op=f.getValue().operations[0];assert.equal(op.state,'settling');
  await f.tutor.recover(op.id,f.authorization);assert.equal(f.calls.length,1,'completed response recovery uses saved content, not another service call');
  assert.equal(f.getValue().operations[0].state,'settling');
});
test('recovery rechecks current grant proof even when opening never reached the gateway',async()=>{
  const f=fixture([]);const write=f.journal.putJournal;
  f.journal.putJournal=async(k,v)=>{await write(k,v);if(v.operations?.at(-1)?.state==='opening')await f.tutor.cancel();};
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'cancelled'});
  f.journal.putJournal=write;assert.equal(f.calls.length,0);
  const op=f.getValue().operations[0];
  await assert.rejects(f.tutor.recover(op.id,undefined as any),{code:'authorization_required'});
  await assert.rejects(f.tutor.recover(op.id,{...f.authorization,verifiedGrant:{...f.authorization.verifiedGrant,period:'day'} as any}),{code:'grant_verification_required'});
  for(const cap of [null,501000n,0n]) {
    f.setCap(cap);await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'grant_cap_required'});
  }
  assert.equal(f.calls.length,0);f.setCap(500000n);
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'interrupted'});
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.idempotencyKey,op.key);
  assert.equal(f.calls[0].options.operationId,op.id);
});
test('recovery includes previous finalized spend in its cap bound',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  const op=f.getValue().operations[0];
  f.getValue().operations.push({...structuredClone(op),id:crypto.randomUUID(),key:crypto.randomUUID(),state:'finalized',charge:{state:'charged',charged2z:'499',receiptId:'old-receipt'}});
  f.setCap(2000n);await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'grant_cap_required'});
  assert.equal(f.calls.length,1);f.setCap(1000n);
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'interrupted'});assert.equal(f.calls.length,2);
});
test('account changes while estimating recovery prevent its invocation',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  const op=f.getValue().operations[0], estimate=f.client.estimate;
  f.client.estimate=async(...args)=>{const result=await estimate(...args);f.setSession({...session,generation:'new'});return result;};
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'cancelled'});assert.equal(f.calls.length,1);
});

test('real grant adapter validates identity, enforcement, original total cap and freshness',async()=>{
 const f=fixture(); const valid=await f.client.grant();
 const result=await verifyTestGrant(f.client,f.authorization);
 assert.equal(result.limit2z,500n);assert.equal(result.clientId,'aha-client');assert.equal(result.sessionGeneration,'one');assert.ok(Object.isFrozen(result));
 for(const patch of [{sub:'other'},{client_id:'other'},{enforced:false},{spend_cap_2z:null},{spend_cap_2z:0n},{spend_cap_2z:501n},{spend_cap_2z:500},{cap_period:'month'},{scopes:[]},{account_epoch:-1n},{grant_generation:1},{grant_generation:0n},{as_of:new Date(Date.now()-61_000).toISOString()},{as_of:new Date(Date.now()+6_000).toISOString()},{as_of:'invalid'}]){
  f.client.grant=async()=>({...valid,...patch}) as any;
  await assert.rejects(verifyTestGrant(f.client,f.authorization),{code:'grant_verification_required'});
 }
 assert.equal(f.calls.length,0);
});
test('grant verification fences session changes and propagates service errors without fallback',async()=>{
 const f=fixture();const grant=f.client.grant;f.client.grant=async()=>{f.setSession({...session,generation:'changed'});return grant();};
 await assert.rejects(verifyTestGrant(f.client,f.authorization),{code:'account_changed'});
 f.setSession(session);f.client.grant=async()=>{throw new Error('unavailable');};
 await assert.rejects(verifyTestGrant(f.client,f.authorization),/unavailable/);assert.equal(f.calls.length,0);
});
test('a supplied valid-looking grant cannot bypass real consent recheck after journal persistence',async()=>{
 const f=fixture();const original=f.journal.putJournal;const grant=f.client.grant;
 f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')f.client.grant=async()=>({...await grant(),enforced:false});};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_verification_required'});
 assert.equal(f.calls.length,0);assert.equal(f.getValue().operations[0].state,'interrupted');
});
test('grant remainder is refreshed after durable save before any potentially billable send',async()=>{
 const f=fixture();const original=f.journal.putJournal;
 f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')f.setCap(501000n);};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_cap_required'});assert.equal(f.calls.length,0);
});
test('same-key recovery also rejects current unenforced grant even with previous valid proof',async()=>{
 const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const grant=f.client.grant;
 f.client.grant=async()=>({...await grant(),enforced:false});await assert.rejects(f.tutor.recover(f.getValue().operations[0].id,f.authorization),{code:'grant_verification_required'});assert.equal(f.calls.length,1);
});

test('SDK errors preserve code and Retry-After alongside durable same-key recovery',async()=>{
 for(const code of ['cap_exceeded','insufficient_balance','rate_limited']){
  const f=fixture();const options:any[]=[];
  f.client.chat=async(_request,opts)=>{options.push(opts);throw new SdkError(code,{retryAfterSeconds:30,details:{secret:'never display'}});};
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),(e:any)=>e.code===code && e.retryAfterSeconds===30 && !e.message.includes('never display'));
  const op=f.getValue().operations[0];assert.equal(op.state,'interrupted');assert.equal(options.length,1);
  await assert.rejects(f.tutor.recover(op.id,f.authorization),(e:any)=>e.code===code && e.retryAfterSeconds===30);
  assert.deepEqual(options[0],options[1]);assert.equal(f.getValue().operations.length,1);
 }
});

test('grant UTC timestamps accept SDK-supported fractional precision and explicit UTC offset',async()=>{
 const f=fixture();const grant=await f.client.grant();const asOf=new Date().toISOString().replace('Z','123+00:00');
 f.client.grant=async()=>({...grant,as_of:asOf});assert.equal((await verifyTestGrant(f.client,f.authorization)).asOf,asOf);
});

test('proof snapshot cannot age out while a slow estimate completes',async(t)=>{
 // Journal timestamps and freshness checks must share the same controlled clock.
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const f=fixture();const grant=f.client.grant;
 f.client.grant=async()=>({...await grant(),as_of:new Date(Date.now()-59_000).toISOString()});
 const estimate=f.client.estimate;let count=0;
 f.client.estimate=async request=>{if(++count===2)t.mock.timers.tick(2_000);return estimate(request);};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_verification_required'});assert.equal(f.calls.length,0);
});

test('validated recovery context survives durable journal and a new provider instance',async()=>{
 for(const context of [
  {kind:'activity' as const,profileId:'learner',candidateSkillIds:['4.NF.B.3','5.NF.A.1']},
  {kind:'curiosity' as const,profileId:'learner',activityId:'question-1',question:'Where can I use this?'}
 ]){
  const f=fixture();const chat=f.client.chat;f.client.chat=async()=>{throw new SdkError('temporarily_unavailable');};
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,context));
  const op=f.getValue().operations[0];assert.deepEqual(op.context,context);
  f.client.chat=chat;const restarted=new Free2zTutor(f.client,f.journal,'adult');const result=await restarted.recover(op.id,f.authorization);
  assert.deepEqual(result.context,context);assert.equal(result.text,'{"activity":true}');assert.equal(result.operationId,op.id);
  assert.equal(f.calls[0].options.idempotencyKey,op.key);assert.equal(f.getValue().operations.length,1);
 }
});
test('reply snapshots context before yielding and returns independent context data',async()=>{
 const f=fixture();const context={kind:'activity' as const,profileId:'learner',candidateSkillIds:['4.NF.B.3']};
 const pending=f.tutor.reply('verified-model','p','c',f.authorization,context);context.profileId='changed';context.candidateSkillIds.push('foreign');
 const result=await pending;assert.deepEqual(result.context,{kind:'activity',profileId:'learner',candidateSkillIds:['4.NF.B.3']});
 result.context!.profileId='changed-again';assert.equal(f.getValue().operations[0].context.profileId,'learner');
});
test('invalid recovery context fails before journal writes and corrupt persisted context blocks recovery',async()=>{
 const invalid:any[]=[null,{}, {kind:'other',profileId:'learner'},
  {kind:'activity',profileId:'',candidateSkillIds:['x']},
  {kind:'activity',profileId:'x'.repeat(101),candidateSkillIds:['x']},
  {kind:'activity',profileId:'learner',candidateSkillIds:[]},
  {kind:'activity',profileId:'learner',candidateSkillIds:['x','x']},
  {kind:'activity',profileId:'learner',candidateSkillIds:['x'.repeat(101)]},
  {kind:'activity',profileId:'learner',candidateSkillIds:Array.from({length:13},(_,i)=>String(i))},
  {kind:'activity',profileId:'learner',candidateSkillIds:['x'],unexpected:true},
  {kind:'curiosity',profileId:'learner',activityId:'',question:'Why?'},
  {kind:'curiosity',profileId:'learner',activityId:'x'.repeat(101),question:'Why?'},
  {kind:'curiosity',profileId:'learner',activityId:'a',question:' '},
  {kind:'curiosity',profileId:'learner',activityId:'a',question:'x'.repeat(601)},
  {kind:'curiosity',profileId:'learner',activityId:'a',question:'bad\u0000question'},
  {kind:'curiosity',profileId:'learner',activityId:'a',question:'Why?',unexpected:true}];
 for(const context of invalid){
  const f=fixture();await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,context),{code:'resume_context_invalid'});
  assert.equal(f.getValue(),undefined);assert.equal(f.calls.length,0);
 }
 const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const op=f.getValue().operations[0];
 for(const context of invalid){op.context=context;await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'journal_invalid'});}
 assert.equal(f.calls.length,1);
 delete op.context;assert.equal((await f.tutor.inspectPending()).length,1);
});

test('completed paid lesson survives restart until explicit durable acknowledgement',async()=>{
 const f=fixture();const context={kind:'activity' as const,profileId:'learner',candidateSkillIds:['4.NF.B.3']};
 const completed=await f.tutor.reply('verified-model','p','c',f.authorization,context);
 assert.equal(f.getValue().operations[0].answerComplete,true);
 const restarted=new Free2zTutor(f.client,f.journal,'adult');assert.deepEqual(await restarted.pendingReplies(),[completed]);
 const recovered=await restarted.recover(completed.operationId,f.authorization);assert.deepEqual(recovered,completed);assert.equal(f.calls.length,1);
 recovered.context!.profileId='other';assert.equal((await restarted.pendingReplies())[0].context!.profileId,'learner');
 await assert.rejects(restarted.reply('verified-model','p','c',f.authorization,context),{code:'answer_pending'});assert.equal(f.calls.length,1);
 await restarted.reconcile();assert.deepEqual(await restarted.pendingReplies(),[completed]);
 await restarted.acknowledgeReply(completed.operationId);assert.deepEqual(await restarted.pendingReplies(),[]);
 await restarted.acknowledgeReply(completed.operationId);f.setCap(498000n);
 await restarted.reply('verified-model','p','c',f.authorization,context);assert.equal(f.calls.length,2);
 assert.equal(f.getValue().operations[0].text,'');assert.equal(f.getValue().operations[0].consumed,true);
});
test('failed acknowledgement keeps delivered content recoverable and blocks fresh spending',async()=>{
 const f=fixture();const completed=await f.tutor.reply('verified-model','p','c',f.authorization,{kind:'curiosity',profileId:'learner',activityId:'question',question:'Why?'});
 const write=f.journal.putJournal;f.journal.putJournal=async()=>{throw new Error('disk full');};
 await assert.rejects(f.tutor.acknowledgeReply(completed.operationId),/disk full/);f.journal.putJournal=write;
 assert.deepEqual(await f.tutor.pendingReplies(),[completed]);assert.equal(f.getValue().operations[0].consumed,undefined);
});
test('completed pending-settlement content is available without another billable replay',async()=>{
 const f=fixture([{type:'done',finish_reason:'stop',settlement:'pending',charge:{state:'pending'}} as any]);
 const result=await f.tutor.reply('verified-model','p','c',f.authorization,{kind:'curiosity',profileId:'learner',activityId:'question',question:'Why?'});
 assert.deepEqual(await f.tutor.pendingReplies(),[result]);
 assert.equal((await f.tutor.inspectPending())[0].profileId,'learner');assert.equal((await f.tutor.inspectPending())[0].activityId,'question');
 await f.tutor.acknowledgeReply(result.operationId);assert.deepEqual(await f.tutor.pendingReplies(),[]);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'settlement_pending'});
 await assert.rejects(f.tutor.recover(result.operationId,f.authorization),{code:'already_consumed'});assert.equal(f.calls.length,1);
});
test('only normally finished answers are deliverable and invalid completion markers fail closed',async()=>{
 const f=fixture([{type:'done',finish_reason:'length',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'r'}} as any]);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,{kind:'activity',profileId:'learner',candidateSkillIds:['skill']}),{code:'incomplete_output'});
 assert.deepEqual(await f.tutor.pendingReplies(),[]);assert.equal(f.getValue().operations[0].answerComplete,undefined);
 const g=fixture([]);await assert.rejects(g.tutor.reply('verified-model','p','c',g.authorization));
 for(const patch of [{answerComplete:false},{answerComplete:true},{consumed:true},{consumed:false}]){
  const op=g.getValue().operations[0];delete op.answerComplete;delete op.consumed;Object.assign(op,patch);
  await assert.rejects(g.tutor.pendingReplies(),{code:'journal_invalid'});
 }
});

test('an unconsumed completed lesson cannot masquerade as an archived empty record',async()=>{
 const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization,{kind:'activity',profileId:'learner',candidateSkillIds:['skill']});
 const op=f.getValue().operations[0];op.text='';op.request.messages=[];
 await assert.rejects(f.tutor.pendingReplies(),{code:'journal_invalid'});
});

// ---- Journal v2: Activity Spec batches (2600-token budget) beside readable, recoverable v1 records ----
const batchContext = {kind:'activities' as const,profileId:'learner',allowedSkillIds:['3.NF.A.1','2.MD.C.8']};
test('a batch request journals and sends the 2600-token budget as journal v2, after the estimate/cap check',async()=>{
 const f=fixture();let estimated:bigint|undefined;const estimate=f.client.estimate;f.client.estimate=async(r)=>{estimated=r.max_output_tokens;return estimate(r);};
 const reply=await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
 assert.equal(reply.context?.kind,'activities');
 assert.equal(f.calls[0].request.max_output_tokens,2600n);
 assert.equal(estimated,2600n,'the hold estimate and cap check use the same budget before send');
 assert.equal('max_output_tokens_strict' in f.calls[0].request,false,'strict output is not sent yet');
 assert.equal(f.getValue().version,2);
 assert.equal(f.getValue().operations[0].request.maxOutputTokens,'2600');
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'9999' as any),{code:'output_budget_invalid'});
 assert.equal(f.calls.length,1);
});
test('a version 1 journal stays readable and recoverable with its original 1800 budget, then is stored as v2',async()=>{
 const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,{kind:'activity',profileId:'learner',candidateSkillIds:['skill']}),{code:'interrupted'});
 const v1=f.getValue();v1.version=1;assert.equal(v1.operations[0].request.maxOutputTokens,'1800');
 const pending=await f.tutor.inspectPending();assert.equal(pending.length,1);assert.equal(pending[0].canRecover,true);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code:'settlement_pending'},'an unsettled v1 receipt still blocks new paid calls');
 await assert.rejects(f.tutor.recover(pending[0].operationId,f.authorization),{code:'interrupted'});
 assert.equal(f.calls[1].request.max_output_tokens,1800n,'same-key recovery replays the exact original budget');
 assert.deepEqual(f.calls[1].options,f.calls[0].options);
 assert.equal(f.getValue().version,2,'the first write upgrades the container, not the record');
});
test('v1 journals cannot carry v2-only budgets or batch contexts, and unknown versions fail closed',async()=>{
 const mutations=[(l:any)=>{l.version=1;l.operations[0].request.maxOutputTokens='2600';},(l:any)=>{l.version=1;},(l:any)=>{l.version=3;},(l:any)=>{l.version='2';},(l:any)=>{l.operations[0].context.allowedSkillIds=[];},(l:any)=>{l.operations[0].context.extra=true;}];
 for(const mutate of mutations){
  const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
  mutate(f.getValue());
  await assert.rejects(f.tutor.pendingReplies(),{code:'journal_invalid'});
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'journal_invalid'});
  assert.equal(f.calls.length,1);
 }
});
test('a batch cut off by its output budget is still deliverable; other replies are not',async()=>{
 const charged={state:'charged' as const,charged2z:3n,receiptId:'r'};
 const f=fixture([{type:'done',finish_reason:'length',settlement:'settled',charge:charged}]);
 const reply=await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
 assert.equal(reply.text,'{"activity":true}');
 assert.equal((await f.tutor.pendingReplies()).length,1,'saved until the queue is durably stored');
 const g=fixture([{type:'done',finish_reason:'length',settlement:'settled',charge:charged}]);
 await assert.rejects(g.tutor.reply('verified-model','p','c',g.authorization,{kind:'curiosity',profileId:'learner',activityId:'a',question:'why?'}),{code:'incomplete_output'});
 assert.equal((await g.tutor.pendingReplies()).length,0);
});
test('a receipt-only replay of a batch is never treated as activity content',async()=>{
 const f=fixture([{type:'replay',record:{call_id:'call',status:'settled',charge:{state:'charged',charged2z:3n,receiptId:'r'}}} as ChatEvent]);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code:'receipt_only'});
 assert.equal((await f.tutor.pendingReplies()).length,0,'no deliverable text from a receipt');
 assert.equal(f.getValue().operations[0].charge.charged2z,'3');
});
