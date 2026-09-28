/** Explicit TEST-ONLY browser IPC fixture. Not native SQLite/device/service acceptance. */
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
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','1436','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  const streams=new Map();
  window.__ahaAI={signedIn:true,enforced:false,starts:[],delayModels:false,releaseModels:null,blockEstimate:false};
  const ai=window.__ahaAI;
  const session=()=>({signedIn:ai.signedIn,subject:ai.signedIn?'test-subject':null,grantedScopes:['ai:invoke','balance:read'],persistence:'persistent',generation:'1'});
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:true,clientId:'test-client',paidTestingReady:false,externalCheckoutEnabled:false,reason:'Explicit TEST SDK fixture'};
    if(command==='plugin:f2z|session'||command==='plugin:f2z|sign_in')return session();
    if(command==='plugin:f2z|sign_out'){if(ai.failSignOut)throw {code:'storage_error'};ai.signedIn=false;return {revoked:true,generation:'2'};}
    if(command==='plugin:f2z|balance')return {available_milli_2z:'100000',held_milli_2z:'0',balance_milli_2z:'100000',debt_milli_2z:'0',as_of:new Date().toISOString()};
    if(command==='plugin:f2z|grant')return {sub:'test-subject',client_id:'test-client',account_epoch:'0',grant_generation:'1',scopes:['ai:invoke'],spend_cap_2z:'100',cap_period:'total',enforced:ai.enforced,as_of:new Date().toISOString()};
    if(command==='plugin:f2z|models'){
      if(ai.delayModels)await new Promise(resolve=>{ai.releaseModels=resolve;});
      return {catalog_version:'1',models:[{id:'fixture-model',max_output_tokens:'4096'}]};
    }
    if(command==='plugin:f2z|estimate'){
      if(ai.blockEstimate)throw {code:'unavailable',retryAfterSeconds:'10'};
      return {model:'fixture-model',input_tokens:'500',max_output_tokens:'1800',hold_2z:'1',cap_remaining_milli_2z:'99000'};
    }
    if(command==='plugin:f2z|start_chat'){
      ai.starts.push(args.operation);
      if(ai.failOpening){ai.failOpening=false;throw {code:'unavailable',retryAfterSeconds:'5'};}
      const context=JSON.parse(args.request.messages[1].content[0].text);
      const selected=context.candidates?.[0];
      const text=selected?JSON.stringify({version:1,id:'test-generated',skillId:selected.id,mode:selected.reason==='due-review'?'review':'concept',task:selected.taskExample,hint:'Think about the place values.'}):'You can use this idea to share ingredients fairly.';
      streams.set(args.operation.operationId,[
        {type:'meta',call_id:'fixture-call',model:'fixture-model',hold_2z:'1'},
        {type:'delta',text},
        {type:'done',finish_reason:'stop',settlement:'settled',charged_2z:'1',receipt_id:'fixture-receipt'},
      ]);
      return {operationId:args.operation.operationId,callId:'fixture-call'};
    }
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
      case 'saveActivity':(db.activities[id]??=[]).push(r.data);break;
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
  const context=await browser.newContext({viewport:{width:1000,height:900}});await context.addInitScript(fixture);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const settings=async()=>{await page.getByRole('button',{name:'Open learner and grown-up settings'}).click();await page.getByLabel('Type grown-up to continue').fill('grown-up');await page.getByRole('button',{name:'Open grown-up settings',exact:true}).click();};
  await page.goto('http://127.0.0.1:1436');
  await page.getByRole('alert').filter({hasText:'enforced total spending limit'}).waitFor();
  await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'enforced total spending limit'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'unenforced grant never starts chat');
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  await settings();await page.getByRole('button',{name:'Refresh connection',exact:true}).click();
  await page.getByText('AI ready',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.delayModels=true;});
  await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
  await page.waitForFunction(()=>window.__ahaAI.releaseModels!==null);
  await page.getByRole('button',{name:'Stop AI request',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.delayModels=false;window.__ahaAI.releaseModels();});
  await page.getByRole('alert').filter({hasText:'Stopped before starting'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'Stop during preparation never starts a paid call');
  await page.evaluate(()=>{window.__ahaAI.failAck=true;});
  await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),1,'real SDK native transport consumed synthetic stream');
  assert.equal(await page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity.source),'ai');
  await page.getByRole('alert').filter({hasText:'TEST acknowledgement write failed'}).waitFor();
  await page.getByRole('button',{name:'A little hint',exact:true}).click();await page.locator('.hint-box').waitFor();
  await page.reload();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.hintsUsed),1,'restoring an already displayed unacknowledged task keeps its assistance');
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  const active=await page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity);
  await page.getByLabel('Your answer',{exact:true}).fill(expectedAnswer(active.task));
  await page.getByRole('button',{name:'Check my answer',exact:true}).click();await page.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat()[0].data.independent),false,'restored hinted answer never earns independent evidence');
  await page.evaluate(()=>{window.__ahaAI.failOpening=true;});
  await page.getByRole('button',{name:'Next discovery',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Wait at least 5 seconds'}).waitFor();
  await settings();
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
  await page.getByRole('button',{name:'Recover original request',exact:true}).click();
  await page.getByText('Recovered lesson is ready.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  const after=await page.evaluate(()=>window.__ahaAI.starts);
  assert.deepEqual(after.at(-1),starts.at(-1),'recovery keeps both original request identifiers');
  // A completed paid response must survive a crash before its presentation save.
  const recovered=await page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity);
  await page.getByLabel('Your answer',{exact:true}).fill(expectedAnswer(recovered.task));
  await page.getByRole('button',{name:'Check my answer',exact:true}).click();
  await page.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Next discovery',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  const undelivered=await page.evaluate(()=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.answerComplete&&!o.consumed));
  assert.ok(undelivered,'paid completion remains durable before UI acknowledgement');
  await page.reload();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'restart delivers saved answer without another model invocation');
  assert.equal(await page.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.activity.id),undelivered.id);
  await page.waitForFunction(id=>window.__ahaFixture.read().journals['aha-billing-v1'].operations.find(o=>o.id===id).consumed===true,undelivered.id);
  await page.evaluate(()=>{window.__ahaAI.enforced=true;});
  await page.getByRole('button',{name:'Ask a curiosity question',exact:true}).click();
  await page.getByRole('button',{name:'Where would I use this in real life? ↗',exact:true}).click();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  await page.waitForFunction(()=>Object.values(window.__ahaFixture.read().sessions)[0].data.curiosity?.answer);
  await page.reload();
  await page.getByText('You can use this idea to share ingredients fairly.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__ahaAI.starts.length),0,'paid curiosity restores without a new call');
  await page.getByRole('button',{name:'Back to our discovery',exact:true}).click();
  await page.evaluate(()=>{window.__ahaAI.failSignOut=true;});
  await settings();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).count(),1,'failed native deletion retains connected account UI');
  assert.deepEqual(errors,[]);
  console.log('AI controller fixture passed: enforced grant, native SDK stream, Stop during preparation, Retry-After, original-key lesson recovery, and crash-safe completed-answer delivery. No live service or charge.');
} finally {
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
