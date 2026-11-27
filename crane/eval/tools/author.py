#!/usr/bin/env python3
"""Author held-out evaluation items with Opus, grounded in the eCFR section text.

This is the eval lane's own authoring process. It reads only the official text
(sections.jsonl from ecfr_sections.py) and never the pack, the bake prompts or
crane/content outputs.

    python3 crane/eval/tools/author.py --sections sections.jsonl --out raw/ [--only B07] [--jobs 3]

One call per batch; the raw structured output is written to raw/<batch>.json
and reused on re-runs (delete the file to re-author a batch).
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
from pathlib import Path

CATEGORIES = [
    "scope-definitions", "ground-conditions", "assembly-disassembly", "power-lines", "inspections",
    "wire-rope", "safety-devices", "operational-aids", "operator-duties", "wind-weather", "signals",
    "fall-protection", "work-area-control", "operator-qualification", "training", "personnel-lifts",
    "multiple-crane-lifts", "load-charts", "design-modification", "tower-cranes", "derricks",
    "floating-cranes", "overhead-gantry", "crawler-truck-locomotive", "rigging-slings",
    "sideboom-pile-small", "decline-manufacturer", "decline-asme", "decline-legal",
    "decline-non-crane", "decline-specific-load-chart", "decline-other-jurisdiction",
    "decline-other",
]
EQUIPMENT = [
    "mobile-crane", "crawler-crane", "truck-crane", "rough-terrain-crane", "locomotive-crane",
    "articulating-boom-crane", "boom-truck", "tower-crane", "derrick", "overhead-crane",
    "gantry-crane", "floating-crane", "sideboom", "digger-derrick", "pile-driver",
    "service-truck-crane", "small-capacity-equipment", "personnel-platform",
]

# (batch id, section prefixes, items to ask for, focus note)
BATCHES = [
    ("B01", ["29cfr1926.1400", "29cfr1926.1401"], 14, "scope, exclusions and definitions; what equipment is covered"),
    ("B02", ["29cfr1926.1402", "29cfr1926.1403", "29cfr1926.1404(a)", "29cfr1926.1404(b)", "29cfr1926.1404(c)",
             "29cfr1926.1404(d)", "29cfr1926.1404(e)", "29cfr1926.1404(f)", "29cfr1926.1404(g)", "29cfr1926.1404(h)"],
     14, "ground conditions and assembly/disassembly supervision, crew, hazards"),
    ("B03", ["29cfr1926.1404(j)", "29cfr1926.1404(k)", "29cfr1926.1404(l)", "29cfr1926.1404(m)", "29cfr1926.1404(n)",
             "29cfr1926.1404(o)", "29cfr1926.1404(p)", "29cfr1926.1404(q)", "29cfr1926.1404(r)", "29cfr1926.1405",
             "29cfr1926.1406", "29cfr1926-subpartCC-appB"], 12, "assembly/disassembly details: cantilevered booms, pins, outriggers, rigging, tower crane disassembly"),
    ("B04", ["29cfr1926.1407", "29cfr1926.1408", "29cfr1926.1409"], 16, "power lines during assembly and during operation, Table A, encroachment measures, training"),
    ("B05", ["29cfr1926.1410", "29cfr1926.1411"], 12, "work closer than Table A, travel under power lines, Table T"),
    ("B06", ["29cfr1926.1412"], 14, "inspections: modified, repaired, post-assembly, each shift, monthly, annual, severe service, documentation"),
    ("B07", ["29cfr1926.1413", "29cfr1926.1414"], 13, "wire rope inspection categories, removal criteria, wire rope selection"),
    ("B08", ["29cfr1926.1415", "29cfr1926.1416"], 13, "safety devices and operational aids, what to do when they fail, temporary alternatives"),
    ("B09", ["29cfr1926.1417", "29cfr1926.1418"], 15, "operation: manufacturer procedures, leaving the controls, tag-out, wind/weather, load weight, booms near other equipment, authority to stop"),
    ("B10", ["29cfr1926.1419", "29cfr1926.1420", "29cfr1926.1421", "29cfr1926.1422", "29cfr1926-subpartCC-appA"],
     12, "signals: when a signal person is needed, radio, hand signals, voice, new signals"),
    ("B11", ["29cfr1926.1423", "29cfr1926.1424", "29cfr1926.1425", "29cfr1926.1426"], 13, "fall protection, work area control and swing radius, keeping clear of the load, free fall and controlled load lowering"),
    ("B12", ["29cfr1926.1427", "29cfr1926.1428"], 14, "operator qualification and certification, operator-in-training, signal person qualification"),
    ("B13", ["29cfr1926.1429", "29cfr1926.1430", "29cfr1926-subpartCC-appC"], 10, "maintenance/repair qualification, training requirements, written exam criteria"),
    ("B14", ["29cfr1926.1431"], 15, "hoisting personnel: when allowed, platform, trial lift, proof test, pre-lift meeting, wind, near power lines"),
    ("B15", ["29cfr1926.1432", "29cfr1926.1433", "29cfr1926.1434"], 11, "multiple-crane lifts, design and testing standards, modifications"),
    ("B16", ["29cfr1926.1435", "29cfr1926.1436"], 13, "tower cranes and derricks"),
    ("B17", ["29cfr1926.1437", "29cfr1926.1438", "29cfr1926.1439", "29cfr1926.1440", "29cfr1926.1441", "29cfr1926.1442"],
     13, "floating cranes and barges, overhead and gantry cranes in construction, pile drivers, sidebooms, equipment 2,000 lbs or less"),
    ("B18", ["29cfr1910.179(a)", "29cfr1910.179(b)", "29cfr1910.179(c)", "29cfr1910.179(d)", "29cfr1910.179(e)",
             "29cfr1910.179(f)", "29cfr1910.179(g)", "29cfr1910.179(h)", "29cfr1910.179(i)"], 13,
     "general-industry overhead and gantry cranes: definitions, clearances, cabs, footwalks, stops, brakes, electrical, hoisting equipment"),
    ("B19", ["29cfr1910.179(j)", "29cfr1910.179(k)", "29cfr1910.179(l)", "29cfr1910.179(m)", "29cfr1910.179(n)", "29cfr1910.179(o)"], 14,
     "overhead and gantry cranes: frequent and periodic inspection, testing, maintenance, rope inspection, handling the load"),
    ("B20", ["29cfr1910.180"], 15, "general-industry crawler, locomotive and truck cranes: load ratings, inspection, testing, operations, power lines"),
    ("B21", ["29cfr1910.184"], 15, "slings: alloy steel chain, wire rope, metal mesh, natural and synthetic fiber rope, synthetic web; inspection and removal"),
    # Supplement after the first pass, for topics the first pass covered thinly.
    ("B22", ["29cfr1926.1417(n)", "29cfr1926.1417(h)", "29cfr1926.1431(k)(8)", "29cfr1926.1412(d)(1)(xii)",
             "29cfr1926.1435(b)(4)", "29cfr1926.1435(e)(6)", "29cfr1926.1437(e)(3)", "29cfr1926.1437-tableM2",
             "29cfr1926.1437-tableM3", "29cfr1910.179(b)(4)", "29cfr1910.180(c)(1)", "29cfr1926.1432",
             "29cfr1926.1417(c)", "29cfr1926.1417(o)", "29cfr1926.1433(d)(1)", "29cfr1926.1433(d)(3)",
             "29cfr1926.1433(d)(7)", "29cfr1926-subpartCC-appC(d)", "29cfr1926.1402"], 18,
     "at least 6 on wind, weather and lightning (category wind-weather), 4 on multiple-crane lifts "
     "(multiple-crane-lifts), 5 on load charts and rated capacity (load-charts), 3 on ground conditions "
     "(ground-conditions)"),
]

SYSTEM = """You write held-out test questions for an offline question-answering tool used by crane operators, riggers, signal persons, inspectors and trainees. The tool answers only from US federal crane regulations (29 CFR 1926 Subpart CC and 29 CFR 1910.179, .180, .184). Your questions will measure whether it finds the right rule and states it correctly.

