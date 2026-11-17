/** Send one command to a running driver.ts and print its result.
 *   send.ts DIR 'js code'   (or send.ts DIR - < file.js) */
import { readFile, writeFile, readdir, access } from "node:fs/promises";
const [dir, codeArg] = process.argv.slice(2);
const code = codeArg === "-" ? await readFile(0 as any, "utf8") : codeArg;
const before = (await readdir(dir)).filter((f) => /^out-\d+\.json$/.test(f)).length;
await writeFile(`${dir}/cmd.js.tmp`, code);
const { rename } = await import("node:fs/promises");
await rename(`${dir}/cmd.js.tmp`, `${dir}/cmd.js`);
const target = code.trim() === "__stop__" ? `${dir}/answers.json` : `${dir}/out-${before + 1}.json`;
const deadline = Date.now() + 10 * 60 * 1000;
for (;;) {
  try {
    await access(target);
    await new Promise((r) => setTimeout(r, 100));
    if (code.trim() === "__stop__") {
      console.log("driver stopped");
      break;
    }
    const out = JSON.parse(await readFile(target, "utf8"));
    console.log(JSON.stringify(out, null, 1));
    console.log(`screenshot: ${dir}/shot-${before + 1}.png`);
    break;
  } catch {
    if (Date.now() > deadline) {
      console.log("timed out waiting for the driver");
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
