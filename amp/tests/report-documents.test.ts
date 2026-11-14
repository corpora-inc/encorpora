import test from "node:test";
import assert from "node:assert/strict";
import { progressReportHtml } from "../src/reports/progress-report.js";
import { reportCardsHtml } from "../src/reports/report-cards.js";
import { signInCardsHtml } from "../src/reports/sign-in-cards.js";

const name = `Ana <b>"Lu"</b> & Co`;
const record = {
  level: {
    overall: { level: 5.4, sd: 0.3 },
    strands: { fractions: { level: 5.1, sd: 0.4 } },
  },
  reference: { from: 5, to: 6 },
  strands: [{ id: "fractions", label: "Fractions" }],
  weeks: [{ week: "2026-11-02", minutes: 40 }],
  objectives: [],
  work: [],
};
/** Printed documents carry everything they show: no request leaves the
 * renderer, and every name is text, never markup. */
function selfContained(html: string) {
  assert.doesNotMatch(html, /<(link|img|iframe)\b|src="http|url\(http/);
  assert.ok(!html.includes("<b>"), "names are escaped");
  assert.match(html, /data-compose/);
}

test("a progress report prints its levels, time and name as text", () => {
  const { html, footer } = progressReportHtml({
    paper: "A4",
    name,
    first: "Ana",
    subtitle: "Math 5",
    facts: [{ label: "School", value: "Oak" }],
    today: "2026-11-10",
    record,
  });
  selfContained(html);
  assert.match(html, /size: A4/);
  assert.match(html, /Fractions/);
  assert.match(html, /4\.9–5\.9/);
  assert.ok(footer.includes("&lt;b&gt;"));
});

test("report cards print one page per student", () => {
  const student = {
    id: "a",
    name,
    identifier: null,
    final: "A−",
    minutes: 90,
    objectivesGained: 3,
    levelFrom: 5,
    levelTo: 5.8,
  };
  const { html } = reportCardsHtml({
    paper: "Letter",
    data: {
      school: "Oak",
      class: { name: "Math 5", course: "Grade 5" },
      term: {
        id: "t",
        name: "Fall",
        startsOn: "2026-08-20",
        endsOn: "2026-12-18",
        state: "open",
      },
      teachers: [],
      students: [student, { ...student, id: "b" }],
    },
    students: [student, { ...student, id: "b" }],
    today: "2026-11-10",
  });
  selfContained(html);
  assert.equal(html.match(/<article class="card">/g)?.length, 2);
});

test("sign-in cards print eight to a page, each with its own link", () => {
  const cards = Array.from({ length: 9 }, (_, i) => ({
    name: i ? `Student ${i}` : name,
    token: `${"t".repeat(42)}${i}`,
  }));
  const { html } = signInCardsHtml({
    paper: "Letter",
    className: "Math 5",
    origin: "https://amp.example.com",
    cards,
  });
  selfContained(html);
  assert.equal(html.match(/<section class="sheet">/g)?.length, 2);
  assert.equal(html.match(/<svg class="qr"/g)?.length, 9);
});

test("family report composers use family and parent names, escape them, and preserve school wording", () => {
  const student = {
    id: "a",
    name: "Child",
    identifier: null,
    final: "A",
    minutes: 37,
    objectivesGained: 2,
    levelFrom: 3,
    levelTo: 4,
  };
  const term = {
    id: "t",
    name: "Year",
    startsOn: "2026-07-01",
    endsOn: "2027-06-30",
    state: "open" as const,
  };
  for (const parentName of [null, "Ada <b>River</b>"]) {
    const family = { displayName: "River family", parentName };
    const { html } = reportCardsHtml({
      paper: "Letter",
      today: "2026-11-10",
      students: [student],
      data: {
        family,
        school: "Generated storage family",
        class: { name: "Generated class", course: "Generated course" },
        term,
        teachers: ["Someone else"],
        students: [student],
      },
    });
    assert.match(html, /River family/);
    assert.match(
      html,
      parentName
        ? /decided by Ada &lt;b&gt;River&lt;\/b&gt;/
        : /decided by the parent/,
    );
    assert.doesNotMatch(html, /Generated|Teacher|<b>/);
    const progress = progressReportHtml({
      paper: "A4",
      name: "Child",
      first: "Child",
      subtitle: "River family",
      facts: [],
      today: "2026-11-10",
      record,
      grades: [
        {
          classId: "c",
          className: "Generated class",
          family,
          termId: "t",
          termName: "Year",
          state: "open",
          final: "A",
          suggestion: { letters: "A" } as any,
        },
      ],
    }).html;
    assert.match(
      progress,
      parentName
        ? /decided by Ada &lt;b&gt;River&lt;\/b&gt;/
        : /decided by the parent/,
    );
    assert.doesNotMatch(progress, /Generated|teacher|<b>/);
  }
  const school = reportCardsHtml({
    paper: "Letter",
    today: "2026-11-10",
    students: [student],
    data: {
      school: "Oak",
      class: { name: "Math", course: "Math" },
      term,
      teachers: ["Teacher Name"],
      students: [student],
    },
  }).html;
  assert.match(school, /decided by the teacher/);
});
