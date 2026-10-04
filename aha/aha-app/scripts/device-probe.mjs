// Ad-hoc device probe: attach to the running AHA debug WebView (phone or emulator) and run an action module.
// Screenshots come from `adb screencap` (real pixels incl. system bars), downscaled to 900px for review.
//   node scripts/device-probe.mjs actions.mjs   (actions.mjs: export default async ({page, shot, adb, sleep}) => {...})
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const ADB = process.env.ADB || `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const out = path.resolve(process.env.OUT || 'probe-out'); mkdirSync(out, { recursive: true });
const adb = (...a) => execFileSync(ADB, a, { encoding: 'buffer', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pid = adb('shell', 'pidof', 'inc.corpora.aha').toString().trim();
if (!pid) { adb('shell', 'monkey', '-p', 'inc.corpora.aha', '-c', 'android.intent.category.LAUNCHER', '1'); await sleep(3000); pid = adb('shell', 'pidof', 'inc.corpora.aha').toString().trim(); }
try { adb('forward', '--remove', 'tcp:9334'); } catch {}
adb('forward', 'tcp:9334', `localabstract:webview_devtools_remote_${pid}`);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9334');
const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('about:'));
page.on('console', m => console.log(`[console.${m.type()}] ${m.text()}`));
let n = 0;
const shot = async label => { const f = path.join(out, `${String(++n).padStart(2, '0')}-${label}.png`); writeFileSync(f, adb('exec-out', 'screencap', '-p')); execFileSync('sips', ['-Z', '900', f, '--out', f]); console.log('shot', f); };
const mod = await import(pathToFileURL(path.resolve(process.argv[2])).href);
try { await mod.default({ page, shot, adb, sleep }); } finally { await browser.close().catch(() => {}); }
