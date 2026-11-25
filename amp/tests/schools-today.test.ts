import test from "node:test";
import assert from "node:assert/strict";
import {
  createGradePolicy,
  DEFAULT_GRADE_POLICY,
  gradeParameters,
} from "../src/schools/grade-policy";
import {
  dayOfWeek,
  inSentence,
  joinNames,
  skillsEarnedWords,
  todayTodos,
  weekStart,
  type RecentOutcome,
  type TodayInput,
  type TodayStudent,
} from "../src/schools/today";
import {
  minutesFigure,
  minutesWords,
  practiceCounts,
} from "../src/schools/practice-rules";
import { summarize } from "../src/schools/practice-stats";

/** A Friday. */
const TODAY = "2026-11-06";
const at = (daysAgo: number) =>
  new Date(
    Date.parse(`${TODAY}T15:00:00Z`) - daysAgo * 86_400_000,
  ).toISOString();
const miss = (
  daysAgo = 1,
  patch: Partial<RecentOutcome> = {},
): RecentOutcome => ({
  correct: false,
  assisted: false,
  createdAt: at(daysAgo),
  templateId: "fraction-add",
  ...patch,
});
const right = (daysAgo = 1): RecentOutcome => ({
  correct: true,
  assisted: false,
  createdAt: at(daysAgo),
  templateId: "fraction-add",
});
const level = (value: number) => ({
  overall: { level: value, sd: 0.3 },
  strands: {
    fractions: { level: value, sd: 0.4 },
    number: { level: value, sd: 0.4 },
  },
});
const student = (
  first: string,
  patch: Partial<TodayStudent> = {},
): TodayStudent => ({
  id: first.toLowerCase(),
  name: `${first} Fixture`,
  first,
  gradeLevel: 5,
  level: level(5),
  weekMinutes: 45,
  weekProblems: 80,
  todayProblems: 0,
  todayMinutes: 0,
  usualWeeklyMinutes: 50,
  lastActive: "2026-11-05",
  review: 10,
  reviewIndependent: 7,
  objectivesThisWeek: 0,
  ...patch,
});
const input = (patch: Partial<TodayInput> = {}): TodayInput => ({
  today: TODAY,
  students: [
    student("Amara"),
    student("Diego"),
    student("Lena"),
    student("Noor"),
  ],
  skills: [],
  course: { from: 4.5, to: 5.5, label: "Grade 5" },
  weeklyTargetMinutes: 60,
  skillTitle: (id) => (id === "fraction-addition" ? "Fraction addition" : id),
  lessonFor: () => "fraction-add",
  ...patch,
});
const kinds = (todos: ReturnType<typeof todayTodos>) =>
  todos.map((todo) => todo.kind);
const gap = (id: string, recent = [miss(3), miss(2), miss(1)]) => ({
  studentId: id,
  skillId: "fraction-addition",
  recent,
});

test("weeks start on Monday and a list of names reads as a sentence", () => {
  assert.equal(dayOfWeek("2026-11-02"), 0);
  assert.equal(dayOfWeek(TODAY), 4);
  assert.equal(dayOfWeek("2026-11-08"), 6);
  assert.equal(weekStart(TODAY), "2026-11-02");
  assert.equal(weekStart("2026-11-02"), "2026-11-02");
  assert.equal(joinNames(["A"]), "A");
  assert.equal(joinNames(["A", "B"]), "A and B");
  assert.equal(joinNames(["A", "B", "C"]), "A, B and C");
  assert.equal(joinNames(["A", "B", "C"], 2), "A, B and 1 more");
  assert.equal(inSentence("Fraction addition"), "fraction addition");
  assert.equal(inSentence("Pythagorean theorem"), "Pythagorean theorem");
  assert.equal(inSentence("GCF LCM"), "GCF LCM");
  // A title's leading article is lowercase mid-sentence.
  assert.equal(
    inSentence("A fraction times a whole number"),
    "a fraction times a whole number",
  );
  assert.equal(inSentence("Cartesian plane"), "Cartesian plane");
  assert.equal(inSentence("Venn diagrams"), "Venn diagrams");
});

