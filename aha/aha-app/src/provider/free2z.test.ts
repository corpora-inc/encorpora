import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, NativeTransport, SdkError, type NativeBridge } from '@free2z/sdk';
import type { ChatEvent, ChatRequest, ChatStream, Grant, Session } from '@free2z/sdk';
import { Free2zTutor, SIGN_IN_OPTIONS, SUGGESTED_SPEND_CAP_2Z, admitEstimate, format2z, verifyPaidGrant, type Journal, type PaidAuthorization, type SdkClient } from './free2z.ts';
const session: Session = {signedIn:true,subject:'adult',generation:'one',grantedScopes:['ai:invoke'],persistence:'persistent'};
/** Default fixture: an enforced 100 2Z monthly app budget. Every policy branch patches the grant or estimate. */
const baseGrant = (): Grant => ({sub:'adult',client_id:'aha-client',account_epoch:1n,grant_generation:1n,scopes:['ai:invoke'],spend_cap_2z:100n,cap_period:'month',enforced:true,enforcement_reason:'ok',as_of:new Date().toISOString()});
function fixture(events: ChatEvent[] = [{type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}]) {
  let value: unknown; const calls: {request:ChatRequest; options:any}[] = []; let activeSession = session;
  let cap: bigint | null | undefined = 100000n; let available: bigint | undefined = 500000n; let hold = 1n; let cancelled = 0;
  let grantPatch: Partial<Grant> & Record<string, unknown> = {};
  const estimates: ChatRequest[] = []; let estimateTokens: bigint | undefined; let estimateError: unknown; let chatError: unknown;
  const journal: Journal = {getJournal:async()=>structuredClone(value),putJournal:async(key,v)=>{if(key==='aha-billing-v1')value=structuredClone(v);}};
  const client: SdkClient = {
    session:async()=>activeSession, signIn:async()=>session, signOut:async()=>({revoked:true,generation:'two'}),
    balance:async()=>({available_milli_2z:available ?? 500000n,held_milli_2z:0n,balance_milli_2z:available ?? 500000n,debt_milli_2z:0n,as_of:new Date().toISOString()}),
    grant:async()=>({...baseGrant(),...grantPatch}) as Grant,
    models:async()=>({models:[{id:'verified-model'}],catalog_version:1n}),
    estimate:async(request)=>{
      estimates.push(request);
      if(estimateError)throw estimateError;
      return {model:'verified-model',input_tokens:10n,max_output_tokens:estimateTokens??request.max_output_tokens??0n,hold_2z:hold,
      ...(available === undefined ? {} : {available_milli_2z:available}),...(cap === undefined ? {} : {cap_remaining_milli_2z:cap})};
    },
    call:async(id)=>({call_id:id,status:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}),
    chat:async(request,options)=>{
      assert.ok((value as any).operations.length, 'journal must precede potentially billable invocation');
      calls.push({request,options});
      if(chatError)throw chatError;
      const iterator=(async function*(){yield {type:'meta',call_id:'call',model:'verified-model',hold_2z:1n} as ChatEvent; yield {type:'delta',text:'{"activity":true}'} as ChatEvent;for(const e of events)yield e;})();
      return Object.assign(iterator,{operationId:options.operationId,idempotencyKey:options.idempotencyKey,callId:'call',cancel:async()=>{cancelled++;}}) as ChatStream;
    }
  };
  const authorization: PaidAuthorization = {subject:'adult',clientId:'aha-client',verifiedGrant:{subject:'adult',clientId:'aha-client',sessionGeneration:'one',asOf:new Date().toISOString(),checkedAt:Date.now(),budget:{period:'month',limit2z:100n}}};
  return {client,journal,tutor:new Free2zTutor(client,journal,'adult'),calls,estimates,authorization,
    setEstimateTokens:(v:bigint|undefined)=>{estimateTokens=v;},setEstimateError:(e:unknown)=>{estimateError=e;},setChatError:(e:unknown)=>{chatError=e;},
    setCap:(v:bigint|null|undefined)=>{cap=v;},setAvailable:(v:bigint|undefined)=>{available=v;},setHold:(v:bigint)=>{hold=v;},
    setGrant:(patch:Partial<Grant> & Record<string, unknown>)=>{grantPatch=patch;},
    setSession:(v:Session)=>{activeSession=v;},setValue:(v:unknown)=>{value=structuredClone(v);},getValue:()=>value as any,cancelled:()=>cancelled};
}
/** A live authorization built the way the controller builds it: from the real grant adapter. */
async function liveAuthorization(f: ReturnType<typeof fixture>): Promise<PaidAuthorization> {
  const policy = {subject:'adult',clientId:'aha-client'};
  return {...policy, verifiedGrant: await verifyPaidGrant(f.client, policy)};
}
test('formats balances without losing integer precision',()=>{assert.equal(format2z(9007199254740993123n),'9007199254740993.123 2Z');assert.equal(format2z(-1500n),'-1.5 2Z');});
test('journals before invocation and persists finalized output and exact receipt',async()=>{const f=fixture();const r=await f.tutor.reply('verified-model','policy','context',f.authorization);assert.equal(r.text,'{"activity":true}');assert.equal(f.getValue().operations[0].charge.charged2z,'2');assert.equal(f.getValue().operations[0].state,'finalized');});
test('a budgeted grant needs the estimate to report the budget remainder; absent or null blocks any paid call',async()=>{for(const cap of [null,undefined]){const f=fixture();f.setCap(cap);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_verification_required'});assert.equal(f.calls.length,0);assert.equal(f.getValue()?.operations?.length ?? 0,0,'refused before any operation is journaled');}});
test('a partial stream remains uncertain and blocks another paid call',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'interrupted'});assert.equal(f.getValue().operations[0].state,'interrupted');await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'settlement_pending'});assert.equal(f.calls.length,1);const summary=await f.tutor.reconcile();assert.equal(summary.pending,0);assert.equal(summary.spent2z,2n);});
test('charged failures retain receipts and never automatically retry',async()=>{const f=fixture([{type:'error',code:'provider_error',partial:true,settlement:'settled',charge:{state:'charged',charged2z:3n,receiptId:'r'}}]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'provider_error'});assert.equal(f.calls.length,1);assert.equal(f.getValue().operations[0].charge.charged2z,'3');});
test('account mismatch prevents billable work',async()=>{const f=fixture();f.setSession({...session,subject:'another'});await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'account_changed'});assert.equal(f.calls.length,0);});
test('same-operation recovery preserves request and key; never starts a fresh operation',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const op=f.getValue().operations[0];await assert.rejects(f.tutor.recover(op.id,f.authorization));assert.deepEqual(f.calls[0],f.calls[1]);});
test('concurrent generation cannot double charge on duplicate taps',async()=>{const f=fixture();const first=f.tutor.reply('verified-model','p','c',f.authorization);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'busy'});await first;assert.equal(f.calls.length,1);});
test('the service budget remainder, not an app-side tally of past charges, bounds new calls',async()=>{const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization);await f.tutor.reply('verified-model','p','c',f.authorization);assert.equal(f.calls.length,2,'no app-side ceiling');f.setCap(999n);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'cap_exceeded'});assert.equal(f.calls.length,2);});

