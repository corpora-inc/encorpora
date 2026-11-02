// @vitest-environment node
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  checkboxPolicyViolations,
  rawCheckboxes,
} from "../../../../scripts/checkbox-policy";
const web = fileURLToPath(new URL("../..", import.meta.url));
test("all screens use the single shared native checkbox implementation", () => {
  expect(checkboxPolicyViolations(web)).toEqual([]);
});
test("the architecture guard rejects ad hoc native and custom checkbox spellings", () => {
  for (const source of [
    '<input type="checkbox" />',
    "<input type={'checkbox'} />",
    "<input type={`checkbox`} />",
    '<button role="checkbox" />',
    "<span role={'checkbox'} />",
  ])
    expect(rawCheckboxes(source), source).toHaveLength(1);
  expect(rawCheckboxes("<CheckboxControl checked={true} />")).toEqual([]);
  expect(rawCheckboxes('<input type="radio" />')).toEqual([]);
});