test("no students yet: the next step is adding them", () => {
  const todos = todayTodos(input({ students: [] }));
  assert.deepEqual(kinds(todos), ["start"]);
  assert.equal(todos[0]!.title, "Add your students");
  assert.equal(todos[0]!.action.kind, "tab");
});

test("no work yet: the next step is Start class, not an empty screen", () => {
  const todos = todayTodos(
    input({
      students: [
        student("Amara", { lastActive: null, weekMinutes: 0, weekProblems: 0 }),
        student("Diego", { lastActive: null, weekMinutes: 0, weekProblems: 0 }),
      ],
    }),
  );
  assert.deepEqual(kinds(todos), ["start"]);
  assert.equal(todos[0]!.title, "Start class");
  assert.deepEqual(
    todos[0]!.action.kind === "tab" && todos[0]!.action.tab,
    "start",
  );
});

test("a family's Today speaks of children and never asks to start a class", () => {
  const fresh = (first: string) =>
    student(first, { lastActive: null, weekMinutes: 0, weekProblems: 0 });
  assert.deepEqual(
    todayTodos(input({ family: true, students: [fresh("Ada"), fresh("Ben")] })),
    [],
  );
  const todos = todayTodos(
    input({
      family: true,
      students: [
        fresh("Ada"),
        student("Ben", { todayMinutes: 20, todayProblems: 12 }),
        student("Cy", { todayMinutes: 15, todayProblems: 12 }),
      ],
    }),
  );
  assert.ok(todos.every((todo) => todo.kind !== "start"));
  assert.ok(todos.every((todo) => !/\bstudents?\b/.test(todo.title)));
  // Each child who worked, by name; everyone, as one line.
  assert.ok(
    todos.some((todo) => todo.title === "Ben practiced 20 minutes today"),
  );
  const all = todayTodos(
    input({
      family: true,
      students: [
        student("Ada", { todayMinutes: 12, todayProblems: 12 }),
        student("Ben", { todayMinutes: 20, todayProblems: 12 }),
      ],
    }),
  );
  assert.ok(all.some((todo) => todo.title === "Both children worked today"));
  // Repeated misses at home: the lesson, and a sheet on paper.
  const stuck = todayTodos(
    input({
      family: true,
      students: [student("Ada"), student("Ben")],
      skills: [gap("ada", [miss(4), miss(2), miss(1)])],
    }),
  ).find((todo) => todo.kind === "stuck");
  assert.equal(stuck?.title, "Ada keeps missing fraction addition");
  assert.equal(
    stuck?.detail,
    "3 misses without help in 14 days, none right since.",
  );
  assert.equal(stuck?.action.label, "Open the lesson");
  assert.equal(stuck?.groupSheet?.label, "Print a sheet");
});

test("a family's line says earned, the word its key defines and its week sums", () => {
  // A family's count is skills earned (right once without help: the
  // server reads it with learning/earned.ts `EARNED_AFTER`), so its words
  // are the key's and the week's, never a grade's "shown twice".
  assert.equal(skillsEarnedWords(1), "1 skill earned");
  assert.equal(skillsEarnedWords(10), "10 skills earned");
  const worked = (first: string, objectivesThisWeek: number) =>
    student(first, { todayMinutes: 12, todayProblems: 14, objectivesThisWeek });
  const home = todayTodos(
    input({ family: true, students: [worked("Ada", 10), student("Ben")] }),
  );
  const line = home.find((todo) => todo.id === "worked:ada");
  assert.equal(line?.detail, "10 skills earned this week.");
  const one = todayTodos(
    input({ family: true, students: [worked("Ada", 1), student("Ben")] }),
  ).find((todo) => todo.id === "worked:ada");
  assert.equal(one?.detail, "1 skill earned this week.");
  // No family line borrows a grade's rule, whoever worked.
  for (const todo of [
    ...home,
    ...todayTodos(
      input({ family: true, students: [worked("Ada", 3), worked("Ben", 2)] }),
    ),
  ])
    assert.doesNotMatch(
      `${todo.title} ${todo.detail}`,
      /shown (once|twice|\d+ times)/,
    );
  // A class's wording and count are its grade's, unchanged.
  const room = todayTodos(
    input({ students: [worked("Ada", 4), worked("Ben", 2), student("Cy")] }),
  ).find((todo) => todo.id === "going-well");
  assert.equal(room?.title, "6 skills shown twice on their own this week");
});

