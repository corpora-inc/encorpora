import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatEvent, ChatRequest, ChatStream, Session } from '@free2z/sdk';
import { Free2zTutor, format2z, type Journal, type SdkClient } from './free2z.ts';
const session: Session = {signedIn:true,subject:'adult',generation:'one',grantedScopes:['ai:invoke'],persistence:'persistent'};
function fixture(events: ChatEvent[] = [{type:'done',finish_reason:'stop',settlement:'settled',charge:{state:'charged',charged2z:2n,receiptId:'receipt'}}]) {
  let value: unknown; const calls: {request:ChatRequest; options:any}[] = []; let activeSession = session;
  let cap: bigint | null = 500000n; let cancelled = 0;
  const journal: Journal = {getJournal:async()=>structuredClone(value),putJournal:async(_key,v)=>{value=structuredClone(v);}};
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
  return {client,journal,tutor:new Free2zTutor(client,journal,'adult'),calls,authorization:{subject:'adult',maximum2z:500n},setCap:(v:bigint|null)=>{cap=v;},setSession:(v:Session)=>{activeSession=v;},getValue:()=>value as any,cancelled:()=>cancelled};
}
test('formats balances without losing integer precision',()=>{assert.equal(format2z(9007199254740993123n),'9007199254740993.123 2Z');assert.equal(format2z(-1500n),'-1.5 2Z');});
test('journals before invocation and persists finalized output and exact receipt',async()=>{const f=fixture();const r=await f.tutor.reply('verified-model','policy','context',f.authorization);assert.equal(r.text,'{"activity":true}');assert.equal(f.getValue().operations[0].charge.charged2z,'2');assert.equal(f.getValue().operations[0].state,'finalized');});
test('estimate is not a cap; absent or excessive grant caps block any paid call',async()=>{for(const cap of [null,501000n]){const f=fixture();f.setCap(cap);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_cap_required'});assert.equal(f.calls.length,0);}});
test('a partial stream remains uncertain and blocks another paid call',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'interrupted'});assert.equal(f.getValue().operations[0].state,'interrupted');await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'settlement_pending'});assert.equal(f.calls.length,1);const summary=await f.tutor.reconcile();assert.equal(summary.pending,0);assert.equal(summary.spent2z,2n);});
test('charged failures retain receipts and never automatically retry',async()=>{const f=fixture([{type:'error',code:'provider_error',partial:true,settlement:'settled',charge:{state:'charged',charged2z:3n,receiptId:'r'}}]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'provider_error'});assert.equal(f.calls.length,1);assert.equal(f.getValue().operations[0].charge.charged2z,'3');});
test('account mismatch prevents billable work',async()=>{const f=fixture();f.setSession({...session,subject:'another'});await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'account_changed'});assert.equal(f.calls.length,0);});
test('same-operation recovery preserves request and key; never starts a fresh operation',async()=>{const f=fixture([]);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization));const op=f.getValue().operations[0];await assert.rejects(f.tutor.recover(op.id));assert.deepEqual(f.calls[0],f.calls[1]);});
test('concurrent generation cannot double charge on duplicate taps',async()=>{const f=fixture();const first=f.tutor.reply('verified-model','p','c',f.authorization);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'busy'});await first;assert.equal(f.calls.length,1);});
test('remaining authorization includes finalized charges, not only current call estimate',async()=>{const f=fixture();await f.tutor.reply('verified-model','p','c',f.authorization);await assert.rejects(f.tutor.reply('verified-model','p','c',f.authorization),{code:'grant_cap_required'});assert.equal(f.calls.length,1);f.setCap(498000n);await f.tutor.reply('verified-model','p','c',f.authorization);assert.equal(f.calls.length,2);});
