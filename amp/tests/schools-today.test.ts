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
  todayTodos,
  weekStart,
  type RecentOutcome,
  type TodayInput,
  type TodayStudent,
} from "../src/schools/today";

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
  workedToday: false,
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
        student("Ben", { workedToday: true, todayMinutes: 20 }),
        student("Cy", { workedToday: true, todayMinutes: 15 }),
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
        student("Ada", { workedToday: true, todayMinutes: 12 }),
        student("Ben", { workedToday: true, todayMinutes: 20 }),
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
    "3 misses without help in the last 14 days, and no right answer since.",
  );
  assert.equal(stuck?.action.label, "Open the lesson");
  assert.equal(stuck?.groupSheet?.label, "Print a sheet");
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
  assert.equal(
    first!.detail,
    "Amara, Diego and Lena: each has 2 or more misses without help in the last 14 days, and no right answer since.",
  );
  assert.doesNotMatch(first!.detail, /should|together|try/i);
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
    both.detail,
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
  const worked = { workedToday: true, todayMinutes: 20, objectivesThisWeek: 2 };
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
  assert.equal(
    good.detail,
    "60 active minutes so far; 6 skills shown twice on their own this week.",
  );
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