test("a shared gap can also go on paper, for those students and that skill", () => {
  const todos = todayTodos(
    input({ skills: [gap("amara"), gap("diego"), gap("lena")] }),
  );
  const [first] = todos;
  assert.equal(first!.kind, "shared-gap");
  assert.equal(first!.groupSheet?.label, "Print a group sheet");
  assert.equal(
    first!.groupSheet?.skillId,
    "skillId" in first!.action ? first!.action.skillId : "",
  );
  assert.ok(todos.slice(1).every((todo) => !todo.groupSheet));
});

test("a shared gap names the skill and the students, and opens the lesson", () => {
  const todos = todayTodos(
    input({ skills: [gap("amara"), gap("diego"), gap("lena")] }),
  );
  const [first] = todos;
  assert.equal(first!.kind, "shared-gap");
  assert.equal(first!.title, "3 students keep missing fraction addition");
  // The faces say who; how it's decided is a tap away.
  assert.equal(first!.detail, "");
  assert.deepEqual(
    first!.students.map((student) => student.name.split(" ")[0]),
    ["Amara", "Diego", "Lena"],
  );
  assert.equal(
    first!.rule,
    "Each has 2 or more misses without help in the last 14 days, and no right answer since.",
  );
  assert.doesNotMatch(first!.rule!, /should|together|try/i);
  assert.deepEqual(first!.action, {
    kind: "lesson",
    templateId: "fraction-add",
    skillId: "fraction-addition",
    label: "Open the lesson",
  });
  assert.deepEqual(
    first!.students.map((entry) => entry.id),
    ["amara", "diego", "lena"],
  );
});

test("a shared gap needs enough students, independent misses and recent ones", () => {
  const counted = (skills: TodayInput["skills"]) =>
    kinds(todayTodos(input({ skills }))).filter((kind) => kind === "shared-gap")
      .length;
  assert.equal(counted([gap("amara"), gap("diego")]), 0, "two isn't shared");
  const assisted = [miss(2, { assisted: true }), miss(1, { assisted: true })];
  assert.equal(
    counted([
      gap("amara", assisted),
      gap("diego", assisted),
      gap("lena", assisted),
    ]),
    0,
    "a miss with help isn't a miss on their own",
  );
  const stale = [miss(40), miss(39)];
  assert.equal(
    counted([gap("amara", stale), gap("diego", stale), gap("lena", stale)]),
    0,
    "an old miss isn't today's business",
  );
  const recovered = [miss(3), miss(2), right(1)];
  assert.equal(
    counted([
      gap("amara", recovered),
      gap("diego", recovered),
      gap("lena", recovered),
    ]),
    0,
    "a right answer since clears it",
  );
  const paper = [
    miss(2, { evidenceWeight: 0.5 }),
    miss(1, { evidenceWeight: 0.5 }),
  ];
  assert.equal(
    counted([gap("amara", paper), gap("diego", paper), gap("lena", paper)]),
    0,
    "a paper mark without the answer isn't enough to call it",
  );
  const once = [miss(1)];
  assert.equal(
    counted([gap("amara", once), gap("diego", once), gap("lena", once)]),
    0,
    "once isn't repeatedly",
  );
});

test("a skill with no lesson still gets a next step", () => {
  const todos = todayTodos(
    input({
      skills: [gap("amara"), gap("diego"), gap("lena")],
      lessonFor: () => null,
    }),
  );
  assert.equal(todos[0]!.action.kind, "skill");
});

test("one student stuck, with the action on their work", () => {
  const todos = todayTodos(
    input({
      skills: [{ ...gap("noor"), skillId: "fraction-addition" }],
    }),
  );
  const stuck = todos.find((todo) => todo.kind === "stuck")!;
  assert.equal(stuck.title, "Noor keeps missing fraction addition");
  assert.doesNotMatch(stuck.detail, /should|side by side/i);
  assert.deepEqual(stuck.action, {
    kind: "student",
    personId: "noor",
    label: "See Noor’s work",
  });
  assert.doesNotMatch(stuck.detail, /\b(he|she|his|her|him)\b/i);
});

