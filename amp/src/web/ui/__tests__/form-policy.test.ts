// @vitest-environment node
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  formPolicyViolations,
  formProblems,
} from "../../../../scripts/form-policy";

test("lint:controls finds every way to a native bubble", () => {
  expect(formProblems(`<form onSubmit={f}><input /></form>`)).toEqual([
    "1: a raw <form>: use ui/Form",
  ]);
  expect(formProblems(`<form onSubmit={f} />`, { isFormOwner: true })).toEqual([
    "1: ui/Form's <form> must be noValidate",
  ]);
  expect(
    formProblems(`input.current?.reportValidity();`, { tsx: false }),
  ).toEqual([
    "1: reportValidity() draws the browser's bubble: use checkValidity()",
  ]);
  expect(formProblems(`<CellField required pattern="[0-9]+" />`)).toEqual([
    "1: `required` on <CellField>: put the rule on ui/TextField",
    "1: `pattern` on <CellField>: put the rule on ui/TextField",
  ]);
  expect(formProblems(`<Field type="email" />`)).toEqual([
    '1: type="email" on <Field>: use ui/TextField',
  ]);
  expect(
    formProblems(`<TextField required type="email" label="Email" />`),
  ).toEqual([]);
  expect(
    formPolicyViolations(fileURLToPath(new URL("../..", import.meta.url))),
  ).toEqual([]);
});