test('an authorization without a verified grant cannot start paid work',async()=>{const f=fixture();await assert.rejects(f.tutor.reply('verified-model','p','c',{subject:'adult',clientId:'aha-client'} as any),{code:'grant_verification_required'});assert.equal(f.calls.length,0);});
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
  await assert.rejects(f.tutor.recover(op.id,{...f.authorization,verifiedGrant:{...f.authorization.verifiedGrant,subject:'other'}}),{code:'grant_verification_required'});
  for(const [cap,code] of [[null,'grant_verification_required'],[0n,'cap_exceeded'],[999n,'cap_exceeded']] as const) {
    f.setCap(cap);await assert.rejects(f.tutor.recover(op.id,f.authorization),{code});
  }
  f.setCap(100000n);f.setGrant({enforced:false,enforcement_reason:'platform_disabled'});
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'ai_not_ready'});
  assert.equal(f.calls.length,0);f.setGrant({});
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'interrupted'});
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.idempotencyKey,op.key);
  assert.equal(f.calls[0].options.operationId,op.id);
});
test('recovery is bounded by the current balance and budget remainder, whatever was spent before',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  const op=f.getValue().operations[0];
  f.getValue().operations.push({...structuredClone(op),id:crypto.randomUUID(),key:crypto.randomUUID(),state:'finalized',charge:{state:'charged',charged2z:'499',receiptId:'old-receipt'}});
  f.setAvailable(999n);await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'insufficient_balance'});
  assert.equal(f.calls.length,1);f.setAvailable(500000n);
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'interrupted'});assert.equal(f.calls.length,2);
});
test('account changes while estimating recovery prevent its invocation',async()=>{
  const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
  const op=f.getValue().operations[0], estimate=f.client.estimate;
  f.client.estimate=async(...args)=>{const result=await estimate(...args);f.setSession({...session,generation:'new'});return result;};
  await assert.rejects(f.tutor.recover(op.id,f.authorization),{code:'cancelled'});assert.equal(f.calls.length,1);
});