test("a student in a shared gap isn't also listed as stuck on it", () => {
  const todos = todayTodos(
    input({ skills: [gap("amara"), gap("diego"), gap("lena")] }),
  );
  assert.equal(kinds(todos).includes("stuck"), false);
});

test("Today makes no practice judgement: an empty week is data on Time, not an item", () => {
  for (const today of ["2026-11-02", "2026-11-04", "2026-11-06"])
    for (const weeklyTargetMinutes of [60, null])
      assert.equal(
        kinds(
          todayTodos(
            input({
              today,
              weeklyTargetMinutes,
              students: [
                student("Amara"),
                student("Diego", { weekMinutes: 0, weekProblems: 0 }),
                student("Lena", { weekMinutes: 3, weekProblems: 5 }),
              ],
            }),
          ),
        ).includes("no-practice"),
        false,
      );
});

test("students who never started get a next step, apart from those who stopped", () => {
  const todos = todayTodos(
    input({
      students: [
        student("Amara"),
        student("Elias", { lastActive: null, weekMinutes: 0, weekProblems: 0 }),
      ],
    }),
  );
  const waiting = todos.find((todo) => todo.id === "not-started")!;
  assert.equal(waiting.title, "Elias hasn’t started yet");
  assert.equal(kinds(todos).includes("no-practice"), false);
});

test("ready for more means past the course in every strand, and holding it", () => {
  const past = {
    level: level(6.2),
    review: 10,
    reviewIndependent: 9,
  };
  const ready = (students: TodayStudent[]) =>
    todayTodos(input({ students })).find((todo) => todo.kind === "ready");
  const both = ready([
    student("Priya", past),
    student("Sam", past),
    student("Lena"),
  ])!;
  assert.equal(both.title, "Priya and Sam: above Grade 5 in every strand");
  assert.equal(
    both.rule,
    "Spaced review right without help in 80% or more of at least 3 reviews.",
  );
  assert.equal(both.action.kind, "tab");
  const one = ready([student("Priya", past), student("Lena")])!;
  assert.equal(one.action.kind, "student");
  // Behind in one strand.
  assert.equal(
    ready([
      student("Priya", {
        ...past,
        level: {
          overall: { level: 6.2, sd: 0.3 },
          strands: {
            fractions: { level: 6.2, sd: 0.3 },
            number: { level: 5.2, sd: 0.3 },
          },
        },
      }),
    ]),
    undefined,
  );
  // Not enough spaced review, or not holding it.
  assert.equal(
    ready([student("Priya", { ...past, review: 1, reviewIndependent: 1 })]),
    undefined,
  );
  assert.equal(
    ready([student("Priya", { ...past, review: 10, reviewIndependent: 5 })]),
    undefined,
  );
  // A mixed-grade class measures against each student's own grade.
  const mixed = todayTodos(
    input({
      course: null,
      students: [student("Priya", { ...past, gradeLevel: 5 })],
    }),
  ).find((todo) => todo.kind === "ready")!;
  assert.match(mixed.title, /above their own grade/);
});

test("a day with most of the class working says how many, without a verdict", () => {
  const worked = { todayMinutes: 20, todayProblems: 12, objectivesThisWeek: 2 };
  const todos = todayTodos(
    input({
      students: [
        student("Amara", worked),
        student("Diego", worked),
        student("Lena", worked),
        student("Noor"),
      ],
    }),
  );
  const good = todos.find((todo) => todo.kind === "good-day")!;
  assert.equal(good.title, "3 of 4 students practiced today");
  assert.equal(good.detail, "60 active minutes.");
  // Too few for a good day, but what's going well still shows.
  const quiet = todayTodos(
    input({
      students: [
        student("Amara", { objectivesThisWeek: 3 }),
        student("Diego"),
        student("Lena"),
        student("Noor"),
      ],
    }),
  );
  const going = quiet.find((todo) => todo.kind === "good-day")!;
  assert.equal(going.id, "going-well");
  assert.equal(going.title, "3 skills shown twice on their own this week");
  assert.equal(going.detail, "Amara 3.");
});

