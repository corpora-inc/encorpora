/**
 * Explicit TEST-ONLY browser IPC fixture. Not native SQLite/device/service acceptance, and not live AI:
 * the "model" replies below are hand-authored test fixtures from src/activity/fixtures.
 */
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
const ownRoot=fileURLToPath(new URL('..',import.meta.url));
const root=path.resolve(process.env.AHA_UI_APP_ROOT||ownRoot);
const {expectedAnswer}=await import(pathToFileURL(path.join(root,'src/learning/tasks.ts')).href);
const {fixtures}=await import(pathToFileURL(path.join(root,'src/activity/fixtures/index.ts')).href);
// Numeric-answer TEST FIXTURES stand in for model-authored activities (typed answers keep the driver simple).
const batchFixtures=fixtures.filter(f=>f.response.type==='numeric');
// The bounded wait for a batch on its way (BATCH_WAIT_MS, 6 s) plus margin.
const BATCH_WAIT_TEST_MS=12_000;
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','1436','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(specs){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  const streams=new Map();
  // TEST-ONLY grant/estimate knobs. Default: Free2Z's pre-activation state (enforced:false, platform_disabled)
  // with a 100 2Z total app budget once enforced; scenarios switch to no budget or a low balance.
  window.__ahaAI={signedIn:true,enforced:false,reason:'platform_disabled',spendCap:'100',capPeriod:'total',capRemaining:'99000',available:'100000',hold:'1',starts:[],requests:[],batches:0,delayModels:false,releaseModels:null,blockEstimate:false,grants:0,activityAccounts:[],malformedNext:false};
  const ai=window.__ahaAI;
  /** TEST "model": answers the batch prompt with fixture specs whose skills are in the standards window it was shown. */
  const batchText=user=>{
    const allowed=new Set(user.split('\nSTANDARDS\n')[1].split('\nWrite ')[0].split('\n').map(line=>line.split(' ')[0]));
    const usable=specs.filter(f=>f.skillIds.every(id=>allowed.has(id)));
    const pool=usable.length>=3?usable:specs;
    const start=(ai.batches++*3)%pool.length;
    let chosen=[0,1,2].map(i=>pool[(start+i)%pool.length]);
    // TEST-ONLY: pin each activity's difficulty so a scenario can queue a harder or an easier one.
    if(ai.difficulties)chosen=chosen.map((c,i)=>({...c,difficulty:ai.difficulties[i]??c.difficulty}));
    if(ai.malformedNext){
      ai.malformedNext=false;
      // Fenced, with chatter, and one activity whose key disagrees with its own keyCheck.
      const broken={...chosen[1],id:'broken-key',keyCheck:{value:'1+1000'}};
      return 'Here is the batch:\n```json\n'+JSON.stringify({rationale:'TEST fixture batch',activities:[chosen[0],broken,chosen[2]]})+'\n```';
    }
    return JSON.stringify({rationale:'TEST fixture batch',activities:chosen});
  };
  const session=()=>({signedIn:ai.signedIn,subject:ai.signedIn?'test-subject':null,grantedScopes:['ai:invoke','balance:read'],persistence:'persistent',generation:'1'});
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:true,clientId:'test-client',paidTestingReady:false,externalCheckoutEnabled:false,reason:'Explicit TEST SDK fixture'};
    if(command==='plugin:f2z|sign_in'){(ai.signIns??=[]).push(args.options);if(ai.failSignIn){const e=ai.failSignIn;ai.failSignIn=null;throw e;}ai.signedIn=true;return session();}
    if(command==='plugin:f2z|session')return session();
    if(command==='plugin:f2z|sign_out'){if(ai.failSignOut)throw {code:'storage_error'};ai.signedIn=false;return {revoked:true,generation:'2'};}
    if(command==='plugin:f2z|balance')return {available_milli_2z:ai.available,held_milli_2z:'0',balance_milli_2z:ai.available,debt_milli_2z:'0',as_of:new Date().toISOString()};
    if(command==='plugin:f2z|grant'){ai.grants++;return {sub:'test-subject',client_id:'test-client',account_epoch:'0',grant_generation:'1',scopes:['ai:invoke'],spend_cap_2z:ai.spendCap,cap_period:ai.capPeriod,enforced:ai.enforced,enforcement_reason:ai.enforced?'ok':ai.reason,as_of:new Date().toISOString()};}
    if(command==='plugin:f2z|models'){
      if(ai.delayModels)await new Promise(resolve=>{ai.releaseModels=resolve;});
      if(ai.models502)throw {code:'unavailable'};
      // TEST-ONLY: `structured` advertises capabilities.structured_output (zuu 42acc57f); default: an entry without it.
      return {catalog_version:'1',models:[{id:'fixture-model',max_output_tokens:'4096',...(ai.structured?{capabilities:{vision:false,tools:false,reasoning:false,structured_output:true}}:{})}]};
    }
    // Gateway image 70b74edd9 (da1862531): every paid request must carry strict output (never truncated-but-charged).
    if((command==='plugin:f2z|estimate'||command==='plugin:f2z|start_chat')&&args.request.max_output_tokens_strict!==true)throw new Error('TEST gateway: max_output_tokens_strict:true is required on every paid request');
    // A model that does not advertise structured output must never receive response_format.
    if((command==='plugin:f2z|estimate'||command==='plugin:f2z|start_chat')&&args.request.response_format!==undefined&&!ai.structured)throw new Error('TEST gateway: response_format sent to a model without capabilities.structured_output');
    // TEST-ONLY format refusal, shaped as the native transport delivers it (status and code; details dropped).
    if(command==='plugin:f2z|estimate'&&args.request.response_format&&ai.formatRefusal==='estimate')throw {code:'invalid_request',status:400};
    if(command==='plugin:f2z|estimate'){
      // TEST-ONLY: `holdEstimate` keeps the next estimate pending until the scenario calls releaseEstimate().
      if(ai.holdEstimate){ai.holdEstimate=false;await new Promise(resolve=>{ai.releaseEstimate=resolve;});}
      if(ai.blockEstimate)throw {code:'unavailable',retryAfterSeconds:'10'};
      return {model:'fixture-model',input_tokens:'500',max_output_tokens:args.request.max_output_tokens,hold_2z:ai.hold,available_milli_2z:ai.available,cap_remaining_milli_2z:ai.capRemaining};
    }
    if(command==='plugin:f2z|start_chat'){
      ai.starts.push(args.operation);ai.requests.push(args.request);
      if(args.request.response_format&&ai.formatRefusal==='chat')throw {code:'invalid_request',status:400};
      if(ai.strictRefusal){const reason=ai.strictRefusal;ai.strictRefusal=null;ai.refused=(ai.refused??0)+1;throw {code:reason,status:402};}
      if(ai.failOpening){ai.failOpening=false;throw {code:'unavailable',retryAfterSeconds:'5'};}
      const user=args.request.messages[1].content[0].text;
      const text=user.startsWith('LEARNER ')?batchText(user):'You can use this idea to share ingredients fairly.';
      streams.set(args.operation.operationId,[
        {type:'meta',call_id:'fixture-call',model:'fixture-model',hold_2z:'1'},
        {type:'delta',text},
        {type:'done',finish_reason:'stop',settlement:'settled',charged_2z:'1',receipt_id:'fixture-receipt'},
      ]);
      return {operationId:args.operation.operationId,callId:'fixture-call'};
    }
    // TEST-ONLY: `holdChat` keeps the next batch on its way until the scenario calls releaseChat().
    if(command==='plugin:f2z|next_chat'&&ai.holdChat){ai.holdChat=false;await new Promise(resolve=>{ai.releaseChat=resolve;});}
    if(command==='plugin:f2z|next_chat')return streams.get(args.operationId)?.shift()??null;
    if(command==='plugin:f2z|cancel_chat')return;
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
    if(command!=='local_repository')throw new Error(`Unexpected test IPC: ${command}`);
    const r=args.request;if(!['local-device','test-subject'].includes(r.accountId))throw new Error('Unexpected test account');
    const db=read(),id=r.profileId;let result;
    switch(r.operation){
      case 'getJournal':return db.journals?.[r.key]??null;
      case 'putJournal':if(ai.failAck&&r.data.operations?.some(o=>o.consumed)){ai.failAck=false;throw new Error('TEST acknowledgement write failed');}(db.journals??={})[r.key]=r.data;break;
      case 'listProfiles':return db.profiles;
      case 'saveProfile':db.profiles=db.profiles.filter(p=>p.id!==id);db.profiles.push(r.data);break;
      case 'loadSession':return db.sessions[id]??null;
      case 'saveSession':if(window.__ahaFixture.failNextSession){window.__ahaFixture.failNextSession=false;throw new Error('TEST disk full: session write rejected');}db.sessions[id]=r.data;break;
      case 'saveActivity':{const prior=(db.activities[id]??[]).find(a=>a.id===r.data.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(r.data))throw new Error('Activity ids are immutable');}ai.activityAccounts.push(r.accountId);(db.activities[id]??=[]).push(r.data);break;
      case 'listActivities':return db.activities[id]??[];
      case 'loadSnapshot':return db.snapshots[id]??null;
      case 'listAttempts':return db.attempts[id]??[];
      case 'listDisputes':return db.disputes[id]??[];
      case 'recordAttempt':{
        const records=db.attempts[id]??=[];
        if(records.some(a=>a.id===r.data.id))return {inserted:false,snapshot:db.snapshots[id]};
        if(records.some(a=>a.activityId===r.data.activityId)||(db.disputes[id]??[]).some(d=>d.activityId===r.data.activityId))throw new Error('Duplicate or disputed activity');
        records.push(r.data);db.snapshots[id]=r.snapshot;result={inserted:true,snapshot:r.snapshot};break;
      }
      case 'recordDispute':(db.disputes[id]??=[]).push(r.data);db.snapshots[id]=r.snapshot;break;
      default:throw new Error(`Unexpected test operation: ${r.operation}`);
    }
    localStorage.setItem(key,JSON.stringify(db));return result;
  }};
}
try {
  let ready=false;
  for(let i=0;i<100;i++){
    if(vite.exitCode!==null)throw new Error(`Vite exited: ${output}`);
    try{if(stripVTControlCharacters(output).includes('http://127.0.0.1:1436')&&(await fetch('http://127.0.0.1:1436')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,output);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1000,height:900}});await context.addInitScript(fixture,batchFixtures);
  const page=await context.newPage();
  const errors=[],consoleErrors=[],consoleWarnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());if(m.type()==='warning')consoleWarnings.push(m.text());});
  const session=()=>page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
  const localBanner=page.getByRole('button',{name:'Local practice · AI tutoring is unavailable right now',exact:true});
  const aiBanner=page.getByRole('button',{name:'AI tutoring · progress saved on this device',exact:true});
  const nextButton=page.getByRole('button',{name:'Next',exact:true});
  const enter=async value=>{const name={'<':'Less than','>':'Greater than','=':'Equal to'}[value];if(name)await page.getByRole('button',{name,exact:true}).click();else await page.getByLabel('Your answer',{exact:true}).fill(value);};
  // A relaunch opens the studio home; one tap re-enters the loop.
  const resume=async()=>{await page.getByRole('button',{name:'Continue',exact:true}).click();};
  const shownId=s=>s.activity?.id??s.aiActivity?.activityId;
  const journal=()=>page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1']);
  const lastAttempt=()=>page.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat().at(-1).data);
  /** Answers whatever is shown: a local task, or an AI activity (TEST fixture spec) via its own numeric input. */
  const answerCurrent=async(correct=true)=>{
    const s=await session();
    if(s.aiActivity){
      const key=s.aiActivity.spec.response.answer;
      await page.locator('.aha-activity input[inputmode="decimal"]').fill(String(correct?key:key+1));
    } else await enter(expectedAnswer(s.activity.task));
    await page.getByRole('button',{name:'Check',exact:true}).click();
    await nextButton.waitFor();
  };
  const aiCard=page.locator('.focus-stage.is-spec .aha-activity');
  // Settings open from the focus bar's status dot (closing returns to the problem) or from home. No gate (#870).
  const settings=async()=>{if(await page.locator('.status-dot').count()){await page.locator('.status-dot').click();await page.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();}else await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();};
  await page.goto('http://127.0.0.1:1436');
  // platform_disabled (Free2Z's pre-activation state): AI is not ready yet. Calm at launch: no alert.
  await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
  assert.equal(await page.getByRole('alert').count(),0,'a platform that is not enforcing yet is not an alert');
  assert.ok(consoleErrors.some(m=>/AI unavailable for connect/.test(m)&&/ai_not_ready/.test(m)),'the not-ready state is still logged visibly');
  // Signed in but AI unavailable: local practice in the SAME account partition, labeled local, no alert.
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'platform_disabled never starts chat');
  assert.equal((await session()).activity.source,'local','fallback activity is recorded as local, never AI');
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.activityAccounts),['test-subject'],'fallback practice stays in the signed-in account partition');
  await localBanner.waitFor();
  assert.equal(await page.getByRole('alert').count(),0,'fallback is calm and non-blocking');
  assert.ok(consoleErrors.some(m=>/local practice/i.test(m)&&/ai_not_ready/.test(m)),'fallback cause is logged visibly');
  await settings();
  await page.getByText('Local practice continues in this account',{exact:false}).first().waitFor();
  await page.getByText('Free2Z AI isn’t switched on for apps yet. Nothing was charged.',{exact:false}).first().waitFor();
  assert.equal(await page.getByText('Sign out to use',{exact:false}).count(),0,'no sign-out dead end');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  // Backoff: the very next task stays local without re-checking the grant.
  const grantsAfterFailure=await page.evaluate(()=>window.__ahaAI.grants);
  await answerCurrent();
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.grants),grantsAfterFailure,'backoff does not hammer Free2Z on the next task');
  assert.equal((await session()).activity.source,'local');
  await answerCurrent();
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  await settings();await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  // Current production condition: models endpoint 502 while signed in.
  await page.evaluate(()=>{window.__ahaAI.models502=true;});
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal((await session()).activity.source,'local','models 502 falls back to local practice');
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'models 502 never starts chat');
  await localBanner.waitFor();
  await answerCurrent();
  await page.evaluate(()=>{window.__ahaAI.models502=false;});
  await settings();await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.delayModels=true;});
  const beforeStop=(await session()).activity.id;
  await nextButton.click();
  await page.waitForFunction(()=>window.__ahaAI.releaseModels!==null);
  await page.getByRole('button',{name:'Stop AI request',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.delayModels=false;window.__ahaAI.releaseModels();});
  await page.getByRole('alert').filter({hasText:'Stopped before starting'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'Stop during preparation never starts a paid call');
  assert.equal((await session()).activity.id,beforeStop,'a learner Stop is not silently replaced by local practice');
  // ---- AI-authored activities (TEST fixture specs as the model's text) ----
  await page.evaluate(()=>{window.__ahaAI.failAck=true;});
  await nextButton.click();
  await aiCard.waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),1,'one paid call for a whole batch, through the real SDK native transport');
  const batchRequest=await page.evaluate(()=>window.__ahaAI.requests.at(-1));
  assert.equal(batchRequest.max_output_tokens,'2600','batch budget is the spec prompt budget');
  assert.equal(batchRequest.max_output_tokens_strict,true,'strict output is required on the paid batch request');
  assert.match(batchRequest.messages[0].content[0].text,/activity author/,'prompt-only JSON via the Activity Spec prompt');
  assert.ok(!batchRequest.messages[1].content[0].text.includes('Explorer'),'learner summary carries no names');
  let s1=await session();
  assert.equal(s1.activity,null,'an AI activity replaces the canonical task');
  assert.match(s1.aiActivity.activityId,/:0$/);
  assert.equal(s1.aiQueue.length,2,'the rest of the paid batch waits durably in the presentation session');
  await aiBanner.waitFor();
  assert.equal(await page.getByRole('alert').count(),0,'a failed acknowledgement after the durable queue save is not an alert');
  const unacked=(await journal()).operations.find(o=>o.context?.kind==='activities');
  assert.ok(unacked.answerComplete&&!unacked.consumed,'acknowledgement failed: the completed batch stays saved');
  assert.equal(unacked.request.maxOutputTokens,'2600');
  assert.equal((await journal()).version,3,'usage journal v3');
  assert.ok(!('response_format' in batchRequest)&&!('responseFormat' in unacked.request),'a model without the capability gets the prompt-only request');
  // Assistance on an AI activity is recorded before the answer and survives a force-reload.
  await page.getByRole('button',{name:'Hint',exact:true}).click();
  await page.locator('.help-panel').waitFor();
  await page.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.hintsUsed===1);
  await page.reload();await resume();
  await aiCard.waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'force-reload mid-queue resumes without a new paid call');
  const s2=await session();
  assert.equal(s2.aiActivity.activityId,s1.aiActivity.activityId,'the same AI activity is resumed');
  assert.equal(s2.aiQueue.length,2,'the queue survives the restart and the redelivered batch is not queued twice');
  assert.equal(s2.hintsUsed,1,'restoring an already displayed activity keeps its assistance');
  await page.getByRole('button',{name:'Hint',exact:true}).click();
  await page.locator('.help-panel').waitFor();
  await page.waitForFunction(id=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.id===id).consumed===true,unacked.id);
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  await answerCurrent(true);
  const hinted=await lastAttempt();
  assert.equal(hinted.source,'ai-spec');
  assert.equal(hinted.activityId,s1.aiActivity.activityId);
  assert.equal(hinted.correct,true);
  assert.equal(hinted.independent,false,'restored hinted answer never earns independent evidence');
  assert.match(hinted.spec.hash,/^[0-9a-f]{16}$/);
  assert.deepEqual(hinted.spec.content,s1.aiActivity.spec,'the exact spec is stored with its evidence');
  await aiCard.getByText('Yes, that’s it.',{exact:true}).waitFor();
  // The queue drops to one: the next batch is prefetched in the background while the learner works.
  await page.evaluate(()=>{window.__ahaAI.malformedNext=true;});
  await nextButton.click();
  await aiCard.waitFor();
  await page.waitForFunction(()=>window.__ahaAI.starts.length===1);
  await page.waitForFunction(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).length===3);
  assert.equal(await page.getByRole('button',{name:'Check',exact:true}).isVisible(),true,'prefetch never blocks the current activity');
  const prefetched=(await session()).aiQueue.slice(1);
  assert.equal(prefetched.length,2,'malformed batch: the two valid activities are kept, the bad key is dropped');
  assert.ok(prefetched.every(q=>q.spec.id!=='broken-key'));
  assert.ok(await page.evaluate(()=>(localStorage.getItem('aha-diagnostics-log')??'').includes('rejected 1')),'rejected activities are logged as model-quality telemetry');
  await answerCurrent(false);
  const wrong=await lastAttempt();
  assert.equal(wrong.source,'ai-spec');assert.equal(wrong.correct,false);assert.equal(wrong.independent,false);
  await page.getByRole('button',{name:'Show me how',exact:true}).click();
  await page.locator('.help-panel').waitFor();
  // AI unavailable while the queue drains: queued activities are still served, then local practice takes over.
  await page.evaluate(()=>{window.__ahaAI.models502=true;});
  const startsBeforeDrain=await page.evaluate(()=>window.__ahaAI.starts.length);
  for(let i=0;i<3;i++){
    await nextButton.click();
    await page.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.ok((await session()).aiActivity,'queued AI activity served without a new paid call');
    await answerCurrent(true);
  }
  assert.equal((await session()).aiQueue,undefined,'queue drained');
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal((await session()).activity.source,'local','AI failure with an empty queue falls back to local practice');
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),startsBeforeDrain,'the failed prefetch never reached a paid call');
  await localBanner.waitFor();
  assert.ok(consoleErrors.some(m=>/AI unavailable for prefetch/.test(m)),'the failed prefetch is logged visibly');
  assert.equal((await page.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat())).filter(a=>a.data.source==='ai-spec').length,5,'every answered AI activity is recorded evidence');
  await answerCurrent();
  await page.evaluate(()=>{window.__ahaAI.models502=false;});
  await settings();await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.failOpening=true;});
  const startsBeforeOutage=await page.evaluate(()=>window.__ahaAI.starts.length);
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),startsBeforeOutage+1);
  assert.equal((await session()).activity.source,'local','failed opening falls back to local practice');
  await localBanner.waitFor();
  await settings();
  await page.getByText('Wait at least 5 seconds',{exact:false}).first().waitFor();
  await page.getByRole('button',{name:'Recover original request',exact:true}).waitFor();
  const starts=await page.evaluate(()=>window.__ahaAI.starts);
  await page.getByRole('button',{name:'Recover original request',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Free2Z asked us to wait'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),starts.length,'wrapped Retry-After blocks immediate recovery');
  await page.getByRole('button',{name:'Delete this learner’s local progress',exact:true}).click();
  await page.getByRole('button',{name:'Delete local learner',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'outstanding AI usage before deleting'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaFixture.read().profiles.length),1,'unresolved request keeps original learner recoverable');
  await page.waitForTimeout(5100);
  // The unsettled receipt still blocks a NEW paid call but no longer blocks local practice.
  await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  const grantsBeforePending=await page.evaluate(()=>window.__ahaAI.grants),consoleBeforePending=consoleErrors.length;
  await answerCurrent();
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>window.__ahaAI.grants)>grantsBeforePending,'AI was retried after the backoff reset');
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),starts.length,'pending receipt blocks a new paid call');
  assert.equal((await session()).activity.source,'local','pending receipt does not block local practice');
  assert.ok(consoleErrors.slice(consoleBeforePending).some(m=>/settlement_pending/.test(m)),'pending-receipt fallback is logged');
  // Same-key recovery of the interrupted batch. Its queue save fails once (disk full): the completed
  // batch must stay durable in the journal and reach the learner after a restart without a new call.
  await settings();
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Recover original request',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  const after=await page.evaluate(()=>window.__ahaAI.starts);
  assert.deepEqual(after.at(-1),starts.at(-1),'recovery keeps both original request identifiers');
  const undelivered=await page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.answerComplete&&!o.consumed));
  assert.ok(undelivered,'paid completion remains durable before UI acknowledgement');
  assert.equal(undelivered.context.kind,'activities','a recovered batch is delivered exactly like a fresh one');
  await page.reload();await resume();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'restart delivers saved answer without another model invocation');
  await page.waitForFunction(id=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.id===id).consumed===true,undelivered.id);
  assert.ok((await session()).aiQueue.every(q=>q.operationId===undelivered.id)&&(await session()).aiQueue.length===3,'the recovered batch is queued once');
  await answerCurrent();
  await nextButton.click();
  await aiCard.waitFor();
  assert.equal((await session()).aiActivity.operationId,undelivered.id,'the recovered batch is served after the restart');
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  await page.getByRole('button',{name:'Ask a question',exact:true}).click();
  await page.getByRole('button',{name:'Where would I use this in real life? ↗',exact:true}).click();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  await page.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.curiosity?.answer);
  await page.reload();await resume();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'paid curiosity restores without a new call');
  await page.getByRole('button',{name:'Back to the problem',exact:true}).click();
  // An interrupted curiosity request stays recoverable after local practice moves the learner on.
  await page.evaluate(()=>{window.__ahaAI.enforced=true;window.__ahaAI.failOpening=true;});
  const curiosityStarts=await page.evaluate(()=>window.__ahaAI.starts.length);
  await page.getByRole('button',{name:'Ask a question',exact:true}).click();
  await page.getByRole('button',{name:'Where would I use this in real life? ↗',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Wait at least 5 seconds'}).waitFor();
  const interrupted=await page.evaluate(()=>window.__ahaAI.starts.at(-1));
  await page.getByRole('button',{name:'Back to the problem',exact:true}).click();
  await answerCurrent();
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.ok((await session()).aiActivity,'an unsettled curiosity request does not block already-paid queued activities');
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),curiosityStarts+1,'no new paid call while the curiosity receipt is unsettled');
  const localTask=shownId(await session());
  await page.waitForTimeout(5100);
  await settings();
  await page.getByRole('button',{name:'Recover original request',exact:true}).click();
  await page.getByText('Recovered lesson is ready.',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.starts.at(-1)),interrupted,'curiosity recovery reuses the original request identity');
  assert.equal(await page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.filter(o=>o.state!=='finalized').length),0,'receipt settled; paid AI is no longer blocked');
  const afterRecovery=await session();
  assert.equal(shownId(afterRecovery),localTask,'recovered curiosity answer does not replace the current task');
  assert.equal(afterRecovery.hintsUsed,1,'recovered answer counts as assistance on the unanswered task');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to the problem',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.failSignOut=true;});
  await settings();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).count(),1,'failed native deletion retains connected account UI');
  await page.evaluate(()=>{window.__ahaAI.failSignOut=false;});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  // Disconnected settings offer Connect only; account-only actions stay hidden (#862).
  const connect=page.getByRole('button',{name:'Connect Free2Z',exact:false});
  await connect.waitFor();
  const accountOnly=async()=>({
    manage:await page.getByRole('button',{name:'Manage allowance or balance',exact:false}).count(),
    refresh:await page.getByRole('button',{name:'Refresh connection',exact:true}).count(),
    signOut:await page.getByRole('button',{name:'Sign out',exact:true}).count(),
  });
  const disconnected=async why=>{
    await page.locator('.connection-pill').filter({hasText:/^Local practice$/}).waitFor();
    assert.deepEqual(await accountOnly(),{manage:0,refresh:0,signOut:0},why);
    // The sign-out/sign-in action may still be finishing (busy) when the pill updates.
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/Connect Free2Z/.test(b.textContent)&&!b.disabled),undefined,{timeout:10_000}).catch(()=>{});
    assert.ok(await connect.isEnabled(),`${why}: Connect stays available`);
  };
  await disconnected('signed-out settings hide account-only actions');
  // Backing out of the Android Custom Tab (or cancelling iOS ASWebAuthenticationSession)
  // rejects authorize; tauri-plugin-f2z reports it as browser_error.
  const alertsBeforeCancel=await page.getByRole('alert').count();
  await page.evaluate(()=>{window.__ahaAI.failSignIn={code:'browser_error',retryable:false};});
  await connect.click();
  await page.getByText('Free2Z sign-in closed; you can connect any time.',{exact:true}).waitFor();
  assert.equal(await page.locator('.error-banner').count(),0,'cancelling sign-in shows no error banner');
  assert.equal(await page.getByRole('alert').count(),alertsBeforeCancel,'cancelling sign-in raises no alert');
  assert.ok(consoleWarnings.some(m=>/sign-in/.test(m)&&/browser_error/.test(m)),'a closed sign-in browser is still visible in the console (it may also be a launch failure)');
  await disconnected('a cancelled sign-in returns to the disconnected state');
  // An unrecognized native code is logged with its code and shown a kind, generic message.
  const warningsBeforeUnknown=consoleWarnings.length;
  await page.evaluate(()=>{window.__ahaAI.failSignIn={code:'brand_new_code',retryable:false};});
  await connect.click();
  await page.getByRole('alert').filter({hasText:'The Free2Z sign-in did not finish'}).waitFor();
  assert.ok(consoleWarnings.slice(warningsBeforeUnknown).some(m=>/sign-in/.test(m)&&/brand_new_code/.test(m)),'unknown sign-in code is logged visibly');
  assert.equal(await page.getByText('brand_new_code',{exact:false}).count(),0,'codes stay out of the UI');
  await disconnected('a failed sign-in stays disconnected');
  // Reconnecting suggests a modest 100 2Z monthly budget through the real SDK and guest API (optional; the user decides).
  await connect.click();
  await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  assert.equal(await page.locator('.error-banner').count(),0,'a successful sign-in clears the earlier message');
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.signIns),Array(3).fill({spendCap:'100',spendPeriod:'month'}),'every sign-in carries only the optional spend-cap suggestion, as decimal strings');
  // ---- "Try something harder" never discards a paid, unanswered AI activity (#877; TEST fixture specs) ----
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.enforced=true;window.__ahaAI.difficulties=[5,8,3];});
    const h=await ctx.newPage();
    const hErrors=[];h.on('pageerror',e=>hErrors.push(e.message));
    const hs=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
    const hAttempts=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat());
    const hStarts=()=>h.evaluate(()=>window.__ahaAI.starts.length);
    const harder=h.getByRole('button',{name:'Try something harder',exact:true});
    const shown=async()=>(await hs()).aiActivity?.activityId;
    const waitShown=async id=>{await h.waitForFunction(i=>Object.values(window.__ahaFixture.read().sessions)[0]?.data?.aiActivity?.activityId===i,id);};
    await h.goto('http://127.0.0.1:1436');
    const begin=h.getByRole('button',{name:'Let’s begin',exact:true});
    await begin.click();
    await h.locator('.focus-stage.is-spec .aha-activity').waitFor();
    const first=await shown();
    let st=await hs();
    assert.equal(st.aiActivity.spec.difficulty,5);
    assert.deepEqual(st.aiQueue.map(q=>q.spec.difficulty),[8,3]);
    const [hard,easy]=st.aiQueue.map(q=>q.activityId);
    assert.equal(await hStarts(),1);
    // A harder activity is queued: it is shown with no new paid call, and the skipped one waits at the front.
    await harder.click();
    await waitShown(hard);
    st=await hs();
    assert.deepEqual(st.aiQueue.map(q=>q.activityId),[first,easy],'the skipped paid activity is kept at the front of the queue');
    assert.equal(await hStarts(),1,'harder with a harder activity queued made no paid call');
    assert.equal((await hAttempts()).length,0,'skipping is not an attempt');
    // Nothing harder than 8 is queued: the current activity stays, nothing is lost, no extra paid call.
    await harder.click();
    await h.waitForTimeout(500);
    st=await hs();
    assert.equal(st.aiActivity.activityId,hard,'with nothing harder the current activity is not replaced');
    assert.deepEqual(st.aiQueue.map(q=>q.activityId),[first,easy],'and the queue is untouched');
    assert.equal(await hStarts(),1,'no paid call solely because of the button while content is queued');
    assert.equal((await hAttempts()).length,0);
    // Answer it; the next batch (requested by the normal prefetch when the queue runs low) carries the signal.
    const key=st.aiActivity.spec.response.answer;
    await h.locator('.aha-activity input[inputmode="decimal"]').fill(String(key));
    await h.getByRole('button',{name:'Check',exact:true}).click();
    await h.getByRole('button',{name:'Next',exact:true}).click();
    await waitShown(first);
    await h.waitForFunction(()=>window.__ahaAI.starts.length===2);
    const user=await h.evaluate(()=>window.__ahaAI.requests.at(-1).messages[1].content[0].text);
    assert.match(user,/"wantsHarder":true/,'the next batch request tells the model the learner wants harder');
    const attempts=await hAttempts();
    assert.deepEqual(attempts.map(a=>a.data.activityId),[hard],'only the answered activity has evidence');
    assert.equal((await hs()).aiActivity.spec.difficulty,5,'the skipped activity shows again with its original record');
    assert.deepEqual(hErrors,[]);
    await ctx.close();
  }
  // ---- Restart over an older build's state: a v2 journal, a saved AI activity and one queued (TEST fixture specs) ----
  // The 2026-10-05 S26 install replaced a #882-era build in place. Its restored queue must keep AI flowing: the low
  // queue is refilled at launch, an empty queue waits only briefly for the batch on its way, and every local task
  // served while signed in logs why.
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    const [f0,f1]=batchFixtures;
    const old='0ld0b11d-0000-4000-8000-000000000001',archived='0ld0b11d-0000-4000-8000-000000000002';
    const seeded={profiles:[{id:'explorer',name:'Explorer',grade:3,createdAt:'2026-10-05T13:00:00.000Z'}],
      sessions:{explorer:{id:'old-session',updatedAt:'2026-10-05T13:54:15.560Z',data:{activity:null,hintsUsed:0,completed:5,sessionId:'old-session',
        aiActivity:{activityId:`${old}:0`,operationId:old,spec:f0},aiQueue:[{activityId:`${old}:1`,operationId:old,spec:f1}]}}},
      activities:{},attempts:{},disputes:{},snapshots:{},
      journals:{'aha-billing-v1':{version:2,operations:[
        {id:archived,key:'k-archived',subject:'test-subject',generation:'1',createdAt:'2026-10-05T13:13:03.789Z',state:'finalized',callId:'c-archived',text:'',
          request:{model:'fixture-model',messages:[],maxOutputTokens:'2600'},charge:{state:'charged',charged2z:'2',receiptId:'r-archived'},
          context:{kind:'activities',profileId:'explorer',allowedSkillIds:[...f0.skillIds]},answerComplete:true,consumed:true},
        {id:old,key:'k-old',subject:'test-subject',generation:'1',createdAt:'2026-10-05T13:24:24.322Z',state:'finalized',callId:'c-old',
          text:JSON.stringify({rationale:'TEST fixture batch',activities:[f0,f1]}),
          request:{model:'fixture-model',messages:[{role:'system',content:[{type:'text',text:'TEST system'}]},{role:'user',content:[{type:'text',text:'TEST user'}]}],maxOutputTokens:'2600'},
          charge:{state:'charged',charged2z:'2',receiptId:'r-old'},
          context:{kind:'activities',profileId:'explorer',allowedSkillIds:[...new Set([...f0.skillIds,...f1.skillIds])]},answerComplete:true,consumed:true},
      ]}}};
    await ctx.addInitScript(db=>{
      if(!localStorage.getItem('aha-controller-test-fixture'))localStorage.setItem('aha-controller-test-fixture',JSON.stringify(db));
      Object.assign(window.__ahaAI,{enforced:true,structured:true,holdChat:true});
    },seeded);
    const o=await ctx.newPage();
    const oErrors=[];o.on('pageerror',e=>oErrors.push(e.message));
    const os=()=>o.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
    const oStarts=()=>o.evaluate(()=>window.__ahaAI.starts.length);
    const diag=()=>o.evaluate(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]'));
    const oNext=o.getByRole('button',{name:'Next',exact:true});
    const answerSpec=async()=>{
      const key=(await os()).aiActivity.spec.response.answer;
      await o.locator('.aha-activity input[inputmode="decimal"]').fill(String(key));
      await o.getByRole('button',{name:'Check',exact:true}).click();
      await oNext.waitFor();
    };
    await o.goto('http://127.0.0.1:1436');
    await o.getByRole('button',{name:'Continue',exact:true}).click();
    await o.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal((await os()).aiActivity.activityId,`${old}:0`,'the older build’s AI activity is resumed');
    // One activity queued is already low: the batch starts at launch, not on the tap that empties the queue.
    await o.waitForFunction(()=>window.__ahaAI.starts.length===1,undefined,{timeout:5000});
    assert.ok((await diag()).some(e=>e.source==='ai-queue'&&/restored 1 queued AI activities and the one on screen/.test(e.message)),'the restored queue is logged');
    await answerSpec();
    await oNext.click();
    await o.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0].data.aiActivity?.activityId===id,`${old}:1`);
    await answerSpec();
    // The queue is empty and the batch is still on its way (held): one local task after a short wait, never a hang.
    const tapped=Date.now();
    await oNext.click();
    await o.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity?.source==='local',undefined,{timeout:BATCH_WAIT_TEST_MS});
    const waited=Date.now()-tapped;
    assert.ok(waited>=5000,`it waited briefly for the batch first (${waited} ms)`);
    assert.ok((await diag()).some(e=>e.source==='ai-skip'&&/still on its way/.test(e.message)),'the local task is logged with its reason');
    assert.equal(await oStarts(),1,'no second paid call while one is on its way');
    // The batch lands while the learner works locally; the next task is AI again with no new call.
    await o.evaluate(()=>window.__ahaAI.releaseChat());
    await o.waitForFunction(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue?.length??0)===3);
    const local=(await os()).activity;
    await o.getByLabel('Your answer',{exact:true}).fill(String(expectedAnswer(local.task)));
    await o.getByRole('button',{name:'Check',exact:true}).click();
    await oNext.click();
    await o.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.notEqual((await os()).aiActivity.operationId,old,'AI resumes from the batch that landed');
    assert.equal(await oStarts(),1);
    const j=await o.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1']);
    assert.equal(j.version,3,'the v2 journal is stored as v3 on its first write');
    assert.deepEqual(j.operations.slice(0,2).map(op=>op.id),[archived,old],'the older build’s settled operations are kept');
    assert.ok((await diag()).filter(e=>e.level==='error').length===0,'no errors');
    assert.deepEqual(oErrors,[]);
    await ctx.close();
  }
  // ---- Stop during the provider's estimate for a batch the learner's own tap started: no paid call, ever ----
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{Object.assign(window.__ahaAI,{enforced:true,holdEstimate:true});});
    const q=await ctx.newPage();
    const qErrors=[];q.on('pageerror',e=>qErrors.push(e.message));
    await q.goto('http://127.0.0.1:1436');
    await q.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await q.waitForFunction(()=>typeof window.__ahaAI.releaseEstimate==='function');
    assert.equal(await q.evaluate(()=>window.__ahaAI.grants)>0,true,'the grant was verified; the provider is inside its estimate');
    await q.getByRole('button',{name:'Stop AI request',exact:true}).click();
    await q.getByRole('alert').filter({hasText:'Stopped before starting'}).waitFor();
    await q.evaluate(()=>window.__ahaAI.releaseEstimate());
    await q.waitForFunction(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]').some(e=>e.source==='ai-skip'&&/stopped by the learner/.test(e.message)));
    assert.equal(await q.evaluate(()=>window.__ahaAI.starts.length),0,'Stop inside the estimate never starts the paid call');
    const qDiag=await q.evaluate(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]'));
    assert.ok(!qDiag.some(e=>e.source==='ai-fallback'),'a Stop is not recorded as an AI failure');
    assert.deepEqual(qErrors,[]);
    await ctx.close();
  }
  // ---- Production spending policy, budget optional (#879; TEST-ONLY fake SDK, no live service) ----
  const scenario=async knobs=>{
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(k=>{Object.assign(window.__ahaAI,k);},knobs);
    const p=await ctx.newPage();const pageErrors=[],logged=[],warned=[];
    p.on('pageerror',e=>pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')logged.push(m.text());if(m.type()==='warning')warned.push(m.text());});
    await p.goto('http://127.0.0.1:1436');
    await p.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await p.getByRole('button',{name:'Check',exact:true}).waitFor();
    const openSettings=async()=>{await p.locator('.status-dot').click();await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('heading',{name:'Settings',exact:true}).waitFor();};
    const figure=async label=>(await p.locator('.balance-row > div').filter({has:p.getByText(label,{exact:true})}).locator('dd').textContent());
    return {ctx,p,pageErrors,logged,warned,openSettings,figure,starts:()=>p.evaluate(()=>window.__ahaAI.starts.length),
      source:()=>p.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity?.source)};
  };
  {
    // No app budget: paid AI runs on balance and estimate alone.
    const s=await scenario({enforced:true,spendCap:null,capPeriod:'month',capRemaining:null});
    await s.p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await s.starts(),1,'no app budget: one paid batch call');
    await s.openSettings();
    assert.equal(await s.figure('App budget'),'No app budget');
    assert.equal(await s.p.getByText('Budget left',{exact:true}).count(),0,'no remainder row without a budget');
    assert.equal(await s.figure('Each batch of activities'),'About 1 2Z','cost per batch from the settled charge');
    assert.equal(await s.figure('Available balance'),'100 2Z');
    await s.p.getByRole('button',{name:'Manage allowance or balance',exact:false}).waitFor();
    assert.equal(await s.p.getByRole('button',{name:'Add 2Z',exact:false}).count(),0,'no in-app purchase');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // A monthly app budget the user chose in Free2Z: shown read-only with what is left.
    const s=await scenario({enforced:true,spendCap:'250',capPeriod:'month',capRemaining:'97500'});
    await s.p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await s.starts(),1,'a per-period budget of any size admits paid AI');
    await s.openSettings();
    assert.equal(await s.figure('App budget'),'250 2Z per month');
    assert.equal(await s.figure('Budget left'),'97.5 2Z');
    // Free2Z stops enforcing this grant: the budget figures are no longer shown as if they applied.
    await s.p.evaluate(()=>{window.__ahaAI.enforced=false;window.__ahaAI.reason='ledger_cap_pending';});
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.getByText('Free2Z is still setting up spending for this app.',{exact:false}).first().waitFor();
    assert.equal(await s.p.getByText('App budget',{exact:true}).count(),0,'no stale budget once not enforced');
    assert.equal(await s.p.getByRole('alert').count(),0,'Refresh in the not-ready state is calm');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // platform_disabled with no budget: never a paid call; calm local practice.
    const s=await scenario({enforced:false,reason:'platform_disabled',spendCap:null,capRemaining:null});
    assert.equal(await s.starts(),0,'platform_disabled: no paid call');
    assert.equal(await s.source(),'local','platform_disabled: local fallback');
    assert.equal(await s.p.getByRole('alert').count(),0,'platform_disabled: no alert');
    await s.openSettings();
    await s.p.getByText('isn’t switched on for apps yet',{exact:false}).first().waitFor();
    assert.equal(await s.p.getByText('App budget',{exact:true}).count(),0,'no budget figure until Free2Z enforces the grant');
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.getByText('isn’t switched on for apps yet',{exact:false}).first().waitFor();
    assert.equal(await s.p.getByRole('alert').count(),0,'Refresh connection while platform_disabled: no alert');
    await s.p.getByRole('button',{name:'Close settings',exact:true}).click();
    // A curiosity question gets the built-in local answer, not an alert, and no paid call.
    await s.p.getByRole('button',{name:'Ask a question',exact:true}).click();
    await s.p.getByRole('button',{name:'Where would I use this in real life? ↗',exact:true}).click();
    await s.p.getByText('Live tutoring isn’t available yet.',{exact:false}).waitFor();
    assert.equal(await s.p.getByRole('alert').count(),0,'curiosity while platform_disabled: no alert');
    assert.equal(await s.starts(),0,'curiosity while platform_disabled: no paid call');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // Insufficient balance: the estimate's hold (1 2Z) exceeds 0.5 2Z available. Calm message, local practice.
    const s=await scenario({enforced:true,available:'500'});
    assert.equal(await s.starts(),0,'an estimate above the balance is never sent');
    assert.equal(await s.source(),'local','insufficient balance: local fallback');
    assert.equal(await s.p.getByRole('alert').count(),0,'insufficient balance: no alert');
    assert.ok(s.logged.some(m=>/AI unavailable/.test(m)&&/insufficient_balance/.test(m)),'logged visibly');
    await s.openSettings();
    await s.p.getByText('Your Free2Z balance is too low for the next AI activities.',{exact:false}).first().waitFor();
    await s.p.getByText('Local practice continues in this account',{exact:false}).first().waitFor();
    assert.equal(await s.figure('Available balance'),'0.5 2Z');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // Strict refusal at send (the balance fell after the estimate): zero charge, calm status, local practice, nothing pending.
    const s=await scenario({enforced:true,strictRefusal:'insufficient_balance'});
    await s.p.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await s.starts(),1,'the strict request reached the gateway once and was refused');
    assert.equal(await s.source(),'local','strict refusal: local fallback');
    assert.equal(await s.p.getByRole('alert').count(),0,'strict refusal: no alert');
    assert.ok(s.logged.some(m=>/AI unavailable/.test(m)&&/insufficient_balance/.test(m)),'logged visibly');
    await s.openSettings();
    await s.p.getByText('Your Free2Z balance is too low for the next AI activities.',{exact:false}).first().waitFor();
    await s.p.getByText('Local practice continues in this account',{exact:false}).first().waitFor();
    assert.equal(await s.p.getByRole('button',{name:'Recover original request',exact:true}).count(),0,'a refusal leaves no unsettled receipt to recover');
    const journal=await s.p.evaluate(()=>Object.values(window.__ahaFixture.read().journals??{}).flatMap(j=>j.operations??[]));
    assert.ok(journal.length>=1&&journal.every(o=>o.state==='finalized'&&o.charge?.state==='released'&&o.charge.charged2z==='0'),'journal settles the refused operation as released/0');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  // ---- Structured output (#884; TEST-ONLY fake SDK, no live service) ----
  const journalOps=s=>s.p.evaluate(()=>Object.values(window.__ahaFixture.read().journals??{}).flatMap(j=>j.operations??[]));
  {
    // The model advertises structured_output: the batch carries response_format and the grammar-free prompt.
    const s=await scenario({enforced:true,structured:true});
    await s.p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await s.starts(),1,'structured: one paid batch call');
    const request=await s.p.evaluate(()=>window.__ahaAI.requests.at(-1));
    assert.equal(request.response_format.type,'json_schema');
    assert.equal(request.response_format.json_schema.name,'aha_activity_batch');
    assert.equal(request.response_format.json_schema.strict,true);
    assert.equal(request.response_format.json_schema.schema.additionalProperties,false,'the strict schema reaches the plugin');
    assert.equal(request.max_output_tokens_strict,true,'strict output stays on with structured output');
    const system=request.messages[0].content[0].text;
    assert.ok(system.includes('activity author')&&system.includes('Every key is required'),'grammar-free structured prompt');
    assert.ok(!system.includes('Response (graded on-device'),'the inline grammar is dropped');
    const [op]=await journalOps(s);
    assert.deepEqual(op.request.responseFormat,request.response_format,'the exact format is journaled for same-key recovery');
    assert.equal(await s.p.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].version),3);
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // The gateway refuses the format at send (bare 400 invalid_request, as the native transport delivers it):
    // zero-charge release, then the prompt-only request under a new key. No alert; a warning is logged.
    const s=await scenario({enforced:true,structured:true,formatRefusal:'chat'});
    await s.p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await s.starts(),2,'the refused structured send, then the prompt-only send');
    const [first,second]=await s.p.evaluate(()=>window.__ahaAI.requests);
    assert.ok(first.response_format&&!('response_format' in second),'fallback drops response_format');
    assert.ok(second.messages[0].content[0].text.includes('Response (graded on-device'),'fallback restores the inline grammar');
    const keys=await s.p.evaluate(()=>window.__ahaAI.starts.map(o=>o.idempotencyKey));
    assert.notEqual(keys[0],keys[1],'a new idempotency key for the fallback');
    const [refused,sent]=await journalOps(s);
    assert.equal(refused.state,'finalized');assert.deepEqual(refused.charge,{state:'released',charged2z:'0'});
    assert.ok(!('responseFormat' in sent.request));
    assert.equal(await s.p.getByRole('alert').count(),0,'format fallback: no alert');
    assert.ok(s.warned.some(m=>/response_format/.test(m)),'the fallback is logged visibly');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // Refused at the estimate (free): nothing journaled for it; the prompt-only request is the only send.
    const s=await scenario({enforced:true,structured:true,formatRefusal:'estimate'});
    await s.p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await s.starts(),1);
    assert.ok(!('response_format' in await s.p.evaluate(()=>window.__ahaAI.requests[0])));
    assert.equal((await journalOps(s)).length,1);
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log('AI controller fixture passed: signed-in local-practice fallback with backoff, enforced grant, native SDK stream, Stop during preparation, Retry-After, AI activity batches (TEST fixture specs) rendered, answered correct/incorrect and recorded as ai-spec evidence, background prefetch, malformed-batch salvage, force-reload mid-queue without a new paid call, empty-queue local fallback, original-key batch and post-fallback curiosity recovery, crash-safe completed-batch delivery, quiet sign-in cancel with Connect-only disconnected settings, logged unknown sign-in codes, the optional 100 2Z/month sign-in suggestion, budget-optional admission (no budget, a monthly budget shown read-only with its remainder, platform_disabled and insufficient balance both falling back calmly to local practice), Try something harder keeping a paid AI activity (queued harder one shown without a new call, otherwise the current one stays and the next batch carries wantsHarder), structured output (response_format with the grammar-free prompt when the model advertises it, prompt-only otherwise, zero-charge fallback after a refusal at the estimate or the send), and a restart over an older build’s state (v2 journal, restored queue refilled at launch, a bounded wait then one logged local task while a batch is on its way, AI resuming when it lands), and Stop inside the estimate of a tap-started batch never paying. No live service or charge.');
} finally {
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
