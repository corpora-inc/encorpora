/**
 * Real-device smoke for the installed AHA debug build (Android, over adb).
 *
 * Attaches Playwright to the app's own WebView through CDP, drives a short
 * local-practice journey, force-stops and relaunches the native app, and checks
 * the displayed activity resumes. Screenshots are taken with `adb screencap`,
 * so they show real device pixels including system bars and safe areas.
 *
 * This is device evidence for local behavior only. It never signs in, never
 * calls Free2Z and is not live-service acceptance.
 *
 *   node scripts/device-smoke.mjs [--serial SERIAL] [--out dir] [--keep-data]
 *
 * Works the same against a physical phone or an emulator (`emulator -avd ...`).
 * Install a debug build first (`npx tauri android build --debug --apk`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const PKG = 'inc.corpora.aha';
const ADB = process.env.ADB || `${process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`}/platform-tools/adb`;
const serial = opt('--serial') || process.env.ANDROID_SERIAL;
const out = path.resolve(opt('--out') || `device-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const port = Number(opt('--port') || 9333);
mkdirSync(out, { recursive: true });

const adb = (...a) => execFileSync(ADB, [...(serial ? ['-s', serial] : []), ...a], { encoding: 'buffer', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const adbText = (...a) => adb(...a).toString('utf8').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { startedAt: new Date().toISOString(), device: {}, steps: [], errors: [], ok: false };
let shot = 0;

async function screenshot(label) {
  const file = path.join(out, `${String(++shot).padStart(2, '0')}-${label}.png`);
  writeFileSync(file, adb('exec-out', 'screencap', '-p'));
  report.steps.push({ step: label, screenshot: path.basename(file), at: new Date().toISOString() });
  console.log(`  📸 ${path.basename(file)}`);
}

async function launch() {
  adbText('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  for (let i = 0; i < 60; i++) {
    const pid = adbText('shell', 'pidof', PKG).split(/\s+/)[0];
    if (pid) {
      const sockets = adbText('shell', 'cat', '/proc/net/unix');
      if (sockets.includes(`webview_devtools_remote_${pid}`)) return pid;
    }
    await sleep(500);
  }
  throw new Error('App did not expose a debuggable WebView (is this a debug build?)');
}

async function attach(pid) {
  try { adbText('forward', '--remove', `tcp:${port}`); } catch {}
  adbText('forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`);
  let browser;
  for (let i = 0; i < 20 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { await sleep(500); }
  }
  if (!browser) throw new Error('Could not attach to WebView over CDP');
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('about:'));
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('No app page in WebView');
  page.on('pageerror', e => report.errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(`console: ${m.text()}`); });
  await page.waitForLoadState('domcontentloaded');
  return { browser, page };
}

async function metrics(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const overflowX = document.documentElement.scrollWidth > vw + 1;
    const small = [...document.querySelectorAll('button, [role=button], input, select, textarea, a[href]')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); })
      .map(el => `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}`);
    const clipped = [...document.querySelectorAll('body *')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); })
      .slice(0, 10).map(el => el.className || el.tagName);
    // #869 focus mode: the loop fits one screen, and chrome text outside the problem stays minimal.
    const words = document.body.innerText.trim().split(/\s+/).filter(Boolean).length;
    const chrome = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      const el = n.parentElement;
      if (!el || el.closest('[data-stage-content],dialog:not([open]),.sr-only,.ax-visually-hidden,.katex-mathml') || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      chrome.push(...n.textContent.trim().split(/\s+/).filter(Boolean));
    }
    return { viewport: `${vw}x${vh}`, dpr: devicePixelRatio, scrollHeight: document.documentElement.scrollHeight, pageScrolls: document.documentElement.scrollHeight > vh, words, chromeWords: chrome.length, overflowX, smallTapTargets: small.slice(0, 20), clipped };
  });
}

try {
  report.device = {
    model: adbText('shell', 'getprop', 'ro.product.model'),
    android: adbText('shell', 'getprop', 'ro.build.version.release'),
    app: (adbText('shell', 'dumpsys', 'package', PKG).match(/versionName=\S+|versionCode=\d+/g) || []).join(' '),
  };
  console.log('Device', report.device);
  if (!args.includes('--keep-data')) { adbText('shell', 'pm', 'clear', PKG); console.log('  cleared app data (fresh install state)'); }
  adbText('shell', 'am', 'force-stop', PKG);

  let pid = await launch();
  let { browser, page } = await attach(pid);
  await sleep(1500);
  await screenshot('launch');
  report.launchMetrics = await metrics(page);

  // The studio home opens first; one tap enters the focus loop.
  await page.getByRole('button', { name: /^(Let’s begin|Continue|Keep exploring)$/ }).click();
  const answerBox = page.getByLabel('Your answer', { exact: true });
  await page.getByRole('button', { name: 'Check', exact: true }).waitFor({ timeout: 15000 });
  await sleep(500);
  await screenshot('first-activity');
  report.activityMetrics = await metrics(page);
  const prompt1 = (await page.locator('.stage-prompt').innerText()).trim();
  report.firstPrompt = prompt1;

  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await page.locator('.help-panel').waitFor();
  report.hintMetrics = await metrics(page);
  await sleep(300);
  await screenshot('hint');

  if (await page.locator('.answer-symbols').count()) await page.getByRole('button', { name: 'Less than', exact: true }).click();
  else await answerBox.fill('987654');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await sleep(800);
  await screenshot('wrong-answer-feedback');
  report.feedbackMetrics = await metrics(page);
  report.feedbackText = (await page.locator('main').innerText()).slice(0, 600);

  await browser.close().catch(() => {});
  adbText('shell', 'am', 'force-stop', PKG);
  await sleep(1000);
  pid = await launch();
  ({ browser, page } = await attach(pid));
  await sleep(2000);
  await screenshot('relaunch');
  await page.getByRole('button', { name: /^(Let’s begin|Continue|Keep exploring)$/ }).click();
  await page.locator('.stage-prompt').waitFor({ timeout: 15000 });
  const prompt2 = (await page.locator('.stage-prompt').innerText()).trim();
  report.resumedPrompt = prompt2;
  report.resumedSameActivity = prompt1 === prompt2;
  await screenshot('resumed');

  await page.getByRole('button', { name: 'Home', exact: true }).click().catch(e => report.errors.push(`home: ${e.message}`));
  await sleep(400);
  await screenshot('home');
  report.homeMetrics = await metrics(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click().catch(e => report.errors.push(`settings: ${e.message}`));
  await sleep(600);
  await screenshot('settings');
  await browser.close().catch(() => {});
  report.ok = report.errors.length === 0;
} catch (e) {
  report.errors.push(`fatal: ${e.stack || e.message}`);
  try { await screenshot('failure'); } catch {}
} finally {
  try { writeFileSync(path.join(out, 'logcat.txt'), adb('logcat', '-d', '-t', '400')); } catch {}
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, resumedSameActivity: report.resumedSameActivity, activity: report.activityMetrics, errors: report.errors, out }, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
