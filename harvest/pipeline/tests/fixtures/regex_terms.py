"""Example corpus task module (the README's "how to add a task"), loaded by path from corpus YAML.

A deterministic task: definitions of the form "<I>Term</I> means ..." become term rows, with no model.
"""

import re

from harvest_pipeline.tasks import Task, TaskInput, register_task, section_units
from harvest_pipeline.verify import check_quote


@register_task
class RegexTerms(Task):
    name = "regex_terms"
    prompt_version = "1"
    tables = ("term",)
    system = "unused: deterministic"
    schema = {"type": "object", "required": ["items"], "properties": {"items": {"type": "array"}}}

    def select(self, stage):                       # 1. selector
        for u in section_units(stage):
            yield TaskInput(u.key, u.material(), {"ids": u.ids, "lines": u.lines})

    def deterministic(self, inp):                  # output without a model
        items = []
        for sid, line in inp.data["lines"]:
            m = re.match(r"(.+?) means (.+)", line)
            if m:
                items.append({"term": m.group(1), "definition": m.group(2), "quote": line, "section_id": sid})
        return {"items": items}

    def check(self, item, inp, stage):             # 4. verifiers
        return check_quote(item, stage, inp.data["ids"])

    def rows(self, item, inp, stage):              # 5. writer
        return {"term": [{"term_id": f"{item['term'].lower()}@{item['section_id']}", "term": item["term"],
                          "definition": item["definition"], "section_id": item["section_id"],
                          "quote": item["quote"], "lang": "en"}]}
