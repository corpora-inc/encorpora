import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { generateProblem } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { gradeNumber } from "../src/learning/frontier";

// Real generated tasks and policy in the practice workspace, no API/database.
const fixtures = ["price-count-chain", "multiply-facts"].map((id) => {
  const problem = generateProblem(id, "calculator-review").public;
  const skill = skills.find((s) => s.id === problem.skillId)!;
  return { problem, strand: skill.strand, grade: gradeNumber[skill.gradeBand] };
});
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PracticeWorkspace, usePracticeViewport} from '/src/web/PracticeWorkspace.tsx';
import {calculatorAllowed} from '/src/math/calculator.ts';
import '/src/web/style.css';import '/src/web/practice.css';import '/node_modules/katex/dist/katex.min.css';
import '/src/web/theme.css';import '/src/web/premium-controls.css';import '/src/web/app-shell.css';import '/src/web/practice-tablet.css';
const fixtures=${JSON.stringify(fixtures)};
const {problem,strand,grade}=fixtures[new URLSearchParams(location.search).has('fluency')?1:0];
window.pressed=[];
function App(){
  usePracticeViewport(true);
  const [response,setResponse]=React.useState('');
  const note=(name)=>()=>window.pressed.push(name);
  return React.createElement('div',{className:'shell app-shell practice-shell immersive'},
    React.createElement(PracticeWorkspace,{problem,lesson:null,response,setResponse,outcome:null,hint:'',pending:false,busy:false,
      calculator:calculatorAllowed({id:problem.templateId},strand,grade),submit:note('submit'),next:note('next'),requestHint:note('hint'),exit:note('exit'),exitHref:'/',
      requestLesson:()=>new Promise(()=>{})}));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
`;
const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server } },
  appType: "custom",
  plugins: [
    {
      name: "calculator-review",
      resolveId(id) {
        if (id === "/calculator-review-entry.tsx") return id;
      },
      load(id) {
        if (id === "/calculator-review-entry.tsx") return entry;
      },
      configureServer(server) {
        server.middlewares.use("/calculator-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/calculator-review",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/calculator-review-entry.tsx"></script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const pageUrl = `http://127.0.0.1:${address.port}/calculator-review`;
const output = new URL("../artifacts/calculator/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

type Box = { x: number; y: number; width: number; height: number };
const MEASURED = {
  panel: ".calculator",
  display: ".calculator-display",
  expression: ".calculator-display input",
  result: ".calculator-display output",
  keys: ".calculator-keys",
  equals: ".calculator-keys .equals",
};
async function boxes(page: Page): Promise<Record<string, Box>> {
  // No named helpers inside evaluate: tsx would inject an undefined __name.
  return page.evaluate((selectors) => {
    const out: Record<string, Box> = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      out[name] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, MEASURED);
}
const expression = (page: Page) =>
  page.getByLabel("Calculator expression", { exact: true });
const calculator = (page: Page) =>
  page.getByRole("region", { name: "Calculator", exact: true });
const caretOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((input: HTMLInputElement) => [
      input.selectionStart,
      input.selectionEnd,
      document.activeElement === input,
    ]);
async function key(page: Page, name: string) {
  await calculator(page).getByRole("button", { name, exact: true }).tap();
}
/** Taps an input at the boundary `fromEnd` characters before the end of its
 * value, as a finger would to place the caret. */
async function tapCaret(page: Page, selector: string, fromEnd: number) {
  const point = await page
    .locator(selector)
    .evaluate((input: HTMLInputElement, fromEnd) => {
      // Measure text in a span styled like the input (tabular digits).
      const style = getComputedStyle(input);
      const right = style.textAlign === "right" || style.textAlign === "end";
      const cut = input.value.length - fromEnd;
      const mirror = document.createElement("span");
      mirror.textContent = right
        ? input.value.slice(cut)
        : input.value.slice(0, cut);
      mirror.style.cssText = "position:fixed;visibility:hidden;white-space:pre";
      for (const property of [
        "font-family",
        "font-size",
        "font-weight",
        "font-variant-numeric",
        "letter-spacing",
      ])
        mirror.style.setProperty(property, style.getPropertyValue(property));
      document.body.append(mirror);
      const width = mirror.getBoundingClientRect().width;
      mirror.remove();
      const rect = input.getBoundingClientRect();
      const px = Number.parseFloat;
      const x = right
        ? rect.right -
          px(style.paddingRight) -
          px(style.borderRightWidth) -
          width
        : rect.left + px(style.paddingLeft) + px(style.borderLeftWidth) + width;
      return { x, y: rect.top + rect.height / 2 };
    }, fromEnd);
  await page.touchscreen.tap(point.x, point.y);
}

try {
  // Editing, layout stability and dismissal on a touch phone.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pageUrl);
  const toggle = page.getByRole("button", { name: "Calculator", exact: true });
  await toggle.tap();
  await calculator(page).waitFor();
  assert.equal(
    await page.locator("#answer").getAttribute("inputmode"),
    "none",
    "The answer field raises no system keyboard on touch",
  );
  assert.equal(await expression(page).getAttribute("inputmode"), "none");
  // No visible title or close button: only the display and keys.
  assert.equal(
    (await calculator(page).innerText()).includes("Calculator"),
    false,
    "The calculator shows no title",
  );
  const close = calculator(page).getByRole("button", {
    name: "Close calculator",
    exact: true,
  });
  assert.equal(await close.count(), 1, "A hidden close button remains");
  assert.equal(
    await close.evaluate((el) => getComputedStyle(el).clipPath),
    "inset(50%)",
    "The close button is hidden until a keyboard reaches it",
  );

  // Typing, results and errors never move the panel, display or keys.
  assert.deepEqual(
    await calculator(page)
      .locator(".calculator-display input, .calculator-display output")
      .evaluateAll((lines) =>
        lines.map((line) => getComputedStyle(line).fontVariantNumeric),
      ),
    ["tabular-nums", "tabular-nums"],
    "The display and result use tabular digits",
  );
  await calculator(page).evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  const before = await boxes(page);
  const steps = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "×",
    "6",
    "7",
    "8",
    "9",
    "0",
    "÷",
    "7",
    "+",
    "π",
    "power",
    "2",
    "=",
    "−",
    "(",
    "clear",
    "(",
    "=",
  ];
  for (const step of steps) {
    await key(page, step);
    if (process.env.DEBUG_SHOT)
      await page.screenshot({
        path: new URL(`step-${step}.png`, output).pathname,
      });
    assert.deepEqual(
      await boxes(page),
      before,
      `Pressing ${step} moved the calculator`,
    );
  }
  assert.equal(
    await calculator(page).locator("output").innerText(),
    "Check the expression",
  );
  for (let i = 0; i < 40; i++) await key(page, "9");
  assert.deepEqual(await boxes(page), before, "A long value moved the panel");
  assert(
    await expression(page).evaluate(
      (input: HTMLInputElement) =>
        input.scrollLeft + input.clientWidth >= input.scrollWidth - 1,
    ),
    "The newest digit of a long value stays in view",
  );
  await page.screenshot({
    path: new URL("long-value-390.png", output).pathname,
  });

  // The caret: tap into the middle, then keys edit there.
  await key(page, "clear");
  for (const digit of ["1", "2", "3", "4"]) await key(page, digit);
  await tapCaret(page, ".calculator-display input", 2);
  assert.deepEqual(await caretOf(page, ".calculator-display input"), [
    2,
    2,
    true,
  ]);
  await key(page, "9");
  assert.equal(await expression(page).inputValue(), "12934");
  assert.deepEqual(
    await caretOf(page, ".calculator-display input"),
    [3, 3, true],
    "The caret follows the inserted digit",
  );
  await key(page, "delete");
  assert.equal(await expression(page).inputValue(), "1234");
  assert.deepEqual(await caretOf(page, ".calculator-display input"), [
    2,
    2,
    true,
  ]);
  await key(page, "square root");
  assert.equal(await expression(page).inputValue(), "12√(34");
  // A selection is replaced.
  await expression(page).evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(0, 2),
  );
  await key(page, "5");
  assert.equal(await expression(page).inputValue(), "5√(34");
  assert.deepEqual(await caretOf(page, ".calculator-display input"), [
    1,
    1,
    true,
  ]);
  // ± negates the whole expression, and again restores it.
  await key(page, "clear");
  for (const step of ["3", "+", "4"]) await key(page, step);
  await key(page, "negate");
  assert.equal(await expression(page).inputValue(), "-(3+4)");
  await key(page, "negate");
  assert.equal(await expression(page).inputValue(), "3+4");

  // Use puts the result in the answer field and returns there.
  await key(page, "clear");
  for (const step of ["4", "8", ".", "6", "×", "3", "="]) await key(page, step);
  await key(page, "Use result as answer");
  await calculator(page).waitFor({ state: "detached" });
  assert.equal(await page.locator("#answer").inputValue(), "145.8");

  // The answer keypad uses the same caret model.
  await tapCaret(page, "#answer", 2);
  assert.deepEqual(await caretOf(page, "#answer"), [3, 3, true]);
  await page
    .locator(".math-keypad")
    .getByRole("button", { name: "7", exact: true })
    .tap();
  assert.equal(await page.locator("#answer").inputValue(), "1457.8");
  assert.deepEqual(await caretOf(page, "#answer"), [4, 4, true]);
  await page
    .locator(".math-keypad")
    .getByRole("button", { name: "Delete", exact: true })
    .tap();
  assert.equal(await page.locator("#answer").inputValue(), "145.8");
  assert.deepEqual(await caretOf(page, "#answer"), [3, 3, true]);

  // A tap outside closes the calculator without pressing what lies beneath.
  await toggle.tap();
  await calculator(page).waitFor();
  const exit = page.getByRole("link", { name: "Your level" });
  await exit.tap();
  await calculator(page).waitFor({ state: "detached" });
  await page.waitForTimeout(100);
  assert.deepEqual(
    await page.evaluate(
      () => (window as unknown as { pressed: string[] }).pressed,
    ),
    [],
    "The tap outside also pressed Your level",
  );
  assert(
    await toggle.evaluate((el) => el === document.activeElement),
    "Focus returns to the calculator toggle",
  );
  // The next tap works normally.
  await page.waitForTimeout(800);
  await toggle.tap();
  await calculator(page).waitFor();
  // Tapping the toggle again closes it, and does not reopen it.
  await toggle.tap();
  await calculator(page).waitFor({ state: "detached" });
  await page.waitForTimeout(800);
  assert.equal(await calculator(page).count(), 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  await context.close();

  // Keyboard and mouse: Escape, the hidden close button, outside clicks.
  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  desktop.on("pageerror", (error) => errors.push(error.message));
  await desktop.goto(pageUrl);
  const deskToggle = desktop.getByRole("button", {
    name: "Calculator",
    exact: true,
  });
  await deskToggle.click();
  await calculator(desktop).waitFor();
  await desktop.keyboard.type("1234");
  await desktop.keyboard.press("ArrowLeft");
  await desktop.keyboard.press("ArrowLeft");
  await calculator(desktop)
    .getByRole("button", { name: "9", exact: true })
    .click();
  assert.equal(await expression(desktop).inputValue(), "12934");
  await desktop.keyboard.press("Escape");
  await calculator(desktop).waitFor({ state: "detached" });
  assert(
    await deskToggle.evaluate(
      (el) => el === document.activeElement && el.matches(":focus-visible"),
    ),
    "Escape returns visible focus to the toggle",
  );
  await deskToggle.press("Enter");
  await calculator(desktop).waitFor();
  await calculator(desktop).evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  await desktop.keyboard.press("Shift+Tab");
  const deskClose = calculator(desktop).getByRole("button", {
    name: "Close calculator",
    exact: true,
  });
  assert(await deskClose.evaluate((el) => el === document.activeElement));
  assert.equal(
    await deskClose.evaluate((el) => getComputedStyle(el).clipPath),
    "none",
    "The close button shows when the keyboard reaches it",
  );
  await desktop.screenshot({
    path: new URL("keyboard-close-1280.png", output).pathname,
  });
  await desktop.keyboard.press("Enter");
  await calculator(desktop).waitFor({ state: "detached" });
  assert(await deskToggle.evaluate((el) => el === document.activeElement));
  await deskToggle.click();
  await calculator(desktop).waitFor();
  await desktop.getByRole("link", { name: "Your level" }).click();
  await calculator(desktop).waitFor({ state: "detached" });
  assert.deepEqual(
    await desktop.evaluate(
      () => (window as unknown as { pressed: string[] }).pressed,
    ),
    [],
    "The click outside also pressed Your level",
  );
  await desktop.close();

  const fluency = await browser.newPage();
  await fluency.goto(pageUrl + "?fluency");
  await fluency.locator(".question").waitFor();
  assert.equal(
    await fluency
      .getByRole("button", { name: "Calculator", exact: true })
      .count(),
    0,
    "Multiplication facts must not offer a calculator",
  );
  await fluency.close();

  // Synthetic screenshots: no overflow at any width, light or dark.
  for (const colorScheme of ["light", "dark"] as const) {
    for (const [width, height] of [
      [320, 720],
      [390, 720],
      [768, 900],
      [768, 1024],
      [1024, 768],
      [1180, 820],
      [1280, 900],
    ] as const) {
      const shot = await browser.newPage({
        viewport: { width, height },
        colorScheme,
      });
      await shot.goto(pageUrl);
      await shot
        .getByRole("button", { name: "Calculator", exact: true })
        .click();
      await calculator(shot).waitFor();
      await shot.keyboard.type("(4.60+1.50)×14");
      await calculator(shot).evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished)),
      );
      const fit = await shot.evaluate(() => {
        const panel = document
          .querySelector(".calculator")!
          .getBoundingClientRect();
        // Beside the problem (two-column landscape) the panel stays in the
        // answer column, over the keypad it stands in for.
        const stage = document
          .querySelector(".problem-stage")!
          .getBoundingClientRect();
        const dock = document
          .querySelector(".practice-surface > .answer-dock")!
          .getBoundingClientRect();
        const beside = innerWidth > innerHeight && innerWidth >= 900;
        return {
          panel: [
            panel.left,
            panel.right,
            panel.bottom,
            innerWidth,
            innerHeight,
          ],
          overflow: document.documentElement.scrollWidth > innerWidth,
          inside:
            panel.left >= 0 &&
            panel.right <= innerWidth &&
            panel.bottom <= innerHeight,
          clearOfProblem:
            !beside ||
            (panel.left >= stage.right &&
              panel.right <= dock.right + 1 &&
              panel.bottom <= dock.bottom + 1),
        };
      });
      assert.deepEqual(
        {
          overflow: fit.overflow,
          inside: fit.inside,
          clearOfProblem: fit.clearOfProblem,
        },
        { overflow: false, inside: true, clearOfProblem: true },
        `Calculator must fit at ${width}×${height} ${colorScheme}: ${fit.panel}`,
      );
      await shot.screenshot({
        path: new URL(
          `calculator-${width}x${height}-${colorScheme}.png`,
          output,
        ).pathname,
      });
      await shot.close();
    }
  }

  // The docked panel reaches the screen's bottom edge: below the keys there
  // is only its own 12 px padding plus the home indicator's inset, and the
  // answer dock leaves no more than that inset beneath it.
  for (const inset of [0, 34]) {
    const phone = await browser.newContext({
      viewport: { width: 384, height: 700 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await phone.newPage();
    if (inset) {
      const cdp = await phone.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top: 0, bottom: inset, left: 0, right: 0 },
      });
    }
    await page.goto(pageUrl);
    await page.locator(".math-keypad").waitFor();
    const dockGap = await page
      .locator(".answer-dock")
      .evaluate((el) => innerHeight - el.getBoundingClientRect().bottom);
    assert.equal(dockGap, inset, `The answer dock leaves a ${dockGap}px band`);
    await page.getByRole("button", { name: "Calculator", exact: true }).tap();
    await calculator(page).waitFor();
    await calculator(page).evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );
    const gap = await page.evaluate(() => {
      const panel = document.querySelector(".calculator")!;
      const keys = document.querySelector(".calculator-keys")!;
      const edge = document.elementFromPoint(innerWidth / 2, innerHeight - 1);
      return {
        panel: innerHeight - panel.getBoundingClientRect().bottom,
        keys: innerHeight - keys.getBoundingClientRect().bottom,
        covered: !!edge && panel.contains(edge),
      };
    });
    assert.deepEqual(
      gap,
      { panel: 0, keys: 12 + inset, covered: true },
      `With a ${inset}px inset the calculator leaves a band below it`,
    );
    await page.screenshot({
      path: new URL(`docked-384x700-inset${inset}.png`, output).pathname,
    });
    await phone.close();
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("Calculator UI verified.");
} finally {
  await browser.close();
  await vite.close();
  server.close();
}