Rules:
- Ground every item in the regulation text you are given. Section ids are in square brackets; use them exactly.
- Write questions the way real people ask on a job site or into a phone: field slang ("the pick", "outriggers out", "hot lines", "the stick", "two-blocking", "knuckle boom", "cherry picker"), vague or underspecified asks, voice-to-text with no punctuation, typos and misspellings, multi-part questions, a few formal ones. Never copy the regulation's wording into the question.
- Mix difficulty: easy (one fact), medium (a condition or exception), hard (combining paragraphs, exceptions, or a scenario).
- Include items that only apply to a specific kind of equipment or configuration (e.g. articulating boom, tower crane, derrick, floating crane, overhead crane, crawler, boom truck, equipment rated 2,000 lbs or less) and set "equipment" for them; otherwise set "equipment" to null.
- gold_answer: 1-3 short sentences a reviewer can check, with the exact numbers and conditions.
- section_ids: the most specific paragraphs that support the answer (1-4 ids), each exactly as bracketed in the text.
- key_quote: if the answer turns on a limit, distance, interval, capacity or exact duty, copy the shortest verbatim span (5-40 words) from the text of ONE of the section_ids, character for character, never spanning a paragraph label; otherwise null.
- expert_review_needed: true when the answer depends on interpretation, an exception chain, or field practice beyond the text; say why in one line.
- Do not write questions whose answer is not in the text you were given."""

SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "style": {"type": "string", "enum": ["slang", "vague", "voice", "typo", "multi-part", "formal", "scenario"]},
            "category": {"type": "string", "enum": [c for c in CATEGORIES if not c.startswith("decline-")]},
            "gold_answer": {"type": "string"},
            "section_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
            "key_quote": {"anyOf": [{"type": "null"}, {"type": "object", "properties": {
                "section_id": {"type": "string"}, "text": {"type": "string"}}, "required": ["section_id", "text"]}]},
            "equipment": {"anyOf": [{"type": "null"}, {"type": "string", "enum": EQUIPMENT}]},
            "variant": {"anyOf": [{"type": "null"}, {"type": "string"}]},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
            "expert_review_needed": {"type": "boolean"},
            "expert_review_why": {"anyOf": [{"type": "null"}, {"type": "string"}]},
        },
        "required": ["question", "style", "category", "gold_answer", "section_ids", "key_quote", "equipment",
                     "variant", "difficulty", "expert_review_needed", "expert_review_why"],
    }}},
    "required": ["items"],
}

DECLINE_SYSTEM = """You write held-out test questions that an offline crane-regulation assistant MUST DECLINE. The assistant's only sources are 29 CFR 1926 Subpart CC (cranes and derricks in construction, with appendices) and 29 CFR 1910.179, .180 and .184 (overhead/gantry cranes; crawler, locomotive and truck cranes; slings). The table of contents is given. A correct system says it cannot answer from its sources and points to the nearest section, instead of answering.