test("never a wall of deficits: what's going well keeps its place", () => {
  const skill = (name: string) =>
    [gap("amara"), gap("diego"), gap("lena")].map((row) => ({
      ...row,
      skillId: name,
    }));
  const todos = todayTodos(
    input({
      students: [
        student("Amara", { objectivesThisWeek: 1 }),
        student("Diego"),
        student("Lena"),
        student("Noor", { weekMinutes: 0, weekProblems: 0 }),
        student("Elias", { lastActive: null, weekMinutes: 0, weekProblems: 0 }),
        student("Priya", {
          level: level(6.2),
          review: 10,
          reviewIndependent: 9,
        }),
      ],
      skills: [
        ...skill("one"),
        ...skill("two"),
        ...skill("three"),
        {
          studentId: "noor",
          skillId: "four",
          recent: [miss(3), miss(2), miss(1)],
        },
      ],
    }),
  );
  assert.equal(todos.length, DEFAULT_GRADE_POLICY.today.maximumTodos);
  const list = kinds(todos);
  assert.equal(list.includes("ready"), true);
  assert.equal(list.includes("good-day"), true);
  assert.equal(list[0], "shared-gap");
  // One of each kind before a second of any.
  assert.deepEqual(list.slice(0, 3), ["shared-gap", "stuck", "start"]);
  assert.equal(new Set(todos.map((todo) => todo.id)).size, todos.length);
});

test("a second shared gap shows when there's room for it", () => {
  const second = [gap("amara"), gap("diego"), gap("lena")].map((row) => ({
    ...row,
    skillId: "second",
  }));
  const todos = todayTodos(
    input({ skills: [gap("amara"), gap("diego"), gap("lena"), ...second] }),
  );
  assert.deepEqual(
    kinds(todos).filter((kind) => kind === "shared-gap"),
    ["shared-gap", "shared-gap"],
  );
});

test("thresholds come from the versioned policy", () => {
  const parameters = gradeParameters();
  parameters.today.sharedGapStudents = 2;
  const policy = createGradePolicy(parameters);
  const skills = [gap("amara"), gap("diego")];
  assert.equal(
    kinds(todayTodos(input({ skills }))).includes("shared-gap"),
    false,
  );
  assert.equal(
    kinds(todayTodos(input({ skills }), policy)).includes("shared-gap"),
    true,
  );
});

test("keeps missing links each student's latest miss without help", () => {
  const withIds = (id: string) => [
    miss(4, { id: `${id}-1` }),
    miss(3, { id: `${id}-2` }),
    miss(2, { id: `${id}-3` }),
    // A miss with a hint since: not the one to open.
    miss(1, { id: `${id}-4`, assisted: true }),
  ];
  const stuck = todayTodos(
    input({
      skills: [{ ...gap("noor", withIds("noor")) }],
    }),
  ).find((todo) => todo.kind === "stuck")!;
  assert.deepEqual(stuck.misses, [
    { personId: "noor", attempt: "noor-3", skillId: "fraction-addition" },
  ]);
  assert.equal(stuck.action.label, "See Noor’s misses");
  const shared = todayTodos(
    input({
      skills: [
        gap("amara", withIds("amara")),
        gap("diego", withIds("diego")),
        gap("lena"),
      ],
    }),
  ).find((todo) => todo.kind === "shared-gap")!;
  // Evidence folded before attempt ids were kept links nothing.
  assert.deepEqual(
    shared.misses?.map((entry) => entry.attempt),
    ["amara-3", "diego-3"],
  );
});

/* Finding #24 (2026-11-17 product grabs): a class's Today said "3 of 3 students
   practiced today" beside "students practiced 2 of 3" this week, with "1
   active minutes" and a spread of "median 0, mean 0". Today counted any work;
   the week, the practiced rule; and every minute was rounded to a whole one
   before it was summed or summarized. */
