import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto("http://127.0.0.1:4310");
await p.waitForTimeout(1500);
const sel = p.getByRole("combobox", { name: "Learner", exact: true });
await sel.selectOption({ label: "Maya" }).catch(() => {});
await p.waitForTimeout(800);
await p.screenshot({
  path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/h1.png",
});
await p.getByRole("button", { name: "Go", exact: true }).click();
await p.waitForTimeout(1200);
await p.screenshot({
  path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/h2.png",
});
await p.getByRole("button", { name: "Lesson", exact: true }).click();
await p.waitForTimeout(1000);
await p.screenshot({
  path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/h3.png",
});
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Exit practice" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Lessons", exact: true }).click();
await p.waitForTimeout(500);
await p.locator('.strand-chip[data-strand="fractions"]').click();
await p.waitForTimeout(300);
await p.screenshot({
  path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/h4.png",
});
await b.close();
