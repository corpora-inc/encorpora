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
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','1435','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:false,paidTestingReady:false,externalCheckoutEnabled:false,reason:'Test fixture: no AI service'};
    if(command!=='local_repository')throw new Error(`Unexpected test IPC: ${command}`);
    const r=args.request;if(r.accountId!=='local-device')throw new Error('Unexpected test account');
    const db=read(),id=r.profileId;let result;
    switch(r.operation){
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
try{
  let ready=false;
  for(let i=0;i<100;i++){
    if(vite.exitCode!==null)throw new Error(`Vite exited: ${output}`);
    try{if(stripVTControlCharacters(output).includes('http://127.0.0.1:1435')&&(await fetch('http://127.0.0.1:1435')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,`Vite startup: ${output}`);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addInitScript(fixture);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const db=()=>page.evaluate(()=>window.__ahaFixture.read());
  const active=async()=>Object.values((await db()).sessions)[0]?.data.activity;
  const records=async()=>Object.values((await db()).attempts).flat();
  const begin=async()=>{await page.getByRole('button',{name:'Let’s begin',exact:true}).click();await page.getByLabel('Your answer',{exact:true}).waitFor();return active();};
  const answer=async value=>{await page.getByLabel('Your answer',{exact:true}).fill(value);await page.getByRole('button',{name:'Check my answer',exact:true}).click();};
  await page.goto('http://127.0.0.1:1435');const first=await begin();assert.ok(first);
  const shown=await page.locator('.activity-prompt').innerText();
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Try something harder',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  assert.equal(await page.locator('.activity-prompt').innerText(),shown,'failed presentation save keeps displayed task');
  assert.equal((await active()).id,first.id,'failed save keeps durable task');
  await answer(expectedAnswer(first.task));await page.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
  let attempts=await records();assert.equal(attempts.length,1);assert.equal(attempts[0].activityId,first.id);assert.equal(attempts[0].data.correct,true,'grading uses displayed task');
  assert.equal(await page.getByLabel('Your answer',{exact:true}).isDisabled(),true);
  await page.locator('.answer-area').locator('..').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal((await records()).length,1,'duplicate form event cannot add evidence');
  await page.reload();await page.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.equal((await records()).length,1,'durable evidence survives controller reload');assert.equal(await page.locator('.activity-prompt').count(),0,'answered item never resumes');
  const hinted=await begin();await page.getByRole('button',{name:'A little hint',exact:true}).click();await page.locator('.hint-box').waitFor();
  assert.equal(Object.values((await db()).sessions)[0].data.hintsUsed,1,'assistance saved before display');
  await answer(expectedAnswer(hinted.task));await page.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
  attempts=await records();assert.equal(attempts.length,2);assert.equal(attempts[1].data.hintsUsed,1);assert.equal(attempts[1].data.independent,false);
  await page.getByRole('button',{name:'Next discovery',exact:true}).click();await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();const disputed=await active();
  // Simulate a crash boundary: quarantine commits, but clearing the saved presentation fails.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Something seems off',exact:true}).click();await page.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  assert.equal(Object.values((await db()).disputes).flat()[0].activityId,disputed.id);
  assert.equal((await active()).id,disputed.id,'fixture preserves stale pre-dispute presentation');
  await page.reload();await page.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.equal(await page.locator('.activity-prompt').count(),0,'disputed unanswered item never resumes');assert.equal((await records()).length,2);
  const final=await begin();assert.notEqual(final.id,disputed.id);
  const expected=expectedAnswer(final.task);const wrong=['<','>','='].includes(expected)?(expected==='<'?'>':'<'):(expected==='0'?'1':'0');
  await answer(wrong);await page.getByRole('button',{name:'Try a fresh one',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Your answer',{exact:true}).isDisabled(),true,'wrong first answer also locks evidence');
  attempts=await records();assert.equal(attempts.length,3);assert.equal(attempts[2].data.correct,false);
  // A validated next activity is cached across presentation write failures.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Try a fresh one',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  const pendingId=Object.values((await db()).activities).flat().at(-1).id;
  await page.getByRole('button',{name:'Try a fresh one',exact:true}).click();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal((await active()).id,pendingId,'retry saves the same generated activity without regenerating');
  assert.deepEqual(errors,[],'browser errors');
  console.log('Controller browser regressions passed: disk-full display/grading consistency, first-attempt lock, evidence reload, hint assistance, dispute quarantine. Explicit test IPC fixture; not native acceptance.');
}finally{
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
