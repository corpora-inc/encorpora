"""Tasks: built-ins register on import; corpus task modules are loaded by path."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from . import builtin  # noqa: F401  (registers terms, facts, explanations, applicability)
from .base import Task, TaskInput, get_task, register_task, task_names
from .units import Unit, own_lines, section_units

__all__ = ["Task", "TaskInput", "get_task", "register_task", "task_names", "Unit", "own_lines",
           "section_units", "load_task_module"]


def load_task_module(path: Path) -> None:
    """Import a corpus task file; its @register_task classes become available by name."""
    name = f"harvest_corpus_tasks.{path.stem}_{abs(hash(str(path))) % 10**8}"
    if name in sys.modules:
        return
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load task module {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
