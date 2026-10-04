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
const {expectedAnswer,answerCanBeNegative}=await import(pathToFileURL(path.join(root,'src/learning/tasks.ts')).href);
const {getSkill}=await import(pathToFileURL(path.join(root,'src/learning/curriculum.ts')).href);
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','1435','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:false,paidTestingReady:false,externalCheckoutEnabled:false,reason:'Test fixture: no AI service'};
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
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
  assert.equal(await page.locator('.feedback').evaluate(el=>document.activeElement===el),true,'answer feedback receives keyboard focus');
  attempts=await records();assert.equal(attempts.length,3);assert.equal(attempts[2].data.correct,false);
  // A validated next activity is cached across presentation write failures.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Try a fresh one',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  const pendingId=Object.values((await db()).activities).flat().at(-1).id;
  await page.getByRole('button',{name:'Try a fresh one',exact:true}).click();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal((await active()).id,pendingId,'retry saves the same generated activity without regenerating');
  // Quarantine removes the task, but its reassurance and next action must remain visible.
  await page.getByRole('button',{name:'Something seems off',exact:true}).click();
  await page.getByRole('button',{name:'Try another example',exact:true}).waitFor();
  assert.match(await page.locator('.welcome-state .feedback').innerText(),/different example/);
  assert.match(await page.locator('.welcome-state .hint-box').innerText(),/won’t count/);
  assert.equal(await page.locator('.activity-prompt').count(),0);
  await page.getByRole('button',{name:'Try another example',exact:true}).click();
  await page.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  assert.equal(await page.locator('.activity-card h2').evaluate(el=>document.activeElement===el),true,'new task heading receives keyboard focus');
  // Account/storage errors must be readable inside the modal that initiated them.
  await page.getByRole('button',{name:'Open learner and grown-up settings',exact:true}).click();
  await page.getByLabel('Type grown-up to continue',{exact:true}).fill('grown-up');
  await page.getByRole('button',{name:'Open grown-up settings',exact:true}).click();
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('alert').isVisible(),true,'settings error is not hidden behind modal');
  await page.getByRole('button',{name:'Back to learning',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'compact layout has no horizontal overflow');
  // Phone layout at the S26's CSS viewport (#856): every visible control keeps a 44×44 hit area,
  // and the sign key appears only where the task's answer domain can be negative.
  const phone=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});await phone.addInitScript(fixture);
  const mobile=await phone.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  const smallTargets=()=>mobile.evaluate(()=>[...document.querySelectorAll('button, a[href], input:not([type=radio]), select, textarea, [role=button], label:has(> input[type=radio])')]
    .filter(el=>{const r=el.getBoundingClientRect();return el.checkVisibility()&&r.width>1&&r.height>1&&r.bottom+scrollY>0;})
    .filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;})
    .map(el=>`${(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,40)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`));
  await mobile.goto('http://127.0.0.1:1435');await mobile.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.deepEqual(await smallTargets(),[],'phone welcome tap targets are at least 44×44');
  await mobile.getByRole('button',{name:'Let’s begin',exact:true}).click();await mobile.getByLabel('Your answer',{exact:true}).waitFor();
  assert.deepEqual(await smallTargets(),[],'phone activity tap targets are at least 44×44');
  const phoneActive=name=>mobile.evaluate(name=>{const db=window.__ahaFixture.read();const id=name?db.profiles.find(p=>p.name===name)?.id:Object.keys(db.sessions)[0];return db.sessions[id]?.data?.activity;},name);
  const signKeyMatches=async name=>{const t=await phoneActive(name);const signed=answerCanBeNegative(t.task,getSkill(t.skillId));
    assert.equal(await mobile.getByRole('button',{name:'Change positive or negative sign',exact:true}).count(),signed?1:0,`sign key follows the answer domain (${t.skillId})`);return signed;};
  const phoneTask=await phoneActive();
  assert.equal(await signKeyMatches(),false,'a fresh grade-3 start never offers a sign key');
  await mobile.getByRole('button',{name:'A little hint',exact:true}).click();await mobile.locator('.hint-box').waitFor();
  await mobile.getByLabel('Your answer',{exact:true}).fill(expectedAnswer(phoneTask.task));await mobile.getByRole('button',{name:'Check my answer',exact:true}).click();
  await mobile.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
  assert.deepEqual(await smallTargets(),[],'phone hint and feedback tap targets are at least 44×44');
  await mobile.getByRole('button',{name:'Open learner and grown-up settings',exact:true}).click();await mobile.getByRole('dialog').waitFor();
  assert.deepEqual(await smallTargets(),[],'phone settings tap targets are at least 44×44');
  await mobile.getByLabel('Type grown-up to continue',{exact:true}).fill('grown-up');await mobile.getByRole('button',{name:'Open grown-up settings',exact:true}).click();
  await mobile.getByRole('button',{name:'Export backup',exact:true}).waitFor();
  assert.deepEqual(await smallTargets(),[],'phone grown-up settings tap targets are at least 44×44');
  assert.equal(await mobile.evaluate(()=>[...document.styleSheets].flatMap(s=>[...s.cssRules]).some(r=>r.selectorText==='.aha-studio::before'&&r.style.position==='fixed'&&r.style.top==='0px'&&/env\(safe-area-inset-top\)/.test(r.style.height))),true,'status-bar backdrop is fixed and sized by the top safe-area inset');
  // A grade-8 learner reaches tasks whose answers can be negative; the key must appear there.
  await mobile.getByLabel('Starting point (we’ll adjust from here)',{exact:true}).selectOption('8');
  await mobile.getByLabel('Nickname for a new learner',{exact:true}).fill('Eight');await mobile.getByLabel('Nickname for a new learner',{exact:true}).press('Enter');
  await mobile.getByRole('dialog').waitFor({state:'detached'}).catch(()=>{});
  if(await mobile.getByRole('dialog').count())await mobile.getByRole('button',{name:'Back to learning',exact:true}).click();
  const start=mobile.getByRole('button',{name:'Let’s begin',exact:true});if(await start.count())await start.click();
  let sawSigned=false;
  for(let i=0;i<10&&!sawSigned;i++){
    await mobile.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
    sawSigned=await signKeyMatches('Eight');
    if(!sawSigned){const before=(await phoneActive('Eight')).id;await mobile.getByRole('button',{name:'Try something harder',exact:true}).click();await mobile.waitForFunction(id=>{const db=window.__ahaFixture.read(),a=db.sessions[db.profiles.find(p=>p.name==='Eight').id]?.data?.activity;return a&&a.id!==id;},before);}
  }
  assert.equal(sawSigned,true,'a grade-8 learner sees the sign key on a task that can be negative');
  await phone.close();
  assert.deepEqual(errors,[],'browser errors');
  console.log('Controller browser regressions passed: disk-full display/grading consistency, first-attempt lock, evidence reload, hint assistance, dispute quarantine/continuation, focus, modal errors, compact layout. Explicit test IPC fixture; not native acceptance.');
}finally{
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
