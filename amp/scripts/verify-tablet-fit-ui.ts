/** Regression for question fit versus scrollable structured answer rows. */
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { problemInView } from "./ui-viewports";

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 768, height: 1024 },
    });
    await page.addInitScript("globalThis.__name = (f) => f");
    const fixture = async (
      question = 40,
      figure = 40,
      answerClass = "work",
    ) => {
      await page.setContent(`<style>
        body { margin: 0; }
        .problem-stage { width: 500px; height: 200px; overflow: auto; }
        .question { height: ${question}px; }
        .figure { height: ${figure}px; }
        .answer { height: 400px; }
      </style><div class="problem-stage"><div class="problem-content">
        <div class="question">Question</div><svg class="figure"></svg>
        <div class="answer ${answerClass}">Answer rows<svg height="300"></svg></div>
      </div></div>`);
    };
    await fixture();
    assert.ok(
      (await problemInView(page)).some((why) =>
        why.startsWith("stage scrolls"),
      ),
    );
    const options = { allowStructuredWorkScroll: true };
    assert.deepEqual(await problemInView(page, options), []);
    await fixture(300);
    assert.ok(
      (await problemInView(page, options)).some((why) =>
        why.includes(".question"),
      ),
      "A long question must still fail",
    );
    await fixture(40, 300);
    assert.ok(
      (await problemInView(page, options)).some((why) =>
        why.includes(".figure"),
      ),
      "A tall question figure must still fail",
    );
    await fixture(40, 40, "other-answer");
    assert.ok(
      (await problemInView(page, options)).some((why) =>
        why.startsWith("stage scrolls"),
      ),
      "Other answer types retain strict fit",
    );
    console.log(
      `${engine.name()}: structured answer scrolling preserves strict question and figure fit`,
    );
  } finally {
    await browser.close();
  }
}
