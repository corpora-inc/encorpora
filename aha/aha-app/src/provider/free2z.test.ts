import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatEvent, ChatRequest, ChatStream, Session } from '@free2z/sdk';
import { Free2zTutor, format2z, type Journal, type SdkClient } from './free2z.ts';
const session: Session = {signedIn:true,subject:'adult',generation:'one',grantedScopes:['ai:invoke'],persistence:'persistent'};
function fixture(events: ChatEvent[] = [{type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}]) {
  let value: unknown; const calls: {request:ChatRequest; options:any}[] = []; let activeSession = session;
  let cap: bigint | null = 500000n; let cancelled = 0;
  const journal: Journal = {getJournal:async()=>structuredClone(value),putJournal:async(key,v)=>{if(key==='aha-billing-v1')value=structuredClone(v);}};
  const client: SdkClient = {
    session:async()=>activeSession, signIn:async()=>session, signOut:async()=>({revoked:true,generation:'two'}),
    balance:async()=>({available_milli_2z:500000n,held_milli_2z:0n,balance_milli_2z:500000n,debt_milli_2z:0n,as_of:new Date().toISOString()}),
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
  return {client,journal,tutor:new Free2zTutor(client,journal,'adult'),calls,authorization:{subject:'adult',maximum2z:500n,verifiedGrant:{subject:'adult',period:'total' as const,limit2z:500n}},setCap:(v:bigint|null)=>{cap=v;},setSession:(v:Session)=>{activeSession=v;},getValue:()=>value as any,cancelled:()=>cancelled};
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

test('unverified or periodic grant metadata cannot authorize paid tests',async()=>{const f=fixture();await assert.rejects(f.tutor.reply('verified-model','p','c',{subject:'adult',maximum2z:500n} as any),{code:'grant_verification_required'});assert.equal(f.calls.length,0);});
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
  await f.tutor.recover(op.id,f.authorization);assert.deepEqual(f.calls[0],f.calls[1]);
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
