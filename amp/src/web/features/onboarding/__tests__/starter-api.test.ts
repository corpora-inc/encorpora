import { expect, test } from "vitest";
import { demoHome } from "../starter-api";

// The body `POST /api/v1/school/demo` sends (src/schools/demo/routes.ts).
const made = (kind: "class" | "school") => ({
  demo: {
    kind,
    orgId: "6f1c2a3b-0000-4000-8000-000000000001",
    classId: "6f1c2a3b-0000-4000-8000-000000000002",
    path: "school/6f1c2a3b-0000-4000-8000-000000000001/classes/6f1c2a3b-0000-4000-8000-000000000002/today",
  },
});

test("a teacher's demo class opens on its Today", () => {
  expect(demoHome(made("class"))).toBe(made("class").demo.path);
});

test("a school's demo opens on the school, the overview a head presents", () => {
  expect(demoHome(made("school"))).toBe(
    "school/6f1c2a3b-0000-4000-8000-000000000001",
  );
});