Each question must be plausible from a crane worker and must NOT be answerable from those sources. Cover, with the counts asked:
- decline-manufacturer: a specific make/model's procedure, setting, part number, torque, or operator-manual content;
- decline-specific-load-chart: a capacity that needs a particular crane's load chart (model, boom, radius, counterweight);
- decline-asme: the text or a specific number from an ASME B30 volume (copyrighted, not in the sources);
- decline-legal: legal advice, liability, lawsuits, penalty amounts, citations contesting, workers' comp;
- decline-non-crane: a different topic (forklifts, scaffolds, aerial lifts, excavation, trucking hours, first aid, general electrical work, unrelated);
- decline-other-jurisdiction: a state plan, another country, a specific employer or a non-OSHA body (e.g. a certification body's exam content, a port authority);
- decline-other: anything else plausible but unsupported (future rule changes, statistics, prices, opinions, medical).
Phrase them the way people ask (slang, voice, typos, vague, multi-part). Avoid ones that are partly answerable from the sources unless the core of the ask is not. gold_answer says briefly why it must be declined and what nearest section (if any) a good decline points to; put that nearest id in nearest_section_ids (from the table of contents, may be empty)."""

DECLINE_SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "style": {"type": "string", "enum": ["slang", "vague", "voice", "typo", "multi-part", "formal", "scenario"]},
            "category": {"type": "string", "enum": [c for c in CATEGORIES if c.startswith("decline-")]},
            "gold_answer": {"type": "string"},
            "nearest_section_ids": {"type": "array", "items": {"type": "string"}},
            "equipment": {"anyOf": [{"type": "null"}, {"type": "string", "enum": EQUIPMENT}]},
            "variant": {"anyOf": [{"type": "null"}, {"type": "string"}]},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        },
        "required": ["question", "style", "category", "gold_answer", "nearest_section_ids", "equipment",
                     "variant", "difficulty"],
    }}},
    "required": ["items"],
}
DECLINE_BATCHES = [
    ("D01", "decline-manufacturer: 8, decline-specific-load-chart: 8, decline-asme: 7, decline-other: 3"),
    ("D02", "decline-legal: 7, decline-non-crane: 9, decline-other-jurisdiction: 7, decline-other: 3"),
]


def load_sections(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.open()]


def in_prefix(sid: str, prefixes: list[str]) -> bool:
    for p in prefixes:
        if sid == p or sid.startswith(p + "(") or sid.startswith(p + "-"):
            return True
    return False


def render(rows: list[dict]) -> str:
    out = []
    for r in rows:
        head = f" {r['heading']}" if r.get("heading") and r["kind"] in ("section", "appendix") else ""
        text = r["text"] or ("(figures only; no text)" if r["kind"] == "appendix" else "")
        out.append(f"[{r['section_id']}]{head} {text}".rstrip())
    return "\n".join(out)


def call(system: str, schema: dict, prompt: str, model: str) -> dict:
    cmd = ["claude", "-p", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
           "--tools", "", "--no-session-persistence", "--model", model, "--system-prompt", system,
           "--json-schema", json.dumps(schema), "--output-format", "json"]
    os.makedirs("/tmp/harvest-empty", exist_ok=True)
    p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, cwd="/tmp/harvest-empty", timeout=1800)
    if p.returncode != 0:
        raise RuntimeError(f"claude failed: {p.stderr[-2000:]} {p.stdout[-2000:]}")
    res = json.loads(p.stdout)
    if not res.get("structured_output"):
        raise RuntimeError(f"no structured_output: {p.stdout[-2000:]}")
    return {"output": res["structured_output"], "models": list((res.get("modelUsage") or {}).keys()),
            "cost_usd": res.get("total_cost_usd"), "duration_ms": res.get("duration_ms")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sections", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--model", default="opus")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    rows = load_sections(a.sections)
    jobs = []
    for batch_id, prefixes, n, focus in BATCHES:
        sel = [r for r in rows if in_prefix(r["section_id"], prefixes)]
        prompt = (f"Write {n} test items about: {focus}.\nUse a different asking style for most items "
                  f"and at least 3 equipment-specific items where the text allows.\n\nREGULATION TEXT\n"
                  f"{render(sel)}\n")
        jobs.append((batch_id, SYSTEM, SCHEMA, prompt))
    toc = "\n".join(f"[{r['section_id']}] {r['heading']}" for r in rows if r["depth"] == 0)
    for batch_id, counts in DECLINE_BATCHES:
        prompt = f"Write these must-decline items: {counts}.\n\nTABLE OF CONTENTS OF THE SOURCES\n{toc}\n"
        jobs.append((batch_id, DECLINE_SYSTEM, DECLINE_SCHEMA, prompt))
    jobs = [j for j in jobs if (not a.only or j[0] in a.only) and not (a.out / f"{j[0]}.json").exists()]

    def run(job):
        batch_id, system, schema, prompt = job
        res = call(system, schema, prompt, a.model)
        res["batch"] = batch_id
        res["prompt_chars"] = len(prompt)
        (a.out / f"{batch_id}.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
        return batch_id, len(res["output"]["items"]), res["cost_usd"]

    with cf.ThreadPoolExecutor(max_workers=min(a.jobs, 3)) as ex:
        for fut in cf.as_completed([ex.submit(run, j) for j in jobs]):
            try:
                print(*fut.result(), flush=True)
            except Exception as e:  # noqa: BLE001 - report and keep the other batches
                print(f"ERROR {e}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
