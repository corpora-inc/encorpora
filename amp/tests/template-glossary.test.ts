import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { glossary, hasGlossaryEntry } from "../src/glossary";
import { k8TemplateGlossary } from "../src/math/template-glossary-k8";

test("every K–8 template sense names a real template, form and glossary entry", () => {
  const ids = new Set(templates.map((t) => t.id));
  for (const [id, { senses = {}, noLink = [] }] of Object.entries(
    k8TemplateGlossary,
  )) {
    assert.ok(ids.has(id), `${id} is a template`);
    for (const [form, term] of Object.entries(senses)) {
      assert.ok(hasGlossaryEntry(term), `${id}: ${term} is a glossary entry`);
      assert.ok(
        glossary.find((e) => e.id === term)!.forms.includes(form),
        `${id}: "${form}" is a form of ${term}`,
      );
    }
    for (const form of noLink)
      assert.ok(
        glossary.some((e) => e.forms.includes(form)),
        `${id}: "${form}" is a glossary form`,
      );
  }
});

test("engine templates carry their K–8 senses", () => {
  for (const [id, { senses = {}, noLink = [] }] of Object.entries(
    k8TemplateGlossary,
  )) {
    const t = templates.find((x) => x.id === id)!;
    for (const [form, term] of Object.entries(senses))
      assert.equal(t.glossarySenses?.[form], term, `${id}: ${form}`);
    for (const form of noLink) {
      assert.ok(t.glossaryNoLink?.includes(form), `${id}: ${form}`);
      assert.equal(t.glossarySenses?.[form], undefined, `${id}: ${form}`);
    }
  }
});
