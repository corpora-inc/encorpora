"""The static-site CI gate must cover its shared analytics dependencies."""
from pathlib import Path
import re


def test_shared_analytics_changes_run_the_site_gate():
    workflow = (Path(__file__).resolve().parents[1] / "workflows/ci.yml").read_text()
    match = re.search(r"set_output corpora_site '([^']+)'", workflow)
    assert match, "missing static-site path filter"
    pattern = match.group(1)
    for module in ("browser-identity", "engagement", "entry-context", "site-actions"):
        assert re.search(pattern, f"amp/src/analytics/{module}.ts"), module
    assert re.search(pattern, "corpora-site/src/engagement-client.ts")
    assert not re.search(pattern, "corpan/corpan-app/src/main.tsx")
