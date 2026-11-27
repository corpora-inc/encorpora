"""The task interface: how an enrichment step is declared.

A task is five things:

  1. an input selector over stage rows      `select(stage) -> [TaskInput]`
  2. a prompt template with a version       `system`, `prompt(input)`, `prompt_version`
  3. a strict JSON schema for the output    `schema` (each generated item is one element of `items`)
  4. deterministic verifiers                `check(item, input, stage) -> [problems]`
  5. a table writer                         `rows(item, input, stage) -> {table: [row, ...]}`

plus an optional judge rubric (`judge_rubric`), which sends the items that pass the
deterministic checks to a second model for a pass / fail / needs_review verdict.

The engine owns everything else: hashing, the response cache, backends, retries, provenance,
verdicts and the release filter. Register a task with `@register_task` on the class.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Iterable

from ..stage import Stage
from ..textutil import sha256_text

_TASKS: dict[str, type["Task"]] = {}


def register_task(cls: type["Task"]) -> type["Task"]:
    if not getattr(cls, "name", None):
        raise ValueError(f"{cls.__name__} has no name")
    _TASKS[cls.name] = cls
    return cls


def task_names() -> list[str]:
    return sorted(_TASKS)


def get_task(name: str, options: dict | None = None) -> "Task":
    if name not in _TASKS:
        raise SystemExit(f"unknown task {name!r}; registered: {task_names()}")
    return _TASKS[name](**(options or {}))


@dataclass
class TaskInput:
    key: str                     # stable, human-readable id of this input ('29cfr1926.1408#2')
    material: str                # exactly what the model is shown (hashed into input_sha256)
    data: dict = field(default_factory=dict)   # anything the template, verifiers and writer need


class Task:
    name: str = ""
    prompt_id: str = ""          # defaults to 'harvest.<name>'
    prompt_version: str = "1"
    system: str = ""
    schema: dict = {}
    judge_rubric: str | None = None
    tables: tuple[str, ...] = ()
    after: tuple[str, ...] = ()  # tasks whose passing rows this task reads
    max_tokens: int = 16000

    def __init__(self, **options):
        self.options = options

    # 1. selector
    def select(self, stage: Stage) -> Iterable[TaskInput]:
        raise NotImplementedError

    # 2. template
    def prompt(self, inp: TaskInput) -> str:
        return inp.material

    # 3. items of the (schema-valid) output
    def items(self, output: dict) -> list[dict]:
        return list(output.get("items", []))

    # 4. deterministic verifiers: return problems; empty list = pass
    def check(self, item: dict, inp: TaskInput, stage: Stage) -> list[str]:
        return []

    # 5. writer: rows to insert, by table; `prov_id` is filled in by the engine
    def rows(self, item: dict, inp: TaskInput, stage: Stage) -> dict[str, list[dict]]:
        raise NotImplementedError

    # optional: output with no model (used by the `deterministic` backend)
    def deterministic(self, inp: TaskInput) -> dict | None:
        return None

    # identity
    @property
    def pid(self) -> str:
        return self.prompt_id or f"harvest.{self.name}"

    @property
    def prompt_sha256(self) -> str:
        return sha256_text(json.dumps({"system": self.system, "schema": self.schema, "v": self.prompt_version,
                                       "judge": self.judge_rubric}, sort_keys=True))

    def describe_item(self, item: dict) -> str:
        """How an item is shown to the judge."""
        return json.dumps(item, ensure_ascii=False, sort_keys=True)