test("Today and the week count practice by one rule, minutes under one included", () => {
  // The recorded class: three sub-minute sessions, one of only two problems.
  const recorded = [
    student("Ava", {
      todayMinutes: 0.4,
      todayProblems: 6,
      weekMinutes: 0.4,
      weekProblems: 6,
    }),
    student("Ben", {
      todayMinutes: 0.3,
      todayProblems: 5,
      weekMinutes: 0.3,
      weekProblems: 5,
    }),
    student("Leo", {
      todayMinutes: 0.2,
      todayProblems: 2,
      weekMinutes: 0.2,
      weekProblems: 2,
    }),
  ];
  const counts = practiceCounts(recorded);
  assert.deepEqual(counts, { today: 2, week: 2 });
  const todos = todayTodos(input({ students: recorded }));
  // Two of three is too few for a good-day line: no "3 of 3" beside "2 of 3".
  assert.ok(
    todos.every((todo) => !/3 of 3/.test(todo.title)),
    JSON.stringify(todos),
  );
  // A fourth student who practiced makes the day: its count is the rule's.
  const four = [
    ...recorded,
    student("Mia", {
      todayMinutes: 0.3,
      todayProblems: 7,
      weekMinutes: 0.3,
      weekProblems: 7,
    }),
  ];
  const good = todayTodos(input({ students: four })).find(
    (todo) => todo.id === "good-day",
  )!;
  assert.equal(good.title, "3 of 4 students practiced today");
  assert.equal(practiceCounts(four).today, 3);
  // 0.4 + 0.3 + 0.3 minutes: one minute, singular.
  assert.equal(good.detail, "1 active minute.");
  assert.match(good.rule ?? "", /5 active minutes or 5 problems/);
  const brief = todayTodos(
    input({
      students: four.map((one) => ({ ...one, todayMinutes: 0.1 })),
    }),
  ).find((todo) => todo.id === "good-day")!;
  assert.equal(brief.detail, "Under 1 active minute.");
  // A family's lines count any work: no family screen counts "practiced",
  // so a short go of two problems still shows.
  const home = todayTodos(input({ family: true, students: recorded }));
  const all = home.find((todo) => todo.id === "good-day");
  assert.equal(all?.title, "All 3 children worked today");
  // 0.4 + 0.3 + 0.2 minutes is under one: never rounded up to "1" (the
  // one rule every family screen shares, web/lib/practice-minutes.ts).
  assert.equal(all?.detail, "Under 1 active minute.");
  const one = todayTodos(
    input({ family: true, students: [recorded[2]!, student("Ada")] }),
  );
  assert.ok(
    one.some((todo) => todo.title === "Leo practiced under 1 minute today"),
    JSON.stringify(one.map((todo) => todo.title)),
  );
  // The spread's statistics read the tenths the server keeps, not zeros.
  const spread = summarize(recorded.map((one) => one.weekMinutes))!;
  assert.equal(spread.median, 0.3);
  assert.ok(spread.mean > 0.29 && spread.mean < 0.31);
  assert.equal(minutesFigure(0.3), "<1");
  assert.equal(minutesFigure(0), "0");
  assert.equal(minutesFigure(1.4), "1");
  assert.equal(minutesFigure(1234.2), "1,234");
  assert.equal(minutesWords(0.3, "active minute"), "under 1 active minute");
  assert.equal(minutesWords(1, "active minute"), "1 active minute");
  assert.equal(minutesWords(0, "active minute"), "0 active minutes");
  assert.equal(minutesWords(12.6), "13 minutes");
});

test("today's practiced count never passes the week's, whatever the work", () => {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 300; run++) {
    const students = Array.from(
      { length: 1 + Math.floor(random() * 30) },
      (_, i) => {
        const todayMinutes = Math.round(random() * random() * 90) / 10;
        const todayProblems = Math.floor(random() * 9);
        return student(`S${i}`, {
          todayMinutes,
          todayProblems,
          // A day is inside its week.
          weekMinutes: todayMinutes + Math.round(random() * 80) / 10,
          weekProblems: todayProblems + Math.floor(random() * 6),
        });
      },
    );
    const counts = practiceCounts(students);
    assert.ok(counts.today <= counts.week, JSON.stringify(counts));
    const good = todayTodos(input({ students })).find(
      (todo) => todo.id === "good-day",
    );
    if (good)
      assert.equal(
        good.title,
        `${counts.today} of ${students.length} students practiced today`,
      );
  }
});
