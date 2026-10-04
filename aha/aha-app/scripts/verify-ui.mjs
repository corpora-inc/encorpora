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
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
    if(command==='plugin:app|version')return '0.1.0-test';
    if(command==='share_report'){window.__ahaFixture.sharedReport=args.report;return true;}
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
  const context=await browser.newContext({viewport:{width:1280,height:900}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:1435'});await context.addInitScript(fixture);
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
  // #857: a first miss gets one retry with a nudge; nothing is revealed or recorded yet.
  await answer(wrong);await page.locator('.feedback').filter({hasText:'Not quite yet'}).waitFor();
  assert.equal(await page.getByLabel('Your answer',{exact:true}).isDisabled(),false,'first miss leaves one retry open');
  assert.equal(await page.locator('.feedback').evaluate(el=>document.activeElement===el),true,'answer feedback receives keyboard focus');
  assert.equal((await records()).length,2,'a pending retry adds no ledger evidence');
  let retrySession=Object.values((await db()).sessions)[0].data;
  assert.equal(retrySession.firstAnswer,wrong);assert.equal(retrySession.hintsUsed,1,'the miss is saved as assistance before the nudge');
  assert.ok(final.explanation&&!(await page.locator('.feedback').innerText()).includes(final.explanation),'nudge never shows the worked answer');
  await page.getByRole('button',{name:'Show me how it works',exact:true}).waitFor();
  // A restart resumes the same retry; it never becomes a fresh first try.
  await page.reload();await page.locator('.feedback').filter({hasText:'Not quite yet'}).waitFor();
  assert.equal((await active()).id,final.id);
  await answer(wrong);await page.getByRole('button',{name:'Try a fresh one',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Your answer',{exact:true}).isDisabled(),true,'second miss locks evidence');
  attempts=await records();assert.equal(attempts.length,3,'one attempt per activity');assert.equal(attempts[2].activityId,final.id);
  assert.equal(attempts[2].data.correct,false);assert.equal(attempts[2].data.firstAnswer,wrong);assert.equal(attempts[2].data.independent,false);
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
  // Problem report: version, connection state and scrubbed recent errors, shared as text only.
  await page.getByRole('button',{name:'Report a problem',exact:true}).click();
  const reportBox=page.getByLabel('This is what the report contains',{exact:true});
  await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(t=>t.value.includes('App version:')));
  let report=await reportBox.inputValue();
  assert.match(report,/App version: 0\.1\.0-test \(build not set\)/);
  assert.match(report,/Signed in: no\nAI ready: no/);
  assert.ok((report.match(/INFO \[app\] Started/g)||[]).length>=2,'diagnostics log survives reload');
  assert.match(report,/ERROR \[action\] .*TEST disk full/);
  assert.match(report,/ERROR \[action\] .*TEST backup destination unavailable/);
  assert.ok(!report.includes('local-device'),'no account identity in report');
  await page.getByLabel('What happened? (optional)',{exact:true}).fill('Export did nothing. Reach me at parent@example.com');
  await page.getByRole('button',{name:'Share report',exact:true}).click();
  await page.waitForFunction(()=>!!window.__ahaFixture.sharedReport);
  report=await page.evaluate(()=>window.__ahaFixture.sharedReport);
  assert.match(report,/Note:\nExport did nothing\. Reach me at \[email\]/);
  assert.match(report,/TEST disk full/);
  await page.getByRole('button',{name:'Copy report',exact:true}).click();
  await page.getByRole('button',{name:'Copied',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),report,'copied text matches the shared report');
  await page.getByRole('button',{name:'Back to learning',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'compact layout has no horizontal overflow');
  // #857: a correct retry is one assisted attempt, even when saving the retry state failed.
  const retryContext=await browser.newContext({viewport:{width:390,height:844}});await retryContext.addInitScript(fixture);
  const learner=await retryContext.newPage();learner.on('pageerror',e=>errors.push(e.message));learner.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const learnerDb=()=>learner.evaluate(()=>window.__ahaFixture.read());
  const shownTask=async()=>Object.values((await learnerDb()).sessions)[0].data.activity;
  const respond=async value=>{await learner.getByLabel('Your answer',{exact:true}).fill(value);await learner.getByRole('button',{name:'Check my answer',exact:true}).click();};
  const missFor=e=>['<','>','='].includes(e)?(e==='<'?'>':'<'):(e==='0'?'1':'0');
  await learner.goto('http://127.0.0.1:1435');await learner.getByRole('button',{name:'Let’s begin',exact:true}).click();await learner.getByLabel('Your answer',{exact:true}).waitFor();
  for(const failSave of [true,false]){
    const task=await shownTask(),expected=expectedAnswer(task.task);
    if(failSave)await learner.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
    await respond(missFor(expected));
    if(failSave)await learner.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
    else await learner.locator('.feedback').filter({hasText:'Not quite yet'}).waitFor();
    await respond(expected);await learner.getByRole('button',{name:'Next discovery',exact:true}).waitFor();
    assert.match(await learner.locator('.feedback').innerText(),/worked it through/);
    const ledger=Object.values((await learnerDb()).attempts).flat().filter(r=>r.activityId===task.id);
    assert.equal(ledger.length,1,'one attempt per activity');
    assert.equal(ledger[0].data.correct,true);assert.equal(ledger[0].data.independent,false,'a correct retry is assisted');
    assert.equal(ledger[0].data.firstAnswer,missFor(expected));assert.equal(ledger[0].data.hintsUsed,1);
    if(failSave){await learner.getByRole('button',{name:'Next discovery',exact:true}).click();await learner.getByRole('button',{name:'Check my answer',exact:true}).waitFor();}
  }
  // Leaving a pending retry (Try something harder) commits the first miss; it never disappears.
  await learner.getByRole('button',{name:'Next discovery',exact:true}).click();await learner.getByRole('button',{name:'Check my answer',exact:true}).waitFor();
  const left=await shownTask();
  await respond(missFor(expectedAnswer(left.task)));await learner.locator('.feedback').filter({hasText:'Not quite yet'}).waitFor();
  await learner.getByRole('button',{name:'Try something harder',exact:true}).click();
  await learner.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0]?.data.activity?.id!==id,left.id);
  const abandoned=Object.values((await learnerDb()).attempts).flat().filter(r=>r.activityId===left.id);
  assert.equal(abandoned.length,1,'a pending miss is recorded before the activity changes');
  assert.equal(abandoned[0].data.correct,false);assert.equal(abandoned[0].data.independent,false);assert.equal(abandoned[0].data.firstAnswer,missFor(expectedAnswer(left.task)));
  assert.equal((await learnerDb()).sessions[Object.keys((await learnerDb()).sessions)[0]].data.firstAnswer,undefined,'the next activity starts fresh');
  await retryContext.close();
  // #860: repeated misses change the approach (saved as assistance), then move away from the skill.
  const fresh=await browser.newContext({viewport:{width:390,height:844}});await fresh.addInitScript(fixture);
  const struggler=await fresh.newPage();struggler.on('pageerror',e=>errors.push(e.message));struggler.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const saved=async()=>Object.values((await struggler.evaluate(()=>window.__ahaFixture.read())).sessions)[0]?.data;
  const miss=async()=>{
    const a=(await saved()).activity,e=expectedAnswer(a.task);
    await struggler.getByLabel('Your answer',{exact:true}).fill(['<','>','='].includes(e)?(e==='<'?'>':'<'):(e==='0'?'1':'0'));
    // With the forgiving retry, a recorded miss is a wrong first answer and a wrong retry.
    await struggler.getByRole('button',{name:'Check my answer',exact:true}).click();
    await struggler.locator('.feedback').filter({hasText:'Not quite yet'}).waitFor();
    await struggler.getByRole('button',{name:'Check my answer',exact:true}).click();
    await struggler.getByRole('button',{name:'Try a fresh one',exact:true}).waitFor();return a;
  };
  const freshTask=async()=>{await struggler.getByRole('button',{name:'Try a fresh one',exact:true}).click();await struggler.getByRole('button',{name:'Check my answer',exact:true}).waitFor();};
  await struggler.goto('http://127.0.0.1:1435');await struggler.getByRole('button',{name:'Let’s begin',exact:true}).click();await struggler.getByLabel('Your answer',{exact:true}).waitFor();
  const missed=await miss();await freshTask();
  assert.equal((await miss()).skillId,missed.skillId,'one miss is retried, not stepped down');await freshTask();
  const taught=await saved();
  assert.equal(taught.activity.skillId,missed.skillId);assert.equal(taught.hintsUsed,1,'worked example saved as assistance before display');
  const example=await struggler.locator('.hint-box').innerText();
  assert.match(example,/worked out/);assert.ok(!example.includes(taught.activity.prompt),'worked example solves a different task');
  await miss();await freshTask();
  const ledger=Object.values((await struggler.evaluate(()=>window.__ahaFixture.read())).attempts).flat();
  assert.equal(ledger.length,3,'one attempt per activity');assert.equal(ledger[2].data.hintsUsed,2,'worked example plus retry nudge');assert.equal(ledger[2].data.independent,false);
  assert.notEqual((await saved()).activity.skillId,missed.skillId,'a third miss switches away from the skill');
  await fresh.close();
  assert.deepEqual(errors,[],'browser errors');
  console.log('Controller browser regressions passed: disk-full display/grading consistency, first-attempt lock, forgiving retry (restart, save failure, one ledger attempt), evidence reload, hint assistance, error-loop worked example and switch, dispute quarantine/continuation, focus, modal errors, problem report, compact layout. Explicit test IPC fixture; not native acceptance.');
}finally{
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