test('real grant adapter validates identity, scope, enforcement and freshness, never the budget size or period',async()=>{
 const f=fixture(); const valid=await f.client.grant();
 const result=await verifyPaidGrant(f.client,f.authorization);
 assert.deepEqual(result.budget,{period:'month',limit2z:100n});assert.equal(result.clientId,'aha-client');assert.equal(result.sessionGeneration,'one');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.budget));
 for(const patch of [{sub:'other'},{client_id:'other'},{spend_cap_2z:500},{spend_cap_2z:-1n},{cap_period:'year'},{scopes:[]},{account_epoch:-1n},{grant_generation:1},{grant_generation:0n},{as_of:new Date(Date.now()-61_000).toISOString()},{as_of:new Date(Date.now()+6_000).toISOString()},{as_of:'invalid'},{enforcement_reason:'platform_disabled'}]){
  f.client.grant=async()=>({...valid,...patch}) as any;
  await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code:'grant_verification_required'},JSON.stringify(patch,(_k,v)=>typeof v==='bigint'?String(v):v));
 }
 assert.equal(f.calls.length,0);
});
test('grant verification fences session changes and propagates service errors without fallback',async()=>{
 const f=fixture();const grant=f.client.grant;f.client.grant=async()=>{f.setSession({...session,generation:'changed'});return grant();};
 await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code:'account_changed'});
 f.setSession(session);f.client.grant=async()=>{throw new Error('unavailable');};
 await assert.rejects(verifyPaidGrant(f.client,f.authorization),/unavailable/);assert.equal(f.calls.length,0);
});
test('a supplied valid-looking grant cannot bypass real consent recheck after journal persistence',async()=>{
 const f=fixture();const original=f.journal.putJournal;const grant=f.client.grant;
 f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')f.client.grant=async()=>({...await grant(),enforced:false,enforcement_reason:'platform_disabled'});};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'ai_not_ready'});
 assert.equal(f.calls.length,0);assert.equal(f.getValue().operations[0].state,'interrupted');
});
test('budget remainder and balance are refreshed after durable save before any potentially billable send',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>f.setCap(0n),(f:ReturnType<typeof fixture>)=>f.setAvailable(0n)]){
  const f=fixture();const original=f.journal.putJournal;
  f.journal.putJournal=async(k,v)=>{await original(k,v);if(v.operations?.at(-1)?.state==='opening')change(f);};
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),(e:any)=>['cap_exceeded','insufficient_balance'].includes(e.code));assert.equal(f.calls.length,0);
 }
});
test('same-key recovery also rejects current unenforced grant even with previous valid proof',async()=>{
 const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const grant=f.client.grant;
 f.client.grant=async()=>({...await grant(),enforced:false,enforcement_reason:'platform_disabled'});await assert.rejects(f.tutor.recover(f.getValue().operations[0].id,f.authorization),{code:'ai_not_ready'});assert.equal(f.calls.length,1);
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
 f.client.grant=async()=>({...grant,as_of:asOf});assert.equal((await verifyPaidGrant(f.client,f.authorization)).asOf,asOf);
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

test('sign-in only suggests a modest monthly budget; admission works the same with the suggestion, any other budget, or none',async()=>{
 assert.deepEqual(SIGN_IN_OPTIONS,{spendCap:{cap2z:100n,period:'month'}});
 assert.equal(SIGN_IN_OPTIONS.spendCap?.cap2z,SUGGESTED_SPEND_CAP_2Z);
 assert.ok(Object.isFrozen(SIGN_IN_OPTIONS)&&Object.isFrozen(SIGN_IN_OPTIONS.spendCap));
 // The hint grants nothing and admission never compares a budget with it.
 for(const patch of [{spend_cap_2z:SUGGESTED_SPEND_CAP_2Z,cap_period:'month' as const},{spend_cap_2z:5000n,cap_period:'total' as const},{spend_cap_2z:1n,cap_period:'day' as const},{spend_cap_2z:null,cap_period:'month' as const}]){
  const f=fixture();f.setGrant(patch);f.setCap(patch.spend_cap_2z===null?null:100000n);
  const authorization=await liveAuthorization(f);
  assert.deepEqual(authorization.verifiedGrant.budget,patch.spend_cap_2z===null?null:{period:patch.cap_period,limit2z:patch.spend_cap_2z});
  await f.tutor.reply('verified-model','p','c',authorization);assert.equal(f.calls.length,1);
 }
 await assert.rejects(verifyPaidGrant(fixture().client,{subject:'adult',clientId:''}),{code:'authorization_required'});
});

test('the vendored SDK sends the spend-cap hint to the native plugin as decimal strings',async()=>{
 const sent:unknown[]=[];
 const bridge={signIn:async(options:unknown)=>{sent.push(options);return {signedIn:true,subject:'adult',grantedScopes:['ai:invoke'],persistence:'persistent',generation:'1'};}} as unknown as NativeBridge;
 const signedIn=await new Client(new NativeTransport(bridge)).signIn(SIGN_IN_OPTIONS);
 assert.equal(signedIn.subject,'adult');
 assert.deepEqual(sent,[{spendCap:'100',spendPeriod:'month'}]);
});

// ---- Journal v2: Activity Spec batches (2600-token budget) beside readable, recoverable v1 records ----
const batchContext = {kind:'activities' as const,profileId:'learner',allowedSkillIds:['3.NF.A.1','2.MD.C.8']};
test('a batch request journals and sends the 2600-token budget as journal v2, after the estimate/cap check',async()=>{
 const f=fixture();let estimated:bigint|undefined;const estimate=f.client.estimate;f.client.estimate=async(r)=>{estimated=r.max_output_tokens;return estimate(r);};
 const reply=await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
 assert.equal(reply.context?.kind,'activities');
 assert.equal(f.calls[0].request.max_output_tokens,2600n);
 assert.equal(estimated,2600n,'the hold estimate and cap check use the same budget before send');
 assert.equal(f.calls[0].request.max_output_tokens_strict,true,'strict output is sent on the chat request');
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

// ---- Production spending policy, "budget optional" (#879): one test per grant/estimate state ----
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
test('policy: an enforced total budget of any size admits a call within its remainder',async()=>{
 for(const limit of [1n,500n,2000n,1_000_000n]){
  const f=fixture();f.setGrant({spend_cap_2z:limit,cap_period:'total'});f.setCap(limit*1000n);
  const authorization=await liveAuthorization(f);
  assert.deepEqual(authorization.verifiedGrant.budget,{period:'total',limit2z:limit});
  await f.tutor.reply('verified-model','p','c',authorization);assert.equal(f.calls.length,1);
 }
});
test('policy: an enforced per-period budget (day, week, month) admits a call within its remainder',async()=>{
 for(const period of ['day','week','month'] as const){
  const f=fixture();f.setGrant({spend_cap_2z:250n,cap_period:period});f.setCap(1000n);
  const authorization=await liveAuthorization(f);
  assert.deepEqual(authorization.verifiedGrant.budget,{period,limit2z:250n});
  await f.tutor.reply('verified-model','p','c',authorization);assert.equal(f.calls.length,1,period);
 }
});
test('policy: no app budget proceeds on balance and estimate alone (cap remainder null or absent)',async()=>{
 for(const cap of [null,undefined]){
  const f=fixture();f.setGrant({spend_cap_2z:null,cap_period:'month'});f.setCap(cap);
  const authorization=await liveAuthorization(f);
  assert.equal(authorization.verifiedGrant.budget,null);
  await f.tutor.reply('verified-model','p','c',authorization,batchContext,'2600');assert.equal(f.calls.length,1);
  assert.equal(f.getValue().operations[0].state,'finalized');
 }
});
test('policy: a budget added after the grant read is still respected (stricter estimate wins)',async()=>{
 const f=fixture();f.setGrant({spend_cap_2z:null});f.setCap(null);const authorization=await liveAuthorization(f);
 f.setCap(500n);
 await assert.rejects(f.tutor.reply('verified-model','p','c',authorization),{code:'cap_exceeded'});assert.equal(f.calls.length,0);
});
test('policy: a platform that is not enforcing grants never gets a paid call (AI not ready yet)',async()=>{
 for(const [reason,code] of [['platform_disabled','ai_not_ready'],['ledger_cutover_pending','ai_not_ready'],['unknown','ai_not_ready'],[undefined,'ai_not_ready'],['ledger_cap_pending','budget_pending']] as const){
  for(const spend_cap_2z of [100n,null]){
   // The supplied proof (taken while enforcing) passes the pre-journal estimate; the live re-read before send refuses.
   const f=fixture();f.setGrant({enforced:false,enforcement_reason:reason,spend_cap_2z});
   await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code},`${reason}`);
   // A proof taken while enforcing does not survive the platform switching off before send.
   await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code});
   assert.equal(f.calls.length,0);
  }
 }
});
test('policy: an estimate above the available balance is never sent',async()=>{
 const f=fixture();f.setAvailable(999n);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'insufficient_balance'});
 assert.equal(f.calls.length,0);assert.equal(f.getValue()?.operations?.length ?? 0,0,'refused before any operation is journaled');
 const g=fixture();g.setGrant({spend_cap_2z:null});g.setCap(null);g.setHold(3n);g.setAvailable(2999n);
 await assert.rejects(g.tutor.reply('verified-model','p','c',await liveAuthorization(g)),{code:'insufficient_balance'});assert.equal(g.calls.length,0);
 g.setAvailable(3000n);await g.tutor.reply('verified-model','p','c',await liveAuthorization(g));assert.equal(g.calls.length,1,'exactly affordable is sent');
});
test('policy: an estimate without a balance figure falls back to the authoritative balance',async()=>{
 const f=fixture();f.setAvailable(undefined);let reads=0;const balance=f.client.balance;
 f.client.balance=async()=>{reads++;return {...await balance(),available_milli_2z:500n};};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'insufficient_balance'});
 assert.ok(reads>0);assert.equal(f.calls.length,0);
});
test('policy: an estimate above the budget remainder is never sent',async()=>{
 const f=fixture();f.setHold(2n);f.setCap(1999n);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'cap_exceeded'});assert.equal(f.calls.length,0);
 f.setCap(2000n);await f.tutor.reply('verified-model','p','c',f.authorization);assert.equal(f.calls.length,1);
});
test('policy: a different signed-in subject or a grant for another subject or client is refused',async()=>{
 const f=fixture();f.setSession({...session,subject:'another'});
 await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code:'account_changed'});
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'account_changed'});
 for(const patch of [{sub:'another'},{client_id:'another-app'}]){
  const g=fixture();g.setGrant(patch);await assert.rejects(verifyPaidGrant(g.client,g.authorization),{code:'grant_verification_required'});
 }
 const h=fixture();await assert.rejects(h.tutor.reply('verified-model','p','c',{...h.authorization,subject:'another'}),{code:'authorization_required'});
 assert.equal(f.calls.length+h.calls.length,0);
});
test('policy: a stale grant snapshot or stale proof is refused',async()=>{
 const f=fixture();f.setGrant({as_of:iso(-61_000)});
 await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code:'grant_verification_required'});
 const g=fixture();
 await assert.rejects(g.tutor.reply('verified-model','p','c',{...g.authorization,verifiedGrant:{...g.authorization.verifiedGrant,asOf:iso(-61_000)}}),{code:'grant_verification_required'});
 await assert.rejects(g.tutor.reply('verified-model','p','c',{...g.authorization,verifiedGrant:{...g.authorization.verifiedGrant,checkedAt:Date.now()-61_000}}),{code:'grant_verification_required'});
 assert.equal(f.calls.length+g.calls.length,0);
});
test('policy: a missing ai:invoke scope is refused in the session and in the grant',async()=>{
 const f=fixture();f.setSession({...session,grantedScopes:['balance:read']});
 await assert.rejects(verifyPaidGrant(f.client,f.authorization),{code:'account_changed'});
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'scope_denied'});
 const g=fixture();g.setGrant({scopes:['openid']});
 await assert.rejects(verifyPaidGrant(g.client,g.authorization),{code:'grant_verification_required'});
 assert.equal(f.calls.length+g.calls.length,0);
});
test('admitEstimate is the single affordability rule: hold within balance and, when present, within the remainder',()=>{
 const budget={period:'month' as const,limit2z:100n};
 const estimate=(extra:Record<string,unknown>)=>({model:'m',input_tokens:1n,max_output_tokens:1n,hold_2z:3n,...extra}) as any;
 assert.deepEqual(admitEstimate(estimate({available_milli_2z:3000n,cap_remaining_milli_2z:3000n}),budget),{hold2z:3n,availableMilli2z:3000n,capRemainingMilli2z:3000n});
 assert.deepEqual(admitEstimate(estimate({available_milli_2z:3000n,cap_remaining_milli_2z:null}),null),{hold2z:3n,availableMilli2z:3000n,capRemainingMilli2z:null});
 assert.deepEqual(admitEstimate(estimate({available_milli_2z:3000n}),null),{hold2z:3n,availableMilli2z:3000n,capRemainingMilli2z:null});
 assert.throws(()=>admitEstimate(estimate({available_milli_2z:2999n,cap_remaining_milli_2z:null}),null),{code:'insufficient_balance'});
 assert.throws(()=>admitEstimate(estimate({available_milli_2z:9000n,cap_remaining_milli_2z:2999n}),budget),{code:'cap_exceeded'});
 assert.throws(()=>admitEstimate(estimate({available_milli_2z:9000n,cap_remaining_milli_2z:2999n}),null),{code:'cap_exceeded'});
 assert.throws(()=>admitEstimate(estimate({available_milli_2z:9000n}),budget),{code:'grant_verification_required'});
 for(const bad of [{hold_2z:0n},{hold_2z:3},{available_milli_2z:'3000'},{cap_remaining_milli_2z:3000}])
  assert.throws(()=>admitEstimate(estimate({available_milli_2z:9000n,cap_remaining_milli_2z:9000n,...bad}),budget),{code:'estimate_invalid'});
});
test('spending snapshot reports the last estimate, budget remainder and settled batch charge, never prompts or ids',async()=>{
 const f=fixture([{type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:3n,receiptId:'r'},cap_remaining_milli_2z:97000n} as any]);
 assert.deepEqual(f.tutor.spending(),{});
 f.setHold(4n);await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
 assert.deepEqual(f.tutor.spending(),{availableMilli2z:500000n,capRemainingMilli2z:97000n,batchEstimate2z:4n,batchCharge2z:3n});
 const g=fixture();g.setGrant({spend_cap_2z:null});g.setCap(null);
 await g.tutor.reply('verified-model','p','c',await liveAuthorization(g),{kind:'curiosity',profileId:'learner',activityId:'a',question:'Why?'});
 assert.deepEqual(g.tutor.spending(),{availableMilli2z:500000n,capRemainingMilli2z:null},'a curiosity answer is not a batch cost');
});

