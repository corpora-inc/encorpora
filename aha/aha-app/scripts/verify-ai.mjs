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
// Overridable so parallel worktrees can run the suite at the same time.
/** Next, or Keep going in the same slot when the answer completes a lap of ten. */
const NEXT=/^(Next|Keep going)$/;
// The TEST gateway's call id: a UUID, as Free2Z's are (the SDK refuses to report anything else).
const FIXTURE_CALL='0f1e2d3c-4b5a-4968-8776-655443322110';
const port=Number(process.env.AHA_AI_PORT||1436),base=`http://127.0.0.1:${port}`;
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(specs){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  // The second TEST account (a "Use a different account" scenario) has its own partition, as native storage keys every
  // record by account; local-device and test-subject share the original one, as earlier scenarios expect.
  const keyFor=account=>account==='second-subject'?`${key}:${account}`:key;
  const read=(account)=>JSON.parse(localStorage.getItem(keyFor(account))||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  const streams=new Map();
  const FIXTURE_CALL='0f1e2d3c-4b5a-4968-8776-655443322110';
  // TEST-ONLY grant/estimate knobs. Default: Free2Z's pre-activation state (enforced:false, platform_disabled)
  // with a 100 2Z total app budget once enforced; scenarios switch to no budget or a low balance.
  window.__ahaAI={signedIn:true,enforced:false,reason:'platform_disabled',spendCap:'100',capPeriod:'total',capRemaining:'99000',available:'100000',hold:'1',starts:[],requests:[],batches:0,delayModels:false,releaseModels:null,blockEstimate:false,grants:0,activityAccounts:[],malformedNext:false};
  const ai=window.__ahaAI;
  // TEST-ONLY: knobs a scenario wants in force at the next launch (a reload re-runs this script).
  Object.assign(ai,JSON.parse(localStorage.getItem('aha-test-ai-launch')||'{}'));
  // TEST-ONLY gateway ledger, kept across reloads: every Idempotency-Key whose call was opened, with its one charge.
  // The same key again replays that call's settled receipt and charges nothing (the Free2Z contract).
  const gatewayKey='aha-test-gateway';
  const gateway=()=>JSON.parse(localStorage.getItem(gatewayKey)||'{}');
  /** TEST "model": answers the batch prompt with fixture specs whose skills are in the standards window it was shown. */
  const batchText=user=>{
    const allowed=new Set(user.split('\nSTANDARDS\n')[1].split('\nWrite ')[0].split('\n').map(line=>line.split(' ')[0]));
    const usable=specs.filter(f=>f.skillIds.every(id=>allowed.has(id)));
    const pool=usable.length>=3?usable:specs;
    // The content serial survives reloads (ai.batches restarts at 0 on each launch).
    const batch=Number(localStorage.getItem('aha-test-batch-serial')||0);
    localStorage.setItem('aha-test-batch-serial',String(batch+1));
    const start=(ai.batches++*3)%pool.length;
    // TEST-ONLY: a real model writes new content each batch; the app drops exact repeats of anything shown this session.
    let chosen=[0,1,2].map(i=>pool[(start+i)%pool.length]).map(c=>batch?{...c,explanation:`${c.explanation} (set ${batch})`}:c);
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
  // TEST-ONLY catalogue. `structured` advertises capabilities.structured_output (zuu 42acc57f); default: an entry without it.
  // `catalog` replaces it with a scenario's own fake models (ids, prices and capabilities are fixtures, not Free2Z's).
  const catalogModels=()=>ai.catalog??[{id:'fixture-model',max_output_tokens:'4096',...(ai.structured?{context_window:'128000',capabilities:{vision:false,tools:false,reasoning:false,structured_output:true}}:{})}];
  const advertises=model=>catalogModels().some(m=>m.id===model&&m.capabilities?.structured_output===true);
  // TEST-ONLY accounts: `subject` (default test-subject) and its Free2Z `username` (with the profile scope). A sign-in with
  // prompt=login ("Use a different account") lands on `nextAccount` when a scenario sets one.
  const subjectNow=()=>ai.subject??'test-subject';
  const session=()=>({signedIn:ai.signedIn,subject:ai.signedIn?subjectNow():null,grantedScopes:['openid',...(ai.username?['profile']:[]),'ai:invoke','balance:read'],persistence:'persistent',generation:String(ai.generation??1),...(ai.signedIn&&ai.username?{preferredUsername:ai.username}:{})});
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:true,clientId:'test-client',paidTestingReady:false,externalCheckoutEnabled:false,reason:'Explicit TEST SDK fixture'};
    if(command==='plugin:f2z|sign_in'){(ai.signIns??=[]).push(args.options);if(ai.failSignIn){const e=ai.failSignIn;ai.failSignIn=null;throw e;}
      if(args.options.prompt==='login'&&ai.nextAccount){Object.assign(ai,ai.nextAccount);ai.nextAccount=null;ai.generation=(ai.generation??1)+1;}
      ai.signedIn=true;return session();}
    if(command==='plugin:f2z|session')return session();
    if(command==='plugin:f2z|sign_out'){if(ai.failSignOut)throw {code:'storage_error'};ai.signedIn=false;return {revoked:true,generation:'2'};}
    if(command==='plugin:f2z|balance')return {available_milli_2z:ai.available,held_milli_2z:'0',balance_milli_2z:ai.available,debt_milli_2z:'0',as_of:new Date().toISOString()};
    if(command==='plugin:f2z|grant'){ai.grants++;return {sub:subjectNow(),client_id:'test-client',account_epoch:'0',grant_generation:'1',scopes:['ai:invoke'],spend_cap_2z:ai.spendCap,cap_period:ai.capPeriod,enforced:ai.enforced,enforcement_reason:ai.enforced?'ok':ai.reason,as_of:new Date().toISOString()};}
    if(command==='plugin:f2z|models'){
      if(ai.delayModels)await new Promise(resolve=>{ai.releaseModels=resolve;});
      if(ai.models502)throw {code:'unavailable'};
      return {catalog_version:'1',models:catalogModels()};
    }
    // Gateway image 70b74edd9 (da1862531): every paid request must carry strict output (never truncated-but-charged).
    if((command==='plugin:f2z|estimate'||command==='plugin:f2z|start_chat')&&args.request.max_output_tokens_strict!==true)throw new Error('TEST gateway: max_output_tokens_strict:true is required on every paid request');
    // A model that does not advertise structured output must never receive response_format.
    if((command==='plugin:f2z|estimate'||command==='plugin:f2z|start_chat')&&args.request.response_format!==undefined&&!advertises(args.request.model))throw new Error('TEST gateway: response_format sent to a model without capabilities.structured_output');
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
      // TEST-ONLY `holdAfter: n`: every batch after the first n stays on its way until releaseHeld() (#929: the bank refills
      // at <= 8 banked, so a scenario that inspects a 3-activity queue holds the background refill in flight).
      if(typeof ai.holdAfter==='number'&&ai.starts.length>ai.holdAfter)(ai.held??=new Set()).add(args.operation.operationId);
      if(args.request.response_format&&ai.formatRefusal==='chat')throw {code:'invalid_request',status:400};
      // Shaped as tauri-plugin-f2z d4d58ea3 delivers it: 402 balance / 403 budget, with `refusalDetails` as documented details (decimal strings).
      if(ai.strictRefusal){const reason=ai.strictRefusal;ai.strictRefusal=null;ai.refused=(ai.refused??0)+1;throw {code:reason,status:reason==='cap_exceeded'?403:402,retryable:false,...(ai.refusalDetails?{details:ai.refusalDetails}:{})};}
      if(ai.failOpening){ai.failOpening=false;throw {code:'unavailable',retryAfterSeconds:'5'};}
      const key=args.operation.idempotencyKey,ledger=gateway();
      if(ledger[key]){
        // TEST-ONLY `failRecovery`: the gateway is unreachable for a same-key resend.
        if(ai.failRecovery)throw {code:'unavailable'};
        ai.replays=(ai.replays??0)+1;
        return {operationId:args.operation.operationId,callId:ledger[key].callId,replay:{call_id:ledger[key].callId,status:'settled',charged_2z:'1',receipt_id:'fixture-receipt'}};
      }
      ledger[key]={callId:FIXTURE_CALL,charged2z:'1'};localStorage.setItem(gatewayKey,JSON.stringify(ledger));
      const user=args.request.messages[1].content[0].text;
      const text=user.startsWith('LEARNER ')?batchText(user):'You can use this idea to share ingredients fairly.';
      // TEST-ONLY: `outOfRoomModel` makes that model's batches end at their budget after hidden reasoning (finish_reason length).
      const outOfRoom=ai.outOfRoomModel===args.request.model;
      streams.set(args.operation.operationId,[
        {type:'meta',call_id:FIXTURE_CALL,model:'fixture-model',hold_2z:'1'},
        {type:'delta',text},
        ...(outOfRoom?[{type:'usage',source:'provider',usage:{input_tokens:'500',cached_input_tokens:'0',cache_write_tokens:'0',output_tokens:args.request.max_output_tokens,reasoning_tokens:'11000',images:'0',tool_calls:'0'}}]:[]),
        {type:'done',finish_reason:outOfRoom?'length':'stop',settlement:'settled',charged_2z:'1',receipt_id:'fixture-receipt'},
      ]);
      return {operationId:args.operation.operationId,callId:FIXTURE_CALL};
    }
    // TEST-ONLY: `holdChat` keeps the next batch on its way until the scenario calls releaseChat().
    if(command==='plugin:f2z|next_chat'&&ai.holdChat){ai.holdChat=false;await new Promise(resolve=>{ai.releaseChat=resolve;});}
    if(command==='plugin:f2z|next_chat'&&ai.held?.has(args.operationId)){await (ai.heldGate??=new Promise(resolve=>{ai.releaseHeld=()=>{ai.held=new Set();ai.heldGate=undefined;ai.holdAfter=undefined;resolve();};}));}
    if(command==='plugin:f2z|next_chat')return streams.get(args.operationId)?.shift()??null;
    if(command==='plugin:f2z|cancel_chat')return;
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
    // tauri-plugin-f2z sdk-v0.3.0: the plugin builds each page's URL natively; the webview sends no arguments at all.
    if(command==='plugin:f2z|open_manage_account'||command==='plugin:f2z|open_delete_account'){
      if(args&&Object.keys(args).length)throw new Error(`TEST plugin: ${command} takes no arguments, got ${JSON.stringify(args)}`);
      ai.accountOpened=(ai.accountOpened??0)+1;(ai.accountPages??=[]).push(command.endsWith('manage_account')?'manage':'delete');return null;}
    // tauri-plugin-f2z sdk-v0.3.0 report_call. `reportFail`: a list of native errors for the next sends (a 429, a 404, ...).
    if(command==='plugin:f2z|report_call'){
      if('detail' in args)throw new Error('TEST plugin: AHA must never send a report detail');
      (ai.reportCalls??=[]).push({...args,subject:subjectNow()});
      const fail=ai.reportFail?.shift();if(fail)throw fail;
      return {report_id:`report-${ai.reportCalls.length}`,call_id:args.callId,reason:args.reason,created_at:new Date().toISOString().replace(/\.\d+Z$/,'Z')};
    }
    if(command==='pin_page_scroll')return null;
    if(command!=='local_repository')throw new Error(`Unexpected test IPC: ${command}`);
    const r=args.request;if(!['local-device','test-subject','second-subject'].includes(r.accountId))throw new Error('Unexpected test account');
    const db=read(r.accountId),id=r.profileId;let result;
    switch(r.operation){
      // TEST-ONLY: this "device" already allowed AI lessons (aiConsent.ts) unless a scenario sets noConsent or signs out.
      case 'getJournal':return db.journals&&r.key in db.journals?db.journals[r.key]
        :r.key==='aha-ai-consent'&&!ai.noConsent&&!localStorage.getItem('aha-test-consent-withdrawn')?{version:1,grantedAt:'2026-01-01T00:00:00.000Z'}:null;
      case 'deleteJournal':if(db.journals)delete db.journals[r.key];if(r.key==='aha-ai-consent')localStorage.setItem('aha-test-consent-withdrawn','1');break;
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
    localStorage.setItem(keyFor(r.accountId),JSON.stringify(db));return result;
  }};
}
try {
  let ready=false;
  for(let i=0;i<100;i++){
    if(vite.exitCode!==null)throw new Error(`Vite exited: ${output}`);
    try{if(stripVTControlCharacters(output).includes(base)&&(await fetch(base)).ok){ready=true;break;}}catch{}
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
  const nextButton=page.getByRole('button',{name:NEXT});
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
  await page.goto(base);
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
  assert.equal(batchRequest.max_output_tokens,'2820','an empty bank asks for a small first batch: 6 × 420 + 300 strict output tokens (#929)');
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
  assert.equal(unacked.request.maxOutputTokens,'2820');
  assert.equal((await journal()).version,4,'usage journal v4');
  assert.ok(!('response_format' in batchRequest)&&!('responseFormat' in unacked.request),'a model without the capability gets the prompt-only request');
  // Assistance on an AI activity is recorded before the answer and survives a force-reload.
  await page.getByRole('button',{name:'Hint',exact:true}).click();
  await page.locator('.help-panel').waitFor();
  await page.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.hintsUsed===1);
  // Help taps are idempotent (an S26 item once recorded hintsUsed=21): reopening help already shown
  // never counts again.
  for(let i=0;i<4;i++){await page.getByRole('button',{name:'Hint',exact:true}).click();await page.waitForTimeout(80);}
  await page.waitForTimeout(200);
  assert.equal((await session()).hintsUsed,1,'reopening a hint already shown never counts again');
  if(!(await page.locator('.help-panel').count())){await page.getByRole('button',{name:'Hint',exact:true}).click();await page.locator('.help-panel').waitFor();}
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
  const malformedOp=await page.evaluate(()=>window.__ahaAI.starts[0].operationId);
  await page.waitForFunction(op=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).some(q=>q.operationId===op),malformedOp);
  await page.getByRole('button',{name:'Check',exact:true}).waitFor({timeout:5000});
  const prefetched=(await session()).aiQueue.filter(q=>q.operationId===malformedOp);
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
  // The missed activity waits in the bank too, for spaced retrieval (#929): three queued plus its remix.
  assert.ok((await session()).aiQueue.some(q=>q.activityId===`${wrong.activityId}:r1`),'the miss comes back later, unchanged');
  const served=[];
  // The bank refills at <= 8 banked, so a background batch may already have landed: drain whatever is banked.
  for(let i=0;i<16&&((await session()).aiQueue??[]).length;i++){
    await nextButton.click();
    await page.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.ok((await session()).aiActivity,'queued AI activity served without a new paid call');
    served.push((await session()).aiActivity);
    await answerCurrent(true);
  }
  assert.ok(served.some(a=>a.activityId===`${wrong.activityId}:r1`&&a.spec.id===wrong.spec.content.id&&JSON.stringify(a.spec.prompt)===JSON.stringify(wrong.spec.content.prompt)),'the remix is the same activity, free');
  assert.equal((await session()).aiQueue,undefined,'queue drained');
  await nextButton.click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal((await session()).activity.source,'local','AI failure with an empty queue falls back to local practice');
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),startsBeforeDrain,'the failed prefetch never reached a paid call');
  await localBanner.waitFor();
  assert.ok(consoleErrors.some(m=>/AI unavailable for prefetch/.test(m)),'the failed prefetch is logged visibly');
  assert.equal((await page.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat())).filter(a=>a.data.source==='ai-spec').length,2+served.length,'every answered AI activity is recorded evidence');
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
  // Refresh connection runs the same-key receipt recovery itself (founder S26: it used to report "AI ready" while the
  // receipt still blocked every batch). The recovered batch's queue save fails once (disk full): the completed batch
  // must stay durable in the journal and reach the learner after a restart without a new call.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  const after=await page.evaluate(()=>window.__ahaAI.starts);
  assert.equal(after.length,starts.length+1,'Refresh connection resent the interrupted batch once');
  assert.deepEqual(after.at(-1),starts.at(-1),'recovery keeps both original request identifiers');
  assert.equal(await page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.filter(o=>o.state!=='finalized').length),0,'Refresh connection settled the receipt');
  assert.equal(await page.getByRole('button',{name:'Recover original request',exact:true}).count(),0,'nothing left to recover by hand');
  assert.equal(await page.getByRole('alert').count(),0,'the failed queue save during background delivery is not an alert');
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
  await page.getByRole('button',{name:'Where would I use this?',exact:true}).click();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  await page.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.curiosity?.answer);
  {
    // Structured in: the paid request carries the activity and a preset id, never a typed question.
    const sent=await page.evaluate(()=>window.__ahaAI.requests.at(-1).messages[1].content[0].text);
    const body=JSON.parse(sent);
    assert.equal(body.ask,'real-life');
    assert.deepEqual(Object.keys(body).sort(),['activity','ask'],'only the activity on screen and the preset id');
    assert.equal((await session()).curiosity.question,'real-life','the saved question is the preset id');
    assert.ok(await page.getByText('Where would I use this?',{exact:true}).count(),'shown as its label');
  }
  await page.reload();await resume();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'paid curiosity restores without a new call');
  await page.getByRole('button',{name:'Back to the problem',exact:true}).click();
  // An interrupted curiosity request stays recoverable after local practice moves the learner on.
  await page.evaluate(()=>{window.__ahaAI.enforced=true;window.__ahaAI.failOpening=true;});
  const curiosityStarts=await page.evaluate(()=>window.__ahaAI.starts.length);
  await page.getByRole('button',{name:'Ask a question',exact:true}).click();
  await page.getByRole('button',{name:'Where would I use this?',exact:true}).click();
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
  // Restart mid-batch (founder S26: a batch was in flight at 14:33:55, the app was reinstalled at 14:34:16, and AI stayed
  // blocked by settlement_pending until a manual tap). Receipt recovery is automatic: launch, background retry, resume.
  const unsettled=()=>page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.filter(o=>o.state!=='finalized').length);
  const recoveryLog=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]').filter(e=>e.source==='ai-recovery').map(e=>e.message));
  /** Answers until a batch is journaled and opened at the TEST gateway, its stream held: the batch "in flight". */
  const batchInFlight=async()=>{
    await page.evaluate(()=>{window.__ahaAI.holdChat=true;});
    const from=await page.evaluate(()=>window.__ahaAI.starts.length);
    for(let i=0;i<12&&await page.evaluate(n=>window.__ahaAI.starts.length===n,from);i++){await answerCurrent();await nextButton.click();await page.getByRole('button',{name:'Check',exact:true}).waitFor();}
    await page.waitForFunction(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.some(o=>o.state==='streaming'));
    return page.evaluate(()=>window.__ahaAI.starts.at(-1));
  };
  const inFlight=await batchInFlight();
  // Relaunch while Free2Z cannot take the same-key resend.
  await page.evaluate(()=>localStorage.setItem('aha-test-ai-launch',JSON.stringify({enforced:true,failRecovery:true})));
  await page.reload();
  await page.waitForFunction(()=>window.__ahaAI.starts.length>=1);
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.starts[0]),inFlight,'launch recovery resends the original operation and Idempotency-Key');
  await resume();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  await settings();
  // Never "AI ready" while an unsettled receipt blocks paid calls: a calm settling state, no alert.
  await page.getByText('Finishing an earlier AI request…',{exact:true}).waitFor();
  assert.equal(await page.getByText('AI ready',{exact:true}).count(),0,'not AI ready while a receipt is unsettled');
  assert.equal(await page.getByRole('alert').count(),0,'automatic recovery is not an alert');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await answerCurrent();await nextButton.click();await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.ok((await page.evaluate(()=>window.__ahaAI.starts)).every(x=>x.operationId===inFlight.operationId&&x.idempotencyKey===inFlight.idempotencyKey),
    'no new paid call while the receipt is unsettled; recovery only ever resends the original key');
  assert.ok(await unsettled()>0,'the block stays while recovery fails');
  {const s=await session();assert.ok(s.activity?.source==='local'||s.aiActivity,'an unsettled receipt does not block practice (local, or an already-paid queued activity)');}
  // Free2Z is reachable again: the background retry settles it with no tap on Refresh, Check or Recover.
  await page.evaluate(()=>{window.__ahaAI.failRecovery=false;localStorage.removeItem('aha-test-ai-launch');});
  await page.waitForFunction(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.every(o=>o.state==='finalized'),null,{timeout:45_000});
  const settledOp=await page.evaluate(id=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.id===id),inFlight.operationId);
  assert.equal(settledOp.charge.charged2z,'1','settled from the replayed receipt');
  assert.equal(await page.evaluate(()=>window.__ahaAI.replays),1,'the gateway replayed the receipt once');
  // The TEST gateway charges a key once and replays it after that. Every resend of the interrupted operation carried
  // its original key, and the journal records exactly one charge for it: no duplicate charge.
  const resends=await page.evaluate(id=>window.__ahaAI.starts.filter(x=>x.operationId===id),inFlight.operationId);
  assert.ok(resends.length>=2&&resends.every(x=>x.idempotencyKey===inFlight.idempotencyKey),'every resend of the interrupted batch used its original key');
  assert.equal(await page.evaluate(id=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.filter(o=>o.id===id&&o.charge?.state==='charged').length,inFlight.operationId),1,'one recorded charge for the interrupted batch');
  // AI resumes: the next batch (a fresh key, only after settlement) is requested and served with no manual step.
  for(let i=0;i<8&&!(await page.evaluate(k=>window.__ahaAI.starts.some(x=>x.idempotencyKey!==k),inFlight.idempotencyKey));i++){await answerCurrent();await nextButton.click();await page.getByRole('button',{name:'Check',exact:true}).waitFor();}
  assert.ok(await page.evaluate(k=>window.__ahaAI.starts.some(x=>x.idempotencyKey!==k),inFlight.idempotencyKey),'AI resumes after recovery without a manual tap');
  await settings();
  await page.getByText('AI ready',{exact:true}).waitFor();
  assert.equal(await page.getByText('Finishing an earlier AI request…',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Recover original request',exact:true}).count(),0,'nothing to recover by hand');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  const recoveryEvents=await recoveryLog();
  assert.ok(recoveryEvents.some(m=>/^launch: .*still unsettled/.test(m)),'the failed launch attempt is logged (ai-recovery)');
  assert.ok(recoveryEvents.some(m=>/^retry: every earlier AI request is settled/.test(m)),'the background retry that settled it is logged (ai-recovery)');
  // Resume: a batch in flight, relaunched while Free2Z is not ready (no launch recovery possible); returning to the
  // foreground once it is ready settles it with the original key.
  const inFlightAgain=await batchInFlight();
  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
  await page.waitForFunction(()=>window.__ahaAI.grants>=1);
  assert.ok(await unsettled()>0,'still unsettled after a launch that could not recover');
  await page.evaluate(()=>{window.__ahaAI.enforced=true;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.every(o=>o.state==='finalized'),null,{timeout:20_000});
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.starts[0]),inFlightAgain,'resume recovery resends the original operation and key');
  assert.ok((await recoveryLog()).some(m=>/^resume: every earlier AI request is settled/.test(m)),'resume recovery is logged');
  await resume();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
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
    manage:await page.getByRole('button',{name:'Manage Free2Z account',exact:false}).count(),
    deleteAccount:await page.getByRole('button',{name:'Delete Free2Z account',exact:false}).count(),
    refresh:await page.getByRole('button',{name:'Refresh connection',exact:true}).count(),
    signOut:await page.getByRole('button',{name:'Sign out',exact:true}).count(),
  });
  const disconnected=async why=>{
    await page.locator('.connection-pill').filter({hasText:/^Local practice$/}).waitFor();
    assert.deepEqual(await accountOnly(),{manage:0,deleteAccount:0,refresh:0,signOut:0},why);
    // The sign-out/sign-in action may still be finishing (busy) when the pill updates.
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/Connect Free2Z/.test(b.textContent)&&!b.disabled),undefined,{timeout:10_000}).catch(()=>{});
    assert.ok(await connect.isEnabled(),`${why}: Connect stays available`);
  };
  await disconnected('signed-out settings hide account-only actions');
  // ---- The one-time adult step before Connect: signing out withdrew this device's AI permission ----
  {
    const signIns=()=>page.evaluate(()=>window.__ahaAI.signIns?.length??0);
    const consentRecord=()=>page.evaluate(()=>window.__ahaFixture.read().journals?.['aha-ai-consent']);
    assert.equal(await consentRecord(),undefined,'sign-out withdrew the permission');
    assert.equal(await page.evaluate(()=>localStorage.getItem('aha-test-consent-withdrawn')),'1');
    const before=await signIns();
    await connect.click();
    const step=page.locator('.consent-step');
    await step.getByRole('heading',{name:'For the Free2Z account holder',exact:true}).waitFor();
    assert.equal(await connect.count(),0,'the step replaces Connect');
    // Measured, not eyeballed: minimal words, one numeric field, nothing clipped, on screen at this width.
    const m=await step.evaluate(el=>{const field=el.querySelector('input'),box=el.getBoundingClientRect(),dialog=el.closest('dialog');return {
      words:el.innerText.trim().split(/\s+/).length,inputs:el.querySelectorAll('input').length,inputMode:field.inputMode,autocomplete:field.getAttribute('autocomplete'),
      focused:document.activeElement===field,overflow:el.scrollHeight-el.clientHeight,width:box.width,dialogWidth:dialog.clientWidth,text:el.innerText};});
    assert.ok(m.words<=40,`the step stays brief: ${m.words} words`);
    assert.match(m.text,/AI lessons come from Free2Z, using OpenAI models\. AHA sends math problems and progress, never a name\./);
    assert.deepEqual([m.inputs,m.inputMode,m.autocomplete,m.focused],[1,'numeric','bday-year',true],'one neutral birth-year field, focused');
    assert.ok(m.overflow<=1&&m.width<=m.dialogWidth,`nothing clipped (overflow ${m.overflow}px, ${m.width}px in ${m.dialogWidth}px)`);
    assert.equal(await page.getByRole('button',{name:'Allow and connect',exact:false}).isDisabled(),true,'Allow waits for a four-digit year');
    assert.equal(await signIns(),before,'nothing opens the sign-in before the step is answered');
    await step.getByRole('button',{name:'Not now',exact:true}).click();
    await connect.waitFor();
    // An implausible year is only a typing problem; a year that does not pass locks the step on this device.
    await connect.click();
    await page.getByLabel('Your birth year',{exact:true}).fill('3000');
    await page.getByRole('button',{name:'Allow and connect',exact:false}).click();
    await page.getByText('Enter a four-digit year.',{exact:true}).waitFor();
    await page.getByLabel('Your birth year',{exact:true}).fill('2015');
    await page.getByRole('button',{name:'Allow and connect',exact:false}).click();
    await page.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    assert.equal(await signIns(),before,'a year that does not pass never opens the sign-in');
    assert.ok(Date.parse((await consentRecord()).lockedUntil)>Date.now()+23*3600_000,'locked for a day');
    // As a value of its own, not a digit run inside a random id or a timestamp (which made this flaky).
    assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>window.__ahaFixture.read())),/(?<![0-9a-fA-F-])2015(?![0-9a-fA-F-])/,'the year is never stored');
    await page.getByRole('button',{name:'OK',exact:true}).click();
    await connect.click();
    await page.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Your birth year',{exact:true}).count(),0,'no second guess while locked');
    await page.getByRole('button',{name:'OK',exact:true}).click();
    // The lock survives a relaunch until its day is over (simulated by moving it into the past), then the step asks again.
    // TEST-ONLY launch knob: the fake SDK session stays signed out across these relaunches.
    await page.evaluate(()=>localStorage.setItem('aha-test-ai-launch',JSON.stringify({signedIn:false})));
    await page.reload();
    await settings();
    await connect.click();
    await page.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'OK',exact:true}).click();
    await page.evaluate(()=>{const db=window.__ahaFixture.read();
      db.journals['aha-ai-consent'].lockedUntil=new Date(Date.now()-1000).toISOString();localStorage.setItem('aha-controller-test-fixture',JSON.stringify(db));});
    await page.reload();
    await page.evaluate(()=>localStorage.removeItem('aha-test-ai-launch'));
    await settings();
    await disconnected('an expired lock returns to the disconnected state');
  }
  // Backing out of the Android Custom Tab (or cancelling iOS ASWebAuthenticationSession)
  // rejects authorize; tauri-plugin-f2z reports it as browser_error.
  const alertsBeforeCancel=await page.getByRole('alert').count();
  await page.evaluate(()=>{window.__ahaAI.failSignIn={code:'browser_error',retryable:false};});
  await connect.click();
  // The adult step passes once; then the system sign-in opens (here it is closed), and later Connects go straight to it.
  await page.getByLabel('Your birth year',{exact:true}).fill('1985');
  await page.getByRole('button',{name:'Allow and connect',exact:false}).click();
  await page.getByText('Free2Z sign-in closed; you can connect any time.',{exact:true}).waitFor();
  assert.equal(await page.locator('.error-banner').count(),0,'cancelling sign-in shows no error banner');
  assert.equal(await page.getByRole('alert').count(),alertsBeforeCancel,'cancelling sign-in raises no alert');
  assert.ok(consoleWarnings.some(m=>/sign-in/.test(m)&&/browser_error/.test(m)),'a closed sign-in browser is still visible in the console (it may also be a launch failure)');
  await disconnected('a cancelled sign-in returns to the disconnected state');
  // zuu #1138: a dismissed sheet or Custom Tab is user_cancelled. Quiet, like the browser_error fallback.
  await page.evaluate(()=>{window.__ahaAI.failSignIn={code:'user_cancelled',retryable:false};});
  await connect.click();
  await page.getByText('Free2Z sign-in closed; you can connect any time.',{exact:true}).waitFor();
  assert.equal(await page.locator('.error-banner').count(),0,'user_cancelled shows no error banner');
  assert.equal(await page.getByRole('alert').count(),alertsBeforeCancel,'user_cancelled raises no alert');
  await disconnected('user_cancelled returns to the disconnected state');
  // No browser or auth session could be shown: a specific, kind message (never the code).
  await page.evaluate(()=>{window.__ahaAI.failSignIn={code:'browser_unavailable',retryable:false};});
  await connect.click();
  await page.getByRole('alert').filter({hasText:'AHA could not open a browser for the Free2Z sign-in.'}).waitFor();
  assert.equal(await page.getByText('browser_unavailable',{exact:false}).count(),0,'codes stay out of the UI');
  await disconnected('browser_unavailable stays disconnected');
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
  assert.deepEqual(await page.evaluate(()=>window.__ahaAI.signIns),Array(5).fill({spendCap:'100',spendPeriod:'month'}),'every sign-in carries only the optional spend-cap suggestion, as decimal strings');
  // ---- "Try something harder" never discards a paid, unanswered AI activity (#877; TEST fixture specs) ----
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.enforced=true;window.__ahaAI.difficulties=[5,8,3];window.__ahaAI.holdAfter=1;});
    const h=await ctx.newPage();
    const hErrors=[];h.on('pageerror',e=>hErrors.push(e.message));
    const hs=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
    const hAttempts=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat());
    // The bank refill (2 banked <= 8) starts in the background and is held in flight: it is never the button's call.
    const hStarts=async()=>(await h.evaluate(()=>window.__ahaAI.starts.length))-(await h.evaluate(()=>window.__ahaAI.held?.size??0));
    const harder=h.getByRole('button',{name:'Try something harder',exact:true});
    const shown=async()=>(await hs()).aiActivity?.activityId;
    const waitShown=async id=>{await h.waitForFunction(i=>Object.values(window.__ahaFixture.read().sessions)[0]?.data?.aiActivity?.activityId===i,id);};
    await h.goto(base);
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
    assert.deepEqual(st.aiQueue.map(q=>q.activityId),[easy,first],'the skipped paid activity is kept at the back of the queue');
    assert.equal(await hStarts(),1,'harder with a harder activity queued made no paid call');
    assert.equal((await hAttempts()).length,0,'skipping is not an attempt');
    // Nothing harder than 8 is queued (#899): the skip still moves on, to the next queued one, and the skipped
    // activity goes to the BACK of the queue. No paid call solely because of the button while content is queued.
    await harder.click();
    await waitShown(easy);
    st=await hs();
    assert.notEqual(st.aiActivity.activityId,hard,'a skip never leaves the same problem on screen');
    assert.deepEqual(st.aiQueue.map(q=>q.activityId),[first,hard],'the skipped activity waits at the back of the queue');
    assert.equal(await hStarts(),1,'no paid call solely because of the button while content is queued');
    assert.equal((await hAttempts()).length,0);
    // Answer it; the next batch (requested by the normal prefetch when the queue runs low) carries the signal.
    const key=st.aiActivity.spec.response.answer;
    await h.locator('.aha-activity input[inputmode="decimal"]').fill(String(key));
    await h.getByRole('button',{name:'Check',exact:true}).click();
    await h.getByRole('button',{name:NEXT}).click();
    await waitShown(first);
    // The held refill lands; the next refill is the first batch built after the signal.
    await h.evaluate(()=>window.__ahaAI.releaseHeld?.());
    await h.waitForFunction(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).length>=4);
    const k2=(await hs()).aiActivity.spec.response.answer;
    await h.locator('.aha-activity input[inputmode="decimal"]').fill(String(k2));
    await h.getByRole('button',{name:'Check',exact:true}).click();
    await h.waitForFunction(()=>window.__ahaAI.requests.some((r,i)=>i>=2&&/"wantsHarder":true/.test(r.messages[1].content[0].text)));
    const user=await h.evaluate(()=>window.__ahaAI.requests.findLast(r=>/"wantsHarder":true/.test(r.messages[1].content[0].text)).messages[1].content[0].text);
    assert.match(user,/"wantsHarder":true/,'the next batch request tells the model the learner wants harder');
    // The chained refill may already be on its way before this answer's save lands: wait for the evidence itself.
    await h.waitForFunction(()=>Object.values(window.__ahaFixture.read().attempts).flat().length>=2);
    const attempts=await hAttempts();
    assert.deepEqual(attempts.map(a=>a.data.activityId),[easy,first],'only the answered activities have evidence');
    assert.deepEqual(hErrors,[]);
    await ctx.close();
  }
  // ---- Skip with an empty queue, and flagging an AI spec, always change the problem (#899; TEST fixture specs) ----
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.enforced=true;window.__ahaAI.difficulties=[5,8,3];window.__ahaAI.holdAfter=1;});
    const h=await ctx.newPage();
    const hErrors=[];h.on('pageerror',e=>hErrors.push(e.message));
    const hs=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
    const hStarts=()=>h.evaluate(()=>window.__ahaAI.starts.length);
    const hAttempts=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat());
    await h.goto(base);
    await h.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await h.locator('.focus-stage.is-spec .aha-activity').waitFor();
    const answer=async()=>{
      const st=await hs();
      await h.locator('.aha-activity input[inputmode="decimal"]').fill(String(st.aiActivity.spec.response.answer));
      await h.getByRole('button',{name:'Check',exact:true}).click();
      await h.getByRole('button',{name:NEXT}).click();
    };
    // Drain the queue with no refill possible (the estimate is blocked), landing on the last paid activity.
    await h.evaluate(()=>{window.__ahaAI.blockEstimate=true;});
    const [b,c]=(await hs()).aiQueue.map(q=>q.activityId);
    const onShown=id=>h.waitForFunction(i=>Object.values(window.__ahaFixture.read().sessions)[0]?.data?.aiActivity?.activityId===i,id);
    await answer();await onShown(b);
    await answer();await onShown(c);
    let st=await hs();
    assert.deepEqual(st.aiQueue??[],[],'the queue is empty with the last paid activity on screen');
    const startsBefore=await hStarts();
    // Skip with an empty queue: a local task replaces it, the paid one is kept (queued, not lost), no paid call.
    await h.getByRole('button',{name:'Try something harder',exact:true}).click();
    await h.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0]?.data?.activity?.source==='local');
    st=await hs();
    assert.ok(!st.aiActivity,'the skipped paid activity is no longer on screen');
    assert.deepEqual(st.aiQueue.map(q=>q.activityId),[c],'the skipped paid activity is kept in the queue');
    assert.equal(await hStarts(),startsBefore,'the skip made no paid call');
    assert.equal((await hAttempts()).filter(a=>a.data.activityId===c).length,0,'skipping is not an attempt');
    assert.deepEqual(hErrors,[]);
    await ctx.close();
  }
  // ---- Endless focus loop with AI: 26 items in a row, prefetch keeps the queue full, never a pause (TEST fixture specs) ----
  {
    const ITEMS=26;
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.enforced=true;});
    const P=await ctx.newPage();
    const pErrors=[];P.on('pageerror',e=>pErrors.push(e.message));
    await P.goto(base);await P.getByRole('button',{name:'Let’s begin',exact:true}).click();
    const onScreen=d=>d?.aiActivity?.activityId??d?.activity?.id;
    const now=()=>P.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0]?.data);
    let ai=0,local=0;
    for(let i=1;i<=ITEMS;i++){
      await P.getByRole('button',{name:'Check',exact:true}).waitFor();
      const d=await now(),id=onScreen(d);
      if(d.aiActivity){ai++;await P.locator('.aha-activity input[inputmode="decimal"]').fill(String(d.aiActivity.spec.response.answer));}
      else{
        local++;const want=expectedAnswer(d.activity.task),sym={'<':'Less than','>':'Greater than','=':'Equal to'}[want];
        if(d.activity.choices)await P.locator(`input[type=radio][value="${want}"]`).check();
        else if(sym)await P.getByRole('button',{name:sym,exact:true}).click();
        else await P.getByLabel('Your answer',{exact:true}).fill(want);
      }
      await P.getByRole('button',{name:'Check',exact:true}).click();
      await P.getByRole('button',{name:NEXT}).waitFor();
      assert.equal(await P.getByText(/place to pause/i).count(),0,`item ${i}: no pause or end screen`);
      // A completed lap of AI and local items: the recap, from durable evidence, while prefetch carries on.
      assert.equal(await P.locator('.lap-recap').count(),i%10===0?1:0,`item ${i}: a recap only as a lap completes`);
      if(i%10===0){assert.match(await P.locator('.lap-recap').innerText(),/10 of 10 correct/);assert.ok(await P.locator('.lap-recap .lap-skill').count()>=1,'the lap names a skill practised');}
      const bar=P.locator('.focus-progress');
      assert.equal(await bar.getAttribute('aria-valuemax'),'10');
      assert.equal(await bar.getAttribute('aria-valuenow'),String(i%10||10),`item ${i}: the bar marks a lap, not an end`);
      assert.equal(await bar.evaluate(b=>b.classList.contains('is-milestone')),i%10===0,`item ${i}: a lap turns gold only as it completes`);
      await P.getByRole('button',{name:NEXT}).click();
      await P.waitForFunction(prev=>{const d=Object.values(window.__ahaFixture.read().sessions)[0]?.data;const now=d?.aiActivity?.activityId??d?.activity?.id;return !!now&&now!==prev;},id);
    }
    await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await P.locator('.focus-progress').getAttribute('aria-valuenow'),String(ITEMS%10),'the next item starts a fresh lap');
    const paidCalls=await P.evaluate(()=>window.__ahaAI?.starts.length??0);
    // Home steps away at any moment; Continue (and a restart) resume exactly the same item and lap.
    const resumeAt=onScreen(await now());
    await P.getByRole('button',{name:'Home',exact:true}).click();
    await P.getByRole('button',{name:'Continue',exact:true}).click();await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(onScreen(await now()),resumeAt,'Home then Continue resumes the same item');
    await P.reload();await P.getByRole('button',{name:'Continue',exact:true}).click();await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(onScreen(await now()),resumeAt,'a restart resumes the same item');
    assert.equal(await P.locator('.focus-progress').getAttribute('aria-valuenow'),String(ITEMS%10),'a restart keeps the lap');
    const recorded=await P.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat());
    assert.equal(recorded.length,ITEMS,'every answer is one durable attempt');
    assert.equal(new Set(recorded.map(a=>a.sessionId)).size,1,'one open-ended run; no session boundary every ten items');
    // Only the timed-recall interleave (one local task after every fifth) is local; AI never runs dry.
    assert.ok(ai>=ITEMS-Math.ceil(ITEMS/5),`AI keeps up across the whole run (${ai} AI, ${local} local)`);
    assert.ok(paidCalls>=Math.ceil((ai-3)/3),`the queue is refilled by background prefetch, batch after batch (${paidCalls} calls for ${ai} AI items)`);
    assert.ok((await now()).aiQueue?.length>=1,'the queue is still stocked after the run');
    assert.deepEqual(pErrors,[]);
    await ctx.close();
  }
  {
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.enforced=true;window.__ahaAI.difficulties=[5,8,3];});
    const h=await ctx.newPage();
    const hErrors=[];h.on('pageerror',e=>hErrors.push(e.message));
    const hs=()=>h.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data);
    await h.goto(base);
    await h.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await h.locator('.focus-stage.is-spec .aha-activity').waitFor();
    const flagged=(await hs()).aiActivity.activityId;
    // Skip once so the flagged activity also travels through a requeue, then flag whatever is on screen.
    await h.getByRole('button',{name:'Try something harder',exact:true}).click();
    await h.waitForFunction(i=>Object.values(window.__ahaFixture.read().sessions)[0]?.data?.aiActivity?.activityId!==i,flagged);
    const second=(await hs()).aiActivity.activityId;
    await h.getByRole('button',{name:'Report',exact:true}).click();
    await h.getByRole('button',{name:'Incorrect',exact:true}).click();
    await h.getByRole('button',{name:NEXT}).waitFor();
    let st=await hs();
    assert.ok(!st.aiActivity,'the flagged spec left the screen');
    assert.ok(!st.aiQueue.some(q=>q.activityId===second),'the flagged spec is not queued');
    assert.equal(await h.evaluate(id=>Object.values(window.__ahaFixture.read().disputes).flat().filter(d=>d.activityId===id).length,second),1,'the dispute is recorded');
    await h.reload();
    await h.waitForTimeout(500);
    st=await hs();
    assert.notEqual(st.aiActivity?.activityId,second,'a reload never restores the flagged spec');
    assert.ok(!(st.aiQueue??[]).some(q=>q.activityId===second),'nor requeues it');
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
    const oNext=o.getByRole('button',{name:NEXT});
    const answerSpec=async()=>{
      const key=(await os()).aiActivity.spec.response.answer;
      await o.locator('.aha-activity input[inputmode="decimal"]').fill(String(key));
      await o.getByRole('button',{name:'Check',exact:true}).click();
      await oNext.waitFor();
    };
    await o.goto(base);
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
    // The bank ran low while that batch streamed, so one background refill follows it (single flight); the tap made none.
    assert.equal(await oStarts(),2);
    const j=await o.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1']);
    assert.equal(j.version,4,'the v2 journal is stored as v4 on its first write');
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
    await q.goto(base);
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
    // The bank refill that a 3-activity TEST batch triggers at once (<= 8 banked, #929) is held in flight unless a
    // scenario opts out; `starts()` counts the paid calls that ran, not the held refill.
    await ctx.addInitScript(k=>{Object.assign(window.__ahaAI,{holdAfter:1},k);},knobs);
    const p=await ctx.newPage();const pageErrors=[],logged=[],warned=[];
    p.on('pageerror',e=>pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')logged.push(m.text());if(m.type()==='warning')warned.push(m.text());});
    await p.goto(base);
    await p.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await p.getByRole('button',{name:'Check',exact:true}).waitFor();
    const openSettings=async()=>{await p.locator('.status-dot').click();await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('heading',{name:'Settings',exact:true}).waitFor();};
    const figure=async label=>(await p.locator('.balance-row > div').filter({has:p.getByText(label,{exact:true})}).locator('dd').textContent());
    return {ctx,p,pageErrors,logged,warned,openSettings,figure,starts:()=>p.evaluate(()=>window.__ahaAI.starts.length-(window.__ahaAI.held?.size??0)),
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
    // Delete Free2Z account sits alone on its own row, on the account controls' left edge, well clear of
    // the buttons above it; the header's close control is Settings' only way back (no "Back to learning").
    assert.equal(await s.p.getByRole('button',{name:'Back to learning',exact:true}).count(),0,'no duplicate exit beside the delete link');
    assert.equal(await s.p.getByRole('button',{name:'Close settings',exact:true}).isVisible(),true,'Settings keeps its close control');
    {
      const del=await s.p.getByRole('button',{name:'Delete Free2Z account',exact:true}).boundingBox();
      const rows=await s.p.locator('.settings-body section:first-child .settings-buttons button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().toJSON()));
      assert.ok(del&&rows.length,'delete link and account controls are on screen');
      assert.ok(Math.abs(del.x-Math.min(...rows.map(r=>r.x)))<=1,`delete link shares the controls' left edge (${del.x} vs ${Math.min(...rows.map(r=>r.x))})`);
      assert.ok(del.y-Math.max(...rows.map(r=>r.bottom))>=24,'delete link is clearly separated from the controls above');
      assert.ok(del.height>=44,'delete link keeps a 44px hit area');
    }
    // Account exits: a neutral Manage Free2Z account (AHA's own entry) and Delete Free2Z account, both in the system browser.
    // Each exit to a Free2Z page shows the adult step first (nothing pre-filled), and nothing opens until it passes.
    for(const [name,page] of [['Manage Free2Z account','apps'],['Delete Free2Z account','delete']]){
      await s.p.getByRole('button',{name,exact:true}).click();
      await s.p.getByRole('heading',{name:'For the Free2Z account holder',exact:true}).waitFor();
      assert.equal(await s.p.getByLabel('Your birth year',{exact:true}).inputValue(),'',`${name}: no year pre-filled`);
      assert.equal(await s.p.evaluate(()=>window.__ahaAI.accountOpened??0),0,`${name}: nothing opens before the step`);
      assert.equal(await s.p.getByText('OpenAI',{exact:false}).count(),0,`${name}: AI permission was given already; only the age step shows`);
      await s.p.getByRole('button',{name:'Not now',exact:true}).click();
      assert.equal(await s.p.evaluate(()=>window.__ahaAI.accountOpened??0),0,`${name}: Not now opens nothing`);
      void page;
    }
    await s.p.getByRole('button',{name:'Manage Free2Z account',exact:true}).click();
    await s.p.getByLabel('Your birth year',{exact:true}).fill('1985');
    await s.p.getByRole('button',{name:'Continue',exact:false}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.accountOpened===1);
    // A pass is remembered for a few minutes: the next exit right after opens without asking again.
    await s.p.getByRole('button',{name:'Delete Free2Z account',exact:true}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.accountOpened===2);
    assert.deepEqual(await s.p.evaluate(()=>window.__ahaAI.accountPages),['manage','delete'],'the SDK opens each page by command; the webview sends no URL');
    assert.equal(await s.p.getByRole('button',{name:'Add 2Z',exact:false}).count(),0,'no in-app purchase');
    assert.equal(await s.p.locator('a[href]').count(),0,'no links out of the app at all');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // SDK sdk-v0.3.0 (TEST-ONLY fake plugin): the account's username, "Use a different account", and the report outbox.
    const s=await scenario({enforced:true,spendCap:null,capPeriod:'month',capRemaining:null,username:'maths_parent'});
    const card=s.p.locator('.focus-stage.is-spec .aha-activity');
    await card.waitFor();
    const ai=()=>s.p.evaluate(()=>window.__ahaAI);
    const outboxOf=account=>s.p.evaluate(a=>window.__ahaFixture.read(a).journals?.['aha-ai-reports']??null,account);
    // Free2Z is rate limiting reports: the activity is still set aside at once, calmly, and its report waits on the device.
    await s.p.evaluate(()=>{window.__ahaAI.reportFail=[{code:'rate_limited',status:429,retryAfterSeconds:'1'}];});
    const reported=(await s.p.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.aiActivity)).activityId;
    await s.p.getByRole('button',{name:'Report',exact:true}).click();
    await s.p.getByRole('button',{name:'Unsafe',exact:true}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.reportCalls?.length===1);
    assert.deepEqual((await ai()).reportCalls[0],{callId:FIXTURE_CALL,reason:'unsafe',subject:'test-subject'},'a call id and a reason, never a detail');
    await s.p.waitForFunction(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]').some(e=>e.source==='ai-report'&&/rate_limited/.test(e.message)));
    let box=await outboxOf();
    assert.equal(box.reports.length,1);
    assert.equal(box.reports[0].activityId,reported);
    assert.equal(box.reports[0].sentAt,undefined,'a 429 leaves the report waiting');
    assert.equal(await s.p.getByRole('alert').count(),0,'a busy Free2Z is never an alert to the learner');
    // The next connect inside Free2Z's Retry-After sends nothing; after it, the report goes once.
    await s.p.evaluate(()=>window.__ahaAI.releaseHeld?.());
    await s.openSettings();
    await s.p.getByRole('heading',{name:'@maths_parent',exact:true}).waitFor();
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.getByText('AI ready',{exact:true}).waitFor();
    assert.equal((await ai()).reportCalls.length,1,'no send inside Retry-After');
    await new Promise(r=>setTimeout(r,1100));
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.reportCalls.length===2);
    await s.p.waitForFunction(()=>window.__ahaFixture.read().journals['aha-ai-reports'].reports[0].sentAt);
    await s.p.getByText('AI ready',{exact:true}).waitFor();
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.getByText('AI ready',{exact:true}).waitFor();
    assert.equal((await ai()).reportCalls.length,2,'a sent report is never sent again');
    // "Use a different account" sits behind the adult step, like every Free2Z exit.
    const signIns=async()=>(await ai()).signIns?.length??0;
    await s.p.getByRole('button',{name:'Use a different account',exact:true}).click();
    await s.p.getByRole('heading',{name:'For the Free2Z account holder',exact:true}).waitFor();
    assert.equal(await signIns(),0,'nothing opens before the step');
    await s.p.evaluate(()=>{window.__ahaAI.failSignIn={code:'user_cancelled'};window.__ahaAI.nextAccount={subject:'second-subject',username:'other_parent'};});
    await s.p.getByLabel('Your birth year',{exact:true}).fill('1985');
    await s.p.getByRole('button',{name:'Continue',exact:false}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.signIns?.length===1);
    // Closed without signing in: the same account carries on, quietly.
    await s.p.getByRole('heading',{name:'@maths_parent',exact:true}).waitFor();
    await s.p.getByRole('button',{name:'Use a different account',exact:true}).waitFor();
    assert.equal(await s.p.getByRole('alert').count(),0,'closing the switch is not an error');
    // Again (the pass is remembered for a few minutes): Free2Z asks for a fresh sign-in and another account signs in.
    await s.p.getByRole('button',{name:'Use a different account',exact:true}).click();
    await s.p.getByRole('heading',{name:'@other_parent',exact:true}).waitFor();
    await s.p.getByText('AI ready',{exact:true}).waitFor();
    assert.deepEqual((await ai()).signIns,Array(2).fill({prompt:'login',spendCap:'100',spendPeriod:'month'}),'prompt=login: Free2Z asks for a fresh sign-in, with the same budget suggestion');
    await s.p.getByRole('button',{name:'Close settings',exact:true}).click();
    // The new account has its own data: a fresh learner and no reports; the first account's outbox is untouched.
    await s.p.getByRole('button',{name:NEXT}).click();
    await card.waitFor();
    const second=await s.p.evaluate(()=>window.__ahaFixture.read('second-subject'));
    assert.ok(Object.values(second.activities).flat().length>0,'the new account practises in its own partition');
    assert.ok((await ai()).activityAccounts.slice(-1)[0]==='second-subject');
    assert.equal(second.journals?.['aha-ai-reports'],undefined,'no report crosses accounts');
    box=await outboxOf();
    assert.equal(box.reports.length,1);
    assert.ok(box.reports[0].sentAt);
    assert.ok((await ai()).reportCalls.every(c=>c.subject==='test-subject'),'every report went out under the account that made it');
    assert.equal(await s.p.locator('a[href]').count(),0,'no links out of the app at all');
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
    await s.p.evaluate(()=>window.__ahaAI.releaseHeld?.());
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
    await s.p.getByRole('button',{name:'Where would I use this?',exact:true}).click();
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
    // Out of credits is calm: "No credits", Manage Free2Z account leads, and local practice continues.
    await s.p.locator('.connection-pill').filter({hasText:/^No credits$/}).waitFor();
    await s.p.getByText('No credits. Local practice continues.',{exact:false}).first().waitFor();
    await s.p.getByText('AI tutoring will be tried again on a later task.',{exact:false}).first().waitFor();
    assert.equal((await s.p.locator('.settings-buttons .primary-button').first().textContent()).trim(),'Manage Free2Z account','Manage Free2Z account leads');
    // Store-neutral (App Store 3.1.1/3.1.3, Play Payments): no call to buy or add 2Z, and no amount needed, anywhere on the page.
    assert.equal(await s.p.getByText(/top up|top-up|buy|purchase|add 2Z|need \d+ 2Z|raise it/i).count(),0,'a low balance never prompts a purchase');
    assert.equal(await s.figure('Available balance'),'0.5 2Z');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // Strict refusal at send (the balance fell after the estimate): zero charge, calm status, local practice, nothing pending.
    const s=await scenario({enforced:true,strictRefusal:'insufficient_balance',refusalDetails:{reason:'insufficient_balance',required_2z:'3',available_milli_2z:'2500'}});
    await s.p.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await s.starts(),1,'the strict request reached the gateway once and was refused');
    assert.equal(await s.source(),'local','strict refusal: local fallback');
    assert.equal(await s.p.getByRole('alert').count(),0,'strict refusal: no alert');
    assert.ok(s.logged.some(m=>/AI unavailable/.test(m)&&/insufficient_balance/.test(m)),'logged visibly');
    await s.openSettings();
    await s.p.getByText('No credits. Local practice continues.',{exact:false}).first().waitFor();
    assert.equal(await s.p.getByText(/top up|top-up|buy|purchase|add 2Z|need \d+ 2Z/i).count(),0,'a low balance never prompts a purchase');
    assert.equal(await s.p.getByRole('button',{name:'Recover original request',exact:true}).count(),0,'a refusal leaves no unsettled receipt to recover');
    const journal=await s.p.evaluate(()=>Object.values(window.__ahaFixture.read().journals??{}).flatMap(j=>j.operations??[]));
    assert.ok(journal.length>=1&&journal.every(o=>o.state==='finalized'&&o.charge?.state==='released'&&o.charge.charged2z==='0'),'journal settles the refused operation as released/0');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // 403 cap_exceeded at send: zero charge, "App budget reached", and the Free2Z account link. zuu#1145: no resets_at/cap fields.
    const s=await scenario({enforced:true,strictRefusal:'cap_exceeded',refusalDetails:{reason:'cap_exceeded',required_2z:'3',cap_remaining_milli_2z:'500'}});
    await s.p.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await s.starts(),1,'the strict request reached the gateway once and was refused');
    assert.equal(await s.source(),'local','budget refusal: local fallback');
    assert.equal(await s.p.getByRole('alert').count(),0,'budget refusal: no alert');
    assert.ok(s.logged.some(m=>/AI unavailable/.test(m)&&/cap_exceeded/.test(m)),'logged visibly');
    await s.openSettings();
    await s.p.getByText('App budget reached. Local practice continues.',{exact:false}).first().waitFor();
    await s.p.locator('.connection-pill').filter({hasText:/^App budget reached$/}).waitFor();
    assert.equal(await s.p.getByText('top up',{exact:false}).count(),0,'a budget refusal never says topping up fixes it');
    const link=s.p.locator('.settings-buttons .primary-button').filter({hasText:'Manage Free2Z account'});
    await link.click();
    // A year that does not pass is refused calmly and locks every exit: Manage stays closed.
    await s.p.getByLabel('Your birth year',{exact:true}).fill('2012');
    await s.p.getByRole('button',{name:'Continue',exact:false}).click();
    await s.p.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    await s.p.getByRole('button',{name:'OK',exact:true}).click();
    for(const name of ['Manage Free2Z account','Delete Free2Z account']){
      await s.p.getByRole('button',{name,exact:true}).click();
      await s.p.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
      await s.p.getByRole('button',{name:'OK',exact:true}).click();
    }
    assert.equal(await s.p.evaluate(()=>window.__ahaAI.accountOpened??0),0,'a lock keeps every Free2Z page closed');
    assert.equal(await s.p.locator('.connection-pill').filter({hasText:/^App budget reached$/}).count(),1,'a lock never stops AI already allowed (still connected)');
    // As if the day passed: the lock is lifted and the account holder passes.
    await s.p.evaluate(()=>{const db=window.__ahaFixture.read();db.journals['aha-ai-consent'].lockedUntil=new Date(Date.now()-1000).toISOString();localStorage.setItem('aha-controller-test-fixture',JSON.stringify(db));});
    await s.p.reload();await s.p.getByRole('button',{name:'Continue',exact:true}).click();await s.p.getByRole('button',{name:'Check',exact:true}).waitFor();
    await s.openSettings();
    await link.click();
    await s.p.getByLabel('Your birth year',{exact:true}).fill('1985');
    await s.p.getByRole('button',{name:'Continue',exact:false}).click();
    await s.p.waitForFunction(()=>window.__ahaAI.accountOpened===1);
    assert.deepEqual(await s.p.evaluate(()=>window.__ahaAI.accountPages),['manage']);
    const journal=await s.p.evaluate(()=>Object.values(window.__ahaFixture.read().journals??{}).flatMap(j=>j.operations??[]));
    assert.ok(journal.length>=1&&journal.every(o=>o.state==='finalized'&&o.charge?.state==='released'&&o.charge.charged2z==='0'),'journal settles the refused operation as released/0');
    // A successful refresh clears the refusal and its link.
    await s.p.evaluate(()=>window.__ahaAI.releaseHeld?.());
    await s.p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await s.p.locator('.connection-pill').filter({hasText:/^AI ready$/}).waitFor();
    assert.equal(await link.count(),0,'Manage Free2Z account stops leading once AI is ready again');
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
    // The open (held refill) operation carries its exact format; a settled one is archived without it.
    const op=(await journalOps(s)).find(o=>o.request.responseFormat);
    assert.deepEqual(op.request.responseFormat,request.response_format,'the exact format is journaled for same-key recovery');
    assert.equal(await s.p.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].version),4);
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // The gateway refuses the format at send (bare 400 invalid_request, as the native transport delivers it):
    // zero-charge release, then the prompt-only request under a new key. No alert; a warning is logged.
    const s=await scenario({enforced:true,structured:true,formatRefusal:'chat',holdAfter:2});
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
    assert.equal((await journalOps(s)).filter(o=>o.state==='finalized').length,1,'only the prompt-only send settled (the refill is held)');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // ---- Learner-chosen model (TEST-ONLY fake catalogue of three models, no live Free2Z) ----
    // Per activity at a full 35-activity batch: Pro ≈ 4.2 2Z (above the 1.5 2Z auto ceiling), Standard ≈ 0.68 2Z, Mini without structured output.
    const tier=(id,name,input,output,structured)=>({id,provider:'test',display_name:name,context_window:'128000',max_output_tokens:'16384',
      capabilities:{vision:false,tools:false,reasoning:false,structured_output:structured},prices:{input_milli_2z_per_mtok:String(input),output_milli_2z_per_mtok:String(output)},min_charge_2z:'1',ttfb_timeout_ms:'30000'});
    const pro=tier('fixture-pro','Fixture Pro',2500000,10000000,true),standard=tier('fixture-standard','Fixture Standard',500000,1500000,true),mini=tier('fixture-mini','Fixture Mini',100000,400000,false);
    const s=await scenario({enforced:true,catalog:[pro,standard,mini],holdAfter:null});
    const p=s.p,card=p.locator('.focus-stage.is-spec .aha-activity');
    const data=()=>p.evaluate(()=>window.__ahaFixture.read());
    const sess=async()=>Object.values((await data()).sessions)[0].data;
    const attempt=async()=>Object.values((await data()).attempts).flat().at(-1).data;
    const answer=async()=>{const st=await sess();await p.locator('.aha-activity input[inputmode="decimal"]').fill(String(st.aiActivity.spec.response.answer));await p.getByRole('button',{name:'Check',exact:true}).click();await p.getByRole('button',{name:NEXT}).waitFor();};
    await card.waitFor();
    let request=await p.evaluate(()=>window.__ahaAI.requests.at(-1));
    assert.equal(request.model,'fixture-standard','Best (auto): the dearest structured model within the per-activity ceiling');
    assert.equal(request.response_format?.type,'json_schema','the auto pick advertises structured output');
    let st=await sess();
    assert.ok([st.aiActivity,...st.aiQueue].every(q=>q.model==='fixture-standard'),'every queued AI activity names its model');
    // The status sheet names the model that wrote the activity on screen.
    await p.locator('.status-dot').click();
    await p.getByText('Written by Fixture Standard',{exact:true}).waitFor();
    await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();
    const select=p.getByLabel('AI model',{exact:true});
    assert.deepEqual(await select.locator('option').allTextContents(),['Best (auto) · ≈ 0.68 2Z per activity','Fixture Pro · ≈ 4.2 2Z per activity','Fixture Standard · ≈ 0.68 2Z per activity'],'eligible models only, each with its estimate');
    assert.equal(await select.inputValue(),'auto');
    // A manual pick, persisted per account in the local journal.
    await select.selectOption('fixture-pro');
    await p.waitForFunction(()=>window.__ahaFixture.read().journals['aha-model-choice-v1']?.model==='fixture-pro');
    await p.getByRole('button',{name:'Close settings',exact:true}).click();
    await answer();
    assert.equal((await attempt()).spec.model,'fixture-standard','the attempt records the model that wrote the activity');
    // Next activity: the queue runs low and the background batch goes to the learner's choice.
    // (The bank refills at <= 8 banked, so a refill to auto's pick may already have run before the choice.)
    await p.getByRole('button',{name:NEXT}).click();
    const proQueued=()=>p.evaluate(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).some(q=>q.model==='fixture-pro'));
    // The next problem (AI, or the local timed-recall task every fifth), answered whatever it is.
    const shownKey=d=>d.aiActivity?.activityId??d.activity?.id;
    const nextShown=async()=>{const before=shownKey(await sess());await p.getByRole('button',{name:NEXT}).click();await p.waitForFunction(id=>{const d=Object.values(window.__ahaFixture.read().sessions)[0].data;return (d.aiActivity?.activityId??d.activity?.id)!==id;},before);await p.getByRole('button',{name:'Check',exact:true}).waitFor();};
    const answerAny=async()=>{const st=await sess();if(st.aiActivity)return answer();const v=String(expectedAnswer(st.activity.task)),sym={'<':'Less than','>':'Greater than','=':'Equal to'}[v];if(sym)await p.getByRole('button',{name:sym,exact:true}).click();else await p.getByLabel('Your answer',{exact:true}).fill(v);await p.getByRole('button',{name:'Check',exact:true}).click();await p.getByRole('button',{name:NEXT}).waitFor();};
    for(let i=0;i<20&&!(await proQueued());i++){await p.getByRole('button',{name:'Check',exact:true}).waitFor();await answerAny();await nextShown();}
    await p.waitForFunction(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).some(q=>q.model==='fixture-pro'));
    request=await p.evaluate(()=>window.__ahaAI.requests.at(-1));
    assert.equal(request.model,'fixture-pro','a manual pick is honoured, even above the auto ceiling');
    const proOp=(await data()).journals['aha-billing-v1'].operations.at(-1);
    assert.equal(proOp.request.model,'fixture-pro','the chosen model is persisted in the journal operation (same-key recovery resends to it)');
    // Work through the rest of the first batch to the first Pro activity, answer it, then flag the next one.
    for(let i=0;i<20&&(await sess()).aiActivity?.model!=='fixture-pro';i++){await answerAny();await nextShown();}
    st=await sess();
    assert.equal(st.aiActivity.model,'fixture-pro');
    const records=Object.values((await data()).activities).flat();
    assert.equal(records.find(a=>a.id===st.aiActivity.activityId).data.model,'fixture-pro','the activity record names its model');
    await answer();
    assert.equal((await attempt()).spec.model,'fixture-pro');
    await p.getByRole('button',{name:NEXT}).click();
    await card.waitFor();
    const reportedItem=(await sess()).aiActivity;
    assert.equal(reportedItem.model,'fixture-pro');
    await p.getByRole('button',{name:'Report',exact:true}).click();
    // A fixed reason choice, nothing to type (Play AI-Generated Content policy: report without leaving the app).
    const reportSheet=await p.getByRole('dialog',{name:'Report'}).evaluate(d=>({fields:d.querySelectorAll('input,textarea').length,
      reasons:[...d.querySelectorAll('.report-reasons button')].map(b=>b.textContent.trim())}));
    assert.deepEqual(reportSheet,{fields:0,reasons:['Incorrect','Inappropriate','Unsafe','Something else']});
    await p.getByRole('button',{name:'Incorrect',exact:true}).click();
    await p.waitForFunction(()=>Object.values(window.__ahaFixture.read().disputes).flat().length===1);
    {
      // Recorded on the device with the exact activity, its spec id and the Free2Z call and receipt, then sent to Free2Z
      // through the SDK's reportCall: the call id and the reason only.
      await p.waitForFunction(()=>window.__ahaFixture.read().journals['aha-ai-reports'].reports[0].sentAt);
      const outbox=(await data()).journals['aha-ai-reports'];
      assert.equal(outbox.version,1);
      assert.equal(outbox.reports.length,1);
      const {id,createdAt,sentAt,...report}=outbox.reports[0];
      assert.ok(id&&Date.parse(createdAt)&&Date.parse(sentAt));
      assert.deepEqual(await p.evaluate(()=>window.__ahaAI.reportCalls),[{callId:FIXTURE_CALL,reason:'incorrect',subject:'test-subject'}]);
      // The report names exactly the activity that was set aside (the one on screen at the tap), from its stored record.
      const stored=await data(),disputed=Object.values(stored.disputes).flat()[0].activityId;
      const shownRecord=Object.values(stored.activities).flat().find(x=>x.id===disputed).data;
      assert.deepEqual(report,{activityId:disputed,specId:shownRecord.spec.id,operationId:shownRecord.operationId,
        callId:FIXTURE_CALL,receiptId:'fixture-receipt',model:shownRecord.model,reason:'incorrect'});
      assert.equal(Object.values((await data()).disputes).flat()[0].reason,'Learner reported: incorrect');
      assert.notEqual((await sess()).aiActivity?.activityId,disputed,'the reported activity is replaced');
    }
    // Per-model stats from local data only, in Settings and in the problem report.
    await s.openSettings();
    await p.getByText('Model stats',{exact:true}).click();
    const statsList=p.locator('.model-stats li');
    await statsList.first().waitFor();
    const lines=await statsList.allTextContents();
    const proLine=lines.find(l=>l.startsWith('fixture-pro:')),standardLine=lines.find(l=>l.startsWith('fixture-standard:'));
    assert.ok(proLine&&standardLine,`both models appear: ${lines.join(' / ')}`);
    // Prefetch timing decides how many sets and answers each model has by now: the expected line is derived from the
    // stored journal and evidence, so the check is exact without depending on timing.
    const stored=await data();
    const expectLine=(model,flagged)=>{
      const sets=stored.journals['aha-billing-v1'].operations.filter(o=>o.request.model===model&&o.charge?.state==='charged').length;
      const answers=Object.values(stored.attempts).flat().filter(a=>a.data.source==='ai-spec'&&a.data.spec.model===model);
      const right=answers.filter(a=>a.data.correct).length;
      return `${model}: ${sets} ${sets===1?'set':'sets'} · kept ${sets*3}, rejected 0 schema + 0 semantic · ${flagged} flagged · ≈ 1 2Z per set · `+
        (answers.length?`${Math.round(right/answers.length*100)}% correct first try (${answers.length})`:'no answers yet');
    };
    assert.equal(standardLine,expectLine('fixture-standard',0));
    assert.equal(proLine,expectLine('fixture-pro',1));
    await p.getByRole('button',{name:'Report a problem',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.report-text')?.value.includes('Model stats (this device)'));
    const report=await p.locator('.report-text').inputValue();
    assert.ok(report.includes(proLine)&&report.includes(standardLine),'the report carries the same stats lines');
    assert.ok(!report.includes('Explorer'),'no learner names in the report');
    // The choice survives a restart; while its model is missing from the catalogue, auto is used (logged) and the choice is kept.
    await p.reload();
    await p.getByRole('button',{name:'Settings',exact:true}).click();
    await p.getByRole('heading',{name:'Settings',exact:true}).waitFor();
    await p.getByLabel('AI model',{exact:true}).waitFor();
    assert.equal(await p.getByLabel('AI model',{exact:true}).inputValue(),'fixture-pro','the choice is persisted per account');
    await p.evaluate(m=>{window.__ahaAI.catalog=m;},[standard,mini]);
    await p.evaluate(()=>window.__ahaAI.releaseHeld?.());
    await p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.model-choice select')?.value==='auto');
    assert.equal((await data()).journals['aha-model-choice-v1'].model,'fixture-pro','one degraded catalogue read never erases the stored choice');
    assert.ok(s.warned.some(m=>/fixture-pro is no longer offered/.test(m)),'the fallback to auto is logged visibly');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // ---- Reasoning models (TEST-ONLY fake catalogue): never Best (auto); chosen by hand they get a 12k budget ----
    const tier=(id,name,input,output,reasoning)=>({id,provider:'test',display_name:name,context_window:'200000',max_output_tokens:'100000',
      capabilities:{vision:false,tools:false,reasoning,structured_output:true},prices:{input_milli_2z_per_mtok:String(input),output_milli_2z_per_mtok:String(output)},min_charge_2z:'1',ttfb_timeout_ms:'30000'});
    // By a non-reasoning estimate the reasoner (≈ 7 2Z) would be the auto pick over Standard (≈ 5 2Z); with 4x reasoning output it is ≈ 19 2Z.
    const reasoner=tier('fixture-reasoner','Fixture Reasoner',600000,2000000,true),standard=tier('fixture-standard','Fixture Standard',500000,1500000,false);
    const s=await scenario({enforced:true,catalog:[reasoner,standard],outOfRoomModel:'fixture-reasoner'});
    const p=s.p,card=p.locator('.focus-stage.is-spec .aha-activity');
    const data=()=>p.evaluate(()=>window.__ahaFixture.read());
    const sess=async()=>Object.values((await data()).sessions)[0].data;
    await card.waitFor();
    let request=await p.evaluate(()=>window.__ahaAI.requests[0]);
    assert.equal(request.model,'fixture-standard','Best (auto) skips the reasoning model even though it would otherwise be the dearest within the ceiling');
    assert.equal(request.max_output_tokens,'2820','the first batch on an empty bank is small');
    await s.openSettings();
    const select=p.getByLabel('AI model',{exact:true});
    assert.deepEqual(await select.locator('option').allTextContents(),
      ['Best (auto) · ≈ 0.68 2Z per activity','Fixture Reasoner · ≈ 2.9 2Z per activity · thinks longer, costs more','Fixture Standard · ≈ 0.68 2Z per activity'],
      'the reasoning model is labelled and its estimate includes reasoning headroom');
    await select.selectOption('fixture-reasoner');
    await p.waitForFunction(()=>window.__ahaFixture.read().journals['aha-model-choice-v1']?.model==='fixture-reasoner');
    await p.getByRole('button',{name:'Close settings',exact:true}).click();
    // The refill to auto's pick that started before the choice lands; the next refill goes to the choice.
    await p.evaluate(()=>window.__ahaAI.releaseHeld?.());
    const st=await sess();
    await p.locator('.aha-activity input[inputmode="decimal"]').fill(String(st.aiActivity.spec.response.answer));
    await p.getByRole('button',{name:'Check',exact:true}).click();
    await p.getByRole('button',{name:NEXT}).click();
    await p.waitForFunction(()=>window.__ahaAI.requests.some(r=>r.model==='fixture-reasoner'));
    await p.waitForFunction(()=>(Object.values(window.__ahaFixture.read().sessions)[0].data.aiQueue??[]).some(q=>q.model==='fixture-reasoner'));
    request=await p.evaluate(()=>window.__ahaAI.requests.findLast(r=>r.model==='fixture-reasoner'));
    assert.deepEqual([request.model,request.max_output_tokens,request.max_output_tokens_strict,request.response_format?.type],['fixture-reasoner','12000',true,'json_schema'],
      'the chosen reasoning model gets the 12k strict budget, structured output kept');
    const j=(await data()).journals['aha-billing-v1'];
    const op=j.operations.findLast(o=>o.request.model==='fixture-reasoner');
    assert.deepEqual([j.version,op.request.model,op.request.maxOutputTokens,op.outOfRoom],[4,'fixture-reasoner','12000',true],
      'the journal records the per-model budget (same-key recovery replays it) and that the set ran out of room');
    // The cut-off set still yields its whole activities, and the per-model stats say it ran out of room.
    await s.openSettings();
    await p.getByText('Model stats',{exact:true}).click();
    await p.locator('.model-stats li').first().waitFor();
    const lines=await p.locator('.model-stats li').allTextContents();
    // The bank refills at <= 8 banked, so the reasoner may have written more than one set by now: every one ran out of room.
    assert.ok(lines.some(l=>/^fixture-reasoner: (\d+) sets? · kept \d+, rejected 0 schema \+ 0 semantic, \1 ran out of room/.test(l)),lines.join(' / '));
    assert.ok(lines.some(l=>l.startsWith('fixture-standard:')&&!l.includes('ran out of room')),lines.join(' / '));
    assert.ok(s.warned.some(m=>/batch ran out of room: model=fixture-reasoner finish_reason=length max_output_tokens=12000 reasoning_tokens=11000/.test(m))||
      (await p.evaluate(()=>localStorage.getItem('aha-diagnostics-log')??'')).includes('batch ran out of room: model=fixture-reasoner'),'logged explicitly per model');
    assert.deepEqual(s.pageErrors,[]);await s.ctx.close();
  }
  {
    // ---- A session signed in before this device gave AI permission (an earlier build, or a reinstall that kept the
    // keychain): progress loads, but nothing is sent until the account holder allows AI in Settings, never in the loop.
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{Object.assign(window.__ahaAI,{enforced:true,holdAfter:1,noConsent:true});});
    const p=await ctx.newPage();const pErrors=[];p.on('pageerror',e=>pErrors.push(e.message));
    const ai=()=>p.evaluate(()=>({grants:window.__ahaAI.grants,starts:window.__ahaAI.starts.length,signIns:window.__ahaAI.signIns?.length??0}));
    await p.goto(base);
    await p.getByRole('button',{name:'Let’s begin',exact:true}).click();
    await p.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity?.source),'local','local practice while AI is paused');
    assert.deepEqual(await ai(),{grants:0,starts:0,signIns:0},'no Free2Z AI call, grant check or sign-in without permission');
    assert.equal(await p.locator('.consent-step').count(),0,'the step never appears in the learning loop');
    await p.locator('.status-dot').click();await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();
    await p.getByText('AI lessons are paused until the account holder allows them.',{exact:true}).waitFor();
    assert.equal(await p.getByRole('button',{name:'Refresh connection',exact:true}).count(),0,'nothing to refresh while paused');
    await p.getByRole('button',{name:'Allow AI lessons',exact:true}).click();
    await p.getByLabel('Your birth year',{exact:true}).fill('1979');
    await p.getByRole('button',{name:'Allow',exact:true}).click();
    await p.locator('.connection-pill').filter({hasText:/^AI ready$/}).waitFor();
    const after=await ai();
    assert.ok(after.grants>=1&&after.signIns===0,'AI resumes on the existing session, with no new sign-in');
    assert.ok((await p.evaluate(()=>window.__ahaFixture.read().journals['aha-ai-consent'])).grantedAt,'permission recorded on this device');
    // Kept on this device: a relaunch goes straight to AI.
    await p.reload();
    await p.waitForFunction(()=>window.__ahaAI.grants>=1);
    assert.equal(await p.locator('.consent-step').count(),0);
    assert.deepEqual(pErrors,[]);await ctx.close();
  }
  {
    // ---- A report flagged on a session signed in before this device gave AI permission: the restored AI activity is
    // set aside at once, but its report waits on the device, and so does one an earlier build queued with its call id.
    // Nothing reaches Free2Z until AI lessons are allowed; then each report goes exactly once.
    const ctx=await browser.newContext({viewport:{width:1000,height:900}});
    await ctx.addInitScript(fixture,batchFixtures);
    const [f0]=batchFixtures;
    const op='f1a99ed0-0000-4000-8000-000000000001',earlierCall='1f1e2d3c-4b5a-4968-8776-655443322111';
    const earlier={id:'earlier-report',activityId:'e0000000-0000-4000-8000-000000000001:0',specId:'earlier-spec',operationId:'e0000000-0000-4000-8000-000000000001',
      callId:earlierCall,reason:'incorrect',createdAt:'2026-10-05T13:30:00.000Z'};
    const seeded={profiles:[{id:'explorer',name:'Explorer',grade:3,createdAt:'2026-10-05T13:00:00.000Z'}],
      sessions:{explorer:{id:'flag-session',updatedAt:'2026-10-05T13:54:15.560Z',data:{activity:null,hintsUsed:0,completed:5,sessionId:'flag-session',
        aiActivity:{activityId:`${op}:0`,operationId:op,spec:f0},aiQueue:[]}}},
      activities:{},attempts:{},disputes:{},snapshots:{},
      journals:{'aha-ai-reports':{version:1,reports:[earlier]},'aha-billing-v1':{version:2,operations:[
        {id:op,key:'k-flag',subject:'test-subject',generation:'1',createdAt:'2026-10-05T13:24:24.322Z',state:'finalized',callId:FIXTURE_CALL,
          text:JSON.stringify({rationale:'TEST fixture batch',activities:[f0]}),
          request:{model:'fixture-model',messages:[{role:'system',content:[{type:'text',text:'TEST system'}]},{role:'user',content:[{type:'text',text:'TEST user'}]}],maxOutputTokens:'2600'},
          charge:{state:'charged',charged2z:'1',receiptId:'r-flag'},
          context:{kind:'activities',profileId:'explorer',allowedSkillIds:[...f0.skillIds]},answerComplete:true,consumed:true},
      ]}}};
    await ctx.addInitScript(db=>{
      if(!localStorage.getItem('aha-controller-test-fixture'))localStorage.setItem('aha-controller-test-fixture',JSON.stringify(db));
      Object.assign(window.__ahaAI,{enforced:true,holdAfter:0,noConsent:true});
    },seeded);
    const p=await ctx.newPage();const pErrors=[];p.on('pageerror',e=>pErrors.push(e.message));
    const reportCalls=()=>p.evaluate(()=>window.__ahaAI.reportCalls?.length??0);
    const box=()=>p.evaluate(()=>window.__ahaFixture.read().journals['aha-ai-reports']);
    const diag=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]'));
    await p.goto(base);
    await p.getByRole('button',{name:'Continue',exact:true}).click();
    await p.locator('.focus-stage.is-spec .aha-activity').waitFor();
    assert.equal(await p.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.aiActivity?.activityId),`${op}:0`,'the restored AI activity is on screen');
    await p.getByRole('button',{name:'Report',exact:true}).click();
    await p.getByRole('button',{name:'Unsafe',exact:true}).click();
    await p.waitForFunction(id=>Object.values(window.__ahaFixture.read().disputes).flat().some(d=>d.activityId===id),`${op}:0`);
    // The outbox flush that the flag starts has run (whatever it did) before anything is checked.
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem('aha-diagnostics-log')||'[]').some(e=>e.source==='ai-report'&&/^outbox: |until AI lessons are allowed/.test(e.message)));
    assert.equal(await reportCalls(),0,'no report leaves the device without AI permission');
    assert.ok((await diag()).some(e=>e.source==='ai-report'&&/2 report\(s\) wait on this device until AI lessons are allowed/.test(e.message)),'the wait is logged');
    const reports=(await box()).reports;
    assert.deepEqual(reports.map(r=>[r.activityId,r.reason,r.sentAt,r.refused]),[[earlier.activityId,'incorrect',undefined,undefined],[`${op}:0`,'unsafe',undefined,undefined]],'both wait in the outbox');
    assert.notEqual(await p.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.aiActivity?.activityId),`${op}:0`,'set aside at once');
    assert.equal(await p.getByRole('alert').count(),0,'a waiting report is never an alert to the learner');
    // The account holder allows AI lessons in Settings: the connect that follows sends the waiting report, once.
    await p.locator('.status-dot').click();await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();
    await p.getByRole('button',{name:'Allow AI lessons',exact:true}).click();
    await p.getByLabel('Your birth year',{exact:true}).fill('1979');
    await p.getByRole('button',{name:'Allow',exact:true}).click();
    await p.waitForFunction(()=>window.__ahaAI.reportCalls?.length===2);
    await p.waitForFunction(()=>window.__ahaFixture.read().journals['aha-ai-reports'].reports.every(r=>r.sentAt));
    assert.deepEqual(await p.evaluate(()=>window.__ahaAI.reportCalls),[{callId:earlierCall,reason:'incorrect',subject:'test-subject'},{callId:FIXTURE_CALL,reason:'unsafe',subject:'test-subject'}],
      'oldest first, each with its call id and reason, never a detail');
    await p.getByRole('button',{name:'Refresh connection',exact:true}).click();
    await p.locator('.connection-pill').filter({hasText:/^AI ready$/}).waitFor();
    assert.equal(await reportCalls(),2,'each report sent exactly once');
    assert.deepEqual(pErrors,[]);await ctx.close();
  }
  {
    // Signing out never resets a lock: a year that did not pass on a paused session keeps Connect locked after sign-out.
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.addInitScript(fixture,batchFixtures);
    await ctx.addInitScript(()=>{window.__ahaAI.noConsent=true;});
    const p=await ctx.newPage();const pErrors=[];p.on('pageerror',e=>pErrors.push(e.message));
    await p.goto(base);
    await p.getByRole('button',{name:'Settings',exact:true}).click();
    await p.getByRole('button',{name:'Allow AI lessons',exact:true}).click();
    await p.getByLabel('Your birth year',{exact:true}).fill('2016');
    await p.getByRole('button',{name:'Allow',exact:true}).click();
    await p.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    await p.getByRole('button',{name:'OK',exact:true}).click();
    await p.getByRole('button',{name:'Sign out',exact:true}).click();
    const connect=p.getByRole('button',{name:'Connect Free2Z',exact:false});
    await connect.waitFor();
    assert.ok((await p.evaluate(()=>window.__ahaFixture.read().journals['aha-ai-consent'])).lockedUntil,'the lock survives sign-out');
    await connect.click();
    await p.getByText('This is for the Free2Z account holder.',{exact:true}).waitFor();
    assert.equal(await p.getByLabel('Your birth year',{exact:true}).count(),0);
    assert.equal(await p.evaluate(()=>window.__ahaAI.signIns?.length??0),0);
    assert.deepEqual(pErrors,[]);await ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log('AI controller fixture passed: the adult step before every Free2Z exit (Connect, Use a different account, Manage, Delete; neutral birth year, nothing pre-filled, a pass remembered for a few minutes, a day-long lock on every exit that keeps AI already allowed) and the one-time AI permission (re-asked after sign-out, a paused pre-permission session resumed from Settings, a report flagged while paused kept on the device and sent once after Allow), the SDK 0.3.0 account surfaces (the Free2Z username in Settings, Use a different account with prompt=login landing on another account with its own data, a closed switch keeping the account, Manage and Delete opened by the plugin with no URL from the webview), the report outbox (a reason and the call id, never a detail; a 429 waits out Retry-After and sends once on the next connect; never across accounts), signed-in local-practice fallback with backoff, enforced grant, native SDK stream, Stop during preparation, Retry-After, AI activity batches (TEST fixture specs) rendered, answered correct/incorrect and recorded as ai-spec evidence, background prefetch, malformed-batch salvage, force-reload mid-queue without a new paid call, empty-queue local fallback, original-key batch recovery run by Refresh connection and post-fallback curiosity recovery, automatic same-key receipt recovery after a restart mid-batch (launch attempt, a calm settling state instead of AI ready, no new paid call while unsettled, background retry, resume, one charge, AI resuming with no manual tap), crash-safe completed-batch delivery, quiet sign-in cancel (user_cancelled, browser_error fallback) with Connect-only disconnected settings, a specific browser_unavailable message, logged unknown sign-in codes, the optional 100 2Z/month sign-in suggestion, budget-optional admission (no budget, a monthly budget shown read-only with its remainder, platform_disabled, insufficient balance (with the required 2Z) and a 403 budget refusal (with the Free2Z account link) all falling back calmly to local practice), Try something harder keeping a paid AI activity (queued harder one shown without a new call, otherwise the next queued one or a local task; the skipped one goes to the back, never the same problem), flagging an AI spec (set aside, never restored), structured output (response_format with the grammar-free prompt when the model advertises it, prompt-only otherwise, zero-charge fallback after a refusal at the estimate or the send), and a restart over an older build’s state (v2 journal, restored queue refilled at launch, a missed activity returning later for spaced practice, a small first batch on an empty bank then background refills of the problem bank, a bounded wait then one logged local task while a batch is on its way, AI resuming when it lands), and Stop inside the estimate of a tap-started batch never paying, and the learner-chosen model (three fake models: Best (auto) within the per-activity ceiling, a persisted manual pick honoured above it, model attribution on queued activities, activity records and attempts, the status sheet, per-model stats in Settings and the problem report, and a missing choice using auto while the stored choice is kept), and reasoning models (never Best (auto); labelled with a reasoning-headroom estimate; a manual pick sends and journals a 12k strict budget; a set that ran out of room is logged and counted per model). No live service or charge.');
} finally {
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