// ---- Journal migration: operations written by the test-era (500 2Z total) build stay recoverable ----
test('a journal written under the test-era policy is still read, blocks fresh spending while unsettled, and recovers with its original identity',async()=>{
 for(const version of [1,2]){
  const f=fixture([]);
  // Literal wire format as the TestAuthorization build wrote it: an archived settled call that used the old
  // 500 2Z allowance almost entirely, and an interrupted request with its saved body, key and resume context.
  const body=[{role:'system',content:[{type:'text',text:'legacy system'}]},{role:'user',content:[{type:'text',text:'legacy context'}]}];
  f.setValue({version,operations:[
   {id:'legacy-settled',key:'legacy-key-1',subject:'adult',generation:'old-generation',createdAt:iso(-3*60*60*1000),request:{model:'verified-model',messages:[],maxOutputTokens:'1800'},state:'finalized',text:'',charge:{state:'charged',charged2z:'499',receiptId:'legacy-receipt'}},
   {id:'legacy-open',key:'legacy-key-2',subject:'adult',generation:'old-generation',createdAt:iso(-60*60*1000),request:{model:'verified-model',messages:body,maxOutputTokens:'1800'},state:'interrupted',text:'',callId:'legacy-call',context:{kind:'activity',profileId:'learner',candidateSkillIds:['4.NF.B.3']}},
  ]});
  const pending=await f.tutor.inspectPending();
  assert.deepEqual(pending.map(p=>[p.operationId,p.state,p.canRecover,p.profileId]),[['legacy-open','interrupted',true,'learner']]);
  // The new policy keeps "an unsettled receipt blocks new paid calls", even with no app budget.
  f.setGrant({spend_cap_2z:null});f.setCap(null);const authorization=await liveAuthorization(f);
  await assert.rejects(f.tutor.reply('verified-model','p','c',authorization),{code:'settlement_pending'});
  assert.equal(f.calls.length,0);
  // Same-key recovery under a new-policy authorization replays the exact original body, budget and key.
  await assert.rejects(f.tutor.recover('legacy-open',authorization),{code:'interrupted'});
  assert.equal(f.calls.length,1);
  assert.deepEqual(f.calls[0].options,{operationId:'legacy-open',idempotencyKey:'legacy-key-2'});
  assert.deepEqual(f.calls[0].request.messages,body);assert.equal(f.calls[0].request.max_output_tokens,1800n);
  assert.equal(f.getValue().version,2,'the container upgrades on its first write');
  assert.equal(f.getValue().operations[0].charge.charged2z,'499','old charges are preserved exactly');
  // Once settled, the old 499 2Z of test-era spending is not an app-side ceiling any more.
  await f.tutor.reconcile();assert.deepEqual(await f.tutor.inspectPending(),[]);
  const fresh=fixture();fresh.setValue(f.getValue());fresh.setGrant({spend_cap_2z:null});fresh.setCap(null);
  await fresh.tutor.reply('verified-model','p','c',await liveAuthorization(fresh));assert.equal(fresh.calls.length,1,`v${version}`);
 }
});

// ---- max_output_tokens_strict: never truncated-but-charged ----
const refusal=(status:number,reason:string,code='insufficient_balance')=>new SdkError(code,{status,details:{reason}});
test('strict output is sent on the estimate and the chat request for batches, tutor replies and recovery',async()=>{
 for(const [ctx,budget] of [[batchContext,'2600'],[undefined,'1800'],[{kind:'curiosity' as const,profileId:'p',activityId:'a',question:'Why?'},'1800']] as const){
  const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization,ctx,budget as any);
  assert.equal(f.estimates.length,2,'admission at journal time and again at the send boundary');
  for(const e of f.estimates)assert.equal(e.max_output_tokens_strict,true);
  assert.equal(f.calls[0].request.max_output_tokens_strict,true);
 }
 const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'interrupted'});
 const before=f.estimates.length;await f.tutor.recover(f.getValue().operations[0].id,f.authorization).catch(()=>{});
 assert.ok(f.estimates.length>before);for(const e of f.estimates)assert.equal(e.max_output_tokens_strict,true);
 for(const c of f.calls)assert.equal(c.request.max_output_tokens_strict,true,'same-key recovery stays strict');
});
test('an estimate that returns fewer output tokens than requested is a refusal, even with strict',async()=>{
 const f=fixture();f.setEstimateTokens(1000n);
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code:'not_enough_2z'});
 assert.equal(f.calls.length,0,'nothing is sent');assert.equal(f.getValue()?.operations?.length??0,0,'nothing is journaled');
});
test('a strict estimate refusal (402/403 with details.reason) is a calm zero-charge refusal before any journal write',async()=>{
 for(const [status,reason,code] of [[402,'insufficient_balance','insufficient_balance'],[403,'cap_exceeded','cap_exceeded'],[402,'something_new','not_enough_2z']] as const){
  const f=fixture();f.setEstimateError(refusal(status,reason,reason==='something_new'?'payment_required':reason));
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code});
  assert.equal(f.calls.length,0);assert.equal(f.getValue()?.operations?.length??0,0);
 }
});
test('a strict chat refusal settles the journal entry as released, 0 charged, with no pending receipt, and later calls proceed',async()=>{
 for(const [status,reason,code] of [[402,'insufficient_balance','insufficient_balance'],[403,'cap_exceeded','cap_exceeded'],[402,'balance_changed','not_enough_2z']] as const){
  const f=fixture();f.setChatError(refusal(status,reason,reason==='balance_changed'?'payment_required':reason));
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code});
  const [op]=f.getValue().operations;
  assert.equal(op.state,'finalized');assert.deepEqual(op.charge,{state:'released',charged2z:'0'});
  assert.deepEqual(await f.tutor.inspectPending(),[],'no unsettled receipt');
  assert.deepEqual(await f.tutor.reconcile(),{pending:0,spent2z:0n});
  f.setChatError(undefined);
  const reply=await f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600');
  assert.equal(reply.text,'{"activity":true}','future paid calls are not blocked');
 }
});
test('a refusal at the send-boundary estimate releases the never-sent journal entry',async()=>{
 const f=fixture();let n=0;const estimate=f.client.estimate;
 f.client.estimate=async(r)=>{if(++n===2)throw refusal(402,'insufficient_balance');return estimate(r);};
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'insufficient_balance'});
 assert.equal(f.calls.length,0);assert.deepEqual(f.getValue().operations[0].charge,{state:'released',charged2z:'0'});
 assert.deepEqual(await f.tutor.inspectPending(),[]);
});
test('the native transport drops details: a bare 402/403 with the gateway refusal code is still a zero-charge release',async()=>{
 for(const [status,code] of [[402,'insufficient_balance'],[403,'cap_exceeded']] as const){
  const f=fixture();f.setChatError(new SdkError(code,{status}));
  await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization,batchContext,'2600'),{code});
  assert.deepEqual(f.getValue().operations[0].charge,{state:'released',charged2z:'0'});assert.deepEqual(await f.tutor.inspectPending(),[]);
 }
});
test('non-refusal chat failures stay uncertain and block further calls',async()=>{
 const f=fixture();f.setChatError(new SdkError('unavailable',{status:503}));
 await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));
 assert.equal(f.getValue().operations[0].state,'interrupted');
 for(const e of [new SdkError('invalid_token',{status:403}),new SdkError('insufficient_scope',{status:403,details:{}}),new SdkError('payment_required',{status:402}),new SdkError('insufficient_balance',{status:500}),new SdkError('insufficient_balance',{status:402,callId:'c1'})]){
  const g=fixture();g.setChatError(e);await assert.rejects(g.tutor.reply('verified-model','p','c',g.authorization));
  assert.notEqual(g.getValue().operations[0].charge?.state,'released','only a strict refusal with details.reason is a zero-charge release');
 }
});
